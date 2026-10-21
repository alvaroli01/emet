# Google Calendar in emet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each member pastes their Google Calendar secret iCal link once; their Google events show in Today → Your week and Ask emet can answer any question about their schedule.

**Architecture:** The secret link is stored encrypted (AES-GCM, `AI_KEY_SECRET`, same helper as Groq keys) in an owner-only table. A server loader fetches + parses the iCal (via `ical.js`, repeats expanded, Madrid time) on demand: Today page render (plus a 5-minute client refresh) and each Ask emet question. Nothing is cached in the database.

**Tech Stack:** Next.js (App Router) + Supabase (RLS) + next-intl (7 languages) + `ical.js` 2.2.1 (MIT) + node:test.

**Spec:** `docs/superpowers/specs/2026-10-21-google-calendar-design.md`

## Global Constraints

- €0: free libraries and free tiers only (`ical.js` is MIT, no API keys).
- Read only: emet never writes to Google Calendar.
- Only the owner ever sees their Google link or events — not leaders, not admins (RLS owner-only, like `ai_keys`).
- Accepted links: `https://calendar.google.com/calendar/ical/<id>/private-<secret>/basic.ics` or `.../public/basic.ics`; nothing else is fetched.
- Fetch limits: 5-second timeout, 2 MB cap.
- Times shown in `Europe/Madrid` (same as `todayISO()` in `src/lib/format.ts`).
- Ask emet range: last 14 days → next 60 days, max 200 entries, nearest first; placed near the top of the snapshot.
- Every UI string in all 7 files in `dashboard/messages/` (en, es, de, fr, fi, pt-BR, ru).
- Repo rules (`emet/CLAUDE.md`): update `README.md` + a `CHANGELOG.md` line; show the full staged diff and wait for "push it" before any push.

## Review Focus

1. **Recurring event with a moved or cancelled single occurrence** (RECURRENCE-ID / EXDATE) — the moved one shows at its new time once, the cancelled one doesn't show. Test in Task 2.
2. **Event that crosses midnight or lasts several days** — shows on each day it covers; timed overnight events are clipped to 23:59 / start 00:00 per day. Test in Task 2.
3. **Pasting the link with spaces / a `webcal://` prefix / the public HTML "embed" link** — spaces trimmed and `webcal://` accepted as https; the embed link is rejected with the "not a secret link" message. Test in Task 2.
4. **Google slow or link revoked (404)** — Today still renders emet items quickly with the "couldn't be loaded" chip; Ask emet says the calendar couldn't be loaded. Test in Task 3.
5. **Huge calendar (years of weekly repeats)** — expansion stops at the range end; never loops past it. Test in Task 2.

---

## File map

- Create `dashboard/supabase/migrations/0025_google_calendar.sql` — owner-only table.
- Modify `dashboard/supabase/tests/permissions_test.sql` — owner-only checks.
- Create `dashboard/src/lib/gcal.ts` — pure: URL check + iCal parsing. Test: `dashboard/src/lib/gcal.test.ts`.
- Create `dashboard/src/lib/gcal-server.ts` — loads my link, fetches, parses. Test: `dashboard/src/lib/gcal-server.test.ts`.
- Create `dashboard/src/app/api/gcal/route.ts` — GET status / POST connect / DELETE disconnect.
- Create `dashboard/src/components/camp/google-calendar.tsx` — Base camp card. Modify `dashboard/src/components/camp/agenda.tsx` to show it under `<CalendarLink />`.
- Modify `dashboard/src/components/home/week-calendar.tsx`, `dashboard/src/components/home/home-dashboard.tsx`, `dashboard/src/app/(app)/today/page.tsx` — Google items, error chip, setup link, 5-minute refresh.
- Modify `dashboard/src/app/api/ask/route.ts` — `my_schedule`.
- Modify `dashboard/package.json` (`ical.js`, test script), 7 `messages/*.json`, `README.md`, `CHANGELOG.md`.

---

### Task 1: Owner-only table

