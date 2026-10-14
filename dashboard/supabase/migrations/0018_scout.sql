-- Scout: find and judge first clients for a project in any city (spec: docs/lead-finder-build-prompt.md),
-- plus the Idea lab council. Places are stored once for everyone so nothing is researched twice.
-- Everyone reads; Customer, Marketing and admins run searches and work leads.

create or replace function public.can_scout() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.can_edit_group(public.group_id_of('customer')) or public.can_edit_group(public.group_id_of('marketing'))
$$;

create table public.scout_projects (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(title) between 1 and 120),
  idea_id         uuid references public.lab_ideas(id) on delete set null,
  offer           text not null,                 -- what we sell
  niche           text not null,                 -- kind of business we target
  ideal_client    text,
  must_have       text[] not null default '{}',
  deal_breakers   text[] not null default '{}',
  avg_deal_value  numeric(12,2),
  plan            jsonb,                         -- AI understanding: osm tags, queries, signals, playbook (cached)
  created_by      uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table public.scout_searches (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.scout_projects(id) on delete cascade,
  country_code  text not null check (country_code ~ '^[A-Z]{2}$'),
  city          text not null,
  lat           double precision, lng double precision,
  bbox          double precision[],              -- [south, west, north, east]
  radius_km     numeric(5,1) not null default 3 check (radius_km between 0.5 and 30),
  osm_tags      text[] not null default '{}',
  web_queries   text[] not null default '{}',
  status        text not null default 'queued' check (status in ('queued', 'finding', 'researching', 'done', 'failed')),
  queue         uuid[] not null default '{}',    -- places still to judge, in order
  found         int not null default 0,
  known         int not null default 0,          -- skipped because already judged for this project
  researched    int not null default 0,
  max_places    int not null default 20 check (max_places between 1 and 60),
  log           jsonb not null default '[]',     -- plain-language step log shown next to the globe
  created_by    uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index scout_searches_project_idx on public.scout_searches (project_id, created_at desc);
create trigger scout_searches_touch before update on public.scout_searches for each row execute function public.set_updated_at();

create table public.scout_places (
  id             uuid primary key default gen_random_uuid(),
  fingerprint    text not null unique,           -- normalized name + rounded position, or the website domain
  name           text not null,
  category       text,
  address        text,
  city           text,
  country_code   text,
  lat            double precision, lng double precision,
  website        text, phone text, instagram text, email_public text, opening_hours text,
  osm_id         text,
  source         text not null default 'osm' check (source in ('osm', 'web', 'manual', 'google')),
  forgotten      boolean not null default false, -- "forget this place": data wiped, fingerprint kept so it never returns
  first_seen_at  timestamptz not null default now()
);

create table public.scout_research (
  place_id     uuid not null references public.scout_places(id) on delete cascade,
  url          text not null,
  fetched_at   timestamptz not null default now(),
  text_excerpt text,
  robots_ok    boolean not null default true,
  primary key (place_id, url)
);

create table public.scout_leads (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.scout_projects(id) on delete cascade,
  place_id      uuid not null references public.scout_places(id) on delete cascade,
  search_id     uuid references public.scout_searches(id) on delete set null,
  score         int check (score between 0 and 100),
  fit           text check (fit in ('strong', 'good', 'maybe', 'skip')),
  worth_it      boolean,
  why           text,
  attack_with   text,
  approach      jsonb,                           -- {channel, opener, best_time, who_to_ask_for, objections:[{objection, answer}]}
  criteria      jsonb,                           -- [{key, score, why, source}]
  signals       jsonb not null default '[]',     -- [{text, url}]
  status        text not null default 'new' check (status in ('new', 'contacted', 'meeting', 'won', 'lost', 'ignored')),
  owner_id      uuid references public.profiles(id) on delete set null,
  next_step_at  date,
  prospect_id   uuid references public.prospects(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (project_id, place_id)
);
create index scout_leads_project_idx on public.scout_leads (project_id, score desc);
create trigger scout_leads_touch before update on public.scout_leads for each row execute function public.set_updated_at();

-- Idea lab: 5-advisor council with anonymous peer review and a chairman's verdict
create table public.lab_councils (
  id          uuid primary key default gen_random_uuid(),
  idea_id     uuid not null references public.lab_ideas(id) on delete cascade,
  advisors    jsonb not null default '[]',
  reviews     jsonb,
  chairman    jsonb,
  status      text not null default 'running' check (status in ('running', 'done', 'failed')),
  created_by  uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index lab_councils_idea_idx on public.lab_councils (idea_id, created_at desc);

-- ── Permissions ──
do $$
declare t text;
begin
  foreach t in array array['scout_projects', 'scout_searches', 'scout_places', 'scout_research'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_read on public.%1$I for select to authenticated using (public.is_member())', t);
    execute format('create policy %1$s_write on public.%1$I for all to authenticated using (public.can_scout()) with check (public.can_scout())', t);
  end loop;
end $$;

grant select, insert, update, delete on public.scout_leads to authenticated;
alter table public.scout_leads enable row level security;
create policy scout_leads_read on public.scout_leads for select to authenticated using (public.is_member());
create policy scout_leads_write on public.scout_leads for all to authenticated using (public.can_scout()) with check (public.can_scout());
-- Whoever a lead is assigned to can move it along even outside the selling groups
create policy scout_leads_owner on public.scout_leads for update to authenticated
  using (owner_id = public.my_profile_id()) with check (owner_id = public.my_profile_id());

-- Council: anyone may run it on an idea they can see (it uses their own Groq key); only the runner or an admin deletes
grant select, insert, update, delete on public.lab_councils to authenticated;
alter table public.lab_councils enable row level security;
create policy lab_councils_read on public.lab_councils for select to authenticated using (public.is_member());
create policy lab_councils_insert on public.lab_councils for insert to authenticated with check (public.is_member() and created_by = public.my_profile_id());
create policy lab_councils_update on public.lab_councils for update to authenticated using (created_by = public.my_profile_id() or public.is_admin());
create policy lab_councils_delete on public.lab_councils for delete to authenticated using (created_by = public.my_profile_id() or public.is_admin());

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.scout_searches, public.scout_leads, public.lab_councils;
  end if;
end $$;
