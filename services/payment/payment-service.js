/* =========================================================================
   WorldIDP — Payment service
   -------------------------------------------------------------------------
   This is the ONLY module the UI is allowed to talk to for payments.
   No page should ever reference Stripe, a Stripe Payment Link, or the
   payment backend URL directly — everything goes through the functions
   below.

   STATUS: TEST MODE. createTestPaymentOrder() makes a real network call
   to the payment backend's create-checkout endpoint, but purely to
   verify the integration — it never redirects the customer anywhere.
   submitPayment() remains the original architecture-only stub (no
   network call) for the future real checkout flow.
   ========================================================================= */

window.WorldIDPPayment = (function () {
  "use strict";

  const codes = window.WorldIDPProductCodes;
  const cfg = window.WORLDIDP_PAYMENT_CONFIG || {};

  /* ---------------------------------------------------------------------
     Shared by every payload builder below: product_code + addons +
     customer_email never change shape depending on which metadata a
     given call site needs.
     --------------------------------------------------------------------- */
  function buildBasePayload(order) {
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
    };
  }

  /* ---------------------------------------------------------------------
     Build the exact payload the payment backend expects.
     order = { format: "digital"|"physical", validYears: 1|2|3,
               express: boolean, email: string, ref?: string }
     --------------------------------------------------------------------- */
  function buildPayload(order) {
    return Object.assign(buildBasePayload(order), {
      metadata: {
        source: cfg.WEBSITE,
        frontend_version: cfg.API_VERSION,
        ref: order.ref || undefined,
      },
    });
  }

  /* ---------------------------------------------------------------------
     Build the payload for the TEST MODE create-checkout call.
     order = { format, validYears, express, email,
               applicationId?: string, orderReference?: string }
     --------------------------------------------------------------------- */
  function buildTestCheckoutPayload(order) {
    return Object.assign(buildBasePayload(order), {
      metadata: {
        source: cfg.WEBSITE,
        frontend_version: cfg.API_VERSION,
        application_id: order.applicationId || undefined,
        order_reference: order.orderReference || undefined,
        // Shipping is always free — these are informational only and never
        // affect product_code, addons, or the computed amount.
        shipping: "free",
        shipping_eta: "14-25 working days",
        fast_processing: !!order.express,
      },
    });
  }

  /* ---------------------------------------------------------------------
     Submit a payment. NOT YET CONNECTED to the real backend on purpose —
     this only prepares the request shape for the future real checkout.
     It never throws; it always resolves so the calling page can show a
     "not yet available" state without extra try/catch.
     --------------------------------------------------------------------- */
  async function submitPayment(payload) {
    console.info("[WorldIDPPayment] payload ready (real checkout not yet connected):", payload);
    return { ok: false, pending: true, payload };
  }

  /* ---------------------------------------------------------------------
     TEST MODE ONLY: send the prepared payload to the backend's
     create-checkout endpoint to verify the integration. Never redirects
     the customer — the caller decides what to show based on the result.
     Resolves instead of throwing so a missing/unreachable endpoint just
     looks like an unsuccessful result to the caller.
     --------------------------------------------------------------------- */
  async function createTestPaymentOrder(payload) {
    const url = `${cfg.PAYMENT_API_BASE}${cfg.ENDPOINTS.CREATE_CHECKOUT}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = null;
      try { data = await res.json(); } catch (e) { /* backend may return no/invalid body while the endpoint is still a stub */ }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.error("[WorldIDPPayment] createTestPaymentOrder failed:", err);
      return { ok: false, error: err.message || String(err) };
    }
  }

  return { buildPayload, buildTestCheckoutPayload, submitPayment, createTestPaymentOrder };
})();

