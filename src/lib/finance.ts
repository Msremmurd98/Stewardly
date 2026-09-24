import { differenceInCalendarMonths, startOfMonth } from "date-fns";
import { ALLOCATION_BY_CATEGORY, type AllocatableCategory } from "./allocation";
import type { MonthlyAccount, SavingsGoal } from "@/types/database";

/**
 * calculateAllocation
 * Preview-only: shows the user what an income amount will allocate to,
 * before they submit. The database RPC (create_income_transaction ->
 * calculate_monthly_account) recomputes this authoritatively.
 */
export function calculateAllocation(incomeAmount: number) {
  const safe = Number.isFinite(incomeAmount) && incomeAmount > 0 ? incomeAmount : 0;
  return {
    tithe: round2(safe * ALLOCATION_BY_CATEGORY.tithe),
    investment: round2(safe * ALLOCATION_BY_CATEGORY.investment),
    giving: round2(safe * ALLOCATION_BY_CATEGORY.giving),
    expense: round2(safe * ALLOCATION_BY_CATEGORY.expense),
    savings: round2(safe * ALLOCATION_BY_CATEGORY.savings),
  };
}

/** Remaining = Allocated - Used. Never treat allocation as spending. */
export function calculateRemaining(allocated: number, used: number) {
  return round2(allocated - used);
}

export function calculateUsagePercentage(used: number, allocated: number) {
  if (!allocated || allocated <= 0) return 0;
  return Math.min(999, round2((used / allocated) * 100));
}

/** Opening Balance + Income - Actual Outflows = Current Balance */
export function calculateCurrentBalance(
  openingBalance: number,
  income: number,
  actualOutflows: number
) {
  return round2(openingBalance + income - actualOutflows);
}

/** Carry-forward is balance movement, not income. */
export function calculateCarryForward(closingBalance: number | null) {
  return round2(closingBalance ?? 0);
}

export function calculateSavingsGoalProgress(goal: Pick<SavingsGoal, "current_amount" | "target_amount">) {
  if (!goal.target_amount || goal.target_amount <= 0) return 0;
  return Math.min(100, round2((goal.current_amount / goal.target_amount) * 100));
}

export function calculateRequiredMonthlyContribution(
  goal: Pick<SavingsGoal, "current_amount" | "target_amount" | "target_date">
) {
  const remaining = round2(goal.target_amount - goal.current_amount);
  if (remaining <= 0) return 0;
  if (!goal.target_date) return remaining; // no date set: show remaining as a single lump

  const months = Math.max(
    1,
    differenceInCalendarMonths(startOfMonth(new Date(goal.target_date)), startOfMonth(new Date())) + 1
  );
  return round2(remaining / months);
}

export interface MonthlyComparisonRow {
  label: string;
  income: number;
  tithe: number;
  investment: number;
  giving: number;
  expense: number;
  savings: number;
  openingBalance: number;
  closingBalance: number;
}

export function calculateMonthlyComparison(a: MonthlyAccount, b: MonthlyAccount): [MonthlyComparisonRow, MonthlyComparisonRow] {
  const toRow = (m: MonthlyAccount): MonthlyComparisonRow => ({
    label: `${m.month}/${m.year}`,
    income: m.total_income,
    tithe: m.tithe_used,
    investment: m.investment_used,
    giving: m.giving_used,
    expense: m.expense_used,
    savings: m.savings_used,
    openingBalance: m.opening_balance,
    closingBalance: m.closing_balance ?? m.current_balance,
  });
  return [toRow(a), toRow(b)];
}

export function budgetWarningMessage(category: string, used: number, allocated: number, monthLabel?: string) {
  const pct = calculateUsagePercentage(used, allocated);
  if (pct >= 100) {
    return `Your ${category.toLowerCase()} allocation has been fully used.`;
  }
  if (pct >= 85) {
    return `You've used ${Math.round(pct)}% of your${monthLabel ? " " + monthLabel : ""} ${category.toLowerCase()} allocation.`;
  }
  if (pct >= 70) {
    return `You've used ${Math.round(pct)}% of your ${category.toLowerCase()} budget.`;
  }
  return null;
}

export function categoryAllocated(account: MonthlyAccount, category: AllocatableCategory) {
  return account[`${category}_allocated` as const] as number;
}
export function categoryUsed(account: MonthlyAccount, category: AllocatableCategory) {
  return account[`${category}_used` as const] as number;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
