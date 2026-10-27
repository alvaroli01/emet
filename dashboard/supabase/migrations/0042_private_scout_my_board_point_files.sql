-- Alvaro, 2026-10-27:
-- 1. Points can carry a file (e.g. the post-mortem of a community activity).
-- 2. Scout projects are private to whoever made them until they share them (existing ones stay shared). Leads saved to a
--    team project are visible to that project's people. Places themselves stay a shared cache.
-- 3. Save several Scout leads to a project at once.
-- 4. My board: each person's own task board in My Tasks that nobody else can see — not even admins — and that never
--    reaches the activity feed, notifications to others or team numbers.

-- ── 1. Point files ───────────────────────────────────────────
alter table public.member_points
  add column if not exists file_path text check (file_path is null or split_part(file_path, '/', 1) = user_id::text),
  add column if not exists file_name text check (file_name is null or char_length(file_name) <= 200);
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('point-files', 'point-files', false, 10485760, null) on conflict (id) do nothing;
    drop policy if exists point_files_upload on storage.objects;
    drop policy if exists point_files_read on storage.objects;
    drop policy if exists point_files_delete on storage.objects;
    create policy point_files_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'point-files' and (storage.foldername(name))[1] = (select public.my_profile_id())::text);
    create policy point_files_read on storage.objects for select to authenticated
      using (bucket_id = 'point-files' and public.is_member());
    create policy point_files_delete on storage.objects for delete to authenticated
      using (bucket_id = 'point-files' and (storage.foldername(name))[1] = (select public.my_profile_id())::text);
  end if;
end $$;

-- ── 2. Private Scout projects ────────────────────────────────
alter table public.scout_projects add column if not exists shared boolean not null default false;
update public.scout_projects set shared = true;  -- everything made before today stays visible to the team

create or replace function public.can_see_scout(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member() and exists (select 1 from public.scout_projects s where s.id = p and (s.shared or s.created_by = public.my_profile_id()))
$$;
-- Change: your own projects; the selling teams also every SHARED project
create or replace function public.can_scout_project(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member() and exists (select 1 from public.scout_projects s where s.id = p
    and (s.created_by = public.my_profile_id() or (s.shared and public.can_scout())))
$$;
grant execute on function public.can_see_scout(uuid) to authenticated;

drop policy if exists scout_projects_read on public.scout_projects;
create policy scout_projects_read on public.scout_projects for select to authenticated
  using (public.is_member() and (shared or created_by = (select public.my_profile_id())));
drop policy if exists scout_projects_insert on public.scout_projects;
create policy scout_projects_insert on public.scout_projects for insert to authenticated
  with check (public.is_member() and created_by = (select public.my_profile_id()));
drop policy if exists scout_searches_read on public.scout_searches;
create policy scout_searches_read on public.scout_searches for select to authenticated using (public.can_see_scout(project_id));
drop policy if exists scout_leads_read on public.scout_leads;
create policy scout_leads_read on public.scout_leads for select to authenticated
  using (public.can_see_scout(project_id) or (saved_project_id is not null and public.is_project_member(saved_project_id)));

-- ── 3. Several leads → one project ───────────────────────────
create or replace function public.save_leads_to_project(p_leads uuid[], p uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_project_member(p) then raise exception 'emet: you are not in that project'; end if;
  if exists (select 1 from scout_leads l where l.id = any(p_leads) and not public.can_scout_project(l.project_id)) then
    raise exception 'emet: you can only add leads from your own (or, for selling teams, shared) Scout projects';
  end if;
  update scout_leads set saved_project_id = p where id = any(p_leads);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.save_leads_to_project(uuid[], uuid) from public, anon;
grant execute on function public.save_leads_to_project(uuid[], uuid) to authenticated;

-- ── 4. My board ──────────────────────────────────────────────
alter table public.boards add column if not exists owner_id uuid references public.profiles(id) on delete cascade;
create unique index if not exists boards_owner_idx on public.boards (owner_id) where owner_id is not null;

create or replace function public.can_see_board(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when x.owner_id is not null then x.owner_id = public.my_profile_id() and public.is_member()
                               when x.project_id is null then public.is_member() else public.is_project_member(x.project_id) end
                   from public.boards x where x.id = b), false)
$$;
create or replace function public.can_edit_board(p_board_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when b.owner_id is not null then b.owner_id = public.my_profile_id() and public.is_member()
                               when b.project_id is not null then public.is_admin()
                               when b.group_id is null then public.is_admin()
                               else public.can_edit_group(b.group_id) end
                   from public.boards b where b.id = p_board_id), false)
$$;
create or replace function public.can_add_card(p_board_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when b.owner_id is not null then b.owner_id = public.my_profile_id() and public.is_member()
                               when b.project_id is not null then public.is_admin()
                               when b.group_id is null then public.is_member()
                               else public.can_edit_group(b.group_id) or public.is_coach() end
                   from public.boards b where b.id = p_board_id), false)
$$;
create or replace function public.can_edit_card(p_card_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case
             when b.owner_id is not null then b.owner_id = public.my_profile_id() and public.is_member()
             when b.project_id is not null then public.is_project_member(b.project_id)
             when b.group_id is not null then public.can_edit_group(b.group_id) or (public.is_coach() and c.created_by = public.my_profile_id())
             else public.is_admin() or c.created_by = public.my_profile_id()
                  or exists (select 1 from public.card_assignees a where a.card_id = c.id and a.user_id = public.my_profile_id())
           end
      from public.cards c join public.boards b on b.id = c.board_id where c.id = p_card_id), false)
$$;
drop policy if exists boards_read on public.boards;
create policy boards_read on public.boards for select to authenticated
  using (case when owner_id is not null then owner_id = (select public.my_profile_id())
              when project_id is null then public.is_member() else public.is_project_member(project_id) end);

-- On my board only I can be assigned (assigning someone would send them the title)
create policy assignees_only_owner on public.card_assignees as restrictive for insert to authenticated
  with check (coalesce((select b.owner_id from public.cards c join public.boards b on b.id = c.board_id where c.id = card_id), user_id) = user_id);

-- Activity feed: never log what happens on a project board or someone's own board (titles would reach everyone)
create or replace function public.trg_activity_skip_projects() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.entity = 'cards' and exists (select 1 from public.cards c join public.boards b on b.id = c.board_id where c.id = new.entity_id and (b.project_id is not null or b.owner_id is not null)) then return null; end if;
  if new.entity = 'card_comments' and exists (select 1 from public.card_comments m join public.cards c on c.id = m.card_id join public.boards b on b.id = c.board_id where m.id = new.entity_id and (b.project_id is not null or b.owner_id is not null)) then return null; end if;
  if new.entity in ('board_lists', 'boards') and exists (select 1 from public.boards b where (b.project_id is not null or b.owner_id is not null) and (b.id = new.entity_id or b.id = (select board_id from public.board_lists where id = new.entity_id))) then return null; end if;
  return new;
end $$;

-- My board, made on first use with To do / Doing / Done
create or replace function public.my_board() returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := public.my_profile_id(); b uuid;
begin
  if me is null or not public.is_member() then return null; end if;
  select id into b from boards where owner_id = me;
  if b is not null then return b; end if;
  insert into boards (slug, name, owner_id) values ('me-' || me, 'My board', me) on conflict do nothing returning id into b;
  if b is null then select id into b from boards where owner_id = me; return b; end if;
  insert into board_lists (board_id, name, position) values (b, 'To do', 1), (b, 'Doing', 2), (b, 'Done', 3);
  return b;
end $$;
revoke all on function public.my_board() from public, anon;
grant execute on function public.my_board() to authenticated;
