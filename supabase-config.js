/* =========================================================================
   FirstIDP — Supabase integration (config + helpers)
   -------------------------------------------------------------------------
   ⚙️  EDIT ONLY THE TWO VALUES BELOW.  Everything else is wired for you.

   Where to get them:
     Supabase Dashboard → Project Settings → API
       • Project URL          → SUPABASE_URL
       • anon / publishable key → SUPABASE_ANON_KEY   (safe to expose)

   ❗ NEVER paste the service_role / secret key here — it bypasses security.
   Full step-by-step setup is in SETUP.md.
   ========================================================================= */

window.WORLDIDP_SUPABASE = {
  SUPABASE_URL:      "https://ebxgcjijbjyttojqvgeb.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_uk7y1xctBGgPjYJJ5LxfLg_OQGrxpG_",

  // Names you create in Supabase (keep these defaults unless you change them):
  TABLE:  "applications",   // database table that stores each order
  BUCKET: "documents",      // storage bucket that holds the photos + signature
};

/* -------------------------------------------------------------------------
   Internal: is Supabase configured?  (If not, we run in "local demo" mode
   so the whole flow still works while you're building.)
   ------------------------------------------------------------------------- */
window.worldidpSupabaseReady = function () {
  const c = window.WORLDIDP_SUPABASE || {};
  return !!c.SUPABASE_URL && !!c.SUPABASE_ANON_KEY &&
         !/^REPLACE_/.test(c.SUPABASE_URL) && !/^REPLACE_/.test(c.SUPABASE_ANON_KEY);
};

/* -------------------------------------------------------------------------
   Lazy-load the Supabase JS client from CDN only when needed.
   ------------------------------------------------------------------------- */
let _sbClientPromise = null;
function _getClient() {
  if (_sbClientPromise) return _sbClientPromise;
  _sbClientPromise = new Promise((resolve, reject) => {
    const cfg = window.WORLDIDP_SUPABASE;
    const start = () => {
      try {
        const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
        resolve(client);
      } catch (e) { reject(e); }
    };
    if (window.supabase && window.supabase.createClient) return start();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2";
    s.onload = start;
    s.onerror = () => reject(new Error("Failed to load Supabase client"));
    document.head.appendChild(s);
  });
  return _sbClientPromise;
}

/* -------------------------------------------------------------------------
   Convert a data-URL (from a dropzone <img> or canvas) into a Blob.
   ------------------------------------------------------------------------- */
