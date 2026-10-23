-- Subscriptions (Alvaro, 2026-10-23): repeating costs (every N weeks / months / years) that book themselves as
-- expenses every day via the daily job, so nobody has to log in to add them. Deleting a subscription stops future
-- charges; the expenses already booked stay in the books (ledgers are never hard-deleted).
-- Task files (same day): a team task can need a file (photo, PDF, anything) before a person can tick it off.

-- ── Subscriptions ────────────────────────────────────────────
create table public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 80),
  amount         numeric(12,2) not null check (amount > 0),
  every          int not null default 1 check (every between 1 and 52),
  unit           text not null default 'month' check (unit in ('week', 'month', 'year')),
  starts_on      date not null default (now() at time zone 'Europe/Madrid')::date,
  charges        int not null default 0 check (charges >= 0),
  -- Counted from the first date (not the last charge), so a charge on the 31st doesn't drift to the 28th forever
  next_charge_on date generated always as ((starts_on + make_interval(
                   weeks  => case when unit = 'week' then every * charges else 0 end,
                   months => case unit when 'month' then every * charges when 'year' then 12 * every * charges else 0 end))::date) stored,
  category       text not null default 'tools',
  payment_method text check (payment_method in ('cash', 'bizum', 'card', 'transfer', 'other')),
  project_id     uuid references public.projects(id) on delete set null,
  created_by     uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index subscriptions_next_idx on public.subscriptions (next_charge_on);
create index subscriptions_project_idx on public.subscriptions (project_id);
grant select, insert, update, delete on public.subscriptions to authenticated;
grant select, update on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy subscriptions_read on public.subscriptions for select to authenticated using (public.is_member());
create policy subscriptions_insert on public.subscriptions for insert to authenticated with check (public.is_finance());
create policy subscriptions_update on public.subscriptions for update to authenticated using (public.is_finance()) with check (public.is_finance());
create policy subscriptions_delete on public.subscriptions for delete to authenticated using (public.is_finance());

-- No foreign key on purpose: deleting a subscription must not touch its booked expenses (closed months can't change)
alter table public.expenses add column if not exists subscription_id uuid;
create index if not exists expenses_subscription_idx on public.expenses (subscription_id) where subscription_id is not null;

-- Daily (cron): book every charge that is due, catching up on missed days. A charge whose day is in a closed month
-- is booked today instead.
create or replace function public.run_subscriptions() returns int language plpgsql security definer set search_path = public as $$
declare r record; today date := (now() at time zone 'Europe/Madrid')::date; n int := 0; guard int;
begin
  for r in select id from subscriptions where next_charge_on <= today for update skip locked loop
    guard := 0;
    loop
      select * into r from subscriptions where id = r.id;
      exit when r.next_charge_on > today or guard >= 400;
      begin
        insert into expenses (date, description, category, amount, payment_method, project_id, logged_by, subscription_id)
        values (r.next_charge_on, r.name, r.category, r.amount, r.payment_method, r.project_id, r.created_by, r.id);
      exception when raise_exception then
        insert into expenses (date, description, category, amount, payment_method, project_id, logged_by, subscription_id, reason)
        values (today, r.name, r.category, r.amount, r.payment_method, r.project_id, r.created_by, r.id, 'due ' || r.next_charge_on || ' (closed month)');
      end;
      update subscriptions set charges = charges + 1 where id = r.id;
      n := n + 1; guard := guard + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.run_subscriptions() from public, anon, authenticated;
grant execute on function public.run_subscriptions() to service_role;

-- Finance can book due charges right away (e.g. a subscription added today); everyone else gets 0
create or replace function public.charge_subscriptions_now() returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_finance() then return 0; end if;
  return public.run_subscriptions();
end $$;
revoke all on function public.charge_subscriptions_now() from public, anon;
grant execute on function public.charge_subscriptions_now() to authenticated;

-- ── Team tasks that need a file ──────────────────────────────
alter table public.team_tasks add column if not exists needs_file boolean not null default false;
alter table public.team_task_people
  add column if not exists file_path text,
  add column if not exists file_name text check (file_name is null or char_length(file_name) <= 200);
-- needs_file is set when the task is given; people may only add their own file and tick
grant update (file_path, file_name) on public.team_task_people to authenticated;

create or replace function public.trg_task_file_check() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.file_path is distinct from old.file_path and new.file_path is not null and (
       split_part(new.file_path, '/', 1) <> new.user_id::text
       or not exists (select 1 from storage.objects where bucket_id = 'task-files' and name = new.file_path)) then
    raise exception 'emet: upload the file to your own folder first';
  end if;
  if new.done_at is not null and new.file_path is null and (select needs_file from team_tasks where id = new.task_id) then
    raise exception 'emet: this task needs a file before it can be finished';
  end if;
  return new;
end $$;
create trigger team_task_people_file before update on public.team_task_people for each row execute function public.trg_task_file_check();

-- Private bucket: task-files/<person's profile id>/<task id>/<file>. The person and leaders/admins can open it.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('task-files', 'task-files', false, 10485760, null)
    on conflict (id) do nothing;
    drop policy if exists task_files_upload on storage.objects;
    drop policy if exists task_files_read on storage.objects;
    create policy task_files_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'task-files' and (storage.foldername(name))[1] = (select public.my_profile_id())::text);
    create policy task_files_read on storage.objects for select to authenticated
      using (bucket_id = 'task-files' and ((storage.foldername(name))[1] = (select public.my_profile_id())::text or public.is_admin()));
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
end $$;
