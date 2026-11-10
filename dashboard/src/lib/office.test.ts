import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, visitMs, isInNow, hm, madridTime, madridMidnight, STALE_MS, type Visit } from "./office.ts";

const T = Date.parse("2026-11-10T09:00:00Z");
const v = (p: Partial<Visit>): Visit => ({ id: "a", user_id: "u", arrived_at: new Date(T).toISOString(), left_at: null, forgot: false, ...p });
const at = (min: number) => new Date(T + min * 60e3).toISOString();

test("arrive starts a visit; a second arrive while in does nothing", () => {
  assert.deepEqual(decide(null, null, "arrive", T), [{ op: "insert" }]);
  assert.deepEqual(decide(v({}), null, "arrive", T + 60e3), []);
});

test("leave closes the open visit; leave when not in does nothing", () => {
  assert.deepEqual(decide(v({}), null, "leave", T + 3600e3), [{ op: "close", id: "a" }]);
  assert.deepEqual(decide(null, v({ left_at: at(10) }), "leave", T), []);
});

test("back within 15 min continues the same visit, later starts a new one", () => {
  const closed = v({ left_at: at(60) });
  assert.deepEqual(decide(null, closed, "arrive", T + 70 * 60e3), [{ op: "reopen", id: "a" }]);
  assert.deepEqual(decide(null, closed, "arrive", T + 80 * 60e3), [{ op: "insert" }]);
});

test("a visit never checked out (16 h+) is marked forgotten and counts 0", () => {
  const late = T + STALE_MS + 1;
  assert.deepEqual(decide(v({}), null, "arrive", late), [{ op: "forgot", id: "a" }, { op: "insert" }]);
  assert.deepEqual(decide(v({}), null, "leave", late), [{ op: "forgot", id: "a" }]);
  assert.equal(visitMs(v({}), late), 0);
  assert.equal(isInNow(v({}), late), false);
  assert.equal(visitMs(v({ left_at: at(0), forgot: true }), late), 0);
});

test("hours: closed and open visits; formatting in Spanish time", () => {
  assert.equal(visitMs(v({ left_at: at(425) }), T), 425 * 60e3);
  assert.equal(visitMs(v({}), T + 90 * 60e3), 90 * 60e3);
  assert.equal(hm(425 * 60e3), "7h 05m");
  assert.equal(madridTime("2026-11-10T09:00:00Z"), "10:00"); // CET = UTC+1 in November
  assert.equal(madridTime("2026-07-10T09:00:00Z"), "11:00"); // CEST = UTC+2 in summer
  assert.equal(madridMidnight("2026-11-10"), "2026-11-09T23:00:00.000Z");
  assert.equal(madridMidnight("2026-07-10"), "2026-07-09T22:00:00.000Z");
});
