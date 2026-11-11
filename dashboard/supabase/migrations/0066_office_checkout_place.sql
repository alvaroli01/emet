-- Alvaro, 2026-11-11: "I'm out" works anywhere. Checked out away from Dock = the exact spot is kept and shown in the
-- team calendar (only the distance-from-Dock is kept at Dock).
alter table public.office_visits add column if not exists out_lat double precision, add column if not exists out_lng double precision,
  add column if not exists out_distance_m integer;
