# My Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leaders create projects (reusing Finance's `projects`) and add people; members get a project page with overview, money, a private task board, links, files and updates; projects are listed under My Projects on the person's own profile.

**Architecture:** Migration 0027 extends `projects`, adds `project_members/links/updates/files`, a private `projects` bucket, helper functions `is_project_member()` / `can_see_board()`, and switches the board/card read+write helpers so project boards are private to members. Pure helpers in `src/lib/projects.ts` (link kind, money totals, progress). UI: `src/components/projects/*`, route `src/app/(app)/projects/[id]/page.tsx`, section on the own profile.

**Tech Stack:** Next.js App Router, Supabase (RLS, Storage), next-intl ×7, node:test, plpgsql permission tests.

**Spec:** `docs/superpowers/specs/2026-10-21-my-projects-design.md`

## Global Constraints

- Leader = `public.is_admin()` (Liderazgo or admin: Alvaro, Stefan). Finance = `public.is_finance()`.
- Project content (members, links, updates, files, board, cards and their children) readable only by `is_project_member()` (members + leaders). Finance sees `projects` rows only.
- Team and general boards keep exactly their current rules.
- Links: https only. Files: 25 MB, private bucket `projects`, 5-minute signed URLs.
- New tables get explicit `grant … to authenticated` + RLS (repo rule 9).
- Every string in all 7 `messages/*.json`. README + CHANGELOG. Show diff, wait for "push it". Deploy only after.

## Review Focus

1. **Card links for project tasks** in My Tasks / Today / search / notifications must open `/projects/<id>?tab=tasks&card=<id>`, not `/board`. Covered: `card_link()` SQL updated (Task 1 test) + TS `cardHref()` helper (Task 2 test) used in the 6 TS call sites.
2. **Activity feed leaking project task titles** to non-members — `activity_log` BEFORE INSERT filter drops cards/comments rows on project boards (Task 1 test). Ruling: deleted project cards may still log a "deleted" line (card already gone) — low sensitivity.
3. **Removing a member** immediately hides the project, board and files (Task 1 test after `delete from project_members`).
4. **Finance tagging a sale** to a project it can't open still works (Task 1 test).
5. **Deleting a project** cascades board/links/updates/files rows; storage objects removed by the UI first; sales keep existing with `project_id = null` (Task 1 test).

---

### Task 1: Database (migration 0027 + permission tests)

**Files:** create `dashboard/supabase/migrations/0027_my_projects.sql`; append to `dashboard/supabase/tests/permissions_test.sql`.

- [ ] **Step 1: Failing tests** (append at the end, after the Documents block; users 1 Alvaro admin · 2 Stefan Finance · 3 Rocco Marketing · 4 Lassi Team Leader · 5 Mario Comms)

