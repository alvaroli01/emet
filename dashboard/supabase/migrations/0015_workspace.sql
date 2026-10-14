-- Workspace features: notifications, repeating tasks, automatic weekly reports, private calendar feeds.

-- ── Notifications ────────────────────────────────────────────
-- Stored as a kind + data (not text) so each person reads them in their own language.
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  data       jsonb not null default '{}',
  link       text,
  actor_id   uuid references public.profiles(id) on delete set null,
  dedupe     text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe) where dedupe is not null;
grant select, update, delete on public.notifications to authenticated;
alter table public.notifications enable row level security;
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = (select public.my_profile_id()));
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = (select public.my_profile_id())) with check (user_id = (select public.my_profile_id()));
create policy notifications_own_delete on public.notifications for delete to authenticated using (user_id = (select public.my_profile_id()));
-- Inserts only happen through the security-definer functions below (no insert policy for users)

create or replace function public.notify(p_users uuid[], p_kind text, p_data jsonb, p_link text, p_actor uuid default null, p_dedupe text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, data, link, actor_id, dedupe)
  select u, p_kind, p_data, p_link, p_actor, p_dedupe
  from unnest(p_users) u
  where u is not null and u is distinct from p_actor
    and exists (select 1 from public.profiles p where p.id = u and p.active and p.user_id is not null)
  on conflict do nothing
$$;
revoke all on function public.notify(uuid[], text, jsonb, text, uuid, text) from public, anon, authenticated;

-- Link to a card: /g/<group slug>?card=<id> or /board?card=<id>
create or replace function public.card_link(p_card uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce('/g/' || g.slug, '/board') || '?card=' || c.id
  from public.cards c join public.boards b on b.id = c.board_id left join public.groups g on g.id = b.group_id
  where c.id = p_card
$$;

create or replace function public.active_member_ids() returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.profiles where active and user_id is not null
$$;
create or replace function public.leader_ids() returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(p.id), '{}') from public.profiles p left join public.groups g on g.id = p.group_id
  where p.active and p.user_id is not null and (p.is_admin or g.slug = 'team-leader')
$$;

-- Someone assigned you to a card
create or replace function public.trg_notify_assigned() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(array[new.user_id], 'assigned',
    jsonb_build_object('title', (select title from cards where id = new.card_id)),
    public.card_link(new.card_id), public.my_profile_id());
  return new;
end $$;
create trigger notify_assigned after insert on public.card_assignees for each row execute function public.trg_notify_assigned();

-- A comment on a card you created or are on
create or replace function public.trg_notify_card_comment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(
    array(select user_id from card_assignees where card_id = new.card_id union select created_by from cards where id = new.card_id),
    'card_comment',
    jsonb_build_object('title', (select title from cards where id = new.card_id), 'excerpt', left(new.body, 120)),
    public.card_link(new.card_id), new.author_id);
  return new;
end $$;
create trigger notify_card_comment after insert on public.card_comments for each row execute function public.trg_notify_card_comment();

