import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, CalendarX2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  DetailRow,
  EmptyState,
  ErrorNote,
  LoadingCard,
  RegistrationStatusBadge,
  SubScreenHeader,
} from "@/components/events/EventUi";
import { useEvent, useMyRegistrations } from "@/hooks/useEvents";
import { formatCurrency } from "@/lib/currency";
import {
  formatDateTime,
  formatEventDate,
  formatEventTime,
  getEventPhase,
  pickRegistrationForEvent,
  phaseLabel,
} from "@/lib/events";
import { cn } from "@/lib/utils";

export default function EventDetails() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading, isError } = useEvent(eventId);
  const { data: registrations } = useMyRegistrations();

  if (isLoading) {
    return (
      <AppShell>
        <SubScreenHeader title="Event" backTo="/events" />
        <div className="mt-6 space-y-3">
          <LoadingCard />
          <LoadingCard />
        </div>
      </AppShell>
    );
  }

  if (isError || !event) {
    return (
      <AppShell>
        <SubScreenHeader title="Event" backTo="/events" />
        {isError ? (
          <div className="mt-6">
            <ErrorNote>We couldn't load this event. Please try again.</ErrorNote>
          </div>
        ) : (
          <EmptyState icon={CalendarX2} text="This event could not be found." />
        )}
      </AppShell>
    );
  }

  const phase = getEventPhase(event);
  const completed = phase === "completed";
  const registration = pickRegistrationForEvent(registrations, event.id);
  const hasActiveRegistration = !!registration && registration.status !== "UNSUCCESSFUL";
  const fee = Number(event.registration_fee);
  const hasPaymentDetails = !!(
    event.bank_name ||
    event.account_name ||
    event.account_number ||
    event.payment_instructions
  );

  return (
    <AppShell>
      <SubScreenHeader title="Event Details" backTo="/events" />

      <div className={cn("mt-5", completed && "opacity-70 grayscale")}>
        {event.image_url && (
          <img
            src={event.image_url}
            alt=""
            className="h-48 w-full rounded-2xl object-cover shadow-card"
          />
        )}

        <div className="mt-4 flex items-start justify-between gap-3">
          <h2 className="text-2xl font-extrabold text-foreground">{event.title}</h2>
        </div>
        <p
          className={cn(
            "mt-1 inline-block rounded-full px-3 py-1 text-[11px] font-bold tracking-wide",
            completed
              ? "bg-background text-muted"
              : phase === "open"
                ? "bg-category-income text-category-income-fg"
                : "bg-category-savings text-category-savings-fg",
          )}
        >
          {phaseLabel(phase).toUpperCase()}
        </p>

        {event.description && (
          <p className="mt-4 whitespace-pre-line text-sm text-foreground/80">{event.description}</p>
        )}
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-5 shadow-card">
        <dl className="divide-y divide-border">
          <DetailRow label="Date" value={formatEventDate(event.event_date)} />
          <DetailRow label="Start time" value={formatEventTime(event.start_time)} />
          {event.end_time && <DetailRow label="End time" value={formatEventTime(event.end_time)} />}
          <DetailRow
            label="Venue"
            value={
              <>
                {event.venue}
                {event.address && <span className="block text-xs text-muted">{event.address}</span>}
              </>
            }
          />
          <DetailRow
            label="Registration fee"
            value={fee > 0 ? formatCurrency(fee, "NGN") : "Free"}
          />
          <DetailRow
            label="Registration deadline"
            value={
              event.registration_close_at
                ? formatDateTime(event.registration_close_at)
                : "Until the event starts"
            }
          />
          {event.spots_left !== null && !completed && (
            <DetailRow label="Spots left" value={event.spots_left} />
          )}
        </dl>
      </section>

      {hasPaymentDetails && !completed && (
        <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card">
          <h3 className="text-sm font-bold text-foreground">Payment instructions</h3>
          <dl className="mt-2 divide-y divide-border">
            {event.bank_name && <DetailRow label="Bank" value={event.bank_name} />}
            {event.account_name && <DetailRow label="Account name" value={event.account_name} />}
            {event.account_number && (
              <DetailRow label="Account number" value={event.account_number} />
            )}
            <DetailRow
              label="Registration fee"
              value={fee > 0 ? formatCurrency(fee, "NGN") : "Free"}
            />
          </dl>
          {event.payment_instructions && (
            <p className="mt-3 whitespace-pre-line text-sm text-muted">
              {event.payment_instructions}
            </p>
          )}
        </section>
      )}

      {/* Call to action */}
      <section className="mt-6">
        {registration && (
          <Link
            to={`/events/mine/${registration.id}`}
            className="mb-3 flex items-center justify-between rounded-2xl bg-surface p-4 shadow-card"
          >
            <span>
              <span className="block text-xs text-muted">Your registration</span>
              <span className="mt-1 block">
                <RegistrationStatusBadge status={registration.status} />
              </span>
            </span>
            <span className="text-sm font-semibold text-foreground">View</span>
          </Link>
        )}

        {!hasActiveRegistration && phase === "open" && (
          <Button className="w-full" onClick={() => navigate(`/events/${event.id}/register`)}>
            {registration ? "Register Again" : "Register for Event"}
          </Button>
        )}

        {!hasActiveRegistration && phase !== "open" && (
          <div className="rounded-2xl bg-surface p-4 text-center shadow-card">
            <CalendarDays className="mx-auto h-5 w-5 text-muted" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-foreground">{phaseLabel(phase)}</p>
            <p className="mt-0.5 text-xs text-muted">
              {completed
                ? "This event has taken place and no longer accepts registrations."
                : "New registrations are not being accepted right now."}
            </p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