```sql
-- ── My Projects: leaders create, members work, others see nothing ──
select t.login(3);
select t.check('Member cannot create a project', $$insert into projects (name) values ('Nope')$$, 'denied');
select t.login(4);  -- Lassi, leader
select t.check('Leader creates a project', $$insert into projects (name, goal) values ('Market stall', 2000)$$, 'ok');
select t.check('Leader adds Rocco to it', $$insert into project_members (project_id, user_id) select p.id, r.id from projects p, profiles r where p.name = 'Market stall' and r.full_name = 'Rocco'$$, 'ok');
select t.check('Leader creates the project board', $$insert into boards (slug, name, project_id) select 'project-' || id, name, id from projects where name = 'Market stall'$$, 'ok');
select t.check('Leader adds a list to it', $$insert into board_lists (board_id, name) select id, 'To do' from boards where slug like 'project-%'$$, 'ok');
select t.login(3);  -- Rocco, member of the project
select t.assert('Member sees the project', t.num($$select count(*) from projects where name = 'Market stall'$$) = 1);
select t.assert('Member was notified about being added', t.num($$select count(*) from notifications where kind = 'project_added'$$) = 1);
select t.check('Member adds a task on the project board', $$insert into cards (board_id, list_id, title, created_by) select b.id, l.id, 'Book the stall', my_profile_id() from boards b join board_lists l on l.board_id = b.id where b.slug like 'project-%'$$, 'ok');
select t.check('Member edits that task', $$update cards set title = 'Book the stall (paid)' where title = 'Book the stall'$$, 'ok');
select t.check('Member adds a link', $$insert into project_links (project_id, title, url) select id, 'Budget', 'https://docs.google.com/spreadsheets/d/x' from projects where name = 'Market stall'$$, 'ok');
select t.check('Links must be https', $$insert into project_links (project_id, title, url) select id, 'Bad', 'javascript:alert(1)' from projects where name = 'Market stall'$$, 'denied');
select t.check('Member posts an update', $$insert into project_updates (project_id, body) select id, 'Stall booked' from projects where name = 'Market stall'$$, 'ok');
select t.check('Member uploads a project file', $$insert into storage.objects (bucket_id, name) select 'projects', id || '/f/plan.pdf' from projects where name = 'Market stall'$$, 'ok');
select t.check('Member cannot add people', $$insert into project_members (project_id, user_id) select p.id, r.id from projects p, profiles r where p.name = 'Market stall' and r.full_name = 'Mario'$$, 'denied');
select t.check('Member cannot change the project', $$update projects set goal = 1 where name = 'Market stall'$$, 'denied');
select t.login(5);  -- Mario, not a member
select t.assert('Non-member does not see the project', t.num($$select count(*) from projects where name = 'Market stall'$$) = 0);
select t.assert('Non-member does not see its board, lists or tasks', t.num($$select count(*) from boards where slug like 'project-%'$$) = 0 and t.num($$select count(*) from board_lists l join boards b on b.id = l.board_id where b.project_id is not null$$) = 0 and t.num($$select count(*) from cards where title like 'Book the stall%'$$) = 0);
select t.assert('Non-member does not see links, updates or files', t.num('select count(*) from project_links') = 0 and t.num('select count(*) from project_updates') = 0 and t.num($$select count(*) from storage.objects where bucket_id = 'projects'$$) = 0);
select t.assert('Non-member activity feed has no project task titles', t.num($$select count(*) from activity_log where summary->>'label' like 'Book the stall%'$$) = 0);
select t.check('Non-member cannot add a task to the project board', $$insert into cards (board_id, list_id, title, created_by) select b.id, l.id, 'x', my_profile_id() from boards b join board_lists l on l.board_id = b.id where b.slug like 'project-%'$$, 'denied');
select t.assert('Team boards are still visible to everyone', t.num($$select count(*) from boards where project_id is null$$) > 0);
select t.login(2);  -- Stefan, Finance (not a member)
select t.assert('Finance sees the project name to tag sales', t.num($$select count(*) from projects where name = 'Market stall'$$) = 1);
select t.assert('Finance does not see the project links', t.num('select count(*) from project_links') = 0);
select t.check('Finance tags a sale with the project', $$insert into sales (date, amount, description, project_id) select current_date, 120, 'Stall sale', id from projects where name = 'Market stall'$$, 'ok');
select t.login(3);
select t.assert('Member sees the project money', (select revenue from project_money((select id from projects where name = 'Market stall'))) = 120);
select t.login(4);
select t.check('Leader removes Rocco', $$delete from project_members where user_id = (select id from profiles where full_name = 'Rocco')$$, 'ok');
select t.login(3);
select t.assert('Removed member loses the project at once', t.num($$select count(*) from projects where name = 'Market stall'$$) = 0 and t.num($$select count(*) from cards where title like 'Book the stall%'$$) = 0);
select t.login(4);
select t.assert('Project task links open the project', (select card_link(id) from cards where title like 'Book the stall%') like '/projects/%?tab=tasks&card=%');
select t.check('Leader deletes the project', $$delete from projects where name = 'Market stall'$$, 'ok');
select t.assert('Its board, links and updates went with it', t.num($$select count(*) from boards where slug like 'project-%'$$) = 0 and t.num('select count(*) from project_links') = 0 and t.num('select count(*) from project_updates') = 0);
select t.login(2);
select t.assert('The sale stays, untagged', t.num($$select count(*) from sales where description = 'Stall sale' and project_id is null$$) = 1);
```

