import { test } from "node:test";
import assert from "node:assert/strict";
import { memberTaskLists } from "./member-tasks.ts";

const now = Date.parse("2026-10-27T12:00:00Z");
const items = [
  { id: "a", title: "Open, due later", due: "2026-11-05T21:59:00Z", done_at: null },
  { id: "b", title: "Open, overdue", due: "2026-10-20T21:59:00Z", done_at: null },
  { id: "c", title: "Open, no date", due: null, done_at: null },
  { id: "d", title: "Done on time", due: "2026-10-25T21:59:00Z", done_at: "2026-10-24T10:00:00Z" },
  { id: "e", title: "Done late", due: "2026-10-22T21:59:00Z", done_at: "2026-10-26T10:00:00Z" },
  { id: "f", title: "Team task done late (date only)", due: "2026-10-23", done_at: "2026-10-25T09:00:00Z" },
  { id: "g", title: "Team task done on its due day", due: "2026-10-23", done_at: "2026-10-23T20:00:00Z" },
];

test("to do: everything not finished, overdue first, then by due date, undated last", () => {
  assert.deepEqual(memberTaskLists(items, now).todo.map((x) => x.id), ["b", "a", "c"]);
});

test("not on time: finished after the due date, or still open past it", () => {
  const late = memberTaskLists(items, now).late;
  assert.deepEqual(late.map((x) => x.id), ["e", "f", "b"]);
  assert.deepEqual(late.map((x) => x.done), [true, true, false]);
  assert.equal(late.find((x) => x.id === "e")!.daysLate, 4);
  assert.equal(late.find((x) => x.id === "b")!.daysLate, 7);
});