-- A meeting finished and was shared (leaders' meetings only to leaders)
create or replace function public.trg_notify_meeting() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ready' and old.status is distinct from 'ready' then
    perform public.notify(case when new.kind = 'leaders' then public.leader_ids() else public.active_member_ids() end,
      'meeting', jsonb_build_object('title', new.title, 'kind', new.kind), '/meetings?m=' || new.id, new.created_by);
  end if;
  return new;
end $$;
create trigger notify_meeting after update on public.meetings for each row execute function public.trg_notify_meeting();

-- New idea in the lab (everyone) and comments on your idea
create or replace function public.trg_notify_idea() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is null then
    perform public.notify(public.active_member_ids(), 'idea', jsonb_build_object('title', new.title), '/lab?i=' || new.id, new.created_by);
  end if;
  return new;
end $$;
create trigger notify_idea after insert on public.lab_ideas for each row execute function public.trg_notify_idea();

create or replace function public.trg_notify_idea_comment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(array(select created_by from lab_ideas where id = new.idea_id
                              union select author_id from lab_comments where idea_id = new.idea_id),
    'idea_comment', jsonb_build_object('title', (select title from lab_ideas where id = new.idea_id), 'excerpt', left(new.body, 120)),
    '/lab?i=' || new.idea_id, new.author_id);
  return new;
end $$;
create trigger notify_idea_comment after insert on public.lab_comments for each row execute function public.trg_notify_idea_comment();

-- A doc was shared with you
create or replace function public.trg_notify_doc_shared() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.share_all and not coalesce(old.share_all, false) then
    perform public.notify(public.active_member_ids(), 'doc_shared', jsonb_build_object('title', new.title), '/camp?tab=docs&doc=' || new.id, new.owner_id);
  else
    perform public.notify(array(select unnest(new.shared_with) except select unnest(coalesce(old.shared_with, '{}'))),
      'doc_shared', jsonb_build_object('title', new.title), '/camp?tab=docs&doc=' || new.id, new.owner_id);
  end if;
  return new;
end $$;
create trigger notify_doc_shared after update of share_all, shared_with on public.docs for each row execute function public.trg_notify_doc_shared();

-- A design request reaches Marketing
create or replace function public.trg_notify_design_request() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(array(select id from profiles where group_id = public.group_id_of('marketing')),
    'design_request', jsonb_build_object('title', new.title), '/g/marketing?tab=design', new.requested_by);
  return new;
end $$;
create trigger notify_design_request after insert on public.design_requests for each row execute function public.trg_notify_design_request();

-- Daily (cron): cards due tomorrow → their assignees, once
create or replace function public.notify_due_tomorrow() returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in
    select c.id, c.title, array_agg(a.user_id) as users
    from cards c join card_assignees a on a.card_id = c.id
    where c.completed_at is null and (c.due_at at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date + 1
    group by c.id, c.title
  loop
    perform public.notify(r.users, 'due_soon', jsonb_build_object('title', r.title), public.card_link(r.id), null, 'due:' || r.id || ':' || current_date);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.notify_due_tomorrow() from public, anon, authenticated;
grant execute on function public.notify_due_tomorrow() to service_role;

-- ── Repeating tasks ──────────────────────────────────────────
create table public.recurring_tasks (
  id            uuid primary key default gen_random_uuid(),
  board_id      uuid not null references public.boards(id) on delete cascade,
  title         text not null,
  description   text,
  assignee_id   uuid references public.profiles(id) on delete set null,
  cadence       text not null check (cadence in ('weekly', 'biweekly', 'monthly')),
  next_run      date not null,
  due_after_days int not null default 0 check (due_after_days between 0 and 30),
  active        boolean not null default true,
  source_card   uuid references public.cards(id) on delete set null,
  created_by    uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index recurring_due_idx on public.recurring_tasks (next_run) where active;
grant select, insert, update, delete on public.recurring_tasks to authenticated;
alter table public.recurring_tasks enable row level security;
create policy recurring_read on public.recurring_tasks for select to authenticated using (public.is_member());
create policy recurring_write on public.recurring_tasks for all to authenticated
  using (public.can_edit_board(board_id) or public.is_admin()) with check (public.can_edit_board(board_id) or public.is_admin());

-- Daily (cron): create the cards that are due to repeat, then move each rule to its next date
create or replace function public.run_recurring() returns int language plpgsql security definer set search_path = public as $$
declare r record; new_card uuid; n int := 0; first_list uuid;
begin
  for r in select * from recurring_tasks where active and next_run <= (now() at time zone 'Europe/Madrid')::date loop
    select id into first_list from board_lists where board_id = r.board_id order by position limit 1;
    if first_list is not null then
      insert into cards (board_id, list_id, title, description, due_at, position, created_by)
      values (r.board_id, first_list, r.title, r.description,
              ((r.next_run + r.due_after_days)::timestamp + time '21:59') at time zone 'UTC',
              extract(epoch from now()), r.created_by)
      returning id into new_card;
      if r.assignee_id is not null then insert into card_assignees (card_id, user_id) values (new_card, r.assignee_id); end if;
      n := n + 1;
    end if;
    update recurring_tasks set next_run = case cadence
      when 'weekly' then next_run + 7 when 'biweekly' then next_run + 14 else (next_run + interval '1 month')::date end
    where id = r.id;
  end loop;
  return n;
end $$;
revoke all on function public.run_recurring() from public, anon, authenticated;
grant execute on function public.run_recurring() to service_role;

-- ── Automatic weekly reports ─────────────────────────────────
-- The numbers are stored (not text), so everyone reads the report in their own language.
create table public.weekly_reports (
  week_start  date primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);
grant select on public.weekly_reports to authenticated;
alter table public.weekly_reports enable row level security;
create policy weekly_reports_read on public.weekly_reports for select to authenticated using (public.is_member());

-- ── Private calendar feeds ───────────────────────────────────
create table public.calendar_feeds (
  user_id    uuid primary key default public.my_profile_id() references public.profiles(id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.calendar_feeds to authenticated;
alter table public.calendar_feeds enable row level security;
create policy calendar_feeds_own on public.calendar_feeds for all to authenticated
  using (user_id = (select public.my_profile_id())) with check (user_id = (select public.my_profile_id()));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.weekly_reports;
  end if;
end $$;
