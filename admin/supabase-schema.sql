-- ════════════════════════════════════════════════════════════════
-- FirstIDP — Admin Switch + Analytics — Supabase Schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ════════════════════════════════════════════════════════════════

-- 1) SITE MODE — a single row that holds the current live mode
create table if not exists public.site_settings (
  id integer primary key default 1,
  mode text not null default 'offer' check (mode in ('offer','white','maintenance')),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint single_row check (id = 1)
);

insert into public.site_settings (id, mode)
values (1, 'offer')
on conflict (id) do nothing;

-- 2) SWITCH LOG — history of every mode change (who / when / from -> to)
create table if not exists public.switch_log (
  id bigint generated always as identity primary key,
  from_mode text,
  to_mode text not null,
  changed_by text,
  changed_at timestamptz not null default now()
);

-- 3) VISITORS — lightweight analytics (populated by a small tracking snippet)
create table if not exists public.visitors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session_id text,
  site_mode_at_visit text,
  country text,
  browser text,
  os text,
  device text,
  referrer text,
  landing_page text
);

create index if not exists visitors_created_at_idx on public.visitors (created_at desc);
create index if not exists switch_log_changed_at_idx on public.switch_log (changed_at desc);

-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════

alter table public.site_settings enable row level security;
alter table public.switch_log    enable row level security;
alter table public.visitors      enable row level security;

-- site_settings: anyone (anon) can READ the current mode (the public site
-- needs this to know what to show). Only authenticated admins can WRITE.
drop policy if exists "public can read site mode" on public.site_settings;
create policy "public can read site mode"
  on public.site_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "only admins can update site mode" on public.site_settings;
create policy "only admins can update site mode"
  on public.site_settings for update
  to authenticated
  using (true)
  with check (true);

-- switch_log: only authenticated admins can read; only authenticated can insert
drop policy if exists "admins read switch log" on public.switch_log;
create policy "admins read switch log"
  on public.switch_log for select
  to authenticated
  using (true);

drop policy if exists "admins insert switch log" on public.switch_log;
create policy "admins insert switch log"
  on public.switch_log for insert
  to authenticated
  with check (true);

-- visitors: anon (public site) can INSERT only (write-only tracking beacon).
-- Only authenticated admins can SELECT (read the analytics).
drop policy if exists "anon can log a visit" on public.visitors;
create policy "anon can log a visit"
  on public.visitors for insert
  to anon, authenticated
  with check (true);

drop policy if exists "admins read visitors" on public.visitors;
create policy "admins read visitors"
  on public.visitors for select
  to authenticated
  using (true);

-- applications (orders) table already exists from checkout.
-- Make sure admins (authenticated) can read it for the Sales panel,
-- WITHOUT opening it to anon/public (it holds personal data + documents).
alter table public.applications enable row level security;

drop policy if exists "admins read applications" on public.applications;
create policy "admins read applications"
  on public.applications for select
  to authenticated
  using (true);

-- (insert policy for anon during checkout should already exist from your
--  original setup — do not remove it. This script only ADDS the admin-read
--  policy; it does not touch existing insert policies.)

-- Allow the admin dashboard to UPDATE an application's status
-- (e.g. marking it "paid" once the customer has completed payment
-- outside the site). Still restricted to authenticated (admin) users only.
drop policy if exists "admins update applications" on public.applications;
create policy "admins update applications"
  on public.applications for update
  to authenticated
  using (true)
  with check (true);

-- ── Travel Companion feature ──────────────────────────────────────────
-- When a customer adds a second driver ("travel companion") to their
-- order, we store TWO rows in `applications` — one per person, each with
-- their own documents — linked by a shared `group_ref` (equal to the
-- primary applicant's own `ref`). `is_companion` marks the discounted,
-- secondary row so the admin dashboard can group and label them clearly.
alter table public.applications add column if not exists group_ref text;
alter table public.applications add column if not exists is_companion boolean not null default false;
create index if not exists applications_group_ref_idx on public.applications (group_ref);

-- ── Public order tracking (secure, two-factor lookup) ──────────────────
-- We do NOT grant anon direct SELECT on `applications` — that table holds
-- emails, phone numbers, addresses, and document storage paths for every
-- customer, and a broad anon-read policy would let anyone with the public
-- anon key pull ALL of it via a raw REST call, not just the row they
-- legitimately know about.
--
-- Instead, this function is the ONLY way a customer can look up a status,
-- and it requires the ref AND the matching email together (like the
-- existing tracking form already asks for) — never the ref alone — and
-- it only ever returns non-sensitive fields (no email, phone, address,
-- or document paths). Entering the primary applicant's ref also returns
-- their travel companion's row, so a two-person order is tracked as one.
create or replace function public.track_order(p_ref text, p_email text)
returns table (
  ref text,
  group_ref text,
  is_companion boolean,
  status text,
  format text,
  validity_years int,
  destination_country text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select a.ref, a.group_ref, a.is_companion, a.status, a.format,
         a.validity_years, a.destination_country, a.created_at
  from public.applications a
  where (a.ref = p_ref or a.group_ref = p_ref)
    and lower(a.email) = lower(p_email)
  order by a.is_companion asc;
$$;

grant execute on function public.track_order(text, text) to anon, authenticated;

-- ── Sequential order numbers (N001, N002, ...) ──────────────────────────
-- A real running counter for your own reference — separate from `ref`
-- (the random tracking code used for lookups/security). A travel
-- companion's row always inherits the SAME order number as their
-- primary applicant, since they're one order, not two.
create sequence if not exists public.order_number_seq start 1;

alter table public.applications add column if not exists order_number integer;

create or replace function public.assign_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.is_companion and new.group_ref is not null then
    select order_number into new.order_number
    from public.applications
    where ref = new.group_ref
    limit 1;
  end if;
  if new.order_number is null then
    new.order_number := nextval('public.order_number_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_order_number on public.applications;
create trigger trg_assign_order_number
  before insert on public.applications
  for each row execute function public.assign_order_number();
