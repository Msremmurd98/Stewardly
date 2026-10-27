-- =========================================================
-- KED Finance — 0007_transaction_date_in_month.sql
-- A transaction's date must fall inside the month it is recorded in.
-- Previously the date was never checked, so a March transaction could be
-- dated in April or in the future. Replaces create_income_transaction,
-- create_category_transaction and edit_transaction with the same logic
-- as 0003 plus the date check.
--
-- Existing rows are NOT changed. Editing an old row keeps working as long
-- as its date is left as it is; changing it requires an in-month date.
-- Run AFTER 0006_events.sql (or 0005 if you have not added events).
-- =========================================================

create or replace function public.assert_date_in_month(p_date date, p_year int, p_month int)
returns void
language plpgsql
stable
as $$
begin
  if p_date is not null
     and (extract(year from p_date)::int <> p_year or extract(month from p_date)::int <> p_month) then
    raise exception 'Date must be within %', to_char(make_date(p_year, p_month, 1), 'FMMonth YYYY');
  end if;
end;
$$;

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

  perform public.assert_date_in_month(coalesce(p_date, current_date), p_year, p_month);

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

  perform public.assert_date_in_month(coalesce(p_date, current_date), p_year, p_month);

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

  -- a changed date must stay inside the transaction's own month
  if p_date is not null and p_date is distinct from v_txn.transaction_date then
    perform public.assert_date_in_month(p_date, v_account.year, v_account.month);
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
