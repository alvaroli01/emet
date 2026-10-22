-- Coach (2026-10-22): a teacher (Leire) who can VIEW everything and ADD tasks on the General board and every
-- team's board (and assign people to them), but only edit/delete the tasks she created. Nothing else: no money,
-- no lists/settings, no people. A coach has no group; only admins can make someone a coach.
alter table public.profiles add column if not exists is_coach boolean not null default false;

create or replace function public.is_coach() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and active and is_coach)
$$;

-- Only admins can change who is a coach (same guard as group, role and admin status)
create or replace function public.guard_profile_self_edit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then   -- admins, or server-side jobs
    return new;
  end if;
  if new.group_id   is distinct from old.group_id
  or new.role_title is distinct from old.role_title
  or new.is_admin   is distinct from old.is_admin
  or new.is_coach   is distinct from old.is_coach
  or new.email      is distinct from old.email
  or new.active     is distinct from old.active
  or new.user_id    is distinct from old.user_id then
    raise exception 'emet: only team leaders can change group, role, email, coach or admin status';
  end if;
  return new;
end $$;

-- Add a task: a coach may add to any team board (not project boards, which stay leaders-only)
create or replace function public.can_add_card(p_board_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case when b.project_id is not null then public.is_admin()
                               when b.group_id is null then public.is_member()
                               else public.can_edit_group(b.group_id) or public.is_coach() end
                   from public.boards b where b.id = p_board_id), false)
$$;

-- Edit a task: on team boards a coach edits only the tasks she created (and so assigns people / checklist on them)
create or replace function public.can_edit_card(p_card_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select case
             when b.project_id is not null then public.is_project_member(b.project_id)
             when b.group_id is not null then public.can_edit_group(b.group_id) or (public.is_coach() and c.created_by = public.my_profile_id())
             else public.is_admin() or c.created_by = public.my_profile_id()
                  or exists (select 1 from public.card_assignees a where a.card_id = c.id and a.user_id = public.my_profile_id())
           end
      from public.cards c join public.boards b on b.id = c.board_id where c.id = p_card_id), false)
$$;
