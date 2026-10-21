-- My Projects: leaders create projects (the same projects Finance tags sales with) and add people; members share
-- links, files, updates and a private task board. Members + leaders see a project; Finance sees only the project rows.
alter table public.projects add column if not exists goal numeric(12,2) check (goal is null or goal >= 0);
alter table public.boards add column if not exists project_id uuid references public.projects(id) on delete cascade;
create unique index if not exists boards_project_idx on public.boards (project_id) where project_id is not null;

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  added_by   uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  added_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create table public.project_links (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  url        text not null check (url ~* '^https://[^\s]+$' and char_length(url) <= 2000),
  created_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.project_updates (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.project_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  size        bigint not null check (size between 0 and 26214400),
  mime        text not null default 'application/octet-stream',
  path        text not null unique,
  uploaded_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index project_links_idx on public.project_links (project_id);
create index project_updates_idx on public.project_updates (project_id, created_at desc);
create index project_files_idx on public.project_files (project_id);

create or replace function public.is_project_member(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.project_members m where m.project_id = p and m.user_id = public.my_profile_id())
$$;
create or replace function public.can_see_board(b uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when x.project_id is null then public.is_member() else public.is_project_member(x.project_id) end
                   from public.boards x where x.id = b), false)
$$;
grant execute on function public.is_project_member(uuid), public.can_see_board(uuid) to authenticated;

-- Boards/cards: project boards are edited by their members; team and general boards unchanged
create or replace function public.can_edit_board(p_board_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when b.project_id is not null then public.is_project_member(b.project_id)
                               when b.group_id is null then public.is_admin()
                               else public.can_edit_group(b.group_id) end
                   from public.boards b where b.id = p_board_id), false)
$$;
create or replace function public.can_add_card(p_board_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when b.project_id is not null then public.is_project_member(b.project_id)
                               when b.group_id is null then public.is_member()
                               else public.can_edit_group(b.group_id) end
                   from public.boards b where b.id = p_board_id), false)
$$;
create or replace function public.can_edit_card(p_card_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case
             when b.project_id is not null then public.is_project_member(b.project_id)
             when b.group_id is not null then public.can_edit_group(b.group_id)
             else public.is_admin() or c.created_by = public.my_profile_id()
                  or exists (select 1 from public.card_assignees a where a.card_id = c.id and a.user_id = public.my_profile_id())
           end
      from public.cards c join public.boards b on b.id = c.board_id where c.id = p_card_id), false)
$$;
create or replace function public.card_link(p_card uuid) returns text language sql stable security definer set search_path = public as $$
  select case when b.project_id is not null then '/projects/' || b.project_id || '?tab=tasks&card=' || c.id
              else coalesce('/g/' || g.slug, '/board') || '?card=' || c.id end
  from public.cards c join public.boards b on b.id = c.board_id left join public.groups g on g.id = b.group_id
  where c.id = p_card
$$;

-- Read rules: project boards and everything on them only for the project's members
drop policy if exists boards_read on public.boards;
-- Uses the row's own project_id (a lookup by id can't see a board inserted in the same statement, e.g. insert … returning)
create policy boards_read on public.boards for select to authenticated
  using (case when project_id is null then public.is_member() else public.is_project_member(project_id) end);
drop policy if exists boards_insert on public.boards;
create policy boards_insert on public.boards for insert to authenticated with check (public.is_admin());
drop policy if exists lists_read on public.board_lists;
create policy lists_read on public.board_lists for select to authenticated using (public.can_see_board(board_id));
drop policy if exists cards_read on public.cards;
create policy cards_read on public.cards for select to authenticated using (public.can_see_board(board_id));
drop policy if exists assignees_read on public.card_assignees;
create policy assignees_read on public.card_assignees for select to authenticated
  using (public.can_see_board((select board_id from public.cards c where c.id = card_id)));
drop policy if exists checklist_read on public.card_checklist_items;
create policy checklist_read on public.card_checklist_items for select to authenticated
  using (public.can_see_board((select board_id from public.cards c where c.id = card_id)));
drop policy if exists comments_read on public.card_comments;
create policy comments_read on public.card_comments for select to authenticated
  using (public.can_see_board((select board_id from public.cards c where c.id = card_id)));
drop policy if exists comments_insert on public.card_comments;
create policy comments_insert on public.card_comments for insert to authenticated
  with check (public.can_see_board((select board_id from public.cards c where c.id = card_id)) and author_id = public.my_profile_id());

-- Activity feed: never log what happens on a project board (titles would reach everyone)
create or replace function public.trg_activity_skip_projects() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.entity = 'cards' and exists (select 1 from public.cards c join public.boards b on b.id = c.board_id where c.id = new.entity_id and b.project_id is not null) then return null; end if;
  if new.entity = 'card_comments' and exists (select 1 from public.card_comments m join public.cards c on c.id = m.card_id join public.boards b on b.id = c.board_id where m.id = new.entity_id and b.project_id is not null) then return null; end if;
  if new.entity in ('board_lists', 'boards') and exists (select 1 from public.boards b where b.project_id is not null and (b.id = new.entity_id or b.id = (select board_id from public.board_lists where id = new.entity_id))) then return null; end if;
  return new;
