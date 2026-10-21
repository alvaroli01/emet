# Google Calendar in emet — design

Date: 2026-10-21 · Owner: Alvaro · Status: approved in chat, waiting for spec review

## Goal

Each member can show their own Google Calendar inside emet, so **Today → Your week** shows their whole week in one
place (emet plans + tasks + Google events), and **Ask emet** can answer "what do we have to do this week and what's
the schedule?". Free (€0), no new accounts, no Google app review.

## Decisions (from the chat)

- **Connection = Google's "Secret address in iCal format"** (option A), not Google sign-in (option B). B needs
  Google's review of the sensitive calendar scope (weeks) or hand-added test users with an "unverified app" warning.
- **Read only.** emet never writes to Google Calendar. (The existing `/api/calendar/<token>.ics` feed already goes the
  other way: emet → Google.)
- **Freshness:** fetched every time Today opens and every 5 minutes while it's open. Google itself refreshes the
  secret link with a delay of usually a few minutes, so events are "near live", not instant. Accepted.
- **Private:** only the owner ever sees their Google events — not leaders, not admins.

## 1. Data

Migration `0025_google_calendar.sql`:

```sql
create table public.google_calendars (
  user_id    uuid primary key default public.my_profile_id() references public.profiles(id) on delete cascade,
  url_iv     text not null,   -- the secret iCal link, encrypted with AI_KEY_SECRET (same helper as ai_keys)
  url_data   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS: owner only, for all actions (same pattern as ai_keys / calendar_feeds).
```

The browser never reads `url_*` back; it only learns "connected: yes/no" from the server.

## 2. Server code

- `src/lib/gcal.ts` (pure, unit-tested):
  - `isGoogleIcalUrl(url)` — accepts only `https://calendar.google.com/calendar/ical/<id>/private-<secret>/basic.ics`
    (also `.../public/basic.ics`). Anything else is rejected, so the server can't be made to fetch other hosts.
  - `parseEvents(icsText, fromDay, toDay, timeZone = "Europe/Madrid")` → `{ id, title, day, start, end, allDay }[]`
    for the days in range. Uses the `ical.js` library (Mozilla, MIT, free) so repeating events (RRULE, EXDATE,
    moved occurrences) are expanded correctly. Times converted to Madrid time. Events spanning several days appear on
    each day. Cancelled events are skipped.
- `src/lib/gcal-server.ts`: `loadMyGoogleEvents(supabase, fromDay, toDay)` → reads my row, decrypts, fetches with a
  5-second timeout and a 2 MB size cap, parses. Returns `{ connected: boolean, events, error?: "unreachable" }`.
  Never throws.
- `src/app/api/gcal/route.ts`: `POST { url }` validates + test-fetches the link (must parse as a calendar), then
  encrypts and upserts; `DELETE` removes my row. Logged-in members only.

## 3. Connecting (Base camp)

New card `src/components/camp/google-calendar.tsx` next to the existing "Add to my calendar" card:
"Show my Google Calendar in emet" with 3 short steps (Google Calendar → Settings → your calendar → "Secret address in
iCal format" → copy), a paste box and **Connect**. Connected state: "Connected ✓" with **Change link** and
**Disconnect**. Errors: "That isn't a Google Calendar secret link" / "Google didn't answer, try again". All 7 languages.

## 4. Showing it (Today → Your week)

- `today/page.tsx` loads my Google events for the shown week (Mon–Sun) next to agenda plans and due tasks.
- `CalendarItem` gets a new kind `google`: timed events are cards in their slot in a calm blue tone with a small
  calendar icon; all-day events sit at the top of the day with due tasks. Click opens
  `https://calendar.google.com/calendar/r/day/<yyyy>/<m>/<d>` in a new tab.
- If loading failed, a small chip "Google Calendar couldn't be loaded"; emet items still show.
- Refresh: a client timer calls `router.refresh()` every 5 minutes while the tab is visible.
- No Google link yet → a small "Add your Google Calendar" link to Base camp in the card header.

## 5. Ask emet

Ask emet must answer **any** question about the asker's schedule, not just "this week": "what's my schedule this
week?", "when is my next exam?", "am I free Thursday afternoon?", "what did I have last Monday?", "what's due before
the 15th?". `/api/ask` adds a `my_schedule` section to its snapshot, for the person asking only, covering
**the last 14 days to the next 60 days**:
- `tasks_due`: my open cards, checklist items and team-leader tasks with a due date in the range (title, board, day, late?)
- `plans`: my agenda items (title, day, start, end, done)
- `google_events`: from `loadMyGoogleEvents` (title, day, start, end, all_day)
- `google_calendar`: "connected" / "not connected" / "couldn't be loaded" (so emet can say why events are missing)

Placed near the top of the snapshot (the prompt cuts the data at 24,000 characters) and capped at 200 entries,
nearest dates first. The system prompt gets one line: schedule questions are answered from `my_schedule`, day by day
with times, and emet says plainly when something isn't in it. This goes only through the asker's own Groq key, like
every Ask emet question.

## 6. Testing

- `src/lib/gcal.test.ts` (node --test): URL check (good private/public links; other hosts, http, look-alike hosts
  rejected); parsing of a timed event, an all-day event, a multi-day event, a weekly repeat with one exception, a
  UTC event shown in Madrid time, a cancelled event.
- `supabase/tests/permissions_test.sql`: member B can't select/update/delete member A's `google_calendars` row.
- Browser check: connect a real Google secret link, see events on Today, ask Ask emet about the week.

## Out of scope

Writing to Google, several Google calendars per person (one link each for now), showing Google events to others,
Google sign-in. The Documents feature (company docs + personal folder) gets its own spec.
