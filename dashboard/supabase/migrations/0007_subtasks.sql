-- Projects: a card's checklist items become small tasks, each with its own person and due date.
-- Permissions are unchanged: whoever can edit the card can edit its tasks (checklist_write policy).
alter table public.card_checklist_items
  add column if not exists assignee_id uuid references public.profiles(id) on delete set null,
  add column if not exists due_on date;
create index if not exists card_checklist_items_assignee_idx on public.card_checklist_items (assignee_id);
