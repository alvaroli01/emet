-- Audio is kept 60 days (free storage is 1 GB); transcripts and notes are kept forever.
-- The daily cron (/api/health) asks for expired files, deletes them through the Storage API, then marks the docs.
create or replace function public.expired_recordings(p_days int default 60)
returns setof text language sql stable security definer set search_path = public as $$
  select o.name from storage.objects o
  where o.bucket_id = 'recordings' and o.created_at < now() - make_interval(days => p_days)
  order by o.created_at
  limit 1000
$$;
revoke all on function public.expired_recordings(int) from public, anon, authenticated;
grant execute on function public.expired_recordings(int) to service_role;

create or replace function public.mark_audio_expired(p_days int default 60)
returns int language sql security definer set search_path = public as $$
  with d as (
    update public.docs set audio_parts = 0
    where audio_parts > 0 and created_at < now() - make_interval(days => p_days)
    returning 1)
  select count(*)::int from d
$$;
revoke all on function public.mark_audio_expired(int) from public, anon, authenticated;
grant execute on function public.mark_audio_expired(int) to service_role;
