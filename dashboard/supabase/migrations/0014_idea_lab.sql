-- Idea lab: anyone posts a business idea; AI researches and scores it against emet's goal;
-- the whole team sees, votes and comments. Variations link back to the idea they came from.
create table public.lab_ideas (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null default public.my_profile_id() references public.profiles(id) on delete set null,
  parent_id   uuid references public.lab_ideas(id) on delete set null,
  title       text not null check (length(title) between 2 and 140),
  pitch       text not null default '' check (length(pitch) <= 4000),
  kind        text not null default 'other' check (kind in ('product', 'service', 'event', 'online', 'other')),
  status      text not null default 'new' check (status in ('new', 'researching', 'analyzed', 'failed')),
  research    jsonb,          -- { notes, sources[] }
  analysis    jsonb,          -- structured verdict (see src/lib/lab/score.ts)
  score       int check (score between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index lab_ideas_created_idx on public.lab_ideas (created_at desc);
create index lab_ideas_parent_idx on public.lab_ideas (parent_id);
create index lab_ideas_created_by_idx on public.lab_ideas (created_by);

create table public.lab_votes (
  idea_id  uuid not null references public.lab_ideas(id) on delete cascade,
  user_id  uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  primary key (idea_id, user_id)
);

create table public.lab_comments (
  id         uuid primary key default gen_random_uuid(),
  idea_id    uuid not null references public.lab_ideas(id) on delete cascade,
  author_id  uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index lab_comments_idea_idx on public.lab_comments (idea_id, created_at);

grant select, insert, update, delete on public.lab_ideas, public.lab_votes, public.lab_comments to authenticated;
alter table public.lab_ideas enable row level security;
alter table public.lab_votes enable row level security;
alter table public.lab_comments enable row level security;

-- Everyone on the team sees everything in the lab
create policy lab_ideas_read on public.lab_ideas for select to authenticated using (public.is_member());
create policy lab_votes_read on public.lab_votes for select to authenticated using (public.is_member());
create policy lab_comments_read on public.lab_comments for select to authenticated using (public.is_member());
-- Ideas: you post as yourself; the author (or an admin) edits, re-analyses or deletes
create policy lab_ideas_insert on public.lab_ideas for insert to authenticated with check (created_by = (select public.my_profile_id()));
create policy lab_ideas_update on public.lab_ideas for update to authenticated
  using (created_by = (select public.my_profile_id()) or public.is_admin());
create policy lab_ideas_delete on public.lab_ideas for delete to authenticated
  using (created_by = (select public.my_profile_id()) or public.is_admin());
-- One vote per person per idea; only your own
create policy lab_votes_write on public.lab_votes for all to authenticated
  using (user_id = (select public.my_profile_id())) with check (user_id = (select public.my_profile_id()));
-- Comment as yourself; delete your own (admins can moderate)
create policy lab_comments_insert on public.lab_comments for insert to authenticated with check (author_id = (select public.my_profile_id()));
create policy lab_comments_delete on public.lab_comments for delete to authenticated
  using (author_id = (select public.my_profile_id()) or public.is_admin());

create trigger lab_ideas_touch before update on public.lab_ideas for each row execute function public.set_updated_at();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.lab_ideas, public.lab_votes, public.lab_comments;
  end if;
end $$;
