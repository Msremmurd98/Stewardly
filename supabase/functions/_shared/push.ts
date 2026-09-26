// Shared by scheduled-reminders and send-test-push. Uses Deno's npm:
// specifier (supported by the Supabase Edge Runtime) rather than esm.sh,
// since web-push's native crypto dependencies are more reliable that way.
import webpush from "npm:web-push@3.6.7";

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured = false;

/** Reads VAPID keys from function secrets. Never hard-code these. */
export function ensureWebPushConfigured() {
  if (configured) return;
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@kedfinance.app";
  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set. Run `npx web-push generate-vapid-keys` and " +
        "set both as Supabase function secrets (supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...)."
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  message: string;
  url?: string;
}

export interface SendResult {
  subscriptionId: string;
  ok: boolean;
  expired: boolean;
  error?: string;
}

/**
 * Sends one push message to one subscription. Never throws - a failed
 * subscription (expired/unsubscribed, HTTP 404/410) is reported back as
 * `expired: true` so the caller can delete that row instead of retrying it
 * forever.
 */
export async function sendPush(sub: PushSubscriptionRow, payload: PushPayload): Promise<SendResult> {
  ensureWebPushConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return { subscriptionId: sub.id, ok: true, expired: false };
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    const expired = statusCode === 404 || statusCode === 410;
    return { subscriptionId: sub.id, ok: false, expired, error: String(err) };
  }
}
