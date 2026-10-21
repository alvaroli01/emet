import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutLanes } from "./calendar-layout.ts";

const ev = (id: string, start: string, end: string | null) => ({ id, start, end });

test("events that overlap sit side by side; others use the full width", () => {
  const got = layoutLanes([ev("a", "14:00", "15:00"), ev("b", "14:00", "15:00"), ev("c", "16:00", "17:00")]);
  assert.deepEqual(got.get("a"), { lane: 0, lanes: 2 });
  assert.deepEqual(got.get("b"), { lane: 1, lanes: 2 });
  assert.deepEqual(got.get("c"), { lane: 0, lanes: 1 });
});

test("a chain of overlaps shares the same number of lanes; free lanes are reused", () => {
  // a 9-11, b 10-12, c 11-13: a and c can share lane 0
  const got = layoutLanes([ev("a", "09:00", "11:00"), ev("b", "10:00", "12:00"), ev("c", "11:00", "13:00")]);
  assert.equal(got.get("a")!.lanes, 2);
  assert.equal(got.get("b")!.lane, 1);
  assert.equal(got.get("c")!.lane, 0);
});

test("touching events (one ends when the next starts) do not overlap; no end = 30 minutes", () => {
  const got = layoutLanes([ev("a", "14:00", "14:30"), ev("b", "14:30", null), ev("c", "14:45", "15:00")]);
  assert.deepEqual(got.get("a"), { lane: 0, lanes: 1 });
  assert.equal(got.get("b")!.lanes, 2);
  assert.equal(got.get("c")!.lanes, 2);
});
