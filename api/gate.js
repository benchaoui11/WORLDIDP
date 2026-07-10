// ════════════════════════════════════════════════════════════════
// /api/gate — serves Offer / White / Maintenance content depending on
// the current mode stored in Supabase (public.site_settings.mode).
//
// v3 — fixes the REAL root cause: "switching does nothing, offer
// always shows no matter the mode."
//
// WHY IT WAS ALWAYS SHOWING OFFER: Vercel's routing checks the
// filesystem BEFORE applying "rewrites" from vercel.json. Since the
// real index.html (and every other offer page) physically lived at
// the exact URL being requested (e.g. "/" -> real index.html on
// disk), Vercel served that real static file directly and never
// even reached our rewrite/gate.js — for ANY mode. The gate function
// only ever fired for paths that had no matching real file (the
// White-only page names), which is why some things "half worked."
//
// THE FIX: every Offer HTML page has been physically moved into an
// _offer/ folder (mirroring how _white/ already works), so no real
// file sits at the top-level URL anymore. Now EVERY page request is
// forced through the rewrite -> gate.js, which is the only place
// that decides what to actually serve, for every mode, every time.
//
// Root-level styles.css, script.js, and every other uniquely-named
// CSS/JS file, plus IMAGES/, stay exactly where they are and are
// served as completely normal static files — Offer's own HTML
// (inside _offer/) references them with plain relative paths like
// "styles.css" / "IMAGES/x.webp", which resolve correctly against
// the visible "/" URL without any rewriting needed. White's HTML
// still gets its relative asset paths rewritten to /_white/... (as
// in v2) since its filenames (styles.css, script.js) collide with
// Offer's root-level files of the same name.
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'nodejs' };

import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

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
    console.error('[gate] could not read mode, defaulting to offer:', err.message);
    return 'offer'; // fail OPEN to the real site, never to white/maintenance
  }
}

const ROOT = process.cwd();

const PAGES = {
  '/':                                     { offer: '_offer/index.html',            white: '_white/index.html' },
  '/index.html':                           { offer: '_offer/index.html',            white: '_white/index.html' },
  '/countries.html':                       { offer: '_offer/countries.html',        white: '_white/countries.html' },
  '/what-is-idp.html':                     { offer: '_offer/what-is-idp.html',      white: '_white/what-is-idp.html' },

  '/about.html':                           { offer: null, white: '_white/about.html' },
  '/contact.html':                         { offer: null, white: '_white/contact.html' },
  '/cookies.html':                         { offer: null, white: '_white/cookies.html' },
  '/disclaimer.html':                      { offer: null, white: '_white/disclaimer.html' },
  '/privacy.html':                         { offer: null, white: '_white/privacy.html' },
  '/refunds.html':                         { offer: null, white: '_white/refunds.html' },
  '/shipping.html':                        { offer: null, white: '_white/shipping.html' },
  '/terms.html':                           { offer: null, white: '_white/terms.html' },

  '/about-us.html':                        { offer: '_offer/about-us.html',        white: null },
  '/contact-us.html':                      { offer: '_offer/contact-us.html',      white: null },
  '/cookie-policy.html':                   { offer: '_offer/cookie-policy.html',   white: null },
  '/legal-disclaimer.html':                { offer: '_offer/legal-disclaimer.html', white: null },
  '/privacy-policy.html':                  { offer: '_offer/privacy-policy.html', white: null },
  '/refund-return-policy.html':            { offer: '_offer/refund-return-policy.html', white: null },
  '/shipping-policy.html':                 { offer: '_offer/shipping-policy.html', white: null },
  '/terms-of-service.html':                { offer: '_offer/terms-of-service.html', white: null },
  '/acceptable-use-policy.html':           { offer: '_offer/acceptable-use-policy.html', white: null },
  '/accessibility-statement.html':         { offer: '_offer/accessibility-statement.html', white: null },
  '/dmca-and-intellectual-property-policy.html': { offer: '_offer/dmca-and-intellectual-property-policy.html', white: null },
  '/payment-policy.html':                  { offer: '_offer/payment-policy.html', white: null },
  '/checkout.html':                        { offer: '_offer/checkout.html',       white: null },
  '/payment.html':                         { offer: '_offer/payment.html',        white: null },
  '/pricing.html':                         { offer: '_offer/pricing.html',        white: null },
  '/faq.html':                             { offer: '_offer/faq.html',            white: null },
  '/track-order.html':                     { offer: '_offer/track-order.html',    white: null },
  '/upload-photos.html':                   { offer: '_offer/upload-photos.html',  white: null },
  '/thank-you.html':                       { offer: '_offer/thank-you.html',      white: null },
};

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

function fixWhiteAssetPaths(html, nested) {
  if (nested) {
    return html
      .replace(/href="\.\.\/styles\.css"/g, 'href="/_white/styles.css"')
      .replace(/src="\.\.\/script\.js"/g, 'src="/_white/script.js"')
      .replace(/(href|src)="\.\.\/assets\//g, '$1="/_white/assets/')
      .replace(/(href)="\.\.\/([a-z-]+\.html)/g, '$1="/$2');
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

  res.setHeader('Cache-Control', 'no-store, must-revalidate');

  if (mode === 'maintenance') {
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(MAINTENANCE_HTML);
  }

  if (pathname === '/apply' || pathname === '/apply/' || pathname.startsWith('/apply/')) {
    try {
      if (mode === 'offer') {
        const html = readFile('_offer/pricing.html');
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

  const relPath = entry[mode];
  if (!relPath) return notFound(res);

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
