-- 2026-11-12: Alvaro checked in late after a leader deleted his automatic €3, and the check-in fined him again.
-- A day the 9:11 check already handled (fined or forgiven) is never fined again by a late check-in.
create or replace function public.trg_office_late() returns trigger language plpgsql security definer set search_path = public as $$
declare
  t time := (new.arrived_at at time zone 'Europe/Madrid')::time;
  d date := (new.arrived_at at time zone 'Europe/Madrid')::date;
begin
  if extract(isodow from d) not in (2, 4) or t < time '09:11:00' or t >= time '14:00:00' then return null; end if;
  if not exists (select 1 from profiles p where p.id = new.user_id and p.active and not p.is_coach and not p.is_guest
                 and p.role_title is distinct from 'AI assistant') then return null; end if;
  if public.office_away(new.user_id, d) then return null; end if;
  -- The automatic 9:11 check already handled this day (fined, or the fine was deleted by a leader = forgiven): never again
  if exists (select 1 from office_auto_fines f where f.user_id = new.user_id and f.day = d) then return null; end if;
  if exists (select 1 from office_visits v where v.user_id = new.user_id and v.id <> new.id and v.arrived_at <= new.arrived_at
             and (v.arrived_at at time zone 'Europe/Madrid')::date = d) then return null; end if; -- already arrived earlier today
  if exists (select 1 from strikes s where s.user_id = new.user_id and s.happened_on = d and s.kind in ('late_fine', 'late_arrival')) then return null; end if;
  insert into strikes (user_id, kind, happened_on, note, given_by)
  values (new.user_id, case when t >= time '09:30:00' then 'late_arrival' else 'late_fine' end, d,
          'Automatic: checked in at ' || to_char(t, 'HH24:MI:SS'), null);
  return null;
end $$;
