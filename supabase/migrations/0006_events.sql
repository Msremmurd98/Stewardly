-- =========================================================
-- KED Finance — 0006_events.sql
-- Events & Event Registration module.
--
-- Design rules (same spirit as 0002/0003):
--   * The database is the source of truth for every status.
--   * Clients never INSERT/UPDATE registrations or attendance directly.
--     All writes go through security-definer RPCs that re-check the caller.
--   * Admin = profiles.is_admin = true (same pattern as send-broadcast).
--   * Registrations snapshot the user + event details so later edits to a
--     profile or an event never rewrite history.
-- Run AFTER 0005_admin_broadcast.sql.
-- =========================================================

-- ---------------------------------------------------------
-- ADMIN HELPER
-- ---------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------
-- ENUM
-- ---------------------------------------------------------
do $$ begin
  create type event_registration_status as enum ('VERIFYING', 'REGISTERED', 'UNSUCCESSFUL');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------
-- EVENTS
-- ---------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text,
  image_url text,

  event_date date not null,
  start_time time not null,
  end_time time,
  timezone text not null default 'Africa/Lagos',

  venue text not null check (char_length(btrim(venue)) > 0),
  address text,

  registration_fee numeric(14,2) not null default 0 check (registration_fee >= 0),
  bank_name text,
  account_name text,
  account_number text,
  payment_instructions text,

  registration_open_at timestamptz,
  registration_close_at timestamptz,
  registration_enabled boolean not null default true,
  max_attendees integer check (max_attendees is null or max_attendees > 0),

  is_published boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_end_after_start check (end_time is null or end_time > start_time),
  constraint events_close_after_open check (
    registration_open_at is null or registration_close_at is null
    or registration_close_at > registration_open_at
  )
);

create unique index if not exists idx_events_code on public.events (code);
create index if not exists idx_events_date on public.events (event_date desc);
create index if not exists idx_events_published on public.events (is_published, event_date);

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- Short human code used in registration IDs (e.g. GELF-SUMMIT-2026-001).
-- Generated once on insert and immutable afterwards, because registration
-- codes derived from it are historical records.
create or replace function public.events_before_write()
returns trigger
language plpgsql
as $$
declare
  v_base text;
  v_active integer;
begin
  if tg_op = 'INSERT' then
    if new.code is null or btrim(new.code) = '' then
      v_base := upper(regexp_replace(btrim(new.title), '[^A-Za-z0-9]+', '-', 'g'));
      v_base := btrim(v_base, '-');
      if v_base = '' then v_base := 'EVENT'; end if;
      v_base := left(v_base, 40);
      new.code := v_base;
      if exists (select 1 from public.events e where e.code = new.code) then
        new.code := v_base || '-' || upper(substr(md5(random()::text), 1, 4));
      end if;
    end if;
  else
    new.code := old.code;

    -- never let an edit push capacity below the people already in.
    if new.max_attendees is not null then
      select count(*) into v_active
      from public.event_registrations r
      where r.event_id = new.id and r.status <> 'UNSUCCESSFUL';
      if new.max_attendees < v_active then
        raise exception 'CAPACITY_BELOW_REGISTRATIONS';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------
-- EVENT REGISTRATIONS
-- ---------------------------------------------------------
create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,

  registration_number integer not null,
  registration_code text not null,

  -- snapshots: profile + event details as they were at submission time
  full_name_snapshot text not null,
  email_snapshot text not null,
  phone_snapshot text not null,
  event_title_snapshot text not null,
  event_date_snapshot date not null,
  fee_snapshot numeric(14,2) not null,

  amount_paid numeric(14,2) not null check (amount_paid > 0),
  payment_reference text not null,
  payment_date date not null default current_date,
  pop_path text not null,

  status event_registration_status not null default 'VERIFYING',
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verified_by_name text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_registrations_number_unique unique (event_id, registration_number),
  constraint event_registrations_pop_unique unique (pop_path)
);

-- One ACTIVE registration per user per event. A rejected (UNSUCCESSFUL)
-- registration does not block the user from registering again.
create unique index if not exists idx_event_registrations_one_active
  on public.event_registrations (event_id, user_id)
  where status <> 'UNSUCCESSFUL';

