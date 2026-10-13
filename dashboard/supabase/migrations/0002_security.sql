-- emet HQ — login linking + permissions (Row Level Security)
--
-- Rules (from docs/dashboard-build-prompt.md):
--   • Every logged-in member can VIEW everything (except individual morale comments).
--   • A member can EDIT only their own group's data and board, plus their own cards on the general board.
--   • Team Leader group (and anyone with is_admin) = admin: can edit everything.
--   • Enforced here in the database, not only in the UI.

-- ─────────────────────────────────────────────────────────────
-- 1. Link a new login to its pre-created profile (invite-only)
-- ─────────────────────────────────────────────────────────────
-- When Supabase creates an auth user (invite, magic link…), attach it to the
-- profile with the same email. If no profile has that email, the login is refused:
-- nobody can get in unless an admin added them first.
create or replace function public.link_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set user_id = new.id
   where lower(email) = lower(new.email)
     and active;
  if not found then
    raise exception 'emet: % is not on the team list. Ask a team leader to invite you.', new.email;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_auth_user();

-- ─────────────────────────────────────────────────────────────
-- 2. Permission helpers (security definer so RLS policies can call them cheaply)
-- ─────────────────────────────────────────────────────────────
create or replace function public.my_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid() and active
$$;

create or replace function public.my_group_id()
returns uuid language sql stable security definer set search_path = public as $$
  select group_id from public.profiles where user_id = auth.uid() and active
$$;

create or replace function public.group_id_of(p_slug text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.groups where slug = p_slug
$$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and active)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.profiles p
      left join public.groups g on g.id = p.group_id
     where p.user_id = auth.uid()
       and p.active
       and (p.is_admin or g.slug = 'team-leader')
  )
$$;

create or replace function public.can_edit_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (p_group_id is not null and p_group_id = public.my_group_id())
$$;

-- Boards: group board → that group; general board (group_id null) → admins only
-- (used for lists and board settings; cards on the general board have their own rule below)
create or replace function public.can_edit_board(p_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when b.group_id is null then public.is_admin()
                else public.can_edit_group(b.group_id) end
      from public.boards b where b.id = p_board_id
  ), false)
$$;

-- Cards: group board → that group; general board → admins, the card's creator, or an assignee
create or replace function public.can_edit_card(p_card_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
             when b.group_id is not null then public.can_edit_group(b.group_id)
             else public.is_admin()
                  or c.created_by = public.my_profile_id()
                  or exists (select 1 from public.card_assignees a
                              where a.card_id = c.id and a.user_id = public.my_profile_id())
           end
      from public.cards c join public.boards b on b.id = c.board_id
     where c.id = p_card_id
  ), false)
$$;

-- Who may create a card on a board: group board → that group; general board → every member
create or replace function public.can_add_card(p_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when b.group_id is null then public.is_member()
                else public.can_edit_group(b.group_id) end
      from public.boards b where b.id = p_board_id
  ), false)
$$;

-- ─────────────────────────────────────────────────────────────
-- 3. Grants (Supabase gives these by default; repeated so a fresh DB matches)
-- ─────────────────────────────────────────────────────────────
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;   -- logged-out visitors see nothing
grant execute on all functions in schema public to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Turn RLS on everywhere
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5. Policies
-- ─────────────────────────────────────────────────────────────

-- groups: everyone reads, admins edit
create policy groups_read  on public.groups for select to authenticated using (public.is_member());
create policy groups_write on public.groups for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles: everyone reads; admins add/edit/remove; members edit their own name/photo/language only
create policy profiles_read on public.profiles for select to authenticated using (public.is_member());
create policy profiles_admin on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy profiles_self on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Stop non-admins changing their own group, role, admin flag, email or status
create or replace function public.guard_profile_self_edit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then   -- admins, or server-side jobs
    return new;
  end if;
  if new.group_id   is distinct from old.group_id
  or new.role_title is distinct from old.role_title
  or new.is_admin   is distinct from old.is_admin
  or new.email      is distinct from old.email
  or new.active     is distinct from old.active
  or new.user_id    is distinct from old.user_id then
    raise exception 'emet: only team leaders can change group, role, email or admin status';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_self_edit();

-- boards: everyone reads; admins create/delete; group (or admins) edit their board's settings
create policy boards_read   on public.boards for select to authenticated using (public.is_member());
create policy boards_insert on public.boards for insert to authenticated with check (public.is_admin());
create policy boards_update on public.boards for update to authenticated
  using (public.can_edit_board(id)) with check (public.can_edit_board(id));
create policy boards_delete on public.boards for delete to authenticated using (public.is_admin());

-- board lists
create policy lists_read  on public.board_lists for select to authenticated using (public.is_member());
create policy lists_write on public.board_lists for all to authenticated
  using (public.can_edit_board(board_id)) with check (public.can_edit_board(board_id));

