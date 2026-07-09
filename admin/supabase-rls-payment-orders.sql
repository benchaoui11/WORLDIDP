-- ════════════════════════════════════════════════════════════════
-- Admin read access for payment_orders / payment_products
-- ------------------------------------------------------------------
-- This does NOT change any table structure — it only adds a read
-- policy so the admin dashboard (using the anon key + a logged-in
-- Supabase Auth session, exactly like it already does for
-- `applications`/`visitors`/`switch_log`) can SELECT from these two
-- tables. The payment backend keeps writing to them with the service
-- role key, which always bypasses RLS — this policy only affects
-- browser-side reads.
--
-- Safe to run once in: Supabase Dashboard → SQL Editor → New query
-- ════════════════════════════════════════════════════════════════

alter table public.payment_orders enable row level security;
alter table public.payment_products enable row level security;

drop policy if exists "admin can read payment_orders" on public.payment_orders;
create policy "admin can read payment_orders"
  on public.payment_orders
  for select
  to authenticated
  using (true);

drop policy if exists "admin can read payment_products" on public.payment_products;
create policy "admin can read payment_products"
  on public.payment_products
  for select
  to authenticated
  using (true);
