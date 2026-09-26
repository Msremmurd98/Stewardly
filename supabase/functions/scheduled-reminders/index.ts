// Supabase Edge Function: scheduled-reminders
//
// Deploy:
//   supabase functions deploy scheduled-reminders
// Secrets required for push delivery (skip these and it still writes
// in-app notification rows, just without a push):
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
// Schedule (Supabase Dashboard -> Edge Functions -> scheduled-reminders -> Cron,
// or via `supabase functions schedule` on newer CLI versions):
//   0 8 * * *   (daily at 08:00 UTC)
//
// Runs with the service-role key so it can read/insert across every user in
// one pass, but it never accepts a user_id from a caller - this endpoint is
// only ever invoked by Supabase's own cron trigger, not by client code.
// It is intentionally idempotent within a day: before inserting a
// notification it checks whether an equivalent one (same user, type, and
// day) already exists, so re-running the cron doesn't spam duplicates.
// Every notification is also delivered as a Web Push to that user's
// subscribed devices via notifyUser() below (see ../_shared/push.ts).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { sendPush, type PushSubscriptionRow } from "../_shared/push.ts";

const ADMIN = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const CATEGORIES = ["tithe", "investment", "giving", "expense", "savings"] as const;
type Category = (typeof CATEGORIES)[number];
const LABELS: Record<Category, string> = {
  tithe: "tithe",
  investment: "investment",
  giving: "giving",
  expense: "expense",
  savings: "savings",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function alreadySentToday(userId: string, type: string, titleFragment: string) {
  const { data } = await ADMIN
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .ilike("title", `%${titleFragment}%`)
    .gte("created_at", `${todayISO()}T00:00:00Z`)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Writes the in-app notification row AND best-effort delivers it as a Web
 * Push to every device the user has subscribed (spec §23 "PWA push
 * notifications... without requiring a rewrite" - this is that follow-up).
 * A push failure never blocks the in-app row from being written, and a
 * missing VAPID config degrades to in-app-only rather than throwing.
 */
async function notifyUser(userId: string, type: string, title: string, message: string, url?: string) {
  await ADMIN.from("notifications").insert({ user_id: userId, type, title, message });

  const { data: subs } = await ADMIN
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return;

  const results = await Promise.all(
    (subs as PushSubscriptionRow[]).map((sub) => sendPush(sub, { title, message, url }).catch((err) => ({
      subscriptionId: sub.id,
      ok: false,
      expired: false,
      error: String(err),
    })))
  );

  const expiredIds = results.filter((r) => r.expired).map((r) => r.subscriptionId);
  if (expiredIds.length > 0) {
    await ADMIN.from("push_subscriptions").delete().in("id", expiredIds);
  }
}

// ---------------------------------------------------------
// 1) Expected income due tomorrow (spec: "Your expected salary is due tomorrow.")
// ---------------------------------------------------------
async function checkExpectedIncome() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = tomorrow.getDate();

  const { data: rows } = await ADMIN
    .from("expected_income")
    .select("id, user_id, name, expected_date, enabled")
    .eq("enabled", true);

  for (const row of rows ?? []) {
    if (!row.expected_date) continue;
    const day = new Date(row.expected_date).getDate();
    if (day !== tomorrowDay) continue;
    if (await alreadySentToday(row.user_id, "salary_due", row.name)) continue;
    await notifyUser(
      row.user_id,
      "salary_due",
      `${row.name} is due tomorrow`,
      `🔔 Your expected income "${row.name}" is due tomorrow.`,
      "/income"
    );
  }
}

// ---------------------------------------------------------
// 2) Budget threshold warnings (70/85/100%) and month-closing-soon
// ---------------------------------------------------------
async function checkMonthlyAccounts() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const { data: accounts } = await ADMIN
    .from("monthly_accounts")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .eq("status", "OPEN");

  const daysInMonth = new Date(year, month, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate();

  for (const account of accounts ?? []) {
    for (const category of CATEGORIES) {
      const allocated = account[`${category}_allocated`] as number;
      const used = account[`${category}_used`] as number;
      if (!allocated || allocated <= 0) continue;
      const pct = (used / allocated) * 100;

      let title: string | null = null;
      let message: string | null = null;
      if (pct >= 100) {
        title = `${LABELS[category]} allocation fully used`;
        message = `Your ${LABELS[category]} allocation has been fully used.`;
      } else if (pct >= 85) {
        title = `${LABELS[category]} budget at ${Math.round(pct)}%`;
        message = `🔔 You've used ${Math.round(pct)}% of your ${monthName(month)} ${LABELS[category]} allocation.`;
      } else if (pct >= 70) {
        title = `${LABELS[category]} budget at ${Math.round(pct)}%`;
        message = `🔔 You've used ${Math.round(pct)}% of your ${LABELS[category]} budget.`;
      }
      if (!title || !message) continue;
      if (await alreadySentToday(account.user_id, "budget_warning", LABELS[category])) continue;
      await notifyUser(account.user_id, "budget_warning", title, message, `/category/${category}`);
    }

    if (daysRemaining <= 3 && daysRemaining >= 0) {
      if (await alreadySentToday(account.user_id, "month_closing", monthName(month))) continue;
      await notifyUser(
        account.user_id,
        "month_closing",
        `${monthName(month)} closing soon`,
        `🔔 ${monthName(month)} has ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining.`,
        "/reports"
      );
    }
  }
}

// ---------------------------------------------------------
// 3) Savings goal progress ("You're ₦50,000 away from your target.")
// ---------------------------------------------------------
async function checkSavingsGoals() {
  const { data: goals } = await ADMIN.from("savings_goals").select("*").eq("status", "active");

  for (const goal of goals ?? []) {
    const remaining = goal.target_amount - goal.current_amount;
    if (remaining <= 0) continue;
    const pct = (goal.current_amount / goal.target_amount) * 100;
    if (pct < 80) continue; // only nudge when genuinely close
    if (await alreadySentToday(goal.user_id, "goal_progress", goal.name)) continue;
    await notifyUser(
      goal.user_id,
      "goal_progress",
      `Almost there: ${goal.name}`,
      `🔔 You're ${remaining.toLocaleString()} away from your "${goal.name}" savings target.`,
      "/goals"
    );
  }
}

function monthName(month: number) {
  return new Date(2000, month - 1, 1).toLocaleString("en-US", { month: "long" });
}

serve(async (req) => {
  // Optional shared-secret check so this can't be triggered by an arbitrary
  // request even though it never trusts caller-supplied data. Set
  // CRON_SECRET as a function secret and pass it as the same header from
  // your scheduler if you want this extra layer.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    await Promise.all([checkExpectedIncome(), checkMonthlyAccounts(), checkSavingsGoals()]);
    return new Response(JSON.stringify({ ok: true, ranAt: new Date().toISOString() }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
