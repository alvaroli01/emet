-- 0068: logged-out visitors (the public "anon" key) could call our database
-- functions directly, e.g. /rest/v1/rpc/leader_ids, active_member_ids,
-- strike_total. Tables were already closed; functions were not.
-- Every function the app uses is called by a signed-in member or the server,
-- so: keep exactly who can call what today for signed-in members, and remove
-- anon + PUBLIC. Found with the vibe-security / supabase-audit-rls skills.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_ok
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    if f.auth_ok then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

-- New functions: closed to anon from now on (signed-in members keep access,
-- same as before; a migration can still revoke it per function).
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public grant execute on functions to authenticated, service_role;
