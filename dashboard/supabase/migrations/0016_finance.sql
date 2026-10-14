-- Finance tab upgrade (spec: Stefan, 14 Oct 2026): projects, payment methods, receipts, expense claims,
-- cash counts, month close (locked months can't change), audit log, no hard deletes (fixes = reversing entries),
-- Google Sheet sync queue, product linking behind a feature switch (off).

create or replace function public.is_finance() returns boolean language sql stable security definer set search_path = public as $$
  select public.can_edit_group(public.group_id_of('finance'))
$$;

-- ── Feature switches ─────────────────────────────────────────
create table public.app_flags (key text primary key, enabled boolean not null default false, updated_at timestamptz not null default now());
insert into public.app_flags (key, enabled) values ('product_linking', false) on conflict do nothing;
grant select, update on public.app_flags to authenticated;
alter table public.app_flags enable row level security;
create policy app_flags_read on public.app_flags for select to authenticated using (public.is_member());
create policy app_flags_admin on public.app_flags for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Projects ─────────────────────────────────────────────────
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 80),
  description text,
  owner_id    uuid references public.profiles(id) on delete set null,
  status      text not null default 'planning' check (status in ('planning', 'live', 'closed')),
  starts_on   date,
  ends_on     date,
  budget      numeric(12,2) check (budget is null or budget >= 0),
  color       text not null default '#2f7d4f',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger projects_touch before update on public.projects for each row execute function public.set_updated_at();
grant select, insert, update on public.projects to authenticated;
alter table public.projects enable row level security;
create policy projects_read on public.projects for select to authenticated using (public.is_member());
create policy projects_write on public.projects for insert to authenticated with check (public.is_finance());
create policy projects_update on public.projects for update to authenticated using (public.is_finance()) with check (public.is_finance());

-- ── Ledger columns ───────────────────────────────────────────
alter table public.sales
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists payment_method text check (payment_method in ('cash', 'bizum', 'card', 'transfer', 'other')),
  add column if not exists item_id uuid references public.inventory(id) on delete set null,
  add column if not exists quantity int not null default 1 check (quantity > 0),
  add column if not exists reverses_id uuid references public.sales(id),
  add column if not exists reason text;
alter table public.expenses
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists payment_method text check (payment_method in ('cash', 'bizum', 'card', 'transfer', 'other')),
  add column if not exists receipt_path text,
  add column if not exists reverses_id uuid references public.expenses(id),
  add column if not exists reason text;
-- Reversals carry negative amounts so totals stay right
alter table public.sales drop constraint if exists sales_amount_check;
alter table public.sales drop constraint if exists sales_cost_check;
alter table public.expenses drop constraint if exists expenses_amount_check;
alter table public.sales add constraint sales_amount_sign check (amount >= 0 or reverses_id is not null);
alter table public.sales add constraint sales_cost_sign check (cost >= 0 or reverses_id is not null);
alter table public.expenses add constraint expenses_amount_sign check (amount >= 0 or reverses_id is not null);
create index if not exists sales_project_idx on public.sales (project_id);
create index if not exists expenses_project_idx on public.expenses (project_id);
alter table public.inventory add column if not exists low_stock int check (low_stock is null or low_stock >= 0);

-- Nothing is ever hard-deleted from the ledgers: replace "for all" write policies with insert + update only
drop policy if exists sales_write on public.sales;
drop policy if exists expenses_write on public.expenses;
create policy sales_insert on public.sales for insert to authenticated with check (public.is_finance());
create policy sales_update on public.sales for update to authenticated using (public.is_finance()) with check (public.is_finance());
create policy expenses_insert on public.expenses for insert to authenticated with check (public.is_finance());
create policy expenses_update on public.expenses for update to authenticated using (public.is_finance()) with check (public.is_finance());

-- ── Month close ──────────────────────────────────────────────
create table public.month_locks (
  month      date primary key check (extract(day from month) = 1),
  locked_by  uuid references public.profiles(id) on delete set null default public.my_profile_id(),
  locked_at  timestamptz not null default now()
);
grant select, insert, delete on public.month_locks to authenticated;
alter table public.month_locks enable row level security;
create policy month_locks_read on public.month_locks for select to authenticated using (public.is_member());
create policy month_locks_write on public.month_locks for insert to authenticated with check (public.is_finance());
create policy month_locks_reopen on public.month_locks for delete to authenticated using (public.is_admin());

create or replace function public.guard_locked_month() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from month_locks where month = date_trunc('month', coalesce(new.date, old.date))::date)
     or (tg_op = 'UPDATE' and exists (select 1 from month_locks where month = date_trunc('month', old.date)::date)) then
    raise exception 'emet: % is closed. Add a reversing entry in an open month instead.', to_char(coalesce(old.date, new.date), 'YYYY-MM');
  end if;
  return coalesce(new, old);
end $$;
create trigger sales_locked before insert or update or delete on public.sales for each row execute function public.guard_locked_month();
create trigger expenses_locked before insert or update or delete on public.expenses for each row execute function public.guard_locked_month();

