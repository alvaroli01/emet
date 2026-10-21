import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeGoogleIcalUrl, parseEvents } from "./gcal.ts";

const ID = "abc123%40group.calendar.google.com";
const good = `https://calendar.google.com/calendar/ical/${ID}/private-0123456789abcdef0123456789abcdef/basic.ics`;

test("accepts Google secret and public iCal links, cleaned", () => {
  assert.equal(normalizeGoogleIcalUrl(`  ${good}\n`), good);
  assert.equal(normalizeGoogleIcalUrl(good.replace("https://", "webcal://")), good);
  const pub = `https://calendar.google.com/calendar/ical/${ID}/public/basic.ics`;
  assert.equal(normalizeGoogleIcalUrl(pub), pub);
});

test("rejects anything else", () => {
  for (const bad of [
    good.replace("https://", "http://"),
    good.replace("calendar.google.com", "calendar.google.com.evil.io"),
    good.replace("calendar.google.com", "evil.io"),
    `https://calendar.google.com/calendar/embed?src=${ID}`,
    "https://user@calendar.google.com/calendar/ical/x/private-1/basic.ics",
    "https://calendar.google.com:8443/calendar/ical/x/private-1/basic.ics",
    "", "not a url",
  ]) assert.equal(normalizeGoogleIcalUrl(bad), null, bad);
});

const cal = (events: string, tz = "") => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Google Inc//Google Calendar 70.9054//EN\r\n${tz}${events}END:VCALENDAR\r\n`;
const MADRID_TZ = "BEGIN:VTIMEZONE\r\nTZID:Europe/Madrid\r\nBEGIN:DAYLIGHT\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nTZNAME:CEST\r\nDTSTART:19700329T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nEND:DAYLIGHT\r\nBEGIN:STANDARD\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nTZNAME:CET\r\nDTSTART:19701025T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n";
const ev = (lines: string) => `BEGIN:VEVENT\r\n${lines}\r\nEND:VEVENT\r\n`;

test("timed event in UTC is shown in Madrid time", () => {
  const ics = cal(ev("UID:a\r\nSUMMARY:Marketing class\r\nDTSTART:20261021T080000Z\r\nDTEND:20261021T093000Z"));
  assert.deepEqual(parseEvents(ics, "2026-10-19", "2026-10-25"),
    [{ id: "a@2026-10-21T08:00:00.000Z", title: "Marketing class", day: "2026-10-21", start: "10:00", end: "11:30", allDay: false }]);
});

test("event with a TZID keeps its local time", () => {
  const ics = cal(ev("UID:b\r\nSUMMARY:Call\r\nDTSTART;TZID=Europe/Madrid:20261022T150000\r\nDTEND;TZID=Europe/Madrid:20261022T153000"), MADRID_TZ);
  const [e] = parseEvents(ics, "2026-10-19", "2026-10-25");
  assert.equal(e.start, "15:00"); assert.equal(e.end, "15:30"); assert.equal(e.day, "2026-10-22");
});

test("all-day and multi-day all-day events", () => {
  const ics = cal(ev("UID:c\r\nSUMMARY:Exam week\r\nDTSTART;VALUE=DATE:20261022\r\nDTEND;VALUE=DATE:20261024"));
  const got = parseEvents(ics, "2026-10-19", "2026-10-25");
  assert.deepEqual(got.map((e) => [e.day, e.allDay, e.start]), [["2026-10-22", true, null], ["2026-10-23", true, null]]);
});

test("timed event crossing midnight shows on both days", () => {
  const ics = cal(ev("UID:d\r\nSUMMARY:Night shift\r\nDTSTART:20261021T210000Z\r\nDTEND:20261022T020000Z"));
  const got = parseEvents(ics, "2026-10-19", "2026-10-25");
  assert.deepEqual(got.map((e) => [e.day, e.start, e.end]), [["2026-10-21", "23:00", "23:59"], ["2026-10-22", "00:00", "04:00"]]);
});

test("weekly repeat with one cancelled and one moved occurrence", () => {
  const ics = cal(
    ev("UID:w\r\nSUMMARY:Spanish\r\nDTSTART:20261005T090000Z\r\nDTEND:20261005T100000Z\r\nRRULE:FREQ=WEEKLY\r\nEXDATE:20261012T090000Z") +
    ev("UID:w\r\nRECURRENCE-ID:20261019T090000Z\r\nSUMMARY:Spanish (moved)\r\nDTSTART:20261020T140000Z\r\nDTEND:20261020T150000Z"),
  );
  const got = parseEvents(ics, "2026-10-05", "2026-10-25");
  assert.deepEqual(got.map((e) => [e.day, e.title, e.start]), [
    ["2026-10-05", "Spanish", "11:00"],
    ["2026-10-20", "Spanish (moved)", "16:00"],
  ]);
});

test("endless repeats stop at the range end", () => {
  const ics = cal(ev("UID:x\r\nSUMMARY:Daily\r\nDTSTART:20200101T090000Z\r\nDTEND:20200101T093000Z\r\nRRULE:FREQ=DAILY"));
  const t0 = Date.now();
  assert.equal(parseEvents(ics, "2026-10-19", "2026-10-25").length, 7);
  assert.ok(Date.now() - t0 < 2000);
});

test("cancelled events are skipped; non-calendars throw", () => {
  const ics = cal(ev("UID:y\r\nSUMMARY:Gone\r\nSTATUS:CANCELLED\r\nDTSTART:20261021T080000Z\r\nDTEND:20261021T090000Z"));
  assert.deepEqual(parseEvents(ics, "2026-10-19", "2026-10-25"), []);
  assert.throws(() => parseEvents("<html>nope</html>", "2026-10-19", "2026-10-25"));
});
