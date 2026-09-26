import { useState } from "react";
import { ArrowLeft, Megaphone, Users, Send, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export default function Broadcast() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sendPush, setSendPush] = useState(true);

  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["broadcast-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user!.id)
        .single();

      if (error) throw error;

      return data;
    },
  });

  const isAdmin = profile?.is_admin === true;

  async function handleSend() {
    setError(null);
    setSuccess(null);

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    if (!cleanTitle) {
      setError("Please enter a message title.");
      return;
    }

    if (!cleanMessage) {
      setError("Please enter a message.");
      return;
    }

    if (!isAdmin) {
      setError("You do not have permission to send broadcasts.");
      return;
    }

    setSending(true);

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("send-broadcast", {
          body: {
            title: cleanTitle,
            message: cleanMessage,
            send_push: sendPush,
          },
        });

      if (functionError) {
        throw functionError;
      }

      setSuccess(
        `Broadcast sent successfully to ${
          data?.users_notified ?? 0
        } users.`,
      );

      setTitle("");
      setMessage("");
    } catch (err) {
      console.error("Broadcast error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to send broadcast. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  if (profileLoading) {
    return (
      <AppShell>
        <SubScreenHeader
          title="Broadcast Message"
          onBack={() => navigate(-1)}
        />

        <div className="mt-6 h-32 animate-pulse rounded-2xl bg-surface" />
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <SubScreenHeader
          title="Broadcast Message"
          onBack={() => navigate(-1)}
        />

        <div className="mt-6 rounded-2xl bg-surface p-5 text-center shadow-card">
          <Megaphone className="mx-auto h-8 w-8 text-muted" />

          <h2 className="mt-3 text-sm font-semibold text-foreground">
            Admin access required
          </h2>

          <p className="mt-1 text-xs text-muted">
            You do not have permission to send broadcast
            messages.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SubScreenHeader
        title="Broadcast Message"
        onBack={() => navigate(-1)}
      />

      <p className="mt-4 text-sm text-muted">
        Send an important announcement or message to
        everyone using KED Finance.
      </p>

      {/* Recipients */}
      <section className="mt-6 rounded-2xl bg-surface p-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background text-foreground">
            <Users className="h-5 w-5" />
          </span>

          <div>
            <p className="text-sm font-semibold text-foreground">
              All KED Finance Users
            </p>

            <p className="text-xs text-muted">
              Your message will be sent to all registered users.
            </p>
          </div>
        </div>
      </section>

      {/* Message */}
      <section className="mt-4 space-y-4 rounded-2xl bg-surface p-4 shadow-card">
        <Input
          label="Message title"
          icon={<Megaphone className="h-4 w-4" />}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Important Announcement"
          maxLength={100}
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Message
          </label>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message here..."
            rows={6}
            maxLength={1000}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-foreground"
          />

          <p className="mt-1 text-right text-[11px] text-muted">
            {message.length}/1000
          </p>
        </div>
      </section>

      {/* Push notification */}
      <section className="mt-4 rounded-2xl bg-surface p-4 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground">
              <Bell className="h-4 w-4" />
            </span>

            <div>
              <p className="text-sm font-semibold text-foreground">
                Push notification
              </p>

              <p className="text-xs text-muted">
                Notify users on their devices when available.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={sendPush}
            onClick={() => setSendPush((value) => !value)}
            className={`relative h-6 w-11 rounded-full transition ${
              sendPush
                ? "bg-foreground"
                : "bg-border"
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-background transition ${
                sendPush
                  ? "left-6"
                  : "left-1"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Warning */}
      <div className="mt-4 rounded-2xl bg-surface p-4 shadow-card">
        <p className="text-xs leading-5 text-muted">
          This message will be delivered to all registered
          KED Finance users. Make sure the information is
          accurate before sending.
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <p className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {success && (
        <p className="mt-3 text-sm text-success">
          {success}
        </p>
      )}

      {/* Send */}
      <Button
        className="mt-6 w-full"
        disabled={
          sending ||
          !title.trim() ||
          !message.trim()
        }
        onClick={handleSend}
      >
        {sending ? (
          "Sending..."
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send Broadcast
          </>
        )}
      </Button>
    </AppShell>
  );
}

function SubScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <header className="flex items-center gap-3 pt-2">
      <button
        onClick={onBack}
        aria-label="Back"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <h1 className="text-xl font-bold text-foreground">
        {title}
      </h1>
    </header>
  );
}