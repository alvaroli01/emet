-- Minimal stand-in for the bits of Supabase the migrations rely on,
-- so the permission tests can run on plain Postgres (no Supabase account needed).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
grant usage on schema auth to authenticated, anon;

-- Supabase's auth.uid() reads the logged-in user's id from the request JWT
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to authenticated, anon;
