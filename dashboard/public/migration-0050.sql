-- Migration 0050: Project Invites & Customers
-- Copy and paste this into Supabase SQL Editor → Execute

create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'base64'),
  created_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(project_id, token)
);
create index if not exists idx_project_invites_project on public.project_invites (project_id);
create index if not exists idx_project_invites_token on public.project_invites (token);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  phone text check (phone is null or char_length(btrim(phone)) between 1 and 20),
  added_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_project on public.customers (project_id);
drop trigger if exists customers_updated on public.customers;
create trigger customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.project_invites, public.customers to authenticated;
alter table public.project_invites enable row level security;
alter table public.customers enable row level security;

drop policy if exists project_invites_read on public.project_invites;
create policy project_invites_read on public.project_invites for select to authenticated
  using (public.is_project_member(project_id) or public.is_admin());
drop policy if exists project_invites_insert on public.project_invites;
create policy project_invites_insert on public.project_invites for insert to authenticated
  with check (public.is_project_member(project_id) or public.is_admin());
drop policy if exists project_invites_delete on public.project_invites;
create policy project_invites_delete on public.project_invites for delete to authenticated
  using (public.is_project_member(project_id) or public.is_admin());

drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers for select to authenticated
  using (public.is_project_member(project_id));
drop policy if exists customers_insert on public.customers;
create policy customers_insert on public.customers for insert to authenticated
  with check (public.is_project_member(project_id) and added_by = public.my_profile_id());
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers for update to authenticated
  using (public.is_project_member(project_id) or public.is_admin())
  with check (public.is_project_member(project_id));
drop policy if exists customers_delete on public.customers;
create policy customers_delete on public.customers for delete to authenticated
  using (public.is_project_member(project_id) or added_by = public.my_profile_id());
