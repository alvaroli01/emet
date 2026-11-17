-- Alvaro, 2026-11-17: a break (lunch / "I'll be back") that reaches 2 h 30 m ends it: the person is checked out at the
-- moment they left, so only the hours before the break count and they no longer show as eating. Coming back later is a new check-in.
create or replace function public.office_lunch_end() returns void language plpgsql security definer set search_path = public as $$
begin
  update office_visits v set lunch_until = null
  where v.lunch_until is not null and v.left_at is not null and now() - v.left_at >= interval '2 hours 30 minutes'
    and not exists (select 1 from office_visits n where n.user_id = v.user_id and n.arrived_at > v.left_at);
end $$;
revoke all on function public.office_lunch_end() from public, anon, authenticated;
select cron.schedule('office-lunch-end', '* * * * *', 'select public.office_lunch_end()');
