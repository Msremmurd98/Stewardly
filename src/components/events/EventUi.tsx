import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Paperclip, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { getPopSignedUrl } from "@/hooks/useEvents";
import { friendlyError, STATUS_STYLES } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { EventRegistrationStatus } from "@/types/events";

/** Back arrow + title, same look as the other sub-screens (Goals, Notifications, Broadcast). */
export function SubScreenHeader({
  title,
  action,
  backTo,
}: {
  title: string;
  action?: ReactNode;
  /** When set, back goes to this path instead of history (-1). */
  backTo?: string;
}) {
  const navigate = useNavigate();
  return (
    <header className="flex items-center justify-between gap-3 pt-2">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
          aria-label="Go back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="truncate text-lg font-bold text-foreground">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="py-14 text-center text-sm text-muted">
      <Icon className="mx-auto mb-2 h-6 w-6 text-muted" />
      {text}
    </div>
  );
}

export function LoadingCard() {
  return <div className="h-28 animate-pulse rounded-2xl bg-surface" />;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}

export function RegistrationStatusBadge({
  status,
  className,
}: {
  status: EventRegistrationStatus;
  className?: string;
}) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide",
        s.badge,
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function AttendanceBadge({ label }: { label: "ATTENDED" | "NOT ATTENDED" | "—" }) {
  if (label === "—") return <span className="text-xs text-muted">—</span>;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide",
        label === "ATTENDED"
          ? "bg-category-income text-category-income-fg"
          : "bg-background text-muted",
      )}
    >
      {label}
    </span>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground break-words">{value}</dd>
    </div>
  );
}

/**
 * Opens a private POP via a short-lived signed URL. Storage RLS decides who
 * can actually get one (the owner or an admin) - the UI is not the gate.
 */
export function ViewPopButton({
  path,
  label = "View proof of payment",
}: {
  path: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    setLoading(true);
    // Open the tab synchronously so mobile browsers don't block the popup.
    const tab = window.open("", "_blank");
    try {
      const url = await getPopSignedUrl(path);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (err) {
      tab?.close();
      setError(friendlyError(err, "We couldn't open the file. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" size="sm" onClick={open} disabled={loading} className="w-full">
        {loading ? (
          "Opening..."
        ) : (
          <>
            <Paperclip className="h-4 w-4" />
            {label}
            <ExternalLink className="h-3.5 w-3.5 text-muted" />
          </>
        )}
      </Button>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Confirmation dialog built on the existing ResponsiveModal. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant = "primary",
  loading,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "primary" | "danger";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
}) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !loading && onOpenChange(o)}
      title={title}
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button variant={variant} className="flex-1" disabled={loading} onClick={onConfirm}>
            {loading ? "Please wait..." : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted">{description}</p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </ResponsiveModal>
  );
}
