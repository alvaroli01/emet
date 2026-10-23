-- Training leaders (Alvaro, 2026-10-23): one or more people lead the training sessions for a whole week (Mon–Sun),
-- planned up to 19 Dec 2026. Everyone sees who leads; admins set them. On Monday the daily job tells that week's leaders.
create table public.training_leaders (
  week_start  date not null check (extract(isodow from week_start) = 1),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_by  uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (week_start, user_id)
);
create index training_leaders_user_idx on public.training_leaders (user_id);
grant select, insert, update, delete on public.training_leaders to authenticated;
grant select on public.training_leaders to service_role;
alter table public.training_leaders enable row level security;
create policy training_leaders_read on public.training_leaders for select to authenticated using (public.is_member());
create policy training_leaders_insert on public.training_leaders for insert to authenticated with check (public.is_admin());
create policy training_leaders_update on public.training_leaders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy training_leaders_delete on public.training_leaders for delete to authenticated using (public.is_admin());

-- Daily (cron): on a Monday, "You lead training this week" for that week's leaders (once each)
create or replace function public.notify_training_leaders(p_day date default (now() at time zone 'Europe/Madrid')::date)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if extract(isodow from p_day) <> 1 then return 0; end if;
  insert into notifications (user_id, kind, data, link, dedupe)
  select tl.user_id, 'training_lead', jsonb_build_object('week', p_day), '/g/team-leader?tab=training', 'training:' || p_day
  from training_leaders tl join profiles p on p.id = tl.user_id and p.active and p.user_id is not null
  where tl.week_start = p_day
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.notify_training_leaders(date) from public, anon, authenticated;
grant execute on function public.notify_training_leaders(date) to service_role;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.training_leaders;
  end if;
end $$;
