import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadBoardById, loadMembers } from "@/lib/boards";
import { todayISO } from "@/lib/format";
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
    .select("id, name, description, status, starts_on, ends_on, goal, color, board_id").eq("id", id).maybeSingle<Project>();
  if (!project) notFound();

  const [memberRows, money, weeks, links, updates, files, people] = await Promise.all([
    supabase.from("project_members").select("user_id").eq("project_id", id),
    supabase.rpc("project_money", { p: id }),
    supabase.rpc("project_money_by_week", { p: id }),
    supabase.from("project_links").select("id, title, url, created_by, created_at").eq("project_id", id).order("created_at", { ascending: false }).returns<ProjectLink[]>(),
    supabase.from("project_updates").select("id, body, created_by, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(50).returns<ProjectUpdate[]>(),
    supabase.from("project_files").select("id, name, size, mime, path, uploaded_by, created_at").eq("project_id", id).order("created_at", { ascending: false }).returns<ProjectFile[]>(),
    loadMembers(),
  ]);
  const memberIds = (memberRows.data ?? []).map((m) => m.user_id as string);
  const board = project.board_id ? await loadBoardById(project.board_id, memberIds) : null;
  const m = (money.data as { revenue: number; costs: number; profit: number }[] | null)?.[0];

  return (
    <ProjectPage project={project} memberIds={memberIds} people={people} board={board} viewer={viewer} meId={me.id} isLeader={isAdmin}
      money={{ revenue: Number(m?.revenue ?? 0), costs: Number(m?.costs ?? 0), profit: Number(m?.profit ?? 0) }}
      weeks={((weeks.data ?? []) as { week: string; revenue: number }[]).map((w) => ({ week: w.week, revenue: Number(w.revenue) }))}
      links={links.data ?? []} updates={updates.data ?? []} files={files.data ?? []} tab={tab} today={todayISO()} />
  );
}
