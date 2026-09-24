import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryClient";
import { useAuth } from "./useAuth";
import type { MonthlyAccount, Transaction, TransactionCategory } from "@/types/database";

export function useTransactions(monthlyAccountId: string | undefined) {
  return useQuery({
    queryKey: qk.transactions(monthlyAccountId ?? ""),
    enabled: !!monthlyAccountId,
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("monthly_account_id", monthlyAccountId!)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });
}

export function useTransactionsByDate(date: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.transactionsByDate(user?.id ?? "", date ?? ""),
    enabled: !!user && !!date,
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("transaction_date", date)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });
}

interface CreateIncomeInput {
  amount: number;
  date: string;
  narration?: string;
  year: number;
  month: number;
}

interface CreateCategoryInput {
  category: Exclude<TransactionCategory, "income">;
  amount: number;
  date: string;
  narration?: string;
  year: number;
  month: number;
}

function useInvalidateAfterWrite(year: number, month: number) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return (account: MonthlyAccount) => {
    if (!user) return;
    queryClient.setQueryData(qk.monthlyAccount(user.id, year, month), account);
    queryClient.invalidateQueries({ queryKey: qk.transactions(account.id) });
    queryClient.invalidateQueries({ queryKey: qk.monthlyAccounts(user.id) });
  };
}

export function useCreateIncomeTransaction(year: number, month: number) {
  const invalidate = useInvalidateAfterWrite(year, month);
  return useMutation({
    mutationFn: async (input: CreateIncomeInput) => {
      const { data, error } = await supabase
        .rpc("create_income_transaction", {
          p_amount: input.amount,
          p_date: input.date,
          p_narration: input.narration ?? null,
          p_year: input.year,
          p_month: input.month,
        })
        .single();
      if (error) throw error;
      return data as MonthlyAccount;
    },
    onSuccess: invalidate,
  });
}

export function useCreateCategoryTransaction(year: number, month: number) {
  const invalidate = useInvalidateAfterWrite(year, month);
  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      const { data, error } = await supabase
        .rpc("create_category_transaction", {
          p_category: input.category,
          p_amount: input.amount,
          p_date: input.date,
          p_narration: input.narration ?? null,
          p_year: input.year,
          p_month: input.month,
        })
        .single();
      if (error) throw error;
      return data as MonthlyAccount;
    },
    onSuccess: invalidate,
  });
}

export function useEditTransaction(year: number, month: number) {
  const invalidate = useInvalidateAfterWrite(year, month);
  return useMutation({
    mutationFn: async (input: { id: string; amount: number; date: string; narration?: string }) => {
      const { data, error } = await supabase
        .rpc("edit_transaction", {
          p_transaction_id: input.id,
          p_amount: input.amount,
          p_date: input.date,
          p_narration: input.narration ?? null,
        })
        .single();
      if (error) throw error;
      return data as MonthlyAccount;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction(year: number, month: number) {
  const invalidate = useInvalidateAfterWrite(year, month);
  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { data, error } = await supabase
        .rpc("delete_transaction", { p_transaction_id: transactionId })
        .single();
      if (error) throw error;
      return data as MonthlyAccount;
    },
    onSuccess: invalidate,
  });
}

export function useCloseMonth(year: number, month: number) {
  const invalidate = useInvalidateAfterWrite(year, month);
  return useMutation({
    mutationFn: async (monthlyAccountId: string) => {
      const { data, error } = await supabase
        .rpc("close_month", { p_monthly_account_id: monthlyAccountId })
        .single();
      if (error) throw error;
      return data as MonthlyAccount;
    },
    onSuccess: invalidate,
  });
}

export function useReopenMonth(year: number, month: number) {
  const invalidate = useInvalidateAfterWrite(year, month);
  return useMutation({
    mutationFn: async (monthlyAccountId: string) => {
      const { data, error } = await supabase
        .rpc("reopen_month", { p_monthly_account_id: monthlyAccountId })
        .single();
      if (error) throw error;
      return data as MonthlyAccount;
    },
    onSuccess: invalidate,
  });
}
