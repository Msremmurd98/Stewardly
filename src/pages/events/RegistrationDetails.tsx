import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  AttendanceBadge,
  DetailRow,
  EmptyState,
  ErrorNote,
  LoadingCard,
  RegistrationStatusBadge,
  SubScreenHeader,
  ViewPopButton,
} from "@/components/events/EventUi";
import { useMyRegistration } from "@/hooks/useEvents";
import { formatCurrency } from "@/lib/currency";
import { attendanceLabel, formatDateTime, formatEventDate } from "@/lib/events";
import type { EventRegistrationStatus } from "@/types/events";

const STATUS_COPY: Record<EventRegistrationStatus, string> = {
  VERIFYING:
    "We've received your payment details and proof of payment. An administrator will review them shortly.",
  REGISTERED: "Your payment has been verified and your place at this event is confirmed.",
  UNSUCCESSFUL:
    "Your registration was unsuccessful. Please check your registration details or contact the event administrator.",
};

export default function RegistrationDetails() {
  const { registrationId } = useParams<{ registrationId: string }>();
  const location = useLocation();
  const justSubmitted = (location.state as { justSubmitted?: boolean } | null)?.justSubmitted === true;
  const { data: reg, isLoading, isError } = useMyRegistration(registrationId);

  return (
    <AppShell>
      <SubScreenHeader title="Registration" backTo="/events/mine" />

      {isLoading && (
        <div className="mt-6 space-y-3">
          <LoadingCard />
          <LoadingCard />
        </div>
      )}

      {isError && (
        <div className="mt-6">
          <ErrorNote>We couldn't load this registration. Please try again.</ErrorNote>
        </div>
      )}

      {!isLoading && !isError && !reg && (
        <EmptyState icon={ClipboardList} text="This registration could not be found." />
      )}

      {reg && (
        <>
          {justSubmitted && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-category-income p-4 text-category-income-fg">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="text-sm font-semibold">Registration submitted. Your payment is being verified.</p>
            </div>
          )}

          <section className="mt-5 rounded-2xl bg-surface p-5 shadow-card">
            <p className="text-xs text-muted">{reg.registration_code}</p>
            <h2 className="mt-1 text-xl font-extrabold text-foreground">{reg.event_title_snapshot}</h2>
            <p className="mt-0.5 text-sm text-muted">{formatEventDate(reg.event_date_snapshot)}</p>

            <div className="mt-4">
              <RegistrationStatusBadge status={reg.status} />
              <p className="mt-2 text-sm text-muted">{STATUS_COPY[reg.status]}</p>
            </div>
          </section>

          <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card">
            <dl className="divide-y divide-border">
              <DetailRow label="Full name" value={reg.full_name_snapshot} />
              <DetailRow label="Email" value={reg.email_snapshot} />
              <DetailRow label="Phone" value={reg.phone_snapshot} />
              <DetailRow
                label="Amount paid"
                value={formatCurrency(Number(reg.amount_paid), "NGN", { showDecimals: true })}
              />
              <DetailRow label="Payment reference" value={reg.payment_reference} />
              <DetailRow label="Payment date" value={formatEventDate(reg.payment_date)} />
              <DetailRow label="Registered on" value={formatDateTime(reg.created_at)} />
              {reg.verified_at && (
                <DetailRow label="Reviewed on" value={formatDateTime(reg.verified_at)} />
              )}
              <DetailRow label="Attendance" value={<AttendanceBadge label={attendanceLabel(reg)} />} />
            </dl>

            <div className="mt-4">
              <ViewPopButton path={reg.pop_path} />
            </div>
          </section>

          <div className="mt-4 text-center">
            <Link to={`/events/${reg.event_id}`} className="text-sm font-semibold text-foreground underline">
              View event
            </Link>
          </div>
        </>
      )}
    </AppShell>
  );
}