**Files:**
- Create: `dashboard/supabase/migrations/0025_google_calendar.sql`
- Modify: `dashboard/supabase/tests/permissions_test.sql` (after the "Note-taker keys" block, ~line 263)

**Interfaces:**
- Produces: table `public.google_calendars(user_id uuid pk default my_profile_id(), url_iv text, url_data text, created_at, updated_at)`, RLS owner-only.

- [ ] **Step 1: Write the failing DB test** (append after line 263)

```sql
-- ── Google Calendar links: only the owner ──────────────────
select t.login(2);
select t.check('Member saves their own (encrypted) Google Calendar link', $$insert into google_calendars (url_iv, url_data) values ('iv', 'enc')$$, 'ok');
select t.login(3);
select t.assert('Other member cannot see someone else''s Google link', t.num('select count(*) from google_calendars') = 0);
select t.check('Other member cannot overwrite it', $$update google_calendars set url_data = 'x'$$, 'denied');
select t.check('Other member cannot delete it', $$delete from google_calendars$$, 'denied');
select t.login(1);
select t.assert('Admin cannot see members'' Google links', t.num('select count(*) from google_calendars') = 0);
```

Note: if `t.check(..., 'denied')` treats "0 rows affected" as denied (check how the `ai_keys` "cannot overwrite" line passes in `supabase/tests/supabase_mock.sql` / the `t.check` definition) keep as is; otherwise switch the update/delete lines to `t.assert` on a count read back as user 2.

- [ ] **Step 2: Run it, expect failure** — `cd dashboard && npm run test:db` → FAIL: relation "google_calendars" does not exist.

- [ ] **Step 3: Write the migration**

```sql
-- Google Calendar in emet: each member's own Google "Secret address in iCal format", encrypted by the server
-- (AES-256-GCM with AI_KEY_SECRET, like ai_keys). Only the owner can read or change it — admins included.
create table public.google_calendars (
  user_id    uuid primary key default public.my_profile_id() references public.profiles(id) on delete cascade,
  url_iv     text not null,
  url_data   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.google_calendars to authenticated;
alter table public.google_calendars enable row level security;
create policy google_calendars_own on public.google_calendars for all to authenticated
  using (user_id = (select public.my_profile_id())) with check (user_id = (select public.my_profile_id()));
```

- [ ] **Step 4: Run** `npm run test:db` → all PASS (the 5 new lines included).
- [ ] **Step 5: Commit** — `git add supabase/migrations/0025_google_calendar.sql supabase/tests/permissions_test.sql && git commit -m "Google Calendar: owner-only table for the secret link"`

---

### Task 2: Link check and iCal parsing (pure)

**Files:**
- Create: `dashboard/src/lib/gcal.ts`, `dashboard/src/lib/gcal.test.ts`
- Modify: `dashboard/package.json` (dependency; the `test` script already globs `src/lib/*.test.ts`)

**Interfaces:**
- Produces:
  - `normalizeGoogleIcalUrl(raw: string): string | null` — trimmed, `webcal://` → `https://`; returns the clean URL or `null` if not a Google secret/public iCal link.
  - `type GEvent = { id: string; title: string; day: string; start: string | null; end: string | null; allDay: boolean }` (`day` = `YYYY-MM-DD`, `start`/`end` = `HH:MM` Madrid, `null` for all-day)
  - `parseEvents(ics: string, fromDay: string, toDay: string, timeZone?: string): GEvent[]` — sorted by day then start; throws on text that isn't a calendar.

- [ ] **Step 1: Install** — `cd dashboard && npm install ical.js@2.2.1`

- [ ] **Step 2: Write failing tests** `src/lib/gcal.test.ts`

```ts
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
```

- [ ] **Step 3: Run** `node --test src/lib/gcal.test.ts` → FAIL (cannot find module `./gcal.ts`).

- [ ] **Step 4: Implement** `src/lib/gcal.ts`

```ts
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
```

