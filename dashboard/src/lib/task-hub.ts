import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadMembers } from "@/lib/boards";
import { loadProjectPeople } from "@/lib/projects-server";
import { statusOf, isMineToSee, progress, type Task, type TaskBoard } from "@/lib/tasks";
import type { Goal } from "@/components/tasks/tasks-view";

type RawTask = Omit<Task, "people" | "checklist"> & {
  card_assignees: Task["people"]; card_checklist_items: Task["checklist"];
};

/**
 * Tasks page data: EMET tasks (the general + team boards) and the tasks of the projects I'm in.
 * `everyone` (Team Leaders → All tasks, Alvaro 2026-11-13): every one of those tasks, not only the ones given to me.
 */
export async function loadTaskHub(meId: string, everyone = false) {
  const supabase = await createClient();
  // Private "My board"s are personal and stay on My Tasks
  const { data: boardRows } = await supabase.from("boards").select("id, name, group_id, project_id, board_lists(id, name, position)").is("owner_id", null)
    .returns<(Omit<TaskBoard, "lists"> & { board_lists: { id: string; name: string; position: number }[] })[]>();
  const allBoards: TaskBoard[] = (boardRows ?? []).map(({ board_lists, ...b }) => ({ ...b, lists: [...board_lists].sort((x, y) => x.position - y.position) }));
  const [cards, people, projects, goals] = await Promise.all([
    allBoards.length
      ? supabase.from("cards").select("id, board_id, list_id, title, description, due_at, completed_at, priority, needs_file, created_by, created_at, card_assignees(user_id, done_at, file_path, file_name), card_checklist_items(id, text, done, position)")
          .in("board_id", allBoards.map((b) => b.id)).order("created_at", { ascending: false }).limit(1000).returns<RawTask[]>()
      : Promise.resolve({ data: [] as RawTask[] }),
    loadMembers(true),
    loadProjectPeople(supabase),
    supabase.from("project_goals").select("project_id, statement, target_on, milestones").returns<Goal[]>(),
  ]);
  // Only the projects I'm in (leaders and the coach can see more, but this is about my work); EMET tasks for everyone
  const myProjects = new Set(projects.filter((p) => p.memberIds.includes(meId)).map((p) => p.id));
  const boards = allBoards.filter((b) => !b.project_id || myProjects.has(b.project_id));
  const boardIds = new Set(boards.map((b) => b.id));
  const everyTask: Task[] = (cards.data ?? []).filter((c) => boardIds.has(c.board_id)).map(({ card_assignees, card_checklist_items, ...c }) => ({
    ...c, people: card_assignees, checklist: [...card_checklist_items].sort((a, b) => a.position - b.position),
  }));
  // Only tasks given to me or that I created (unless `everyone`); a project's goal still counts all its tasks
  const tasks = everyone ? everyTask : everyTask.filter((x) => isMineToSee(x, meId));
  // Only projects that have a board here (a project you can see)
  const shown = projects.filter((p) => myProjects.has(p.id) && boards.some((b) => b.project_id === p.id));
  const listName = new Map(boards.flatMap((b) => b.lists.map((l) => [l.id, l.name] as const)));
  const st = (x: Task) => statusOf(listName.get(x.list_id));
  const goalProgress = Object.fromEntries(shown.map((p) => [p.id, progress(everyTask.filter((x) => boards.find((b) => b.id === x.board_id)?.project_id === p.id), st)]));
  return { tasks, boards, people, projects: shown, goals: goals.data ?? [], goalProgress, st };
}
