-- Team page + member page: how much each person did per day (from the activity log), already added up in the
-- database so the page never hits the 1,000-row read limit. Runs as the caller, so the normal read rules apply
-- (members only; a deactivated member gets nothing).
create or replace function public.team_activity(since timestamptz)
returns table (user_id uuid, day date, group_id uuid, n bigint)
language sql stable security invoker set search_path = ''
as $$
  select a.user_id, (a.created_at at time zone 'Europe/Madrid')::date, a.group_id, count(*)
  from public.activity_log a
  where a.created_at >= since and a.user_id is not null
  group by 1, 2, 3
$$;
revoke execute on function public.team_activity(timestamptz) from public, anon;
grant execute on function public.team_activity(timestamptz) to authenticated;
