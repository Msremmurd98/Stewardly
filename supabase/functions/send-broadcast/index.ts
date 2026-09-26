import { createClient } from "npm:@supabase/supabase-js@2";
import {
  sendPush,
  type PushSubscriptionRow,
} from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  console.log("send-broadcast started:", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error(
        "Missing Supabase environment variables",
      );
    }

    // --------------------------------------------------
    // 1. Authenticate caller
    // --------------------------------------------------

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return json(
        { error: "Missing authorization header" },
        401,
      );
    }

    const userClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json(
        { error: "Unauthorized" },
        401,
      );
    }

    console.log("Authenticated:", user.id);

    // --------------------------------------------------
    // 2. Service-role client
    // --------------------------------------------------

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // --------------------------------------------------
    // 3. Verify admin
    // --------------------------------------------------

    const { data: profile, error: profileError } =
      await adminClient
        .from("profiles")
        .select("id, full_name, email, is_admin")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      console.error(
        "Profile lookup failed:",
        profileError,
      );

      return json(
        { error: "Profile not found" },
        403,
      );
    }

    if (profile.is_admin !== true) {
      return json(
        { error: "Admin access required" },
        403,
      );
    }

    console.log("Admin verified");

    // --------------------------------------------------
    // 4. Read broadcast
    // --------------------------------------------------

    const body = await req.json();

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const url =
      typeof body.url === "string" && body.url.trim()
        ? body.url.trim()
        : "/notifications";

    if (!title) {
      return json(
        { error: "Title is required" },
        400,
      );
    }

    if (!message) {
      return json(
        { error: "Message is required" },
        400,
      );
    }

    console.log("Broadcast title:", title);

    // --------------------------------------------------
    // 5. Get all users
    // --------------------------------------------------

    const { data: users, error: usersError } =
      await adminClient
        .from("profiles")
        .select("id");

    if (usersError) {
      throw new Error(
        `Unable to retrieve users: ${usersError.message}`,
      );
    }

    console.log(
      "Users found:",
      users?.length ?? 0,
    );

    if (!users || users.length === 0) {
      return json({
        success: true,
        users_notified: 0,
        notifications_created: 0,
        push_sent: 0,
        push_failed: 0,
        expired_subscriptions_removed: 0,
      });
    }

    // --------------------------------------------------
    // 6. Create in-app notifications
    // --------------------------------------------------

    const notificationRows = users.map(
      (targetUser) => ({
        user_id: targetUser.id,
        type: "system",
        title,
        message,
        read: false,
      }),
    );

    const {
      error: notificationError,
    } = await adminClient
      .from("notifications")
      .insert(notificationRows);

    if (notificationError) {
      throw new Error(
        `Unable to create notifications: ${notificationError.message}`,
      );
    }

    console.log(
      "Notifications created:",
      notificationRows.length,
    );

    // --------------------------------------------------
    // 7. Get push subscriptions
    // --------------------------------------------------

    const {
      data: subscriptions,
      error: subscriptionsError,
    } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");

    if (subscriptionsError) {
      throw new Error(
        `Unable to retrieve push subscriptions: ${subscriptionsError.message}`,
      );
    }

    console.log(
      "Push subscriptions found:",
      subscriptions?.length ?? 0,
    );

    // --------------------------------------------------
    // 8. Send Web Push notifications
    // --------------------------------------------------

    let pushSent = 0;
    let pushFailed = 0;
    let expiredSubscriptionsRemoved = 0;

    if (subscriptions && subscriptions.length > 0) {
      const payload = {
        title,
        message,
        url,
      };

      const results = await Promise.all(
        (subscriptions as PushSubscriptionRow[]).map(
          (subscription) =>
            sendPush(subscription, payload),
        ),
      );

      for (const result of results) {
        if (result.ok) {
          pushSent++;

          console.log(
            "Push sent successfully:",
            result.subscriptionId,
          );

          continue;
        }

        pushFailed++;

        console.error(
          "Push failed:",
          result.subscriptionId,
          result.error,
        );

        // 404/410 means the browser subscription is no
        // longer valid, so remove it from the database.
        if (result.expired) {
          const { error: deleteError } =
            await adminClient
              .from("push_subscriptions")
              .delete()
              .eq("id", result.subscriptionId);

          if (deleteError) {
            console.error(
              "Failed to delete expired subscription:",
              result.subscriptionId,
              deleteError,
            );
          } else {
            expiredSubscriptionsRemoved++;

            console.log(
              "Expired subscription removed:",
              result.subscriptionId,
            );
          }
        }
      }
    }

    // --------------------------------------------------
    // 9. Return result
    // --------------------------------------------------

    console.log("Broadcast complete:", {
      usersNotified: users.length,
      notificationsCreated: notificationRows.length,
      pushSent,
      pushFailed,
      expiredSubscriptionsRemoved,
    });

    return json({
      success: true,
      users_notified: users.length,
      notifications_created:
        notificationRows.length,
      push_sent: pushSent,
      push_failed: pushFailed,
      expired_subscriptions_removed:
        expiredSubscriptionsRemoved,
    });
  } catch (error) {
    console.error(
      "send-broadcast error:",
      error,
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error",
      },
      500,
    );
  }
});

function json(
  data: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}