create index if not exists idx_event_registrations_event on public.event_registrations (event_id, status);
create index if not exists idx_event_registrations_user on public.event_registrations (user_id, created_at desc);

drop trigger if exists trg_event_registrations_updated_at on public.event_registrations;
create trigger trg_event_registrations_updated_at
  before update on public.event_registrations
  for each row execute function public.set_updated_at();

-- the events trigger references event_registrations, so create it afterwards
drop trigger if exists trg_events_before_write on public.events;
create trigger trg_events_before_write
  before insert or update on public.events
  for each row execute function public.events_before_write();

-- ---------------------------------------------------------
-- EVENT ATTENDANCE (kept separate from registration status)
-- ---------------------------------------------------------
create table if not exists public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  registration_id uuid not null unique references public.event_registrations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attended boolean not null default false,
  marked_at timestamptz not null default now(),
  marked_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_event_attendance_event on public.event_attendance (event_id, attended);
create index if not exists idx_event_attendance_user on public.event_attendance (user_id);

-- ---------------------------------------------------------
-- COMPUTED COLUMNS (exposed by PostgREST as virtual columns on `events`,
-- so the *database clock* decides what is upcoming / completed / open)
-- ---------------------------------------------------------
create or replace function public.starts_at(e public.events)
returns timestamptz
language sql
stable
as $$
  select (e.event_date + e.start_time)::timestamp at time zone e.timezone;
$$;

-- Events without an end time are treated as running until the end of the day.
create or replace function public.ends_at(e public.events)
returns timestamptz
language sql
stable
as $$
  select (e.event_date + coalesce(e.end_time, time '23:59:59'))::timestamp at time zone e.timezone;
$$;

create or replace function public.is_completed(e public.events)
returns boolean
language sql
stable
as $$
  select now() >= (e.event_date + coalesce(e.end_time, time '23:59:59'))::timestamp at time zone e.timezone;
$$;

create or replace function public.registration_is_open(e public.events)
returns boolean
language sql
stable
as $$
  select e.is_published
     and e.registration_enabled
     and now() < (e.event_date + coalesce(e.end_time, time '23:59:59'))::timestamp at time zone e.timezone
     and (e.registration_open_at is null or now() >= e.registration_open_at)
     and (e.registration_close_at is null or now() < e.registration_close_at);
$$;

-- Remaining capacity (NULL = unlimited). Security definer so every user sees
-- the real number without being able to read other people's registrations.
create or replace function public.spots_left(e public.events)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when e.max_attendees is null then null
    else greatest(
      e.max_attendees - (
        select count(*)::integer from public.event_registrations r
        where r.event_id = e.id and r.status <> 'UNSUCCESSFUL'
      ), 0)
  end;
$$;

