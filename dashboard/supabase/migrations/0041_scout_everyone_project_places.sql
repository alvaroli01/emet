-- Scout for everyone (Alvaro, 2026-10-27): any member can create a Scout project for their own idea and run it.
-- Customer, Marketing and admins (can_scout) still work on every Scout project; everyone else only on their own.
-- Project places (same day): in a project's Leads, members add businesses they found themselves, mark them visited and
-- whether it went well (yes / maybe / no). Scout leads saved to a project can be marked visited the same way.

create or replace function public.can_scout_project(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.can_scout() or exists (select 1 from public.scout_projects s where s.id = p and s.created_by = public.my_profile_id() and public.is_member())
$$;
grant execute on function public.can_scout_project(uuid) to authenticated;

drop policy if exists scout_projects_write on public.scout_projects;
create policy scout_projects_insert on public.scout_projects for insert to authenticated
  with check (public.can_scout() or (public.is_member() and created_by = public.my_profile_id()));
create policy scout_projects_update on public.scout_projects for update to authenticated
  using (public.can_scout_project(id)) with check (public.can_scout_project(id));
create policy scout_projects_delete on public.scout_projects for delete to authenticated using (public.can_scout_project(id));

drop policy if exists scout_searches_write on public.scout_searches;
create policy scout_searches_write on public.scout_searches for all to authenticated
  using (public.can_scout_project(project_id)) with check (public.can_scout_project(project_id));

drop policy if exists scout_leads_write on public.scout_leads;
create policy scout_leads_write on public.scout_leads for all to authenticated
  using (public.can_scout_project(project_id)) with check (public.can_scout_project(project_id));

-- Places and their research are a shared cache (found once, reused by every project): any member's search may add or
-- refresh them; only the selling teams delete.
drop policy if exists scout_places_write on public.scout_places;
create policy scout_places_insert on public.scout_places for insert to authenticated with check (public.is_member());
create policy scout_places_update on public.scout_places for update to authenticated using (public.is_member()) with check (public.is_member());
create policy scout_places_delete on public.scout_places for delete to authenticated using (public.can_scout());
drop policy if exists scout_research_write on public.scout_research;
create policy scout_research_insert on public.scout_research for insert to authenticated with check (public.is_member());
create policy scout_research_update on public.scout_research for update to authenticated using (public.is_member()) with check (public.is_member());
create policy scout_research_delete on public.scout_research for delete to authenticated using (public.can_scout());

-- ── Project places ───────────────────────────────────────────
create table public.project_places (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  address       text check (address is null or char_length(address) <= 300),
  contact       text check (contact is null or char_length(contact) <= 300),
  note          text check (note is null or char_length(note) <= 1000),
  visited_on    date,
  visit_result  text check (visit_result in ('yes', 'maybe', 'no')),
  visit_note    text check (visit_note is null or char_length(visit_note) <= 1000),
  added_by      uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index project_places_project_idx on public.project_places (project_id, created_at desc);
create trigger project_places_touch before update on public.project_places for each row execute function public.set_updated_at();
grant select, insert, update, delete on public.project_places to authenticated;
alter table public.project_places enable row level security;
create policy project_places_read on public.project_places for select to authenticated
  using (public.is_project_member(project_id) or public.is_finance());
create policy project_places_insert on public.project_places for insert to authenticated
  with check (public.is_project_member(project_id) and added_by = (select public.my_profile_id()));
create policy project_places_update on public.project_places for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));
create policy project_places_delete on public.project_places for delete to authenticated
  using (added_by = (select public.my_profile_id()) or public.is_admin());

-- Scout leads saved to a project: its members mark the visit (they may not be allowed to edit Scout itself)
alter table public.scout_leads
  add column if not exists visited_on   date,
  add column if not exists visit_result text check (visit_result in ('yes', 'maybe', 'no')),
  add column if not exists visit_note   text check (visit_note is null or char_length(visit_note) <= 1000);

create or replace function public.mark_lead_visit(p_lead uuid, p_on date, p_result text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare proj uuid;
begin
  select saved_project_id into proj from scout_leads where id = p_lead;
  if proj is null or not public.is_project_member(proj) then
    raise exception 'emet: only this project''s people can mark the visit';
  end if;
  update scout_leads set visited_on = p_on, visit_result = p_result, visit_note = nullif(trim(p_note), '') where id = p_lead;
end $$;
revoke all on function public.mark_lead_visit(uuid, date, text, text) from public, anon;
grant execute on function public.mark_lead_visit(uuid, date, text, text) to authenticated;
