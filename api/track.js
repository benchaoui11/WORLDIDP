// ════════════════════════════════════════════════════════════════
// POST /api/track   { sessionId, siteMode, referrer, landingPage, browser, os, device }
// Fire-and-forget analytics beacon. Country comes from Vercel's own
// edge geo headers (real data — never guessed or invented).
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* ignore malformed beacons */
  }

  // Vercel automatically provides geolocation on Edge Functions — real data,
  // derived from the request's actual origin, not user-agent guessing.
  const country =
    request.headers.get('x-vercel-ip-country') ||
    request.geo?.country ||
    null;

  const row = {
    session_id: body.sessionId || null,
    site_mode_at_visit: body.siteMode || null,
    country,
    browser: body.browser || null,
    os: body.os || null,
    device: body.device || null,
    referrer: body.referrer || null,
    landing_page: body.landingPage || null,
  };

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/visitors`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
  } catch {
    /* never let analytics failures affect the visitor's page */
  }

  return new Response(null, { status: 204 });
}
