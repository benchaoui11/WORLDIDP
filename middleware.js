// ════════════════════════════════════════════════════════════════
// WorldIDP — Global Site Mode Middleware
// ════════════════════════════════════════════════════════════════
// WHAT THIS DOES (in plain terms):
//   Every request is checked against ONE global flag stored in Supabase
//   ("offer" | "white" | "maintenance"). Whatever that flag says, EVERY
//   visitor gets served — no exceptions, no per-visitor logic.
//
// WHAT THIS DELIBERATELY DOES NOT DO (by design, for SEO compliance):
//   - It does NOT read the User-Agent header to decide what to serve.
//   - It does NOT read the visitor's IP to decide what to serve.
//   - It does NOT special-case Googlebot / bots / crawlers in any way.
//   Googlebot and a real visitor hitting the same URL at the same
//   moment always receive byte-for-byte the same response.
//
// The switch itself is 100% manual: someone clicks a button in /admin.
// This file only ever *reads* the current mode and serves accordingly.
// ════════════════════════════════════════════════════════════════

export const config = {
  matcher: [
    // Run on every request EXCEPT: admin panel, api routes, the _white
    // folder itself, the analytics beacon, and static assets.
    '/((?!admin|api|_white|IMAGES|fonts|favicon|robots.txt|sitemap.xml|manifest|analytics-beacon\.js).*)',
  ],
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Every path that really exists inside the White Page bundle.
// Anything NOT in this list falls back to the White Page home page.
const WHITE_PAGE_PATHS = new Set([
  '/', '/index.html',
  '/about.html', '/contact.html', '/cookies.html', '/countries.html',
  '/disclaimer.html', '/privacy.html', '/refunds.html', '/shipping.html',
  '/terms.html', '/what-is-idp.html', '/script.js', '/styles.css',
  '/apply', '/apply/', '/apply/index.html',
  '/assets/favicon.png', '/assets/logo.webp', '/assets/logo-white.webp',
  '/fonts/regular.woff2', '/fonts/semibold.woff2', '/fonts/bold.woff2',
]);

// Simple in-memory cache so we don't hit Supabase on literally every
// request — the mode changes rarely (a human clicks a button), so a
// few seconds of cache is invisible in practice but saves a network
// round-trip on almost every page view.
let cachedMode = null;
let cachedAt = 0;
const CACHE_MS = 5000;

async function getSiteMode() {
  const now = Date.now();
  if (cachedMode && now - cachedAt < CACHE_MS) return cachedMode;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/site_settings?select=mode&id=eq.1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        // Edge runtime fetch cache hint — keep it short, mode changes should
        // propagate fast when an admin flips the switch.
        cache: 'no-store',
      }
    );
    const rows = await res.json();
    const mode = rows?.[0]?.mode || 'offer';
    cachedMode = mode;
    cachedAt = now;
    return mode;
  } catch (e) {
    // If Supabase is unreachable for any reason, fail SAFE:
    // always fall back to the real Offer Page, never to White/maintenance.
    return 'offer';
  }
}

export default async function middleware(request) {
  const mode = await getSiteMode();
  const { pathname } = new URL(request.url);

  // ---- OFFER MODE: do nothing, serve the real site exactly as-is ----
  if (mode === 'offer') {
    return; // fall through to normal static hosting, zero overhead
  }

  // ---- MAINTENANCE MODE ----
  if (mode === 'maintenance') {
    return new Response(await maintenanceHtml(), {
      status: 503, // Google's documented pattern for temporary downtime
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Retry-After': '1800', // 30 minutes, matches the described use-case
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store',
      },
    });
  }

  // ---- WHITE (NEUTRAL) MODE ----
  if (mode === 'white') {
    let targetPath = WHITE_PAGE_PATHS.has(pathname) ? pathname : '/index.html';
    if (targetPath === '/') targetPath = '/index.html';
    if (targetPath === '/apply' || targetPath === '/apply/') targetPath = '/apply/index.html';
    const url = new URL(request.url);
    url.pathname = `/_white${targetPath}`;

    return fetch(url, { headers: request.headers }).then((res) => {
      const headers = new Headers(res.headers);
      headers.set('X-Robots-Tag', 'noindex, nofollow');
      headers.set('Cache-Control', 'no-store');
      return new Response(res.body, {
        status: res.status === 200 ? 503 : res.status,
        headers,
      });
    });
  }

  return; // unknown mode -> fail safe to normal site
}

async function maintenanceHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>We'll be right back | WorldIDP</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#0b1f4d;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:24px;}
  .box{max-width:440px}
  h1{font-size:1.6rem;margin:0 0 10px}
  p{color:#b7c0d4;line-height:1.6;margin:0}
</style>
</head>
<body>
  <div class="box">
    <h1>We'll be right back</h1>
    <p>WorldIDP is briefly unavailable for maintenance. Please check back shortly.</p>
  </div>
</body>
</html>`;
}
