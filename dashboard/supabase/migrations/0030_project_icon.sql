-- Project icon: a small photo leaders upload; stored in the private "projects" bucket at <project id>/icon/<file>.
alter table public.projects add column if not exists icon_path text check (icon_path is null or char_length(icon_path) <= 300);
