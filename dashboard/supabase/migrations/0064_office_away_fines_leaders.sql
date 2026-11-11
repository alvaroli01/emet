-- Alvaro, 2026-11-11:
-- 1. Tuesday/Thursday: not checked in at all by 9:11 → €3 automatically (+ alert); still not in at 9:30 → €3 + 1 strike.
-- 2. Away (trip, sick…): leaders set a person away from one day to another with a reason. Away people get no office
--    notifications and are never fined; everyone sees it. 3. Leaders can check anyone in/out, at a chosen time.
create table public.office_absences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  from_day   date not null,
  to_day     date not null,
  reason     text not null check (char_length(reason) between 1 and 120),
  created_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (to_day >= from_day)
);
create index office_absences_days on public.office_absences (to_day, from_day);
grant select, insert, update, delete on public.office_absences to authenticated;
grant select on public.office_absences to service_role;
alter table public.office_absences enable row level security;
create policy office_absences_read on public.office_absences for select to authenticated using (public.is_member());
create policy office_absences_write on public.office_absences for all to authenticated using (public.is_leader()) with check (public.is_leader());

create or replace function public.office_away(p_user uuid, p_day date) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from office_absences a where a.user_id = p_user and p_day between a.from_day and a.to_day)
$$;
revoke all on function public.office_away(uuid, date) from public, anon;
grant execute on function public.office_away(uuid, date) to authenticated;

-- Which automatic Tuesday/Thursday steps already ran for a person that day ('fine' at 9:11, 'strike' at 9:30)
create table public.office_auto_fines (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null,
  step    text not null check (step in ('fine', 'strike')),
  primary key (user_id, day, step)
);
revoke all on public.office_auto_fines from authenticated, anon;
grant select, insert, delete on public.office_auto_fines to service_role;
alter table public.office_auto_fines enable row level security; -- only the security-definer office_tick() writes it

-- Class members who are not away today (Spanish date): they get the check-in notifications and the automatic fines
create or replace function public.office_people_today() returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(u), '{}') from unnest(public.office_people()) u
  where not public.office_away(u, (now() at time zone 'Europe/Madrid')::date)
$$;
revoke all on function public.office_people_today() from public, anon, authenticated;

-- Late check-ins are not charged to people who are away that day
create or replace function public.trg_office_late() returns trigger language plpgsql security definer set search_path = public as $$
declare
  t time := (new.arrived_at at time zone 'Europe/Madrid')::time;
  d date := (new.arrived_at at time zone 'Europe/Madrid')::date;
begin
  if extract(isodow from d) not in (2, 4) or t < time '09:11:00' or t >= time '14:00:00' then return null; end if;
  if not exists (select 1 from profiles p where p.id = new.user_id and p.active and not p.is_coach and not p.is_guest
                 and p.role_title is distinct from 'AI assistant') then return null; end if;
  if public.office_away(new.user_id, d) then return null; end if;
  if exists (select 1 from office_visits v where v.user_id = new.user_id and v.id <> new.id and v.arrived_at <= new.arrived_at
             and (v.arrived_at at time zone 'Europe/Madrid')::date = d) then return null; end if; -- already arrived earlier today
  if exists (select 1 from strikes s where s.user_id = new.user_id and s.happened_on = d and s.kind in ('late_fine', 'late_arrival')) then return null; end if;
  insert into strikes (user_id, kind, happened_on, note, given_by)
  values (new.user_id, case when t >= time '09:30:00' then 'late_arrival' else 'late_fine' end, d,
          'Automatic: checked in at ' || to_char(t, 'HH24:MI:SS'), null);
  return null;
end $$;

