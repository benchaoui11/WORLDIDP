/* =========================================================================
   WorldIDP — Stripe Payment Links configuration
   -------------------------------------------------------------------------
   ⚙️  THIS IS THE ONLY FILE YOU EDIT TO PLUG IN YOUR STRIPE LINKS.

   You have 10 products: 2 formats × 5 validity options.
   Paste each Stripe Payment Link below, replacing the "REPLACE_..." text.

   How to get a link:  Stripe Dashboard → Payment Links → Create → copy URL.
   A real link looks like:  https://buy.stripe.com/14k7sN0aB2cd3xy5kl

   You can keep the placeholders for now — the flow still works end-to-end
   and will show a clear "demo" notice instead of a broken page.
   ========================================================================= */

window.WORLDIDP_STRIPE = {

  /* Set to true once you have pasted your real links below.
     While false, clicking pay shows a friendly "test mode" message
     instead of sending the customer to a placeholder URL. */
  live: false,

  /* ---- DIGITAL ONLY ---- */
  "digital-1": "REPLACE_DIGITAL_1_YEAR_LINK",
  "digital-2": "REPLACE_DIGITAL_2_YEAR_LINK",
  "digital-3": "REPLACE_DIGITAL_3_YEAR_LINK",
  "digital-4": "REPLACE_DIGITAL_4_YEAR_LINK",   // if you offer 4/5-year tiers
  "digital-5": "REPLACE_DIGITAL_5_YEAR_LINK",

  /* ---- PRINT + DIGITAL ---- */
  "physical-1": "REPLACE_PHYSICAL_1_YEAR_LINK",
  "physical-2": "REPLACE_PHYSICAL_2_YEAR_LINK",
  "physical-3": "REPLACE_PHYSICAL_3_YEAR_LINK",
  "physical-4": "REPLACE_PHYSICAL_4_YEAR_LINK",
  "physical-5": "REPLACE_PHYSICAL_5_YEAR_LINK",
};

/* =========================================================================
   Helper: build the final Stripe URL for a given order.
   - Looks up the correct link from the table above.
   - Appends prefilled_email + client_reference_id so the payment is tied
     to this customer/order inside your Stripe dashboard.
   Returns { ok, url, key } — ok=false means the link isn't configured yet.
   ========================================================================= */
window.worldidpStripeUrl = function (order) {
  const cfg = window.WORLDIDP_STRIPE || {};
  const key = `${order.format}-${order.validYears}`;
  let base = cfg[key];

  const missing = !base || /^REPLACE_/.test(base) || cfg.live !== true;
  if (missing) return { ok: false, url: null, key };

  const url = new URL(base);
  if (order.email) url.searchParams.set("prefilled_email", order.email);
  if (order.ref)   url.searchParams.set("client_reference_id", order.ref);
  return { ok: true, url: url.toString(), key };
};
