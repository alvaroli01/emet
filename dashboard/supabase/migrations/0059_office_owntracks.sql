-- Alvaro, 2026-11-11: phones check in with the free OwnTracks app. Near the office but undecided (30–80 m), emet asks
-- OwnTracks for fresh positions for up to 10 minutes; this remembers since when it has been asking.
alter table public.office_links add column if not exists wait_since timestamptz;
