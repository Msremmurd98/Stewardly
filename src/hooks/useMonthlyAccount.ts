import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryClient";
import { useAuth } from "./useAuth";
import type { MonthlyAccount } from "@/types/database";

/**
 * Fetches the monthly_accounts row for (year, month), creating it via the
 * get_or_create_monthly_account RPC on first view. All allocation math on
 * the returned row was computed server-side.
 */
export function useMonthlyAccount(year: number, month: number) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: qk.monthlyAccount(user?.id ?? "", year, month),
    enabled: !!user,
    queryFn: async (): Promise<MonthlyAccount> => {
      const { data: existing, error: selectError } = await supabase
        .from("monthly_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      if (selectError) throw selectError;
      if (existing) return existing as MonthlyAccount;

      const { data: created, error: rpcError } = await supabase
        .rpc("get_or_create_monthly_account", { p_year: year, p_month: month })
        .single();
      if (rpcError) throw rpcError;

      queryClient.invalidateQueries({ queryKey: qk.monthlyAccounts(user!.id) });
      return created as MonthlyAccount;
    },
  });
}

/** All of a user's monthly accounts, for History filters / month lists / comparisons. */
export function useMonthlyAccounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.monthlyAccounts(user?.id ?? ""),
    enabled: !!user,
    queryFn: async (): Promise<MonthlyAccount[]> => {
      const { data, error } = await supabase
        .from("monthly_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return data as MonthlyAccount[];
    },
  });
}