-- ── Audit log (who changed what, before/after) ───────────────
create table public.finance_audit (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     uuid,
  action     text not null,
  before     jsonb,
  after      jsonb,
  actor_id   uuid references public.profiles(id) on delete set null,
  at         timestamptz not null default now()
);
create index finance_audit_at_idx on public.finance_audit (at desc);
grant select on public.finance_audit to authenticated;
alter table public.finance_audit enable row level security;
create policy finance_audit_read on public.finance_audit for select to authenticated using (public.is_finance());

-- Every change also queues a Google Sheet sync for that tab (processed by /api/books/sync, retried by the daily job)
create table public.sheet_sync_queue (
  id         bigint generated always as identity primary key,
  tab        text not null,
  created_at timestamptz not null default now(),
  attempts   int not null default 0,
  last_error text
);
alter table public.sheet_sync_queue enable row level security;  -- server only (no policies)
create or replace function public.sheet_sync_pending() returns int language sql stable security definer set search_path = public as $$
  select count(distinct tab)::int from public.sheet_sync_queue
$$;
grant execute on function public.sheet_sync_pending() to authenticated;

create or replace function public.trg_finance_audit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into finance_audit (table_name, row_id, action, before, after, actor_id)
  values (tg_table_name, coalesce(new.id, old.id), lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end, case when tg_op <> 'DELETE' then to_jsonb(new) end, public.my_profile_id());
  insert into sheet_sync_queue (tab) values (tg_table_name);
  return coalesce(new, old);
end $$;
create trigger sales_audit after insert or update or delete on public.sales for each row execute function public.trg_finance_audit();
create trigger expenses_audit after insert or update or delete on public.expenses for each row execute function public.trg_finance_audit();
create trigger inventory_audit after insert or update or delete on public.inventory for each row execute function public.trg_finance_audit();
create trigger projects_audit after insert or update or delete on public.projects for each row execute function public.trg_finance_audit();

-- ── Product linking (switch OFF by default): a sale of a stock item lowers stock and fills cost of goods ──
create or replace function public.trg_sale_stock() returns trigger language plpgsql security definer set search_path = public as $$
declare unit numeric;
begin
  if new.item_id is null or new.reverses_id is not null
     or not coalesce((select enabled from app_flags where key = 'product_linking'), false) then
    return new;
  end if;
  update inventory set stock = stock - new.quantity where id = new.item_id returning unit_cost into unit;
  if coalesce(new.cost, 0) = 0 and unit is not null then new.cost := round(unit * new.quantity, 2); end if;
  return new;
end $$;
create trigger sales_stock before insert on public.sales for each row execute function public.trg_sale_stock();

-- ── Expense claims (any member; Finance approves) ────────────
create table public.expense_claims (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null default public.my_profile_id() references public.profiles(id) on delete cascade,
  date           date not null default current_date,
  amount         numeric(12,2) not null check (amount > 0),
  description    text not null check (length(description) between 2 and 300),
  category       text,
  project_id     uuid references public.projects(id) on delete set null,
  payment_method text check (payment_method in ('cash', 'bizum', 'card', 'transfer', 'other')),
  receipt_path   text,
  status         text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'reimbursed')),
  reason         text,
  expense_id     uuid references public.expenses(id) on delete set null,
  decided_by     uuid references public.profiles(id) on delete set null,
  decided_at     timestamptz,
  reimbursed_at  timestamptz,
  created_at     timestamptz not null default now()
);
create index expense_claims_status_idx on public.expense_claims (status, created_at desc);
grant select, insert, update on public.expense_claims to authenticated;
alter table public.expense_claims enable row level security;
create policy claims_read on public.expense_claims for select to authenticated using (member_id = (select public.my_profile_id()) or public.is_finance());
create policy claims_submit on public.expense_claims for insert to authenticated
  with check (member_id = (select public.my_profile_id()) and status = 'submitted' and expense_id is null and decided_by is null);
create policy claims_decide on public.expense_claims for update to authenticated using (public.is_finance()) with check (public.is_finance());

-- ── Cash counts ──────────────────────────────────────────────
create table public.cash_counts (
  id          uuid primary key default gen_random_uuid(),
  counted_at  timestamptz not null default now(),
  counted     numeric(12,2) not null check (counted >= 0),
  expected    numeric(12,2) not null,
  note        text,
  counted_by  uuid default public.my_profile_id() references public.profiles(id) on delete set null
);
grant select, insert on public.cash_counts to authenticated;
alter table public.cash_counts enable row level security;
create policy cash_counts_read on public.cash_counts for select to authenticated using (public.is_finance());
create policy cash_counts_write on public.cash_counts for insert to authenticated with check (public.is_finance());

-- ── Receipts bucket (private): receipts/<uploader profile id>/<file> ──
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;
    drop policy if exists receipts_upload on storage.objects;
    drop policy if exists receipts_read on storage.objects;
    create policy receipts_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select public.my_profile_id())::text);
    create policy receipts_read on storage.objects for select to authenticated
      using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = (select public.my_profile_id())::text or public.is_finance()));
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.projects, public.expense_claims, public.month_locks;
  end if;
end $$;
-- TODO(permissions): the Bookkeeper section is open to the whole Finance group + admins for now. A later step
-- restricts it to the Financial leader and Bookkeeper roles, with its own tests (see README section 10).
