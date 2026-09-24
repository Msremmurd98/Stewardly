-- =========================================================
-- KED Finance — 0002_rls.sql
-- Row Level Security. Every user-owned table is locked to auth.uid().
-- Client-supplied user_id values are never trusted: inserts derive
-- user_id from auth.uid() via the RPCs in 0003_functions.sql, and the
-- WITH CHECK clauses below are a second, independent backstop.
-- =========================================================

alter table public.profiles enable row level security;
alter table public.monthly_accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_goal_contributions enable row level security;
alter table public.notifications enable row level security;
alter table public.expected_income enable row level security;

-- ---------------------------------------------------------
-- PROFILES: a user can only see/update their own profile row
-- ---------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- no public insert policy: profile rows are created only by the
-- handle_new_user() trigger (security definer), never directly by clients.

-- ---------------------------------------------------------
-- MONTHLY ACCOUNTS
-- ---------------------------------------------------------
drop policy if exists "monthly_accounts_select_own" on public.monthly_accounts;
create policy "monthly_accounts_select_own" on public.monthly_accounts
  for select using (auth.uid() = user_id);

drop policy if exists "monthly_accounts_insert_own" on public.monthly_accounts;
create policy "monthly_accounts_insert_own" on public.monthly_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists "monthly_accounts_update_own" on public.monthly_accounts;
create policy "monthly_accounts_update_own" on public.monthly_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Direct client deletes of monthly accounts are never allowed - there is
-- deliberately no delete policy here.

-- ---------------------------------------------------------
-- TRANSACTIONS
-- Direct client INSERT/UPDATE/DELETE against this table is intentionally
-- NOT exposed as the primary write path — writes go through the RPCs in
-- 0003_functions.sql so overspending checks and monthly-account totals
-- stay consistent. Policies still exist as a correct baseline in case a
-- future feature needs direct access, and so RLS is never silently absent.
-- ---------------------------------------------------------
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- SAVINGS GOALS
-- ---------------------------------------------------------
drop policy if exists "savings_goals_select_own" on public.savings_goals;
create policy "savings_goals_select_own" on public.savings_goals
  for select using (auth.uid() = user_id);

drop policy if exists "savings_goals_insert_own" on public.savings_goals;
create policy "savings_goals_insert_own" on public.savings_goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "savings_goals_update_own" on public.savings_goals;
create policy "savings_goals_update_own" on public.savings_goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "savings_goals_delete_own" on public.savings_goals;
create policy "savings_goals_delete_own" on public.savings_goals
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- SAVINGS GOAL CONTRIBUTIONS
-- ---------------------------------------------------------
drop policy if exists "sgc_select_own" on public.savings_goal_contributions;
create policy "sgc_select_own" on public.savings_goal_contributions
  for select using (auth.uid() = user_id);

drop policy if exists "sgc_insert_own" on public.savings_goal_contributions;
create policy "sgc_insert_own" on public.savings_goal_contributions
  for insert with check (auth.uid() = user_id);

drop policy if exists "sgc_delete_own" on public.savings_goal_contributions;
create policy "sgc_delete_own" on public.savings_goal_contributions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- NOTIFICATIONS
-- Users may read and mark their own notifications read, but never insert
-- arbitrary notifications for themselves (that would allow forging
-- "system" messages) — inserts happen only via security-definer RPCs.
-- ---------------------------------------------------------
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------
-- EXPECTED INCOME
-- ---------------------------------------------------------
drop policy if exists "expected_income_select_own" on public.expected_income;
create policy "expected_income_select_own" on public.expected_income
  for select using (auth.uid() = user_id);

drop policy if exists "expected_income_insert_own" on public.expected_income;
create policy "expected_income_insert_own" on public.expected_income
  for insert with check (auth.uid() = user_id);

drop policy if exists "expected_income_update_own" on public.expected_income;
create policy "expected_income_update_own" on public.expected_income
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "expected_income_delete_own" on public.expected_income;
create policy "expected_income_delete_own" on public.expected_income
  for delete using (auth.uid() = user_id);
