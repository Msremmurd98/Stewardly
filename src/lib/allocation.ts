/**
 * Fixed income allocation split.
 *
 * This is a DISPLAY / preview mirror only. The values here must always
 * match the hard-coded defaults in supabase/migrations/0003_functions.sql
 * (get_or_create_monthly_account). The database is the source of truth:
 * every monthly_accounts row snapshots its own percentages at creation
 * time, and every RPC computes allocated/used amounts from that row, not
 * from this file. Nothing in the UI may edit these numbers.
 */
export const ALLOCATION = Object.freeze({
  TITHE: 0.1,
  INVESTMENT: 0.3,
  GIVINGS: 0.3,
  EXPENSES: 0.2,
  SAVINGS: 0.1,
});

export type AllocatableCategory = "tithe" | "investment" | "giving" | "expense" | "savings";

export const ALLOCATION_BY_CATEGORY: Record<AllocatableCategory, number> = Object.freeze({
  tithe: ALLOCATION.TITHE,
  investment: ALLOCATION.INVESTMENT,
  giving: ALLOCATION.GIVINGS,
  expense: ALLOCATION.EXPENSES,
  savings: ALLOCATION.SAVINGS,
});

export const CATEGORY_LABELS: Record<AllocatableCategory | "income", string> = Object.freeze({
  income: "Income",
  tithe: "Tithe",
  investment: "Investments",
  giving: "Givings",
  expense: "Expenses",
  savings: "Savings",
});

export const CATEGORY_ORDER: Array<AllocatableCategory | "income"> = [
  "income",
  "tithe",
  "investment",
  "giving",
  "expense",
  "savings",
];