-- Used by the storage upload policy.
create or replace function public.event_open_for_upload(p_event text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = p_event::uuid;
  if not found then return false; end if;
  return public.registration_is_open(v_event);
exception when others then
  return false;
end;
$$;

-- ---------------------------------------------------------
-- RPC: register_for_event
-- The only way a user creates a registration.
-- Errors are raised as short machine codes; the client maps them to
-- friendly messages so raw database text never reaches the user.
-- ---------------------------------------------------------
create or replace function public.register_for_event(
  p_event_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_amount_paid numeric,
  p_payment_reference text,
  p_payment_date date,
  p_pop_path text
)
returns public.event_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_next integer;
  v_active integer;
  v_reg public.event_registrations;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_event from public.events where id = p_event_id and is_published;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

  -- serialize registrations per event so numbering and capacity are exact
  perform pg_advisory_xact_lock(hashtext('event_reg:' || p_event_id::text));

  if public.is_completed(v_event) then raise exception 'EVENT_COMPLETED'; end if;
  if not public.registration_is_open(v_event) then raise exception 'REGISTRATION_CLOSED'; end if;

  if btrim(coalesce(p_full_name, '')) = ''
     or btrim(coalesce(p_phone, '')) = ''
     or btrim(coalesce(p_email, '')) = ''
     or btrim(coalesce(p_payment_reference, '')) = '' then
    raise exception 'INVALID_DETAILS';
  end if;
  if p_amount_paid is null or p_amount_paid <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if p_payment_date is null then raise exception 'INVALID_DETAILS'; end if;

  -- POP must live in the caller's own folder for this event and must exist
  if p_pop_path is null
     or p_pop_path not like (p_event_id::text || '/' || v_uid::text || '/%') then
    raise exception 'INVALID_POP';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'event-pops' and o.name = p_pop_path
  ) then
    raise exception 'POP_MISSING';
  end if;

  if exists (
    select 1 from public.event_registrations r
    where r.event_id = p_event_id and r.user_id = v_uid and r.status <> 'UNSUCCESSFUL'
  ) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  if v_event.max_attendees is not null then
    select count(*) into v_active
    from public.event_registrations r
    where r.event_id = p_event_id and r.status <> 'UNSUCCESSFUL';
    if v_active >= v_event.max_attendees then raise exception 'EVENT_FULL'; end if;
  end if;

  select coalesce(max(r.registration_number), 0) + 1 into v_next
  from public.event_registrations r where r.event_id = p_event_id;

  insert into public.event_registrations (
    event_id, user_id, registration_number, registration_code,
    full_name_snapshot, email_snapshot, phone_snapshot,
    event_title_snapshot, event_date_snapshot, fee_snapshot,
    amount_paid, payment_reference, payment_date, pop_path, status
  ) values (
    p_event_id, v_uid, v_next, v_event.code || '-' || lpad(v_next::text, 3, '0'),
    btrim(p_full_name), btrim(p_email), btrim(p_phone),
    v_event.title, v_event.event_date, v_event.registration_fee,
    p_amount_paid, btrim(p_payment_reference), p_payment_date, p_pop_path, 'VERIFYING'
  )
  returning * into v_reg;

  return v_reg;
end;
$$;

revoke all on function public.register_for_event(uuid, text, text, text, numeric, text, date, text) from public, anon;
grant execute on function public.register_for_event(uuid, text, text, text, numeric, text, date, text) to authenticated;

-- ---------------------------------------------------------
-- RPC: review_event_registration (admin only)
-- VERIFYING -> REGISTERED | UNSUCCESSFUL, plus the in-app notification row
-- (same `notifications` table the rest of the app already uses).
-- ---------------------------------------------------------
create or replace function public.review_event_registration(
  p_registration_id uuid,
  p_status event_registration_status
)
returns public.event_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.event_registrations;
  v_admin_name text;
  v_title text;
  v_message text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('REGISTERED', 'UNSUCCESSFUL') then raise exception 'INVALID_STATUS'; end if;

  select * into v_reg from public.event_registrations where id = p_registration_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_reg.status <> 'VERIFYING' then raise exception 'ALREADY_REVIEWED'; end if;

  select coalesce(nullif(btrim(p.full_name), ''), p.email, 'Admin') into v_admin_name
  from public.profiles p where p.id = auth.uid();

  update public.event_registrations
  set status = p_status,
      verified_at = now(),
      verified_by = auth.uid(),
      verified_by_name = v_admin_name
  where id = p_registration_id
  returning * into v_reg;

  if p_status = 'REGISTERED' then
    v_title := 'Event registration confirmed';
    v_message := 'Your registration for ' || v_reg.event_title_snapshot || ' has been confirmed.';
  else
    v_title := 'Event registration unsuccessful';
    v_message := 'Your registration for ' || v_reg.event_title_snapshot
      || ' was unsuccessful. Please check your registration details or contact the event administrator.';
  end if;

  insert into public.notifications (user_id, type, title, message, read)
  values (v_reg.user_id, 'system', v_title, v_message, false);

  return v_reg;
end;
$$;

revoke all on function public.review_event_registration(uuid, event_registration_status) from public, anon;
grant execute on function public.review_event_registration(uuid, event_registration_status) to authenticated;

-- ---------------------------------------------------------
-- RPC: set_event_attendance (admin only)
-- Attendance is only meaningful for REGISTERED people, and is never
-- set automatically.
-- ---------------------------------------------------------
create or replace function public.set_event_attendance(
  p_registration_id uuid,
  p_attended boolean
)
returns public.event_attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.event_registrations;
  v_row public.event_attendance;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  select * into v_reg from public.event_registrations where id = p_registration_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_reg.status <> 'REGISTERED' then raise exception 'NOT_REGISTERED'; end if;

  insert into public.event_attendance (event_id, registration_id, user_id, attended, marked_at, marked_by)
  values (v_reg.event_id, v_reg.id, v_reg.user_id, coalesce(p_attended, false), now(), auth.uid())
  on conflict (registration_id) do update
    set attended = excluded.attended,
        marked_at = now(),
        marked_by = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_event_attendance(uuid, boolean) from public, anon;
