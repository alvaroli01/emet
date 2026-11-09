/** The Tasks page: one list over every shared board (EMET = the general + team boards, plus one board per project).
 *  Pure helpers, shared by the page and the tests. A task's status is the board column it sits in. */
export type Status = "todo" | "doing" | "blocked" | "done";
export type Priority = "high" | "medium" | "low";
export const STATUSES: Status[] = ["todo", "doing", "blocked", "done"];
export const PRIORITIES: Priority[] = ["high", "medium", "low"];

export type TaskBoard = { id: string; name: string; group_id: string | null; project_id: string | null; lists: { id: string; name: string }[] };
export type TaskPerson = { user_id: string; done_at: string | null; file_path: string | null; file_name: string | null };
export type TaskItem = { id: string; text: string; done: boolean; position: number };
export type Task = {
  id: string; board_id: string; list_id: string; title: string; description: string | null; due_at: string | null;
  completed_at: string | null; priority: Priority; needs_file: boolean; created_by: string | null; created_at: string;
  people: TaskPerson[]; checklist: TaskItem[];
};
export type Viewer = { meId: string; myGroupId: string | null; isLeader: boolean; isAdmin: boolean; isCoach: boolean; isGuest: boolean; editGroups: string[] };
export type ProjectInfo = { id: string; name: string; memberIds: string[] };

/** "Review" and "In progress" columns count as Doing; any other unknown column too. */
export function statusOf(listName: string | undefined): Status {
  const n = (listName ?? "").trim().toLowerCase();
  if (n === "to do" || n === "todo") return "todo";
  if (n === "blocked") return "blocked";
  if (n === "done") return "done";
  return "doing";
}

/** The column a status moves a task to on its board (first match), or null if the board has none. */
export function listFor(board: TaskBoard, status: Status): string | null {
  const exact = { todo: ["to do", "todo"], doing: ["doing", "in progress"], blocked: ["blocked"], done: ["done"] }[status];
  return board.lists.find((l) => exact.includes(l.name.trim().toLowerCase()))?.id ?? null;
}

/** Due dates are stored as the end of that day in Madrid; a task is late the day after, unless it is Done. */
export function isOverdue(task: Pick<Task, "due_at">, status: Status, now = Date.now()): boolean {
  return !!task.due_at && status !== "done" && Date.parse(task.due_at) < now;
}

export type Filters = { person: string; project: string; status: "" | "open" | Status; priority: "" | Priority; due: "" | "overdue" | "week" | "none" };
export const NO_FILTERS: Filters = { person: "", project: "", status: "", priority: "", due: "" };

/** project filter: "" = all, "emet" = not in a project, else a project id. */
export function filterTasks(tasks: Task[], boards: Map<string, TaskBoard>, statusById: (t: Task) => Status, f: Filters, now = Date.now()): Task[] {
  const week = now + 7 * 864e5;
  return tasks.filter((t) => {
    const s = statusById(t);
    const projectId = boards.get(t.board_id)?.project_id ?? null;
    if (f.person && !t.people.some((p) => p.user_id === f.person)) return false;
    if (f.project === "emet" ? projectId !== null : f.project && projectId !== f.project) return false;
    if (f.status === "open" ? s === "done" : f.status && s !== f.status) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.due === "overdue" && !isOverdue(t, s, now)) return false;
    if (f.due === "week" && (!t.due_at || s === "done" || Date.parse(t.due_at) > week)) return false;
    if (f.due === "none" && t.due_at) return false;
    return true;
  });
}

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
/** Open before done; then the soonest due date (none last); then priority; then newest. */
export function sortTasks(tasks: Task[], statusById: (t: Task) => Status): Task[] {
  return [...tasks].sort((a, b) =>
    Number(statusById(a) === "done") - Number(statusById(b) === "done")
    || Date.parse(a.due_at ?? "9999-12-31") - Date.parse(b.due_at ?? "9999-12-31")
    || RANK[a.priority] - RANK[b.priority]
    || b.created_at.localeCompare(a.created_at));
}

/* ── Permissions: mirror the database rules (can_add_card, can_edit_card, can_assign) so the page only offers what works ── */

export function canAdd(v: Viewer, board: TaskBoard, project?: ProjectInfo): boolean {
  if (v.isGuest) return false;
  if (v.isLeader) return true;
  if (board.project_id) return !!project?.memberIds.includes(v.meId);
  if (board.group_id) return v.editGroups.includes(board.group_id) || v.isCoach;
  return true;
}

export function canEdit(v: Viewer, board: TaskBoard, task: Task, project?: ProjectInfo): boolean {
  if (v.isLeader || task.people.some((p) => p.user_id === v.meId)) return true;
  if (board.project_id) return v.isAdmin || !!project?.memberIds.includes(v.meId);
  if (board.group_id) return v.editGroups.includes(board.group_id) || (v.isCoach && task.created_by === v.meId);
  return v.isAdmin || task.created_by === v.meId;
}

/** Project tasks are deleted by admins only (as before); elsewhere whoever can edit. */
export function canDelete(v: Viewer, board: TaskBoard, task: Task, project?: ProjectInfo): boolean {
  return board.project_id ? v.isAdmin : canEdit(v, board, task, project);
}

/** People a task on this board can go to. Project tasks always stay within the project (others couldn't see them). */
export function assignable<P extends { id: string; group_id: string | null }>(v: Viewer, board: TaskBoard, people: P[], project?: ProjectInfo): P[] {
  if (board.project_id) return people.filter((p) => project?.memberIds.includes(p.id) && (v.isLeader || v.isCoach || project.memberIds.includes(v.meId) || p.id === v.meId));
  if (v.isLeader || v.isCoach) return people;
  if (board.group_id) return people.filter((p) => p.group_id === board.group_id || p.id === v.meId);
  return people.filter((p) => p.id === v.meId || (!!v.myGroupId && p.group_id === v.myGroupId));
}

/** Goal progress: tasks done / all tasks of the project. */
export function progress(tasks: Task[], statusById: (t: Task) => Status): { done: number; total: number } {
  return { done: tasks.filter((t) => statusById(t) === "done").length, total: tasks.length };
}
