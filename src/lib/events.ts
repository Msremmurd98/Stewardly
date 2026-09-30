import { format, parseISO } from "date-fns";
import type {
  EventAttendanceRow,
  EventRegistrationStatus,
  EventRegistrationWithRelations,
  EventRow,
} from "@/types/events";

// ---------------------------------------------------------------------------
// Upload rules (mirror the bucket limits set in 0006_events.sql)
// ---------------------------------------------------------------------------
export const POP_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const POP_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
export const POP_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const BANNER_MAX_BYTES = 3 * 1024 * 1024; // 3 MB
export const BANNER_ACCEPT = "image/jpeg,image/png,image/webp";
export const BANNER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function extensionForMime(mime: string) {
  return EXT_BY_MIME[mime] ?? "bin";
}

/** Returns a friendly error message, or null if the file is acceptable. */
export function validatePopFile(file: File): string | null {
  if (!POP_MIME_TYPES.includes(file.type)) {
    return "Unsupported file. Please upload a JPG, PNG, WEBP or PDF.";
  }
  if (file.size === 0) return "That file is empty. Please choose another one.";
  if (file.size > POP_MAX_BYTES) return "File is too large. The maximum size is 5 MB.";
  return null;
}

export function validateBannerFile(file: File): string | null {
  if (!BANNER_MIME_TYPES.includes(file.type)) {
    return "Unsupported image. Please upload a JPG, PNG or WEBP.";
  }
  if (file.size > BANNER_MAX_BYTES) return "Image is too large. The maximum size is 3 MB.";
  return null;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
export function formatEventDate(date: string) {
  return format(parseISO(date), "MMMM d, yyyy");
}

/** "HH:mm:ss" -> "9:30 AM" */
export function formatEventTime(time: string | null | undefined) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return format(new Date(2000, 0, 1, h || 0, m || 0), "h:mm a");
}

export function formatEventTimeRange(start: string, end: string | null) {
  return end ? `${formatEventTime(start)} – ${formatEventTime(end)}` : formatEventTime(start);
}

export function formatDateTime(iso: string) {
  return format(new Date(iso), "MMM d, yyyy, h:mm a");
}

/** ISO timestamp -> value for <input type="datetime-local"> (local time). */
export function toDateTimeLocal(iso: string | null): string {
  return iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "";
}

/** <input type="datetime-local"> value -> ISO timestamp (or null). */
export function fromDateTimeLocal(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

// ---------------------------------------------------------------------------
// Event state (derived from the database-computed columns)
// ---------------------------------------------------------------------------
export type EventPhase = "completed" | "open" | "closed" | "full";

export function getEventPhase(event: EventRow): EventPhase {
  if (event.is_completed) return "completed";
  if (event.spots_left !== null && event.spots_left <= 0) return "full";
  if (event.registration_is_open) return "open";
  return "closed";
}

export function phaseLabel(phase: EventPhase) {
  switch (phase) {
    case "completed":
      return "Event completed";
    case "full":
      return "Fully booked";
    case "closed":
      return "Registration closed";
    default:
      return "Registration open";
  }
}

// ---------------------------------------------------------------------------
// Registration helpers
// ---------------------------------------------------------------------------
export function getAttendance(reg: EventRegistrationWithRelations): EventAttendanceRow | null {
  const a = reg.event_attendance;
  if (!a) return null;
  return Array.isArray(a) ? (a[0] ?? null) : a;
}

export type AttendanceLabel = "ATTENDED" | "NOT ATTENDED" | "—";

/** Attendance is only meaningful for confirmed registrations. */
export function attendanceLabel(reg: EventRegistrationWithRelations): AttendanceLabel {
  if (reg.status !== "REGISTERED") return "—";
  return getAttendance(reg)?.attended ? "ATTENDED" : "NOT ATTENDED";
}

export const STATUS_STYLES: Record<
  EventRegistrationStatus,
  { label: string; dot: string; badge: string }
> = {
  VERIFYING: {
    label: "VERIFYING",
    dot: "bg-warning",
    badge: "bg-category-savings text-category-savings-fg",
  },
  REGISTERED: {
    label: "REGISTERED",
    dot: "bg-success",
    badge: "bg-category-income text-category-income-fg",
  },
  UNSUCCESSFUL: {
    label: "UNSUCCESSFUL",
    dot: "bg-danger",
    badge: "bg-red-50 text-danger",
  },
};

export function safeFileName(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Friendly errors. Raw Supabase / Postgres text never reaches the user.
// The RPCs raise short machine codes (see 0006_events.sql).
// ---------------------------------------------------------------------------
const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Please sign in again to continue.",
  EVENT_NOT_FOUND: "We couldn't find that event.",
  EVENT_COMPLETED: "This event has already taken place, so registration is closed.",
  REGISTRATION_CLOSED: "Registration for this event is closed.",
  EVENT_FULL: "Sorry, this event is fully booked.",
  ALREADY_REGISTERED: "You have already registered for this event.",
  INVALID_DETAILS: "Please check your details and try again.",
  INVALID_AMOUNT: "Please enter a valid amount paid.",
  INVALID_POP: "There was a problem with your proof of payment. Please upload it again.",
  POP_MISSING: "Your proof of payment could not be found. Please upload it again.",
  FORBIDDEN: "You don't have permission to do that.",
  INVALID_STATUS: "That status change isn't allowed.",
  NOT_FOUND: "We couldn't find that registration.",
  ALREADY_REVIEWED: "This registration has already been reviewed.",
  NOT_REGISTERED: "Attendance can only be marked for confirmed registrations.",
  CAPACITY_BELOW_REGISTRATIONS:
    "Maximum attendees can't be lower than the number of people already registered.",
};

export function friendlyError(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : typeof err === "string"
        ? err
        : "";

  for (const code of Object.keys(ERROR_MESSAGES)) {
    if (message.includes(code)) return ERROR_MESSAGES[code];
  }

  const lower = message.toLowerCase();
  if (lower.includes("one_active")) return ERROR_MESSAGES.ALREADY_REGISTERED;
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "You don't have permission to do that.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Network problem. Please check your connection and try again.";
  }
  if (lower.includes("too large") || lower.includes("exceeded the maximum")) {
    return "File is too large. The maximum size is 5 MB.";
  }
  if (lower.includes("mime type") || lower.includes("not supported")) {
    return "Unsupported file. Please upload a JPG, PNG, WEBP or PDF.";
  }
  return fallback;
}

/**
 * The registration that "counts" for an event: an active one if there is one,
 * otherwise the most recent (e.g. a rejected attempt). `regs` must be ordered
 * newest first, which is how useMyRegistrations returns them.
 */
export function pickRegistrationForEvent<T extends { event_id: string; status: EventRegistrationStatus }>(
  regs: T[] | undefined,
  eventId: string,
): T | null {
  const mine = (regs ?? []).filter((r) => r.event_id === eventId);
  return mine.find((r) => r.status !== "UNSUCCESSFUL") ?? mine[0] ?? null;
}
