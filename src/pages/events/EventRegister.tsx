import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNote, LoadingCard, SubScreenHeader } from "@/components/events/EventUi";
import { PopUpload } from "@/components/events/PopUpload";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useEvent, useMyRegistrations, useRegisterForEvent } from "@/hooks/useEvents";
import { formatCurrency } from "@/lib/currency";
import { friendlyError, getEventPhase, phaseLabel, pickRegistrationForEvent } from "@/lib/events";

interface FieldErrors {
  fullName?: string;
  phone?: string;
  email?: string;
  amountPaid?: string;
  paymentReference?: string;
  paymentDate?: string;
  pop?: string;
}

export default function EventRegister() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: event, isLoading } = useEvent(eventId);
  const { data: registrations, isLoading: regsLoading } = useMyRegistrations();
  const register = useRegisterForEvent();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [popFile, setPopFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Pre-fill from the signed-in user's profile (only fields the user hasn't touched).
  useEffect(() => {
    setFullName((v) => v || profile?.full_name || "");
    setEmail((v) => v || profile?.email || user?.email || "");
  }, [profile, user]);

  useEffect(() => {
    if (event) setAmountPaid((v) => v || (Number(event.registration_fee) > 0 ? String(event.registration_fee) : ""));
  }, [event]);

  if (isLoading || regsLoading) {
    return (
      <AppShell>
        <SubScreenHeader title="Register" backTo={`/events/${eventId}`} />
        <div className="mt-6">
          <LoadingCard />
        </div>
      </AppShell>
    );
  }

  if (!event) return <Navigate to="/events" replace />;

  const phase = getEventPhase(event);
  const existing = pickRegistrationForEvent(registrations, event.id);

  // Already registered (or registration was submitted a moment ago): go to the registration.
  if (existing && existing.status !== "UNSUCCESSFUL" && !register.isPending) {
    return <Navigate to={`/events/mine/${existing.id}`} replace />;
  }

  if (phase !== "open") {
    return (
      <AppShell>
        <SubScreenHeader title="Register" backTo={`/events/${event.id}`} />
        <div className="mt-6">
          <ErrorNote>
            {phase === "completed"
              ? "This event has already taken place, so registration is closed."
              : `${phaseLabel(phase)}. New registrations are not being accepted.`}
          </ErrorNote>
        </div>
      </AppShell>
    );
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!fullName.trim()) next.fullName = "Please enter your full name.";
    if (!phone.trim()) next.phone = "Please enter your phone number.";
    else if (phone.replace(/[^\d]/g, "").length < 7) next.phone = "Please enter a valid phone number.";
    if (!email.trim()) next.email = "Please enter your email.";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Please enter a valid email address.";
    const amount = Number(amountPaid);
    if (!amountPaid || !Number.isFinite(amount) || amount <= 0) next.amountPaid = "Enter the amount you paid.";
    if (!paymentReference.trim()) next.paymentReference = "Enter your payment or transaction reference.";
    if (!paymentDate) next.paymentDate = "Select the date you paid.";
    if (!popFile) next.pop = "Please upload your proof of payment to continue.";
    return next;
  }

  async function handleSubmit() {
    if (!event || register.isPending) return;
    setFormError(null);

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      const created = await register.mutateAsync({
        event,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        amountPaid: Number(amountPaid),
        paymentReference: paymentReference.trim(),
        paymentDate,
        popFile: popFile!,
      });
      navigate(`/events/mine/${created.id}`, { replace: true, state: { justSubmitted: true } });
    } catch (err) {
      console.error("Event registration failed:", err);
      setFormError(friendlyError(err, "We couldn't complete your registration. Please try again."));
    }
  }

  const fee = Number(event.registration_fee);

  return (
    <AppShell>
      <SubScreenHeader title="Register" backTo={`/events/${event.id}`} />

      <div className="mt-5 rounded-2xl bg-surface p-4 shadow-card">
        <p className="text-sm font-bold text-foreground">{event.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          Registration fee: {fee > 0 ? formatCurrency(fee, "NGN") : "Free"}
        </p>
        {(event.bank_name || event.account_number) && (
          <p className="mt-2 text-xs text-muted">
            Pay to {event.bank_name} · {event.account_name} · {event.account_number}, then upload your
            receipt below.
          </p>
        )}
      </div>

      <form
        className="mt-6 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <Input
          label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          error={errors.fullName}
          disabled={register.isPending}
        />
        <Input
          label="Phone number"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          error={errors.phone}
          disabled={register.isPending}
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          error={errors.email}
          disabled={register.isPending}
        />
        <Input
          label="Amount paid (₦)"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amountPaid}
          onChange={(e) => setAmountPaid(e.target.value)}
          error={errors.amountPaid}
          disabled={register.isPending}
        />
        <Input
          label="Payment / transaction reference"
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          error={errors.paymentReference}
          disabled={register.isPending}
        />
        <Input
          label="Payment date"
          type="date"
          max={format(new Date(), "yyyy-MM-dd")}
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          error={errors.paymentDate}
          disabled={register.isPending}
        />

        <PopUpload
          file={popFile}
          onChange={(f) => {
            setPopFile(f);
            setErrors((prev) => ({ ...prev, pop: undefined }));
          }}
          error={errors.pop}
          disabled={register.isPending}
        />

        {formError && <ErrorNote>{formError}</ErrorNote>}

        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending ? "Submitting..." : "Submit Registration"}
        </Button>
        <p className="text-center text-xs text-muted">
          Your registration will be marked <strong>VERIFYING</strong> until an administrator confirms
          your payment.
        </p>
      </form>
    </AppShell>
  );
}
