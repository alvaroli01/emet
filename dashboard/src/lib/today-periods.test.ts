import { test } from "node:test";
import assert from "node:assert/strict";
import { period, cardSeries } from "./today-periods.ts";

const TODAY = "2026-10-22"; // a Thursday

test("this week, last week and next week (Monday first)", () => {
  const w = period("week", 0, TODAY);
  assert.deepEqual([w.from, w.to, w.buckets.length, w.prevFrom, w.prevTo, w.future], ["2026-10-19", "2026-10-25", 7, "2026-10-12", "2026-10-18", false]);
  assert.deepEqual([period("week", -1, TODAY).from, period("week", 1, TODAY).from, period("week", 1, TODAY).future], ["2026-10-12", "2026-10-26", true]);
});

test("a month is cut into its weeks", () => {
  const m = period("month", 0, TODAY);
  assert.deepEqual([m.from, m.to, m.prevFrom, m.prevTo], ["2026-10-01", "2026-10-31", "2026-09-01", "2026-09-30"]);
  assert.deepEqual(m.buckets.map((b) => [b.start, b.end]), [
    ["2026-10-01", "2026-10-04"], ["2026-10-05", "2026-10-11"], ["2026-10-12", "2026-10-18"], ["2026-10-19", "2026-10-25"], ["2026-10-26", "2026-10-31"]]);
  assert.equal(period("month", 1, TODAY).from, "2026-11-01");
  assert.equal(period("month", -10, TODAY).from, "2025-12-01");
});

test("sales, money and tasks per bucket", () => {
  const p = period("week", 0, TODAY);
  const s = cardSeries(p, TODAY, {
    sales: [{ date: "2026-10-19", amount: 20, channel: "stall" }, { date: "2026-10-21", amount: 30, channel: "online" }, { date: "2026-10-21", amount: 5, channel: "other" }, { date: "2026-10-12", amount: 99, channel: "stall" }],
    done: ["2026-10-19T10:00:00Z", "2026-10-21T10:00:00Z", "2026-10-13T10:00:00Z"],
    due: [],
  });
  assert.deepEqual(s.money, [20, 0, 35, 0, 0, 0, 0]);
  assert.equal(s.moneyTotal, 55);
  assert.equal(s.salesCount, 3);
  assert.deepEqual(s.channels.stall, [1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(s.tasks.this, [1, 1, 2, 2, 2, 2, 2]); // running total
  assert.deepEqual(s.tasks.prev, [0, 1, 1, 1, 1, 1, 1]); // last week: one done on Tuesday
  assert.equal(s.tasks.done, 2);
  assert.equal(s.tasks.mode, "done");
});

test("a future period shows tasks due, not tasks done", () => {
  const p = period("week", 1, TODAY);
  const s = cardSeries(p, TODAY, { sales: [], done: [], due: ["2026-10-27T09:00:00Z", "2026-10-27T12:00:00Z", "2026-10-30T09:00:00Z"] });
  assert.equal(s.tasks.mode, "due");
  assert.deepEqual(s.tasks.this, [0, 2, 0, 0, 1, 0, 0]);
  assert.equal(s.tasks.done, 3);
});
