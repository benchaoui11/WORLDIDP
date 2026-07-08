/* =========================================================================
   WorldIDP — Payment service · product codes
   -------------------------------------------------------------------------
   Single source of truth for the codes the payment backend understands.
   Nothing outside this file (or payment-service.js) should hardcode a
   product_code or addon code string.
   ========================================================================= */

window.WorldIDPProductCodes = (function () {
  "use strict";

  // format ("digital" | "physical") + validYears (1 | 2 | 3) -> product_code
  const PRODUCT_CODES = {
    digital:  { 1: "digital_1y", 2: "digital_2y", 3: "digital_3y" },
    // "physical" in the UI = "Print + FREE Digital" on the backend
    physical: { 1: "print_1y",   2: "print_2y",   3: "print_3y" },
  };

  // Add-ons available for every package.
  const ADDON_CODES = {
    express: "express_processing",
  };

  function getProductCode(format, validYears) {
    const table = PRODUCT_CODES[format] || PRODUCT_CODES.digital;
    const years = table[validYears] ? validYears : 3; // fall back to the longest tier, same as the existing price table
    return table[years];
  }

  function getAddonCode(name) {
    return ADDON_CODES[name] || null;
  }

  return { PRODUCT_CODES, ADDON_CODES, getProductCode, getAddonCode };
})();
