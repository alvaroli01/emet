-- emet HQ — language: empty until the member picks one, so new members see their browser's language
alter table public.profiles alter column locale drop not null;
alter table public.profiles alter column locale drop default;
update public.profiles set locale = null where locale = 'en' and user_id is null;