(EXDATE is honoured by `event.iterator()`; the moved occurrence comes back through `getOccurrenceDetails` with its new start. The `n < 5000` guard plus the `hi` break caps endless repeats.)

- [ ] **Step 5: Run** `node --test src/lib/gcal.test.ts` → all PASS. If the moved-occurrence test fails because `exceptions` must be relation-linked, switch to `event.relateException(x)` for each matching exception after constructing the event.
- [ ] **Step 6: Commit** — `git add package.json package-lock.json src/lib/gcal.ts src/lib/gcal.test.ts && git commit -m "Google Calendar: link check and iCal parsing"`

---

### Task 3: Server loader + connect / disconnect API

**Files:**
- Create: `dashboard/src/lib/gcal-server.ts`, `dashboard/src/lib/gcal-server.test.ts`, `dashboard/src/app/api/gcal/route.ts`

**Interfaces:**
- Consumes: `normalizeGoogleIcalUrl`, `parseEvents`, `GEvent` (Task 2); `encryptKey`, `decryptKey` from `@/lib/ai/keys` (returns/accepts `{ key_iv, key_data }`).
- Produces:
  - `fetchIcal(url: string, fetchImpl?: typeof fetch): Promise<string>` — 5 s timeout, 2 MB cap, throws on non-200.
  - `type MyGoogle = { status: "connected" | "not_connected" | "unreachable"; events: GEvent[] }`
  - `loadMyGoogleEvents(supabase: SupabaseClient, fromDay: string, toDay: string, fetchImpl?: typeof fetch): Promise<MyGoogle>` — never throws.
  - `GET /api/gcal` → `{ connected: boolean }`; `POST /api/gcal { url }` → `{ connected: true }` or `400 { error: "format" | "unreachable" | "not_calendar" }`; `DELETE /api/gcal` → `{ connected: false }`.

- [ ] **Step 1: Failing tests** `src/lib/gcal-server.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.AI_KEY_SECRET = randomBytes(32).toString("base64");
const { loadMyGoogleEvents, fetchIcal } = await import("./gcal-server.ts");
const { encryptKey } = await import("./ai/keys.ts");

const URL_ = "https://calendar.google.com/calendar/ical/a/private-abc/basic.ics";
const ICS = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:a\r\nSUMMARY:Class\r\nDTSTART:20261021T080000Z\r\nDTEND:20261021T090000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
const { key_iv, key_data } = encryptKey(URL_);
const db = (row: unknown) => ({ from: () => ({ select: () => ({ maybeSingle: async () => ({ data: row }) }) }) }) as never;

test("not connected when there is no row", async () => {
  assert.deepEqual(await loadMyGoogleEvents(db(null), "2026-10-19", "2026-10-25", (async () => { throw new Error("no fetch"); }) as never),
    { status: "not_connected", events: [] });
});

test("connected: fetches the decrypted link and parses it", async () => {
  let asked = "";
  const f = (async (u: string) => { asked = u; return new Response(ICS); }) as never;
  const got = await loadMyGoogleEvents(db({ url_iv: key_iv, url_data: key_data }), "2026-10-19", "2026-10-25", f);
  assert.equal(asked, URL_);
  assert.equal(got.status, "connected");
  assert.equal(got.events[0].title, "Class");
});

test("revoked link (404) or junk → unreachable, never throws", async () => {
  for (const res of [new Response("gone", { status: 404 }), new Response("<html/>")]) {
    const got = await loadMyGoogleEvents(db({ url_iv: key_iv, url_data: key_data }), "2026-10-19", "2026-10-25", (async () => res) as never);
    assert.deepEqual(got, { status: "unreachable", events: [] });
  }
});

test("slow Google times out after 5 s", async () => {
  const hang = ((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as never;
  const t0 = Date.now();
  await assert.rejects(fetchIcal(URL_, hang));
  assert.ok(Date.now() - t0 < 6000);
});

test("refuses calendars over 2 MB", async () => {
  await assert.rejects(fetchIcal(URL_, (async () => new Response("x".repeat(2 * 1024 * 1024 + 1))) as never));
});
```

