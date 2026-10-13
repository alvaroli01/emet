-- emet HQ — stamp "finished" times automatically when a status changes
-- complaints → resolved_at · blockers → resolved_at · design_requests → delivered_at · content_posts → posted_at

create or replace function public.stamp_status_time()
returns trigger language plpgsql as $$
declare
  status_col text := tg_argv[0];
  done_value text := tg_argv[1];
  time_col   text := tg_argv[2];
  new_status text := to_jsonb(new)->>status_col;
  old_status text := case when tg_op = 'UPDATE' then to_jsonb(old)->>status_col end;
  row_json   jsonb := to_jsonb(new);
begin
  if new_status = done_value and (old_status is distinct from done_value) and row_json->>time_col is null then
    row_json := jsonb_set(row_json, array[time_col], to_jsonb(now()));
  elsif new_status is distinct from done_value then
    row_json := jsonb_set(row_json, array[time_col], 'null'::jsonb);
  end if;
  new := jsonb_populate_record(new, row_json);
  return new;
end $$;

create trigger complaints_resolved before insert or update on public.complaints
  for each row execute function public.stamp_status_time('status', 'resolved', 'resolved_at');
create trigger blockers_resolved before insert or update on public.blockers
  for each row execute function public.stamp_status_time('status', 'resolved', 'resolved_at');
create trigger design_requests_delivered before insert or update on public.design_requests
  for each row execute function public.stamp_status_time('status', 'delivered', 'delivered_at');
create trigger content_posts_posted before insert or update on public.content_posts
  for each row execute function public.stamp_status_time('status', 'posted', 'posted_at');