function _dataUrlToBlob(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  const [head, body] = dataUrl.split(",");
  const mime = (head.match(/data:([^;]+)/) || [])[1] || "image/png";
  const bin = atob(body);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/* -------------------------------------------------------------------------
   PUBLIC: submit an order.
   order = {
     ref, format, validYears, country, total, currency,
     firstName, lastName, email, phone, category,
     // delivery (physical only) — optional:
     address1, address2, state, city, zip, shippingMethod, express, coupon,
     // files as data URLs:
     files: { selfie, front, back, signature }
   }
   Returns { ok:true } on success, or { ok:false, error } on failure.
   If Supabase isn't configured yet, returns { ok:true, skipped:true } so the
   flow continues to the payment step during development.
   ------------------------------------------------------------------------- */
window.worldidpSubmitOrder = async function (order) {
  if (!window.worldidpSupabaseReady()) {
    console.warn("[FirstIDP] Supabase not configured — skipping upload (demo mode).");
    return { ok: true, skipped: true };
  }
  try {
    const cfg = window.WORLDIDP_SUPABASE;
    const supabase = await _getClient();
    const ref = order.ref || ("WIDP-" + Date.now());

    // 1) Upload files to Storage under a folder named after the order ref.
    const fileUrls = {};
    const files = order.files || {};
    // Upload all photos in PARALLEL (much faster than one-by-one)
    const uploaded = await Promise.all(
      ["selfie", "front", "back", "signature"].map(async (key) => {
        const blob = _dataUrlToBlob(files[key]);
        if (!blob) return null;
        const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
        const path = `${ref}/${key}.${ext}`;
        const { error: upErr } = await supabase
          .storage.from(cfg.BUCKET)
          .upload(path, blob, { contentType: blob.type, upsert: true });
        if (upErr) throw upErr;
        return { key, path };
      })
    );
    uploaded.forEach((u) => { if (u) fileUrls[u.key] = u.path; });

    // 2) Insert the application.
    //
    //    NOTE: there is deliberately NO "does this ref already exist?"
    //    pre-check here. `anon` has INSERT-only access to this table (no
    //    SELECT policy — the table holds every customer's email, phone,
    //    address and document paths, so it must never be readable with the
    //    public anon key). Any pre-check SELECT would therefore always come
    //    back empty and be useless. Duplicates are handled properly by the
    //    UNIQUE constraint on `ref` + the 23505 catch below instead.
    const row = {
      ref,
      status: "submitted",
      format: order.format || null,
      validity_years: order.validYears || null,
      destination_country: order.country || null,
      total: order.total || null,
      currency: order.currency || "USD",
      first_name: order.firstName || null,
      last_name: order.lastName || null,
      email: order.email || null,
      phone: order.phone || null,
      license_category: order.category || null,
      // delivery (null for digital)
      address_line1: order.address1 || null,
      address_line2: order.address2 || null,
      state_region: order.state || null,
      city: order.city || null,
      postal_code: order.zip || null,
      shipping_method: order.shippingMethod || null,
      vip_processing: !!order.express, // DB column name kept as-is; renaming it needs a migration, out of scope here
      coupon: order.coupon || null,
      // Travel companion linking — both null/false for a normal single-driver
      // order, so existing behavior is completely unchanged.
      group_ref: order.groupRef || null,
      is_companion: !!order.isCompanion,
      // file paths in storage
      file_selfie: fileUrls.selfie || null,
      file_license_front: fileUrls.front || null,
      file_license_back: fileUrls.back || null,
      file_signature: fileUrls.signature || null,
    };

    // Plain insert, NO .select() chained on. Chaining .select() makes
    // PostgREST add "Prefer: return=representation", which needs a SELECT
    // policy on top of the INSERT one — with INSERT-only access that made
    // the whole statement fail with 401/42501 and roll the row back, so
    // nothing ever saved. Without .select(), supabase-js sends
    // "Prefer: return=minimal" and the insert succeeds on its own.
    const { error: insErr } = await supabase.from(cfg.TABLE).insert(row);

    let reused = false;
    if (insErr) {
      // Duplicate ref (double-click, or the customer hit "Try again" after a
      // submit that actually went through). The application already exists
      // either way, so that's a success, not a failure.
      const isDuplicateRef = insErr.code === "23505" || /duplicate key/i.test(insErr.message || "");
      if (!isDuplicateRef) throw insErr;
      reused = true;
    }

    // The order number is assigned by a database trigger, so we have to read
    // it back. We can't SELECT the table directly (INSERT-only, by design),
    // so we go through get_order_number() — a SECURITY DEFINER function that
    // requires ref + the matching email together and returns nothing but the
    // integer. Same two-factor rule as track_order().
    let orderNumber = null;
    try {
      const { data: num } = await supabase.rpc("get_order_number", {
        p_ref: ref,
        p_email: order.email || "",
      });
      if (typeof num === "number") orderNumber = num;
    } catch (e) {
      // The application IS saved at this point — a missing order number is
      // cosmetic (the thank-you page falls back to the ref). Never turn this
      // into a failed submit.
      console.warn("[FirstIDP] could not read order number:", e);
    }

    return { ok: true, ref, reused, orderNumber };
  } catch (e) {
    console.error("[FirstIDP] submit failed:", e);
    // Never surface raw database error text to the customer.
    return { ok: false, error: "We couldn't save your application right now. Please try again in a moment." };
  }
};

// ────────────────────────────────────────────────────────────────
// Sends the "application received" confirmation email. This is a
// courtesy notification, not a critical step — the application is
// already safely saved in Supabase by the time this runs, so a slow
// or failed email must NEVER delay or block the customer's redirect
// to the thank-you page.
// ────────────────────────────────────────────────────────────────
window.worldidpSendConfirmationEmail = async function (payload) {
  try {
    await fetch("/api/send-confirmation-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[FirstIDP] confirmation email failed (non-blocking):", e);
  }
};

// Sends the "New order" alert to the business inbox. Same fire-and-forget
// rule as the customer confirmation email — never blocks the redirect.
window.worldidpSendAdminNotification = async function (payload) {
  try {
    await fetch("/api/send-admin-notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("[FirstIDP] admin notification failed (non-blocking):", e);
  }
};

// ────────────────────────────────────────────────────────────────
// Public order tracking — secure, two-factor lookup (ref + email
// must both match). Calls the `track_order` Postgres function, which
// only ever returns non-sensitive fields (see admin/supabase-schema.sql
// for why this is a function and not a direct table read). Returns an
// array of rows (1 for a solo order, 2 if a travel companion was added).
// ────────────────────────────────────────────────────────────────
window.worldidpTrackOrder = async function (ref, email) {
  if (!window.worldidpSupabaseReady()) {
    return { ok: false, error: "Tracking isn't connected yet." };
  }
  try {
    const client = await _getClient();
    const { data, error } = await client.rpc("track_order", { p_ref: ref, p_email: email });
    if (error) throw error;
    if (!data || !data.length) return { ok: true, rows: [] };
    return { ok: true, rows: data };
  } catch (e) {
    console.error("[FirstIDP] track order failed:", e);
    return { ok: false, error: "We couldn't look up that order right now. Please try again." };
  }
};
