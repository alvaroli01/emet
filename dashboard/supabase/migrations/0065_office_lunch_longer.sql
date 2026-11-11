-- Alvaro, 2026-11-11: back late from eating no longer makes the morning 0 h — the calendar just shows the longer lunch.
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
  -- Eating (max 1 h): 10 minutes before the end, a reminder. Late back just shows as a longer lunch (Alvaro, 2026-11-11)
  perform notify(array[v.user_id], 'office_lunch_end', jsonb_build_object('due', to_char(v.lunch_until at time zone 'Europe/Madrid', 'HH24:MI')),
                 '/office?go=in', null, 'office_lunch_end:' || v.id)
  from office_visits v
  where v.lunch_until is not null and now() >= v.lunch_until - interval '10 minutes' and now() < v.lunch_until
    and not exists (select 1 from office_visits n where n.user_id = v.user_id and n.arrived_at > v.left_at);
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
