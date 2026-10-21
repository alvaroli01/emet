-- Scout key pool (2026-10-21): members can lend their free Groq key to Scout (opt-in, off by default).
-- Scout uses a lent key for at most 60% of each model's daily allowance, so its owner keeps the rest.
-- Keys stay readable only by their owner and the server (service role) — admins included can't see them.
alter table public.ai_keys add column if not exists lend_scout boolean not null default false;
grant select on public.ai_keys to service_role;

create table if not exists public.ai_key_usage (
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  day           date not null default ((now() at time zone 'utc')::date),
  model         text not null,
  tokens        integer not null default 0,
  limited_until timestamptz,
  bad           boolean not null default false,
  primary key (owner_id, day, model)
);
grant select on public.ai_key_usage to authenticated;
grant select, insert, update, delete on public.ai_key_usage to service_role;
alter table public.ai_key_usage enable row level security;
create policy ai_key_usage_owner on public.ai_key_usage for select to authenticated
  using (owner_id = (select public.my_profile_id()));

-- Server only: add tokens / a wait / a rejected key atomically (two searches at once never overwrite each other)
create or replace function public.ai_usage_event(p_owner uuid, p_model text, p_tokens integer, p_until timestamptz, p_bad boolean)
returns void language sql security definer set search_path = public as $$
  insert into public.ai_key_usage (owner_id, model, tokens, limited_until, bad)
  values (p_owner, p_model, greatest(coalesce(p_tokens, 0), 0), p_until, coalesce(p_bad, false))
  on conflict (owner_id, day, model) do update
    set tokens = ai_key_usage.tokens + excluded.tokens,
        limited_until = coalesce(excluded.limited_until, ai_key_usage.limited_until),
        bad = ai_key_usage.bad or excluded.bad
$$;
revoke execute on function public.ai_usage_event(uuid, text, integer, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.ai_usage_event(uuid, text, integer, timestamptz, boolean) to service_role;

-- Who lends a key to Scout — names only, members only
create or replace function public.scout_lenders() returns table (full_name text)
language sql stable security definer set search_path = public as $$
  select p.full_name from public.ai_keys k join public.profiles p on p.id = k.owner_id
  where k.lend_scout and p.active and public.is_member() order by p.full_name
$$;
revoke execute on function public.scout_lenders() from public, anon;
grant execute on function public.scout_lenders() to authenticated;

-- Tokens a search used (shown in its log)
alter table public.scout_searches add column if not exists tokens integer not null default 0;
