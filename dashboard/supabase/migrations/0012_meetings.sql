-- Meeting log: recordings shared with the whole team (notes + transcript + audio), kept forever.
-- Leaders' meetings are visible only to leaders (Team Leader group or admins).
create table public.meetings (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid not null default public.my_profile_id() references public.profiles(id) on delete set null,
  title        text not null,
  kind         text not null check (kind in ('training', 'phone', 'video', 'leaders')),
  meeting_date date not null default current_date,
  status       text not null default 'recording' check (status in ('recording', 'ready')),
  notes        text not null default '',
  transcript   text not null default '',
  audio_parts  int not null default 0,
  minutes      int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index meetings_date_idx on public.meetings (meeting_date desc, created_at desc);
create index meetings_created_by_idx on public.meetings (created_by);
grant select, insert, update, delete on public.meetings to authenticated;
alter table public.meetings enable row level security;

create policy meetings_read on public.meetings for select to authenticated
  using (public.is_member() and (kind <> 'leaders' or public.is_admin()));
create policy meetings_insert on public.meetings for insert to authenticated
  with check (created_by = (select public.my_profile_id()) and (kind <> 'leaders' or public.is_admin()));
create policy meetings_update on public.meetings for update to authenticated
  using (created_by = (select public.my_profile_id()) or public.is_admin())
  with check (kind <> 'leaders' or public.is_admin());
create policy meetings_delete on public.meetings for delete to authenticated
  using (created_by = (select public.my_profile_id()) or public.is_admin());
create trigger meetings_touch before update on public.meetings for each row execute function public.set_updated_at();

-- Live updates: a new meeting appears for everyone without refreshing
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.meetings;
  end if;
end $$;

-- Audio in its own bucket (meetings/<meeting id>/chunk-N): never touched by the 60-day cleanup.
-- Who can listen follows who can see the meeting row (so leaders' audio stays with leaders).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('meetings', 'meetings', false, 10485760, array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'])
    on conflict (id) do nothing;
    drop policy if exists meetings_audio_read on storage.objects;
    drop policy if exists meetings_audio_insert on storage.objects;
    drop policy if exists meetings_audio_delete on storage.objects;
    create policy meetings_audio_read on storage.objects for select to authenticated
      using (bucket_id = 'meetings' and exists (select 1 from public.meetings m where m.id::text = (storage.foldername(name))[1]));
    create policy meetings_audio_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'meetings' and exists (select 1 from public.meetings m
        where m.id::text = (storage.foldername(name))[1] and m.created_by = (select public.my_profile_id())));
    create policy meetings_audio_delete on storage.objects for delete to authenticated
      using (bucket_id = 'meetings' and exists (select 1 from public.meetings m
        where m.id::text = (storage.foldername(name))[1] and (m.created_by = (select public.my_profile_id()) or public.is_admin())));
  end if;
end $$;

-- Storage used by all audio, for the admins' meter (free plan: 1 GB)
create or replace function public.audio_storage_bytes()
returns bigint language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then coalesce(sum((o.metadata->>'size')::bigint), 0) else null end
  from storage.objects o where o.bucket_id in ('recordings', 'meetings')
$$;
revoke all on function public.audio_storage_bytes() from public, anon;
grant execute on function public.audio_storage_bytes() to authenticated;
