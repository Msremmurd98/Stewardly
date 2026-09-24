# KED Finance

A mobile-first personal finance and income-allocation app. React + TypeScript + Vite +
Tailwind + Supabase, built to the KED design direction (Urbanist, light lavender
background, rounded soft-color category cards, black primary actions, bottom nav with a
central Add button).

This repo currently covers **Phase 1–3** of the build plan in full (auth, schema, RLS,
fixed 10/30/30/20/10 allocation, income/transactions, the balance engine, dashboard,
category detail, history, overspending validation), working first passes at Goals,
Calendar, Compare and Reports (Phase 4–6), and both **PDF/CSV/Excel export** (spec §24)
and the **scheduled reminder generator** (spec §23, Phase 7). See
"What's not built yet" below for what's still explicitly outstanding — mainly Web Push
delivery of those reminders, and a couple of dedicated pgTAP cases.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the three migrations in order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_functions.sql`

   Or, with the Supabase CLI:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
3. Deploy the Edge Functions:
   ```bash
   supabase functions deploy delete-account
   supabase functions deploy scheduled-reminders
   ```
   Then schedule `scheduled-reminders` to run daily — see
   `supabase/functions/README.md` for the cron setup and an optional shared
   secret.
4. In Project Settings → API, copy your Project URL and anon public key.

## 2. Configure the app

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

## 3. Install and run

```bash
npm install
npm run dev
```

Visit `http://localhost:5173`, sign up, confirm your email (Supabase sends this
automatically), and log in. Your first income entry will create that month's
`monthly_accounts` row and show the live 10/30/30/20/10 allocation preview.

## 4. Run tests

```bash
npm run test          # client-side calculation unit tests (vitest)
supabase test db      # server-side RPC tests (pgTAP) - requires `supabase start`
```

## Project structure

```
supabase/
  migrations/       schema, RLS, RPCs — the source of financial truth
  functions/        Edge Functions (account deletion; reminders scheduler is next-phase)
  tests/            pgTAP tests for the RPCs
src/
  lib/              finance.ts (calculation utils), allocation.ts (fixed split),
                     currency.ts (Intl.NumberFormat), supabase.ts, queryClient.ts
  lib/export/       CSV / Excel / PDF report generation (spec §24), lazy-loaded
                     from ExportMenu so ExcelJS/jsPDF never bloat the app shell
  hooks/            TanStack Query hooks wrapping the RPCs and tables
  components/       ui/ (shadcn-style primitives), layout/, dashboard/, transactions/,
                     reports/ (ExportMenu)
  pages/            one file per route
```

## Why the RPCs, not direct table writes

Every write that affects money — recording income, spending against a category,
editing or deleting a transaction, closing/reopening a month — goes through a
PostgreSQL function in `0003_functions.sql`, not a direct Supabase `insert`/`update`.
That's what makes the following true regardless of what the client sends:

- The 10/30/30/20/10 split can't be changed from the browser — it's hard-coded in
  `get_or_create_monthly_account` and snapshotted per month.
- A category transaction can never exceed its remaining allocation — enforced inside
  `create_category_transaction` / `edit_transaction` under a row lock, so concurrent
  requests can't race past the limit either.
- A closed month can't be written to until it's explicitly reopened.
- `user_id` is always taken from `auth.uid()`, never from a parameter — so nothing a
  client sends can write or read another user's data. RLS policies are a second,
  independent backstop on top of this.

The client-side copies in `src/lib/finance.ts` and `src/lib/allocation.ts` exist only
to render live previews (e.g. the allocation preview while typing an income amount)
and must be kept in sync with the SQL by hand — they are not authoritative.

## What's not built yet

Flagged here explicitly rather than silently stubbed:

- **PWA Web Push delivery.** `scheduled-reminders` (deployed) writes rows into
  `notifications`, which the in-app Notifications page reads today. Turning those into
  OS-level push notifications when the app is closed needs a `push-subscribe` function
  plus a `web-push` send step — see `supabase/functions/README.md`.
- Full test coverage of every case in spec §34 — the calculation-only cases are in
  `src/lib/finance.test.ts`, and the RPC-level cases (overspend, edit reversal, delete
  recalculation, closed-month rejection) are in `supabase/tests/financial_rules.test.sql`.
  Carry-forward-across-months and monthly-comparison are exercised manually via the
  Compare page; dedicated pgTAP cases for those two are still to add.
- Excel/PDF export sheets currently regenerate the Monthly Comparison sheet from only
  the immediately preceding month; comparing two arbitrary months from the export menu
  (rather than just on the in-app Compare page) isn't wired up yet.

## Design notes

- Percentage/label text inside progress rings is rendered as normal HTML positioned
  over the SVG geometry, not as rotated SVG `<text>` — see the comment in
  `CircularProgress.tsx` for why (this was the iPhone Safari bug called out in the spec).
- Modals are a single `ResponsiveModal` component: bottom sheet under `sm:`, centered
  dialog above it, body scroll locked via a `data-scroll-locked` attribute while open,
  and safe-area padding on the sheet variant.
- Currency is always formatted through `Intl.NumberFormat` (`src/lib/currency.ts`) —
  never string-concatenated, and switching currency never converts existing amounts.
