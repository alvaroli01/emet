-- Alvaro, 2026-10-28:
-- 1. Scout: anyone can search in (and work the leads of) any SHARED Scout project, not only its creator and the selling
--    teams — people could only make new projects. Changing a project's setup stays with its creator and the selling
--    teams; private projects stay private.
-- 2. Every Sunday everyone is told who leads training the coming week (and it goes to their phones).

create or replace function public.can_work_scout(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.can_see_scout(p)
$$;
grant execute on function public.can_work_scout(uuid) to authenticated;

drop policy if exists scout_searches_write on public.scout_searches;
create policy scout_searches_write on public.scout_searches for all to authenticated
  using (public.can_work_scout(project_id)) with check (public.can_work_scout(project_id));
drop policy if exists scout_leads_write on public.scout_leads;
create policy scout_leads_write on public.scout_leads for all to authenticated
  using (public.can_work_scout(project_id)) with check (public.can_work_scout(project_id));

-- Several leads → one of my projects: from any Scout project I can work in
create or replace function public.save_leads_to_project(p_leads uuid[], p uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_project_member(p) then raise exception 'emet: you are not in that project'; end if;
  if exists (select 1 from scout_leads l where l.id = any(p_leads) and not public.can_work_scout(l.project_id)) then
    raise exception 'emet: you can only add leads from Scout projects you can see';
  end if;
  update scout_leads set saved_project_id = p where id = any(p_leads);
  get diagnostics n = row_count;
  return n;
end $$;

-- ── Sunday: next week's training leaders, to everyone ────────
create or replace function public.notify_training_week(p_day date default (now() at time zone 'Europe/Madrid')::date)
returns int language plpgsql security definer set search_path = public as $$
declare n int; week date := p_day + 1; names text;
begin
  if extract(isodow from p_day) <> 7 then return 0; end if;
  select string_agg(split_part(p.full_name, ' ', 1), ' & ' order by p.full_name) into names
  from training_leaders tl join profiles p on p.id = tl.user_id where tl.week_start = week;
  if names is null then return 0; end if;
  insert into notifications (user_id, kind, data, link, dedupe)
  select p.id, 'training_week', jsonb_build_object('names', names, 'week', week), '/g/team-leader?tab=training', 'training-week:' || week
  from profiles p where p.active and p.user_id is not null
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.notify_training_week(date) from public, anon, authenticated;
grant execute on function public.notify_training_week(date) to service_role;

create or replace function public.push_worthy(p_kind text, p_data jsonb) returns boolean language sql immutable as $$
  select p_kind in ('assigned', 'team_task', 'due_soon', 'project_added', 'training_week', 'training_lead')
      or (p_kind = 'project_post' and p_data->>'what' = 'project_files')
$$;
