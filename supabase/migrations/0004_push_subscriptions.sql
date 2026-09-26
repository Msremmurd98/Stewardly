-- =========================================================
-- KED Finance — 0004_push_subscriptions.sql
-- Stores browser Push API subscriptions so scheduled-reminders can deliver
-- OS-level notifications, not just in-app notification rows.
-- =========================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- A user can see, create and remove only their own subscriptions. There is
-- no update policy - a changed subscription is deleted and re-inserted,
-- since endpoint/keys are issued as a unit by the browser's Push API.
drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Reads/writes/sends from scheduled-reminders and send-test-push happen
-- through the service-role key (bypasses RLS by design, same as those
-- functions already do for `notifications`), never through a client role.
