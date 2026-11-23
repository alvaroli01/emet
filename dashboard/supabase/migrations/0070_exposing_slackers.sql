-- Alvaro, 2026-11-23: "Exposing Slackers", a weekly class dynamic.
-- Every week each member rates how they worked (1–5) and rates everyone else; the screen then shows
-- self score vs. class score next to what the dashboard says they actually did that week (the proof).
-- Votes are secret: you can only read your own. Everyone sees the averages through slacker_board().
-- Voting is open for the current week and the week before (the session can be on a Monday about last week).

create table public.slacker_votes (
  week_start date not null check (extract(isodow from week_start) = 1),
  voter_id   uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  target_id  uuid not null references public.profiles(id) on delete cascade,
  score      int  not null check (score between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (week_start, voter_id, target_id)
);

-- "What I did this week", in the person's own words (shown on screen next to the proof)
create table public.slacker_notes (
  week_start date not null check (extract(isodow from week_start) = 1),
  user_id    uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  note       text not null check (char_length(note) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (week_start, user_id)
);

-- Monday of this week, Spanish time
create or replace function public.slacker_week_open(ws date) returns boolean
language sql stable set search_path = '' as $$
  select ws between (date_trunc('week', now() at time zone 'Europe/Madrid'))::date - 7
                and (date_trunc('week', now() at time zone 'Europe/Madrid'))::date
$$;

grant select, insert, update, delete on public.slacker_votes to authenticated;
grant select, insert, update, delete on public.slacker_notes to authenticated;
alter table public.slacker_votes enable row level security;
alter table public.slacker_notes enable row level security;

create policy slacker_votes_own_read on public.slacker_votes for select to authenticated
  using (voter_id = public.my_profile_id());
create policy slacker_votes_own_write on public.slacker_votes for all to authenticated
  using (voter_id = public.my_profile_id() and public.slacker_week_open(week_start))
  with check (voter_id = public.my_profile_id() and public.is_member() and public.slacker_week_open(week_start)
    and exists (select 1 from public.profiles p where p.id = target_id and p.active and not p.is_guest and not coalesce(p.is_coach, false)));

create policy slacker_notes_read on public.slacker_notes for select to authenticated using (public.is_member() or public.is_coach());
create policy slacker_notes_own_write on public.slacker_notes for all to authenticated
  using (user_id = public.my_profile_id() and public.slacker_week_open(week_start))
  with check (user_id = public.my_profile_id() and public.is_member() and public.slacker_week_open(week_start));

-- One row per rated person: their own score, the class average (never their own vote), how many voted,
-- and the tasks they finished that week (whole team's tasks, private "My board"s left out).
create or replace function public.slacker_board(ws date)
returns table (user_id uuid, self_score int, class_avg numeric, class_n int, tasks jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id,
    (select v.score from public.slacker_votes v where v.week_start = ws and v.voter_id = p.id and v.target_id = p.id),
    (select round(avg(v.score), 1) from public.slacker_votes v where v.week_start = ws and v.target_id = p.id and v.voter_id <> p.id),
    (select count(*)::int from public.slacker_votes v where v.week_start = ws and v.target_id = p.id and v.voter_id <> p.id),
    coalesce((
      select jsonb_agg(jsonb_build_object('title', c.title, 'done_at', coalesce(a.done_at, c.completed_at)) order by coalesce(a.done_at, c.completed_at))
      from public.card_assignees a
      join public.cards c on c.id = a.card_id
      join public.boards b on b.id = c.board_id and b.owner_id is null
      where a.user_id = p.id
        and coalesce(a.done_at, c.completed_at) >= (ws::timestamp at time zone 'Europe/Madrid')
        and coalesce(a.done_at, c.completed_at) <  ((ws + 7)::timestamp at time zone 'Europe/Madrid')
    ), '[]'::jsonb)
  from public.profiles p
  where (public.is_member() or public.is_coach())
    and p.active and not p.is_guest and not coalesce(p.is_coach, false)
$$;
revoke execute on function public.slacker_board(date) from public, anon;
grant execute on function public.slacker_board(date) to authenticated;
