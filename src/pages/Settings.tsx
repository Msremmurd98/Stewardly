import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Lock,
  Wallet,
  Mail,
  LogOut,
  Trash2,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUpdateProfile, useUpdatePassword } from "@/hooks/useProfile";
import { CURRENCIES } from "@/lib/currency";
import { supabase } from "@/lib/supabase";

type View = "menu" | "profile" | "password" | "currency" | "delete";

export default function Settings() {
  const [view, setView] = useState<View>("menu");
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  if (view === "profile") return <ManageProfileScreen onBack={() => setView("menu")} />;
  if (view === "password") return <UpdatePasswordScreen onBack={() => setView("menu")} />;
  if (view === "currency") return <ChangeCurrencyScreen onBack={() => setView("menu")} />;
  if (view === "delete") return <DeleteAccountScreen onBack={() => setView("menu")} />;

  return (
    <AppShell>
      <header className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Settings</p>
        <h1 className="mt-2 text-2xl font-extrabold text-foreground">{profile?.full_name || "Your Account"}</h1>
        <p className="text-sm text-muted">{profile?.email ?? user?.email}</p>
      </header>

      <section className="mt-6 divide-y divide-border rounded-2xl bg-surface shadow-card">
        <MenuRow icon={User} label="Manage Profile" onClick={() => setView("profile")} />
        <MenuRow icon={Lock} label="Update Password" onClick={() => setView("password")} />
        <MenuRow icon={Wallet} label="Change Currency" onClick={() => setView("currency")} />
        <MenuRow
          icon={Mail}
          label="Contact Support"
          onClick={() => window.open("mailto:support@kedfinance.app", "_blank")}
        />
        <MenuRow icon={LogOut} label="Log Out" onClick={() => signOut().then(() => navigate("/login"))} />
      </section>

      <button
        onClick={() => setView("delete")}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-4 text-sm font-semibold text-danger shadow-card"
      >
        <Trash2 className="h-4 w-4" /> Delete Account
      </button>
    </AppShell>
  );
}

function MenuRow({ icon: Icon, label, onClick }: { icon: typeof User; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between px-4 py-4 text-left">
      <span className="flex items-center gap-3 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-muted" /> {label}
      </span>
      <ChevronRight className="h-4 w-4 text-muted" />
    </button>
  );
}

function SubScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-3 pt-2">
      <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
    </header>
  );
}

function ManageProfileScreen({ onBack }: { onBack: () => void }) {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <AppShell>
      <SubScreenHeader title="Manage Profile" onBack={onBack} />
      <div className="mt-6 space-y-4 rounded-2xl bg-surface p-4 shadow-card">
        <Input label="Full name" icon={<User className="h-4 w-4" />} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input label="Email" icon={<Mail className="h-4 w-4" />} value={profile?.email ?? ""} disabled />
      </div>
      {saved && <p className="mt-3 text-sm text-success">Profile updated.</p>}
      <Button
        className="mt-6 w-full"
        disabled={updateProfile.isPending}
        onClick={async () => {
          await updateProfile.mutateAsync({ full_name: fullName });
          setSaved(true);
        }}
      >
        {updateProfile.isPending ? "Updating..." : "Update Profile"}
      </Button>
    </AppShell>
  );
}

function UpdatePasswordScreen({ onBack }: { onBack: () => void }) {
  const updatePassword = useUpdatePassword();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSuccess(false);
    if (password.length < 8) return setError("New password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    try {
      // Re-authenticate with the current password before rotating it.
      if (user?.email) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (reauthError) throw new Error("Current password is incorrect.");
      }
      await updatePassword.mutateAsync({ currentPassword, newPassword: password });
      setSuccess(true);
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const eyeToggle = (
    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="text-muted">
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <AppShell>
      <SubScreenHeader title="Update Password" onBack={onBack} />
      <div className="mt-6 space-y-4 rounded-2xl bg-surface p-4 shadow-card">
        <Input
          label="Current password"
          type={show ? "text" : "password"}
          icon={<Lock className="h-4 w-4" />}
          trailing={eyeToggle}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input
          label="New password"
          type={show ? "text" : "password"}
          icon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm password"
          type={show ? "text" : "password"}
          icon={<Lock className="h-4 w-4" />}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {success && <p className="mt-3 text-sm text-success">Password updated.</p>}
      <Button className="mt-6 w-full" disabled={updatePassword.isPending} onClick={handleSubmit}>
        {updatePassword.isPending ? "Updating..." : "Change Password"}
      </Button>
    </AppShell>
  );
}

function ChangeCurrencyScreen({ onBack }: { onBack: () => void }) {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [currency, setCurrency] = useState(profile?.currency ?? "NGN");

  return (
    <AppShell>
      <SubScreenHeader title="Change Currency" onBack={onBack} />
      <p className="mt-4 text-sm text-muted">
        This only changes how amounts are displayed. Existing amounts are not converted between currencies.
      </p>
      <div className="mt-4 rounded-2xl bg-surface p-4 shadow-card">
        <Select
          label="Currency"
          value={currency}
          onValueChange={(v) => setCurrency(v as typeof currency)}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
      </div>
      <Button
        className="mt-6 w-full"
        disabled={updateProfile.isPending}
        onClick={() => updateProfile.mutateAsync({ currency })}
      >
        {updateProfile.isPending ? "Saving..." : "Save Currency"}
      </Button>
    </AppShell>
  );
}

function DeleteAccountScreen({ onBack }: { onBack: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signOut } = useAuth();
  const navigate = useNavigate();

async function handleDelete() {
  setError(null);
  setLoading(true);

  try {
    const { error: fnError } =
      await supabase.functions.invoke("delete-account");

    if (fnError) {
      console.error("Delete account function error:", fnError);
      throw fnError;
    }

    // Account is already deleted on Supabase.
    // Clear the local session, but don't let a signOut error stop navigation.
    try {
      await signOut();
    } catch (signOutError) {
      console.warn("Sign out after account deletion:", signOutError);
    }

    // Always send the user to login after successful deletion.
    navigate("/login", { replace: true });
  } catch (err) {
    console.error("Account deletion failed:", err);
    setError((err as Error).message || "Failed to delete account.");
  } finally {
    setLoading(false);
  }
}

  return (
    <AppShell>
      <SubScreenHeader title="Delete Account" onBack={onBack} />
      <div className="mt-6 rounded-2xl bg-surface p-4 shadow-card">
        <p className="text-sm text-foreground">
          This permanently deletes your account and every financial record tied to it — transactions, monthly
          accounts, savings goals and notifications. This cannot be undone.
        </p>
        <p className="mt-4 text-sm font-medium text-foreground">Type DELETE to confirm.</p>
        <Input className="mt-2" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <Button
        variant="danger"
        className="mt-6 w-full"
        disabled={confirmText !== "DELETE" || loading}
        onClick={handleDelete}
      >
        {loading ? "Deleting..." : "Permanently Delete Account"}
      </Button>
    </AppShell>
  );
}
