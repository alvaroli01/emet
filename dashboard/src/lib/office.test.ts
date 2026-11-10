import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceM, zoneStep, isStale, decide, visitMs, isInNow, isPaused, hm, madridTime, madridMidnight, STALE_MS, type Visit } from "./office.ts";

const T = Date.parse("2026-11-10T09:00:00Z");
const v = (p: Partial<Visit>): Visit => ({ id: "a", user_id: "u", arrived_at: new Date(T).toISOString(), left_at: null, forgot: false, ...p });
const at = (min: number) => new Date(T + min * 60e3).toISOString();

test("arrive starts a visit; a second arrive while in does nothing", () => {
  assert.deepEqual(decide(null, "arrive", T), [{ op: "insert" }]);
  assert.deepEqual(decide(v({}), "arrive", T + 60e3), []);
});

test("leave closes the open visit; leave when not in does nothing", () => {
  assert.deepEqual(decide(v({}), "leave", T + 3600e3), [{ op: "close", id: "a" }]);
  assert.deepEqual(decide(null, "leave", T), []);
});

test("leaving pauses the day until 21:00; coming back resumes it and the time away doesn't count", () => {
  // In 10:00–13:00, out for lunch, back 14:00–15:30 (Spanish time = UTC+1) → 4h 30m, not 5h 30m
  const morning = v({ arrived_at: "2026-11-10T09:00:00Z", left_at: "2026-11-10T12:00:00Z" });
  assert.equal(isPaused(morning, Date.parse("2026-11-10T12:30:00Z")), true);               // 13:30 → paused
  assert.deepEqual(decide(null, "arrive", Date.parse("2026-11-10T13:00:00Z")), [{ op: "insert" }]); // back → resumes (new stretch)
  const afternoon = v({ id: "b", arrived_at: "2026-11-10T13:00:00Z", left_at: "2026-11-10T14:30:00Z" });
  assert.equal(hm(visitMs(morning, 0) + visitMs(afternoon, 0)), "4h 30m");
  assert.equal(isPaused(afternoon, Date.parse("2026-11-10T19:59:00Z")), true);   // 20:59 → still paused
  assert.equal(isPaused(afternoon, Date.parse("2026-11-10T20:00:00Z")), false);  // 21:00 → day over, hours stay where they stopped
  assert.equal(isPaused(afternoon, Date.parse("2026-11-11T08:00:00Z")), false);  // next day
  assert.equal(isPaused(v({}), T), false);                                       // still inside
});

test("a visit never checked out (16 h+) is marked forgotten and counts 0", () => {
  const late = T + STALE_MS + 1;
  assert.deepEqual(decide(v({}), "arrive", late), [{ op: "forgot", id: "a" }, { op: "insert" }]);
  assert.deepEqual(decide(v({}), "leave", late), [{ op: "forgot", id: "a" }]);
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

test("shortcut positions: in within 30 m, out from 150 m, keep checking in between", () => {
  const office = { lat: 43.263, lng: -2.935 };
  const north = (m: number) => ({ lat: office.lat + m / 111195, lng: office.lng });
  assert.ok(Math.abs(distanceM(office, north(100)) - 100) < 0.5);
  assert.deepEqual(zoneStep(distanceM(office, north(100)), false), { event: null, reply: "wait" });   // woke up at Apple's 100 m zone
  assert.deepEqual(zoneStep(distanceM(office, north(31)), false), { event: null, reply: "wait" });
  assert.deepEqual(zoneStep(distanceM(office, north(29)), false), { event: "arrive", reply: "done" });
  assert.deepEqual(zoneStep(10, true), { event: null, reply: "done" });     // already in
  assert.deepEqual(zoneStep(120, true), { event: null, reply: "wait" });    // walking away, not yet 150 m
  assert.deepEqual(zoneStep(150, true), { event: "leave", reply: "done" });
  assert.deepEqual(zoneStep(400, false), { event: null, reply: "done" });   // already out
});

test("never checked out by midnight (phone off, Leave deleted) → that stretch counts 0", () => {
  const v1 = v({ arrived_at: "2026-11-10T08:00:00Z" }); // 09:00 Spanish time
  assert.equal(isStale(v1, Date.parse("2026-11-10T22:59:00Z")), false); // 23:59 → still counting
  assert.equal(isStale(v1, Date.parse("2026-11-10T23:00:00Z")), true);  // 00:00 → never checked out
  assert.equal(visitMs(v1, Date.parse("2026-11-10T23:30:00Z")), 0);
  assert.deepEqual(decide(v1, "arrive", Date.parse("2026-11-11T07:00:00Z")), [{ op: "forgot", id: "a" }, { op: "insert" }]);
});
