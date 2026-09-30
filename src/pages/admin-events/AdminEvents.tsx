import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AdminGate } from "@/components/events/AdminGate";
import { EmptyState, ErrorNote, LoadingCard, SubScreenHeader } from "@/components/events/EventUi";
import { useAdminEvents } from "@/hooks/useEvents";
import { formatEventDate, formatEventTimeRange } from "@/lib/events";
import { cn } from "@/lib/utils";

type Filter = "all" | "upcoming" | "completed";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

export default function AdminEvents() {
  return (
    <AdminGate title="Manage Events" backTo="/events">
      <AdminEventsContent />
    </AdminGate>
  );
}

function AdminEventsContent() {
  const { data: items, isLoading, isError } = useAdminEvents();
  const [filter, setFilter] = useState<Filter>("all");

  const all = items ?? [];
  const shown = all.filter(({ event }) =>
    filter === "all" ? true : filter === "completed" ? event.is_completed : !event.is_completed,
  );
  const counts: Record<Filter, number> = {
    all: all.length,
    upcoming: all.filter((i) => !i.event.is_completed).length,
    completed: all.filter((i) => i.event.is_completed).length,
  };

  return (
    <AppShell>
      <SubScreenHeader
        title="Manage Events"
        backTo="/events"
        action={
          <Link
            to="/admin/events/new"
            aria-label="Create event"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
          </Link>
        }
      />

      <div className="mt-5 flex gap-2" role="tablist" aria-label="Filter events">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-muted shadow-card",
            )}
          >
            {f.label} ({counts[f.value]})
          </button>
        ))}
      </div>

      <section className="mt-5 space-y-3">
        {isLoading && (
          <>
            <LoadingCard />
            <LoadingCard />
          </>
        )}
        {isError && <ErrorNote>We couldn't load events. Please try again in a moment.</ErrorNote>}
        {!isLoading && !isError && shown.length === 0 && (
          <EmptyState
            icon={CalendarDays}
            text={filter === "completed" ? "No completed events" : "No upcoming events"}
          />
        )}

        {shown.map(({ event, stats }) => (
          <Link
            key={event.id}
            to={`/admin/events/${event.id}`}
            className={cn(
              "block rounded-2xl bg-surface p-5 shadow-card",
              event.is_completed && "opacity-70",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground">{event.title}</h3>
                <p className="mt-0.5 text-xs text-muted">
                  {formatEventDate(event.event_date)} ·{" "}
                  {formatEventTimeRange(event.start_time, event.end_time)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide",
                  event.is_completed
                    ? "bg-background text-muted"
                    : event.is_published
                      ? "bg-category-income text-category-income-fg"
                      : "bg-category-savings text-category-savings-fg",
                )}
              >
                {event.is_completed ? "COMPLETED" : event.is_published ? "PUBLISHED" : "DRAFT"}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
              <Stat label="Total" value={stats?.total_registrations ?? 0} />
              <Stat label="Verifying" value={stats?.verifying ?? 0} />
              <Stat label="Registered" value={stats?.registered ?? 0} />
              <Stat label="Unsuccessful" value={stats?.unsuccessful ?? 0} />
            </dl>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-background px-1 py-2">
      <dd className="text-base font-extrabold text-foreground">{value}</dd>
      <dt className="text-[10px] text-muted">{label}</dt>
    </div>
  );
}
