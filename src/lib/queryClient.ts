import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Central query key registry so mutations invalidate exactly the affected
 * queries instead of the whole cache (spec §29 - avoid refetching
 * everything after every small operation).
 */
export const qk = {
  profile: (userId: string) => ["profile", userId] as const,
  monthlyAccount: (userId: string, year: number, month: number) =>
    ["monthly-account", userId, year, month] as const,
  monthlyAccounts: (userId: string) => ["monthly-accounts", userId] as const,
  transactions: (monthlyAccountId: string) => ["transactions", monthlyAccountId] as const,
  transactionsByDate: (userId: string, date: string) => ["transactions-by-date", userId, date] as const,
  savingsGoals: (userId: string) => ["savings-goals", userId] as const,
  notifications: (userId: string) => ["notifications", userId] as const,
};
