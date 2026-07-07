-- ════════════════════════════════════════════════════════════════
-- WorldIDP — Admin Switch + Analytics — Supabase Schema
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
