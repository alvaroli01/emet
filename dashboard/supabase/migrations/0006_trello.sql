-- emet HQ — optional Trello sync (off by default; free Trello API)

alter table public.board_lists add column if not exists trello_list_id text unique;

-- Which Trello member is which emet member (so assignees sync)
create table if not exists public.trello_member_map (
  trello_member_id text primary key,
  trello_username  text not null,
  profile_id       uuid not null references public.profiles(id) on delete cascade
);
alter table public.trello_member_map enable row level security;
grant select, insert, update, delete on public.trello_member_map to authenticated;
create policy trello_map_read  on public.trello_member_map for select to authenticated using (public.is_member());
create policy trello_map_write on public.trello_member_map for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Only admins switch sync on/off or change the linked Trello board
create or replace function public.guard_board_trello()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.trello_sync_enabled is distinct from old.trello_sync_enabled
          or new.trello_board_id is distinct from old.trello_board_id) then
    raise exception 'emet: only team leaders can change Trello sync';
  end if;
  return new;
end $$;
create trigger boards_trello_guard before update on public.boards
  for each row execute function public.guard_board_trello();
