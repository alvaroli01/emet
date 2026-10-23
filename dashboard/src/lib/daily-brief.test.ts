import { test } from "node:test";
import assert from "node:assert/strict";
import { mondayOf, trainingWeeks, briefTasks, shouldShowBrief, TRAINING_UNTIL } from "./daily-brief.ts";

test("a training week starts on Monday", () => {
  assert.equal(mondayOf("2026-10-23"), "2026-10-19"); // Friday
  assert.equal(mondayOf("2026-10-26"), "2026-10-26"); // Monday
  assert.equal(mondayOf("2026-11-01"), "2026-10-26"); // Sunday belongs to the week before
});

test("training weeks run from this week to the week of 19 December", () => {
  assert.equal(TRAINING_UNTIL, "2026-12-19");
  const w = trainingWeeks("2026-10-23");
  assert.equal(w[0], "2026-10-19");
  assert.equal(w[1], "2026-10-26");
  assert.equal(w.at(-1), "2026-12-14");
  assert.equal(w.length, 9);
  assert.deepEqual(trainingWeeks("2027-01-04"), []);
});

test("the pop-up shows late tasks and the next month, nothing further", () => {
  const items = [
    { id: "a", title: "Late", due: "2026-10-20" },
    { id: "b", title: "Today (timed)", due: "2026-10-23T15:00:00Z" },
    { id: "c", title: "In a month", due: "2026-11-22" },
    { id: "d", title: "Too far", due: "2026-11-24" },
    { id: "e", title: "No date", due: null },
    { id: "f", title: "Tomorrow", due: "2026-10-24" },
  ];
  const r = briefTasks(items, "2026-10-23");
  assert.deepEqual(r.late.map((x) => x.id), ["a"]);
  assert.deepEqual(r.upcoming.map((x) => x.id), ["b", "f", "c"]);
});

test("a timed due date counts in Madrid time", () => {
  // 23:30 UTC on the 23rd is already the 24th in Madrid (UTC+2 in October)
  const r = briefTasks([{ id: "x", title: "x", due: "2026-10-23T23:30:00Z" }], "2026-10-24");
  assert.deepEqual(r.upcoming.map((x) => x.id), ["x"]);
  assert.equal(r.late.length, 0);
});

test("the pop-up shows once a day", () => {
  assert.equal(shouldShowBrief(null, "2026-10-23"), true);
  assert.equal(shouldShowBrief("2026-10-22", "2026-10-23"), true);
  assert.equal(shouldShowBrief("2026-10-23", "2026-10-23"), false);
});
