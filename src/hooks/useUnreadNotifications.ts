import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { supabase } from "@/lib/supabase";

export function useUnreadNotifications() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["unread-notifications", user?.id ?? ""],
    enabled: !!user,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);

      if (error) throw error;

      return count ?? 0;
    },
  });
}