(If `sales` needs other required columns, copy the column list from an existing sale insert in this test file. If `projects` has a `projects_delete` policy missing — 0016 only granted select/insert/update — the migration adds the grant + policy.)

- [ ] **Step 2: Run** `PGBIN=$(dirname $(readlink -f $(which psql))) bash supabase/tests/run-local.sh` → FAIL (`project_members` missing).

- [ ] **Step 3: Migration** `0027_my_projects.sql`

```sql
-- My Projects: leaders create projects (the same projects Finance tags sales with) and add people; members share
-- links, files, updates and a private task board. Members + leaders see a project; Finance sees only the project rows.
alter table public.projects add column if not exists goal numeric(12,2) check (goal is null or goal >= 0);
alter table public.boards add column if not exists project_id uuid references public.projects(id) on delete cascade;
create unique index if not exists boards_project_idx on public.boards (project_id) where project_id is not null;

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  added_by   uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  added_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create table public.project_links (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  url        text not null check (url ~* '^https://[^\s]+$' and char_length(url) <= 2000),
  created_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.project_updates (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.project_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  size        bigint not null check (size between 0 and 26214400),
  mime        text not null default 'application/octet-stream',
  path        text not null unique,
  uploaded_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index project_links_idx on public.project_links (project_id);
create index project_updates_idx on public.project_updates (project_id, created_at desc);
create index project_files_idx on public.project_files (project_id);

create or replace function public.is_project_member(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.project_members m where m.project_id = p and m.user_id = public.my_profile_id())
$$;
create or replace function public.can_see_board(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when x.project_id is null then public.is_member() else public.is_project_member(x.project_id) end
                   from public.boards x where x.id = b), false)
$$;
grant execute on function public.is_project_member(uuid), public.can_see_board(uuid) to authenticated;

-- Boards/cards: project boards are edited by their members; team and general boards unchanged
create or replace function public.can_edit_board(p_board_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when b.project_id is not null then public.is_project_member(b.project_id)
                               when b.group_id is null then public.is_admin()
                               else public.can_edit_group(b.group_id) end
                   from public.boards b where b.id = p_board_id), false)
$$;
create or replace function public.can_add_card(p_board_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when b.project_id is not null then public.is_project_member(b.project_id)
                               when b.group_id is null then public.is_member()
                               else public.can_edit_group(b.group_id) end
                   from public.boards b where b.id = p_board_id), false)
$$;
create or replace function public.can_edit_card(p_card_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case
             when b.project_id is not null then public.is_project_member(b.project_id)
             when b.group_id is not null then public.can_edit_group(b.group_id)
             else public.is_admin() or c.created_by = public.my_profile_id()
                  or exists (select 1 from public.card_assignees a where a.card_id = c.id and a.user_id = public.my_profile_id())
           end
      from public.cards c join public.boards b on b.id = c.board_id where c.id = p_card_id), false)
$$;
create or replace function public.card_link(p_card uuid) returns text language sql stable security definer set search_path = public as $$
  select case when b.project_id is not null then '/projects/' || b.project_id || '?tab=tasks&card=' || c.id
              else coalesce('/g/' || g.slug, '/board') || '?card=' || c.id end
  from public.cards c join public.boards b on b.id = c.board_id left join public.groups g on g.id = b.group_id
  where c.id = p_card
$$;

-- Read rules: project boards and everything on them only for the project's members
drop policy if exists boards_read on public.boards;
create policy boards_read on public.boards for select to authenticated using (public.can_see_board(id));
drop policy if exists boards_insert on public.boards;
create policy boards_insert on public.boards for insert to authenticated with check (public.is_admin());
drop policy if exists lists_read on public.board_lists;
create policy lists_read on public.board_lists for select to authenticated using (public.can_see_board(board_id));
drop policy if exists cards_read on public.cards;
create policy cards_read on public.cards for select to authenticated using (public.can_see_board(board_id));
drop policy if exists assignees_read on public.card_assignees;
create policy assignees_read on public.card_assignees for select to authenticated
  using (public.can_see_board((select board_id from public.cards c where c.id = card_id)));
drop policy if exists checklist_read on public.card_checklist_items;
create policy checklist_read on public.card_checklist_items for select to authenticated
  using (public.can_see_board((select board_id from public.cards c where c.id = card_id)));
drop policy if exists comments_read on public.card_comments;
create policy comments_read on public.card_comments for select to authenticated
  using (public.can_see_board((select board_id from public.cards c where c.id = card_id)));
drop policy if exists comments_insert on public.card_comments;
create policy comments_insert on public.card_comments for insert to authenticated
  with check (public.can_see_board((select board_id from public.cards c where c.id = card_id)) and author_id = public.my_profile_id());

-- Activity feed: never log what happens on a project board (titles would reach everyone)
create or replace function public.trg_activity_skip_projects() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.entity = 'cards' and exists (select 1 from public.cards c join public.boards b on b.id = c.board_id where c.id = new.entity_id and b.project_id is not null) then return null; end if;
  if new.entity = 'card_comments' and exists (select 1 from public.card_comments m join public.cards c on c.id = m.card_id join public.boards b on b.id = c.board_id where m.id = new.entity_id and b.project_id is not null) then return null; end if;
  if new.entity in ('board_lists', 'boards') and exists (select 1 from public.boards b where b.project_id is not null and (b.id = new.entity_id or b.id = (select board_id from public.board_lists where id = new.entity_id))) then return null; end if;
  return new;
end $$;
create trigger activity_skip_projects before insert on public.activity_log for each row execute function public.trg_activity_skip_projects();

-- Projects: leaders create/change/delete; members + leaders + Finance read
grant select, insert, update, delete on public.projects to authenticated;
drop policy if exists projects_read on public.projects;
drop policy if exists projects_write on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;
create policy projects_read on public.projects for select to authenticated using (public.is_finance() or public.is_project_member(id));
create policy projects_insert on public.projects for insert to authenticated with check (public.is_admin());
create policy projects_update on public.projects for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy projects_delete on public.projects for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.project_members, public.project_links, public.project_updates, public.project_files to authenticated;
alter table public.project_members enable row level security;
alter table public.project_links enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_files enable row level security;
create policy project_members_read on public.project_members for select to authenticated using (public.is_project_member(project_id));
create policy project_members_insert on public.project_members for insert to authenticated with check (public.is_admin());
create policy project_members_delete on public.project_members for delete to authenticated using (public.is_admin());
do $$ declare t text; c text; begin
  foreach t in array array['project_links', 'project_updates', 'project_files'] loop
    c := case t when 'project_files' then 'uploaded_by' else 'created_by' end;
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (public.is_project_member(project_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_project_member(project_id) and %2$s = public.my_profile_id())', t, c);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (%2$s = public.my_profile_id() or public.is_admin()) with check (public.is_project_member(project_id))', t, c);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (%2$s = public.my_profile_id() or public.is_admin())', t, c);
  end loop;
end $$;

-- Money: what Finance tagged to this project (members, leaders and Finance only)
create or replace function public.project_money(p uuid)
returns table (revenue numeric, costs numeric, profit numeric) language sql stable security definer set search_path = public as $$
  with r as (select coalesce(sum(amount), 0) v from public.sales where project_id = p),
       c as (select coalesce(sum(amount), 0) v from public.expenses where project_id = p)
  select r.v, c.v, r.v - c.v from r, c where public.is_project_member(p) or public.is_finance()
$$;
create or replace function public.project_money_by_week(p uuid)
returns table (week date, revenue numeric) language sql stable security definer set search_path = public as $$
  select date_trunc('week', date)::date, sum(amount) from public.sales
  where project_id = p and (public.is_project_member(p) or public.is_finance())
  group by 1 order by 1
$$;
grant execute on function public.project_money(uuid), public.project_money_by_week(uuid) to authenticated;

-- Notifications
create or replace function public.trg_notify_project_member() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(array[new.user_id], 'project_added',
    jsonb_build_object('project', (select name from public.projects where id = new.project_id)), '/projects/' || new.project_id, new.added_by);
  return new;
end $$;
create trigger notify_project_member after insert on public.project_members for each row execute function public.trg_notify_project_member();
create or replace function public.trg_notify_project_post() returns trigger language plpgsql security definer set search_path = public as $$
declare who uuid := coalesce(to_jsonb(new)->>'created_by', to_jsonb(new)->>'uploaded_by')::uuid;
begin
  perform public.notify(array(select user_id from public.project_members where project_id = new.project_id), 'project_post',
    jsonb_build_object('project', (select name from public.projects where id = new.project_id),
                       'what', tg_table_name, 'title', coalesce(to_jsonb(new)->>'title', to_jsonb(new)->>'name', left(to_jsonb(new)->>'body', 80))),
    '/projects/' || new.project_id, who);
  return new;
end $$;
create trigger notify_project_link after insert on public.project_links for each row execute function public.trg_notify_project_post();
create trigger notify_project_update after insert on public.project_updates for each row execute function public.trg_notify_project_post();
create trigger notify_project_file after insert on public.project_files for each row execute function public.trg_notify_project_post();

-- Storage: private "projects" bucket, <project id>/<file id>/<name>
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit) values ('projects', 'projects', false, 26214400) on conflict (id) do nothing;
    create policy projects_files_read on storage.objects for select to authenticated
      using (bucket_id = 'projects' and public.is_project_member(((storage.foldername(name))[1])::uuid));
    create policy projects_files_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'projects' and public.is_project_member(((storage.foldername(name))[1])::uuid));
    create policy projects_files_delete on storage.objects for delete to authenticated
      using (bucket_id = 'projects' and public.is_project_member(((storage.foldername(name))[1])::uuid));
  end if;
end $$;
```

