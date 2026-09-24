-- =========================================================
-- KED Finance — 0001_schema.sql
-- Core tables. Run in order: 0001 -> 0002 (RLS) -> 0003 (functions)
-- =========================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------
do $$ begin
  create type transaction_category as enum
    ('income', 'tithe', 'investment', 'giving', 'expense', 'savings');
exception when duplicate_object then null; end $$;

do $$ begin
  create type month_status as enum ('OPEN', 'CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_currency as enum ('NGN', 'USD', 'EUR', 'GBP');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_status as enum ('active', 'completed', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum
    ('salary_due', 'budget_warning', 'goal_progress', 'month_closing', 'system');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  currency app_currency not null default 'NGN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- MONTHLY ACCOUNTS
-- Allocation percentages are snapshotted per-row so that a global
-- config change (should one ever happen) never rewrites history.
-- ---------------------------------------------------------
create table if not exists public.monthly_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 2100),

  opening_balance numeric(14,2) not null default 0,
  total_income numeric(14,2) not null default 0,
  total_outflows numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  closing_balance numeric(14,2),
  carry_forward_amount numeric(14,2) not null default 0,

  status month_status not null default 'OPEN',

  -- immutable snapshot of the fixed allocation split at time of creation
  tithe_percentage numeric(5,4) not null default 0.10,
  investment_percentage numeric(5,4) not null default 0.30,
  giving_percentage numeric(5,4) not null default 0.30,
  expense_percentage numeric(5,4) not null default 0.20,
  savings_percentage numeric(5,4) not null default 0.10,

  -- running allocation totals per category (sum of income * percentage)
  tithe_allocated numeric(14,2) not null default 0,
  investment_allocated numeric(14,2) not null default 0,
  giving_allocated numeric(14,2) not null default 0,
  expense_allocated numeric(14,2) not null default 0,
  savings_allocated numeric(14,2) not null default 0,

  -- running "used" totals per category (sum of actual outflow transactions)
  tithe_used numeric(14,2) not null default 0,
  investment_used numeric(14,2) not null default 0,
  giving_used numeric(14,2) not null default 0,
  expense_used numeric(14,2) not null default 0,
  savings_used numeric(14,2) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  reopened_at timestamptz,

  constraint monthly_accounts_user_period_unique unique (user_id, year, month),
  constraint monthly_accounts_percentages_sum check (
    tithe_percentage + investment_percentage + giving_percentage
    + expense_percentage + savings_percentage = 1.0
  )
);

create index if not exists idx_monthly_accounts_user_period
  on public.monthly_accounts (user_id, year, month);

-- ---------------------------------------------------------
-- TRANSACTIONS
-- ---------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  monthly_account_id uuid not null references public.monthly_accounts(id) on delete cascade,
  category transaction_category not null,
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  narration text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_user on public.transactions (user_id);
create index if not exists idx_transactions_monthly_account on public.transactions (monthly_account_id);
create index if not exists idx_transactions_date on public.transactions (transaction_date);
create index if not exists idx_transactions_user_category on public.transactions (user_id, category);

-- ---------------------------------------------------------
-- SAVINGS GOALS
-- ---------------------------------------------------------
create table if not exists public.savings_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  target_date date,
  status goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_savings_goals_user on public.savings_goals (user_id);

-- Optional link table: a savings transaction MAY be attributed to a goal,
-- but only when the user explicitly confirms it (see rule #14 in spec).
create table if not exists public.savings_goal_contributions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (transaction_id)
);

-- ---------------------------------------------------------
-- NOTIFICATIONS / REMINDERS
-- ---------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type notification_type not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  scheduled_for timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications (user_id, read);

-- ---------------------------------------------------------
-- EXPECTED INCOME / RECURRING REMINDERS (optional per spec §27)
-- ---------------------------------------------------------
create table if not exists public.expected_income (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  expected_amount numeric(14,2) not null check (expected_amount > 0),
  expected_date date,
  frequency text not null default 'monthly' check (frequency in ('weekly','biweekly','monthly','custom')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_expected_income_user on public.expected_income (user_id);

-- ---------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_monthly_accounts_updated_at on public.monthly_accounts;
create trigger trg_monthly_accounts_updated_at before update on public.monthly_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_savings_goals_updated_at on public.savings_goals;
create trigger trg_savings_goals_updated_at before update on public.savings_goals
  for each row execute function public.set_updated_at();

drop trigger if exists trg_expected_income_updated_at on public.expected_income;
create trigger trg_expected_income_updated_at before update on public.expected_income
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- auto-create profile row on signup
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
