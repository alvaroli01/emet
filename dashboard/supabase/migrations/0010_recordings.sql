-- Note-taker audio: every recording is kept in the owner's private storage folder
-- (recordings/<profile id>/<doc id>/chunk-N.webm). Only the owner can upload, list, play or delete it.
alter table public.docs add column if not exists audio_parts int not null default 0;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('recordings', 'recordings', false, 10485760, array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'])
    on conflict (id) do nothing;

    drop policy if exists recordings_owner_read on storage.objects;
    drop policy if exists recordings_owner_insert on storage.objects;
    drop policy if exists recordings_owner_delete on storage.objects;
    create policy recordings_owner_read on storage.objects for select to authenticated
      using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select public.my_profile_id())::text);
    create policy recordings_owner_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select public.my_profile_id())::text);
    create policy recordings_owner_delete on storage.objects for delete to authenticated
      using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select public.my_profile_id())::text);
  end if;
end $$;
