import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { extensionForMime } from "@/lib/events";
import type {
  EventInput,
  EventRegistrationRow,
  EventRegistrationStatus,
  EventRegistrationWithRelations,
  EventRow,
  EventStats,
} from "@/types/events";

/**
 * `starts_at`, `ends_at`, `is_completed`, `registration_is_open` and
 * `spots_left` are computed columns defined in 0006_events.sql, so the
 * database clock (not the browser's) decides what is completed / open.
 */
export const EVENT_SELECT =
  "*, starts_at, ends_at, is_completed, registration_is_open, spots_left";

export const eventKeys = {
  all: ["events"] as const,
  isAdmin: (uid: string) => ["events", "is-admin", uid] as const,
  list: () => ["events", "list"] as const,
  detail: (id: string) => ["events", "detail", id] as const,
  mine: (uid: string) => ["events", "mine", uid] as const,
  myOne: (id: string) => ["events", "mine-one", id] as const,
  adminList: () => ["events", "admin-list"] as const,
  stats: (id: string) => ["events", "stats", id] as const,
  registrations: (id: string) => ["events", "registrations", id] as const,
  registration: (id: string) => ["events", "registration", id] as const,
};

// ---------------------------------------------------------------------------
// Admin check (same source of truth as Broadcast: profiles.is_admin).
// This only controls what the UI shows; the database enforces it via RLS/RPCs.
// ---------------------------------------------------------------------------
export function useIsAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: eventKeys.isAdmin(user?.id ?? ""),
    enabled: !!user,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data?.is_admin === true;
    },
  });
}

// ---------------------------------------------------------------------------
// User: events
// ---------------------------------------------------------------------------
export function useEvents() {
  return useQuery({
    queryKey: eventKeys.list(),
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("is_published", true)
        .order("event_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EventRow[];
    },
  });
}

export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: eventKeys.detail(eventId ?? ""),
    enabled: !!eventId,
    queryFn: async (): Promise<EventRow | null> => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("id", eventId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as EventRow) ?? null;
    },
  });
}

// ---------------------------------------------------------------------------
// User: registrations
// ---------------------------------------------------------------------------
export function useMyRegistrations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: eventKeys.mine(user?.id ?? ""),
    enabled: !!user,
    queryFn: async (): Promise<EventRegistrationWithRelations[]> => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*, event_attendance(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EventRegistrationWithRelations[];
    },
  });
}

export function useMyRegistration(registrationId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: eventKeys.myOne(registrationId ?? ""),
    enabled: !!user && !!registrationId,
    queryFn: async (): Promise<EventRegistrationWithRelations | null> => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*, event_attendance(*)")
        .eq("id", registrationId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as EventRegistrationWithRelations) ?? null;
    },
  });
}

export interface RegisterInput {
  event: EventRow;
  fullName: string;
  phone: string;
  email: string;
  amountPaid: number;
  paymentReference: string;
  paymentDate: string; // yyyy-MM-dd
  popFile: File;
}

/**
 * 1) uploads the POP to the private bucket, 2) creates the registration via
 * the register_for_event RPC (status starts as VERIFYING, decided by the DB).
 * If step 2 fails the uploaded file is removed again.
 */
