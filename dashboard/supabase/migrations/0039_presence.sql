-- Presence (Alvaro, 2026-10-27): the Team page's "last active" only counted changes to 16 logged tables, so someone
-- who used emet every day without touching those (subscriptions, projects, team tasks…) looked away for days.
-- Opening emet now records the moment (at most once every few minutes), and "last active" uses the newer of the two.
create table public.presence (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
grant select on public.presence to authenticated;
alter table public.presence enable row level security;
create policy presence_read on public.presence for select to authenticated using (public.is_member());
-- No insert/update policies: people record only their own visit, through touch_presence()

create or replace function public.touch_presence() returns void language sql security definer set search_path = public as $$
  insert into presence (user_id, last_seen_at)
  select p.id, now() from profiles p where p.user_id = auth.uid() and p.active
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at
    where presence.last_seen_at < now() - interval '5 minutes'
$$;
revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;
