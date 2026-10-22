import { test } from "node:test";
import assert from "node:assert/strict";
import { isTaskPopup, dueLabel } from "./task-popup.ts";

test("only 'you got a task' notifications pop up", () => {
  assert.equal(isTaskPopup({ kind: "assigned" }), true);
  assert.equal(isTaskPopup({ kind: "team_task" }), true);
  assert.equal(isTaskPopup({ kind: "card_comment" }), false);
});

test("due dates read like a person would say them, in Madrid time", () => {
  assert.equal(dueLabel("2026-10-30", "en"), "Fri, Oct 30");
  assert.equal(dueLabel("2026-10-31T09:00:00+00:00", "en"), "Sat, Oct 31, 10:00");
  assert.equal(dueLabel("2026-10-30", "es"), "vie, 30 oct");
  assert.equal(dueLabel(undefined, "en"), null);
});
