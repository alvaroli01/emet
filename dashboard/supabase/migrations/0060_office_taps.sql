-- Alvaro, 2026-11-11: office check-in by one tap on a notification instead of a phone app (OwnTracks removed).
-- 9:00 Mon–Fri "At the office? Tap to check in"; Mon/Wed/Fri also "Working outside" (note + location, re-confirmed every
-- 2 h, shown to everyone as a calendar); 18:00 reminder to check out. Check-out only counts at Dock (the server decides).

-- Working outside (Mon/Wed/Fri): one row per stretch. places = every confirmed position [{at, lat, lng, acc}].
create table public.office_outside (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  note         text not null check (char_length(note) between 1 and 200),
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  confirmed_at timestamptz not null default now(), -- last "still working outside" tap; unanswered → ends here
  asked_at     timestamptz,                         -- when emet last asked "still working outside?"
  places       jsonb not null default '[]',
  check (ended_at is null or ended_at >= started_at)
);
create unique index office_outside_one_open on public.office_outside (user_id) where ended_at is null;
create index office_outside_started on public.office_outside (started_at desc);
revoke insert, update, delete, truncate on public.office_outside from authenticated, anon; -- server-written only
grant select on public.office_outside to authenticated;
grant select, insert, update, delete on public.office_outside to service_role;
alter table public.office_outside enable row level security;
create policy office_outside_read on public.office_outside for select to authenticated using (public.is_member());

create or replace function public.push_worthy(p_kind text, p_data jsonb) returns boolean language sql immutable as $$
  select p_kind in ('assigned', 'team_task', 'due_soon', 'project_added', 'training_week', 'training_lead', 'strike', 'punishment',
                    'announcement', 'leader_message', 'late_fine', 'office_checkin', 'office_checkout', 'office_outside_check')
      or (p_kind = 'project_post' and p_data->>'what' = 'project_files')
$$;

-- Who gets the office notifications: class members (no coach, Ollin guests or the bot)
create or replace function public.office_people() returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles
  where active and user_id is not null and not is_guest and not is_coach and role_title is distinct from 'AI assistant'
$$;
revoke all on function public.office_people() from public, anon, authenticated;

-- Runs every 5 minutes (pg_cron). All times Spanish time, Monday–Friday.
create or replace function public.office_tick() returns void language plpgsql security definer set search_path = public as $$
declare
  local timestamp := now() at time zone 'Europe/Madrid';
  d text := to_char(local, 'YYYY-MM-DD');
  dow int := extract(isodow from local);
  hm text := to_char(local, 'HH24:MI');
  outside_day boolean := dow in (1, 3, 5);
begin
  -- Working-outside stretches: unanswered for 30 min after the question → they end at the last confirmed tap
  update office_outside set ended_at = confirmed_at
  where ended_at is null and asked_at is not null and asked_at > confirmed_at and now() - asked_at > interval '30 minutes';
  -- … and any still open at midnight end at their last tap
  update office_outside set ended_at = confirmed_at
  where ended_at is null and (confirmed_at at time zone 'Europe/Madrid')::date < local::date;
  if dow > 5 then return; end if;

  -- 9:00: everyone not already in or outside
  if hm >= '09:00' and hm < '09:05' then
    perform notify(array(select u from unnest(office_people()) u
                         where not exists (select 1 from office_visits v where v.user_id = u and v.left_at is null)
                           and not exists (select 1 from office_outside o where o.user_id = u and o.ended_at is null)),
                   'office_checkin', jsonb_build_object('outside', outside_day),
                   case when outside_day then '/office' else '/office?go=in' end, -- office days: the tap checks in straight away
                   null, 'office_checkin:' || d);
  end if;
  -- 18:00: still checked in → reminder to check out at Dock
  if hm >= '18:00' and hm < '18:05' then
    perform notify(array(select v.user_id from office_visits v where v.left_at is null and v.user_id = any(office_people())),
                   'office_checkout', '{}'::jsonb, '/office?go=out', null, 'office_checkout:' || d);
  end if;
  -- Every 2 h while working outside: "still working outside?" (one question per 2 h; stops once they check in at Dock)
  perform notify(array[o.user_id], 'office_outside_check', jsonb_build_object('title', o.note), '/office?go=still', null,
                 'office_outside_check:' || o.id || ':' || to_char(now(), 'YYYYMMDDHH24MI'))
  from office_outside o
  where o.ended_at is null and now() - o.confirmed_at >= interval '2 hours' and (o.asked_at is null or o.asked_at < o.confirmed_at);
  update office_outside set asked_at = now()
  where ended_at is null and now() - confirmed_at >= interval '2 hours' and (asked_at is null or asked_at < confirmed_at);
end $$;
revoke all on function public.office_tick() from public, anon, authenticated;

-- Team Leaders → Office: whose phone gets the notifications (phone alerts turned on)
drop function if exists public.office_setup_status();
create or replace function public.office_setup_status()
returns table (user_id uuid, has_push boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_leader() then raise exception 'emet: leaders only'; end if;
  return query
    select p.id, exists (select 1 from push_subscriptions s where s.user_id = p.id)
    from profiles p
    where p.active and not p.is_guest and not p.is_coach and p.role_title is distinct from 'AI assistant';
end $$;
revoke all on function public.office_setup_status() from public, anon;
grant execute on function public.office_setup_status() to authenticated;

create extension if not exists pg_cron with schema extensions;
select cron.schedule('office-tick', '*/5 * * * *', 'select public.office_tick()');
