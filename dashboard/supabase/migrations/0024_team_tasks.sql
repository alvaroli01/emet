-- Team tasks: the team leader gives a task to everyone, several people or themself. Each person ticks it off on
-- their own; everyone can see who has finished and who hasn't. Each person gets a notification when it is given.
create table public.team_tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  details     text not null default '' check (char_length(details) <= 2000),
  due_on      date,
  created_by  uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create table public.team_task_people (
  task_id  uuid not null references public.team_tasks(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  done_at  timestamptz,
  primary key (task_id, user_id)
);
create index team_task_people_user_idx on public.team_task_people (user_id);

alter table public.team_tasks enable row level security;
alter table public.team_task_people enable row level security;
grant select, insert, delete on public.team_tasks to authenticated;
grant update (title, details, due_on) on public.team_tasks to authenticated;
grant select, insert, delete on public.team_task_people to authenticated;
-- People may only change the tick (done_at) — never who the task belongs to
grant update (done_at) on public.team_task_people to authenticated;

create policy team_tasks_read on public.team_tasks for select to authenticated using (public.is_member());
create policy team_tasks_leader_insert on public.team_tasks for insert to authenticated with check (public.is_admin());
create policy team_tasks_leader_update on public.team_tasks for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy team_tasks_leader_delete on public.team_tasks for delete to authenticated using (public.is_admin());

create policy team_task_people_read on public.team_task_people for select to authenticated using (public.is_member());
create policy team_task_people_leader_insert on public.team_task_people for insert to authenticated with check (public.is_admin());
create policy team_task_people_leader_delete on public.team_task_people for delete to authenticated using (public.is_admin());
create policy team_task_people_tick on public.team_task_people for update to authenticated
  using (user_id = (select public.my_profile_id()) or public.is_admin())
  with check (user_id = (select public.my_profile_id()) or public.is_admin());

-- Notification for each person who gets the task (not for the leader giving it to themself)
create or replace function public.trg_notify_team_task() returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select title, created_by into t from public.team_tasks where id = new.task_id;
  if new.user_id is distinct from t.created_by then
    perform public.notify(array[new.user_id], 'team_task', jsonb_build_object('title', t.title), '/my-tasks#team-tasks', t.created_by);
  end if;
  return new;
end $$;
create trigger notify_team_task after insert on public.team_task_people for each row execute function public.trg_notify_team_task();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.team_tasks, public.team_task_people;
  end if;
end $$;
