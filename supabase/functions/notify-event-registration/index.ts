// notify-event-registration
//
// Sends the Web Push for an event registration that an admin has just
// confirmed / rejected. The in-app notification row is created inside the
// review_event_registration() database function (same transaction as the
// status change), so this function ONLY delivers the push - it never inserts
// a second notification. It reuses _shared/push.ts exactly like send-broadcast.
//
// Deploy:  supabase functions deploy notify-event-registration
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPush, type PushSubscriptionRow } from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // 1. Authenticate the caller from their own JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Admin only (same check as send-broadcast)
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (profileError || profile?.is_admin !== true) {
      return json({ error: "Admin access required" }, 403);
    }

    // 3. Read the registration
    const body = await req.json().catch(() => ({}));
    const registrationId = typeof body.registration_id === "string" ? body.registration_id : "";
    if (!registrationId) return json({ error: "registration_id is required" }, 400);

    const { data: reg, error: regError } = await adminClient
      .from("event_registrations")
      .select("id, user_id, status, event_title_snapshot")
      .eq("id", registrationId)
      .single();
    if (regError || !reg) return json({ error: "Registration not found" }, 404);

    if (reg.status !== "REGISTERED" && reg.status !== "UNSUCCESSFUL") {
      return json({ error: "Registration has not been reviewed yet" }, 400);
    }

    const confirmed = reg.status === "REGISTERED";
    const title = confirmed ? "Event registration confirmed" : "Event registration unsuccessful";
    const message = confirmed
      ? `Your registration for ${reg.event_title_snapshot} has been confirmed.`
      : `Your registration for ${reg.event_title_snapshot} was unsuccessful. Please check your registration details or contact the event administrator.`;

    // 4. Only the registrant's own devices
    const { data: subscriptions, error: subError } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", reg.user_id);
    if (subError) throw new Error(`Unable to retrieve push subscriptions: ${subError.message}`);

    let pushSent = 0;
    let pushFailed = 0;
    let expiredRemoved = 0;

    const payload = { title, message, url: `/events/mine/${reg.id}` };

    const results = await Promise.all(
      ((subscriptions ?? []) as PushSubscriptionRow[]).map((s) => sendPush(s, payload)),
    );

    for (const result of results) {
      if (result.ok) {
        pushSent++;
        continue;
      }
      pushFailed++;
      console.error("Push failed:", result.subscriptionId, result.error);
      if (result.expired) {
        const { error: deleteError } = await adminClient
          .from("push_subscriptions")
          .delete()
          .eq("id", result.subscriptionId);
        if (!deleteError) expiredRemoved++;
      }
    }

    return json({
      success: true,
      push_sent: pushSent,
      push_failed: pushFailed,
      expired_subscriptions_removed: expiredRemoved,
    });
  } catch (error) {
    console.error("notify-event-registration error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});
