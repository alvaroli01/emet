-- Deep Marketing section (spec: docs/marketing-build-prompt.md). Works with manual logging today;
-- the Instagram sync fills the same tables later. Everyone reads; Marketing (or admins) writes.

create or replace function public.is_marketing() returns boolean language sql stable security definer set search_path = public as $$
  select public.can_edit_group(public.group_id_of('marketing'))
$$;

-- ── Tag glossary: the 6 required tags only take values from here ──
create table public.tag_glossary (
  id          uuid primary key default gen_random_uuid(),
  tag_type    text not null check (tag_type in ('product', 'format', 'hook_visual', 'hook_message', 'audience', 'channel')),
  value       text not null check (length(value) between 1 and 60),
  description text,
  unique (tag_type, value)
);
insert into public.tag_glossary (tag_type, value, description) values
  ('format', 'reel', 'Instagram Reel'), ('format', 'carousel', 'Swipeable post'), ('format', 'story', 'Instagram Story'),
  ('format', 'tiktok', 'TikTok video'), ('format', 'static', 'Single image post'),
  ('channel', 'instagram', null), ('channel', 'tiktok', null), ('channel', 'whatsapp', null), ('channel', 'stall', 'In person'), ('channel', 'other', null),
  ('hook_visual', 'face to camera', null), ('hook_visual', 'product close-up', null), ('hook_visual', 'before / after', null), ('hook_visual', 'text on screen', null),
  ('hook_message', 'question', null), ('hook_message', 'bold claim', null), ('hook_message', 'problem → fix', null), ('hook_message', 'social proof', null),
  ('audience', 'students', null), ('audience', 'erasmus', null), ('audience', 'locals', null)
on conflict do nothing;

