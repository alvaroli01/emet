-- Alvaro, 2026-11-10: the first real walk to Dock sent positions but never checked in. To see why, keep the DISTANCE
-- of the last signal (metres from the office, rounded) — never the position itself. Shown in Team Leaders → Office.
alter table public.office_links add column if not exists last_distance_m integer;

drop function if exists public.office_setup_status();
create or replace function public.office_setup_status()
returns table (user_id uuid, has_link boolean, last_ping_at timestamptz, last_distance_m integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_leader() then raise exception 'emet: leaders only'; end if;
  return query
    select p.id, l.user_id is not null, l.last_ping_at, l.last_distance_m
    from profiles p left join office_links l on l.user_id = p.id
    where p.active and not p.is_guest and not p.is_coach and p.role_title is distinct from 'AI assistant';
end $$;
revoke all on function public.office_setup_status() from public, anon;
grant execute on function public.office_setup_status() to authenticated;
