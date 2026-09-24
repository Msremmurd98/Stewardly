import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryClient";
import { useAuth } from "./useAuth";
import type { SavingsGoal } from "@/types/database";

export function useSavingsGoals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.savingsGoals(user?.id ?? ""),
    enabled: !!user,
    queryFn: async (): Promise<SavingsGoal[]> => {
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SavingsGoal[];
    },
  });
}

export function useCreateSavingsGoal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Pick<SavingsGoal, "name" | "target_amount" | "target_date"> & { current_amount?: number }) => {
      const { data, error } = await supabase
        .from("savings_goals")
        .insert({
          user_id: user!.id,
          name: input.name,
          target_amount: input.target_amount,
          current_amount: input.current_amount ?? 0,
          target_date: input.target_date,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SavingsGoal;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.savingsGoals(user?.id ?? "") }),
  });
}

export function useUpdateSavingsGoal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SavingsGoal> }) => {
      const { data, error } = await supabase
        .from("savings_goals")
        .update(patch)
        .eq("id", id)
        .eq("user_id", user!.id)
        .select()
        .single();
      if (error) throw error;
      return data as SavingsGoal;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.savingsGoals(user?.id ?? "") }),
  });
}

export function useDeleteSavingsGoal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("savings_goals").delete().eq("id", id).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.savingsGoals(user?.id ?? "") }),
  });
}
