// Supabase Edge Function: send-test-push
//
// Deploy: supabase functions deploy send-test-push
//
// Called by the "Send test notification" button on the Notifications screen.
// Identifies the caller from their own JWT (never a client-supplied user id)
// and sends a push only to that user's own subscriptions - it cannot be used
// to message anyone else.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { sendPush, type PushSubscriptionRow } from "../_shared/push.ts";

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    // The caller's own RLS-scoped client can already read its own
    // push_subscriptions rows directly - no service role needed here.
    const { data: subs, error: subsError } = await userClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (subsError) {
      return new Response(JSON.stringify({ error: subsError.message }), { status: 500 });
    }
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ error: "No push subscription found for this account yet." }), {
        status: 400,
      });
    }

    const results = await Promise.all(
      (subs as PushSubscriptionRow[]).map((sub) =>
        sendPush(sub, {
          title: "KED Finance",
          message: "🔔 This is a test notification - push is working.",
          url: "/notifications",
        })
      )
    );

    const expiredIds = results.filter((r) => r.expired).map((r) => r.subscriptionId);
    if (expiredIds.length > 0) {
      await userClient.from("push_subscriptions").delete().in("id", expiredIds);
    }

    const succeeded = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ ok: succeeded > 0, sent: succeeded, total: results.length }), {
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
