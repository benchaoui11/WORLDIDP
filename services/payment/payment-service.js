/* =========================================================================
   WorldIDP — Payment service
   -------------------------------------------------------------------------
   This is the ONLY module the UI is allowed to talk to for payments.
   No page should ever reference Stripe, a Stripe Payment Link, or the
   payment backend URL directly — everything goes through the functions
   below.

   STATUS: architecture-only. buildPayload() is fully wired and produces
   the exact payload the backend expects. submitPayment() intentionally
   does NOT perform a network call yet — sending real payments is a
   separate, later step. The fetch call it will eventually make is left
   commented below so wiring it up later is a one-line change.
   ========================================================================= */

window.WorldIDPPayment = (function () {
  "use strict";

  const codes = window.WorldIDPProductCodes;
  const cfg = window.WORLDIDP_PAYMENT_CONFIG || {};

  /* ---------------------------------------------------------------------
     Build the exact payload the payment backend expects.
     order = { format: "digital"|"physical", validYears: 1|2|3,
               express: boolean, email: string, ref?: string }
     --------------------------------------------------------------------- */
  function buildPayload(order) {
    const productCode = codes.getProductCode(order.format, order.validYears);
    const addons = [];
    if (order.express) {
      const expressCode = codes.getAddonCode("express");
      if (expressCode) addons.push(expressCode);
    }

    return {
      website: cfg.WEBSITE,
      product_code: productCode,
      addons: addons,
      customer_email: order.email || "",
      metadata: {
        source: cfg.WEBSITE,
        frontend_version: cfg.API_VERSION,
        ref: order.ref || undefined,
      },
    };
  }

  /* ---------------------------------------------------------------------
     Submit a payment. NOT YET CONNECTED to the real backend on purpose —
     this only prepares the request shape so the real integration is a
     drop-in later. It never throws; it always resolves so the calling
     page can show a "not yet available" state without extra try/catch.
     --------------------------------------------------------------------- */
  async function submitPayment(payload) {
    console.info("[WorldIDPPayment] payload ready (payment backend not yet connected):", payload);

    // ---- Future real call (do not enable until the backend is wired) ----
    // const res = await fetch(`${cfg.PAYMENT_API_BASE}/v1/payments`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(payload),
    // });
    // const data = await res.json();
    // return { ok: res.ok, data };

    return { ok: false, pending: true, payload };
  }

  return { buildPayload, submitPayment };
})();
