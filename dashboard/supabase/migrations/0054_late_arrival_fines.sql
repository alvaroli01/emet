-- Alvaro, 2026-11-10: late arrivals on Tuesdays and Thursdays are charged automatically from the office check-in.
--   arrive 09:11:00–09:29:59 (Spanish time) → €3, no strike   (new kind 'late_fine': weight 0, fine 3)
--   arrive 09:30:00 or later                → €3 + 1 strike  (existing kind 'late_arrival': weight 1, fine 3)
-- Only the first arrival of that day counts (coming back from a break doesn't). Arrivals from 14:00 on are not
-- "late for the morning" and are ignored. Coach, Ollin guests and the bot are never charged. Leaders can delete a
-- wrong one in Team Leaders → Strikes (a phone can fire a minute or two late).

alter table public.strikes drop constraint if exists strikes_kind_check;
alter table public.strikes add constraint strikes_kind_check
  check (kind in ('late_tasks', 'sleeping', 'phone', 'late_arrival', 'late_fine', 'missed_validation', 'missed_customer_deadline'));
alter table public.strikes alter column weight set expression as
  (case when kind in ('missed_validation', 'missed_customer_deadline') then 3 when kind = 'late_fine' then 0 else 1 end);
alter table public.strikes alter column fine set expression as (case when kind in ('late_arrival', 'late_fine') then 3 else 0 end);

-- A fine alone is not a strike: tell the person with its own message (same trigger as before otherwise)
create or replace function public.trg_strikes_punish() returns trigger language plpgsql security definer set search_path = public as $$
declare r record; q date; total int; need int; have int;
begin
  r := coalesce(new, old);
  q := date_trunc('quarter', r.happened_on)::date;
  total := public.strike_total(r.user_id, r.happened_on);
  need := total / 3;
  select count(*) into have from strike_punishments where user_id = r.user_id and period_start = q;
  if tg_op = 'INSERT' then
    if new.kind = 'late_fine' then
      perform public.notify(array[new.user_id], 'late_fine', jsonb_build_object('reason', coalesce(substring(new.note from '\d\d:\d\d:\d\d'), '')), '/team/' || new.user_id, new.given_by);
    else
      perform public.notify(array[new.user_id], 'strike', jsonb_build_object('reason', new.kind, 'weight', new.weight, 'total', total), '/team/' || new.user_id, new.given_by);
    end if;
  end if;
  while have < need loop
    have := have + 1;
    insert into strike_punishments (user_id, period_start, number) values (r.user_id, q, have) on conflict do nothing;
    perform public.notify(array[r.user_id], 'punishment', jsonb_build_object('due', (now() at time zone 'Europe/Madrid')::date + 2, 'total', total), '/team/' || r.user_id, null, 'punishment:' || r.user_id || ':' || q || ':' || have);
  end loop;
  if have > need then
    delete from strike_punishments where user_id = r.user_id and period_start = q and number > need and done_at is null;
  end if;
  return null;
end $$;

create or replace function public.push_worthy(p_kind text, p_data jsonb) returns boolean language sql immutable as $$
  select p_kind in ('assigned', 'team_task', 'due_soon', 'project_added', 'training_week', 'training_lead', 'strike', 'punishment', 'announcement', 'leader_message', 'late_fine')
      or (p_kind = 'project_post' and p_data->>'what' = 'project_files')
$$;

-- The rule itself, on every new office visit (phone or button)
create or replace function public.trg_office_late() returns trigger language plpgsql security definer set search_path = public as $$
declare
  t time := (new.arrived_at at time zone 'Europe/Madrid')::time;
  d date := (new.arrived_at at time zone 'Europe/Madrid')::date;
begin
  if extract(isodow from d) not in (2, 4) or t < time '09:11:00' or t >= time '14:00:00' then return null; end if;
  if not exists (select 1 from profiles p where p.id = new.user_id and p.active and not p.is_coach and not p.is_guest
                 and p.role_title is distinct from 'AI assistant') then return null; end if;
  if exists (select 1 from office_visits v where v.user_id = new.user_id and v.id <> new.id and v.arrived_at <= new.arrived_at
             and (v.arrived_at at time zone 'Europe/Madrid')::date = d) then return null; end if; -- already arrived earlier today
  if exists (select 1 from strikes s where s.user_id = new.user_id and s.happened_on = d and s.kind in ('late_fine', 'late_arrival')) then return null; end if;
  insert into strikes (user_id, kind, happened_on, note, given_by)
  values (new.user_id, case when t >= time '09:30:00' then 'late_arrival' else 'late_fine' end, d,
          'Automatic: checked in at ' || to_char(t, 'HH24:MI:SS'), null);
  return null;
end $$;
create trigger office_late after insert on public.office_visits for each row execute function public.trg_office_late();
