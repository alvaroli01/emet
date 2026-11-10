-- Alvaro, 2026-11-10: automatic office check-in. Each member's phone (iPhone Shortcuts / Android MacroDroid automation,
-- "arrive at / leave the office") calls their private link /api/office/<token>; emet logs the arrival and departure
-- (shown in Spanish time) and counts the hours. It works with the dashboard closed and on mobile data. emet only gets
-- "arrived" / "left", never a location. A Check in / Check out button on Today is the fallback.
-- Visits are written only by the server (service role), so nobody can edit their own hours from the browser.

create table public.office_links (
  user_id    uuid primary key default public.my_profile_id() references public.profiles(id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.office_links to authenticated;
grant select on public.office_links to service_role;
alter table public.office_links enable row level security;
create policy office_links_own on public.office_links for all to authenticated
  using (user_id = (select public.my_profile_id())) with check (user_id = (select public.my_profile_id()));

create table public.office_visits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  arrived_at timestamptz not null default now(),
  left_at    timestamptz,
  source     text not null default 'phone' check (source in ('phone', 'manual')),
  forgot     boolean not null default false, -- never checked out; counts 0 hours
  check (left_at is null or left_at >= arrived_at)
);
create unique index office_visits_one_open on public.office_visits (user_id) where left_at is null;
create index office_visits_arrived on public.office_visits (arrived_at desc);
revoke insert, update, delete, truncate on public.office_visits from authenticated, anon; -- server-written only (Supabase default privileges grant them)
grant select on public.office_visits to authenticated;
grant select, insert, update, delete on public.office_visits to service_role;
alter table public.office_visits enable row level security;
create policy office_visits_read on public.office_visits for select to authenticated using (public.is_member());

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.office_visits;
  end if;
end $$;

-- ── Leader messages (Alvaro, 2026-11-10) ─────────────────────
-- Team Leader section → "Send a notification": a leader writes a short message to everyone, one team or chosen people.
-- It lands in their bell and, like every push-worthy kind, on their phone.
create or replace function public.push_worthy(p_kind text, p_data jsonb) returns boolean language sql immutable as $$
  select p_kind in ('assigned', 'team_task', 'due_soon', 'project_added', 'training_week', 'training_lead', 'strike', 'punishment', 'announcement', 'leader_message')
      or (p_kind = 'project_post' and p_data->>'what' = 'project_files')
$$;

create or replace function public.leader_send(p_users uuid[], p_text text) returns integer
language plpgsql security definer set search_path = public as $$
declare v_me uuid := public.my_profile_id(); v_name text; v_n integer;
begin
  if not public.is_leader() then raise exception 'emet: only leaders can send team notifications'; end if;
  p_text := btrim(coalesce(p_text, ''));
  if char_length(p_text) not between 1 and 300 then raise exception 'emet: the message must be 1–300 characters'; end if;
  if coalesce(cardinality(p_users), 0) = 0 then raise exception 'emet: choose who gets it'; end if;
  select split_part(full_name, ' ', 1) into v_name from public.profiles where id = v_me;
  perform public.notify(p_users, 'leader_message', jsonb_build_object('title', p_text, 'name', v_name), '/today', v_me);
  select count(*) into v_n from unnest(p_users) u
  where u is distinct from v_me and exists (select 1 from public.profiles p where p.id = u and p.active and p.user_id is not null);
  return v_n;
end $$;
revoke all on function public.leader_send(uuid[], text) from public, anon;
grant execute on function public.leader_send(uuid[], text) to authenticated;
