// ════════════════════════════════════════════════════════════════
// /api/gate — serves Offer / White / Maintenance content depending on
// the current mode stored in Supabase (public.site_settings.mode).
//
// v2 — fixes the "White Page has no CSS" bug from v1.
//
// WHY v1 BROKE: v1 tried to bundle _white/** (html + css + js +
// fonts + images) into the function via vercel.json "includeFiles",
// then read+serve every asset through fs. That's fragile: large
// binary assets bloat the function bundle and glob patterns for
// mixed file types are easy to get subtly wrong — when it fails,
// requests for styles.css/script.js/assets/* just 404 silently,
// which is exactly the "page loads with no design" symptom we saw.
//
// v2 FIX: only HTML pages are gated (read via fs, tiny, reliable).
// CSS/JS/images for the White site are NEVER touched by the gate —
// they stay exactly where they physically live, at /_white/styles.css,
// /_white/script.js, /_white/assets/*, and Vercel serves them as
// completely normal static files (fast CDN, zero function involved,
// nothing that can 404 due to bundling). When we serve White HTML,
// we simply rewrite the handful of relative asset references inside
// that HTML to point at their real /_white/... URL before sending it.
//
// This function is only ever reached for the specific HTML page
// paths listed in vercel.json "rewrites" — every asset request
// (css/js/images/fonts), /admin/**, /api/**, /IMAGES/**, sitemap.xml,
// robots.txt, etc. is untouched and served by Vercel exactly as before.
//
// Fail-safe rule: if Supabase is unreachable or returns something
// unexpected, we ALWAYS fall back to "offer" (the real business
// site). We never fail into "white" or "maintenance" by accident.
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'nodejs' };

import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// ── tiny in-memory cache so we don't hit Supabase on every page load.
let cachedMode = null;
let cachedAt = 0;
const CACHE_MS = 8000;

