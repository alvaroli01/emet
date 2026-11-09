-- Alvaro, 2026-11-09: one "Tasks" page for everything (EMET tasks + every project's tasks).
-- Built on the existing cards/boards tables, so everything that already reads them (home, Today, KPIs, calendar feed,
-- search, reminders, the section assistant) keeps working. Additive only: nothing is dropped; team_tasks stays as it was.
--  1. Tasks get a priority, a "needs a file" flag and per-person completion (+ hand-in file) on each assignee.
--  2. Every shared board gets a "Blocked" column (status = the column: To do / Doing / Blocked / Done).
--  3. When every assignee has finished, the task moves to Done by itself (and back to Doing if someone un-ticks).
--  4. Project goals: a goal statement, target date and milestones per project.
--  5. Permissions: leaders/admins anywhere; members add tasks to their own projects and assign only people of that
--     project (EMET tasks: themselves or people of their own group; group boards: that group).
--  6. The leader's team tasks (team_tasks) are copied into cards, with who finished and their files. Originals kept.

-- ── 1. New task fields ───────────────────────────────────────
alter table public.cards add column if not exists priority text not null default 'medium' check (priority in ('high', 'medium', 'low'));
alter table public.cards add column if not exists needs_file boolean not null default false;
-- Where a copied leader task came from (also makes step 6 safe to run twice)
alter table public.cards add column if not exists team_task_id uuid unique references public.team_tasks(id) on delete set null;
alter table public.card_assignees add column if not exists done_at timestamptz;
alter table public.card_assignees add column if not exists file_path text;
alter table public.card_assignees add column if not exists file_name text check (char_length(file_name) <= 200);

-- ── 2. A "Blocked" column on every shared board (private "My board"s unchanged) ──
insert into public.board_lists (board_id, name, position)
select b.id, 'Blocked', d.position - 0.5
from public.boards b join public.board_lists d on d.board_id = b.id and lower(d.name) = 'done'
where b.owner_id is null
  and not exists (select 1 from public.board_lists l where l.board_id = b.id and lower(l.name) = 'blocked');

-- ── 3. Per-person completion ─────────────────────────────────
-- Only the person themself (or a leader) ticks their part or hands in their file; a needed file must exist first.
create or replace function public.trg_card_person_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.done_at is distinct from old.done_at or new.file_path is distinct from old.file_path)
     and new.user_id <> public.my_profile_id() and not public.is_leader() then
    raise exception 'emet: only that person can finish their part';
  end if;
  if new.user_id is distinct from old.user_id or new.card_id is distinct from old.card_id then
    raise exception 'emet: change who a task is for by removing and adding people';
  end if;
  if new.file_path is distinct from old.file_path and new.file_path is not null
     and (split_part(new.file_path, '/', 1) <> new.user_id::text
          or not exists (select 1 from storage.objects where bucket_id = 'task-files' and name = new.file_path)) then
    raise exception 'emet: file not found';
  end if;
  if new.done_at is not null and new.file_path is null and (select needs_file from public.cards where id = new.card_id) then
    raise exception 'emet: this task needs a file before it can be finished';
  end if;
  return new;
end $$;
drop trigger if exists card_person_guard on public.card_assignees;
create trigger card_person_guard before update on public.card_assignees for each row execute function public.trg_card_person_guard();

-- Assignees may always tick their own part, even where they can't edit the task itself
drop policy if exists assignees_tick on public.card_assignees;
create policy assignees_tick on public.card_assignees for update to authenticated
  using (user_id = (select public.my_profile_id())) with check (user_id = (select public.my_profile_id()));

