import { useEffect, useRef, useState, type ReactNode, type TextareaHTMLAttributes } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarX2, ImagePlus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminGate } from "@/components/events/AdminGate";
import { EmptyState, ErrorNote, LoadingCard, SubScreenHeader } from "@/components/events/EventUi";
import { uploadEventBanner, useEvent, useSaveEvent } from "@/hooks/useEvents";
import {
  BANNER_ACCEPT,
  friendlyError,
  fromDateTimeLocal,
  toDateTimeLocal,
  validateBannerFile,
} from "@/lib/events";
import { cn } from "@/lib/utils";
import type { EventInput, EventRow } from "@/types/events";

export default function AdminEventForm() {
  const { eventId } = useParams<{ eventId: string }>();
  const isEdit = !!eventId;
  const title = isEdit ? "Edit Event" : "Create Event";

  return (
    <AdminGate title={title} backTo="/admin/events">
      {isEdit ? <EditLoader eventId={eventId} /> : <EventFormBody event={null} />}
    </AdminGate>
  );
}

function EditLoader({ eventId }: { eventId: string }) {
  const { data: event, isLoading, isError } = useEvent(eventId);

  if (isLoading) {
    return (
      <AppShell>
        <SubScreenHeader title="Edit Event" backTo="/admin/events" />
        <div className="mt-6">
          <LoadingCard />
        </div>
      </AppShell>
    );
  }
  if (isError || !event) {
    return (
      <AppShell>
        <SubScreenHeader title="Edit Event" backTo="/admin/events" />
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
  return <EventFormBody event={event} />;
}

function TextArea({
  label,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = props.id ?? label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        className={cn(
          "w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 text-left"
    >
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card">
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

type Errors = Partial<Record<string, string>>;

function EventFormBody({ event }: { event: EventRow | null }) {
  const navigate = useNavigate();
  const save = useSaveEvent();
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!event;

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(event?.image_url ?? null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [eventDate, setEventDate] = useState(event?.event_date ?? "");
  const [startTime, setStartTime] = useState(event?.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(event?.end_time?.slice(0, 5) ?? "");
  const [openAt, setOpenAt] = useState(toDateTimeLocal(event?.registration_open_at ?? null));
  const [closeAt, setCloseAt] = useState(toDateTimeLocal(event?.registration_close_at ?? null));

  const [venue, setVenue] = useState(event?.venue ?? "");
  const [address, setAddress] = useState(event?.address ?? "");

  const [fee, setFee] = useState(event ? String(event.registration_fee) : "");
  const [bankName, setBankName] = useState(event?.bank_name ?? "");
  const [accountName, setAccountName] = useState(event?.account_name ?? "");
  const [accountNumber, setAccountNumber] = useState(event?.account_number ?? "");
  const [instructions, setInstructions] = useState(event?.payment_instructions ?? "");

  const [maxAttendees, setMaxAttendees] = useState(
    event?.max_attendees != null ? String(event.max_attendees) : "",
  );
  const [registrationEnabled, setRegistrationEnabled] = useState(event?.registration_enabled ?? true);
  const [isPublished, setIsPublished] = useState(event?.is_published ?? false);

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bannerFile) {
      setBannerPreview(null);
      return;
    }
    const url = URL.createObjectURL(bannerFile);
    setBannerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [bannerFile]);

  function pickBanner(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const problem = validateBannerFile(file);
    if (problem) {
      setErrors((e) => ({ ...e, banner: problem }));
    } else {
      setErrors((e) => ({ ...e, banner: undefined }));
      setBannerFile(file);
    }
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  }

  function validate(publish: boolean): Errors {
    const e: Errors = {};
    if (title.trim().length < 2) e.title = "Enter an event title.";
    if (!eventDate) e.eventDate = "Select the event date.";
    if (!startTime) e.startTime = "Select the start time.";
    if (endTime && startTime && endTime <= startTime) e.endTime = "End time must be after the start time.";
    if (!venue.trim()) e.venue = "Enter the venue.";

    const feeNum = fee === "" ? 0 : Number(fee);
    if (!Number.isFinite(feeNum) || feeNum < 0) e.fee = "Enter a valid registration fee.";

    if (openAt && closeAt && new Date(closeAt) <= new Date(openAt)) {
      e.closeAt = "Registration must close after it opens.";
    }
    if (maxAttendees !== "") {
      const n = Number(maxAttendees);
      if (!Number.isInteger(n) || n <= 0) e.maxAttendees = "Enter a whole number greater than 0, or leave empty.";
    }
    // A paid, published event must tell people where to pay.
    if (publish && feeNum > 0) {
      if (!bankName.trim()) e.bankName = "Required for a paid event.";
      if (!accountName.trim()) e.accountName = "Required for a paid event.";
      if (!accountNumber.trim()) e.accountNumber = "Required for a paid event.";
    }
    return e;
  }

  async function handleSave(publish: boolean) {
    if (saving) return;
    setFormError(null);

    const found = validate(publish);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      let finalImage = imageUrl;
      if (bannerFile) finalImage = await uploadEventBanner(bannerFile);

      const clean = (v: string) => (v.trim() ? v.trim() : null);
      const input: EventInput = {
        title: title.trim(),
        description: clean(description),
        image_url: finalImage,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime || null,
        registration_open_at: fromDateTimeLocal(openAt),
        registration_close_at: fromDateTimeLocal(closeAt),
        venue: venue.trim(),
        address: clean(address),
        registration_fee: fee === "" ? 0 : Number(fee),
        bank_name: clean(bankName),
        account_name: clean(accountName),
        account_number: clean(accountNumber),
        payment_instructions: clean(instructions),
        max_attendees: maxAttendees === "" ? null : Number(maxAttendees),
        registration_enabled: registrationEnabled,
        is_published: publish,
      };

      const saved = await save.mutateAsync({ id: event?.id, input });
      navigate(`/admin/events/${saved.id}`, { replace: true });
    } catch (err) {
      console.error("Save event failed:", err);
      setFormError(friendlyError(err, "We couldn't save the event. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  const shownBanner = bannerPreview ?? imageUrl;

  return (
    <AppShell>
      <SubScreenHeader
        title={isEdit ? "Edit Event" : "Create Event"}
        backTo={isEdit ? `/admin/events/${event!.id}` : "/admin/events"}
      />

      {isEdit && (
        <p className="mt-4 rounded-xl bg-background px-4 py-3 text-xs text-muted">
          Existing registrations keep the event title, date and fee they were made with, so edits here
          won't change anyone's historical record.
        </p>
      )}

      <form
        className="mt-5 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave(isPublished);
        }}
      >
        <Section title="Basic information">
          <Input
            label="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            disabled={saving}
          />
          <TextArea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />

          <div>
            <p className="mb-1.5 text-sm font-medium text-foreground">Event banner</p>
            <input
              ref={bannerInputRef}
              type="file"
              accept={BANNER_ACCEPT}
              className="sr-only"
              aria-label="Upload event banner"
              onChange={(e) => pickBanner(e.target.files)}
            />
            {shownBanner ? (
              <div>
                <img
                  src={shownBanner}
                  alt="Event banner preview"
                  className="h-40 w-full rounded-2xl object-cover"
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onClick={() => bannerInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" /> Change
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      setBannerFile(null);
                      setImageUrl(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => bannerInputRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center"
              >
                <ImagePlus className="h-6 w-6 text-muted" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">Upload banner</span>
                <span className="text-xs text-muted">JPG, PNG or WEBP · max 3 MB</span>
              </button>
            )}
            {errors.banner && <p className="mt-1.5 text-sm text-danger">{errors.banner}</p>}
          </div>
        </Section>

        <Section title="Schedule">
          <Input
            label="Event date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            error={errors.eventDate}
            disabled={saving}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              error={errors.startTime}
              disabled={saving}
            />
            <Input
              label="End time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              error={errors.endTime}
              disabled={saving}
            />
          </div>
          <Input
            label="Registration opens"
            type="datetime-local"
            value={openAt}
            onChange={(e) => setOpenAt(e.target.value)}
            disabled={saving}
          />
          <Input
            label="Registration closes"
            type="datetime-local"
            value={closeAt}
            onChange={(e) => setCloseAt(e.target.value)}
            error={errors.closeAt}
            disabled={saving}
          />
          <p className="-mt-2 text-xs text-muted">
            Times are in West Africa Time (Lagos). Leave the registration dates empty to accept
            registrations until the event ends.
          </p>
        </Section>

        <Section title="Location">
          <Input
            label="Venue"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            error={errors.venue}
            disabled={saving}
          />
          <TextArea
            label="Address / location details"
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={saving}
          />
        </Section>

        <Section title="Payment">
          <Input
            label="Registration fee (₦)"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            error={errors.fee}
            disabled={saving}
          />
          <Input
            label="Bank / payment provider"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            error={errors.bankName}
            disabled={saving}
          />
          <Input
            label="Account name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            error={errors.accountName}
            disabled={saving}
          />
          <Input
            label="Account number"
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            error={errors.accountNumber}
            disabled={saving}
          />
          <TextArea
            label="Payment instructions"
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={saving}
          />
        </Section>

        <Section title="Registration">
          <Input
            label="Maximum attendees (optional)"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={maxAttendees}
            onChange={(e) => setMaxAttendees(e.target.value)}
            error={errors.maxAttendees}
            disabled={saving}
          />
          <Toggle
            label="Registration enabled"
            description="Turn off to stop new registrations before the event date."
            checked={registrationEnabled}
            onChange={setRegistrationEnabled}
          />
          {isEdit && (
            <Toggle
              label="Published"
              description="Unpublished events are hidden from everyone except admins."
              checked={isPublished}
              onChange={setIsPublished}
            />
          )}
        </Section>

        {formError && <ErrorNote>{formError}</ErrorNote>}

        {isEdit ? (
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        ) : (
          <div className="space-y-3">
            <Button type="button" className="w-full" disabled={saving} onClick={() => void handleSave(true)}>
              {saving ? "Saving..." : "Save & Publish"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={saving}
              onClick={() => void handleSave(false)}
            >
              Save as Draft
            </Button>
          </div>
        )}
      </form>
    </AppShell>
  );
}
