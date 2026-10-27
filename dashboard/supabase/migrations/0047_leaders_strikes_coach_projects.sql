-- Alvaro, 2026-10-28:
-- 1. Leaders: the group leaders (Rocco, Mario, Nahuel, Stefan) + admins/Team Leader group use the Team Leaders tools —
--    strikes, giving tasks, training leaders. NOT full admin (projects, documents and people stay with admins).
-- 2. Strikes: 1 for normal (more than 3 late tasks, sleeping in class, repeated phone warnings, arriving 10+ min late —
--    that one also costs €3, paid or not), 3 for big (missing a validation, missing a customer deadline). Every 3 strikes
--    in a quarter = a punishment: bring €75 from selling water within 2 days of being told. Resets every 3 months
--    (calendar quarters). Leaders give strikes and mark payments; everyone can see them.
-- 3. Coach: sees every project and what people work on (read only).

-- ── 1. Leaders ───────────────────────────────────────────────
alter table public.profiles add column if not exists is_leader boolean not null default false;
create or replace function public.is_leader() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.profiles where user_id = auth.uid() and active and is_leader)
$$;
grant execute on function public.is_leader() to authenticated;

-- Only admins change who is a leader (same guard as admin/coach)
create or replace function public.guard_profile_self_edit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then return new; end if;
  if new.group_id   is distinct from old.group_id
  or new.role_title is distinct from old.role_title
  or new.is_admin   is distinct from old.is_admin
  or new.is_coach   is distinct from old.is_coach
  or new.is_leader  is distinct from old.is_leader
  or new.email      is distinct from old.email
  or new.active     is distinct from old.active
  or new.user_id    is distinct from old.user_id then
    raise exception 'emet: only team leaders can change group, role, email, leader, coach or admin status';
  end if;
  return new;
end $$;

drop policy if exists team_tasks_leader_insert on public.team_tasks;
drop policy if exists team_tasks_leader_update on public.team_tasks;
drop policy if exists team_tasks_leader_delete on public.team_tasks;
create policy team_tasks_leader_insert on public.team_tasks for insert to authenticated with check (public.is_leader());
create policy team_tasks_leader_update on public.team_tasks for update to authenticated using (public.is_leader()) with check (public.is_leader());
create policy team_tasks_leader_delete on public.team_tasks for delete to authenticated using (public.is_leader());
drop policy if exists team_task_people_leader_insert on public.team_task_people;
drop policy if exists team_task_people_leader_delete on public.team_task_people;
create policy team_task_people_leader_insert on public.team_task_people for insert to authenticated with check (public.is_leader());
create policy team_task_people_leader_delete on public.team_task_people for delete to authenticated using (public.is_leader());
drop policy if exists training_leaders_insert on public.training_leaders;
drop policy if exists training_leaders_update on public.training_leaders;
drop policy if exists training_leaders_delete on public.training_leaders;
create policy training_leaders_insert on public.training_leaders for insert to authenticated with check (public.is_leader());
create policy training_leaders_update on public.training_leaders for update to authenticated using (public.is_leader()) with check (public.is_leader());
create policy training_leaders_delete on public.training_leaders for delete to authenticated using (public.is_leader());

-- ── 2. Strikes ───────────────────────────────────────────────
create table public.strikes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('late_tasks', 'sleeping', 'phone', 'late_arrival', 'missed_validation', 'missed_customer_deadline')),
  weight      int generated always as (case when kind in ('missed_validation', 'missed_customer_deadline') then 3 else 1 end) stored,
  fine        numeric(6,2) generated always as (case when kind = 'late_arrival' then 3 else 0 end) stored,
  paid_at     timestamptz,
  happened_on date not null default (now() at time zone 'Europe/Madrid')::date,
  note        text check (note is null or char_length(note) <= 300),
  given_by    uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index strikes_user_idx on public.strikes (user_id, happened_on desc);
grant select, insert, update, delete on public.strikes to authenticated;
alter table public.strikes enable row level security;
create policy strikes_read on public.strikes for select to authenticated using (public.is_member());
create policy strikes_insert on public.strikes for insert to authenticated with check (public.is_leader());
create policy strikes_update on public.strikes for update to authenticated using (public.is_leader()) with check (public.is_leader());
create policy strikes_delete on public.strikes for delete to authenticated using (public.is_leader());

