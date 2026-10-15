import "server-only";
import { createClient } from "@/lib/supabase/server";

/** A task the team leader gave out, with everyone it went to and whether they have ticked it off. */
export type TeamTask = {
  id: string; title: string; details: string; due_on: string | null; created_at: string; created_by: string | null;
  people: { id: string; name: string; avatar: string | null; done_at: string | null }[];
};

export async function loadTeamTasks(onlyFor?: string): Promise<TeamTask[]> {
  const sb = await createClient();
  let q = sb.from("team_tasks")
    .select("id, title, details, due_on, created_at, created_by, team_task_people(done_at, profiles(id, full_name, avatar_url))")
    .order("created_at", { ascending: false }).limit(100);
  if (onlyFor) q = q.in("id", (await sb.from("team_task_people").select("task_id").eq("user_id", onlyFor)).data?.map((x) => x.task_id) ?? []);
  const { data } = await q.returns<{
    id: string; title: string; details: string; due_on: string | null; created_at: string; created_by: string | null;
    team_task_people: { done_at: string | null; profiles: { id: string; full_name: string; avatar_url: string | null } | null }[];
  }[]>();
  return (data ?? []).map((t) => ({
    id: t.id, title: t.title, details: t.details, due_on: t.due_on, created_at: t.created_at, created_by: t.created_by,
    people: t.team_task_people.filter((p) => p.profiles).map((p) => ({ id: p.profiles!.id, name: p.profiles!.full_name, avatar: p.profiles!.avatar_url, done_at: p.done_at }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
