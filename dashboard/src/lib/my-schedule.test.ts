import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleRange, buildMySchedule, scheduleLines } from "./my-schedule.ts";

test("range covers the last 14 days to the next 60", () => {
  assert.deepEqual(scheduleRange("2026-10-21"), { from: "2026-10-07", to: "2026-12-20" });
});

const base = { today: "2026-10-21", from: "2026-10-07", to: "2026-12-20", google: { status: "connected" as const, events: [] } };

test("merges tasks, leader tasks, plans and Google events, sorted by day and time", () => {
  const s = buildMySchedule({
    ...base,
    cards: [{ title: "Instagram post", board: "marketing", due_at: "2026-10-22T10:00:00Z", completed_at: null }],
    subtasks: [{ text: "Price list", card: "Stall", due_on: "2026-10-20" }],
    teamTasks: [{ title: "Weekly report", due_on: "2026-10-23", done_at: "2026-10-21T08:00:00Z" }],
    plans: [{ title: "Supplier call", day: "2026-10-22", start_time: "16:00:00", end_time: "16:30:00", done: false }],
    google: { status: "connected", events: [{ id: "a", title: "Marketing class", day: "2026-10-22", start: "10:00", end: "11:30", allDay: false }] },
  });
  assert.equal(s.google_calendar, "connected");
  assert.deepEqual(s.items.map((i) => [i.day, i.type, i.title]), [
    ["2026-10-20", "task", "Price list"],
    ["2026-10-22", "task", "Instagram post"],
    ["2026-10-22", "google", "Marketing class"],
    ["2026-10-22", "plan", "Supplier call"],
    ["2026-10-23", "leader_task", "Weekly report"],
  ]);
  assert.equal(s.items[0].late, true);
  assert.equal(s.items[4].done, true);
  assert.equal(s.items[3].start, "16:00");
});

test("leader tasks outside the range or without a date are left out", () => {
  const s = buildMySchedule({ ...base, cards: [], subtasks: [], plans: [],
    teamTasks: [{ title: "Old", due_on: "2026-01-01", done_at: null }, { title: "No date", due_on: null, done_at: null }] });
  assert.deepEqual(s.items, []);
});

test("keeps at most 120 entries, the ones nearest today", () => {
  const plans = Array.from({ length: 300 }, (_, i) => ({ title: `p${i}`, day: i < 150 ? "2026-10-21" : "2026-12-19", start_time: null, end_time: null, done: false }));
  const s = buildMySchedule({ ...base, cards: [], subtasks: [], teamTasks: [], plans });
  assert.equal(s.items.length, 120);
  assert.ok(s.items.every((i) => i.day === "2026-10-21"));
});

test("says when Google isn't connected or couldn't be loaded", () => {
  const none = { cards: [], subtasks: [], teamTasks: [], plans: [] };
  assert.equal(buildMySchedule({ ...base, ...none, google: { status: "not_connected", events: [] } }).google_calendar, "not connected");
  assert.equal(buildMySchedule({ ...base, ...none, google: { status: "unreachable", events: [] } }).google_calendar, "couldn't be loaded");
});

test("compact one-line entries for the AI", () => {
  const lines = scheduleLines([
    { type: "google", title: "Marketing class", day: "2026-10-22", start: "10:00", end: "11:30", all_day: false },
    { type: "google", title: "Exam week", day: "2026-10-23", all_day: true },
    { type: "task", title: "Instagram post", board: "marketing", day: "2026-10-20", done: false, late: true },
    { type: "leader_task", title: "Weekly report", day: "2026-10-23", done: true, late: false },
  ]);
  assert.deepEqual(lines, [
    "Thu 2026-10-22 10:00-11:30 Google: Marketing class",
    "Fri 2026-10-23 all day Google: Exam week",
    "Tue 2026-10-20 due task (marketing): Instagram post [LATE]",
    "Fri 2026-10-23 due team-leader task: Weekly report [done]",
  ]);
});