-- Everyone finished → Done; someone un-ticks (or a new person joins) a Done task → Doing
create or replace function public.trg_card_people_done() returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid := coalesce(new.card_id, old.card_id); c record; all_done boolean; target uuid;
begin
  select id, board_id, list_id into c from public.cards where id = cid;
  if c.id is null or exists (select 1 from public.boards where id = c.board_id and owner_id is not null) then return null; end if;
  select bool_and(done_at is not null) into all_done from public.card_assignees where card_id = cid;
  if all_done then
    select id into target from public.board_lists where board_id = c.board_id and lower(name) = 'done' limit 1;
  elsif exists (select 1 from public.board_lists where id = c.list_id and lower(name) = 'done') then
    select id into target from public.board_lists where board_id = c.board_id and lower(name) = 'doing' limit 1;
  end if;
  if target is not null and target <> c.list_id then update public.cards set list_id = target where id = cid; end if;
  return null;
end $$;
drop trigger if exists card_people_done on public.card_assignees;
create trigger card_people_done after insert or delete or update of done_at on public.card_assignees
  for each row execute function public.trg_card_people_done();

-- ── 4. Project goals ─────────────────────────────────────────
create table if not exists public.project_goals (
  project_id  uuid primary key references public.projects(id) on delete cascade,
  statement   text not null default '' check (char_length(statement) <= 300),
  target_on   date,
  -- [{ "text": "Venue booked", "done": false }, …]
  milestones  jsonb not null default '[]' check (jsonb_typeof(milestones) = 'array' and jsonb_array_length(milestones) <= 20),
  updated_by  uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);
alter table public.project_goals enable row level security;
grant select, insert, update on public.project_goals to authenticated;
drop policy if exists project_goals_read on public.project_goals;
drop policy if exists project_goals_insert on public.project_goals;
drop policy if exists project_goals_update on public.project_goals;
create policy project_goals_read on public.project_goals for select to authenticated using (public.can_view_project(project_id));
create policy project_goals_insert on public.project_goals for insert to authenticated with check (public.is_project_member(project_id) or public.is_leader());
create policy project_goals_update on public.project_goals for update to authenticated
  using (public.is_project_member(project_id) or public.is_leader()) with check (public.is_project_member(project_id) or public.is_leader());
drop trigger if exists project_goals_updated on public.project_goals;
create trigger project_goals_updated before update on public.project_goals for each row execute function public.set_updated_at();

-- ── 5. Permissions ───────────────────────────────────────────
-- Adding tasks: project members on their project (was admins only), leaders on any shared board; rest unchanged
create or replace function public.can_add_card(p_board_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when b.owner_id is not null then b.owner_id = public.my_profile_id() and public.is_member()
                               when public.is_leader() then true
                               when b.project_id is not null then public.is_project_member(b.project_id) and public.is_member()
                               when b.group_id is null then public.is_member()
                               else public.can_edit_group(b.group_id) or public.is_coach() end
                   from public.boards b where b.id = p_board_id), false)
$$;
-- Editing a task: as before, plus leaders anywhere and the people it's assigned to (status, checklist)
create or replace function public.can_edit_card(p_card_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case
             when b.owner_id is not null then b.owner_id = public.my_profile_id() and public.is_member()
             when public.is_leader() then true
             when exists (select 1 from public.card_assignees a where a.card_id = c.id and a.user_id = public.my_profile_id()) then true
             when b.project_id is not null then public.is_project_member(b.project_id)
             when b.group_id is not null then public.can_edit_group(b.group_id) or (public.is_coach() and c.created_by = public.my_profile_id())
             else public.is_admin() or c.created_by = public.my_profile_id()
           end
      from public.cards c join public.boards b on b.id = c.board_id where c.id = p_card_id), false)