async function getMode() {
  const now = Date.now();
  if (cachedMode && now - cachedAt < CACHE_MS) return cachedMode;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/site_settings?select=mode&id=eq.1`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        signal: AbortSignal.timeout(2500),
      }
    );
    if (!res.ok) throw new Error('bad status ' + res.status);
    const rows = await res.json();
    const mode = rows?.[0]?.mode;
    if (mode === 'offer' || mode === 'white' || mode === 'maintenance') {
      cachedMode = mode;
      cachedAt = now;
      return mode;
    }
    throw new Error('unexpected mode value');
  } catch (err) {
    // Fail OPEN to "offer" — never let a Supabase hiccup hide the real site.
    console.error('[gate] could not read mode, defaulting to offer:', err.message);
    return 'offer';
  }
}

const ROOT = process.cwd();

// route table: for every gated HTML path, where's the source file in
// each mode? `null` = "this page does not exist in that mode" → 404,
// so the other funnel never leaks while switched away from it.
// `nested: true` marks pages one directory deep inside _white (only
// /apply for now) so we know which relative-path pattern to fix up.
const PAGES = {
  '/':                                     { offer: 'index.html',            white: '_white/index.html' },
  '/index.html':                           { offer: 'index.html',            white: '_white/index.html' },
  '/countries.html':                       { offer: 'countries.html',        white: '_white/countries.html' },
  '/what-is-idp.html':                     { offer: 'what-is-idp.html',      white: '_white/what-is-idp.html' },

  // white-only pages
  '/about.html':                           { offer: null, white: '_white/about.html' },
  '/contact.html':                         { offer: null, white: '_white/contact.html' },
  '/cookies.html':                         { offer: null, white: '_white/cookies.html' },
  '/disclaimer.html':                      { offer: null, white: '_white/disclaimer.html' },
  '/privacy.html':                         { offer: null, white: '_white/privacy.html' },
  '/refunds.html':                         { offer: null, white: '_white/refunds.html' },
  '/shipping.html':                        { offer: null, white: '_white/shipping.html' },
  '/terms.html':                           { offer: null, white: '_white/terms.html' },

  // offer-only pages
  '/about-us.html':                        { offer: 'about-us.html',        white: null },
  '/contact-us.html':                      { offer: 'contact-us.html',      white: null },
  '/cookie-policy.html':                   { offer: 'cookie-policy.html',   white: null },
  '/legal-disclaimer.html':                { offer: 'legal-disclaimer.html', white: null },
  '/privacy-policy.html':                  { offer: 'privacy-policy.html', white: null },
  '/refund-return-policy.html':            { offer: 'refund-return-policy.html', white: null },
  '/shipping-policy.html':                 { offer: 'shipping-policy.html', white: null },
  '/terms-of-service.html':                { offer: 'terms-of-service.html', white: null },
  '/acceptable-use-policy.html':           { offer: 'acceptable-use-policy.html', white: null },
  '/accessibility-statement.html':         { offer: 'accessibility-statement.html', white: null },
  '/dmca-and-intellectual-property-policy.html': { offer: 'dmca-and-intellectual-property-policy.html', white: null },
  '/payment-policy.html':                  { offer: 'payment-policy.html', white: null },
  '/checkout.html':                        { offer: 'checkout.html',       white: null },
  '/payment.html':                         { offer: 'payment.html',        white: null },
  '/pricing.html':                         { offer: 'pricing.html',        white: null },
  '/faq.html':                             { offer: 'faq.html',            white: null },
  '/track-order.html':                     { offer: 'track-order.html',    white: null },
  '/upload-photos.html':                   { offer: 'upload-photos.html',  white: null },
};

// Minimal, fully self-contained maintenance page — no external CSS/JS.
const MAINTENANCE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>WorldIDP — Back shortly</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#0b0e14;color:#eef2f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px}
  .card{max-width:420px}
  h1{font-size:1.4rem;margin:0 0 8px}
  p{opacity:.75;line-height:1.5}
</style></head>
<body><div class="card">
  <h1>We'll be right back</h1>
  <p>WorldIDP is doing a quick update. Please check back in a few minutes.</p>
</div></body></html>`;

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

// Rewrites the White site's relative asset references to absolute,
// never-gated, always-reliable /_white/... URLs. Top-level White pages
// use "styles.css" / "script.js" / "assets/..."; the nested /apply
// page uses "../styles.css" / "../script.js" / "../assets/...".
function fixWhiteAssetPaths(html, nested) {
  if (nested) {
    return html
      .replace(/href="\.\.\/styles\.css"/g, 'href="/_white/styles.css"')
      .replace(/src="\.\.\/script\.js"/g, 'src="/_white/script.js"')
      .replace(/(href|src)="\.\.\/assets\//g, '$1="/_white/assets/')
      .replace(/(href)="\.\.\/([a-z-]+\.html)/g, '$1="/$2'); // ../about.html -> /about.html
  }
  return html
    .replace(/href="styles\.css"/g, 'href="/_white/styles.css"')
    .replace(/src="script\.js"/g, 'src="/_white/script.js"')
    .replace(/(href|src)="assets\//g, '$1="/_white/assets/');
}

function notFound(res) {
  res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send('<!doctype html><title>Not found</title><h1>404</h1>');
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;

  const mode = await getMode();

  // Never cache a gated response — a switch must take effect immediately.
  res.setHeader('Cache-Control', 'no-store, must-revalidate');

  if (mode === 'maintenance') {
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(MAINTENANCE_HTML);
  }

  // /apply and /apply/* → pricing.html on offer, White apply page on white
  if (pathname === '/apply' || pathname === '/apply/' || pathname.startsWith('/apply/')) {
    try {
      if (mode === 'offer') {
        const html = readFile('pricing.html');
        res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
      }
      const html = fixWhiteAssetPaths(readFile('_white/apply/index.html'), true);
      res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      console.error('[gate] /apply read failed:', err.message);
      return notFound(res);
    }
  }

  const entry = PAGES[pathname];
  if (!entry) return notFound(res);

  const relPath = entry[mode]; // mode is 'offer' or 'white' here
  if (!relPath) return notFound(res); // intentionally doesn't exist in this mode

  try {
    let html = readFile(relPath);
    if (mode === 'white') html = fixWhiteAssetPaths(html, false);
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    console.error('[gate] failed to read', relPath, err.message);
    return notFound(res);
  }
}
