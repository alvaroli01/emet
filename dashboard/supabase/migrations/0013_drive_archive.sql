-- Meeting audio archive: after 30 days, audio moves from Supabase Storage (1 GB free) to the team's
-- Google Drive (15 GB free). It keeps playing from the Meeting log through the dashboard, which checks
-- that the listener may see the meeting.

-- Server-only secrets (Google refresh token, Drive folder id). Encrypted by the app; no policies = no client access.
create table public.app_secrets (
  key        text primary key,
  iv         text not null,
  data       text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

-- Where each archived part lives in Drive
create table public.meeting_audio (
  meeting_id    uuid not null references public.meetings(id) on delete cascade,
  part          text not null,           -- original file name, e.g. chunk-003.webm (keeps playback order)
  drive_file_id text not null,
  bytes         bigint not null default 0,
  archived_at   timestamptz not null default now(),
  primary key (meeting_id, part)
);
grant select on public.meeting_audio to authenticated;
alter table public.meeting_audio enable row level security;
create policy meeting_audio_read on public.meeting_audio for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_id));  -- follows meeting visibility

-- Meeting audio files older than N days that are still in Supabase Storage (service role only)
create or replace function public.meeting_audio_to_archive(p_days int default 30, p_limit int default 200)
returns table (name text, bytes bigint) language sql stable security definer set search_path = public as $$
  select o.name, coalesce((o.metadata->>'size')::bigint, 0)
  from storage.objects o
  where o.bucket_id = 'meetings' and o.created_at < now() - make_interval(days => p_days)
  order by o.created_at
  limit p_limit
$$;
revoke all on function public.meeting_audio_to_archive(int, int) from public, anon, authenticated;
grant execute on function public.meeting_audio_to_archive(int, int) to service_role;

-- Admin meter: audio still in Supabase vs. moved to Drive
create or replace function public.archived_audio_bytes()
returns bigint language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then coalesce(sum(bytes), 0) else null end from public.meeting_audio
$$;
revoke all on function public.archived_audio_bytes() from public, anon;
grant execute on function public.archived_audio_bytes() to authenticated;
