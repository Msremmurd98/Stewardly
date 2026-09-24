-- =========================================================
-- KED Finance — 0003_functions.sql
-- All financially authoritative logic lives here, not in the client.
-- Every function is SECURITY DEFINER but derives the acting user
-- exclusively from auth.uid() — no function accepts a user_id
-- parameter, so a client can never write or read on behalf of
-- another user. The fixed 10/30/30/20/10 split is hard-coded below
-- and is never read from client input.
-- =========================================================

-- ---------------------------------------------------------
-- get_or_create_monthly_account
-- Creates the month on first use, seeding its opening_balance from
-- the previous month's closing_balance (carry-forward). If the
-- previous month has no row or is still open with no closing_balance,
-- opening_balance is 0 — carry-forward only ever comes from an
-- explicit closing balance, never guessed.
-- ---------------------------------------------------------
create or replace function public.get_or_create_monthly_account(p_year int, p_month int)
returns public.monthly_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.monthly_accounts;
  v_prev public.monthly_accounts;
  v_prev_year int;
  v_prev_month int;
  v_opening numeric(14,2) := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_account from public.monthly_accounts
    where user_id = v_user_id and year = p_year and month = p_month;
  if found then
    return v_account;
  end if;

  if p_month = 1 then
    v_prev_month := 12; v_prev_year := p_year - 1;
  else
    v_prev_month := p_month - 1; v_prev_year := p_year;
  end if;

  select * into v_prev from public.monthly_accounts
    where user_id = v_user_id and year = v_prev_year and month = v_prev_month;

  if found and v_prev.closing_balance is not null then
    v_opening := v_prev.closing_balance;
  else
    v_opening := 0;
  end if;

  insert into public.monthly_accounts (
    user_id, month, year, opening_balance, current_balance, carry_forward_amount,
    tithe_percentage, investment_percentage, giving_percentage, expense_percentage, savings_percentage
  ) values (
    v_user_id, p_month, p_year, v_opening, v_opening, v_opening,
    0.10, 0.30, 0.30, 0.20, 0.10   -- fixed allocation, never client-supplied
  )
  returning * into v_account;

  return v_account;
end;
$$;

grant execute on function public.get_or_create_monthly_account(int, int) to authenticated;

-- ---------------------------------------------------------
-- calculate_monthly_account
-- The single source of truth for a month's derived numbers.
-- Recomputes allocated/used/outflows/balance directly from the
-- transactions table. Locks the row (FOR UPDATE) so concurrent
-- writes to the same month serialize instead of racing.
-- ---------------------------------------------------------
create or replace function public.calculate_monthly_account(p_monthly_account_id uuid)
returns public.monthly_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.monthly_accounts;
  v_income numeric(14,2);
  v_tithe_used numeric(14,2);
  v_investment_used numeric(14,2);
  v_giving_used numeric(14,2);
  v_expense_used numeric(14,2);
  v_savings_used numeric(14,2);
  v_outflows numeric(14,2);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_account from public.monthly_accounts
    where id = p_monthly_account_id and user_id = v_user_id
    for update;
  if not found then
    raise exception 'Monthly account not found';
  end if;

  select coalesce(sum(amount), 0) into v_income from public.transactions
    where monthly_account_id = p_monthly_account_id and category = 'income';
  select coalesce(sum(amount), 0) into v_tithe_used from public.transactions
    where monthly_account_id = p_monthly_account_id and category = 'tithe';
  select coalesce(sum(amount), 0) into v_investment_used from public.transactions
    where monthly_account_id = p_monthly_account_id and category = 'investment';
  select coalesce(sum(amount), 0) into v_giving_used from public.transactions
    where monthly_account_id = p_monthly_account_id and category = 'giving';
  select coalesce(sum(amount), 0) into v_expense_used from public.transactions
    where monthly_account_id = p_monthly_account_id and category = 'expense';
  select coalesce(sum(amount), 0) into v_savings_used from public.transactions
    where monthly_account_id = p_monthly_account_id and category = 'savings';

  v_outflows := v_tithe_used + v_investment_used + v_giving_used + v_expense_used + v_savings_used;

  update public.monthly_accounts set
    total_income = v_income,
    tithe_allocated = round(v_income * tithe_percentage, 2),
    investment_allocated = round(v_income * investment_percentage, 2),
    giving_allocated = round(v_income * giving_percentage, 2),
    expense_allocated = round(v_income * expense_percentage, 2),
    savings_allocated = round(v_income * savings_percentage, 2),
    tithe_used = v_tithe_used,
    investment_used = v_investment_used,
    giving_used = v_giving_used,
    expense_used = v_expense_used,
    savings_used = v_savings_used,
    total_outflows = v_outflows,
    current_balance = opening_balance + v_income - v_outflows
  where id = p_monthly_account_id
  returning * into v_account;

  return v_account;
end;
$$;

grant execute on function public.calculate_monthly_account(uuid) to authenticated;

