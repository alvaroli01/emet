-- Alvaro, 2026-11-10: where the office is, so emet itself decides "within 30 m = in, 150 m away = out".
-- iPhone automations can't use a zone smaller than ~100 m, so the emet shortcut wakes up there and sends the phone's
-- position every 15 s; the server compares it with this point. The position is used for that check and never stored.
-- An admin sets it once on Today (At the office → Set office location here), standing in the office.

create table public.office_place (
  id         boolean primary key default true check (id),  -- one row only
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  set_by     uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.office_place to authenticated;
grant select on public.office_place to service_role;
alter table public.office_place enable row level security;
create policy office_place_read on public.office_place for select to authenticated using (public.is_member());
create policy office_place_admin on public.office_place for all to authenticated using (public.is_admin()) with check (public.is_admin());