- [ ] **Step 4:** run DB tests → all PASS (fix SQL, never weaken tests). Note: the storage path cast `::uuid` errors on non-uuid folders — wrap in a safe cast if a test hits it.
- [ ] **Step 5: Commit** `git add supabase && git commit -m "My Projects: tables, private project boards, money, notifications"`

---

### Task 2: Pure helpers

**Files:** create `dashboard/src/lib/projects.ts`, `dashboard/src/lib/projects.test.ts`.

**Produces:** `linkKind(url) → "doc"|"sheet"|"slides"|"drive"|"form"|"canva"|"notion"|"figma"|"other"`; `cleanUrl(raw) → string | null` (trim, add `https://` when missing, only http(s) → https, reject others); `progress(revenue, goal) → number | null` (0..1, null without goal); `daysLeft(endsOn, today) → number | null`; `cardHref(card: { id: string; boards?: { group_id: string | null; project_id?: string | null } | null }, slugOf: (gid: string) => string | undefined) → string`.

- [ ] **Step 1: Tests** `projects.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { linkKind, cleanUrl, progress, daysLeft, cardHref } from "./projects.ts";

test("link kinds", () => {
  assert.equal(linkKind("https://docs.google.com/document/d/abc/edit"), "doc");
  assert.equal(linkKind("https://docs.google.com/spreadsheets/d/abc"), "sheet");
  assert.equal(linkKind("https://docs.google.com/presentation/d/abc"), "slides");
  assert.equal(linkKind("https://docs.google.com/forms/d/abc"), "form");
  assert.equal(linkKind("https://drive.google.com/drive/folders/abc"), "drive");
  assert.equal(linkKind("https://www.canva.com/design/abc"), "canva");
  assert.equal(linkKind("https://www.notion.so/x"), "notion");
  assert.equal(linkKind("https://www.figma.com/file/x"), "figma");
  assert.equal(linkKind("https://example.com"), "other");
  assert.equal(linkKind("https://1drv.ms/x.pptx"), "slides");
  assert.equal(linkKind("https://x.sharepoint.com/:x:/r/book.xlsx"), "sheet");
});

test("links are cleaned to https or refused", () => {
  assert.equal(cleanUrl("  docs.google.com/document/d/a "), "https://docs.google.com/document/d/a");
  assert.equal(cleanUrl("http://example.com/a"), "https://example.com/a");
  assert.equal(cleanUrl("https://example.com/a b"), null);
  assert.equal(cleanUrl("javascript:alert(1)"), null);
  assert.equal(cleanUrl("mailto:a@b.c"), null);
  assert.equal(cleanUrl(""), null);
});

test("goal progress and days left", () => {
  assert.equal(progress(640, 2000), 0.32);
  assert.equal(progress(3000, 2000), 1);
  assert.equal(progress(100, null), null);
  assert.equal(daysLeft("2026-10-31", "2026-10-21"), 10);
  assert.equal(daysLeft("2026-10-20", "2026-10-21"), -1);
  assert.equal(daysLeft(null, "2026-10-21"), null);
});

test("task links open the right place", () => {
  const slug = (g: string) => (g === "g1" ? "finance" : undefined);
  assert.equal(cardHref({ id: "c", boards: { group_id: null, project_id: "p" } }, slug), "/projects/p?tab=tasks&card=c");
  assert.equal(cardHref({ id: "c", boards: { group_id: "g1" } }, slug), "/g/finance?card=c");
  assert.equal(cardHref({ id: "c", boards: { group_id: null } }, slug), "/board?card=c");
});
```