export function useRegisterForEvent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegisterInput): Promise<EventRegistrationRow> => {
      if (!user) throw new Error("NOT_AUTHENTICATED");

      const ext = extensionForMime(input.popFile.type);
      const path = `${input.event.id}/${user.id}/${Date.now()}-payment-proof.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("event-pops")
        .upload(path, input.popFile, {
          contentType: input.popFile.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.rpc("register_for_event", {
        p_event_id: input.event.id,
        p_full_name: input.fullName,
        p_phone: input.phone,
        p_email: input.email,
        p_amount_paid: input.amountPaid,
        p_payment_reference: input.paymentReference,
        p_payment_date: input.paymentDate,
        p_pop_path: path,
      });

      if (error) {
        // best-effort cleanup of the orphaned upload
        await supabase.storage.from("event-pops").remove([path]);
        throw error;
      }
      return data as unknown as EventRegistrationRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

/** Short-lived signed URL for a private POP file (owner or admin only, enforced by storage RLS). */
export async function getPopSignedUrl(path: string, seconds = 300): Promise<string> {
  const { data, error } = await supabase.storage.from("event-pops").createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw error ?? new Error("Could not open file");
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Admin: events
// ---------------------------------------------------------------------------
export interface AdminEventListItem {
  event: EventRow;
  stats: EventStats | null;
}

export function useAdminEvents() {
  return useQuery({
    queryKey: eventKeys.adminList(),
    queryFn: async (): Promise<AdminEventListItem[]> => {
      const [eventsRes, statsRes] = await Promise.all([
        supabase
          .from("events")
          .select(EVENT_SELECT)
          .order("event_date", { ascending: false })
          .order("start_time", { ascending: false }),
        supabase.from("event_registration_stats").select("*"),
      ]);
      if (eventsRes.error) throw eventsRes.error;
      if (statsRes.error) throw statsRes.error;

      const stats = new Map<string, EventStats>();
      for (const s of (statsRes.data ?? []) as unknown as EventStats[]) {
        stats.set(s.event_id, normalizeStats(s));
      }
      return ((eventsRes.data ?? []) as unknown as EventRow[]).map((event) => ({
        event,
        stats: stats.get(event.id) ?? null,
      }));
    },
  });
}

/** numeric columns can arrive as strings from PostgREST. */
function normalizeStats(s: EventStats): EventStats {
  return {
    ...s,
    total_registrations: Number(s.total_registrations),
    verifying: Number(s.verifying),
    registered: Number(s.registered),
    unsuccessful: Number(s.unsuccessful),
    attended: Number(s.attended),
    total_amount: Number(s.total_amount),
    confirmed_amount: Number(s.confirmed_amount),
  };
}

export function useEventStats(eventId: string | undefined) {
  return useQuery({
    queryKey: eventKeys.stats(eventId ?? ""),
    enabled: !!eventId,
    queryFn: async (): Promise<EventStats | null> => {
      const { data, error } = await supabase
        .from("event_registration_stats")
        .select("*")
        .eq("event_id", eventId!)
        .maybeSingle();
      if (error) throw error;
      return data ? normalizeStats(data as unknown as EventStats) : null;
    },
  });
}

export function useSaveEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: EventInput }): Promise<EventRow> => {
      const query = id
        ? supabase.from("events").update(input).eq("id", id)
        : supabase.from("events").insert(input);
      const { data, error } = await query.select(EVENT_SELECT).single();
      if (error) throw error;
      return data as unknown as EventRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

/** Uploads a banner to the public `event-images` bucket and returns its public URL. */
export async function uploadEventBanner(file: File): Promise<string> {
  const ext = extensionForMime(file.type);
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("event-images")
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from("event-images").getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------------------
// Admin: registrations
// ---------------------------------------------------------------------------
export function useEventRegistrations(eventId: string | undefined) {
  return useQuery({
    queryKey: eventKeys.registrations(eventId ?? ""),
    enabled: !!eventId,
    queryFn: async (): Promise<EventRegistrationWithRelations[]> => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*, event_attendance(*)")
        .eq("event_id", eventId!)
        .order("registration_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EventRegistrationWithRelations[];
    },
  });
}

export function useAdminRegistration(registrationId: string | undefined) {
  return useQuery({
    queryKey: eventKeys.registration(registrationId ?? ""),
    enabled: !!registrationId,
    queryFn: async (): Promise<EventRegistrationWithRelations | null> => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*, event_attendance(*)")
        .eq("id", registrationId!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as EventRegistrationWithRelations) ?? null;
    },
  });
}

export interface ReviewResult {
  registration: EventRegistrationRow;
  /** false when the status changed but the push notification could not be sent */
  pushOk: boolean;
}

export function useReviewRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      registrationId,
      status,
    }: {
      registrationId: string;
      status: Extract<EventRegistrationStatus, "REGISTERED" | "UNSUCCESSFUL">;
    }): Promise<ReviewResult> => {
      // 1) Database status change + in-app notification row (atomic RPC).
      const { data, error } = await supabase.rpc("review_event_registration", {
        p_registration_id: registrationId,
        p_status: status,
      });
      if (error) throw error;

      // 2) Push delivery (best effort). The status change is already saved,
      //    so a push failure must never look like a failed approval.
      let pushOk = true;
      try {
        const { error: pushError } = await supabase.functions.invoke("notify-event-registration", {
          body: { registration_id: registrationId },
        });
        if (pushError) pushOk = false;
      } catch {
        pushOk = false;
      }

      return { registration: data as unknown as EventRegistrationRow, pushOk };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

export function useSetAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      registrationId,
      attended,
    }: {
      registrationId: string;
      attended: boolean;
    }) => {
      const { error } = await supabase.rpc("set_event_attendance", {
        p_registration_id: registrationId,
        p_attended: attended,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}

/** Manually open / close registration for an event (before the event date). */
export function useToggleRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, enabled }: { eventId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("events")
        .update({ registration_enabled: enabled })
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all });
    },
  });
}
