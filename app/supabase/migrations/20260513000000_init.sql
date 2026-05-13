-- ============================================================
-- Trail Life MN-9871 troop signup app — initial schema
-- ============================================================
-- Three core tables:
--   events    — a signup occasion (leadership, campout, work day, ...)
--   slots     — a role/seat-group within an event (Trail Guide, Saturday Breakfast, ...)
--   signups   — a single person committed to a slot
--
-- Plus an `admins` allowlist for users with write access.
-- Public read on published events/slots and public insert on signups,
-- everything else admin-gated via RLS.
-- ============================================================

-- ---- EXTENSIONS --------------------------------------------
create extension if not exists "pgcrypto";

-- ---- TABLES ------------------------------------------------

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  subtitle      text,
  season        text,                 -- human label like "2026-2027"
  starts_at     timestamptz,
  ends_at       timestamptz,
  is_published  boolean not null default false,
  archived_at   timestamptz,          -- soft-archive; archived events stay queryable but drop off the public home
  cloned_from   uuid references public.events (id) on delete set null,  -- previous-year ancestor, for tracking lineage
  theme         text not null default 'trail-life-green'
                check (theme in ('trail-life-green','trail-life-gold','neutral')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null
);

create index if not exists events_active_idx
  on public.events (is_published, starts_at desc nulls last, created_at desc)
  where archived_at is null;

