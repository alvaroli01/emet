-- Points (Alvaro, 2026-10-27): each person tracks their Community Points, Customer Visits and Learning Points toward
-- 20 / 50 / 40 by 1 June 2027 (goals live in src/lib/points.ts). Everyone sees everyone's points; people log, fix and
-- delete only their own (admins can fix anyone's).
create table public.member_points (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('community', 'visit', 'learning')),
  amount      int not null default 1 check (amount between 1 and 100),
  happened_on date not null default (now() at time zone 'Europe/Madrid')::date,
  note        text check (note is null or char_length(note) <= 300),
  created_at  timestamptz not null default now()
);
create index member_points_user_idx on public.member_points (user_id, happened_on desc);
grant select, insert, update, delete on public.member_points to authenticated;
alter table public.member_points enable row level security;
create policy member_points_read on public.member_points for select to authenticated using (public.is_member());
create policy member_points_insert on public.member_points for insert to authenticated
  with check (user_id = (select public.my_profile_id()));
create policy member_points_update on public.member_points for update to authenticated
  using (user_id = (select public.my_profile_id()) or public.is_admin()) with check (user_id = (select public.my_profile_id()) or public.is_admin());
create policy member_points_delete on public.member_points for delete to authenticated
  using (user_id = (select public.my_profile_id()) or public.is_admin());
