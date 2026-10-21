-- Project tick-off tasks: the same "From the team leader" tasks (team_tasks) can belong to one project.
-- Then only that project's people (and leaders) see them, and the notification opens the project.
alter table public.team_tasks add column if not exists project_id uuid references public.projects(id) on delete cascade;
create index if not exists team_tasks_project_idx on public.team_tasks (project_id);

drop policy if exists team_tasks_read on public.team_tasks;
create policy team_tasks_read on public.team_tasks for select to authenticated
  using (case when project_id is null then public.is_member() else public.is_project_member(project_id) end);

drop policy if exists team_task_people_read on public.team_task_people;
create policy team_task_people_read on public.team_task_people for select to authenticated
  using (exists (select 1 from public.team_tasks t where t.id = task_id
                 and case when t.project_id is null then public.is_member() else public.is_project_member(t.project_id) end));

create or replace function public.trg_notify_team_task() returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select title, created_by, project_id into t from public.team_tasks where id = new.task_id;
  if new.user_id is distinct from t.created_by then
    perform public.notify(array[new.user_id], 'team_task', jsonb_build_object('title', t.title),
      case when t.project_id is null then '/my-tasks#team-tasks' else '/projects/' || t.project_id || '?tab=tasks' end, t.created_by);
  end if;
  return new;
end $$;
