import { Link } from "react-router-dom";
import { CalendarDays, ClipboardList, Settings2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EventCard } from "@/components/events/EventCard";
import {
  EmptyState,
  ErrorNote,
  LoadingCard,
  SubScreenHeader,
} from "@/components/events/EventUi";
import { useEvents, useIsAdmin, useMyRegistrations } from "@/hooks/useEvents";
import { pickRegistrationForEvent } from "@/lib/events";

export default function Events() {
  const { data: events, isLoading, isError } = useEvents();
  const { data: registrations } = useMyRegistrations();
  const { data: isAdmin } = useIsAdmin();

  const upcoming = (events ?? []).filter((e) => !e.is_completed);
  // most recent completed event first
  const completed = (events ?? []).filter((e) => e.is_completed).reverse();

  return (
    <AppShell>
      <SubScreenHeader title="Events" backTo="/more" />

      <div className="mt-5 flex gap-3">
        <Link
          to="/events/mine"
          className="flex flex-1 items-center gap-3 rounded-2xl bg-surface p-4 shadow-card"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold text-foreground">My Registrations</span>
        </Link>

        {isAdmin && (
          <Link
            to="/admin/events"
            className="flex flex-1 items-center gap-3 rounded-2xl bg-surface p-4 shadow-card"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
              <Settings2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-foreground">Manage Events</span>
          </Link>
        )}
      </div>

      {isError && (
        <div className="mt-6">
          <ErrorNote>We couldn't load events right now. Please try again in a moment.</ErrorNote>
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-muted">Upcoming Events</h2>
        <div className="mt-3 space-y-3">
          {isLoading && (
            <>
              <LoadingCard />
              <LoadingCard />
            </>
          )}
          {!isLoading && !isError && upcoming.length === 0 && (
            <EmptyState icon={CalendarDays} text="No upcoming events" />
          )}
          {upcoming.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              registration={pickRegistrationForEvent(registrations, event.id)}
            />
          ))}
        </div>
      </section>

      {completed.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-muted">Completed Events</h2>
          <div className="mt-3 space-y-3">
            {completed.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                registration={pickRegistrationForEvent(registrations, event.id)}
              />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
