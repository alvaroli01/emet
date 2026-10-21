-- Documents: company documents (team leaders add them in Team Leader, everyone can open them) and each person's
-- private My folder. Files live in the private "documents" bucket: company/<file id>/<name> and
-- personal/<profile id>/<file id>/<name>. Personal files are only ever visible to their owner — admins included.
create table public.doc_folders (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null check (scope in ('company', 'personal')),
  owner_id   uuid references public.profiles(id) on delete cascade,
  parent_id  uuid references public.doc_folders(id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  created_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((scope = 'company') = (owner_id is null))
);
create index doc_folders_parent_idx on public.doc_folders (parent_id);
create index doc_folders_owner_idx on public.doc_folders (owner_id);

create table public.doc_files (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('company', 'personal')),
  owner_id    uuid references public.profiles(id) on delete cascade,
  folder_id   uuid references public.doc_folders(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  size        bigint not null check (size between 0 and 26214400),
  mime        text not null default 'application/octet-stream',
  path        text not null unique,
  uploaded_by uuid default public.my_profile_id() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check ((scope = 'company') = (owner_id is null))
);
create index doc_files_folder_idx on public.doc_files (folder_id);
create index doc_files_owner_idx on public.doc_files (owner_id);

-- A folder/file must live in a folder of the same scope and owner
create or replace function public.trg_doc_same_place() returns trigger language plpgsql set search_path = public as $$
declare p record; pid uuid;
begin
  pid := (to_jsonb(new) ->> case when tg_table_name = 'doc_folders' then 'parent_id' else 'folder_id' end)::uuid;
  if pid is null then return new; end if;
  select scope, owner_id into p from public.doc_folders where id = pid;
  if not found or p.scope <> new.scope or p.owner_id is distinct from new.owner_id then
    raise exception 'documents: folder belongs somewhere else';
  end if;
  return new;
end $$;
create trigger doc_folders_same_place before insert or update on public.doc_folders for each row execute function public.trg_doc_same_place();
create trigger doc_files_same_place before insert or update on public.doc_files for each row execute function public.trg_doc_same_place();

grant select, insert, update, delete on public.doc_folders, public.doc_files to authenticated;
alter table public.doc_folders enable row level security;
alter table public.doc_files enable row level security;
do $$ declare t text; begin
  foreach t in array array['doc_folders', 'doc_files'] loop
    execute format($f$create policy %1$s_read on public.%1$s for select to authenticated
      using ((scope = 'company' and public.is_member()) or owner_id = (select public.my_profile_id()))$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check ((scope = 'company' and public.is_admin()) or (scope = 'personal' and owner_id = (select public.my_profile_id())))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$s for update to authenticated
      using ((scope = 'company' and public.is_admin()) or owner_id = (select public.my_profile_id()))
      with check ((scope = 'company' and public.is_admin()) or (scope = 'personal' and owner_id = (select public.my_profile_id())))$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$s for delete to authenticated
      using ((scope = 'company' and public.is_admin()) or owner_id = (select public.my_profile_id()))$f$, t);
  end loop;
end $$;

-- Total size of all documents (both scopes) for the leaders' storage bar — only the number, never whose files
create or replace function public.documents_storage_used() returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(size), 0)::bigint from public.doc_files where public.is_member()
$$;
grant execute on function public.documents_storage_used() to authenticated;

-- Everyone hears about a new company document
create or replace function public.trg_notify_company_doc() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(array(select id from public.profiles where active), 'company_doc',
    jsonb_build_object('name', new.name), '/me/documents', new.uploaded_by);
  return new;
end $$;
create trigger notify_company_doc after insert on public.doc_files for each row when (new.scope = 'company')
  execute function public.trg_notify_company_doc();

-- Storage: private bucket, 25 MB per file, any type
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('documents', 'documents', false, 26214400) on conflict (id) do nothing;
    create policy documents_read on storage.objects for select to authenticated using (bucket_id = 'documents' and (
      ((storage.foldername(name))[1] = 'company' and public.is_member())
      or ((storage.foldername(name))[1] = 'personal' and (storage.foldername(name))[2] = (select public.my_profile_id())::text)));
    create policy documents_insert on storage.objects for insert to authenticated with check (bucket_id = 'documents' and (
      ((storage.foldername(name))[1] = 'company' and public.is_admin())
      or ((storage.foldername(name))[1] = 'personal' and (storage.foldername(name))[2] = (select public.my_profile_id())::text)));
    create policy documents_delete on storage.objects for delete to authenticated using (bucket_id = 'documents' and (
      ((storage.foldername(name))[1] = 'company' and public.is_admin())
      or ((storage.foldername(name))[1] = 'personal' and (storage.foldername(name))[2] = (select public.my_profile_id())::text)));
  end if;
end $$;
