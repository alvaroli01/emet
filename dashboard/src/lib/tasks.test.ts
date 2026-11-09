import { test } from "node:test";
import assert from "node:assert/strict";
import { isMineToSee, statusOf, listFor, isOverdue, filterTasks, sortTasks, canAdd, canEdit, canDelete, assignable, NO_FILTERS, type Task, type TaskBoard, type Viewer } from "./tasks.ts";

const board = (over: Partial<TaskBoard> = {}): TaskBoard => ({ id: "b1", name: "emet", group_id: null, project_id: null,
  lists: [{ id: "l1", name: "To do" }, { id: "l2", name: "Doing" }, { id: "l3", name: "Review" }, { id: "l4", name: "Blocked" }, { id: "l5", name: "Done" }], ...over });
const task = (over: Partial<Task> = {}): Task => ({ id: "t", board_id: "b1", list_id: "l1", title: "x", description: null, due_at: null, completed_at: null,
  priority: "medium", needs_file: false, created_by: "u9", created_at: "2026-11-01T00:00:00Z", people: [], checklist: [], ...over });
const member: Viewer = { meId: "u1", myGroupId: "g1", isLeader: false, isAdmin: false, isCoach: false, isGuest: false, editGroups: ["g1"] };
const leader: Viewer = { ...member, isLeader: true };

test("status comes from the column; Review counts as in progress", () => {
  assert.equal(statusOf("To do"), "todo");
  assert.equal(statusOf("Review"), "doing");
  assert.equal(statusOf("Blocked"), "blocked");
  assert.equal(statusOf("done"), "done");
  assert.equal(listFor(board(), "blocked"), "l4");
  assert.equal(listFor(board({ lists: [{ id: "a", name: "To do" }] }), "blocked"), null);
});

test("overdue only after the due moment and never when done", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  assert.equal(isOverdue({ due_at: "2026-11-09T21:59:00Z" }, "todo", now), true);
  assert.equal(isOverdue({ due_at: "2026-11-09T21:59:00Z" }, "done", now), false);
  assert.equal(isOverdue({ due_at: "2026-11-10T21:59:00Z" }, "todo", now), false);
  assert.equal(isOverdue({ due_at: null }, "todo", now), false);
});

test("filters by person, EMET vs project, open, priority and due", () => {
  const boards = new Map([["b1", board()], ["b2", board({ id: "b2", project_id: "p1" })]]);
  const st = (t: Task) => statusOf(boards.get(t.board_id)!.lists.find((l) => l.id === t.list_id)?.name);
  const now = Date.parse("2026-11-10T12:00:00Z");
  const a = task({ id: "a", people: [{ user_id: "u1", done_at: null, file_path: null, file_name: null }], due_at: "2026-11-08T21:59:00Z", priority: "high" });
  const b = task({ id: "b", board_id: "b2", list_id: "l5" });
  const c = task({ id: "c", due_at: "2026-11-12T21:59:00Z" });
  const ids = (f: Partial<typeof NO_FILTERS>) => filterTasks([a, b, c], boards, st, { ...NO_FILTERS, ...f }, now).map((t) => t.id);
  assert.deepEqual(ids({ person: "u1" }), ["a"]);
  assert.deepEqual(ids({ project: "emet" }), ["a", "c"]);
  assert.deepEqual(ids({ project: "p1" }), ["b"]);
  assert.deepEqual(ids({ status: "open" }), ["a", "c"]);
  assert.deepEqual(ids({ priority: "high" }), ["a"]);
  assert.deepEqual(ids({ due: "overdue" }), ["a"]);
  assert.deepEqual(ids({ due: "week" }), ["a", "c"]);
  assert.deepEqual(ids({ due: "none" }), ["b"]);
  assert.deepEqual(sortTasks([b, c, a], st).map((t) => t.id), ["a", "c", "b"]);
});

test("you only see tasks given to you or that you created", () => {
  const p = (user_id: string) => ({ user_id, done_at: null, file_path: null, file_name: null });
  assert.equal(isMineToSee(task({ people: [p("u1")] }), "u1"), true);
  assert.equal(isMineToSee(task({ created_by: "u1", people: [p("u2")] }), "u1"), true);
  assert.equal(isMineToSee(task({ people: [p("u2")] }), "u1"), false);
  assert.equal(isMineToSee(task({ people: [] }), "u1"), false);
});

test("permissions match the database rules", () => {
  const proj = board({ id: "b2", project_id: "p1" });
  const p = { id: "p1", name: "P", memberIds: ["u1", "u2"] };
  const people = [{ id: "u1", group_id: "g1" }, { id: "u2", group_id: "g2" }, { id: "u3", group_id: "g1" }, { id: "u4", group_id: "g3" }];
  // Members add to their projects and to EMET; not to someone else's project; guests never
  assert.equal(canAdd(member, proj, p), true);
  assert.equal(canAdd(member, proj, { ...p, memberIds: ["u2"] }), false);
  assert.equal(canAdd(member, board()), true);
  assert.equal(canAdd({ ...member, isGuest: true }, board()), false);
  // Assign: project → its members; EMET → me + my group; leaders anyone (but project tasks stay in the project)
  assert.deepEqual(assignable(member, proj, people, p).map((x) => x.id), ["u1", "u2"]);
  assert.deepEqual(assignable(member, board(), people).map((x) => x.id), ["u1", "u3"]);
  assert.deepEqual(assignable(leader, board(), people).map((x) => x.id), ["u1", "u2", "u3", "u4"]);
  assert.deepEqual(assignable(leader, proj, people, p).map((x) => x.id), ["u1", "u2"]);
  // Edit: assignees and creators on EMET; delete project tasks: admins only
  const t = task();
  assert.equal(canEdit(member, board(), t), false);
  assert.equal(canEdit(member, board(), task({ people: [{ user_id: "u1", done_at: null, file_path: null, file_name: null }] })), true);
  assert.equal(canEdit(member, board(), task({ created_by: "u1" })), true);
  assert.equal(canDelete(member, proj, t, p), false);
  assert.equal(canDelete({ ...member, isAdmin: true }, proj, t, p), true);
});