-- ── Content pipeline + metrics (the "what works" log) ──
create table public.content_items (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null default 'instagram',
  title         text not null check (length(title) between 1 and 160),
  caption       text,
  permalink     text,
  thumbnail_url text,
  campaign_id   uuid references public.campaigns(id) on delete set null,
  brief_id      uuid,
  tags          jsonb not null default '{}',   -- {product, format, hook_visual, hook_message, audience, channel}
  planned_for   date,
  posted_at     timestamptz,
  owner_id      uuid references public.profiles(id) on delete set null,
  status        text not null default 'idea' check (status in ('idea', 'briefed', 'production', 'scheduled', 'posted')),
  decision      text check (decision in ('scale', 'iterate', 'kill')),
  decision_why  text,
  external_id   text unique,                   -- Instagram media id once the sync exists
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index content_items_status_idx on public.content_items (status, planned_for);
create trigger content_items_touch before update on public.content_items for each row execute function public.set_updated_at();

create table public.content_metrics (
  id             uuid primary key default gen_random_uuid(),
  content_id     uuid not null references public.content_items(id) on delete cascade,
  age_hours      int not null check (age_hours in (24, 48, 168)),
  views          int check (views >= 0), reach int check (reach >= 0), likes int check (likes >= 0),
  comments       int check (comments >= 0), saves int check (saves >= 0), shares int check (shares >= 0),
  follows        int check (follows >= 0), profile_visits int check (profile_visits >= 0), link_clicks int check (link_clicks >= 0),
  watch_time_s   int check (watch_time_s >= 0),
  source         text not null default 'manual' check (source in ('manual', 'instagram', 'tiktok')),
  captured_at    timestamptz not null default now(),
  unique (content_id, age_hours)
);

-- Move the old content calendar rows into the new pipeline (kept, not deleted)
insert into public.content_items (platform, title, planned_for, posted_at, owner_id, status, created_at)
select platform, title, planned_for, posted_at, owner_id, case status when 'posted' then 'posted' when 'planned' then 'scheduled' else 'idea' end, created_at
from public.content_posts;

-- ── Briefs (one approver: the marketing leader) ──
create table public.briefs (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  goal             text, audience text, hypothesis text, message text, reason_to_believe text,
  hooks            text[] not null default '{}',
  customer_quote   text,
  deliverables     jsonb not null default '[]',  -- [{format, channel, specs, owner_id, due}]
  refs             text,
  driver_id        uuid references public.profiles(id) on delete set null,
  approver_id      uuid references public.profiles(id) on delete set null,
  contributors     uuid[] not null default '{}',
  informed         uuid[] not null default '{}',
  status           text not null default 'draft' check (status in ('draft', 'approved', 'production', 'live', 'reviewed')),
  campaign_id      uuid references public.campaigns(id) on delete set null,
  created_by       uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger briefs_touch before update on public.briefs for each row execute function public.set_updated_at();
alter table public.content_items add constraint content_items_brief_fk foreign key (brief_id) references public.briefs(id) on delete set null;

alter table public.campaigns
  add column if not exists objective text,
  add column if not exists target_metric text,
  add column if not exists target_value numeric,
  add column if not exists budget numeric(12,2) not null default 0,
  add column if not exists postmortem jsonb;

alter table public.experiments
  add column if not exists variable text,
  add column if not exists baseline numeric,
  add column if not exists result_value numeric,
  add column if not exists verdict text check (verdict in ('better', 'unclear', 'worse'));

-- ── Attribution: short links + clicks, discount codes, "how did you hear about us" ──
create table public.go_links (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  destination  text not null check (destination ~ '^https?://'),
  label        text,
  utm_source   text not null default 'instagram',
  utm_medium   text not null default 'social',
  utm_campaign text,
  campaign_id  uuid references public.campaigns(id) on delete set null,
  content_id   uuid references public.content_items(id) on delete set null,
  created_by   uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create table public.go_clicks (
  id        bigint generated always as identity primary key,
  link_id   uuid not null references public.go_links(id) on delete cascade,
  at        timestamptz not null default now(),
  referrer  text,
  device    text
);
create index go_clicks_link_idx on public.go_clicks (link_id, at desc);

create table public.discount_codes (
  code        text primary key check (code ~ '^[A-Z0-9-]{3,30}$'),
  channel     text not null,
  label       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.stall_sessions (
  id         uuid primary key default gen_random_uuid(),
  place      text not null,
  date       date not null default current_date,
  opened_at  time, closed_at time,
  staff      uuid[] not null default '{}',
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.sales
  add column if not exists heard_about text check (heard_about in ('instagram', 'tiktok', 'friend', 'stall', 'whatsapp', 'ambassador', 'poster', 'other')),
  add column if not exists code text references public.discount_codes(code) on delete set null,
  add column if not exists utm_source text,
  add column if not exists stall_id uuid references public.stall_sessions(id) on delete set null;

create table public.inquiries (
  id                 uuid primary key default gen_random_uuid(),
  platform           text not null default 'instagram',
  handle             text,
  product            text,
  date               date not null default current_date,
  converted_sale_id  uuid references public.sales(id) on delete set null,
  owner_id           uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);

create table public.swipe_file (
  id            uuid primary key default gen_random_uuid(),
  url           text check (url is null or url ~ '^https?://'),
  title         text not null,
  notes         text,
  tags          jsonb not null default '{}',
  is_competitor boolean not null default false,
  created_by    uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ── Permissions ──
do $$
declare t text;
begin
  foreach t in array array['tag_glossary', 'content_items', 'content_metrics', 'briefs', 'go_links', 'discount_codes', 'swipe_file'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_read on public.%1$I for select to authenticated using (public.is_member())', t);
    execute format('create policy %1$s_write on public.%1$I for all to authenticated using (public.is_marketing()) with check (public.is_marketing())', t);
  end loop;
end $$;
-- Inquiries: Marketing and Customer both talk to customers in DMs
grant select, insert, update, delete on public.inquiries to authenticated;
alter table public.inquiries enable row level security;
create policy inquiries_read on public.inquiries for select to authenticated using (public.is_member());
create policy inquiries_write on public.inquiries for all to authenticated
  using (public.is_marketing() or public.can_edit_group(public.group_id_of('customer')))
  with check (public.is_marketing() or public.can_edit_group(public.group_id_of('customer')));
-- Stall days: Marketing and Finance
grant select, insert, update, delete on public.stall_sessions to authenticated;
alter table public.stall_sessions enable row level security;
create policy stall_read on public.stall_sessions for select to authenticated using (public.is_member());
create policy stall_write on public.stall_sessions for all to authenticated
  using (public.is_marketing() or public.is_finance()) with check (public.is_marketing() or public.is_finance());
-- Clicks are written only by the public /go route (service role); the team can read them
grant select on public.go_clicks to authenticated;
alter table public.go_clicks enable row level security;
create policy go_clicks_read on public.go_clicks for select to authenticated using (public.is_member());

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.content_items, public.content_metrics, public.briefs, public.go_clicks, public.inquiries;
  end if;
end $$;
