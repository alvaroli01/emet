# emet Team Dashboard — Build Prompt

> Paste everything below the line into Claude Code (inside this repo) to build the dashboard. If some values are still `TBD`, Claude should use placeholders and list what's missing at the end.

---

You are building **emet HQ**, the team dashboard for emet: a 15-person student non-profit (LEINN Internacional) aiming for **€30,000 revenue and €15,000 profit by June 2027** (50% minimum margin, no fixed weekly pace). Read `README.md` and `CLAUDE.md` in this repo first — they have the team structure, roles, KPIs and rules. Build the app in a `dashboard/` folder. When you finish, update `README.md` (section 8 "Systems" and section 9 "Decisions log") and `CHANGELOG.md`, and show the diff before pushing.

## 0. Hard constraint: €0

The team has **no budget**. Every service, library, API and hosting choice must be **free**, with no credit card required if possible. Don't use paid APIs (including AI APIs), paid plans, or anything that starts billing after a trial. If a feature can't be done for free, leave it out and list it at the end as "needs budget".

## 1. What it must do

1. **Live, shared, online.** Everyone opens the same URL. Any change anyone makes appears for everyone else instantly, without refreshing.
2. **Personal login for each of the 15 members** (email + password or magic link). No public sign-up — only invited emails can get in.
3. **Permissions by group:**
   - Everyone can **view everything**.
   - Each person can **edit only their own group's tab**, their own group's task board, and their own tasks on the general board.
   - **Team Leader group = admin:** can edit everything, invite/remove members, assign groups and roles.
   - Anything you can't edit looks read-only (no edit controls, plus a small 🔒 "View only" badge) — never buttons that fail.
   - Enforce permissions in the database, not only in the UI.
4. **Task boards in one place — 6 boards:**
   - **General company board** (🏢 emet): company-wide tasks, everyone can add cards and edit cards assigned to them; admins edit everything.
   - **One board per group** (Team Leader, Finance, Customer, Marketing, Communications): only that group (and admins) can edit.
   - Built **into the dashboard** with a Trello-style UI (lists, cards, drag-and-drop, assignees, due dates, labels, checklists, comments).
   - **Why not Trello directly:** Trello's free plan allows only 10 collaborators per workspace, so a free 15-person general board isn't possible. Build a **Trello sync module behind a per-board on/off switch** (off by default) so any board can be linked to a real Trello board later — see section 5.
5. **7 languages:** English, Spanish, German, French, Finnish, Portuguese (Brazil), Russian. Language switcher in the top bar; each user's choice is saved on their profile. Default: browser language, falling back to English.
6. **Super clear, intuitive, very good looking.** A new member must understand it in 30 seconds with no explanation.

## 2. Tech stack (all free)

- **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui**, **Recharts** for charts, **lucide-react** icons, **next-intl** for translations, **dnd-kit** for drag-and-drop.
- **Supabase free tier** for database (Postgres), login (Supabase Auth), realtime updates (Supabase Realtime) and permissions (Row Level Security). Note: free projects pause after ~7 days with no activity — fine for daily use; document how to un-pause.
- **Hosting:** Vercel Hobby (free) on the free `*.vercel.app` subdomain (e.g. `emet-hq.vercel.app`). Netlify's free plan is the backup option. Make the app ready for a custom domain later, but don't require one.
- **Emails:** use Supabase's built-in auth emails (free, limited per hour) for invites/magic links. No paid email service.
- No paid fonts, no paid component kits, no paid analytics.

## 3. Pages & layout

Left sidebar (bottom nav on mobile): **Overview · General board · Team Leader · Finance · Customer · Marketing · Communications · My Tasks · Team**. The user's own group shows a "Your team" label. Top bar: date range selector, language switcher, the logged-in user's avatar/name/role, and a live "● Synced" indicator.

### Overview (home)
- **Big goal progress:** two large progress rings — Revenue €X / €30,000 and Profit €X / €15,000 — with % and "€Y to go".
- **Countdown** to June 2027 (days/weeks left). Show the average pace so far and the pace needed from now on as information only — no fixed weekly target.
- **Margin so far** vs the 50% minimum, and **on-time task rate** vs 85%.
- **Revenue & profit over time** (weekly bars + cumulative line).
- **Group health cards** (one per group): green/amber/red, key KPIs, open blockers, link to the tab.
- **Recent activity feed** in real time ("Marta logged a €120 sale · 2 min ago").
- **Blockers** across all groups.

### General board
The company-wide Trello-style board (see section 1.4).

### Group tabs (one per group, same structure everywhere)
1. **Header:** group name, emoji, colour, members with avatars and roles.
2. **KPI cards** for that group's roles (from the README), current vs target, green/amber/red. Targets are editable by the group (some are still TBD).
3. **The group's task board.** Drag-and-drop if you can edit, read-only otherwise. Overdue cards in red.
4. **Group-specific tools:**
   - **Finance:** sales & expenses ledger (date, description, category, amount, logged by, logged at) with auto totals, margin %, and a "logged within 24h?" check; one-click Friday profit report; stock/inventory table.
   - **Customer:** revenue per sales rep vs their (editable) target; prospects pipeline (new → contacted → interested → won/lost) with weekly count vs 20 per rep; complaints tracker with a 48h timer per complaint.
   - **Marketing:** content calendar (planned/posted per platform); campaign list per product; weekly follower counts with growth chart; design request queue with 48h timer; product/price test log (hypothesis, test, result, decision).
   - **Communications:** Friday scorecard (every KPI vs target, auto-filled from the other tabs); decision log; weekly morale check (each member scores 1–5 + optional comment, shown as team average over time; individual comments visible only to the Communications group and admins).
   - **Team Leader:** leaders' meeting notes & action items; blockers with owner and status; school contact & upperclassmen outreach tracker; on-time rate across all groups.
