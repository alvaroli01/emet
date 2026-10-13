-- emet HQ — schema
-- Runs on the Supabase free tier. Paste into Supabase → SQL Editor, or use `supabase db push`.
-- Order: 0001_schema.sql → 0002_security.sql → 0003_activity_realtime.sql → seed.sql

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Groups & people
-- ─────────────────────────────────────────────────────────────
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,          -- team-leader | finance | customer | marketing | communications
  name       text not null,
  emoji      text not null,
  color      text not null,                 -- hex accent colour
  position   int  not null default 0
);

-- A profile exists for every invited member *before* they first log in.
-- When the person logs in for the first time, their auth user is linked by email (see 0002).
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete set null,
  full_name   text not null,
  email       text not null unique,
  avatar_url  text,
  group_id    uuid references public.groups(id) on delete set null,
  role_title  text,
  is_admin    boolean not null default false,   -- extra admins outside the Team Leader group
  locale      text not null default 'en'
              check (locale in ('en','es','de','fr','fi','pt-BR','ru')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.profiles (group_id);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Task boards (Trello-style)
-- ─────────────────────────────────────────────────────────────
create table public.boards (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  name                 text not null,
  group_id             uuid references public.groups(id) on delete cascade,  -- null = general company board
  trello_sync_enabled  boolean not null default false,
  trello_board_id      text,
  created_at           timestamptz not null default now()
);

create table public.board_lists (
  id        uuid primary key default gen_random_uuid(),
  board_id  uuid not null references public.boards(id) on delete cascade,
  name      text not null,
  position  double precision not null default 0
);
create index on public.board_lists (board_id);

create table public.cards (
  id              uuid primary key default gen_random_uuid(),
  board_id        uuid not null references public.boards(id) on delete cascade,
  list_id         uuid not null references public.board_lists(id) on delete cascade,
  title           text not null,
  description     text,
  due_at          timestamptz,
  completed_at    timestamptz,                 -- set when the card reaches "Done" (used for on-time rate)
  position        double precision not null default 0,
  labels          text[] not null default '{}',
  created_by      uuid references public.profiles(id) on delete set null,
  trello_card_id  text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.cards (board_id);
create index on public.cards (list_id);
create trigger cards_updated before update on public.cards
  for each row execute function public.set_updated_at();

create table public.card_assignees (
  card_id  uuid not null references public.cards(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (card_id, user_id)
);
create index on public.card_assignees (user_id);

create table public.card_checklist_items (
  id        uuid primary key default gen_random_uuid(),
  card_id   uuid not null references public.cards(id) on delete cascade,
  text      text not null,
  done      boolean not null default false,
  position  double precision not null default 0
);
create index on public.card_checklist_items (card_id);

create table public.card_comments (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.cards(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index on public.card_comments (card_id);

-- ─────────────────────────────────────────────────────────────
-- Finance (owned by the Finance group)
-- ─────────────────────────────────────────────────────────────
create table public.sales (
  id           uuid primary key default gen_random_uuid(),
  date         date not null default current_date,
  description  text not null,
  amount       numeric(12,2) not null check (amount >= 0),   -- revenue €
  cost         numeric(12,2) not null default 0 check (cost >= 0),  -- cost of goods €
  channel      text,
  rep_id       uuid references public.profiles(id) on delete set null,
  logged_by    uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on public.sales (date);

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  date         date not null default current_date,
  description  text not null,
  category     text,
  amount       numeric(12,2) not null check (amount >= 0),
  logged_by    uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on public.expenses (date);

create table public.inventory (
  id          uuid primary key default gen_random_uuid(),
  product     text not null,
  sku         text unique,
  stock       int not null default 0,
  unit_cost   numeric(12,2),
  price       numeric(12,2),
  updated_at  timestamptz not null default now()
);
create trigger inventory_updated before update on public.inventory
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Customer (owned by the Customer group)
-- ─────────────────────────────────────────────────────────────
create table public.prospects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  contact     text,
  stage       text not null default 'new'
              check (stage in ('new','contacted','interested','won','lost')),
  owner_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger prospects_updated before update on public.prospects
  for each row execute function public.set_updated_at();

create table public.complaints (
  id           uuid primary key default gen_random_uuid(),
  customer     text not null,
  issue        text not null,
  status       text not null default 'open' check (status in ('open','in_progress','resolved')),
  owner_id     uuid references public.profiles(id) on delete set null,
  opened_at    timestamptz not null default now(),
  resolved_at  timestamptz
);

-- ─────────────────────────────────────────────────────────────
-- Marketing (owned by the Marketing group)
-- ─────────────────────────────────────────────────────────────
create table public.content_posts (
  id           uuid primary key default gen_random_uuid(),
  platform     text not null,
  title        text not null,
  planned_for  date,
  status       text not null default 'planned' check (status in ('idea','planned','posted')),
  posted_at    timestamptz,
  owner_id     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  product     text,
  status      text not null default 'planned' check (status in ('planned','live','done')),
  starts_on   date,
  ends_on     date,
  owner_id    uuid references public.profiles(id) on delete set null,
  notes       text,
  created_at  timestamptz not null default now()
);

create table public.design_requests (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  details       text,
  requested_by  uuid references public.profiles(id) on delete set null,
  assignee_id   uuid references public.profiles(id) on delete set null,
  status        text not null default 'open' check (status in ('open','in_progress','delivered')),
  requested_at  timestamptz not null default now(),
  delivered_at  timestamptz
);

create table public.experiments (
  id          uuid primary key default gen_random_uuid(),
  hypothesis  text not null,
  test        text,
  result      text,
  decision    text,
  owner_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.follower_snapshots (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null,
  week_start  date not null,
  followers   int not null check (followers >= 0),
  unique (platform, week_start)
);

-- ─────────────────────────────────────────────────────────────
-- Communications (owned by the Communications group)
-- ─────────────────────────────────────────────────────────────
create table public.morale_checks (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  score       int not null check (score between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (week_start, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- Team Leader (owned by the Team Leader group)
-- ─────────────────────────────────────────────────────────────
create table public.meeting_notes (
  id            uuid primary key default gen_random_uuid(),
  meeting_date  date not null default current_date,
  notes         text not null,
  action_items  jsonb not null default '[]',    -- [{text, owner_id, done}]
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.outreach (
  id          uuid primary key default gen_random_uuid(),
  contact     text not null,
  kind        text not null default 'school' check (kind in ('school','upperclassmen','other')),
  status      text not null default 'to_contact' check (status in ('to_contact','contacted','replied','done')),
  notes       text,
  owner_id    uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);
create trigger outreach_updated before update on public.outreach
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Shared by every group (row has its own group_id)
-- ─────────────────────────────────────────────────────────────
create table public.kpi_targets (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  role_title  text,
  metric      text not null,
  target      numeric,            -- null = still TBD
  unit        text,               -- '€', '%', 'h', 'count'…
  period      text not null default 'week' check (period in ('day','week','month','total')),
  unique (group_id, metric)
);

create table public.decisions (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  decision    text not null,
  decided_by  text,
  group_id    uuid references public.groups(id) on delete set null,   -- null = whole team (admins only)
  created_at  timestamptz not null default now()
);

create table public.blockers (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  description  text not null,
  owner_id     uuid references public.profiles(id) on delete set null,
  status       text not null default 'open' check (status in ('open','resolved')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create table public.activity_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  group_id    uuid references public.groups(id) on delete set null,
  action      text not null,          -- insert | update | delete
  entity      text not null,          -- table name
  entity_id   uuid,
  summary     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on public.activity_log (created_at desc);
create index on public.activity_log (group_id, created_at desc);
