import { Link } from "react-router-dom";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import {
  formatEventDate,
  formatEventTimeRange,
  getEventPhase,
  phaseLabel,
} from "@/lib/events";
import { cn } from "@/lib/utils";
import type { EventRegistrationRow, EventRow } from "@/types/events";
import { RegistrationStatusBadge } from "./EventUi";

export function EventCard({
  event,
  registration,
}: {
  event: EventRow;
  registration?: Pick<EventRegistrationRow, "status"> | null;
}) {
  const phase = getEventPhase(event);
  const completed = phase === "completed";

  return (
    <Link
      to={`/events/${event.id}`}
      className={cn(
        "block overflow-hidden rounded-2xl bg-surface shadow-card transition-opacity",
        completed && "opacity-60 grayscale",
      )}
    >
      {event.image_url && (
        <img
          src={event.image_url}
          alt=""
          loading="lazy"
          className="h-36 w-full object-cover"
        />
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-foreground">{event.title}</h3>
          {registration && !completed && <RegistrationStatusBadge status={registration.status} />}
        </div>

        <dl className="mt-3 space-y-1.5 text-sm text-muted">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Date</dt>
            <dd>{formatEventDate(event.event_date)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Time</dt>
            <dd>{formatEventTimeRange(event.start_time, event.end_time)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Venue</dt>
            <dd>{event.venue}</dd>
          </div>
        </dl>

        {event.description && (
          <p className="mt-3 line-clamp-2 text-sm text-muted">{event.description}</p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-lg font-extrabold text-foreground">
            {event.registration_fee > 0 ? formatCurrency(Number(event.registration_fee), "NGN") : "Free"}
          </span>

          {completed ? (
            <span className="rounded-full bg-background px-3 py-1 text-[11px] font-bold tracking-wide text-muted">
              EVENT COMPLETED
            </span>
          ) : (
            <span className="text-sm font-semibold text-foreground">
              {registration ? "View registration" : phase === "open" ? "View Event" : phaseLabel(phase)}
            </span>
          )}
        </div>

        {registration && completed && (
          <div className="mt-3">
            <RegistrationStatusBadge status={registration.status} />
          </div>
        )}
      </div>
    </Link>
  );
}
