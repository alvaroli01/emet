-- Task pop-up (2026-10-22): "you got a task" notifications also carry the due date, so the live pop-up can say
-- "New task for you: <title> · due Fri 24 Oct". Same triggers as before, one more field.
create or replace function public.trg_notify_assigned() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(array[new.user_id], 'assigned',
    (select jsonb_strip_nulls(jsonb_build_object('title', c.title, 'due', c.due_at)) from public.cards c where c.id = new.card_id),
    public.card_link(new.card_id), public.my_profile_id());
  return new;
end $$;

create or replace function public.trg_notify_team_task() returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select title, created_by, project_id, due_on into t from public.team_tasks where id = new.task_id;
  if new.user_id is distinct from t.created_by then
    perform public.notify(array[new.user_id], 'team_task', jsonb_strip_nulls(jsonb_build_object('title', t.title, 'due', t.due_on)),
      case when t.project_id is null then '/my-tasks#team-tasks' else '/projects/' || t.project_id || '?tab=tasks' end, t.created_by);
  end if;
  return new;
end $$;
