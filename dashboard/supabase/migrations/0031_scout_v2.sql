-- Scout v2 phase 1: exact Google Maps links, Overture (Open Places API) as a source, an evidence level per lead,
-- a relevance-filter step, and leads saved to one of our projects (My Projects).
alter table public.scout_places add column if not exists maps_url text check (maps_url is null or maps_url ~* '^https://');
alter table public.scout_places drop constraint if exists scout_places_source_check;
alter table public.scout_places add constraint scout_places_source_check check (source in ('osm', 'web', 'manual', 'google', 'overture'));

alter table public.scout_searches drop constraint if exists scout_searches_status_check;
alter table public.scout_searches add constraint scout_searches_status_check check (status in ('queued', 'finding', 'filtering', 'researching', 'done', 'failed'));

alter table public.scout_leads add column if not exists evidence text check (evidence in ('strong', 'some', 'little', 'none'));
alter table public.scout_leads add column if not exists saved_project_id uuid references public.projects(id) on delete set null;
create index if not exists scout_leads_saved_project_idx on public.scout_leads (saved_project_id) where saved_project_id is not null;
