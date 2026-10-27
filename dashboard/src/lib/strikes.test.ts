import { test } from "node:test";
import assert from "node:assert/strict";
import { STRIKE_KINDS, weightOf, fineOf, quarterOf, strikeSummary } from "./strikes.ts";

test("normal strikes count 1, big ones 3; arriving late also costs €3", () => {
  assert.deepEqual(STRIKE_KINDS, ["late_tasks", "sleeping", "phone", "late_arrival", "missed_validation", "missed_customer_deadline"]);
  assert.equal(weightOf("sleeping"), 1);
  assert.equal(weightOf("missed_validation"), 3);
  assert.equal(fineOf("late_arrival"), 3);
  assert.equal(fineOf("phone"), 0);
});

test("every 3 months starts again (calendar quarters)", () => {
  assert.equal(quarterOf("2026-10-28"), "2026-10-01");
  assert.equal(quarterOf("2026-12-31"), "2026-10-01");
  assert.equal(quarterOf("2027-01-01"), "2027-01-01");
});

test("a person's quarter: total, how many to the next punishment, unpaid fines", () => {
  const s = strikeSummary([
    { kind: "sleeping", weight: 1, fine: 0, paid_at: null, happened_on: "2026-10-27" },
    { kind: "late_arrival", weight: 1, fine: 3, paid_at: null, happened_on: "2026-10-27" },
    { kind: "late_arrival", weight: 1, fine: 3, paid_at: "2026-10-28T10:00:00Z", happened_on: "2026-10-28" },
    { kind: "phone", weight: 1, fine: 0, paid_at: null, happened_on: "2026-09-10" }, // last quarter
  ], "2026-10-28");
  assert.equal(s.total, 3);
  assert.equal(s.toNext, 3);       // just reached 3 → 3 more to the next punishment
  assert.equal(s.unpaid, 3);       // one €3 not paid yet
  assert.equal(s.reset, "2027-01-01");
});
