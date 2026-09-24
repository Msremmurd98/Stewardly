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
  is meant to be invoked only by the scheduler, not by client code.

  ```bash
  supabase functions deploy scheduled-reminders
  # optional shared-secret check, matched by the x-cron-secret header:
  supabase secrets set CRON_SECRET=<a-random-string>
  ```

  Then schedule it (Dashboard → Edge Functions → scheduled-reminders → Cron,
  or `supabase functions schedule scheduled-reminders --cron "0 8 * * *"` on
  CLI versions that support it) to run daily.

## Planned for a later phase (not yet implemented)

These are called out explicitly rather than silently stubbed, per the "never
pretend a feature works" rule in the app spec:

- **PWA Web Push delivery** — `scheduled-reminders` writes in-app
  `notifications` rows today; a `push-subscribe` function to pair a PWA push
  subscription with a user, plus a `web-push` send step at the end of
  `scheduled-reminders`, is the next increment so the same reminders also
  arrive as OS-level push notifications when the app isn't open.
