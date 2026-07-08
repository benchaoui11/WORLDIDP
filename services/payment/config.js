/* =========================================================================
   WorldIDP — Payment service · configuration
   -------------------------------------------------------------------------
   This is the ONLY place the payment backend URL is written down.
   Every other file must read window.WORLDIDP_PAYMENT_CONFIG — never a
   hardcoded URL of its own.
   ========================================================================= */

window.WORLDIDP_PAYMENT_CONFIG = {
  PAYMENT_API_BASE: "https://pay.promptzeno.com",
  WEBSITE: "worldidp",
  API_VERSION: "v1",
  ENDPOINTS: {
    CREATE_CHECKOUT: "/api/pay/create-checkout",
  },
};
