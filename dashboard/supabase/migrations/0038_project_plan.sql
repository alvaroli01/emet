-- Project plan (Alvaro, 2026-10-27): Finance → Projects shows every project with what it is expected to bring in
-- and cost. Expected revenue is the existing `goal` (the same number the project page measures progress against),
-- `budget` already exists; this adds expected profit. Finance and admins edit these (policy projects_update, 0027).
alter table public.projects add column if not exists expected_profit numeric(12,2);
