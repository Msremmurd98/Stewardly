import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryClient";
import { useAuth } from "./useAuth";
import type { AppCurrency, Profile } from "@/types/database";

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.profile(user?.id ?? ""),
    enabled: !!user,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, "full_name" | "avatar_url" | "currency">>) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user!.id)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.profile(user?.id ?? "") });
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: async ({ newPassword }: { currentPassword: string; newPassword: string }) => {
      // Supabase JS does not re-verify the current password client-side;
      // for a stronger guarantee, re-authenticate first with signInWithPassword
      // using currentPassword before calling updateUser. That re-auth call
      // is left to the calling form so failures surface as a normal field error.
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
  });
}

export function useChangeCurrency() {
  const update = useUpdateProfile();
  return {
    ...update,
    changeCurrency: (currency: AppCurrency) => update.mutateAsync({ currency }),
  };
}