- [ ] **Step 2:** run → FAIL. **Step 3:** implement:

```ts
/** My Projects: pure helpers shared by the project pages and tests. */
export type LinkKind = "doc" | "sheet" | "slides" | "drive" | "form" | "canva" | "notion" | "figma" | "other";

export function linkKind(url: string): LinkKind {
  const u = url.toLowerCase();
  if (/docs\.google\.com\/document|\.docx?(\?|$)|:w:\//.test(u)) return "doc";
  if (/docs\.google\.com\/spreadsheets|\.xlsx?(\?|$)|:x:\//.test(u)) return "sheet";
  if (/docs\.google\.com\/presentation|\.pptx?(\?|$)|:p:\//.test(u)) return "slides";
  if (/docs\.google\.com\/forms|forms\.gle/.test(u)) return "form";
  if (/drive\.google\.com/.test(u)) return "drive";
  if (/canva\.com/.test(u)) return "canva";
  if (/notion\.(so|site)/.test(u)) return "notion";
  if (/figma\.com/.test(u)) return "figma";
  return "other";
}

export function cleanUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!u.hostname.includes(".")) return null;
  u.protocol = "https:";
  return u.toString();
}

export const progress = (revenue: number, goal: number | null) => (goal && goal > 0 ? Math.min(1, Math.round((revenue / goal) * 100) / 100) : null);

export function daysLeft(endsOn: string | null, today: string): number | null {
  return endsOn ? Math.round((Date.parse(endsOn) - Date.parse(today)) / 864e5) : null;
}

export function cardHref(card: { id: string; boards?: { group_id: string | null; project_id?: string | null } | null }, slugOf: (gid: string) => string | undefined): string {
  const b = card.boards;
  if (b?.project_id) return `/projects/${b.project_id}?tab=tasks&card=${card.id}`;
  const slug = b?.group_id ? slugOf(b.group_id) : undefined;
  return slug ? `/g/${slug}?card=${card.id}` : `/board?card=${card.id}`;
}
```

