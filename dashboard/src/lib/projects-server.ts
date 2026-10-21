import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectCard } from "@/components/projects/my-projects";

/** My Projects: only the projects I'm a member of. all = every project (leaders' tool in Team Leader). */
export async function loadMyProjects(supabase: SupabaseClient, meId: string, all = false): Promise<ProjectCard[]> {
  const mine = all ? null : ((await supabase.from("project_members").select("project_id").eq("user_id", meId)).data ?? []).map((r) => r.project_id as string);
  let q = supabase.from("projects").select("id, name, description, status, starts_on, ends_on, goal, color, project_members(count)").order("created_at", { ascending: false });
  if (mine) q = q.in("id", mine.length ? mine : ["00000000-0000-0000-0000-000000000000"]);
  const { data: rows } = await q;
  return Promise.all((rows ?? []).map(async (r) => {
    const { data: m } = await supabase.rpc("project_money", { p: r.id });
    const { project_members, ...p } = r as typeof r & { project_members: { count: number }[] };
    return { ...(p as unknown as ProjectCard), members: project_members?.[0]?.count ?? 0, revenue: Number((m as { revenue: number }[] | null)?.[0]?.revenue ?? 0) };
  }));
}

/** Leaders' task tool: every project with the ids of its people (to give a task to one project). */
export async function loadProjectPeople(supabase: SupabaseClient): Promise<{ id: string; name: string; memberIds: string[] }[]> {
  const { data } = await supabase.from("projects").select("id, name, status, project_members(user_id)").neq("status", "closed").order("name");
  return (data ?? []).map((p) => ({ id: p.id as string, name: p.name as string, memberIds: ((p.project_members ?? []) as { user_id: string }[]).map((m) => m.user_id) }));
}
