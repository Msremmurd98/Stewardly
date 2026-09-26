# Supabase Edge Functions

## Included

- **delete-account** — deletes the authenticated user's `auth.users` row with
  the service-role key. Every owned table cascades from that FK, so this is
  the whole account-deletion flow (spec §26).

  ```bash
  supabase functions deploy delete-account
  ```

- **scheduled-reminders** — a cron-triggered function that scans
  `expected_income`, `monthly_accounts` and `savings_goals` across every user
  and inserts rows into `notifications` for salary-due, budget-warning
  (70/85/100% thresholds), goal-progress and month-closing reminders (spec
  §23). Idempotent per day per (user, type, subject) so re-running the cron
  doesn't duplicate notifications. Uses the service-role key but never
  accepts a caller-supplied `user_id` — it iterates every account itself and
  is meant to be invoked only by the scheduler, not by client code. Every
  notification it writes is also delivered as a **Web Push** to that user's
  subscribed devices (see below) — a push failure never blocks the in-app row.

  ```bash
  supabase functions deploy scheduled-reminders
  # optional shared-secret check, matched by the x-cron-secret header:
  supabase secrets set CRON_SECRET=<a-random-string>
  ```

  Then schedule it (Dashboard → Edge Functions → scheduled-reminders → Cron,
  or `supabase functions schedule scheduled-reminders --cron "0 8 * * *"` on
  CLI versions that support it) to run daily.

- **send-test-push** — lets the signed-in user send *themselves* one test
  push from the Notifications screen's "Send Test" button. Identifies the
  caller from their own JWT and only ever sends to that caller's own
  `push_subscriptions` rows.

  ```bash
  supabase functions deploy send-test-push
  ```

- **_shared/push.ts** — not a deployable function; the Web Push sending
  helper (`npm:web-push`) imported by both functions above.

## Web Push setup (spec §23 "PWA push notifications")

1. Generate a VAPID key pair once:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Set the private key (and the same public key) as function secrets — these
   must never reach the browser:
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=<public-key> VAPID_PRIVATE_KEY=<private-key> VAPID_SUBJECT=mailto:you@example.com
   ```
3. Put the **public** key only in the frontend's `.env` as
   `VITE_VAPID_PUBLIC_KEY` (see `.env.example`).
4. Run the `0004_push_subscriptions.sql` migration (adds the table these
   functions read from/write to).
5. Deploy `scheduled-reminders` and `send-test-push`, then open the app's
   Notifications screen and tap **Turn On**. On iOS this only works after the
   app has been added to the Home Screen (Add to Home Screen → open from
   there) — that's a Safari/WebKit requirement, not something this app can
   route around.

## Planned for a later phase (not yet implemented)

- Retrying a push that fails for a reason other than an expired subscription
  (e.g. a transient network error) — currently it's just logged in the
  function's response and not retried.
