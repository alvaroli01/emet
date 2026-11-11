-- Alvaro, 2026-11-11: at 14:00 everyone still checked in is asked "still at the office? If you've left, check out.
-- Going to eat?" Eating (tapped at Dock) stops the time for at most 1 hour: back at Dock in time = the stretch before
-- counts; not back = it counts 0 h (same as leaving without checking out). Reminder 10 minutes before the end.
alter table public.office_visits add column if not exists lunch_until timestamptz;

create or replace function public.push_worthy(p_kind text, p_data jsonb) returns boolean language sql immutable as $$
  select p_kind in ('assigned', 'team_task', 'due_soon', 'project_added', 'training_week', 'training_lead', 'strike', 'punishment',
                    'announcement', 'leader_message', 'late_fine', 'office_checkin', 'office_checkout', 'office_outside_check',
                    'office_midday', 'office_lunch_end')
      or (p_kind = 'project_post' and p_data->>'what' = 'project_files')
$$;

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
    perform notify(array(select u from unnest(office_people()) u
                         where not exists (select 1 from office_visits v where v.user_id = u and v.left_at is null)
                           and not exists (select 1 from office_outside o where o.user_id = u and o.ended_at is null)),
                   'office_checkin', jsonb_build_object('outside', outside_day),
                   case when outside_day then '/office' else '/office?go=in' end, -- office days: the tap checks in straight away
                   null, 'office_checkin:' || d);
  end if;
  -- 14:00: still checked in → "still at the office? If you've left, check out. Going to eat? (max 1 h)"
  if hm >= '14:00' and hm < '14:05' then
    perform notify(array(select v.user_id from office_visits v where v.left_at is null and v.user_id = any(office_people())),
                   'office_midday', '{}'::jsonb, '/office', null, 'office_midday:' || d);
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
