// ════════════════════════════════════════════════════════════════
// POST /api/switch-mode   { mode: "offer" | "white" | "maintenance" }
// Header: Authorization: Bearer <supabase-user-access-token>
// ════════════════════════════════════════════════════════════════
// This is the ONLY way the live mode ever changes. It requires a
// valid, currently-logged-in Supabase user (checked server-side with
// the service role key, which never reaches the browser).
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only, never exposed to the client

const VALID_MODES = new Set(['offer', 'white', 'maintenance']);

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) return json({ error: 'Missing session' }, 401);

  // 1) Verify the caller is really a logged-in Supabase user.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!userRes.ok) return json({ error: 'Invalid or expired session' }, 401);
  const user = await userRes.json();
  const adminEmail = user?.email || 'unknown-admin';

  // 2) Validate the requested mode.
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  const nextMode = body?.mode;
  if (!VALID_MODES.has(nextMode)) {
    return json({ error: 'Invalid mode. Must be offer, white, or maintenance.' }, 400);
  }

  // 3) Read current mode (for the log), then update.
  const currentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/site_settings?select=mode&id=eq.1`,
    { headers: authHeaders() }
  );
  const currentRows = await currentRes.json();
  const currentMode = currentRows?.[0]?.mode || 'offer';

  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?id=eq.1`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ mode: nextMode, updated_at: new Date().toISOString(), updated_by: adminEmail }),
  });
  if (!updateRes.ok) return json({ error: 'Failed to update site mode' }, 500);

  // 4) Log the switch for the dashboard's history panel.
  await fetch(`${SUPABASE_URL}/rest/v1/switch_log`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ from_mode: currentMode, to_mode: nextMode, changed_by: adminEmail }),
  });

  return json({ ok: true, mode: nextMode, changed_by: adminEmail });
}

function authHeaders() {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
