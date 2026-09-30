import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingCard, SubScreenHeader } from "@/components/events/EventUi";
import { useIsAdmin } from "@/hooks/useEvents";

/**
 * UI-level guard, matching how Broadcast works today. It only decides what is
 * shown - the real enforcement is RLS + the admin-checked RPCs in 0006_events.sql.
 */
export function AdminGate({
  title,
  backTo,
  children,
}: {
  title: string;
  backTo?: string;
  children: ReactNode;
}) {
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <AppShell>
        <SubScreenHeader title={title} backTo={backTo} />
        <div className="mt-6">
          <LoadingCard />
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <SubScreenHeader title={title} backTo={backTo} />
        <div className="mt-6 rounded-2xl bg-surface p-5 text-center shadow-card">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">Admin access required</h2>
          <p className="mt-1 text-xs text-muted">
            You do not have permission to manage events.
          </p>
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
