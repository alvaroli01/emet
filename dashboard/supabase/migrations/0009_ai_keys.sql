-- Note-taker: each member connects their OWN free Groq account (own daily audio allowance).
-- The key is encrypted by the server (AES-256-GCM, secret in the AI_KEY_SECRET env var) before it is stored,
-- and only its owner's requests can read the row. Nobody else — admins included — can see or use it.
create table public.ai_keys (
  owner_id   uuid primary key default public.my_profile_id() references public.profiles(id) on delete cascade,
  provider   text not null default 'groq' check (provider in ('groq')),
  key_iv     text not null,
  key_data   text not null,
  last4      text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ai_keys to authenticated;
alter table public.ai_keys enable row level security;
create policy ai_keys_owner on public.ai_keys for all to authenticated
  using (owner_id = (select public.my_profile_id()))
  with check (owner_id = (select public.my_profile_id()));
