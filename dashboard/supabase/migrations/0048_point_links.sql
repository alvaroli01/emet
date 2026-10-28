-- Points can carry a link (e.g. the post, the workshop page) next to the optional file (Alvaro, 2026-10-28).
-- Editing already works through member_points_update (own entries, or admins).
alter table public.member_points
  add column if not exists link text check (link is null or (link ~ '^https?://' and char_length(link) <= 500));
