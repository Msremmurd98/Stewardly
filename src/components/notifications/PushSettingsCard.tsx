
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushSettingsCard() {
  const {
    status,
    subscribed,
    loading,
    error,
    enable,
  } = usePushNotifications();

  // Push notifications are already enabled.
  // Hide the setup card completely.
  if (subscribed) {
    return null;
  }

  if (status === "unsupported") {
    return (
      <div className="rounded-2xl bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted">
            <BellOff className="h-4 w-4" />
          </span>

          <div>
            <p className="text-sm font-semibold text-foreground">
              Push notifications unavailable
            </p>

            <p className="text-xs text-muted">
              This browser doesn't support push, or the app
              hasn't been installed yet. On iPhone, add KED
              Finance to your Home Screen first (Share → Add
              to Home Screen), then open it from there.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="rounded-2xl bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-danger">
            <BellOff className="h-4 w-4" />
          </span>

          <div>
            <p className="text-sm font-semibold text-foreground">
              Notifications are blocked
            </p>

            <p className="text-xs text-muted">
              You previously denied notification permission.
              Enable it for this site in your browser settings,
              then come back here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground">
          <Bell className="h-4 w-4" />
        </span>

        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            Turn on push notifications
          </p>

          <p className="text-xs text-muted">
            Get budget warnings, salary reminders and goal
            updates even when KED Finance isn't open.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-4">
        <Button
          className="w-full"
          onClick={enable}
          disabled={loading}
        >
          {loading ? "Turning on..." : "Turn On"}
        </Button>
      </div>
    </div>
  );
}
