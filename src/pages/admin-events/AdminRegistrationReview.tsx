import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { AdminGate } from "@/components/events/AdminGate";
import {
  AttendanceBadge,
  ConfirmDialog,
  DetailRow,
  EmptyState,
  ErrorNote,
  LoadingCard,
  RegistrationStatusBadge,
  SubScreenHeader,
  ViewPopButton,
} from "@/components/events/EventUi";
import {
  getPopSignedUrl,
  useAdminRegistration,
  useReviewRegistration,
  useSetAttendance,
} from "@/hooks/useEvents";
import { formatCurrency } from "@/lib/currency";
import {
  attendanceLabel,
  formatDateTime,
  formatEventDate,
  friendlyError,
  getAttendance,
} from "@/lib/events";

export default function AdminRegistrationReview() {
  const { eventId } = useParams<{ eventId: string }>();
  return (
    <AdminGate title="Review Registration" backTo={eventId ? `/admin/events/${eventId}` : "/admin/events"}>
      <Content />
    </AdminGate>
  );
}

function PopPreview({ path }: { path: string }) {
  const isPdf = path.toLowerCase().endsWith(".pdf");
  const { data: url, isError } = useQuery({
    queryKey: ["events", "pop-preview", path],
    enabled: !isPdf,
    staleTime: 4 * 60 * 1000, // signed URL lives 5 minutes
    queryFn: () => getPopSignedUrl(path, 300),
  });

  if (isPdf || isError || !url) return null;
  return (
    <img
      src={url}
      alt="Proof of payment"
      className="mb-3 max-h-80 w-full rounded-xl bg-background object-contain"
    />
  );
}

