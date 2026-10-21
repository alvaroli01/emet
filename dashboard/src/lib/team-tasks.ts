import "server-only";
import { createClient } from "@/lib/supabase/server";

/** A task the team leader gave out, with everyone it went to and whether they have ticked it off. */
export type TeamTask = {
  id: string; title: string; details: string; due_on: string | null; created_at: string; created_by: string | null;
  project: { id: string; name: string } | null;
  people: { id: string; name: string; avatar: string | null; done_at: string | null }[];
};

/** onlyFor = a person's tasks (company + their projects); projectId = one project's tasks; neither = company-wide tasks only. */
export async function loadTeamTasks(onlyFor?: string, projectId?: string, all = false): Promise<TeamTask[]> {
  const sb = await createClient();
  let q = sb.from("team_tasks")
    .select("id, title, details, due_on, created_at, created_by, project_id, projects(name), team_task_people(done_at, profiles(id, full_name, avatar_url))")
    .order("created_at", { ascending: false }).limit(100);
  if (projectId) q = q.eq("project_id", projectId);
  else if (!onlyFor && !all) q = q.is("project_id", null);
  if (onlyFor) q = q.in("id", (await sb.from("team_task_people").select("task_id").eq("user_id", onlyFor)).data?.map((x) => x.task_id) ?? []);
  const { data } = await q.returns<{
    id: string; title: string; details: string; due_on: string | null; created_at: string; created_by: string | null;
    project_id: string | null; projects: { name: string } | null;
    team_task_people: { done_at: string | null; profiles: { id: string; full_name: string; avatar_url: string | null } | null }[];
  }[]>();
  return (data ?? []).map((t) => ({
    id: t.id, title: t.title, details: t.details, due_on: t.due_on, created_at: t.created_at, created_by: t.created_by,
    project: t.project_id ? { id: t.project_id, name: t.projects?.name ?? "" } : null,
    people: t.team_task_people.filter((p) => p.profiles).map((p) => ({ id: p.profiles!.id, name: p.profiles!.full_name, avatar: p.profiles!.avatar_url, done_at: p.done_at }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
