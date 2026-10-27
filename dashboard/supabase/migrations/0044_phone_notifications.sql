-- Phone notifications (Alvaro, 2026-10-27): web push for new tasks, team-leader tasks, being added to a project, a new
-- file in one of your projects, and "only 1 day left" the day before a task is due. Each notification row that is worth a
-- push makes the database call /api/push (pg_net), which sends it to that person's phones with the web-push keys.
-- Free: pg_net + Vault on Supabase, web-push on Vercel. Set once by hand on the live database (not in git):
--   create extension if not exists pg_net with schema extensions;
--   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_secret');  -- never leaves the database
--   select vault.create_secret('https://emet-hq.vercel.app/api/push', 'push_url');
-- /api/push checks the secret with check_push_secret() instead of keeping a copy.

-- ── Phones ───────────────────────────────────────────────────
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  created_at  timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
grant select, delete on public.push_subscriptions to authenticated;
grant select, delete on public.push_subscriptions to service_role;
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions for select to authenticated using (user_id = (select public.my_profile_id()));
create policy push_subscriptions_remove on public.push_subscriptions for delete to authenticated using (user_id = (select public.my_profile_id()));

-- Save this phone for me. A shared device moves to whoever turned notifications on last.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_profile_id();
begin
  if me is null or not public.is_member() then raise exception 'emet: members only'; end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (me, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ── Which notifications go to the phone ──────────────────────
create or replace function public.push_worthy(p_kind text, p_data jsonb) returns boolean language sql immutable as $$
  select p_kind in ('assigned', 'team_task', 'due_soon', 'project_added') or (p_kind = 'project_post' and p_data->>'what' = 'project_files')
$$;

create or replace function public.trg_push_notification() returns trigger language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if not public.push_worthy(new.kind, new.data) then return new; end if;
  if not exists (select 1 from push_subscriptions where user_id = new.user_id) then return new; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return new; end if;  -- local tests
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_url';
  if v_secret is null or v_url is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('id', new.id),
                        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret));
  return new;
end $$;
create trigger push_notification after insert on public.notifications for each row execute function public.trg_push_notification();

-- The server asks the database whether a push call carries the right secret (only the server may ask)
create or replace function public.check_push_secret(p text) returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p is null or length(p) < 32 or not exists (select 1 from pg_namespace where nspname = 'vault') then return false; end if;
  return exists (select 1 from vault.decrypted_secrets where name = 'push_secret' and decrypted_secret = p);
end $$;
revoke all on function public.check_push_secret(text) from public, anon, authenticated;
grant execute on function public.check_push_secret(text) to service_role;

-- ── One day before: board tasks AND team-leader tasks ────────
create or replace function public.notify_due_tomorrow() returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record; tomorrow date := (now() at time zone 'Europe/Madrid')::date + 1;
begin
  for r in
    select c.id, c.title, array_agg(a.user_id) as users
    from cards c join card_assignees a on a.card_id = c.id
    where c.completed_at is null and (c.due_at at time zone 'Europe/Madrid')::date = tomorrow
    group by c.id, c.title
  loop
    perform public.notify(r.users, 'due_soon', jsonb_build_object('title', r.title), public.card_link(r.id), null, 'due:' || r.id || ':' || current_date);
    n := n + 1;
  end loop;
  for r in
    select t.id, t.title, array_agg(p.user_id) as users
    from team_tasks t join team_task_people p on p.task_id = t.id
    where p.done_at is null and t.due_on = tomorrow
    group by t.id, t.title
  loop
    perform public.notify(r.users, 'due_soon', jsonb_build_object('title', r.title), '/my-tasks#team-tasks', null, 'due:tt:' || r.id || ':' || current_date);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.notify_due_tomorrow() from public, anon, authenticated;
grant execute on function public.notify_due_tomorrow() to service_role;