end $$;
create trigger activity_skip_projects before insert on public.activity_log for each row execute function public.trg_activity_skip_projects();

-- Projects: leaders create/change/delete; members + leaders + Finance read
grant select, insert, update, delete on public.projects to authenticated;
drop policy if exists projects_read on public.projects;
drop policy if exists projects_write on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;
create policy projects_read on public.projects for select to authenticated using (public.is_finance() or public.is_project_member(id));
create policy projects_insert on public.projects for insert to authenticated with check (public.is_admin());
create policy projects_update on public.projects for update to authenticated using (public.is_admin() or public.is_finance()) with check (public.is_admin() or public.is_finance());
create policy projects_delete on public.projects for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.project_members, public.project_links, public.project_updates, public.project_files to authenticated;
alter table public.project_members enable row level security;
alter table public.project_links enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_files enable row level security;
create policy project_members_read on public.project_members for select to authenticated using (public.is_project_member(project_id));
create policy project_members_insert on public.project_members for insert to authenticated with check (public.is_admin());
create policy project_members_delete on public.project_members for delete to authenticated using (public.is_admin());
do $$ declare t text; c text; begin
  foreach t in array array['project_links', 'project_updates', 'project_files'] loop
    c := case t when 'project_files' then 'uploaded_by' else 'created_by' end;
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (public.is_project_member(project_id))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_project_member(project_id) and %2$s = public.my_profile_id())', t, c);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (%2$s = public.my_profile_id() or public.is_admin()) with check (public.is_project_member(project_id))', t, c);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (%2$s = public.my_profile_id() or public.is_admin())', t, c);
  end loop;
end $$;

-- Money: what Finance tagged to this project (members, leaders and Finance only)
create or replace function public.project_money(p uuid)
returns table (revenue numeric, costs numeric, profit numeric) language sql stable security definer set search_path = public as $$
  with r as (select coalesce(sum(amount), 0) v from public.sales where project_id = p),
       c as (select coalesce(sum(amount), 0) v from public.expenses where project_id = p)
  select r.v, c.v, r.v - c.v from r, c where public.is_project_member(p) or public.is_finance()
$$;
create or replace function public.project_money_by_week(p uuid)
returns table (week date, revenue numeric) language sql stable security definer set search_path = public as $$
  select date_trunc('week', date)::date, sum(amount) from public.sales
  where project_id = p and (public.is_project_member(p) or public.is_finance())
  group by 1 order by 1
$$;
grant execute on function public.project_money(uuid), public.project_money_by_week(uuid) to authenticated;

-- Notifications
create or replace function public.trg_notify_project_member() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(array[new.user_id], 'project_added',
    jsonb_build_object('project', (select name from public.projects where id = new.project_id)), '/projects/' || new.project_id, new.added_by);
  return new;
end $$;
create trigger notify_project_member after insert on public.project_members for each row execute function public.trg_notify_project_member();
create or replace function public.trg_notify_project_post() returns trigger language plpgsql security definer set search_path = public as $$
declare who uuid := coalesce(to_jsonb(new)->>'created_by', to_jsonb(new)->>'uploaded_by')::uuid;
begin
  perform public.notify(array(select user_id from public.project_members where project_id = new.project_id), 'project_post',
    jsonb_build_object('project', (select name from public.projects where id = new.project_id),
                       'what', tg_table_name, 'title', coalesce(to_jsonb(new)->>'title', to_jsonb(new)->>'name', left(to_jsonb(new)->>'body', 80))),
    '/projects/' || new.project_id, who);
  return new;
end $$;
create trigger notify_project_link after insert on public.project_links for each row execute function public.trg_notify_project_post();
create trigger notify_project_update after insert on public.project_updates for each row execute function public.trg_notify_project_post();
create trigger notify_project_file after insert on public.project_files for each row execute function public.trg_notify_project_post();

-- Storage: private "projects" bucket, <project id>/<file id>/<name>
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit) values ('projects', 'projects', false, 26214400) on conflict (id) do nothing;
    create policy projects_files_read on storage.objects for select to authenticated
      using (case when bucket_id = 'projects' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then public.is_project_member(((storage.foldername(name))[1])::uuid) else false end);
    create policy projects_files_insert on storage.objects for insert to authenticated
      with check (case when bucket_id = 'projects' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then public.is_project_member(((storage.foldername(name))[1])::uuid) else false end);
    create policy projects_files_delete on storage.objects for delete to authenticated
      using (case when bucket_id = 'projects' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then public.is_project_member(((storage.foldername(name))[1])::uuid) else false end);
  end if;
end $$;
