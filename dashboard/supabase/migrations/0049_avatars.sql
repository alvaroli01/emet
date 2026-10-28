-- Profile pictures: everyone can see them; each person (or an admin) changes their own.
-- Public bucket so <img> works everywhere without signed links; files go to avatars/<profile id>/<time>.jpg.
-- The browser shrinks the photo to 512 px JPEG first, so 2 MB is plenty.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
    drop policy if exists avatars_upload on storage.objects;
    drop policy if exists avatars_delete on storage.objects;
    create policy avatars_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and public.is_member()
                  and ((storage.foldername(name))[1] = (select public.my_profile_id())::text or public.is_admin()));
    create policy avatars_delete on storage.objects for delete to authenticated
      using (bucket_id = 'avatars'
             and ((storage.foldername(name))[1] = (select public.my_profile_id())::text or public.is_admin()));
  end if;
end $$;
