import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSession, type Profile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { weekStart } from "@/lib/metrics";
import { todayISO } from "@/lib/format";
import { loadMember } from "@/lib/team-stats";
import { MemberDashboard } from "@/components/team/member-dashboard";
import { loadMembers } from "@/lib/boards";
import type { ProjectCard } from "@/components/projects/my-projects";

/** One person's page: their open and finished tasks, sales, weekly activity and what's coming up. */
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { groups, me, isAdmin } = await getSession();
  const supabase = await createClient();
  const { data: person } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>();
  if (!person) notFound();
  const locale = await getLocale();
  const d = await loadMember(person, groups, weekStart(Date.now()), locale, (await getTranslations("personal"))("company"));
  const g = groups.find((x) => x.id === person.group_id);
  // My Projects (own profile only): leaders see every project, everyone else the ones they're in
  let projects: ProjectCard[] = [], people: Awaited<ReturnType<typeof loadMembers>> = [];
  if (person.id === me.id) {
    const mine = isAdmin ? null : ((await supabase.from("project_members").select("project_id").eq("user_id", me.id)).data ?? []).map((r) => r.project_id as string);
    let q = supabase.from("projects").select("id, name, description, status, starts_on, ends_on, goal, color, project_members(count)").order("created_at", { ascending: false });
    if (mine) q = q.in("id", mine.length ? mine : ["00000000-0000-0000-0000-000000000000"]);
    const [{ data: rows }, members] = await Promise.all([q, isAdmin ? loadMembers() : Promise.resolve([])]);
    people = members;
    projects = await Promise.all((rows ?? []).map(async (r) => {
      const { data: m } = await supabase.rpc("project_money", { p: r.id });
      const { project_members, ...p } = r as typeof r & { project_members: { count: number }[] };
      return { ...(p as unknown as ProjectCard), members: project_members?.[0]?.count ?? 0, revenue: Number((m as { revenue: number }[] | null)?.[0]?.revenue ?? 0) };
    }));
  }
  return (
    <MemberDashboard today={todayISO()} d={d} isMe={person.id === me.id} isLeader={isAdmin} projects={projects} people={people}
      p={{ id: person.id, name: person.full_name, email: person.email, avatar: person.avatar_url, role: person.role_title, team: g?.name ?? null, teamSlug: g?.slug ?? null }} />
  );
}
