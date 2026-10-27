import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSession, type Profile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { weekStart } from "@/lib/metrics";
import { todayISO } from "@/lib/format";
import { loadMember } from "@/lib/team-stats";
import { loadTeamTasks } from "@/lib/team-tasks";
import type { MemberTaskItem } from "@/lib/member-tasks";
import { MemberDashboard } from "@/components/team/member-dashboard";
import { loadMyProjects } from "@/lib/projects-server";
import type { ProjectCard } from "@/components/projects/my-projects";
import type { PointEntry } from "@/components/team/points-panel";

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
  // My Projects (own profile only): the projects I'm a member of
  const projects: ProjectCard[] = person.id === me.id ? await loadMyProjects(supabase, me.id) : [];
  // Community points, customer visits, learning points — everyone can see anyone's
  // Tasks: their board tasks + the team-leader tasks given to them (with their own tick)
  const teamTasks = await loadTeamTasks(person.id);
  const tasks: MemberTaskItem[] = [...d.tasks, ...teamTasks.map((x) => ({ id: `tt-${x.id}`, title: x.title, due: x.due_on, done_at: x.people.find((p) => p.id === person.id)?.done_at ?? null,
    href: person.id === me.id ? "/my-tasks#team-tasks" : undefined }))];
  const { data: points } = await supabase.from("member_points").select("id, kind, amount, happened_on, note, file_path, file_name").eq("user_id", person.id)
    .order("happened_on", { ascending: false }).order("created_at", { ascending: false }).returns<PointEntry[]>();
  return (
    <MemberDashboard today={todayISO()} d={d} isMe={person.id === me.id} isLeader={isAdmin} projects={projects} points={points ?? []} tasks={tasks}
      p={{ id: person.id, name: person.full_name, email: person.email, avatar: person.avatar_url, role: person.role_title, team: g?.name ?? null, teamSlug: g?.slug ?? null }} />
  );
}
