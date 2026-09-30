import { Link } from "react-router-dom";
import { ClipboardList, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import {
  AttendanceBadge,
  EmptyState,
  ErrorNote,
  LoadingCard,
  RegistrationStatusBadge,
  SubScreenHeader,
} from "@/components/events/EventUi";
import { useMyRegistrations } from "@/hooks/useEvents";
import { formatCurrency } from "@/lib/currency";
import { attendanceLabel, formatEventDate } from "@/lib/events";

export default function MyRegistrations() {
  const { data: registrations, isLoading, isError } = useMyRegistrations();

  return (
    <AppShell>
      <SubScreenHeader title="My Registrations" backTo="/events" />

      <section className="mt-6 space-y-3">
        {isLoading && (
          <>
            <LoadingCard />
            <LoadingCard />
          </>
        )}

        {isError && (
          <ErrorNote>We couldn't load your registrations. Please try again in a moment.</ErrorNote>
        )}

        {!isLoading && !isError && (registrations ?? []).length === 0 && (
          <EmptyState icon={ClipboardList} text="You haven't registered for any events yet." />
        )}

        {(registrations ?? []).map((reg) => (
          <Link
            key={reg.id}
            to={`/events/mine/${reg.id}`}
            className="block rounded-2xl bg-surface p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground">{reg.event_title_snapshot}</h3>
                <p className="mt-0.5 text-xs text-muted">{formatEventDate(reg.event_date_snapshot)}</p>
              </div>
              <RegistrationStatusBadge status={reg.status} />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Amount paid</dt>
                <dd className="font-semibold text-foreground">
                  {formatCurrency(Number(reg.amount_paid), "NGN")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Registered on</dt>
                <dd className="font-semibold text-foreground">
                  {format(new Date(reg.created_at), "MMM d, yyyy")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">POP</dt>
                <dd className="flex items-center gap-1 font-semibold text-foreground">
                  <Paperclip className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                  Uploaded
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Attendance</dt>
                <dd className="mt-0.5">
                  <AttendanceBadge label={attendanceLabel(reg)} />
                </dd>
              </div>
            </dl>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
