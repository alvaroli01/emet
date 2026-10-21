-- Project boards: only leaders add or remove tasks and columns; the project's people work on them
-- (open, move between columns, tick checklists, comment).
create or replace function public.can_edit_board(p_board_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when b.project_id is not null then public.is_admin()
                               when b.group_id is null then public.is_admin()
                               else public.can_edit_group(b.group_id) end
                   from public.boards b where b.id = p_board_id), false)
$$;
create or replace function public.can_add_card(p_board_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when b.project_id is not null then public.is_admin()
                               when b.group_id is null then public.is_member()
                               else public.can_edit_group(b.group_id) end
                   from public.boards b where b.id = p_board_id), false)
$$;
-- Moving a card keeps it on the same board, so the update rule must not require "can add" on project boards
drop policy if exists cards_update on public.cards;
create policy cards_update on public.cards for update to authenticated
  using (public.can_edit_card(id))
  with check ((public.can_add_card(board_id) or exists (select 1 from public.boards b where b.id = board_id and b.project_id is not null and public.is_project_member(b.project_id)))
              and exists (select 1 from public.board_lists l where l.id = cards.list_id and l.board_id = cards.board_id));
drop policy if exists cards_delete on public.cards;
create policy cards_delete on public.cards for delete to authenticated
  using (public.can_edit_card(id) and not exists (select 1 from public.boards b where b.id = board_id and b.project_id is not null and not public.is_admin()));
