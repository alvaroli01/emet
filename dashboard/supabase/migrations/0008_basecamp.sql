-- Base camp: each member's private working area.
-- Private by default: only the owner can read or change their rows. Admins can NOT see them.
-- The one exception is docs, which the owner may share with chosen teammates or the whole team (read-only for them).

create table public.docs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  title       text not null default '',
  body        text not null default '',
  kind        text not null default 'note' check (kind in ('note', 'meeting')),
  pinned      boolean not null default false,
  tags        text[] not null default '{}',
  share_all   boolean not null default false,
  shared_with uuid[] not null default '{}',
  doc_date    date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index docs_owner_idx on public.docs (owner_id, updated_at desc);
create index docs_shared_idx on public.docs using gin (shared_with);

create table public.ideas (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  text       text not null,
  color      text not null default 'sand',
  x          real not null default 40,
  y          real not null default 40,
  created_at timestamptz not null default now()
);
create index ideas_owner_idx on public.ideas (owner_id);

create table public.week_plans (
  owner_id   uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  week_start date not null,
  priorities text[] not null default '{}',
  went_well  text not null default '',
  to_improve text not null default '',
  learned    text not null default '',
  updated_at timestamptz not null default now(),
  primary key (owner_id, week_start)
);

create table public.agenda_items (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  title      text not null,
  day        date not null,
  start_time time,
  end_time   time,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
create index agenda_owner_day_idx on public.agenda_items (owner_id, day);

-- Vault: the browser encrypts everything (AES-GCM, key derived from the member's vault passphrase).
-- The database only ever stores ciphertext; nobody — including admins — can read it.
create table public.vault_keys (
  owner_id   uuid primary key default public.my_profile_id() references public.profiles(id) on delete cascade,
  salt       text not null,
  check_iv   text not null,
  check_data text not null,
  created_at timestamptz not null default now()
);
create table public.vault_items (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  iv         text not null,
  data       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vault_items_owner_idx on public.vault_items (owner_id);

grant select, insert, update, delete on public.docs, public.ideas, public.week_plans,
  public.agenda_items, public.vault_keys, public.vault_items to authenticated;

-- ── Row Level Security ──────────────────────────────────────
alter table public.docs         enable row level security;
alter table public.ideas        enable row level security;
alter table public.week_plans   enable row level security;
alter table public.agenda_items enable row level security;
alter table public.vault_keys   enable row level security;
alter table public.vault_items  enable row level security;

create policy docs_read on public.docs for select to authenticated
  using (public.is_member() and (
    owner_id = (select public.my_profile_id())
    or share_all
    or (select public.my_profile_id()) = any (shared_with)));
create policy docs_insert on public.docs for insert to authenticated
  with check (owner_id = (select public.my_profile_id()));
create policy docs_update on public.docs for update to authenticated
  using (owner_id = (select public.my_profile_id())) with check (owner_id = (select public.my_profile_id()));
create policy docs_delete on public.docs for delete to authenticated
  using (owner_id = (select public.my_profile_id()));

do $$
declare t text;
begin
  foreach t in array array['ideas', 'week_plans', 'agenda_items', 'vault_keys', 'vault_items'] loop
    execute format(
      'create policy %1$s_owner on public.%1$I for all to authenticated
         using (owner_id = (select public.my_profile_id()))
         with check (owner_id = (select public.my_profile_id()))', t);
  end loop;
end $$;

-- Keep updated_at fresh (function from 0001_schema.sql)
create trigger docs_touch before update on public.docs for each row execute function public.set_updated_at();
create trigger week_plans_touch before update on public.week_plans for each row execute function public.set_updated_at();
create trigger vault_items_touch before update on public.vault_items for each row execute function public.set_updated_at();
