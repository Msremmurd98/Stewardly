import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  Archive,
  CalendarX2,
  FileSpreadsheet,
  FileText,
  Pencil,
  Search,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { AdminGate } from "@/components/events/AdminGate";
import {
  AttendanceBadge,
  EmptyState,
  ErrorNote,
  LoadingCard,
  RegistrationStatusBadge,
  SubScreenHeader,
  ViewPopButton,
} from "@/components/events/EventUi";
import {
  useEvent,
  useEventRegistrations,
  useEventStats,
  useSetAttendance,
  useToggleRegistration,
} from "@/hooks/useEvents";
import { formatCurrency } from "@/lib/currency";
import {
  attendanceLabel,
  formatEventDate,
  formatEventTimeRange,
  friendlyError,
  getAttendance,
} from "@/lib/events";
import { cn } from "@/lib/utils";
import type { EventRegistrationStatus, EventRow, EventStats } from "@/types/events";

type StatusFilter = "ALL" | EventRegistrationStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "VERIFYING", label: "Verifying" },
  { value: "REGISTERED", label: "Registered" },
  { value: "UNSUCCESSFUL", label: "Unsuccessful" },
];

export default function AdminEventRegistrations() {
  return (
    <AdminGate title="Event" backTo="/admin/events">
      <Content />
    </AdminGate>
  );
}

