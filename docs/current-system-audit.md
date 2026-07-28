# FirstIDP Current System Audit

Audit date: 2026-07-28

Scope: local inspection of `/Users/soufiane/Desktop/FIRSTIDP-FINAL2`. This audit is based on repository files only. I did not connect to the live Supabase database, inspect production data, or modify production code.

## Executive Summary

FirstIDP is currently a static-first Vercel site with a serverless gate that switches between Offer, White, and Maintenance modes using Supabase. Customer applications are stored in a single `applications` table. Uploaded documents are stored in the Supabase Storage bucket named `documents`. The current admin is a browser-only HTML/CSS/JS dashboard under `/admin`, authenticated with Supabase Auth, and it reads and updates data directly from the browser using the Supabase anon key and RLS policies.

The current system is functional but not ready to become a multi-site central control center as-is. The biggest gaps are:

- No multi-site model.
- No real orders/payments table.
- Submitted application value is tracked, but confirmed revenue is not.
- Admin authorization is broad at the RLS layer: any authenticated user can read/update applications unless additional live database policies exist outside this repo.
- Sensitive document viewing currently uses `getPublicUrl()` in the admin UI; the requested central admin must replace this with server-side signed URLs and document access logs.
- Attribution is minimal: session id, mode, referrer, landing page, device/browser/OS/country only.
- PostHog session replay is configured to record unmasked PII and uploaded identity documents.
- Code references `admin_users` and `get_order_number()`, but this repo does not include SQL migrations for either object.

## Current Architecture

### Runtime and deployment

- Static HTML/CSS/JS website deployed to Vercel.
- Vercel rewrites route public pages through `api/gate.js`.
- Serverless/edge API routes:
  - `api/gate.js`: serves `_offer`, `_white`, or maintenance HTML based on `site_settings.mode`.
  - `api/switch-mode.js`: updates `site_settings.mode` and writes `switch_log`.
  - `api/track.js`: records lightweight visitor rows.
  - `api/send-confirmation-email.js`: sends customer email via Resend.
  - `api/send-admin-notification.js`: sends internal order alert via Resend.
  - `api/block.js`: returns 404 for direct raw variant paths.
- `vercel.json` adds security headers and rewrites public page paths to `api/gate`.
- No package manifest or build pipeline was found. This is not a Next.js app today.
- The local folder is not currently a Git repository.

### Site mode system

The public site mode is stored in `public.site_settings`, a single-row table with `id = 1`. `api/gate.js` reads mode using `SUPABASE_URL` and `SUPABASE_ANON_KEY`, caches it for 8 seconds, then serves matching HTML from `_offer` or `_white`. If Supabase mode lookup fails, `api/gate.js` fails open to `offer`.

`api/switch-mode.js` changes the mode server-side using `SUPABASE_SERVICE_ROLE_KEY` after validating the Supabase user session and checking the caller email against `public.admin_users`.

Important repo gap: `public.admin_users` is referenced by code, but no migration creating it was found.

## Existing Supabase Objects Discovered

### Tables documented in repo

`public.applications` is originally defined in `SETUP.md`:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz default now()`
- `ref text unique`
- `status text default 'submitted'`
- `format text`
- `validity_years int`
- `destination_country text`
- `total numeric`
- `currency text default 'USD'`
- `first_name text`
- `last_name text`
- `email text`
- `phone text`
- `license_category text`
- `address_line1 text`
- `address_line2 text`
- `state_region text`
- `city text`
- `postal_code text`
- `shipping_method text`
- `vip_processing boolean default false`
- `coupon text`
- `file_selfie text`
- `file_license_front text`
- `file_license_back text`
- `file_signature text`

`admin/supabase-schema.sql` later adds:

- `group_ref text`
- `is_companion boolean not null default false`
- `order_number integer`

`public.site_settings`:

- `id integer primary key default 1`
- `mode text not null default 'offer' check in `offer`, `white`, `maintenance`
- `updated_at timestamptz not null default now()`
- `updated_by text`
- single-row check: `id = 1`

`public.switch_log`:

- `id bigint generated always as identity primary key`
- `from_mode text`
- `to_mode text not null`
- `changed_by text`
- `changed_at timestamptz not null default now()`

`public.visitors`:

- `id bigint generated always as identity primary key`
- `created_at timestamptz not null default now()`
- `session_id text`
- `site_mode_at_visit text`
- `country text`
- `browser text`
- `os text`
- `device text`
- `referrer text`
- `landing_page text`

### Tables referenced but not defined in repo

`public.admin_users`:

- Used by `api/switch-mode.js` for server-side allowlist lookup.
- Expected at least to have `email`.
- No `create table`, RLS policy, seed, or owner setup migration was found.