- [ ] **Step 2: Run** `node --test src/lib/gcal-server.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/gcal-server.ts`

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptKey } from "@/lib/ai/keys";
import { parseEvents, type GEvent } from "@/lib/gcal";

const MAX = 2 * 1024 * 1024;

/** Downloads a Google iCal link: 5-second timeout, 2 MB cap. Server only. */
export async function fetchIcal(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000), cache: "no-store", redirect: "error" });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const text = await res.text();
  if (text.length > MAX) throw new Error("too big");
  return text;
}

export type MyGoogle = { status: "connected" | "not_connected" | "unreachable"; events: GEvent[] };

/** My own Google Calendar events for fromDay..toDay (RLS returns only my row). Never throws. */
export async function loadMyGoogleEvents(supabase: SupabaseClient, fromDay: string, toDay: string, fetchImpl: typeof fetch = fetch): Promise<MyGoogle> {
  const { data } = await supabase.from("google_calendars").select("url_iv, url_data").maybeSingle();
  if (!data) return { status: "not_connected", events: [] };
  try {
    const url = decryptKey({ key_iv: data.url_iv, key_data: data.url_data });
    return { status: "connected", events: parseEvents(await fetchIcal(url, fetchImpl), fromDay, toDay) };
  } catch {
    return { status: "unreachable", events: [] };
  }
}
```

Note: `@/lib/...` imports don't resolve under plain `node --test`. Check how other tested `src/lib` files import siblings (e.g. `vault.test.ts` / `finance.ts`); if they use relative `./x.ts` paths, use `./ai/keys.ts` and `./gcal.ts` here too (with `allowImportingTsExtensions` already set in tsconfig, or follow the existing convention exactly).

- [ ] **Step 4: Run** `node --test src/lib/gcal-server.test.ts` → PASS.

- [ ] **Step 5: API route** `src/app/api/gcal/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptKey } from "@/lib/ai/keys";
import { normalizeGoogleIcalUrl, parseEvents } from "@/lib/gcal";
import { fetchIcal } from "@/lib/gcal-server";