function Content() {
  const { eventId, registrationId } = useParams<{ eventId: string; registrationId: string }>();
  const { data: reg, isLoading, isError } = useAdminRegistration(registrationId);
  const review = useReviewRegistration();
  const setAttendance = useSetAttendance();

  const [pending, setPending] = useState<"REGISTERED" | "UNSUCCESSFUL" | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const backTo = eventId ? `/admin/events/${eventId}` : "/admin/events";

  async function confirmAction() {
    if (!reg || !pending) return;
    setDialogError(null);
    try {
      const result = await review.mutateAsync({ registrationId: reg.id, status: pending });
      setPending(null);
      setNotice(
        result.pushOk
          ? {
              tone: "ok",
              text:
                result.registration.status === "REGISTERED"
                  ? "Registration confirmed. The user has been notified."
                  : "Registration marked unsuccessful. The user has been notified.",
            }
          : {
              tone: "warn",
              text: "The status was saved and the user will see it in their notifications, but the push notification could not be sent.",
            },
      );
    } catch (err) {
      console.error("Review failed:", err);
      setDialogError(friendlyError(err, "We couldn't update this registration. Please try again."));
    }
  }

  async function toggleAttendance(next: boolean) {
    if (!reg) return;
    setAttendanceError(null);
    try {
      await setAttendance.mutateAsync({ registrationId: reg.id, attended: next });
    } catch (err) {
      setAttendanceError(friendlyError(err, "We couldn't update attendance. Please try again."));
    }
  }

  return (
    <AppShell>
      <SubScreenHeader title="Review Registration" backTo={backTo} />

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
          {notice && (
            <div
              className={
                notice.tone === "ok"
                  ? "mt-5 flex items-start gap-3 rounded-2xl bg-category-income p-4 text-category-income-fg"
                  : "mt-5 flex items-start gap-3 rounded-2xl bg-category-savings p-4 text-category-savings-fg"
              }
              role="status"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="text-sm font-semibold">{notice.text}</p>
            </div>
          )}

          <section className="mt-5 rounded-2xl bg-surface p-5 shadow-card">
            <p className="text-xs text-muted">{reg.registration_code}</p>
            <h2 className="mt-1 text-xl font-extrabold text-foreground">{reg.full_name_snapshot}</h2>
            <div className="mt-3">
              <RegistrationStatusBadge status={reg.status} />
            </div>
          </section>

          <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card">
            <dl className="divide-y divide-border">
              <DetailRow label="Event" value={reg.event_title_snapshot} />
              <DetailRow label="Event date" value={formatEventDate(reg.event_date_snapshot)} />
              <DetailRow label="Email" value={reg.email_snapshot} />
              <DetailRow label="Phone" value={reg.phone_snapshot} />
              <DetailRow
                label="Registration fee"
                value={formatCurrency(Number(reg.fee_snapshot), "NGN", { showDecimals: true })}
              />
              <DetailRow
                label="Amount paid"
                value={formatCurrency(Number(reg.amount_paid), "NGN", { showDecimals: true })}
              />
              <DetailRow label="Payment reference" value={reg.payment_reference} />
              <DetailRow label="Payment date" value={formatEventDate(reg.payment_date)} />
              <DetailRow label="Submitted" value={formatDateTime(reg.created_at)} />
              {reg.verified_at && (
                <DetailRow
                  label="Reviewed"
                  value={`${formatDateTime(reg.verified_at)}${reg.verified_by_name ? ` by ${reg.verified_by_name}` : ""}`}
                />
              )}
              <DetailRow label="Attendance" value={<AttendanceBadge label={attendanceLabel(reg)} />} />
            </dl>

            {Number(reg.amount_paid) !== Number(reg.fee_snapshot) && (
              <p className="mt-3 rounded-xl bg-category-savings px-3 py-2 text-xs text-category-savings-fg">
                The amount paid differs from the registration fee. Check the receipt before confirming.
              </p>
            )}
          </section>

          <section className="mt-4 rounded-2xl bg-surface p-5 shadow-card">
            <h3 className="mb-3 text-sm font-bold text-foreground">Proof of payment</h3>
            <PopPreview path={reg.pop_path} />
            <ViewPopButton path={reg.pop_path} label="Open full file" />
          </section>

          {reg.status === "VERIFYING" && (
            <section className="mt-6 space-y-3">
              <Button className="w-full" onClick={() => setPending("REGISTERED")}>
                Confirm Registration
              </Button>
              <Button variant="danger" className="w-full" onClick={() => setPending("UNSUCCESSFUL")}>
                Mark Unsuccessful
              </Button>
            </section>
          )}

          {reg.status === "REGISTERED" && (
            <section className="mt-6">
              <Button
                variant={getAttendance(reg)?.attended ? "secondary" : "primary"}
                className="w-full"
                disabled={setAttendance.isPending}
                onClick={() => void toggleAttendance(!(getAttendance(reg)?.attended === true))}
              >
                {setAttendance.isPending
                  ? "Saving..."
                  : getAttendance(reg)?.attended
                    ? "Undo Attended"
                    : "Mark as Attended"}
              </Button>
              {attendanceError && <p className="mt-2 text-sm text-danger">{attendanceError}</p>}
            </section>
          )}

          <ConfirmDialog
            open={pending !== null}
            onOpenChange={(o) => {
              if (!o) {
                setPending(null);
                setDialogError(null);
              }
            }}
            title={pending === "REGISTERED" ? "Confirm registration?" : "Mark as unsuccessful?"}
            description={
              pending === "REGISTERED"
                ? `${reg.full_name_snapshot} will be marked REGISTERED and notified that their registration for ${reg.event_title_snapshot} is confirmed. This can't be undone.`
                : `${reg.full_name_snapshot} will be marked UNSUCCESSFUL and notified. They can submit a new registration if the event is still open. This can't be undone.`
            }
            confirmLabel={pending === "REGISTERED" ? "Confirm" : "Mark Unsuccessful"}
            variant={pending === "REGISTERED" ? "primary" : "danger"}
            loading={review.isPending}
            error={dialogError}
            onConfirm={() => void confirmAction()}
          />
        </>
      )}
    </AppShell>
  );
}
