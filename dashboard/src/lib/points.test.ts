import { test } from "node:test";
import assert from "node:assert/strict";
import { POINT_GOALS, POINTS_DEADLINE, pointTotals, perWeekNeeded } from "./points.ts";

test("goals: 20 community points, 50 customer visits, 40 learning points by 1 June 2027", () => {
  assert.deepEqual(POINT_GOALS, { community: 20, visit: 50, learning: 40 });
  assert.equal(POINTS_DEADLINE, "2027-06-01");
});

test("totals add up each kind", () => {
  assert.deepEqual(pointTotals([
    { kind: "community", amount: 2 }, { kind: "visit", amount: 1 }, { kind: "visit", amount: 1 }, { kind: "learning", amount: 3 },
  ]), { community: 2, visit: 2, learning: 3 });
  assert.deepEqual(pointTotals([]), { community: 0, visit: 0, learning: 0 });
});

test("what is needed each week to reach the goal in time", () => {
  // 1 Jun 2027 is 211 days (30.1 weeks) after 2 Nov 2026
  assert.equal(perWeekNeeded(0, 50, "2026-11-02"), 1.7);   // 50 / 30.1 = 1.66 → rounded up to 1 decimal
  assert.equal(perWeekNeeded(50, 50, "2026-11-02"), 0);    // done
  assert.equal(perWeekNeeded(10, 20, "2027-05-31"), 10);   // last week: everything left
  assert.equal(perWeekNeeded(10, 20, "2027-06-02"), null); // deadline passed
});
