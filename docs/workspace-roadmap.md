# emet HQ — workspace roadmap

> **North star:** the team should do its daily work *inside* emet HQ. Every feature must remove a step, a chat message or a
> spreadsheet, and save time. (Decided by Alvaro, 2026-10-14.)

## Approved (2026-10-14)

| # | Feature | What it does | Saves |
|---|---|---|---|
| 2 | **Today screen** | Per person: 3 priorities, due today, today's meetings, quick buttons (log sale, add task, record) | The daily "what do I do?" check |
| 4 | **Self-writing reports** | Friday profit report + scorecard generated automatically Friday morning, ready to share | ~1 h per week for Finance + Communications |
| 5 | **Search everything (⌘K)** | One search across tasks, docs, meetings, decisions, transcripts | Hunting through chats |
| 6 | **Notifications inbox + daily digest** | Assigned, mentioned, due tomorrow, meeting shared — one place | Checking every page |
| 7 | **Templates & repeating tasks** | Weekly leaders' meeting, Friday report, product launch, stall day — created automatically | Rebuilding checklists |
| 8 | **Calendar sync** | Due dates + agenda in Google/Apple Calendar via a private feed (free) | Double entry |
| 9 | **Install as an app (PWA)** | Home-screen icon, full screen, push notifications, works offline for quick logs | Friction to open it at all |
| 10 | **Ask emet** | Ask questions in plain language ("How much did we sell last week?") answered from our own data with each member's free Groq key | Building reports by hand |

## Proposed, not yet decided

| # | Feature | What it does |
|---|---|---|
| 1 | Meeting → tasks in one tap | Action items from recorded meetings become assigned cards with due dates |
| 3 | 5-second stall sales | Big product buttons, offline, syncs later (also part of the Marketing build) |

## Big sections

- **Marketing (deep)** — spec: [`marketing-build-prompt.md`](marketing-build-prompt.md), research: [`reports/`](reports/).

## Suggested order

9 (app on phones) → 2 (Today) → 6 (notifications) → 5 (search) → 7 (templates) → 4 (auto reports) → 8 (calendar) → 10 (Ask emet),
with the Marketing section built in parallel phases (see its build order).
