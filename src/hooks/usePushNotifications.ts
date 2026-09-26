import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  getPushSupportStatus,
  isSubscribedToPush,
  subscribeToPush,
  type PushSupportStatus,
} from "@/lib/push";

export function usePushNotifications() {
  const { user } = useAuth();

  const [status, setStatus] =
    useState<PushSupportStatus>("unsupported");

  const [subscribed, setSubscribed] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const supportStatus = getPushSupportStatus();

      setStatus(supportStatus);

      if (supportStatus === "unsupported") {
        setSubscribed(false);
        return;
      }

      const isSubscribed = await isSubscribedToPush();

      setSubscribed(isSubscribed);
    } catch (err) {
      console.error(
        "Failed to refresh push notification status:",
        err,
      );

      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!user) {
      setError("You must be signed in to enable notifications.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await subscribeToPush(user.id);

      // Confirm that the browser now has
      // an active push subscription.
      const isSubscribed = await isSubscribedToPush();

      if (!isSubscribed) {
        throw new Error(
          "Push notification subscription could not be confirmed.",
        );
      }

      setSubscribed(true);
      setStatus("granted");
    } catch (err) {
      console.error(
        "Failed to enable push notifications:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to enable push notifications.",
      );

      // Make sure the UI doesn't remain
      // stuck in an enabled state after failure.
      await refresh();
    } finally {
      setLoading(false);
    }
  }, [user, refresh]);

  return {
    status,
    subscribed,
    loading,
    error,
    enable,
  };
}
