-- Alvaro, 2026-11-23: on Exposing Slackers people can add proof of what they did — a file (photo, PDF, doc…) or a link.
-- Everyone in the class can open it (it's shown on the screen). Only the owner adds/removes, and only in an open week.

create table public.slacker_proofs (
  id         uuid primary key default gen_random_uuid(),
  week_start date not null check (extract(isodow from week_start) = 1),
  user_id    uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  file_path  text,
  file_name  text check (char_length(file_name) <= 200),
  link       text check (link ~* '^https?://' and char_length(link) <= 1000),
  created_at timestamptz not null default now(),
  check ((file_path is not null) <> (link is not null))
);
create index slacker_proofs_week on public.slacker_proofs (week_start, user_id);
grant select, insert, update, delete on public.slacker_proofs to authenticated;
alter table public.slacker_proofs enable row level security;
create policy slacker_proofs_read on public.slacker_proofs for select to authenticated using (public.is_member() or public.is_coach());
create policy slacker_proofs_own_write on public.slacker_proofs for all to authenticated
  using (user_id = public.my_profile_id() and public.slacker_week_open(week_start))
  with check (user_id = public.my_profile_id() and public.is_member() and public.slacker_week_open(week_start)
    and (file_path is null or (storage.foldername(file_path))[1] = public.my_profile_id()::text));

-- Private bucket: slacker-proof/<profile id>/<week>/<file>, 10 MB. Owner uploads/deletes; the class can open.
insert into storage.buckets (id, name, public, file_size_limit)
values ('slacker-proof', 'slacker-proof', false, 10485760)
on conflict (id) do nothing;
create policy slacker_proof_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'slacker-proof' and (storage.foldername(name))[1] = (select public.my_profile_id())::text);
create policy slacker_proof_delete on storage.objects for delete to authenticated
  using (bucket_id = 'slacker-proof' and (storage.foldername(name))[1] = (select public.my_profile_id())::text);
create policy slacker_proof_read on storage.objects for select to authenticated
  using (bucket_id = 'slacker-proof' and (public.is_member() or public.is_coach()));