-- ---------------------------------------------------------
-- create_income_transaction
-- ---------------------------------------------------------
create or replace function public.create_income_transaction(
  p_amount numeric, p_date date, p_narration text, p_year int, p_month int
) returns public.monthly_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.monthly_accounts;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;

  v_account := public.get_or_create_monthly_account(p_year, p_month);
  if v_account.status = 'CLOSED' then
    raise exception 'This month is closed. Reopen it before adding transactions.';
  end if;

  insert into public.transactions (user_id, monthly_account_id, category, amount, transaction_date, narration)
  values (v_user_id, v_account.id, 'income', p_amount, coalesce(p_date, current_date), p_narration);

  return public.calculate_monthly_account(v_account.id);
end;
$$;

grant execute on function public.create_income_transaction(numeric, date, text, int, int) to authenticated;

-- ---------------------------------------------------------
-- create_category_transaction
-- Enforces: amount <= (allocated - used) for the category, and that
-- the month is not closed. This is the ONLY path that should be used
-- to record tithe/investment/giving/expense/savings transactions.
-- ---------------------------------------------------------
create or replace function public.create_category_transaction(
  p_category transaction_category, p_amount numeric, p_date date, p_narration text,
  p_year int, p_month int
) returns public.monthly_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.monthly_accounts;
  v_allocated numeric(14,2);
  v_used numeric(14,2);
  v_remaining numeric(14,2);
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_category = 'income' then raise exception 'Use create_income_transaction for income'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;

  v_account := public.get_or_create_monthly_account(p_year, p_month);
  if v_account.status = 'CLOSED' then
    raise exception 'This month is closed. Reopen it before adding transactions.';
  end if;

  -- refresh derived totals under lock before validating, to prevent races
  v_account := public.calculate_monthly_account(v_account.id);

  v_allocated := case p_category
    when 'tithe' then v_account.tithe_allocated
    when 'investment' then v_account.investment_allocated
    when 'giving' then v_account.giving_allocated
    when 'expense' then v_account.expense_allocated
    when 'savings' then v_account.savings_allocated
  end;
  v_used := case p_category
    when 'tithe' then v_account.tithe_used
    when 'investment' then v_account.investment_used
    when 'giving' then v_account.giving_used
    when 'expense' then v_account.expense_used
    when 'savings' then v_account.savings_used
  end;
  v_remaining := v_allocated - v_used;

  if p_amount > v_remaining then
    raise exception 'Insufficient % allocation. Available: %',
      initcap(p_category::text), trim(to_char(v_remaining, 'FM999,999,999,990.00'));
  end if;

  insert into public.transactions (user_id, monthly_account_id, category, amount, transaction_date, narration)
  values (v_user_id, v_account.id, p_category, p_amount, coalesce(p_date, current_date), p_narration);

  return public.calculate_monthly_account(v_account.id);
end;
$$;

grant execute on function public.create_category_transaction(transaction_category, numeric, date, text, int, int) to authenticated;

-- ---------------------------------------------------------
-- edit_transaction
-- Reverses the old amount before validating and applying the new one,
-- so a category can never be edited into an over-allocated state.
-- ---------------------------------------------------------
create or replace function public.edit_transaction(
  p_transaction_id uuid, p_amount numeric, p_date date, p_narration text
) returns public.monthly_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_txn public.transactions;
  v_account public.monthly_accounts;
  v_allocated numeric(14,2);
  v_used_excluding numeric(14,2);
  v_remaining numeric(14,2);
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;

  select * into v_txn from public.transactions
    where id = p_transaction_id and user_id = v_user_id;
  if not found then raise exception 'Transaction not found'; end if;

  select * into v_account from public.monthly_accounts
    where id = v_txn.monthly_account_id and user_id = v_user_id
    for update;
  if v_account.status = 'CLOSED' then
    raise exception 'This month is closed. Reopen it before editing transactions.';
  end if;

  if v_txn.category <> 'income' then
    v_account := public.calculate_monthly_account(v_account.id);
    v_allocated := case v_txn.category
      when 'tithe' then v_account.tithe_allocated
      when 'investment' then v_account.investment_allocated
      when 'giving' then v_account.giving_allocated
      when 'expense' then v_account.expense_allocated
      when 'savings' then v_account.savings_allocated
    end;
    v_used_excluding := (case v_txn.category
      when 'tithe' then v_account.tithe_used
      when 'investment' then v_account.investment_used
      when 'giving' then v_account.giving_used
      when 'expense' then v_account.expense_used
      when 'savings' then v_account.savings_used
    end) - v_txn.amount;
    v_remaining := v_allocated - v_used_excluding;

    if p_amount > v_remaining then
      raise exception 'Insufficient % allocation. Available: %',
        initcap(v_txn.category::text), trim(to_char(v_remaining, 'FM999,999,999,990.00'));
    end if;
  end if;

  update public.transactions set
    amount = p_amount,
    transaction_date = coalesce(p_date, transaction_date),
    narration = p_narration
  where id = p_transaction_id;

  return public.calculate_monthly_account(v_account.id);
end;
$$;

grant execute on function public.edit_transaction(uuid, numeric, date, text) to authenticated;

