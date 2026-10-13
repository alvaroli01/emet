// Run: npm test   (uses Node's built-in test runner, no extra packages)
import { test } from "node:test";
import assert from "node:assert/strict";
import { totals, pace, onTimeRate, weekly, weekStart, groupHealth } from "./metrics.ts";

const NOW = Date.parse("2026-11-04T12:00:00Z"); // a Wednesday, ~3 weeks after start

test("weekStart returns the Monday", () => {
  assert.equal(weekStart("2026-10-13"), "2026-10-12"); // Tuesday → Monday
  assert.equal(weekStart("2026-10-18"), "2026-10-12"); // Sunday → previous Monday
  assert.equal(weekStart("2026-10-19"), "2026-10-19");
});

test("totals: profit = revenue − cost of goods − expenses", () => {
  const t = totals([{ date: "2026-10-14", amount: "120.00", cost: "50" }, { date: "2026-10-20", amount: 80, cost: 30 }],
                   [{ date: "2026-10-15", amount: 20 }]);
  assert.equal(t.revenue, 200);
  assert.equal(t.profit, 100);
  assert.equal(t.margin, 0.5);
  assert.equal(totals([], []).margin, null);
});

test("pace counts down to 30 June 2027", () => {
  const p = pace(0, 0, Date.parse("2027-06-30T12:00:00Z"));
  assert.equal(p.daysLeft, 1);
  const q = pace(3000, 1500, NOW);
  assert.ok(q.revenuePerWeekNeeded > 0 && q.revenuePerWeekSoFar > 0);
  assert.equal(pace(40000, 20000, NOW).revenuePerWeekNeeded, 0); // goal already beaten
});

test("on-time rate", () => {
  const r = onTimeRate([
    { board_id: "a", due_at: "2026-10-20T00:00:00Z", completed_at: "2026-10-19T00:00:00Z" }, // on time
    { board_id: "a", due_at: "2026-10-20T00:00:00Z", completed_at: "2026-10-22T00:00:00Z" }, // late
    { board_id: "a", due_at: "2026-10-25T00:00:00Z", completed_at: null },                   // overdue, open
    { board_id: "a", due_at: "2026-12-01T00:00:00Z", completed_at: null },                   // not due yet → ignored
    { board_id: "a", due_at: null, completed_at: null },                                     // no due date → ignored
  ], NOW);
  assert.equal(r.onTime, 1);
  assert.equal(r.late, 2);
  assert.equal(r.overdueOpen, 1);
  assert.equal(r.rate, 1 / 3);
  assert.equal(onTimeRate([], NOW).rate, null);
});

test("weekly series fills empty weeks and keeps cumulative from the start", () => {
  const w = weekly([{ date: "2026-10-14", amount: 100, cost: 40 }, { date: "2026-11-03", amount: 50, cost: 0 }],
                   [{ date: "2026-10-28", amount: 10 }], "all", NOW);
  assert.deepEqual(w.map((p) => p.week), ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]);
  assert.deepEqual(w.map((p) => p.revenue), [100, 0, 0, 50]);
  assert.deepEqual(w.map((p) => p.profit), [60, 0, -10, 50]);
  assert.equal(w.at(-1)!.cumRevenue, 150);
  assert.equal(w.at(-1)!.cumProfit, 100);
  const last2 = weekly([{ date: "2026-10-14", amount: 100, cost: 40 }], [], 2, NOW);
  assert.equal(last2.length, 2);
  assert.equal(last2.at(-1)!.cumRevenue, 100); // still counts the earlier week
});

test("group health colours", () => {
  assert.equal(groupHealth(0, 0, null), "good");
  assert.equal(groupHealth(0, 0, 0.9), "good");
  assert.equal(groupHealth(1, 0, null), "warning");
  assert.equal(groupHealth(0, 0, 0.8), "warning");
  assert.equal(groupHealth(3, 0, null), "critical");
  assert.equal(groupHealth(0, 0, 0.5), "critical");
});