$$;
-- Who a task can go to: leaders/admins/coach anyone; others only themselves or people of that project / group
create or replace function public.can_assign(p_card_id uuid, p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_leader() or public.is_coach() or p_user = public.my_profile_id() or coalesce((
    select case when b.owner_id is not null then true -- private boards: assignees_only_owner decides
                when b.project_id is not null then exists (select 1 from public.project_members m where m.project_id = b.project_id and m.user_id = p_user)
                when b.group_id is not null then exists (select 1 from public.profiles p where p.id = p_user and p.group_id = b.group_id)
                else exists (select 1 from public.profiles p, public.profiles me
                             where p.id = p_user and me.id = public.my_profile_id() and me.group_id is not null and p.group_id = me.group_id) end
    from public.cards c join public.boards b on b.id = c.board_id where c.id = p_card_id), false)
$$;
grant execute on function public.can_assign(uuid, uuid) to authenticated;
drop policy if exists assignees_same_team on public.card_assignees;
create policy assignees_same_team on public.card_assignees as restrictive for insert to authenticated
  with check (public.can_assign(card_id, user_id));

-- Notifications open the task on the new page (private boards keep their old link)
create or replace function public.card_link(p_card uuid) returns text language sql stable security definer set search_path = public as $$
  select case when b.owner_id is not null then '/tasks?view=mine&card=' || c.id
              else '/tasks?task=' || c.id end
  from public.cards c join public.boards b on b.id = c.board_id
  where c.id = p_card
$$;

-- ── 6. Copy the leader's team tasks into cards (silently: no notifications, no activity spam) ──
alter table public.card_assignees disable trigger notify_assigned;
alter table public.card_assignees disable trigger card_people_done;
alter table public.cards disable trigger cards_activity;

with src as (
  select t.*, b.id as board_id,
         (select count(*) from public.team_task_people p where p.task_id = t.id) as total,
         (select count(done_at) from public.team_task_people p where p.task_id = t.id) as done
  from public.team_tasks t
  join public.boards b on b.owner_id is null and
       case when t.project_id is null then b.slug = 'general' else b.project_id = t.project_id end
  where not exists (select 1 from public.cards c where c.team_task_id = t.id)
)
insert into public.cards (board_id, list_id, title, description, due_at, position, created_by, created_at, needs_file, team_task_id)
select s.board_id,
       (select l.id from public.board_lists l where l.board_id = s.board_id and lower(l.name) =
          case when s.total > 0 and s.done = s.total then 'done' when s.done > 0 then 'doing' else 'to do' end limit 1),
       s.title, nullif(s.details, ''), case when s.due_on is not null then (s.due_on::text || 'T21:59:00Z')::timestamptz end,
       extract(epoch from s.created_at), s.created_by, s.created_at, s.needs_file, s.id
from src s;

insert into public.card_assignees (card_id, user_id, done_at, file_path, file_name)
select c.id, p.user_id, p.done_at, p.file_path, p.file_name
from public.team_task_people p join public.cards c on c.team_task_id = p.task_id
on conflict (card_id, user_id) do nothing;

-- Finished tasks: finished when the last person finished, not today
update public.cards c set completed_at = x.last
from (select card_id, max(done_at) as last from public.card_assignees group by card_id having bool_and(done_at is not null)) x
where c.id = x.card_id and c.team_task_id is not null and c.completed_at is not null;

alter table public.card_assignees enable trigger notify_assigned;
alter table public.card_assignees enable trigger card_people_done;
alter table public.cards enable trigger cards_activity;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'project_goals') then
    alter publication supabase_realtime add table public.project_goals;
  end if;
end $$;

-- ── 7. "Due tomorrow" reminder: cards only (leader tasks are cards now, so no double reminder),
--       and only people who haven't finished their part yet ──
create or replace function public.notify_due_tomorrow() returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record; tomorrow date := (now() at time zone 'Europe/Madrid')::date + 1;
begin
  for r in
    select c.id, c.title, array_agg(a.user_id) as users
    from cards c join card_assignees a on a.card_id = c.id
    where c.completed_at is null and a.done_at is null and (c.due_at at time zone 'Europe/Madrid')::date = tomorrow
    group by c.id, c.title
  loop
    perform public.notify(r.users, 'due_soon', jsonb_build_object('title', r.title), public.card_link(r.id), null, 'due:' || r.id || ':' || current_date);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.notify_due_tomorrow() from public, anon, authenticated;
grant execute on function public.notify_due_tomorrow() to service_role;