### Functions and triggers

Defined in `admin/supabase-schema.sql`:

- `public.track_order(p_ref text, p_email text)`
  - Security definer.
  - Returns non-sensitive tracking fields only.
  - Requires matching `ref` or `group_ref` plus matching email.
  - Granted to `anon` and `authenticated`.

- `public.assign_order_number()`
  - Trigger function assigning sequential `order_number`.
  - Companion rows inherit the primary row's `order_number` where possible.

- Trigger `trg_assign_order_number`
  - `before insert on public.applications`.

- Sequence `public.order_number_seq`.

Referenced but not defined in repo:

- `public.get_order_number(p_ref text, p_email text)`
  - Called after insert from frontend helper.
  - Expected to return only the integer order number.
  - No SQL definition was found.

### Indexes

Defined in `admin/supabase-schema.sql`:

- `visitors_created_at_idx` on `visitors(created_at desc)`
- `switch_log_changed_at_idx` on `switch_log(changed_at desc)`
- `applications_group_ref_idx` on `applications(group_ref)`

Missing for central admin scale:

- `applications(created_at desc)`
- `applications(status)`
- `applications(ref)`
- `applications(email)`
- future `site_id/site_key` indexes
- traffic/session/event indexes
- payment/order indexes once real payments exist

## Existing Database Relationships

There are no foreign keys discovered in repo migrations.

Logical relationships:

- One order/application group is represented by one or two rows in `applications`.
- Primary applicant row has `ref = group_ref` conceptually, but the stored primary row may have `group_ref` null.
- Companion row has `group_ref` equal to primary applicant `ref` and `is_companion = true`.
- Storage files are linked by text paths in `applications.file_selfie`, `file_license_front`, `file_license_back`, and `file_signature`.
- `switch_log` is related to site mode changes by email text only, not a foreign key to an admin user.
- `visitors` has no link to applications, sessions, users, campaigns, or sites beyond `session_id` and `landing_page`.

## Existing Storage Buckets

Documented bucket:

- `documents`

Current intended storage policy from `SETUP.md`:

- Bucket should be private.
- `storage.objects` insert policy allows `anon` upload when `bucket_id = 'documents'`.

Current upload paths:

- `${ref}/selfie.ext`
- `${ref}/front.ext`
- `${ref}/back.ext`
- `${ref}/signature.ext`

Important risk:

- The current admin dashboard calls `client.storage.from(cfg.BUCKET).getPublicUrl(path)` and renders those URLs in the browser. For a truly private bucket, `getPublicUrl()` should not be used for sensitive document viewing. The central admin must generate short-lived signed URLs on the server after permission checks, and must log every document access.

## Existing APIs

### `api/gate.js`

Purpose:

- Reads `site_settings.mode`.
- Serves Offer, White, or Maintenance content.
- Fails open to Offer if mode lookup fails.
- Blocks direct access to raw `_offer` and `_white` via rewrites plus `api/block.js`.

Central admin reuse:

- Reuse the site-mode concept, but convert from single-row global mode into per-site feature/status settings.

### `api/switch-mode.js`

Purpose:

- Validates Supabase session token.
- Checks `admin_users.email` allowlist.
- Updates `site_settings`.
- Inserts `switch_log`.

Issues:

- Requires `admin_users`, but migration is missing from repo.
- Uses service role key correctly on server only.
- Only protects mode switching, not the browser dashboard reads/updates.

### `api/track.js`

Purpose:

- Accepts beacon payload.
- Uses Vercel geo country.
- Inserts into `visitors`.

Limitations:

- No UTM capture.
- No GCLID/MSCLKID capture.
- No source classification.
- No first-touch or last-touch attribution.
- No session duration, page count, conversion events, or visitor id beyond sessionStorage session id.
- No bot/internal traffic filtering.
- No site id.

### `api/send-confirmation-email.js`

Purpose:

- Sends customer "application received" email through Resend.
- Email says document review happens first, then payment link is sent.

Limitations:

- No email event table.
- No Resend webhook handling.
- No application/order/customer linkage persisted for the email event.
- No rate limiting.

### `api/send-admin-notification.js`

Purpose:

- Sends internal "new order" notification via Resend.
- Uses `ADMIN_NOTIFICATION_EMAIL` env var or `contact@firstidp.com`.

Limitations:

- No audit trail or email log.
- No guaranteed delivery recording.

### `api/block.js`

Purpose:

- Returns 404 and `X-Robots-Tag: noindex` for raw folder access.

## Existing Admin Authentication

Current admin:

- `/admin/login.html` uses Supabase Auth email/password via browser SDK.
- `/admin/dashboard.js` checks `client.auth.getSession()` and redirects to `/admin/login.html` if no session.

Current authorization:

- Browser dashboard relies on RLS policies allowing any `authenticated` user to select/update `applications`, select `visitors`, select/insert `switch_log`, and update `site_settings`.
- `api/switch-mode.js` has an additional server-side `admin_users` check.

Security finding:

- If Supabase Auth signup is enabled, or if any non-admin authenticated user exists, the repo-defined RLS policies would allow broad access to sensitive application data and status updates. The central admin must not rely on frontend-only role checks or broad `authenticated` RLS policies.

## Existing Visitor Tracking

Current first-party beacon:

- `analytics-beacon.js` fires once per page load.
- Creates a `widp_sid` in `sessionStorage`.
- Captures browser, OS, device, referrer, landing page, and site mode.
- `api/track.js` adds country from Vercel headers and inserts into `visitors`.

Third-party analytics:

- Google tag is loaded on Offer pages.
- GA4 id and Google Ads id are configured in `google-tag.js`.
- Google Ads conversion fires on thank-you page.
- PostHog is loaded on Offer pages and tracks events like route checked, checkout completed, photo added, submit failed/succeeded, purchase confirmed.

Important wording:

- The thank-you page comment explicitly states Google Ads conversion is a lead, not a sale. No payment has been collected at that point.

## Existing Order/Application Flow

1. Offer page / pricing route sends user to checkout.
2. `checkout.js` clears old session data and gathers customer identity, product choice, validity, country, license category, phone, and optional companion.
3. Checkout stores summary in `sessionStorage` as `worldidp_application`.
4. User is sent to `upload-photos.html`.
5. `upload.js` collects selfie, license front, license back, and signature.
6. Images are compressed client-side and stored in `sessionStorage`.
7. For Print + Digital, user continues to `payment.html` for delivery address and express processing option.
8. For Digital, `upload.js` submits directly.
9. `worldidpSubmitOrder()` uploads documents to Supabase Storage and inserts into `applications`.
10. Optional companion gets a second application row with `group_ref` and `is_companion`.
11. Customer confirmation and admin notification emails are sent.
12. User is redirected to `thank-you.html`.

## Existing Document Access Flow

Upload:

- Browser converts data URLs to blobs.
- Browser uploads directly to Supabase Storage using anon key.
- Browser inserts storage paths into `applications`.

Admin view:

- Admin dashboard fetches file path columns from `applications`.
- Admin builds public URLs client-side using `getPublicUrl()`.
- Admin renders images and "Open full size" links in browser.

Target central admin requirement:

- Replace with server-side signed URL endpoint, short TTL, server-side RBAC, and `document_access_logs`.

## Existing Payment Flow

Current code behavior:

- No online payment is collected at application submission.
- `applications.total` is submitted value only.
- Admin "Orders" page is only applications with status `paid` or `delivered`.
- There is no discovered payments table, transactions table, refunds table, Stripe webhook, checkout session, or payment provider API.
- `payment.js` contains a comment mentioning `payment_orders.amount`, but no `payment_orders` table or implementation was found.
- `SETUP.md` mentions Stripe payment links and `stripe-links.js`, but no `stripe-links.js` file exists in the current repo. This appears stale.

Analytics implication:

- The central admin must not treat `applications.total` as revenue.
- Existing data can support submitted value and manually marked "paid" value only.
- Confirmed revenue requires a new payments/order ledger or integration with the actual payment processor.

## Existing Resend / Email Flow

Environment variables used:

- `RESEND_API_KEY`
- `ADMIN_NOTIFICATION_EMAIL`

Emails:

- Customer confirmation email from `FirstIDP <contact@firstidp.com>`.
- Admin notification email from `FirstIDP Orders <contact@firstidp.com>`.

No discovered:

- Email log table.
- Resend webhook endpoint.
- Delivered/opened/clicked/bounced/complained/failed event storage.
- Template table.

## Existing Deployment Configuration

`vercel.json`:

- Configures `api/gate.js` include files.
- Adds:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Rewrites public routes to `api/gate`.
- Blocks raw `_offer` and `_white` folders through `api/block`.

`robots.txt`:

- Allows AdsBot.
- Disallows `/admin`, `/_white`, `/_offer`, `/api/`, and funnel pages for normal crawlers.
- Includes sitemap.

Gaps for central admin:

- Need `noindex` metadata plus auth, not just robots.
- Need admin-specific security headers and CSP.
- Need separate Vercel project and env vars.

## Security Risks

High:

1. Sensitive document exposure path is not acceptable for the new platform. `getPublicUrl()` is used in current admin document viewer; central admin must use short-lived signed URLs generated server-side after permission checks.
2. PostHog session replay is configured to record unmasked names, DOB, email, phone, address, selfie, license images, and signature. This is an extreme privacy and account takeover blast-radius risk.
3. Repo-defined RLS policies allow any `authenticated` user to read/update applications. This is too broad for a multi-role admin system.
4. `admin_users` allowlist is referenced by `api/switch-mode.js`, but not defined in repo migrations. If missing in production, mode switching fails; if present but unmanaged, access control is fragile.
5. `get_order_number()` is referenced but not defined in repo migrations. This can silently degrade admin emails/order numbers.

Medium:

1. Application status updates happen directly from browser to Supabase with no audit log.
2. No status history table.
3. No document access logging.
4. No server-side validation for admin status transitions.
5. Public form uploads to Storage with anon insert policy and no visible server-side file size/type validation beyond browser logic.
6. `api/track.js` accepts arbitrary beacon payload and has no rate limiting.
7. Resend endpoints accept public POSTs with minimal validation and no anti-abuse controls.
8. Admin dashboard loads up to 5000 applications and 500 visitors into browser memory, which risks both performance and wider client-side PII exposure.
9. No CSP currently configured.

Low / operational:

1. Local folder is not a Git repo.
2. Docs mention old WorldIDP/Stripe concepts inconsistent with current FirstIDP behavior.
3. Some brand/config names still say `WORLDIDP`.

## Reusable Components and Concepts

Reusable:

- `applications` base data model for FirstIDP applications.
- `group_ref` / `is_companion` travel companion grouping.
- Existing status vocabulary:
  - `submitted`
  - `under_review`
  - `documents_accepted`
  - `paid`
  - `processing`
  - `delivered`
  - `rejected`
- `track_order()` security-definer pattern for safe customer lookup.
- `site_settings` mode concept.
- `switch_log` concept, but should become a full admin activity log.
- Current static page mode gating logic can inform future per-site White/Offer feature flags.
- Existing price table can seed product metadata, but should not be hardcoded across admin analytics.
- Resend email templates can inform template taxonomy.
- Current lightweight beacon can be replaced by a stronger first-party analytics model.

Not reusable as-is:

- Browser-only admin data access.
- Browser-created document URLs.
- Browser-only analytics aggregation.
- Current RLS policies for admin authorization.
- Current PostHog replay settings for sensitive pages.
- Current payment/revenue reporting.

## Required Database Changes for Central Admin

All changes should be additive and reversible where practical. Do not rename or delete existing application/storage data during initial migration.

Minimum safe migration set:

1. `sites`
   - Create site registry.
   - Seed FirstIDP:
     - `site_key = 'firstidp'`
     - `name = 'FirstIDP'`
     - `domain = 'firstidp.com'`
     - `timezone` configurable
     - `currency = 'USD'`
     - `has_white_page = true`
     - `has_offer_page = true`

2. Add site association to existing tables
   - Add nullable `site_id uuid` or `site_key text` to `applications`.
   - Add nullable `site_id/site_key` to `visitors`.
   - Add nullable `site_id/site_key` to `switch_log`.
   - Backfill existing FirstIDP rows safely to `firstidp`.
   - Only make site fields non-null after verification.

3. Admin identity and RBAC
   - `admin_profiles`
   - `roles`
   - `permissions`
   - `admin_site_access`
   - server-side helper functions for role checks
   - RLS policies based on auth uid and site access

4. Audit and history
   - `admin_activity_log`
   - `application_status_history`
   - `document_access_logs`
   - `document_review_events`
   - `internal_notes`

5. Documents
   - Optional `application_documents` table to normalize the existing four file columns.
   - Initial migration can create document rows from existing paths without moving files.

6. Payments and orders
   - Create real `orders` and `payments` ledger tables, or at minimum a `payment_events` table.
   - Preserve `applications.total` as submitted value.
   - Track `submitted_value`, `paid_revenue`, `refunded_revenue`, `net_revenue`, and payment provider references separately.

7. Analytics and attribution
   - `visitors_v2` or expanded `visitors`
   - `sessions`
   - `analytics_events`
   - `traffic_sources`
   - `attribution_touchpoints`
   - `campaign_params`
   - summary views/materialized views for daily metrics

8. Email logging
   - `email_messages`
   - `email_events`
   - Resend webhook event store with dedupe key.

9. Compatibility fixes
   - Add migration for `admin_users` if still needed by old `/api/switch-mode`.
   - Add migration for `get_order_number()` or remove frontend dependency after safe replacement.

