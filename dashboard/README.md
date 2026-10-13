# emet HQ — team dashboard

The team dashboard for emet (spec: [`../docs/dashboard-build-prompt.md`](../docs/dashboard-build-prompt.md)).
Free stack only: **Next.js + Supabase (free tier) + Vercel Hobby (free)**.

## Build progress

| Step | What | Status |
|---|---|---|
| 1 | Database, login, permissions, app shell | ✅ Done |
| 2 | Overview page | ✅ Done |
| 3 | Task boards (6) + My Tasks | ⏳ Next |
| 4 | Group tabs & tools + Team management | ⏳ |
| 5 | 7 languages | ⏳ |
| 6 | Trello sync (off by default) | ⏳ |
| 7 | Polish + full setup guide | ⏳ |

## What's in step 1

- **`supabase/migrations/`** — all tables (0001), login linking + permissions (0002), activity feed + realtime (0003).
- **`supabase/seed.sql`** — 5 groups, 6 boards (To do / Doing / Review / Done), the 15 members (no group or role yet, placeholder emails), KPI targets from the README.
- **`supabase/tests/`** — 47 permission tests that log in as different members and try to break the rules at the **database** level.
- **App:** invite-only login (password or email link), invite/reset link handling, "choose a password" welcome page, sidebar + mobile bottom bar, live "● Synced" indicator, group pages showing members and a 🔒 *View only* badge when you can't edit.

### How permissions work

| Who | Can view | Can edit |
|---|---|---|
| Any member | Everything (except other people's morale comments) | Their own group's data and board; cards they created or are assigned to on the general board; their own name, photo and language |
| Team Leader group, or anyone marked admin | Everything | Everything, including inviting people and assigning groups/roles |
| Logged-out visitor | Nothing | Nothing |

Notes:
- **Invite only.** A login is only accepted if an admin added that email first. Strangers are refused by the database itself.
- Changing someone's group takes effect immediately (no re-login).
- Anyone can comment on any card and request a design from Marketing; only the owning group works the queue.
- Morale: each person sees their own score; Communications and admins see individual comments; everyone sees the anonymous weekly average.
- **Alvaro starts as admin** so someone can invite the others. Once Team Leaders are chosen they're admins automatically and Alvaro's flag can be removed.

## What's in step 2 — Overview

- **Goal rings:** revenue €X / €30,000 and profit €X / €15,000, with % and "€Y to go".
- **Countdown to 30 June 2027**, average weekly pace so far and the pace needed from now on (information only, no fixed target).
- **Margin so far** vs the 50% minimum and **on-time task rate** vs 85% (a card counts as on time if it reaches *Done* by its due date; open cards past their due date count as late).
- **Two charts** (deliberately not one chart with two scales): weekly revenue & profit bars, and running totals with a dashed "even pace to €30K" reference line. Date range: 4 weeks / 12 weeks / all time.
- **Group cards:** on track / at risk / behind (icon + word, never colour only), from overdue cards, open blockers and on-time rate, plus one key number per group.
- **Blockers** from every group and a **live activity feed** ("Stefan logged a €120 sale · 2 minutes ago").
- Everything refreshes by itself when anyone changes something.
- Profit = sales − cost of goods − expenses. Chart colours are a colour-blind-safe palette checked in light and dark mode.

## Set up (short version — the full non-developer guide comes in step 7)

1. Create a free project at [supabase.com](https://supabase.com) (no card needed).
2. **SQL Editor** → run, in order: `migrations/0001_schema.sql`, `0002_security.sql`, `0003_activity_realtime.sql`, then `seed.sql`.
3. **Authentication → Sign In / Providers → Email:** turn **off** "Allow new users to sign up" (invite only).
4. **Authentication → URL Configuration:** Site URL = your Vercel URL (e.g. `https://emet-hq.vercel.app`); add `http://localhost:3000/**` to Redirect URLs for local testing.
5. **Authentication → Email Templates** — make the links point at the app:
   - *Invite user:* `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
   - *Magic link:* `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink`
   - *Reset password:* `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
6. Put real emails on the members (SQL Editor: `update profiles set email = 'name@mail.com' where full_name = 'Stefan';`), then invite them from **Authentication → Users → Invite user** (the Team page does this from step 4).
7. Copy `.env.example` to `.env.local`, fill in the values from **Project Settings → API**, then:
   ```bash
   npm install
   npm run dev     # http://localhost:3000
   ```

> Supabase free projects **pause after ~7 days with no activity**. If that happens: Supabase dashboard → your project → **Restore**. Daily use keeps it awake.

## Run the tests

```bash
npm test          # Overview calculations (profit, pace, on-time rate, weekly totals)
npm run test:db   # 47 permission tests — needs a local Postgres 15+, no Supabase account
```