(`cleanUrl("http://example.com/a")` → `URL.toString()` keeps the path; trailing slash on bare hosts is fine.)

- [ ] **Step 4:** run → PASS. **Step 5:** use `cardHref` in the 6 TS call sites (`my-tasks/page.tsx:88`, `today/page.tsx:61`, `(app)/page.tsx:86`, `camp/page.tsx:62`, `api/search/route.ts:36`, `lib/team-stats.ts:69`): add `project_id` to each query's `boards(...)` select and replace the inline ternary. `npx tsc --noEmit && npm test`. Commit.

---

### Task 3: Project pages + profile section (UI, 7 languages)

**Files:** create `dashboard/src/app/(app)/projects/[id]/page.tsx`, `dashboard/src/components/projects/{project-page.tsx, project-form.tsx, project-links.tsx, project-updates.tsx, project-files.tsx, project-money.tsx, my-projects.tsx}`; modify `src/lib/boards.ts` (`BoardRow.project_id`, `loadBoardById(id, memberIds?)`), `src/components/board/board.tsx` (rights: a project board is editable by everyone who can see it), `src/components/team/member-dashboard.tsx` (My Projects above Documents on own profile), `src/app/(app)/team/[id]/page.tsx` (load my projects), messages ×7 (`projects` namespace + `notifications.kinds.project_added/project_post`).