-- cards
create policy cards_read   on public.cards for select to authenticated using (public.is_member());
create policy cards_insert on public.cards for insert to authenticated
  with check (public.can_add_card(board_id) and created_by = public.my_profile_id()
              -- the list must belong to the same board
              and exists (select 1 from public.board_lists l where l.id = cards.list_id and l.board_id = cards.board_id));
create policy cards_update on public.cards for update to authenticated
  using (public.can_edit_card(id))
  with check (public.can_add_card(board_id)
              and exists (select 1 from public.board_lists l where l.id = cards.list_id and l.board_id = cards.board_id));
create policy cards_delete on public.cards for delete to authenticated using (public.can_edit_card(id));

-- card assignees / checklist: whoever can edit the card
create policy assignees_read  on public.card_assignees for select to authenticated using (public.is_member());
create policy assignees_write on public.card_assignees for all to authenticated
  using (public.can_edit_card(card_id)) with check (public.can_edit_card(card_id));

create policy checklist_read  on public.card_checklist_items for select to authenticated using (public.is_member());
create policy checklist_write on public.card_checklist_items for all to authenticated
  using (public.can_edit_card(card_id)) with check (public.can_edit_card(card_id));

-- comments: any member can comment on any card (cross-group questions are useful);
-- only the author (or an admin) can edit/delete a comment
create policy comments_read   on public.card_comments for select to authenticated using (public.is_member());
create policy comments_insert on public.card_comments for insert to authenticated
  with check (public.is_member() and author_id = public.my_profile_id());
create policy comments_change on public.card_comments for update to authenticated
  using (author_id = public.my_profile_id() or public.is_admin())
  with check (author_id = public.my_profile_id() or public.is_admin());
create policy comments_delete on public.card_comments for delete to authenticated
  using (author_id = public.my_profile_id() or public.is_admin());

-- Tables owned by one group: everyone reads, only that group (or admins) writes
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('sales','finance'), ('expenses','finance'), ('inventory','finance'),
      ('prospects','customer'), ('complaints','customer'),
      ('content_posts','marketing'), ('campaigns','marketing'), ('design_requests','marketing'),
      ('experiments','marketing'), ('follower_snapshots','marketing'),
      ('meeting_notes','team-leader'), ('outreach','team-leader')
    ) as v(tbl, owner_slug)
  loop
    execute format(
      'create policy %1$s_read on public.%1$I for select to authenticated using (public.is_member())', r.tbl);
    execute format(
      'create policy %1$s_write on public.%1$I for all to authenticated
         using (public.can_edit_group(public.group_id_of(%2$L)))
         with check (public.can_edit_group(public.group_id_of(%2$L)))', r.tbl, r.owner_slug);
  end loop;
end $$;

-- Design requests: anyone may *request* a design (the Marketing group still owns the queue)
create policy design_requests_ask on public.design_requests for insert to authenticated
  with check (public.is_member() and requested_by = public.my_profile_id()
              and status = 'open' and assignee_id is null);

-- Tables where each row carries its own group_id
create policy kpi_read  on public.kpi_targets for select to authenticated using (public.is_member());
create policy kpi_write on public.kpi_targets for all to authenticated
  using (public.can_edit_group(group_id)) with check (public.can_edit_group(group_id));

create policy decisions_read  on public.decisions for select to authenticated using (public.is_member());
create policy decisions_write on public.decisions for all to authenticated
  using (public.is_admin()
         or public.can_edit_group(public.group_id_of('communications'))  -- Communications keeps the log
         or (group_id is not null and public.can_edit_group(group_id)))
  with check (public.is_admin()
         or public.can_edit_group(public.group_id_of('communications'))
         or (group_id is not null and public.can_edit_group(group_id)));

create policy blockers_read  on public.blockers for select to authenticated using (public.is_member());
create policy blockers_write on public.blockers for all to authenticated
  using (public.can_edit_group(group_id)) with check (public.can_edit_group(group_id));

-- Morale: each member writes only their own score. Individual rows (with comments)
-- are visible to the person, the Communications group and admins. Everyone else
-- sees the anonymous weekly average through public.morale_weekly() below.
create policy morale_read on public.morale_checks for select to authenticated
  using (user_id = public.my_profile_id()
         or public.can_edit_group(public.group_id_of('communications')));
create policy morale_own on public.morale_checks for insert to authenticated
  with check (user_id = public.my_profile_id());
create policy morale_own_update on public.morale_checks for update to authenticated
  using (user_id = public.my_profile_id()) with check (user_id = public.my_profile_id());
create policy morale_delete on public.morale_checks for delete to authenticated
  using (user_id = public.my_profile_id() or public.is_admin());

create or replace function public.morale_weekly()
returns table (week_start date, avg_score numeric, responses bigint)
language sql stable security definer set search_path = public as $$
  select week_start, round(avg(score)::numeric, 2), count(*)
    from public.morale_checks
   where public.is_member()
   group by week_start
   order by week_start
$$;

-- Activity log: everyone reads; written only by database triggers (see 0003)
create policy activity_read on public.activity_log for select to authenticated using (public.is_member());
