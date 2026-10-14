-- Base camp reminders ("personal dashboard 2"): private to their owner, like the rest of Base camp.
create table public.reminders (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  title      text not null check (length(title) between 1 and 200),
  remind_at  timestamptz not null,
  priority   text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
create index reminders_owner_idx on public.reminders (owner_id, remind_at);
grant select, insert, update, delete on public.reminders to authenticated;
alter table public.reminders enable row level security;
create policy reminders_own on public.reminders for all to authenticated
  using (owner_id = public.my_profile_id()) with check (owner_id = public.my_profile_id());
