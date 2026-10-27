import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useMonthlyAccounts } from "@/hooks/useMonthlyAccount";
import { useTransactions } from "@/hooks/useTransactions";
import { aggregateAccounts } from "@/lib/aggregateAccounts";
import { currentPeriod, useMonthFilter } from "@/lib/monthFilter";
import type { MonthlyAccount, Transaction } from "@/types/database";

const PAGE_SIZE = 1000; // Supabase returns at most 1000 rows per request

/**
 * Everything a month-based screen needs, driven by the shared month selection:
 *
 *  - a specific month -> that month's account + its transactions
 *    (same queries/cache keys the screens already used)
 *  - "All"            -> every month combined: a read-only summed account and
 *                        every transaction
 *
 * Screens just render `account` / `transactions` and don't care which mode
 * they are in.
 */
export function useMonthScope() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { year, month, isAll } = useMonthFilter();
  const uid = user?.id ?? "";

  // --- single month (same cache key as useMonthlyAccount, but never fires in "All" mode,
  //     so "All" never creates an empty month row) -------------------------------------
  const single = useQuery({
    queryKey: qk.monthlyAccount(uid, year, month ?? 0),
    enabled: !!user && !isAll,
    queryFn: async (): Promise<MonthlyAccount> => {
      const { data: existing, error: selectError } = await supabase
        .from("monthly_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .eq("year", year)
        .eq("month", month!)
        .maybeSingle();
      if (selectError) throw selectError;
      if (existing) return existing as MonthlyAccount;

      const { data: created, error: rpcError } = await supabase
        .rpc("get_or_create_monthly_account", { p_year: year, p_month: month! })
        .single();
      if (rpcError) throw rpcError;

      queryClient.invalidateQueries({ queryKey: qk.monthlyAccounts(user!.id) });
      return created as MonthlyAccount;
    },
  });
  const singleTxns = useTransactions(isAll ? undefined : single.data?.id);

  // --- all months -----------------------------------------------------------
  const accountsQ = useMonthlyAccounts();

  // The key starts with qk.monthlyAccounts(uid) on purpose: every existing
  // add / edit / delete / close already invalidates that prefix, so this list
  // refreshes after any change with no edits to useTransactions.
  const allTxns = useQuery({
    queryKey: [...qk.monthlyAccounts(uid), "all-transactions"],
    enabled: !!user && isAll,
    queryFn: async (): Promise<Transaction[]> => {
      const rows: Transaction[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user!.id)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...(data as Transaction[]));
        if (!data || data.length < PAGE_SIZE) break;
      }
      return rows;
    },
  });

  const aggregate = useMemo(
    () => (isAll && accountsQ.data ? aggregateAccounts(accountsQ.data, uid) : undefined),
    [isAll, accountsQ.data, uid],
  );

  const account = isAll ? aggregate : single.data;
  const transactions = isAll ? allTxns.data : singleTxns.data;
  const isLoading = isAll ? accountsQ.isLoading : single.isLoading;
  const transactionsLoading = isAll ? accountsQ.isLoading || allTxns.isLoading : single.isLoading || singleTxns.isLoading;

  /**
   * The real month a transaction belongs to. In "All" mode edits/deletes must
   * be applied against the transaction's own month, never the selected one.
   */
  const periodFor = useCallback(
    (t: Transaction | null) => {
      const owner = t ? accountsQ.data?.find((a) => a.id === t.monthly_account_id) : undefined;
      const a = owner ?? single.data;
      const cur = currentPeriod();
      return {
        year: a?.year ?? (isAll ? cur.year : year),
        month: a?.month ?? (isAll ? cur.month : (month as number)),
        closed: a?.status === "CLOSED",
      };
    },
    [accountsQ.data, single.data, isAll, year, month],
  );

  /** Where NEW transactions go: the selected month, or the current month while on "All". */
  const writePeriod = isAll ? currentPeriod() : { year, month: month as number };

  return {
    isAll,
    year,
    month,
    account,
    accounts: accountsQ.data ?? [],
    transactions,
    isLoading,
    transactionsLoading,
    periodFor,
    writePeriod,
  };
}