/** A member connects / disconnects their own Google Calendar (secret iCal link). The link is checked, encrypted, and only used for them. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("google_calendars").select("user_id").maybeSingle();
  return NextResponse.json({ connected: !!data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_profile_id");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  const clean = normalizeGoogleIcalUrl(url ?? "");
  if (!clean) return NextResponse.json({ error: "format" }, { status: 400 });
  let ics: string;
  try { ics = await fetchIcal(clean); } catch { return NextResponse.json({ error: "unreachable" }, { status: 400 }); }
  try { parseEvents(ics, "2000-01-01", "2000-01-01"); } catch { return NextResponse.json({ error: "not_calendar" }, { status: 400 }); }
  const { key_iv, key_data } = encryptKey(clean);
  const { error } = await supabase.from("google_calendars").upsert({ user_id: me, url_iv: key_iv, url_data: key_data, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "save" }, { status: 500 });
  return NextResponse.json({ connected: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: me } = await supabase.rpc("my_profile_id");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await supabase.from("google_calendars").delete().eq("user_id", me);
  return NextResponse.json({ connected: false });
}
```

- [ ] **Step 6:** `npx tsc --noEmit` → no errors.
- [ ] **Step 7: Commit** — `git add src/lib/gcal-server.ts src/lib/gcal-server.test.ts src/app/api/gcal/route.ts && git commit -m "Google Calendar: loader and connect/disconnect API"`

---

### Task 4: Base camp "Show my Google Calendar in emet" card

**Files:**
- Create: `dashboard/src/components/camp/google-calendar.tsx`
- Modify: `dashboard/src/components/camp/agenda.tsx:106` (render `<GoogleCalendar />` right after `<CalendarLink />`, import at line 10)
- Modify: all 7 `dashboard/messages/*.json` — new `camp.gcal` block next to `camp.calendar`

**Interfaces:**
- Consumes: `/api/gcal` GET/POST/DELETE (Task 3).
- Produces: `export function GoogleCalendar()`; anchor id `gcal` (Task 5 links to `/camp?tab=agenda#gcal`).

- [ ] **Step 1: English strings** (`messages/en.json`, inside `camp`, after `"calendar": {...}`):

```json
"gcal": {
  "title": "Show my Google Calendar in emet",
  "hint": "Your Google events appear in Today → Your week and Ask emet can answer questions about your schedule. Only you see them.",
  "step1": "Open Google Calendar on a computer → ⚙ Settings.",
  "step2": "On the left, click your calendar → scroll to “Secret address in iCal format” → copy it.",
  "step3": "Paste it here and press Connect.",
  "placeholder": "https://calendar.google.com/calendar/ical/…/basic.ics",
  "connect": "Connect",
  "connected": "Connected ✓ — your Google events show in Your week",
  "change": "Change link",
  "disconnect": "Disconnect",
  "delay": "New Google events can take a few minutes to appear.",
  "error": {
    "format": "That isn’t a Google Calendar secret link. Copy the “Secret address in iCal format”.",
    "unreachable": "Google didn’t answer. Check the link and try again.",
    "not_calendar": "That link didn’t return a calendar. Copy the “Secret address in iCal format”.",
    "save": "Couldn’t save. Try again."
  },
  "disconnected": "Google Calendar disconnected"
}
```

Translate the same keys into es, de, fr, fi, pt-BR, ru (Google's own setting names: es “Dirección secreta en formato iCal”, de „Privatadresse im iCal-Format“, fr « Adresse secrète au format iCal », fi ”Salainen osoite iCal-muodossa”, pt-BR “Endereço secreto no formato iCal”, ru «Закрытый адрес в формате iCal»). Validate: `node -e "for (const f of require('fs').readdirSync('messages')) JSON.parse(require('fs').readFileSync('messages/'+f))"`.

- [ ] **Step 2: Component** `src/components/camp/google-calendar.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarSync, Loader2, Unplug } from "lucide-react";
import { useToast } from "@/components/toast";

/** "Show my Google Calendar in emet": paste your Google secret iCal link once. Read only, private to you. */
export function GoogleCalendar() {
  const t = useTranslations("camp.gcal");
  const toast = useToast();
  const [connected, setConnected] = useState<boolean | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/gcal").then((r) => r.json()).then((d) => setConnected(!!d.connected)).catch(() => setConnected(false)); }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/gcal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    const d = await res.json().catch(() => ({ error: "save" }));
    setBusy(false);
    if (!res.ok) { toast("error", t(`error.${["format", "unreachable", "not_calendar"].includes(d.error) ? d.error : "save"}`)); return; }
    setConnected(true); setEditing(false); setUrl("");
  }
  async function disconnect() {
    setBusy(true);
    await fetch("/api/gcal", { method: "DELETE" });
    setBusy(false); setConnected(false); toast("ok", t("disconnected"));
  }

  return (
    <section id="gcal" className="panel p-5">
      <h2 className="flex items-center gap-2 font-semibold"><CalendarSync size={17} /> {t("title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("hint")}</p>
      {connected === undefined ? <Loader2 className="mt-3 animate-spin text-muted" size={18} /> : connected && !editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-good-text">{t("connected")}</p>
          <button onClick={() => setEditing(true)} className="btn-ghost text-sm">{t("change")}</button>
          <button onClick={disconnect} disabled={busy} className="btn-ghost text-sm"><Unplug size={14} /> {t("disconnect")}</button>
          <p className="w-full text-xs text-muted">{t("delay")}</p>
        </div>
      ) : (
        <form onSubmit={connect} className="mt-3 space-y-2">
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-muted"><li>{t("step1")}</li><li>{t("step2")}</li><li>{t("step3")}</li></ol>
          <div className="flex gap-2">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("placeholder")} required autoComplete="off" spellCheck={false}
                   className="input min-w-0 flex-1 text-sm" aria-label={t("title")} />
            <button disabled={busy || !url.trim()} className="btn-primary text-sm">{busy ? <Loader2 size={14} className="animate-spin" /> : t("connect")}</button>
          </div>
        </form>
      )}
    </section>
  );
}
```

Before writing, open `calendar-link.tsx` and copy its exact button / input class names (`btn-*`, `input`, `text-good-text`) — use whatever that file uses so the card matches.

- [ ] **Step 3:** add `import { GoogleCalendar } from "./google-calendar";` to `agenda.tsx` and `<GoogleCalendar />` after `<CalendarLink />`.
- [ ] **Step 4:** `npx tsc --noEmit && npx eslint src/components/camp/google-calendar.tsx src/components/camp/agenda.tsx` → clean.
- [ ] **Step 5: Commit** — `git add src/components/camp messages && git commit -m "Google Calendar: Base camp connect card (7 languages)"`

---

### Task 5: Google events in Today → Your week

**Files:**
- Modify: `dashboard/src/components/home/week-calendar.tsx` (type at line 8, due chips ~line 66, timed cards ~line 95)
- Modify: `dashboard/src/components/home/home-dashboard.tsx` (`HomeData.calendar` at line 23, `<WeekCalendar …>` at line 274)
- Modify: `dashboard/src/app/(app)/today/page.tsx` (calendar items ~line 115)
- Modify: 7 `messages/*.json` — `home.cal.google`, `home.gcalFailed`, `home.gcalAdd`

**Interfaces:**
- Consumes: `loadMyGoogleEvents(supabase, fromDay, toDay)` → `MyGoogle` (Task 3); anchor `/camp?tab=agenda#gcal` (Task 4).
- Produces: `CalendarItem.kind?: "google"`; `HomeData.calendar.google: MyGoogle["status"]`.

- [ ] **Step 1: Types** — in `week-calendar.tsx`:

```ts
export type CalendarItem = {
  id: string; title: string; day: string; start: string | null; end: string | null;
  status: "done" | "late" | "open"; href: string; team?: string; kind?: "google";
};
```

In `home-dashboard.tsx` line 23: `calendar: { today: string; days: string[]; items: CalendarItem[]; google: "connected" | "not_connected" | "unreachable" };`

- [ ] **Step 2: Load events** — in `today/page.tsx`, after the second `Promise.all` (the one ending with `weekTasks`), add:

```ts
  const google = await loadMyGoogleEvents(supabase, week, weekEnd);
```

(import `loadMyGoogleEvents` from `@/lib/gcal-server`; `supabase` is the server client already in scope — confirm its variable name at the top of the function). In `calendar:` add `google: google.status,` and append to `items`:

```ts
        ...google.events.map((g) => ({ id: `g:${g.id}`, title: g.title, day: g.day, start: g.start, end: g.end, kind: "google" as const,
          status: g.day < today ? "done" as const : "open" as const,
          href: `https://calendar.google.com/calendar/r/day/${g.day.replaceAll("-", "/")}` })),
```

- [ ] **Step 3: Draw them** — in `week-calendar.tsx`:
  - accept `google` prop: `({ days, today, items, google }: { …; google?: "connected" | "not_connected" | "unreachable" })`, pass `google={d.calendar.google}` from `home-dashboard.tsx`.
  - Google items render as `<a href target="_blank" rel="noopener noreferrer">` instead of `<Link>`: add a tiny helper inside the component
    ```tsx
    const Item = ({ x, ...p }: { x: CalendarItem } & React.ComponentProps<"a">) =>
      x.kind === "google" ? <a href={x.href} target="_blank" rel="noopener noreferrer" {...p} /> : <Link href={x.href} {...p} />;
    ```
    and use `<Item x={x} …>` in both the due-chip and timed-card maps.
  - Colour: Google timed cards `bg-[#3b82f6]/18 ring-[#60a5fa]/45` (not live/late styling); due-chip dot `bg-[#60a5fa]`; label line shows `<CalendarDays size={10} /> {t("cal.google")}` instead of the status text. Google items never count as "live"/late: in `isLive` add `x.kind !== "google" &&`. Past Google events: `text-muted` (no line-through).
  - Header extras under the grid: if `google === "unreachable"` show `<p className="mt-2 text-xs text-bad-text">{t("gcalFailed")}</p>`; if `google === "not_connected"` show `<Link href="/camp?tab=agenda#gcal" className="mt-2 inline-block text-xs text-muted hover:text-ink">{t("gcalAdd")}</Link>`.
  - 5-minute refresh: in the existing `useEffect` with the 30 s clock, add
    ```ts
    const refresh = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 5 * 60_000);
    ```
    (`const router = useRouter()` from `next/navigation`) and clear it in the cleanup.

- [ ] **Step 4: Strings** — en: `"cal": { …, "google": "Google" }`, `"gcalFailed": "Google Calendar couldn’t be loaded right now."`, `"gcalAdd": "+ Add your Google Calendar"`; translate into the other 6.
- [ ] **Step 5:** `npx tsc --noEmit && npm test && npx eslint src/components/home src/app/(app)/today` → clean.
- [ ] **Step 6: Commit** — `git commit -am "Google Calendar: events in Today → Your week"`

---

### Task 6: Ask emet knows my schedule

**Files:**
- Modify: `dashboard/src/app/api/ask/route.ts` (queries at line 26, snapshot at line 48, system prompt at line 72)

**Interfaces:**
- Consumes: `loadMyGoogleEvents` (Task 3), `todayISO` from `@/lib/format`.
- Produces: snapshot key `my_schedule`.

- [ ] **Step 1: Queries** — extend the existing `Promise.all` (after `kpis`) with my own items for the range:

```ts
  const today = todayISO();
  const from = new Date(Date.parse(today + "T00:00:00Z") - 14 * 864e5).toISOString().slice(0, 10);
  const to = new Date(Date.parse(today + "T00:00:00Z") + 60 * 864e5).toISOString().slice(0, 10);
```
(define these before the `Promise.all`), then add to it:

```ts
    supabase.from("agenda_items").select("title, day, start_time, end_time, done").gte("day", from).lte("day", to).order("day"),
    supabase.from("card_checklist_items").select("text, due_on, done, cards(title)").eq("done", false).gte("due_on", from).lte("due_on", to),
    supabase.from("team_task_people").select("done_at, team_tasks(title, due_on)"),
    loadMyGoogleEvents(supabase, from, to),
```

naming them `myPlans, mySubtasks, myTeamTasks, google`. Before writing, check: `agenda_items` RLS returns only the owner's rows (Base camp is private — confirm with `grep -n "agenda_items" supabase/migrations/0008_basecamp.sql`); `card_checklist_items` needs `.eq("assignee_id", me)` and `team_task_people` needs `.eq("user_id", me)` — read their columns in `0024_team_tasks.sql` / the checklist migration and use the exact names. Since `me` comes from the same `Promise.all`, run these four in a second `Promise.all` right after the first.

- [ ] **Step 2: Snapshot** — put `my_schedule` right after `asked_by` (so the 24,000-char cut never drops it):

```ts
    my_schedule: (() => {
      const myCards = c.filter((x) => x.due_at && x.card_assignees.some((a) => a.user_id === me.data) && x.due_at.slice(0, 10) >= from && x.due_at.slice(0, 10) <= to);
      const rows = [
        ...myCards.map((x) => ({ type: "task", title: x.title, board: x.boards?.slug, day: x.due_at!.slice(0, 10), done: !!x.completed_at, late: !x.completed_at && x.due_at!.slice(0, 10) < today })),
        ...(mySubtasks.data ?? []).map((s) => ({ type: "task", title: s.text, board: (s.cards as unknown as { title: string } | null)?.title, day: s.due_on, done: false, late: s.due_on < today })),
        ...(myTeamTasks.data ?? []).flatMap((p) => { const tt = p.team_tasks as unknown as { title: string; due_on: string | null } | null;
          return tt?.due_on && tt.due_on >= from && tt.due_on <= to ? [{ type: "leader_task", title: tt.title, day: tt.due_on, done: !!p.done_at, late: !p.done_at && tt.due_on < today }] : []; }),
        ...(myPlans.data ?? []).map((a) => ({ type: "plan", title: a.title, day: a.day, start: a.start_time?.slice(0, 5), end: a.end_time?.slice(0, 5), done: a.done })),
        ...google.events.map((g) => ({ type: "google", title: g.title, day: g.day, start: g.start ?? undefined, end: g.end ?? undefined, all_day: g.allDay })),
      ];
      const dist = (d: string) => Math.abs(Date.parse(d) - Date.parse(today));
      return {
        range: { from, to }, google_calendar: google.status.replace("_", " "),
        items: rows.sort((a, b) => dist(a.day) - dist(b.day)).slice(0, 200).sort((a, b) => a.day.localeCompare(b.day) || String((a as { start?: string }).start ?? "").localeCompare(String((b as { start?: string }).start ?? ""))),
      };
    })(),
```

- [ ] **Step 3: Prompt** — append to the system prompt string, before `\n\nDATA:`:

```
 For questions about the asker's own schedule, tasks, plans, exams, free time or what they had on a past day, answer from my_schedule (it covers ${from} to ${to}): list it day by day with weekday, date and times, and mark Google Calendar events vs emet plans/tasks. If my_schedule.google_calendar is "not connected" or "unreachable", say their Google events aren't included and why. If something is outside the range or not there, say so plainly.
```

- [ ] **Step 4:** `npx tsc --noEmit && npm test` → clean.
- [ ] **Step 5: Commit** — `git commit -am "Ask emet: answers questions about my schedule (tasks, plans, Google events)"`

---

### Task 7: Docs, live database, browser check

**Files:** `README.md`, `CHANGELOG.md`

- [ ] **Step 1: README** — in the "Dashboard look" row add after the **Your week** sentence: "**Google Calendar** (2026-10-21): each member pastes their Google "Secret address in iCal format" once in Base camp → Agenda ("Show my Google Calendar in emet"); the link is stored encrypted and private (table `google_calendars`, migration 0025). Their Google events (repeats included, Madrid time) show in Your week in blue and open Google Calendar; fetched on each visit and every 5 minutes, so new events appear within a few minutes. Ask emet reads the asker's own schedule (last 14 → next 60 days: tasks, plans, Google events) and answers schedule questions day by day. Read only — emet never writes to Google." Add a decisions-log row: "2026-10-21 | Google Calendar uses the secret iCal link, not Google sign-in (sign-in needs Google's review of calendar access or hand-added test users) | Alvaro".
- [ ] **Step 2: CHANGELOG** — top line: "- 2026-10-21 — Alvaro — Google Calendar in emet: connect in Base camp → Agenda, events in Today → Your week, Ask emet answers schedule questions (migration 0025, all 7 languages)."
- [ ] **Step 3: Run everything** — `cd dashboard && npm test && npm run test:db && npx tsc --noEmit && npx next lint` → all pass. Paste the summary lines.
- [ ] **Step 4: Live database** — run `0025_google_calendar.sql` in the Supabase SQL Editor (project `pupmadgnwzkblyetlcgu`) with Alvaro's OK; verify with `select count(*) from google_calendars;` → 0 rows, no error.
- [ ] **Step 5: Browser check (local `npm run dev`)** — connect a real Google secret link in Base camp; see events on Today in blue, click one opens Google; disconnect works; paste a wrong link → the "isn't a secret link" message; ask "emet, what do I have this week and what's the schedule?" → day-by-day answer with Google events.
- [ ] **Step 6: Commit, then show `git diff origin/main --stat` + full diff to Alvaro and wait for "push it"**; after push, deploy only with Alvaro's OK (rsync `dashboard/` without `.git` to the scratchpad, `npx vercel deploy --prod --yes`).
