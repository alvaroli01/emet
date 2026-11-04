-- Ollin guests: people from the other LEINN team join one project through an invite link (/join/<token>).
-- A guest is a project member but NOT an emet member, so every is_member() rule keeps them out of the rest of emet.

alter table public.profiles add column if not exists is_guest boolean not null default false;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and active and not is_guest)
$$;

-- Guests may not make themselves full members (same guard as admin/coach/leader)
create or replace function public.guard_profile_self_edit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then return new; end if;
  if new.group_id   is distinct from old.group_id
  or new.role_title is distinct from old.role_title
  or new.is_admin   is distinct from old.is_admin
  or new.is_coach   is distinct from old.is_coach
  or new.is_leader  is distinct from old.is_leader
  or new.is_guest   is distinct from old.is_guest
  or new.email      is distinct from old.email
  or new.active     is distinct from old.active
  or new.user_id    is distinct from old.user_id then
    raise exception 'emet: only team leaders can change group, role, email, leader, coach, guest or admin status';
  end if;
  return new;
end $$;

-- Guests see their own profile and the people in their projects (members already see everyone)
create or replace function public.shares_project_with(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members a join public.project_members b on b.project_id = a.project_id
                 where a.user_id = public.my_profile_id() and b.user_id = p)
$$;
revoke execute on function public.shares_project_with(uuid) from public, anon;
grant execute on function public.shares_project_with(uuid) to authenticated;
drop policy if exists profiles_read_guest on public.profiles;
create policy profiles_read_guest on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_project_with(id));

-- Invite links: URL-safe tokens; only emet members of the project (or admins) make, see and delete them
alter table public.project_invites alter column token set default encode(gen_random_bytes(16), 'hex');
alter table public.project_invites drop constraint if exists project_invites_project_id_token_key;
drop index if exists public.idx_project_invites_token;
drop policy if exists project_invites_read on public.project_invites;
drop policy if exists project_invites_insert on public.project_invites;
drop policy if exists project_invites_delete on public.project_invites;
create policy project_invites_read on public.project_invites for select to authenticated using (public.is_member() and public.is_project_member(project_id));
create policy project_invites_insert on public.project_invites for insert to authenticated with check (public.is_member() and public.is_project_member(project_id));
create policy project_invites_delete on public.project_invites for delete to authenticated using (public.is_member() and public.is_project_member(project_id));

-- customers → project_customers, like the other project_* tables; any project member (guests too) keeps the list
do $$ begin
  if to_regclass('public.customers') is not null and to_regclass('public.project_customers') is null then
    alter table public.customers rename to project_customers;
  end if;
end $$;
alter table public.project_customers drop constraint if exists customers_phone_check;
alter table public.project_customers drop constraint if exists project_customers_phone_check;
alter table public.project_customers add constraint project_customers_phone_check check (phone is null or char_length(btrim(phone)) between 1 and 40);
alter index if exists public.idx_customers_project rename to project_customers_idx;
drop trigger if exists customers_updated on public.project_customers;
drop trigger if exists project_customers_updated on public.project_customers;
create trigger project_customers_updated before update on public.project_customers for each row execute function public.set_updated_at();
drop policy if exists customers_read on public.project_customers;
drop policy if exists customers_insert on public.project_customers;
drop policy if exists customers_update on public.project_customers;
drop policy if exists customers_delete on public.project_customers;
drop policy if exists project_customers_read on public.project_customers;
drop policy if exists project_customers_insert on public.project_customers;
drop policy if exists project_customers_update on public.project_customers;
drop policy if exists project_customers_delete on public.project_customers;
create policy project_customers_read on public.project_customers for select to authenticated using (public.is_project_member(project_id));
create policy project_customers_insert on public.project_customers for insert to authenticated with check (public.is_project_member(project_id) and added_by = public.my_profile_id());
create policy project_customers_update on public.project_customers for update to authenticated using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy project_customers_delete on public.project_customers for delete to authenticated using (public.is_project_member(project_id));
