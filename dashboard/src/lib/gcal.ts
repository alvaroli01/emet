import ICAL from "ical.js";

/** Google Calendar's own iCal links only (secret "private-…" or public). Anything else is refused, so the server never fetches other hosts. */
export function normalizeGoogleIcalUrl(raw: string): string | null {
  const s = raw.trim().replace(/^webcal:\/\//i, "https://");
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:" || u.hostname !== "calendar.google.com" || u.port || u.username || u.password) return null;
  if (!/^\/calendar\/ical\/[^/]+\/(private-[A-Za-z0-9]+|public)\/basic\.ics$/.test(u.pathname)) return null;
  return `https://calendar.google.com${u.pathname}`;
}

export type GEvent = { id: string; title: string; day: string; start: string | null; end: string | null; allDay: boolean };

const DAY = 864e5;
const addDay = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);

/** Every event (repeats expanded) that touches fromDay..toDay, in the viewer's time zone. Throws if it isn't a calendar. */
export function parseEvents(ics: string, fromDay: string, toDay: string, timeZone = "Europe/Madrid"): GEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics));
  if (root.name !== "vcalendar") throw new Error("not a calendar");
  for (const tz of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);

  const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const local = (ms: number) => { const [d, t] = fmt.format(ms).split(" "); return { day: d, time: t }; };
  // Generous window in UTC so time-zone edges are kept, then filtered by local day
  const lo = Date.parse(fromDay + "T00:00:00Z") - DAY, hi = Date.parse(addDay(toDay, 1) + "T00:00:00Z") + DAY;

  const vevents = root.getAllSubcomponents("vevent");
  const exceptions = vevents.filter((v) => v.hasProperty("recurrence-id"));
  const out: GEvent[] = [];

  const emit = (uid: string, title: string, start: ICAL.Time, end: ICAL.Time) => {
    if (start.isDate) {                          // all-day: [start, end) in calendar days
      const last = end ? addDay(end.toString().slice(0, 10), -1) : start.toString().slice(0, 10);
      for (let d = start.toString().slice(0, 10); d <= last; d = addDay(d, 1))
        if (d >= fromDay && d <= toDay) out.push({ id: `${uid}@${d}`, title, day: d, start: null, end: null, allDay: true });
      return;
    }
    const s = start.toJSDate().getTime(), e = end ? end.toJSDate().getTime() : s + 30 * 60e3;
    const a = local(s), b = local(Math.max(s, e - 1));
    for (let d = a.day; d <= b.day; d = addDay(d, 1)) {
      if (d < fromDay || d > toDay) continue;
      out.push({ id: `${uid}@${new Date(s).toISOString()}${d === a.day ? "" : `#${d}`}`, title, day: d,
        start: d === a.day ? a.time : "00:00", end: d === b.day ? local(e).time : "23:59", allDay: false });
    }
  };

  for (const v of vevents) {
    if (v.hasProperty("recurrence-id")) continue;                       // handled via its master
    const event = new ICAL.Event(v, { strictExceptions: true, exceptions: exceptions.filter((x) => x.getFirstPropertyValue("uid") === v.getFirstPropertyValue("uid")) });
    if (v.getFirstPropertyValue("status") === "CANCELLED") continue;
    if (!event.isRecurring()) {
      if (event.startDate.toJSDate().getTime() < hi && (event.endDate ?? event.startDate).toJSDate().getTime() >= lo)
        emit(event.uid, event.summary ?? "", event.startDate, event.endDate);
      continue;
    }
    const it = event.iterator();
    for (let next = it.next(), n = 0; next && n < 5000; next = it.next(), n++) {
      const t = next.toJSDate().getTime();
      if (t >= hi) break;
      const occ = event.getOccurrenceDetails(next);
      if (occ.item.component.getFirstPropertyValue("status") === "CANCELLED") continue;
      if (occ.endDate.toJSDate().getTime() < lo) continue;
      emit(event.uid, occ.item.summary ?? "", occ.startDate, occ.endDate);
    }
  }
  return out.sort((x, y) => x.day.localeCompare(y.day) || (x.start ?? "").localeCompare(y.start ?? ""));
}
