# emet Team Dashboard — Build Prompt

> Paste everything below the line into Claude Code (inside this repo) to build the dashboard. Fill in the `TBD` values first if you have them; otherwise Claude should use placeholders and list what's missing at the end.

---

You are building **emet HQ**, the team dashboard for emet: a 15-person student non-profit (LEINN Internacional) aiming for **€30,000 revenue and €15,000 profit by 31 Dec 2026** (~€3,000/week, 50% minimum margin). Read `README.md` in this repo first — it has the full team structure, roles and KPIs. Build the app in a `dashboard/` folder, and when you finish, update `README.md` (section 6 "Systems" + section 7 "Decisions log") and `CHANGELOG.md`. Show the diff before pushing.

## 1. What it must do

1. **Live, shared, on a real domain.** Everyone opens the same URL. Any change anyone makes appears for everyone else instantly, without refreshing.
2. **Personal login for each of the 15 members.** Email + password or magic link. No sign-up page: only invited emails can get in.
3. **Permissions by group:**
   - Everyone can **view everything**.
   - Each person can **edit only their own group's tab** and their own tasks.
   - **Team Leader group = admin:** can edit everything, invite/remove members, assign groups and roles.
   - Things you can't edit should look read-only (no hidden buttons that fail — just no edit controls, with a small 🔒 "View only" badge).
4. **Trello in one place:** one Trello board per group (5 boards). Cards and their status show up live inside the dashboard, and moving/creating a card from the dashboard updates Trello too (two-way sync).
5. **Super clear, intuitive, very good looking.** A new member must understand it in 30 seconds with no explanation.

## 2. Tech stack (use this unless there's a strong reason not to)

- **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui** for the UI, **Recharts** for charts, **lucide-react** icons.
- **Supabase** for the database (Postgres), login (Supabase Auth), realtime updates (Supabase Realtime), and permissions (Row Level Security — enforce permissions in the database, not only in the UI).
- **Vercel** for hosting + custom domain (domain: `TBD`).
- **Trello REST API + Trello webhooks** for sync (API key + token stored as Vercel environment variables, never in the repo).
- Free tiers of Supabase and Vercel should be enough; flag anything that would cost money.

## 3. Pages & layout

Left sidebar (collapses to bottom nav on mobile) with: **Overview · Team Leader · Finance · Customer · Marketing · Communications · My Tasks · Team**. The user's own group is highlighted with a "Your team" label. Top bar: week selector, the logged-in user's avatar/name/role, and a live "● Synced" indicator.

### Overview (home)
- **Big goal progress:** two large progress rings/bars — Revenue €X / €30,000 and Profit €X / €15,000 — with % and "€Y to go".
- **This week vs target:** revenue this week vs €3,000, margin this week vs 50%, on-time task rate vs 85%.
- **Countdown:** days and weeks left to 31 Dec 2026, and the weekly pace now needed to still hit the goal ("You need €3,250/week from now on").
- **Revenue over time** chart (weekly bars + cumulative line vs target line).
- **Group health cards** (one per group): green/amber/red status, KPIs, open blockers count, link to the tab.
- **Recent activity feed:** "Marta logged a €120 sale · 2 min ago" (realtime).
- **Blockers board:** all flagged blockers across groups.

### Group tabs (one per group)
Each tab has the same structure so it's easy to learn:
1. **Header:** group name, emoji, color, members with avatars and roles.
2. **KPI cards** for that group's roles (from the README), each showing current vs target with green/amber/red.
3. **Trello board** for that group: columns (To do / Doing / Review / Done) with cards, assignees, due dates, labels. Drag-and-drop if you can edit; read-only otherwise. Overdue cards in red.
4. **Group-specific tools:**
   - **Finance:** sales & expenses ledger (date, description, category, amount, logged by, logged at); auto totals, margin %, and a "logged within 24h?" check; Friday profit report generator (one click → summary of the week); stock/inventory table.
   - **Customer:** revenue by sales rep vs €1,000/week; prospects pipeline (new → contacted → interested → won/lost) with a count vs 20/week per rep; complaints tracker with a 48h timer per complaint.
   - **Marketing:** content calendar (planned/posted posts per platform); campaign list per product; follower counts entered weekly with a growth chart; design request queue with 48h turnaround timer; product/price test log (hypothesis, test, result, decision).
   - **Communications:** Friday scorecard (every KPI vs target, auto-filled from the other tabs); decision log; weekly morale check (each member gives 1–5 + optional comment, shown as team average over time).
   - **Team Leader:** leaders' meeting notes & action items; blockers raised by the operations monitor with owner and status; school contact & upperclassmen outreach tracker; on-time rate across all groups.