grant execute on function public.set_event_attendance(uuid, boolean) to authenticated;

-- ---------------------------------------------------------
-- STATS VIEW — every number calculated from the database.
-- security_invoker => RLS of the caller applies (admins see everything).
-- ---------------------------------------------------------
create or replace view public.event_registration_stats
with (security_invoker = true) as
select
  e.id as event_id,
  count(r.id)::integer as total_registrations,
  (count(r.id) filter (where r.status = 'VERIFYING'))::integer as verifying,
  (count(r.id) filter (where r.status = 'REGISTERED'))::integer as registered,
  (count(r.id) filter (where r.status = 'UNSUCCESSFUL'))::integer as unsuccessful,
  (count(a.id) filter (where a.attended))::integer as attended,
  coalesce(sum(r.amount_paid), 0)::numeric(14,2) as total_amount,
  coalesce(sum(r.amount_paid) filter (where r.status = 'REGISTERED'), 0)::numeric(14,2) as confirmed_amount
from public.events e
left join public.event_registrations r on r.event_id = e.id
left join public.event_attendance a on a.registration_id = r.id
group by e.id;

grant select on public.event_registration_stats to authenticated;

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_attendance enable row level security;

-- events: everyone signed in sees published events; admins see + manage all.
drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events
  for select to authenticated
  using (is_published or public.is_admin());

drop policy if exists "events_insert_admin" on public.events;
create policy "events_insert_admin" on public.events
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "events_update_admin" on public.events;
create policy "events_update_admin" on public.events
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- no delete policy: events are historical records, unpublish instead.

-- registrations: read-only for clients. Own rows, or everything for admins.
-- Writes happen only through register_for_event / review_event_registration.
drop policy if exists "event_registrations_select" on public.event_registrations;
create policy "event_registrations_select" on public.event_registrations
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- attendance: read-only for clients.
drop policy if exists "event_attendance_select" on public.event_attendance;
create policy "event_attendance_select" on public.event_attendance
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------
-- STORAGE
--   event-pops   : PRIVATE. Path = {event_id}/{user_id}/{file}
--   event-images : public banners (marketing images, admin-managed)
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-pops', 'event-pops', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images', 'event-images', true, 3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 3145728,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- POP: a user may upload only into their own folder, only while the event is open.
drop policy if exists "event_pops_insert_own" on storage.objects;
create policy "event_pops_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-pops'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.event_open_for_upload((storage.foldername(name))[1])
  );

-- POP: only the owner or an admin can read (signed URLs respect this too).
drop policy if exists "event_pops_select_own_or_admin" on storage.objects;
create policy "event_pops_select_own_or_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'event-pops'
    and ((storage.foldername(name))[2] = auth.uid()::text or public.is_admin())
  );

-- POP: the owner may remove a file only while it is NOT attached to a
-- submitted registration (i.e. replacing the POP before final submission).
drop policy if exists "event_pops_delete_own_unsubmitted" on storage.objects;
create policy "event_pops_delete_own_unsubmitted" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-pops'
    and (storage.foldername(name))[2] = auth.uid()::text
    and not exists (select 1 from public.event_registrations r where r.pop_path = name)
  );

-- Banners: public read, admin write.
drop policy if exists "event_images_select" on storage.objects;
create policy "event_images_select" on storage.objects
  for select using (bucket_id = 'event-images');

drop policy if exists "event_images_insert_admin" on storage.objects;
create policy "event_images_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'event-images' and public.is_admin());

drop policy if exists "event_images_update_admin" on storage.objects;
create policy "event_images_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'event-images' and public.is_admin())
  with check (bucket_id = 'event-images' and public.is_admin());

drop policy if exists "event_images_delete_admin" on storage.objects;
create policy "event_images_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'event-images' and public.is_admin());
