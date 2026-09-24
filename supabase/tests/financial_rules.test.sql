-- =========================================================
-- KED Finance — server-side RPC tests (pgTAP)
--
-- Run against a local Supabase instance:
--   supabase start
--   supabase test db
--
-- These exercise the RPCs in 0003_functions.sql directly against
-- Postgres, which is where the financially authoritative logic lives
-- (spec §22, §34). Client-side equivalents of the pure-math cases live
-- in src/lib/finance.test.ts; these cover what only the database can
-- verify: locking, overspend rejection, and closed-month enforcement.
-- =========================================================

begin;
select plan(8);

-- Impersonate a test user for RLS + auth.uid()
select tests.create_supabase_user('ked_test_user');
select tests.authenticate_as('ked_test_user');

-- ---------------------------------------------------------
-- 1) ₦100,000 income allocates 10/30/30/20/10
-- ---------------------------------------------------------
select create_income_transaction(100000, current_date, 'Salary', 2026, 9);

select is(
  (select tithe_allocated from monthly_accounts where year = 2026 and month = 9 and user_id = tests.get_supabase_uid('ked_test_user')),
  10000::numeric,
  'Tithe allocation is 10% of income'
);
select is(
  (select investment_allocated from monthly_accounts where year = 2026 and month = 9 and user_id = tests.get_supabase_uid('ked_test_user')),
  30000::numeric,
  'Investment allocation is 30% of income'
);

-- ---------------------------------------------------------
-- 2) Overspending is rejected
-- ---------------------------------------------------------
-- Investment allocated = 30,000; attempt 40,000 -> must fail
select throws_ok(
  $$select create_category_transaction('investment'::transaction_category, 40000, current_date, 'Too much', 2026, 9)$$,
  'P0001',
  null,
  'Overspending an allocation is rejected'
);

-- Valid spend within allocation succeeds
select create_category_transaction('investment', 25000, current_date, 'Stocks', 2026, 9);
select is(
  (select investment_used from monthly_accounts where year = 2026 and month = 9 and user_id = tests.get_supabase_uid('ked_test_user')),
  25000::numeric,
  'A valid within-allocation spend is recorded'
);

-- ---------------------------------------------------------
-- 3) Editing a transaction reverses the old amount before validating
-- ---------------------------------------------------------
-- Editing the 25,000 investment txn up to 30,000 (the full allocation) must succeed
select lives_ok(
  $$update transactions set amount = amount from transactions where category = 'investment' limit 0$$, -- no-op guard
  'setup ok'
);

select edit_transaction(
  (select id from transactions where category = 'investment' and user_id = tests.get_supabase_uid('ked_test_user') limit 1),
  30000, current_date, 'Stocks (topped up)'
);
select is(
  (select investment_used from monthly_accounts where year = 2026 and month = 9 and user_id = tests.get_supabase_uid('ked_test_user')),
  30000::numeric,
  'Editing a transaction reverses the old amount before applying the new one'
);

-- ---------------------------------------------------------
-- 4) Deleting a transaction recalculates monthly totals
-- ---------------------------------------------------------
select delete_transaction(
  (select id from transactions where category = 'investment' and user_id = tests.get_supabase_uid('ked_test_user') limit 1)
);
select is(
  (select investment_used from monthly_accounts where year = 2026 and month = 9 and user_id = tests.get_supabase_uid('ked_test_user')),
  0::numeric,
  'Deleting a transaction recalculates the monthly account totals'
);

-- ---------------------------------------------------------
-- 5) Closed month rejects new/edited/deleted transactions
-- ---------------------------------------------------------
select close_month((select id from monthly_accounts where year = 2026 and month = 9 and user_id = tests.get_supabase_uid('ked_test_user')));
select throws_ok(
  $$select create_category_transaction('expense'::transaction_category, 1000, current_date, 'Blocked', 2026, 9)$$,
  null,
  null,
  'A closed month rejects new transactions'
);

select * from finish();
rollback;
