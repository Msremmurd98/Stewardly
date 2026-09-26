import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { PushSettingsCard } from "@/components/notifications/PushSettingsCard";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { NotificationRow } from "@/types/database";
import { cn } from "@/lib/utils";

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: qk.notifications(user?.id ?? ""),
    enabled: !!user,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as NotificationRow[];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      if (error) throw error;
    },

onSuccess: () => {
  queryClient.invalidateQueries({
    queryKey: qk.notifications(user?.id ?? ""),
  });

  queryClient.invalidateQueries({
    queryKey: ["unread-notifications", user?.id ?? ""],
  });
}

  });

  return (
    <AppShell>
      <header className="flex items-center gap-3 pt-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <h1 className="text-lg font-bold text-foreground">
          Notifications
        </h1>
      </header>

      <section className="mt-6">
        <PushSettingsCard />
      </section>

      <section className="mt-6 space-y-2">
        {isLoading && (
          <div className="h-16 animate-pulse rounded-xl bg-surface" />
        )}

        {!isLoading && (notifications ?? []).length === 0 && (
          <div className="py-14 text-center text-sm text-muted">
            <Bell className="mx-auto mb-2 h-6 w-6 text-muted" />
            No notifications yet.
          </div>
        )}

        {(notifications ?? []).map((n) => (
          <button
            key={n.id}
            onClick={() =>
              !n.read && markRead.mutate(n.id)
            }
            className={cn(
              "block w-full rounded-xl px-4 py-3 text-left shadow-card",
              n.read
                ? "bg-surface"
                : "bg-category-giving",
            )}
          >
            <p
              className={cn(
                "text-sm font-semibold",
                n.read
                  ? "text-foreground"
                  : "text-category-giving-fg",
              )}
            >
              {n.title}
            </p>

            <p
              className={cn(
                "mt-0.5 text-xs",
                n.read
                  ? "text-muted"
                  : "text-category-giving-fg/80",
              )}
            >
              {n.message}
            </p>

            <p className="mt-1 text-[11px] text-muted">
              {formatDistanceToNow(
                new Date(n.created_at),
                {
                  addSuffix: true,
                },
              )}
            </p>
          </button>
        ))}
      </section>
    </AppShell>
  );
}