-- ---------------------------------------------------------
-- delete_transaction
-- ---------------------------------------------------------
create or replace function public.delete_transaction(p_transaction_id uuid)
returns public.monthly_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_txn public.transactions;
  v_account public.monthly_accounts;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select * into v_txn from public.transactions
    where id = p_transaction_id and user_id = v_user_id;
  if not found then raise exception 'Transaction not found'; end if;

  select * into v_account from public.monthly_accounts
    where id = v_txn.monthly_account_id and user_id = v_user_id
    for update;
  if v_account.status = 'CLOSED' then
    raise exception 'This month is closed. Reopen it before deleting transactions.';
  end if;

  delete from public.transactions where id = p_transaction_id;

  return public.calculate_monthly_account(v_account.id);
end;
$$;

grant execute on function public.delete_transaction(uuid) to authenticated;

-- ---------------------------------------------------------
-- close_month
-- Freezes the month: recalculates one last time, stamps
-- closing_balance from current_balance, marks CLOSED.
-- Once CLOSED, every write RPC above refuses to touch its transactions.
-- ---------------------------------------------------------
create or replace function public.close_month(p_monthly_account_id uuid)
returns public.monthly_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.monthly_accounts;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select * into v_account from public.monthly_accounts
    where id = p_monthly_account_id and user_id = v_user_id
    for update;
  if not found then raise exception 'Monthly account not found'; end if;
  if v_account.status = 'CLOSED' then raise exception 'Month is already closed'; end if;

  v_account := public.calculate_monthly_account(p_monthly_account_id);

  update public.monthly_accounts set
    status = 'CLOSED',
    closing_balance = v_account.current_balance,
    carry_forward_amount = v_account.current_balance,
    closed_at = now()
  where id = p_monthly_account_id
  returning * into v_account;

  return v_account;
end;
$$;

grant execute on function public.close_month(uuid) to authenticated;

-- ---------------------------------------------------------
-- reopen_month
-- Requires explicit confirmation on the client (a second tap / typed
-- confirmation) before this is ever called — the function itself just
-- performs the state change once called. If a later month already
-- exists and has pulled this month's closing_balance forward as its
-- opening_balance, that later month's opening_balance is intentionally
-- left untouched here; call carry_forward_balance() afterwards for the
-- affected following month once this month's totals change again.
-- ---------------------------------------------------------
create or replace function public.reopen_month(p_monthly_account_id uuid)
returns public.monthly_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.monthly_accounts;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select * into v_account from public.monthly_accounts
    where id = p_monthly_account_id and user_id = v_user_id
    for update;
  if not found then raise exception 'Monthly account not found'; end if;
  if v_account.status = 'OPEN' then raise exception 'Month is already open'; end if;

  update public.monthly_accounts set
    status = 'OPEN',
    reopened_at = now()
  where id = p_monthly_account_id
  returning * into v_account;

  return v_account;
end;
$$;

grant execute on function public.reopen_month(uuid) to authenticated;

-- ---------------------------------------------------------
-- carry_forward_balance
-- Explicitly re-syncs a month's opening_balance from the prior month's
-- closing_balance. Used by create_next_month, and available to call
-- manually after a reopen + edit changes a closed month retroactively.
-- ---------------------------------------------------------
create or replace function public.carry_forward_balance(p_year int, p_month int)
returns public.monthly_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.monthly_accounts;
  v_prev public.monthly_accounts;
  v_prev_year int;
  v_prev_month int;
  v_opening numeric(14,2);
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select * into v_account from public.monthly_accounts
    where user_id = v_user_id and year = p_year and month = p_month
    for update;
  if not found then raise exception 'Monthly account not found'; end if;

  if p_month = 1 then
    v_prev_month := 12; v_prev_year := p_year - 1;
  else
    v_prev_month := p_month - 1; v_prev_year := p_year;
  end if;

  select * into v_prev from public.monthly_accounts
    where user_id = v_user_id and year = v_prev_year and month = v_prev_month;

  v_opening := case when found and v_prev.closing_balance is not null
    then v_prev.closing_balance else 0 end;

  update public.monthly_accounts set
    opening_balance = v_opening,
    carry_forward_amount = v_opening
  where id = v_account.id;

  return public.calculate_monthly_account(v_account.id);
end;
$$;

grant execute on function public.carry_forward_balance(int, int) to authenticated;

-- ---------------------------------------------------------
-- create_next_month
-- Thin, explicit wrapper so the UI can offer a "Start October" action
-- distinct from the implicit get_or_create used when just viewing a month.
-- ---------------------------------------------------------
create or replace function public.create_next_month(p_current_year int, p_current_month int)
returns public.monthly_accounts
language plpgsql security definer set search_path = public as $$
declare
  v_next_year int;
  v_next_month int;
begin
  if p_current_month = 12 then
    v_next_month := 1; v_next_year := p_current_year + 1;
  else
    v_next_month := p_current_month + 1; v_next_year := p_current_year;
  end if;

  return public.get_or_create_monthly_account(v_next_year, v_next_month);
end;
$$;

grant execute on function public.create_next_month(int, int) to authenticated;
