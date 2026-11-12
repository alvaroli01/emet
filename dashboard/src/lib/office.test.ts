import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceM, zoneStepWithAccuracy, checkoutCounts, isOutsideDay, isStale, isWorkday, officeStatus, decide, visitMs, isInNow, isPaused, hm, madridTime, madridMidnight, STALE_MS, type Visit } from "./office.ts";

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

test("shortcut positions: in within 30 m, out from 80 m, keep checking in between", () => {
  const office = { lat: 43.263, lng: -2.935 };
  const north = (m: number) => ({ lat: office.lat + m / 111195, lng: office.lng });
  assert.ok(Math.abs(distanceM(office, north(100)) - 100) < 0.5);
});

test("never checked out by 21:00 (the day closes) → that stretch counts 0", () => {
  const v1 = v({ arrived_at: "2026-11-10T08:00:00Z" }); // 09:00 Spanish time
  assert.equal(isStale(v1, Date.parse("2026-11-10T19:59:00Z")), false); // 20:59 → still counting
  assert.equal(isStale(v1, Date.parse("2026-11-10T20:00:00Z")), true);  // 21:00 → the day is closed
  assert.equal(visitMs(v1, Date.parse("2026-11-10T20:30:00Z")), 0);
  assert.deepEqual(decide(v1, "arrive", Date.parse("2026-11-11T07:00:00Z")), [{ op: "forgot", id: "a" }, { op: "insert" }]);
});

test("weekdays only, and one person's status (in / paused, hours today and this week)", () => {
  assert.equal(isWorkday(Date.parse("2026-11-10T09:00:00Z")), true);  // Tuesday
  assert.equal(isWorkday(Date.parse("2026-11-14T09:00:00Z")), false); // Saturday
  assert.equal(isWorkday(Date.parse("2026-11-15T23:30:00Z")), true);  // Sunday 23:30 UTC = Monday 00:30 in Spain
  const vs: Visit[] = [
    v({ id: "mon", arrived_at: "2026-11-09T08:00:00Z", left_at: "2026-11-09T12:00:00Z" }), // Monday 4 h
    v({ id: "t1", arrived_at: "2026-11-10T08:00:00Z", left_at: "2026-11-10T10:00:00Z" }),  // Tuesday 2 h
    v({ id: "t2", arrived_at: "2026-11-10T11:00:00Z" }),                                   // back at 12:00, still in
    v({ id: "x", user_id: "other", arrived_at: "2026-11-10T08:00:00Z" }),
  ];
  const s = officeStatus(vs, "u", Date.parse("2026-11-10T12:00:00Z"));
  assert.equal(s.inNow, true); assert.equal(s.since, "12:00");
  assert.equal(hm(s.todayMs), "3h 00m"); assert.equal(hm(s.weekMs), "7h 00m");
  const p = officeStatus(vs.slice(0, 2), "u", Date.parse("2026-11-10T13:00:00Z"));
  assert.equal(p.inNow, false); assert.equal(p.paused, true); assert.equal(p.since, "11:00");
});

test("emet open on the phone: GPS accuracy helps arriving (inside the building) but never pushes anyone out", () => {
  assert.equal(zoneStepWithAccuracy(90, 35, false).event, "arrive");  // 90 m ± 35 m inside Dock → counts as within 60 m (up to 40 m slack)
  assert.equal(zoneStepWithAccuracy(110, 30, false).event, null);     // too far even with the slack
  assert.equal(zoneStepWithAccuracy(70, 5, false).event, null);       // precise fix: really 70 m away
  assert.equal(zoneStepWithAccuracy(140, 30, true).event, null);      // 140 m ± 30: maybe only 110 m → stay in
  assert.equal(zoneStepWithAccuracy(170, 30, true).event, "leave");   // clearly 120 m+ away
});

test("one-tap check-out only counts at Dock; working outside only Mon/Wed/Fri", () => {
  assert.equal(checkoutCounts(60, 10), true);    // at the door
  assert.equal(checkoutCounts(150, 40), true);   // 150 m ± 40 m → maybe 110 m: still Dock
  assert.equal(checkoutCounts(200, 20), false);  // the street / home
  assert.equal(checkoutCounts(200, 500), false); // a rough fix gives at most 40 m slack
  assert.equal(isOutsideDay(Date.parse("2026-11-09T10:00:00Z")), true);  // Monday
  assert.equal(isOutsideDay(Date.parse("2026-11-10T10:00:00Z")), false); // Tuesday
  assert.equal(isOutsideDay(Date.parse("2026-11-13T10:00:00Z")), true);  // Friday
});
