import { supabase } from "@/lib/supabase";
import type { AppCurrency, MonthlyAccount, SavingsGoal, Transaction } from "@/types/database";
import { calculateMonthlyComparison, calculateSavingsGoalProgress } from "@/lib/finance";

export interface ExportBundle {
  account: MonthlyAccount;
  previousAccount: MonthlyAccount | null;
  transactions: Transaction[];
  goals: SavingsGoal[];
  currency: AppCurrency;
  monthLabel: string;
}

/**
 * Gathers everything a report needs for one month, scoped entirely to the
 * caller's own session (every query below goes through RLS, so this can
 * never pull another user's data - spec §24 "never expose another user's
 * data").
 */
export async function buildExportBundle(
  account: MonthlyAccount,
  currency: AppCurrency
): Promise<ExportBundle> {
  const prevMonth = account.month === 1 ? 12 : account.month - 1;
  const prevYear = account.month === 1 ? account.year - 1 : account.year;

  const [{ data: transactions }, { data: goals }, { data: previousAccount }] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("monthly_account_id", account.id)
      .order("transaction_date", { ascending: true }),
    supabase.from("savings_goals").select("*").order("created_at", { ascending: true }),
    supabase
      .from("monthly_accounts")
      .select("*")
      .eq("user_id", account.user_id)
      .eq("year", prevYear)
      .eq("month", prevMonth)
      .maybeSingle(),
  ]);

  const monthLabel = new Date(account.year, account.month - 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return {
    account,
    previousAccount: (previousAccount as MonthlyAccount) ?? null,
    transactions: (transactions as Transaction[]) ?? [],
    goals: (goals as SavingsGoal[]) ?? [],
    currency,
    monthLabel,
  };
}

export function goalsWithProgress(goals: SavingsGoal[]) {
  return goals.map((g) => ({ ...g, progress: calculateSavingsGoalProgress(g) }));
}

export function comparisonRows(bundle: ExportBundle) {
  if (!bundle.previousAccount) return null;
  return calculateMonthlyComparison(bundle.previousAccount, bundle.account);
}
