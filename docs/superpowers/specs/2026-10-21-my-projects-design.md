# My Projects — design

Date: 2026-10-21 · Owner: Alvaro · Status: approved in chat, waiting for spec review

## Goal

Every person has a **My Projects** section on their own profile with the projects they're part of. Leaders create
projects and choose the people; inside each project the members share links, tasks, files, updates and see the money
the project made — so a project's work lives in one place. €0.

## Decisions (from the chat)

- **Same projects as Finance.** Reuse `public.projects` (0016_finance). Money = sales/expenses whose `project_id` is the project.
- **Only leaders create projects and add/remove people:** `public.is_admin()` (Liderazgo group or admin — today Alvaro and Stefan).
- **Visibility: members + leaders only.** Exception: Finance (`public.is_finance()`) keeps seeing project **names/status**
  so it can tag sales and expenses; it does not see links, files, updates or tasks unless it is a member.
- **Tasks = a full task board per project** (the existing boards/cards), so tasks show in My Tasks, Today's calendar and Ask emet.
- **Extras chosen:** updates feed, project files, goal + deadline + status, notifications, links that open with one click.

## 1. Data (migration `0027_my_projects.sql`)

- `projects` gains: `goal numeric(12,2)` (target revenue, optional), `board_id uuid references boards(id) on delete set null`.
  Existing columns reused: `name, description, status (planning|live|closed), starts_on, ends_on, budget, color, owner_id`.
- `project_members(project_id → projects on delete cascade, user_id → profiles on delete cascade, added_by, added_at, primary key (project_id, user_id))`.
- `project_links(id, project_id, title 1..120, url (https only), kind text, created_by default my_profile_id(), created_at)`.
- `project_updates(id, project_id, body 1..2000, created_by, created_at)`.
- `project_files(id, project_id, name, size ≤ 25 MB, mime, path unique, uploaded_by, created_at)`; storage bucket
  `projects` (private, 25 MB), paths `<project id>/<file id>/<safe name>`.
- `boards` gains `project_id uuid references projects(id) on delete cascade` (null for team/general boards).

**Helpers (security definer, stable):** `is_project_member(p uuid)` = `is_admin() or exists(project_members where user = me)`;
`can_see_board(b uuid)` = board has no `project_id` → `is_member()`; else `is_project_member(project_id)`.

**RLS:**
- `projects` read: `is_admin() or is_finance() or is_project_member(id)`; insert/update/delete: `is_admin()` (replaces the
  Finance-only write policies; Finance keeps tagging sales because that's on `sales`/`expenses`).
- `project_members`: read `is_project_member(project_id)`; insert/delete `is_admin()`.
- `project_links`, `project_updates`, `project_files`: read + insert for `is_project_member(project_id)`; update/delete for the
  creator or `is_admin()`.
- Storage `projects` bucket: read/insert when `is_project_member((foldername)[1]::uuid)`; delete for admins or the uploader's row.
- **Task privacy:** the read policies of `boards`, `board_lists`, `cards`, `card_assignees`, `card_checklist_items`,
  `card_comments` (and any other card child table found in migrations) change from `is_member()` to
  `can_see_board(<board>)`; write helpers `can_edit_board/can_edit_card` treat a project board as editable by its members.
  Team and general boards behave exactly as before (tests prove both).
- `activity_log` entries about project cards must not leak titles to non-members (check how card activity is written;
  filter in the read policy or skip logging project-board events — decided in the plan with a test).

**Money:** a `security invoker` view or RPC `project_money(p uuid)` → `revenue, costs, profit, by_week` from `sales` and
`expenses` with `project_id = p`, only for members/leaders/finance. Sales/expenses read rules are unchanged.

**Notifications** (via `public.notify`, link `/projects/<id>`): `project_added` to a person when added;
`project_post` to all other members on a new link, file or update (`{project, what, title}`).

## 2. Screens

- **Profile → My Projects** (own profile only, above Documents): grid of project cards — colour, name, status chip,
  deadline / days left, progress to goal, member avatars. Leaders: **New project** button + they see all projects.
- **`/projects/<id>`** (members + leaders; others → 404): header (name, status, dates, goal bar, people; leaders: Edit,
  Manage people, Delete) and tabs:
  - **Overview** — goal progress, money summary, days left, latest 5 updates, latest links.
  - **Money** — revenue / costs / profit cards + revenue by week bars (from Finance). Empty state: "Finance tags sales to this project".
  - **Tasks** — the existing board component on the project's board (created with the project: To do / Doing / Done).
  - **Links** — add (title + URL); icon by kind: Google Doc / Sheet / Slides / Drive / Canva / Notion / Figma / other; opens in a new tab.
  - **Files** — the Documents drive pattern (upload, open with 5-minute link, delete).
  - **Updates** — post box + feed (author, time, text).
- Leaders' **New / Edit project** dialog: name, description, goal €, start, end, status, colour, people (multi-select).

## 3. Errors

Non-https or empty link → refused with a message. Files over 25 MB refused before upload. A removed member loses
access immediately (policies are live). Deleting a project (leaders) asks to confirm; its board, links, updates, files go too
(storage objects removed first); sales/expenses keep existing with `project_id` set to null (existing FK).

## 4. Testing

- `permissions_test.sql`: only leaders create/edit projects and members; member sees own project, not others; non-member
  can't read the project's links/updates/files/board/cards/checklist/comments; member can add a link/update/file and a card on
  the project board; team boards still readable by all members; Finance sees project names but not links; Finance can still
  tag a sale with a project; notifications on add and on a new update.
- `src/lib/projects.test.ts`: link kind detection + https check, money totals and by-week grouping, days-left and goal %.
- Browser: leader creates a project with 2 people, member sees it on their profile, adds link/task/update/file, Finance
  sale tagged → Money tab shows it.

## Out of scope

Project-level budgets beyond Finance's existing budget field, Gantt/timelines, guest (non-member) access, editing
others' links, Ask emet summarising project updates (tasks already reach Ask emet).