create table public.strike_punishments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,               -- the quarter it belongs to
  number       int not null check (number >= 1),   -- 1st, 2nd… in that quarter
  told_on      date not null default (now() at time zone 'Europe/Madrid')::date,
  due_on       date generated always as (told_on + 2) stored,
  done_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, period_start, number)
);
grant select, update, delete on public.strike_punishments to authenticated;
alter table public.strike_punishments enable row level security;
create policy strike_punishments_read on public.strike_punishments for select to authenticated using (public.is_member());
create policy strike_punishments_update on public.strike_punishments for update to authenticated using (public.is_leader()) with check (public.is_leader());
create policy strike_punishments_delete on public.strike_punishments for delete to authenticated using (public.is_leader());

-- Strikes a person has in the quarter of a given day (resets every 3 months)
create or replace function public.strike_total(p_user uuid, p_day date default (now() at time zone 'Europe/Madrid')::date) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(weight), 0)::int from strikes
  where user_id = p_user and date_trunc('quarter', happened_on) = date_trunc('quarter', p_day)
$$;
grant execute on function public.strike_total(uuid, date) to authenticated;

-- After any change: as many punishments in that quarter as whole groups of 3 strikes; tell the person
create or replace function public.trg_strikes_punish() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; q date; total int; need int; have int;
begin
  r := coalesce(new, old);
  q := date_trunc('quarter', r.happened_on)::date;
  total := public.strike_total(r.user_id, r.happened_on);
  need := total / 3;
  select count(*) into have from strike_punishments where user_id = r.user_id and period_start = q;
  if tg_op = 'INSERT' then
    perform public.notify(array[new.user_id], 'strike', jsonb_build_object('reason', new.kind, 'weight', new.weight, 'total', total), '/team/' || new.user_id, new.given_by);
  end if;
  while have < need loop
    have := have + 1;
    insert into strike_punishments (user_id, period_start, number) values (r.user_id, q, have) on conflict do nothing;
    perform public.notify(array[r.user_id], 'punishment', jsonb_build_object('due', (now() at time zone 'Europe/Madrid')::date + 2, 'total', total), '/team/' || r.user_id, null, 'punishment:' || r.user_id || ':' || q || ':' || have);
  end loop;
  if have > need then  -- a strike was removed: drop the newest punishments not yet done
    delete from strike_punishments where user_id = r.user_id and period_start = q and number > need and done_at is null;
  end if;
  return null;
end $$;
create trigger strikes_punish after insert or delete or update of kind, happened_on on public.strikes for each row execute function public.trg_strikes_punish();

create or replace function public.push_worthy(p_kind text, p_data jsonb) returns boolean language sql immutable as $$
  select p_kind in ('assigned', 'team_task', 'due_soon', 'project_added', 'training_week', 'training_lead', 'strike', 'punishment', 'announcement')
      or (p_kind = 'project_post' and p_data->>'what' = 'project_files')
$$;

-- ── 3. Coach sees every project (read only: write rules keep using is_project_member) ──
create or replace function public.can_view_project(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_project_member(p) or public.is_coach()
$$;
grant execute on function public.can_view_project(uuid) to authenticated;

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated using (public.is_finance() or public.can_view_project(id));
drop policy if exists project_members_read on public.project_members;
create policy project_members_read on public.project_members for select to authenticated using (public.can_view_project(project_id));
do $$ declare t text; begin
  foreach t in array array['project_links', 'project_updates', 'project_files'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (public.can_view_project(project_id))', t);
  end loop;
end $$;
drop policy if exists team_tasks_read on public.team_tasks;
create policy team_tasks_read on public.team_tasks for select to authenticated
  using (case when project_id is null then public.is_member() else public.can_view_project(project_id) end);
drop policy if exists team_task_people_read on public.team_task_people;
create policy team_task_people_read on public.team_task_people for select to authenticated
  using (exists (select 1 from public.team_tasks t where t.id = task_id
                 and case when t.project_id is null then public.is_member() else public.can_view_project(t.project_id) end));
-- Project boards (tasks, columns, checklists, comments) read through can_see_board
create or replace function public.can_see_board(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when x.owner_id is not null then x.owner_id = public.my_profile_id() and public.is_member()
                               when x.project_id is null then public.is_member() else public.can_view_project(x.project_id) end
                   from public.boards x where x.id = b), false)
$$;
drop policy if exists boards_read on public.boards;
create policy boards_read on public.boards for select to authenticated
  using (case when owner_id is not null then owner_id = (select public.my_profile_id())
              when project_id is null then public.is_member() else public.can_view_project(project_id) end);

-- Mark the current group leaders (they have a "… leader" title)
update public.profiles set is_leader = true where active and role_title ilike '%leader%';
