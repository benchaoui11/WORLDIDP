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
  try {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error('[switch-mode] missing env vars', {
        hasUrl: !!SUPABASE_URL,
        hasServiceKey: !!SERVICE_ROLE_KEY,
      });
      return json({ error: 'Server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var on Vercel.' }, 500);
    }

    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) return json({ error: 'Missing session' }, 401);

    // 1) Verify the caller is really a logged-in Supabase user.
    let user;
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!userRes.ok) return json({ error: 'Invalid or expired session' }, 401);
      user = await userRes.json();
    } catch (err) {
      console.error('[switch-mode] auth check failed:', err.message);
      return json({ error: 'Could not verify session: ' + err.message }, 502);
    }
    const adminEmail = user?.email || '';

    // 1b) Verify that user is actually an ADMIN, not just *some* logged-in
    //     user. This check is NOT optional: every Supabase project accepts
    //     signups with the public anon key by default, so "has a session"
    //     proves nothing — anyone could have made themselves an account.
    //     RLS can't save us here either, because every request below is sent
    //     with the service role key, which bypasses RLS entirely. The
    //     allowlist has to be enforced right here, explicitly.
    try {
      const adminRes = await fetch(
        `${SUPABASE_URL}/rest/v1/admin_users?select=email&email=eq.${encodeURIComponent(
          (adminEmail || '').toLowerCase()
        )}`,
        { headers: authHeaders() }
      );
      if (!adminRes.ok) {
        console.error('[switch-mode] admin lookup failed:', adminRes.status);
        return json({ error: 'Could not verify admin access' }, 502);
      }
      const adminRows = await adminRes.json();
      if (!Array.isArray(adminRows) || adminRows.length === 0) {
        console.warn('[switch-mode] REJECTED non-admin user:', adminEmail);
        return json({ error: 'Not authorized' }, 403);
      }
    } catch (err) {
      console.error('[switch-mode] admin check failed:', err.message);
      // Fail CLOSED: if we can't prove the caller is an admin, refuse.
      return json({ error: 'Could not verify admin access: ' + err.message }, 502);
    }

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
    let currentMode = 'offer';
    try {
      const currentRes = await fetch(
        `${SUPABASE_URL}/rest/v1/site_settings?select=mode&id=eq.1`,
        { headers: authHeaders() }
      );
      if (currentRes.ok) {
        const currentRows = await currentRes.json();
        currentMode = currentRows?.[0]?.mode || 'offer';
      }
    } catch (err) {
      console.error('[switch-mode] could not read current mode (continuing anyway):', err.message);
    }

    let updateRes;
    try {
      updateRes = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?id=eq.1`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ mode: nextMode, updated_at: new Date().toISOString(), updated_by: adminEmail }),
      });
    } catch (err) {
      console.error('[switch-mode] update fetch failed:', err.message);
      return json({ error: 'Failed to reach Supabase: ' + err.message }, 502);
    }
    if (!updateRes.ok) {
      const detail = await updateRes.text().catch(() => '');
      console.error('[switch-mode] update rejected:', updateRes.status, detail);
      return json({ error: `Failed to update site mode (Supabase status ${updateRes.status}). ${detail.slice(0, 200)}` }, 500);
    }

    // 4) Log the switch for the dashboard's history panel (best-effort — never
    //    fail the whole switch just because the log insert had trouble).
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/switch_log`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ from_mode: currentMode, to_mode: nextMode, changed_by: adminEmail }),
      });
    } catch (err) {
      console.error('[switch-mode] log insert failed (non-fatal):', err.message);
    }

    return json({ ok: true, mode: nextMode, changed_by: adminEmail });
  } catch (err) {
    // Last-resort catch-all — guarantees the client always gets valid JSON
    // back instead of Vercel's generic "A server error has occurred" page.
    console.error('[switch-mode] unhandled error:', err);
    return json({ error: 'Unexpected server error: ' + (err?.message || String(err)) }, 500);
  }
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
