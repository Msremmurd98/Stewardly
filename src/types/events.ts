export type EventRegistrationStatus = "VERIFYING" | "REGISTERED" | "UNSUCCESSFUL";

/**
 * Row of `events` plus the virtual columns computed by the database
 * (see 0006_events.sql). The database clock decides what is completed/open.
 */
export interface EventRow {
  id: string;
  code: string;
  title: string;
  description: string | null;
  image_url: string | null;

  event_date: string; // yyyy-MM-dd
  start_time: string; // HH:mm:ss
  end_time: string | null;
  timezone: string;

  venue: string;
  address: string | null;

  registration_fee: number;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  payment_instructions: string | null;

  registration_open_at: string | null;
  registration_close_at: string | null;
  registration_enabled: boolean;
  max_attendees: number | null;

  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // computed by the database
  starts_at: string;
  ends_at: string;
  is_completed: boolean;
  registration_is_open: boolean;
  spots_left: number | null;
}

export interface EventAttendanceRow {
  id: string;
  event_id: string;
  registration_id: string;
  user_id: string;
  attended: boolean;
  marked_at: string;
  marked_by: string | null;
}

export interface EventRegistrationRow {
  id: string;
  event_id: string;
  user_id: string;
  registration_number: number;
  registration_code: string;

  full_name_snapshot: string;
  email_snapshot: string;
  phone_snapshot: string;
  event_title_snapshot: string;
  event_date_snapshot: string;
  fee_snapshot: number;

  amount_paid: number;
  payment_reference: string;
  payment_date: string;
  pop_path: string;

  status: EventRegistrationStatus;
  verified_at: string | null;
  verified_by: string | null;
  verified_by_name: string | null;

  created_at: string;
  updated_at: string;
}

/** Registration with its attendance row (0 or 1), as joined by PostgREST. */
export interface EventRegistrationWithRelations extends EventRegistrationRow {
  event_attendance: EventAttendanceRow | EventAttendanceRow[] | null;
}

export interface EventStats {
  event_id: string;
  total_registrations: number;
  verifying: number;
  registered: number;
  unsuccessful: number;
  attended: number;
  total_amount: number;
  confirmed_amount: number;
}

/** Payload for creating / editing an event (admin form). */
export interface EventInput {
  title: string;
  description: string | null;
  image_url: string | null;
  event_date: string;
  start_time: string;
  end_time: string | null;
  registration_open_at: string | null;
  registration_close_at: string | null;
  venue: string;
  address: string | null;
  registration_fee: number;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  payment_instructions: string | null;
  max_attendees: number | null;
  registration_enabled: boolean;
  is_published: boolean;
}