## Migration Risks

- Adding RLS incorrectly can break existing checkout inserts.
- Tightening Storage policies can break public uploads if not staged.
- Making `site_id` non-null too early can fail on old rows.
- Replacing document URL behavior can temporarily block admins from viewing documents if signed URL endpoint or permissions are wrong.
- Adding payments tables without knowing actual payment processor flow can produce misleading revenue.
- Existing PostHog data may already contain sensitive documents and PII; changing code does not remove historical recordings.
- Current analytics lacks stable visitor id/first-touch data, so historical attribution cannot be reconstructed accurately.
- Existing `visitors.session_id` is sessionStorage only; it does not identify returning visitors across sessions.

## Proposed Central Admin Architecture

Application:

- New separate project: `/Users/soufiane/Desktop/LOUBINETTE-IDP-CONTROL-CENTER`
- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui where appropriate
- Lucide icons
- Supabase SSR/server client
- Zod validation
- Recharts
- Server actions or secure route handlers for mutations

Security:

- Supabase Auth for admin login.
- No service role key in client bundle.
- Server-only service role usage for privileged operations.
- Server-side RBAC before every sensitive action.
- RLS policies tied to admin roles and site access.
- Private document access through server-generated signed URLs.
- Audit logs for every mutation and sensitive read.
- Noindex metadata, robots blocking, security headers, CSP where practical.

Data access:

- Server-side pagination and filters.
- Server-side aggregation for metrics.
- Database functions/views for daily analytics and revenue calculations.
- Separate submitted value from confirmed revenue.

Multi-site:

- Every new table should include `site_id` or `site_key`.
- UI supports "All Sites" and per-site filters from day one.
- FirstIDP is the only active seed site in v1.

Document model:

- Keep existing storage file paths in place.
- Normalize into `application_documents` when safe.
- Do not move or rename files initially.
- Use signed URLs with short TTL.

Attribution model:

- Honest classification using UTM, click ids, referrer domain, landing page, first-party visitor/session data.
- Do not claim perfect identity or perfect source detection.
- Direct/Unknown should be explicit outcomes.

## Exact Implementation Phases

Phase 1: Audit

- Complete this document.
- Confirm live Supabase objects before migration if credentials/access are available.

Phase 2: Architecture docs

- `docs/central-admin-architecture.md`
- `docs/database-migration-plan.md`
- `docs/analytics-attribution-model.md`
- `docs/security-model.md`
- `docs/deployment-guide.md`

Phase 3: Separate project creation

- Create `/Users/soufiane/Desktop/LOUBINETTE-IDP-CONTROL-CENTER`.
- Initialize Next.js App Router, TypeScript strict, Tailwind, UI system, README, `.env.example`.
- Set noindex and admin-only app defaults.

Phase 4: Safe database compatibility

- Add additive SQL migrations.
- Seed FirstIDP site.
- Add nullable site fields.
- Backfill safely.
- Create RBAC and audit tables.
- Create document signed URL infrastructure.

Phase 5: Core admin

- Auth.
- Layout.
- Site switcher.
- Date range selector.
- Command Center.
- Applications.
- Orders/Submitted Value view.
- Documents signed viewer.
- Visitors overview.

Phase 6: Analytics

- Daily metrics.
- Attribution ingestion.
- First-touch, last-touch, session-touch model.
- Funnel analytics.
- Campaign and source reports.
- Website comparison shell.

Phase 7: Testing

- Type check.
- Lint.
- Production build.
- Unit tests for date ranges, attribution, permissions, revenue math.
- Integration tests for signed document access, status update audit logs, site filters.

Phase 8: Vercel test deployment

- New Vercel project.
- Temporary Vercel URL.
- Environment checklist.
- Later custom domain `admin.loubinette.com`.

## Questions and Blockers

Blockers before safe implementation:

1. Need confirmation of live Supabase schema for objects not fully represented in repo, especially `admin_users`, `get_order_number()`, storage bucket privacy, and actual RLS policies.
2. Need decision on PostHog replay masking for sensitive pages. Current configuration records identity documents and PII unmasked.
3. Need confirmation of actual payment processor/current payment collection process. The repo has no real payment ledger, but docs contain stale Stripe references.
4. Need owner/super-admin email for initial central admin bootstrap.
5. Need whether the new project should be initialized as a fresh Git repo locally before GitHub connection.

Non-blockers:

- The central admin can start with read-only FirstIDP dashboards using existing `applications` and `visitors`, but document viewing and mutations should wait for RBAC, signed URLs, and audit logging.
- Historical attribution will be limited because old visitor rows do not contain UTMs/click ids or conversion links.
