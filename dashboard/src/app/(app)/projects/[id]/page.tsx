import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadBoardById, loadMembers } from "@/lib/boards";
import { todayISO } from "@/lib/format";
import { loadTeamTasks } from "@/lib/team-tasks";
import type { ProjectLead } from "@/components/projects/project-leads";
import { ProjectPage, type Project, type ProjectLink, type ProjectUpdate, type ProjectFile } from "@/components/projects/project-page";

/** One project: only its members and the leaders get here (database rule); everyone else sees "not found". */
export default async function ProjectRoute({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { tab } = await searchParams;
  const { me, isAdmin, viewer } = await getSession();
  const supabase = await createClient();
  const { data: isMember } = await supabase.rpc("is_project_member", { p: id });
  if (!isMember) notFound();
  const { data: project } = await supabase.from("projects")
    .select("id, name, description, status, starts_on, ends_on, goal, color, icon_path").eq("id", id).maybeSingle<Project>();
  if (!project) notFound();
  if (project.icon_path) project.icon_url = (await supabase.storage.from("projects").createSignedUrl(project.icon_path, 3600)).data?.signedUrl ?? null;

  const [memberRows, money, weeks, links, updates, files, people, tickTasks, leads] = await Promise.all([
    supabase.from("project_members").select("user_id").eq("project_id", id),
    supabase.rpc("project_money", { p: id }),
    supabase.rpc("project_money_by_week", { p: id }),
    supabase.from("project_links").select("id, title, url, created_by, created_at").eq("project_id", id).order("created_at", { ascending: false }).returns<ProjectLink[]>(),
    supabase.from("project_updates").select("id, body, created_by, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(50).returns<ProjectUpdate[]>(),
    supabase.from("project_files").select("id, name, size, mime, path, uploaded_by, created_at").eq("project_id", id).order("created_at", { ascending: false }).returns<ProjectFile[]>(),
    loadMembers(),
    loadTeamTasks(undefined, id),
    supabase.from("scout_leads").select("id, score, fit, status, evidence, why, scout_project_id:project_id, place:scout_places(name, address, city, lat, lng, website, instagram, phone, maps_url)").eq("saved_project_id", id).order("score", { ascending: false }).returns<ProjectLead[]>(),
  ]);
  const memberIds = (memberRows.data ?? []).map((m) => m.user_id as string);
  // The project's task board points at the project (boards.project_id)
  const { data: b } = await supabase.from("boards").select("id").eq("project_id", id).maybeSingle();
  const board = b ? await loadBoardById(b.id as string, memberIds) : null;
  const m = (money.data as { revenue: number; costs: number; profit: number }[] | null)?.[0];

  return (
    <ProjectPage project={project} memberIds={memberIds} people={people} board={board} viewer={viewer} meId={me.id} isLeader={isAdmin}
      money={{ revenue: Number(m?.revenue ?? 0), costs: Number(m?.costs ?? 0), profit: Number(m?.profit ?? 0) }}
      weeks={((weeks.data ?? []) as { week: string; revenue: number }[]).map((w) => ({ week: w.week, revenue: Number(w.revenue) }))}
      links={links.data ?? []} updates={updates.data ?? []} files={files.data ?? []} tickTasks={tickTasks} leads={leads.data ?? []} tab={tab} today={todayISO()} />
  );
}
