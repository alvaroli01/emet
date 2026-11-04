-- Project invites: shareable links for Ollin team members; Customers: phone numbers from contacted leads

-- Project invites: generate unique invite links per project; Ollin members sign up with Google, join via link
create table public.project_invites (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  token        text not null unique default encode(gen_random_bytes(24), 'base64'),
  created_by   uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique(project_id, token)
);
create index on public.project_invites (project_id);
create index on public.project_invites (token);

-- Customers: store phone + name for contacts already talked to
create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 200),
  phone        text check (phone is null or char_length(btrim(phone)) between 1 and 20),
  added_by     uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.customers (project_id);
create trigger customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

-- Permissions
grant select, insert, update, delete on public.project_invites, public.customers to authenticated;
alter table public.project_invites enable row level security;
alter table public.customers enable row level security;

-- RLS: invites readable by project members + admins (for creating new ones)
create policy project_invites_read on public.project_invites for select to authenticated
  using (public.is_project_member(project_id) or public.is_admin());
create policy project_invites_insert on public.project_invites for insert to authenticated
  with check (public.is_project_member(project_id) or public.is_admin());
create policy project_invites_delete on public.project_invites for delete to authenticated
  using (public.is_project_member(project_id) or public.is_admin());

-- RLS: customers readable/writable by project members only
create policy customers_read on public.customers for select to authenticated
  using (public.is_project_member(project_id));
create policy customers_insert on public.customers for insert to authenticated
  with check (public.is_project_member(project_id) and added_by = public.my_profile_id());
create policy customers_update on public.customers for update to authenticated
  using (public.is_project_member(project_id) or public.is_admin())
  with check (public.is_project_member(project_id));
create policy customers_delete on public.customers for delete to authenticated
  using (public.is_project_member(project_id) or added_by = public.my_profile_id());
