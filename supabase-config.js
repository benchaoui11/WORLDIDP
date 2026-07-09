/* =========================================================================
   WorldIDP — Supabase integration (config + helpers)
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
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
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
    console.warn("[WorldIDP] Supabase not configured — skipping upload (demo mode).");
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

    // 2) Idempotent insert: if this ref was already submitted (e.g. the
    //    customer retried payment after the first attempt), reuse that
    //    existing row instead of inserting a duplicate.
    const { data: existing, error: lookupErr } = await supabase
      .from(cfg.TABLE)
      .select("ref")
      .eq("ref", ref)
      .maybeSingle();
    if (lookupErr) throw lookupErr;

    if (existing) {
      // Already have an application for this ref — nothing more to insert.
      // The caller can safely continue on to payment / retry payment.
      return { ok: true, ref, reused: true };
    }

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
      // file paths in storage
      file_selfie: fileUrls.selfie || null,
      file_license_front: fileUrls.front || null,
      file_license_back: fileUrls.back || null,
      file_signature: fileUrls.signature || null,
    };

    const { error: insErr } = await supabase.from(cfg.TABLE).insert(row);
    if (insErr) {
      // Race condition: another request for the same ref was inserted
      // between our check above and this insert (e.g. a double-click or a
      // fast retry). Treat that as success instead of a real failure —
      // the application already exists either way.
      const isDuplicateRef = insErr.code === "23505" || /duplicate key/i.test(insErr.message || "");
      if (isDuplicateRef) return { ok: true, ref, reused: true };
      throw insErr;
    }

    return { ok: true, ref };
  } catch (e) {
    console.error("[WorldIDP] submit failed:", e);
    // Never surface raw database error text to the customer.
    return { ok: false, error: "We couldn't save your application right now. Please try again in a moment." };
  }
};