-- Team Leaders → Office: check someone in or out by hand, now or at a chosen time (same day, Spanish time).
-- 'out' closes their open stretch, or fixes today's last stretch that was closed as 0 h.
create or replace function public.office_leader_set(p_user uuid, p_action text, p_time time default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_at timestamptz := coalesce(((now() at time zone 'Europe/Madrid')::date + p_time) at time zone 'Europe/Madrid', now()); -- "09:05" today, Spanish time
  v_open office_visits;
  v_last office_visits;
begin
  if not public.is_leader() then raise exception 'emet: leaders only'; end if;
  if v_at > now() + interval '1 minute' then raise exception 'emet: that time is in the future'; end if;
  select * into v_open from office_visits where user_id = p_user and left_at is null;
  if p_action = 'in' then
    if v_open.id is not null then raise exception 'emet: already checked in'; end if;
    if exists (select 1 from office_visits where user_id = p_user and left_at > v_at and arrived_at < v_at) then raise exception 'emet: overlaps another stretch'; end if;
    insert into office_visits (user_id, arrived_at, source) values (p_user, v_at, 'manual');
  elsif p_action = 'out' then
    if v_open.id is not null then
      if v_at < v_open.arrived_at then raise exception 'emet: check-out is before check-in'; end if;
      update office_visits set left_at = v_at, forgot = false, lunch_until = null where id = v_open.id;
    else
      select * into v_last from office_visits where user_id = p_user and forgot
        and (arrived_at at time zone 'Europe/Madrid')::date = (v_at at time zone 'Europe/Madrid')::date
      order by arrived_at desc limit 1;
      if v_last.id is null then raise exception 'emet: not checked in'; end if;
      if v_at < v_last.arrived_at then raise exception 'emet: check-out is before check-in'; end if;
      update office_visits set left_at = v_at, forgot = false, lunch_until = null where id = v_last.id;
    end if;
  else raise exception 'emet: unknown action';
  end if;
end $$;
revoke all on function public.office_leader_set(uuid, text, time) from public, anon;
grant execute on function public.office_leader_set(uuid, text, time) to authenticated;

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
  -- 21:00: the day closes (Alvaro, 2026-11-11). Still checked in = never checked out → that stretch counts 0 h;
  -- working outside ends at the last tap. Everything shows in the team calendar on Today.
  update office_visits set left_at = greatest(arrived_at, now()), forgot = true
  where left_at is null and (hm >= '21:00' or (arrived_at at time zone 'Europe/Madrid')::date < local::date);
  update office_outside set ended_at = confirmed_at
  where ended_at is null and (hm >= '21:00' or (confirmed_at at time zone 'Europe/Madrid')::date < local::date);
  -- Eating (max 1 h): 10 minutes before the end, a reminder; not back at Dock by the end → that stretch counts 0 h
  perform notify(array[v.user_id], 'office_lunch_end', jsonb_build_object('due', to_char(v.lunch_until at time zone 'Europe/Madrid', 'HH24:MI')),
                 '/office?go=in', null, 'office_lunch_end:' || v.id)
  from office_visits v
  where v.lunch_until is not null and now() >= v.lunch_until - interval '10 minutes' and now() < v.lunch_until
    and not exists (select 1 from office_visits n where n.user_id = v.user_id and n.arrived_at > v.left_at);
  update office_visits v set forgot = true, lunch_until = null
  where v.lunch_until is not null and now() >= v.lunch_until
    and not exists (select 1 from office_visits n where n.user_id = v.user_id and n.arrived_at > v.left_at and n.arrived_at <= v.lunch_until);
  update office_visits v set lunch_until = null -- back in time: the break is over, the stretch keeps its hours
  where v.lunch_until is not null and exists (select 1 from office_visits n where n.user_id = v.user_id and n.arrived_at > v.left_at and n.arrived_at <= v.lunch_until);
  if dow > 5 then return; end if;

  -- 9:00: everyone not already in or outside
  if hm >= '09:00' and hm < '09:05' then
    perform notify(array(select u from unnest(office_people_today()) u
                         where not exists (select 1 from office_visits v where v.user_id = u and v.left_at is null)
                           and not exists (select 1 from office_outside o where o.user_id = u and o.ended_at is null)),
                   'office_checkin', jsonb_build_object('outside', outside_day),
                   '/office?go=in', -- the tap checks in straight away at Dock; elsewhere (Mon/Wed/Fri) it offers working outside
                   null, 'office_checkin:' || d);
  end if;
  -- Tuesday/Thursday, not checked in at all: 9:11 → €3 (late_fine, with a bell + phone alert); 9:30 → €3 + 1 strike
  -- (late_arrival replaces the €3). Each step runs once per person per day (office_auto_fines), so a fine a leader
  -- deleted is never added again. Away people, coach, guests and the bot are never charged.
  if dow in (2, 4) and hm >= '09:11' and hm < '14:00' then
    with due as (
      select u from unnest(office_people_today()) u
      where not exists (select 1 from office_visits v where v.user_id = u and (v.arrived_at at time zone 'Europe/Madrid')::date = local::date)
        and not exists (select 1 from office_auto_fines f where f.user_id = u and f.day = local::date)
        and not exists (select 1 from strikes s where s.user_id = u and s.happened_on = local::date and s.kind in ('late_fine', 'late_arrival'))),
    mark as (insert into office_auto_fines (user_id, day, step) select u, local::date, 'fine' from due returning user_id)
    insert into strikes (user_id, kind, happened_on, note, given_by)
    select user_id, 'late_fine', local::date, 'Automatic: not checked in by 09:11:00', null from mark;
    if hm >= '09:30' then -- still not in at 9:30: the automatic €3 becomes €3 + 1 strike
      with due as (
        select u from unnest(office_people_today()) u
        where not exists (select 1 from office_visits v where v.user_id = u and (v.arrived_at at time zone 'Europe/Madrid')::date = local::date)
          and not exists (select 1 from office_auto_fines f where f.user_id = u and f.day = local::date and f.step = 'strike')),
      mark as (insert into office_auto_fines (user_id, day, step) select u, local::date, 'strike' from due returning user_id),
      gone as (
        delete from strikes s using mark m
        where s.user_id = m.user_id and s.happened_on = local::date and s.kind = 'late_fine' and s.note = 'Automatic: not checked in by 09:11:00'
        returning s.user_id)
      insert into strikes (user_id, kind, happened_on, note, given_by)
      select user_id, 'late_arrival', local::date, 'Automatic: not checked in by 09:30:00', null from gone;
    end if;
  end if;
  -- 14:00: still checked in → "still at the office? If you've left, check out. Going to eat? (max 1 h)"
  if hm >= '14:00' and hm < '14:05' then
    perform notify(array(select v.user_id from office_visits v where v.left_at is null and v.user_id = any(office_people_today())),
                   'office_midday', jsonb_build_object('late', false), '/office', null, 'office_midday:' || d);
  end if;
  -- 17:00: asked again (Alvaro, 2026-11-11) — "still at Dock? If you've left, check out"
  if hm >= '17:00' and hm < '17:05' then
    perform notify(array(select v.user_id from office_visits v where v.left_at is null and v.user_id = any(office_people_today())),
                   'office_midday', jsonb_build_object('late', true), '/office', null, 'office_afternoon:' || d);
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

-- Every minute, so 9:11 and 9:30 are on time (each step runs once: notifications are deduplicated, fines checked)
select cron.alter_job((select jobid from cron.job where jobname = 'office-tick'), schedule := '* * * * *');