create table if not exists public.slots (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events (id) on delete cascade,
  sort_order        int  not null default 0,
  group_label       text,
  title             text not null,
  subtitle          text,
  description       text,
  spots             int  not null default 1 check (spots > 0),
  leadership        boolean not null default false,
  scripture         text,
  time_commitment   text,
  reports_to        text,
  success_bullets   jsonb not null default '[]'::jsonb,
  not_this_bullets  jsonb not null default '[]'::jsonb,
  prefilled_names   jsonb not null default '[]'::jsonb,
  is_locked         boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists slots_event_idx on public.slots (event_id, sort_order);

create table if not exists public.signups (
  id          uuid primary key default gen_random_uuid(),
  slot_id     uuid not null references public.slots (id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists signups_slot_idx on public.signups (slot_id, created_at);

create table if not exists public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  added_at    timestamptz not null default now(),
  added_by    uuid references auth.users (id) on delete set null
);

-- ---- UPDATED_AT TRIGGER ------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();

-- ---- HELPER: am I an admin? --------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

-- ---- SIGNUP CAP: prevent overbooking -----------------------
-- Trigger fires before insert on signups. Counts existing signups plus
-- jsonb_array_length(prefilled_names); blocks the insert if it would exceed spots.

create or replace function public.enforce_slot_capacity()
returns trigger
language plpgsql
as $$
declare
  v_spots int;
  v_filled int;
  v_prefilled int;
begin
  select s.spots,
         jsonb_array_length(s.prefilled_names),
         (select count(*) from public.signups where slot_id = s.id)
    into v_spots, v_prefilled, v_filled
    from public.slots s
    where s.id = new.slot_id
    for update;

  if v_spots is null then
    raise exception 'slot % does not exist', new.slot_id;
  end if;

  if (v_prefilled + v_filled) >= v_spots then
    raise exception 'slot % is already full', new.slot_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists signups_enforce_capacity on public.signups;
create trigger signups_enforce_capacity
  before insert on public.signups
  for each row execute function public.enforce_slot_capacity();

-- ---- RLS ---------------------------------------------------

alter table public.events  enable row level security;
alter table public.slots   enable row level security;
alter table public.signups enable row level security;
alter table public.admins  enable row level security;

-- EVENTS: public can read published; admins can read all and write all.
drop policy if exists "events: public read published" on public.events;
create policy "events: public read published" on public.events
  for select using (is_published);

drop policy if exists "events: admin read all" on public.events;
create policy "events: admin read all" on public.events
  for select using (public.is_admin());

drop policy if exists "events: admin write" on public.events;
create policy "events: admin write" on public.events
  for all using (public.is_admin()) with check (public.is_admin());

-- SLOTS: public can read slots whose event is published; admins can read and write all.
drop policy if exists "slots: public read for published events" on public.slots;
create policy "slots: public read for published events" on public.slots
  for select using (
    exists (
      select 1 from public.events e
      where e.id = slots.event_id and e.is_published
    )
  );

drop policy if exists "slots: admin read all" on public.slots;
create policy "slots: admin read all" on public.slots
  for select using (public.is_admin());

drop policy if exists "slots: admin write" on public.slots;
create policy "slots: admin write" on public.slots
  for all using (public.is_admin()) with check (public.is_admin());

-- SIGNUPS: public can read signups for published events (drives "X of Y filled"),
-- public can insert (anonymous signup), only admins can update/delete.
drop policy if exists "signups: public read for published events" on public.signups;
create policy "signups: public read for published events" on public.signups
  for select using (
    exists (
      select 1
      from public.slots s
      join public.events e on e.id = s.event_id
      where s.id = signups.slot_id and e.is_published
    )
  );

drop policy if exists "signups: public insert when event published and slot unlocked" on public.signups;
create policy "signups: public insert when event published and slot unlocked" on public.signups
  for insert with check (
    exists (
      select 1
      from public.slots s
      join public.events e on e.id = s.event_id
      where s.id = signups.slot_id
        and e.is_published
        and not s.is_locked
    )
  );

drop policy if exists "signups: admin write" on public.signups;
create policy "signups: admin write" on public.signups
  for all using (public.is_admin()) with check (public.is_admin());

-- ADMINS: only admins can read/write the admin allowlist.
drop policy if exists "admins: admin read" on public.admins;
create policy "admins: admin read" on public.admins
  for select using (public.is_admin());

drop policy if exists "admins: admin write" on public.admins;
create policy "admins: admin write" on public.admins
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- CLONE: duplicate an event + its slots for a new season ---
-- Copies the source event row and all of its slots into a fresh,
-- unpublished event. Signups are NOT copied. Prefilled names ARE
-- copied — adjust them in the admin UI if a prefill changed.
--
-- Usage from the app:
--   select public.clone_event(
--     source_event_id := '...',
--     new_slug        := 'leadership-adults-2027-28',
--     new_season      := '2027-2028',
--     new_title       := 'Adult Volunteer Roles · 2027–2028'
--   );

create or replace function public.clone_event(
  source_event_id uuid,
  new_slug        text,
  new_season      text,
  new_title       text default null,
  new_subtitle    text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_id uuid;
  v_source record;
begin
  if not public.is_admin() then
    raise exception 'only admins can clone events';
  end if;

  select * into v_source from public.events where id = source_event_id;
  if v_source is null then
    raise exception 'source event % not found', source_event_id;
  end if;

  insert into public.events (
    slug, title, subtitle, season, theme,
    is_published, cloned_from
  ) values (
    new_slug,
    coalesce(new_title, v_source.title),
    coalesce(new_subtitle, v_source.subtitle),
    new_season,
    v_source.theme,
    false,
    source_event_id
  )
  returning id into v_new_id;

  insert into public.slots (
    event_id, sort_order, group_label, title, subtitle, description,
    spots, leadership, scripture, time_commitment, reports_to,
    success_bullets, not_this_bullets, prefilled_names
  )
  select
    v_new_id, sort_order, group_label, title, subtitle, description,
    spots, leadership, scripture, time_commitment, reports_to,
    success_bullets, not_this_bullets, prefilled_names
  from public.slots
  where event_id = source_event_id;

  return v_new_id;
end;
$$;

-- ---- REALTIME ----------------------------------------------
-- Replicate slots + signups so clients can subscribe to live counts.

alter publication supabase_realtime add table public.slots;
alter publication supabase_realtime add table public.signups;