Behaviour:
- **page.tsx** (server): load project by id (RLS → 404 via `notFound()` when not visible or when visible only through Finance but not a member/leader: check `rpc("is_project_member", { p: id })`). Load members (profiles), money (`project_money`, `project_money_by_week`), board via `loadBoardById(project.board_id)` restricted to project members for assignees, links, updates (latest 50), files. Pass to `ProjectPage`. `?tab=` selects tab (overview|money|tasks|links|files|updates).
- **project-page.tsx** (client): header (colour dot, name, status chip, dates + days left, goal bar "€640 of €2,000", member avatars; leaders: Edit → `ProjectForm`, Delete with an in-page confirm that removes storage files then the project and redirects to the own profile). Tabs as pills; `Board` for tasks (with `viewer` and data).
- **project-form.tsx** (leaders): name, description, goal €, start, end, status, colour, people multi-select (checkbox list of active profiles). Create: insert project → insert board `{slug: 'project-'+id, name, project_id}` → lists To do / Doing / Done → members; update: patch + diff members. Errors → toast.
- **project-links.tsx**: form (title + URL, `cleanUrl`); list with icon per `linkKind` (lucide `FileText` doc, `Sheet` sheet, `Presentation` slides, `FolderOpen` drive, `ClipboardList` form, `Palette` canva, `NotebookText` notion, `Figma`/`PenTool` figma, `Link` other), opens `target=_blank rel=noopener noreferrer`; delete own (or leader).
- **project-updates.tsx**: textarea + Post; feed with avatar, name, relative time.
- **project-files.tsx**: like Documents drive but flat (no folders): upload ≤ 25 MB → row then storage `projects/<projectId>/<fileId>/<safeName>`; open via signed URL 300 s; delete own/leader.
- **project-money.tsx**: three tiles (revenue, costs, profit, `eur()`), bars of revenue by week; empty state text.
- **my-projects.tsx**: grid of cards linking to `/projects/<id>`; leaders get **New project** opening `ProjectForm`; empty state ("You're not in any project yet" / leaders: "Create the first project").
- All strings in `messages/*.json` (7 languages).

- [ ] Steps: write components → `npx tsc --noEmit && npx eslint src` → commit.

### Task 4: Docs, local browser check, live

- [ ] README systems row + decision row; CHANGELOG.
- [ ] Full checks (npm test, DB tests, tsc, eslint).
- [ ] Run 0027 on the live DB (local uses it). Browser: create a project with 2 people, add link/update/file/task, check profile cards, check a non-member can't open `/projects/<id>`, clean up test data **without notifying the team** (create the test project with only Alvaro as member so notifications only reach the creator — notify skips the actor).
- [ ] Show Alvaro; on "push it": merge, push, deploy.
