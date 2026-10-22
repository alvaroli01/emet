-- Notion (2026-10-22): each member connects their OWN Notion workspace(s) by OAuth. Tokens are encrypted
-- (AES-256-GCM, AI_KEY_SECRET) and readable only by their owner and the server; admins included can't see them.
-- No Notion content is stored here — it is fetched live with the member's own token.
create table if not exists public.notion_connections (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  workspace_id     text not null,
  workspace_name   text,
  workspace_icon   text,
  bot_id           text,
  token_iv         text not null,
  token_data       text not null,          -- encrypted JSON {access_token, refresh_token}
  needs_reconnect  boolean not null default false,
  deadlines_ds     text,                   -- data source id of the chosen deadlines database
  deadlines_map    jsonb,                  -- {"title":"Name","date":"Due","done":"Status","doneValue":"Done"}
  save_parent      text,                   -- page id that "Save to Notion" creates pages under
  created_at       timestamptz not null default now(),
  unique (owner_id, workspace_id)
);
grant select, insert, update, delete on public.notion_connections to authenticated;
grant select, update on public.notion_connections to service_role;
alter table public.notion_connections enable row level security;
create policy notion_connections_owner on public.notion_connections for all to authenticated
  using (owner_id = (select public.my_profile_id())) with check (owner_id = (select public.my_profile_id()));

-- "Save to Notion": remembers each exported item so the button then opens it instead of making a copy
create table if not exists public.notion_exports (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('meeting', 'doc', 'idea', 'project_update')),
  source_id       uuid not null,
  notion_page_id  text not null,
  url             text not null,
  created_at      timestamptz not null default now(),
  unique (owner_id, kind, source_id)
);
grant select, insert, update, delete on public.notion_exports to authenticated;
alter table public.notion_exports enable row level security;
create policy notion_exports_owner on public.notion_exports for all to authenticated
  using (owner_id = (select public.my_profile_id())) with check (owner_id = (select public.my_profile_id()));