5. **Activity feed** for that group.

### My Tasks
All Trello cards assigned to me across every board, sorted by due date, with overdue at the top.

### Team
Directory of all 15 members: name, photo, group, role, email. Admins can invite, edit roles, and deactivate members here.

## 4. Data model (Supabase)

Suggested tables (adjust as needed, keep RLS on every table):
- `groups` (id, name, slug, emoji, color, trello_board_id)
- `profiles` (id = auth user id, full_name, email, avatar_url, group_id, role_title, is_admin)
- `sales` (id, date, description, amount, cost, channel, rep_id, logged_by, created_at)
- `expenses` (id, date, description, category, amount, logged_by, created_at)
- `inventory` (id, product, sku, stock, unit_cost, price, updated_at)
- `prospects` (id, name, contact, stage, owner_id, created_at, updated_at)
- `complaints` (id, customer, issue, status, owner_id, opened_at, resolved_at)
- `content_posts`, `campaigns`, `design_requests`, `experiments`, `follower_snapshots`
- `decisions` (id, date, decision, decided_by, group_id)
- `morale_checks` (id, week, user_id, score, comment)
- `blockers` (id, group_id, description, owner_id, status, created_at, resolved_at)
- `meeting_notes`, `outreach`
- `trello_cards` (id, trello_id, board_id, group_id, list_name, title, due, assignee_ids, labels, url, updated_at) — local mirror for fast, realtime display
- `activity_log` (id, user_id, group_id, action, entity, entity_id, created_at)

**RLS rules:** `SELECT` allowed for any logged-in user. `INSERT/UPDATE/DELETE` allowed only when the row's `group_id` = the user's `group_id`, or the user `is_admin`. Write a SQL migration file for all tables + policies + a seed file with the 5 groups and 15 placeholder members.

## 5. Trello sync

- One board per group. Store each board's ID on its `groups` row.
- Map Trello members to dashboard users by email (fallback: a manual mapping screen for admins).
- **Trello → dashboard:** register a Trello webhook per board pointing to `/api/trello/webhook`; on each event, upsert into `trello_cards` (which then updates every open dashboard via realtime). Add a "Resync" admin button and a nightly full sync as backup.
- **Dashboard → Trello:** creating, moving, or editing a card in the dashboard calls the Trello API from a server route (never from the browser), then updates `trello_cards`.
- Write a short `dashboard/TRELLO_SETUP.md` explaining how to get the API key/token, create the 5 boards, and register webhooks.

## 6. Design direction

- Clean, modern, premium — think Linear / Notion / Stripe dashboard. Lots of whitespace, rounded cards, soft shadows, clear hierarchy, one primary font (e.g. Inter or Geist).
- Each group has its own accent color + emoji used consistently (sidebar, tab header, cards, charts): Team Leader 👑, Finance 💰, Customer 🤝, Marketing 📣, Communications 🗂️.
- Status colors everywhere: green = on track, amber = at risk, red = behind.
- Light and dark mode. Fully responsive (people will use it on their phones).
- Empty states that tell you what to do ("No sales logged this week yet — add the first one").
- Friendly micro-interactions: skeleton loaders, toasts on save, subtle animations on progress bars.
- All money in € with Spanish formatting optional (setting). Interface language: `TBD` (English by default; make texts easy to translate).

## 7. Deliverables

1. Working app in `dashboard/`, deployable to Vercel.
2. `dashboard/README.md`: how to run locally, environment variables, how to deploy, how to connect the domain, how to invite members.
3. SQL migrations + seed data.
4. `dashboard/TRELLO_SETUP.md`.
5. Updated root `README.md` (section 6 Systems + section 7 Decisions) and `CHANGELOG.md`.
6. A list of anything you couldn't finish or that needs a human (API keys, domain DNS, member emails).

Build it step by step: database + auth + permissions first, then Overview, then each group tab, then Trello sync, then polish. Test that a member of one group cannot edit another group's data (at the database level, not just the UI).
