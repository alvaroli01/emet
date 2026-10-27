-- Scout + Harvey's playbook (Alvaro, 2026-10-28): each lead keeps the ONE reason to contact it today
-- ({kind, text, url, date} — see src/lib/scout/signals.ts); the opener is written around it.
alter table public.scout_leads add column if not exists hook jsonb;
