-- emet HQ — activity feed, card completion tracking, realtime

-- ─────────────────────────────────────────────────────────────
-- 1. Cards: stamp completed_at when a card enters a list called "Done"
--    (feeds the on-time task rate: done before due_at = on time)
-- ─────────────────────────────────────────────────────────────
create or replace function public.stamp_card_completion()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_done boolean;
begin
  select lower(name) = 'done' into is_done from public.board_lists where id = new.list_id;
  if is_done and (tg_op = 'INSERT' or new.list_id is distinct from old.list_id) then
    new.completed_at := now();
  elsif not is_done then
    new.completed_at := null;
  end if;
  return new;
end $$;
create trigger cards_completion before insert or update of list_id on public.cards
  for each row execute function public.stamp_card_completion();

-- ─────────────────────────────────────────────────────────────
-- 2. Activity log, written automatically by triggers
--    TG_ARGV[0] says how to find the row's group:
--      a group slug ('finance') · 'row' (row.group_id) · 'board' (via row.board_id) · 'card' (via row.card_id)
--    TG_ARGV[1] is the column to show as the summary label.
-- ─────────────────────────────────────────────────────────────
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec     jsonb := to_jsonb(coalesce(new, old));
  how     text  := tg_argv[0];
  lbl_col text  := tg_argv[1];
  gid     uuid;
  summary jsonb;
begin
  -- skip noisy updates that only change ordering
  if tg_op = 'UPDATE' and tg_table_name = 'cards'
     and (to_jsonb(new) - 'position' - 'updated_at') = (to_jsonb(old) - 'position' - 'updated_at') then
    return null;
  end if;

  gid := case how
    when 'row'   then (rec->>'group_id')::uuid
    when 'board' then (select group_id from public.boards where id = (rec->>'board_id')::uuid)
    when 'card'  then (select b.group_id from public.cards c join public.boards b on b.id = c.board_id
                        where c.id = (rec->>'card_id')::uuid)
    else public.group_id_of(how)
  end;

  summary := jsonb_build_object('label', rec->>lbl_col);
  if rec ? 'amount' then summary := summary || jsonb_build_object('amount', rec->'amount'); end if;
  if tg_table_name = 'cards' and tg_op = 'UPDATE'
     and (to_jsonb(new)->>'list_id') is distinct from (to_jsonb(old)->>'list_id') then
    summary := summary || jsonb_build_object(
      'moved_to', (select name from public.board_lists where id = (rec->>'list_id')::uuid));
  end if;

  insert into public.activity_log (user_id, group_id, action, entity, entity_id, summary)
  values (public.my_profile_id(), gid, lower(tg_op), tg_table_name,
          nullif(rec->>'id', '')::uuid, summary);
  return null;
end $$;

do $$
declare r record;
begin
  for r in
    select * from (values
      ('cards','board','title'),
      ('card_comments','card','body'),
      ('sales','finance','description'),
      ('expenses','finance','description'),
      ('inventory','finance','product'),
      ('prospects','customer','name'),
      ('complaints','customer','issue'),
      ('content_posts','marketing','title'),
      ('campaigns','marketing','name'),
      ('design_requests','marketing','title'),
      ('experiments','marketing','hypothesis'),
      ('meeting_notes','team-leader','meeting_date'),
      ('outreach','team-leader','contact'),
      ('decisions','row','decision'),
      ('blockers','row','description'),
      ('kpi_targets','row','metric')
    ) as v(tbl, how, lbl)
  loop
    execute format(
      'create trigger %1$s_activity after insert or update or delete on public.%1$I
         for each row execute function public.log_activity(%2$L, %3$L)', r.tbl, r.how, r.lbl);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3. Realtime: push every change to every open dashboard instantly
-- ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    for t in select tablename from pg_tables where schemaname = 'public' loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;
