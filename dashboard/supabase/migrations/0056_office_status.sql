-- Alvaro, 2026-11-10: leaders see who hasn't set up the phone check-in, or whose phone has gone quiet.
-- Every position the emet shortcut sends updates last_ping_at (the position itself is still never stored).

alter table public.office_links add column if not exists last_ping_at timestamptz;

-- Leaders only: one row per active class member — has a check-in link? when did their phone last report?
create or replace function public.office_setup_status()
returns table (user_id uuid, has_link boolean, last_ping_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_leader() then raise exception 'emet: leaders only'; end if;
  return query
    select p.id, l.user_id is not null, l.last_ping_at
    from profiles p left join office_links l on l.user_id = p.id
    where p.active and not p.is_guest and not p.is_coach and p.role_title is distinct from 'AI assistant';
end $$;
revoke all on function public.office_setup_status() from public, anon;
grant execute on function public.office_setup_status() to authenticated;
grant update on public.office_links to service_role;
