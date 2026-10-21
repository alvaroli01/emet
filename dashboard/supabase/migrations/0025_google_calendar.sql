-- Google Calendar in emet: each member's own Google "Secret address in iCal format", encrypted by the server
-- (AES-256-GCM with AI_KEY_SECRET, like ai_keys). Only the owner can read or change it — admins included.
create table public.google_calendars (
  user_id    uuid primary key default public.my_profile_id() references public.profiles(id) on delete cascade,
  url_iv     text not null,
  url_data   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.google_calendars to authenticated;
alter table public.google_calendars enable row level security;
create policy google_calendars_own on public.google_calendars for all to authenticated
  using (user_id = (select public.my_profile_id())) with check (user_id = (select public.my_profile_id()));