function Content() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: event, isLoading: eventLoading, isError: eventError } = useEvent(eventId);
  const { data: stats } = useEventStats(eventId);
  const { data: registrations, isLoading, isError } = useEventRegistrations(eventId);
  const setAttendance = useSetAttendance();

  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (registrations ?? []).filter((r) => {
      if (filter !== "ALL" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.full_name_snapshot.toLowerCase().includes(q) ||
        r.email_snapshot.toLowerCase().includes(q) ||
        r.phone_snapshot.toLowerCase().includes(q) ||
        r.payment_reference.toLowerCase().includes(q) ||
        r.registration_code.toLowerCase().includes(q)
      );
    });
  }, [registrations, filter, query]);

  if (eventLoading) {
    return (
      <AppShell>
        <SubScreenHeader title="Event" backTo="/admin/events" />
        <div className="mt-6">
          <LoadingCard />
        </div>
      </AppShell>
    );
  }

  if (eventError || !event) {
    return (
      <AppShell>
        <SubScreenHeader title="Event" backTo="/admin/events" />
        {eventError ? (
          <div className="mt-6">
            <ErrorNote>We couldn't load this event. Please try again.</ErrorNote>
          </div>
        ) : (
          <EmptyState icon={CalendarX2} text="This event could not be found." />
        )}
      </AppShell>
    );
  }

  async function toggleAttendance(registrationId: string, attended: boolean) {
    setRowError(null);
    try {
      await setAttendance.mutateAsync({ registrationId, attended });
    } catch (err) {
      setRowError(friendlyError(err, "We couldn't update attendance. Please try again."));
    }
  }

  return (
    <AppShell>
      <SubScreenHeader
        title={event.title}
        backTo="/admin/events"
        action={
          <Link
            to={`/admin/events/${event.id}/edit`}
            aria-label="Edit event"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        }
      />

      <p className="mt-2 text-xs text-muted">
        {formatEventDate(event.event_date)} · {formatEventTimeRange(event.start_time, event.end_time)} ·{" "}
        {event.venue}
      </p>

      <StatsPanel stats={stats ?? null} />
      <EventControls event={event} />
      <ExportBar eventId={event.id} disabled={(registrations ?? []).length === 0} />

      {/* Filters */}
      <div className="mt-6 flex gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="Filter registrations">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
              filter === f.value ? "bg-primary text-primary-foreground" : "bg-surface text-muted shadow-card",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, email or reference"
          aria-label="Search registrations"
          className="h-12 w-full rounded-2xl border border-border bg-surface pl-11 pr-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
      </div>

      {rowError && (
        <div className="mt-3">
          <ErrorNote>{rowError}</ErrorNote>
        </div>
      )}

      <section className="mt-4 space-y-3">
        {isLoading && (
          <>
            <LoadingCard />
            <LoadingCard />
          </>
        )}
        {isError && <ErrorNote>We couldn't load registrations. Please try again.</ErrorNote>}
        {!isLoading && !isError && (registrations ?? []).length === 0 && (
          <EmptyState icon={Users} text="No registrations yet" />
        )}
        {!isLoading && (registrations ?? []).length > 0 && shown.length === 0 && (
          <EmptyState icon={Search} text="No registrations match your filters" />
        )}

        {shown.map((reg) => {
          const attended = getAttendance(reg)?.attended === true;
          const busy =
            setAttendance.isPending && setAttendance.variables?.registrationId === reg.id;
          return (
            <article key={reg.id} className="rounded-2xl bg-surface p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted">{reg.registration_code}</p>
                  <h3 className="truncate text-base font-bold text-foreground">
                    {reg.full_name_snapshot}
                  </h3>
                  <p className="truncate text-xs text-muted">{reg.email_snapshot}</p>
                  <p className="text-xs text-muted">{reg.phone_snapshot}</p>
                </div>
                <RegistrationStatusBadge status={reg.status} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Amount</dt>
                  <dd className="font-semibold text-foreground">
                    {formatCurrency(Number(reg.amount_paid), "NGN")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Registered</dt>
                  <dd className="font-semibold text-foreground">
                    {format(new Date(reg.created_at), "MMM d, yyyy")}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted">Payment reference</dt>
                  <dd className="break-all font-semibold text-foreground">{reg.payment_reference}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Attendance</dt>
                  <dd className="mt-0.5">
                    <AttendanceBadge label={attendanceLabel(reg)} />
                  </dd>
                </div>
              </dl>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <ViewPopButton path={reg.pop_path} label="View POP" />
                <Button asChild size="sm" variant={reg.status === "VERIFYING" ? "primary" : "secondary"}>
                  <Link to={`/admin/events/${event.id}/registrations/${reg.id}`}>
                    {reg.status === "VERIFYING" ? "Review" : "View"}
                  </Link>
                </Button>
              </div>

              {reg.status === "REGISTERED" && (
                <Button
                  size="sm"
                  variant={attended ? "ghost" : "secondary"}
                  className="mt-2 w-full"
                  disabled={busy}
                  onClick={() => void toggleAttendance(reg.id, !attended)}
                >
                  {busy ? "Saving..." : attended ? "Undo attended" : "Mark as attended"}
                </Button>
              )}
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}

function StatsPanel({ stats }: { stats: EventStats | null }) {
  const s = stats ?? {
    total_registrations: 0,
    verifying: 0,
    registered: 0,
    unsuccessful: 0,
    attended: 0,
    total_amount: 0,
    confirmed_amount: 0,
  };
  const cells = [
    { label: "Verifying", value: s.verifying },
    { label: "Registered", value: s.registered },
    { label: "Unsuccessful", value: s.unsuccessful },
    { label: "Attended", value: s.attended },
  ];

  return (
    <section className="mt-5 rounded-2xl bg-surface p-5 shadow-card">
      <p className="text-xs text-muted">Total registrations</p>
      <p className="text-3xl font-extrabold text-foreground">{s.total_registrations}</p>

      <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl bg-background px-1 py-2">
            <dd className="text-base font-extrabold text-foreground">{c.value}</dd>
            <dt className="text-[10px] text-muted">{c.label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted">Total amount submitted</p>
          <p className="text-xl font-extrabold text-foreground">
            {formatCurrency(Number(s.total_amount), "NGN")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Confirmed</p>
          <p className="text-sm font-bold text-foreground">
            {formatCurrency(Number(s.confirmed_amount), "NGN")}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Manual open/close of registration, plus the current state of the event. */
function EventControls({ event }: { event: EventRow }) {
  const toggle = useToggleRegistration();
  const [error, setError] = useState<string | null>(null);

  async function handle(enabled: boolean) {
    setError(null);
    try {
      await toggle.mutateAsync({ eventId: event.id, enabled });
    } catch (err) {
      setError(friendlyError(err, "We couldn't update registration. Please try again."));
    }
  }

  return (
    <section className="mt-4 rounded-2xl bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {event.is_completed
              ? "Event completed"
              : event.registration_is_open
                ? "Registration is open"
                : "Registration is closed"}
          </p>
          <p className="text-xs text-muted">
            {!event.is_published ? "Draft — hidden from users. " : ""}
            {event.is_completed
              ? "No new registrations or POPs can be submitted."
              : event.spots_left !== null
                ? `${event.spots_left} spot${event.spots_left === 1 ? "" : "s"} left.`
                : "No attendee limit."}
          </p>
        </div>
        {!event.is_completed && (
          <Button
            size="sm"
            variant="secondary"
            disabled={toggle.isPending}
            onClick={() => void handle(!event.registration_enabled)}
          >
            {toggle.isPending ? "Saving..." : event.registration_enabled ? "Close" : "Open"}
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </section>
  );
}

function ExportBar({ eventId, disabled }: { eventId: string; disabled: boolean }) {
  type Kind = "xlsx" | "csv" | "pops";
  const [pending, setPending] = useState<Kind | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(kind: Kind) {
    setError(null);
    setNotice(null);
    setProgress(null);
    setPending(kind);
    try {
      // Loaded on demand (ExcelJS / JSZip are large), same approach as the report ExportMenu.
      const lib = await import("@/lib/export/events");
      if (kind === "xlsx") await lib.exportEventRegistrationsToExcel(eventId);
      if (kind === "csv") await lib.exportEventRegistrationsToCSV(eventId);
      if (kind === "pops") {
        const result = await lib.downloadEventPops(eventId, (done, total) =>
          setProgress(`Preparing ${done} of ${total}...`),
        );
        if (result.total === 0) setNotice("There are no proofs of payment to download yet.");
        else if (result.added === 0) throw new Error("no files");
        else if (result.failed > 0)
          setNotice(`${result.failed} file(s) could not be included in the download.`);
      }
    } catch (err) {
      console.error("Event export failed:", err);
      setError(
        kind === "pops"
          ? "We couldn't prepare the POP download. Please try again."
          : "We couldn't generate the export. Please try again.",
      );
    } finally {
      setPending(null);
      setProgress(null);
    }
  }

  return (
    <section className="mt-4">
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="px-2"
          disabled={disabled || pending !== null}
          onClick={() => void run("xlsx")}
        >
          <FileSpreadsheet className="h-4 w-4" />
          {pending === "xlsx" ? "..." : "Excel"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="px-2"
          disabled={disabled || pending !== null}
          onClick={() => void run("csv")}
        >
          <FileText className="h-4 w-4" />
          {pending === "csv" ? "..." : "CSV"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="px-2"
          disabled={disabled || pending !== null}
          onClick={() => void run("pops")}
        >
          <Archive className="h-4 w-4" />
          {pending === "pops" ? "..." : "POPs"}
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">
        Export Excel · Export CSV · Download POPs — always the latest data
      </p>
      {progress && <p className="mt-1 text-center text-xs text-muted">{progress}</p>}
      {notice && <p className="mt-1 text-center text-xs text-muted">{notice}</p>}
      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </section>
  );
}