5. **Activity feed** for that group.

### My Tasks
Every card assigned to me across all 6 boards, sorted by due date, overdue first.

### Team
Directory of all 15 members: name, photo, group, role, preferred language. Admins can invite, edit roles and deactivate members here. Roles are still being decided, so changing someone's group/role must be quick and must instantly update their permissions.

## 4. Data model (Supabase)

Suggested tables (adjust as needed; RLS on every table):
- `groups` (id, name, slug, emoji, color) — the 5 groups
- `profiles` (id = auth user id, full_name, email, avatar_url, group_id, role_title, is_admin, locale)
- `boards` (id, name, slug, group_id nullable — null = general board, trello_sync_enabled, trello_board_id)
- `board_lists` (id, board_id, name, position)
- `cards` (id, board_id, list_id, title, description, due_at, position, labels, created_by, trello_card_id, updated_at)
- `card_assignees` (card_id, user_id), `card_checklist_items`, `card_comments`
- `sales` (id, date, description, amount, cost, channel, rep_id, logged_by, created_at)
- `expenses` (id, date, description, category, amount, logged_by, created_at)
- `inventory` (id, product, sku, stock, unit_cost, price, updated_at)
- `prospects` (id, name, contact, stage, owner_id, created_at, updated_at)
- `complaints` (id, customer, issue, status, owner_id, opened_at, resolved_at)
- `content_posts`, `campaigns`, `design_requests`, `experiments`, `follower_snapshots`
- `kpi_targets` (id, group_id, role_title, metric, target, period)
- `decisions` (id, date, decision, decided_by, group_id)
- `morale_checks` (id, week, user_id, score, comment)
- `blockers` (id, group_id, description, owner_id, status, created_at, resolved_at)
- `meeting_notes`, `outreach`
- `activity_log` (id, user_id, group_id, action, entity, entity_id, created_at)

**RLS rules:** `SELECT` for any logged-in user (except morale comments, see above). `INSERT/UPDATE/DELETE` only when the row's `group_id` = the user's `group_id`, or the user `is_admin`. On the general board: anyone can create cards; only assignees, the creator or admins can edit a card. Write SQL migrations for all tables + policies + a seed with the 5 groups, the 6 boards (default lists: To do / Doing / Review / Done) and 15 placeholder members.

## 5. Optional Trello sync (off by default, free)

- The Trello REST API and webhooks are free. Build a sync module that, when switched on for a board by an admin, links it to a Trello board ID.
- **Trello → dashboard:** a webhook route `/api/trello/webhook` upserts cards into `cards`; realtime pushes it to everyone. Admin "Resync" button + nightly full sync as backup (use a free scheduler such as Vercel Cron on Hobby or a Supabase scheduled function).
- **Dashboard → Trello:** creating/moving/editing a card calls the Trello API from a server route (never from the browser).
- Map Trello members to users by email, with a manual mapping screen for admins.
- API key/token only in environment variables, never in the repo.
- Write `dashboard/TRELLO_SETUP.md` explaining the 10-collaborator free limit and how to connect a board.

## 6. Translations

- All interface text lives in translation files: `en`, `es`, `de`, `fr`, `fi`, `pt-BR`, `ru`. No hard-coded strings in components.
- Write all 7 files fully (no machine-translation API — write the translations yourself in the code).
- Format numbers, money (€) and dates per locale. Make sure long German/Finnish/Russian words don't break the layout.
- User-entered content (card titles, notes) is not translated.

## 7. Design direction

- Clean, modern, premium — think Linear / Notion / Stripe dashboard. Lots of whitespace, rounded cards, soft shadows, clear hierarchy, one free font (Inter or Geist).
- Each group has its own accent colour + emoji used consistently in the sidebar, headers, cards and charts: General 🏢, Team Leader 👑, Finance 💰, Customer 🤝, Marketing 📣, Communications 🗂️.
- Status colours everywhere: green = on track, amber = at risk, red = behind.
- Light and dark mode. Fully responsive — people will mostly use it on their phones.
- Empty states that say what to do ("No sales logged yet — add the first one").
- Skeleton loaders, toasts on save, subtle animations on progress rings.

## 8. Deliverables

1. Working app in `dashboard/`, deployable for free.
2. `dashboard/README.md` (written for non-developers, step by step): create the free Supabase project, run migrations, set environment variables, deploy to Vercel for free, invite the 15 members, add a custom domain later.
3. SQL migrations + seed data.
4. `dashboard/TRELLO_SETUP.md`.
5. Updated root `README.md` (sections 8 and 9) and `CHANGELOG.md`.
6. A list of anything not finished or needing a human (Supabase account, member emails), plus anything left out because it would cost money.

Build it step by step: database + auth + permissions first, then Overview, then the task boards, then each group tab, then translations, then Trello sync, then polish. Test that a member of one group cannot edit another group's data, at the database level, not just the UI.
