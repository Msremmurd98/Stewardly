import type { MonthlyAccount } from "@/types/database";

const SUM_FIELDS = [
  "total_income",
  "total_outflows",
  "tithe_allocated",
  "investment_allocated",
  "giving_allocated",
  "expense_allocated",
  "savings_allocated",
  "tithe_used",
  "investment_used",
  "giving_used",
  "expense_used",
  "savings_used",
] as const;

/**
 * Combines every monthly account into one read-only "All months" account so
 * the existing screens can render it unchanged.
 *
 * Balance note: month-to-month carry-forward means each month's own
 * current_balance already includes the previous month's closing balance, so
 * adding the monthly balances up would double count. The all-time balance is
 * instead  earliest opening balance + all income - all outflows.
 *
 * The result is never written back to the database (id is "all").
 */
export function aggregateAccounts(accounts: MonthlyAccount[], userId: string): MonthlyAccount {
  const ordered = [...accounts].sort((a, b) => a.year - b.year || a.month - b.month);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  const totals = Object.fromEntries(SUM_FIELDS.map((f) => [f, 0])) as Record<(typeof SUM_FIELDS)[number], number>;
  for (const a of ordered) {
    for (const f of SUM_FIELDS) totals[f] += Number(a[f]) || 0;
  }

  const opening = Number(first?.opening_balance) || 0;
  const now = new Date().toISOString();

  return {
    id: "all",
    user_id: userId,
    month: last?.month ?? new Date().getMonth() + 1,
    year: last?.year ?? new Date().getFullYear(),

    opening_balance: opening,
    total_income: totals.total_income,
    total_outflows: totals.total_outflows,
    current_balance: opening + totals.total_income - totals.total_outflows,
    closing_balance: null,
    carry_forward_amount: 0,

    status: "OPEN",

    // allocation rates are fixed app-wide; take them from the latest month
    tithe_percentage: last?.tithe_percentage ?? 0.1,
    investment_percentage: last?.investment_percentage ?? 0.3,
    giving_percentage: last?.giving_percentage ?? 0.3,
    expense_percentage: last?.expense_percentage ?? 0.2,
    savings_percentage: last?.savings_percentage ?? 0.1,

    tithe_allocated: totals.tithe_allocated,
    investment_allocated: totals.investment_allocated,
    giving_allocated: totals.giving_allocated,
    expense_allocated: totals.expense_allocated,
    savings_allocated: totals.savings_allocated,

    tithe_used: totals.tithe_used,
    investment_used: totals.investment_used,
    giving_used: totals.giving_used,
    expense_used: totals.expense_used,
    savings_used: totals.savings_used,

    created_at: first?.created_at ?? now,
    updated_at: last?.updated_at ?? now,
    closed_at: null,
    reopened_at: null,
  };
}
