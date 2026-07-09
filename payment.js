/* =========================================================================
   WorldIDP — Step 3: Delivery & Payment (physical orders)
   ========================================================================= */
(() => {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const flagEmoji = (code) => code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt()));
  const ISO = {"Afghanistan":"AF","Albania":"AL","Algeria":"DZ","Andorra":"AD","Angola":"AO","Argentina":"AR","Armenia":"AM","Australia":"AU","Austria":"AT","Azerbaijan":"AZ","Bahamas":"BS","Bahrain":"BH","Bangladesh":"BD","Barbados":"BB","Belarus":"BY","Belgium":"BE","Belize":"BZ","Benin":"BJ","Bhutan":"BT","Bolivia":"BO","Bosnia and Herzegovina":"BA","Botswana":"BW","Brazil":"BR","Brunei":"BN","Bulgaria":"BG","Burkina Faso":"BF","Cambodia":"KH","Cameroon":"CM","Canada":"CA","Cape Verde":"CV","Chad":"TD","Chile":"CL","China":"CN","Colombia":"CO","Costa Rica":"CR","Croatia":"HR","Cuba":"CU","Cyprus":"CY","Czech Republic":"CZ","Denmark":"DK","Dominican Republic":"DO","Ecuador":"EC","Egypt":"EG","El Salvador":"SV","Estonia":"EE","Ethiopia":"ET","Fiji":"FJ","Finland":"FI","France":"FR","Gabon":"GA","Georgia":"GE","Germany":"DE","Ghana":"GH","Greece":"GR","Guatemala":"GT","Guyana":"GY","Haiti":"HT","Honduras":"HN","Hungary":"HU","Iceland":"IS","India":"IN","Indonesia":"ID","Iran":"IR","Iraq":"IQ","Ireland":"IE","Israel":"IL","Italy":"IT","Jamaica":"JM","Japan":"JP","Jordan":"JO","Kazakhstan":"KZ","Kenya":"KE","Kuwait":"KW","Kyrgyzstan":"KG","Laos":"LA","Latvia":"LV","Lebanon":"LB","Libya":"LY","Liechtenstein":"LI","Lithuania":"LT","Luxembourg":"LU","Madagascar":"MG","Malawi":"MW","Malaysia":"MY","Maldives":"MV","Mali":"ML","Malta":"MT","Mauritius":"MU","Mexico":"MX","Moldova":"MD","Monaco":"MC","Mongolia":"MN","Montenegro":"ME","Morocco":"MA","Mozambique":"MZ","Myanmar":"MM","Namibia":"NA","Nepal":"NP","Netherlands":"NL","New Zealand":"NZ","Nicaragua":"NI","Niger":"NE","Nigeria":"NG","North Macedonia":"MK","Norway":"NO","Oman":"OM","Pakistan":"PK","Palestine":"PS","Panama":"PA","Papua New Guinea":"PG","Paraguay":"PY","Peru":"PE","Philippines":"PH","Poland":"PL","Portugal":"PT","Qatar":"QA","Romania":"RO","Russia":"RU","Rwanda":"RW","Saudi Arabia":"SA","Senegal":"SN","Serbia":"RS","Seychelles":"SC","Singapore":"SG","Slovakia":"SK","Slovenia":"SI","Somalia":"SO","South Africa":"ZA","South Korea":"KR","Spain":"ES","Sri Lanka":"LK","Sudan":"SD","Sweden":"SE","Switzerland":"CH","Syria":"SY","Taiwan":"TW","Tajikistan":"TJ","Tanzania":"TZ","Thailand":"TH","Togo":"TG","Trinidad and Tobago":"TT","Tunisia":"TN","Turkey":"TR","Turkmenistan":"TM","Uganda":"UG","Ukraine":"UA","United Arab Emirates":"AE","United Kingdom":"GB","United States":"US","Uruguay":"UY","Uzbekistan":"UZ","Venezuela":"VE","Vietnam":"VN","Yemen":"YE","Zambia":"ZM","Zimbabwe":"ZW"};
  function flagFor(name){ const c = ISO[name]; return c ? flagEmoji(c) : "🏳️"; }

  /* ---------- load order context ---------- */
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem("worldidp_application") || "{}"); } catch(e){ return {}; } })();
  const params = new URLSearchParams(location.search);
  const order = {
    format: saved.format || params.get("format") || "physical",
    validYears: parseInt(saved.validYears || params.get("valid") || "3", 10),
    country: params.get("country") || saved.country || "Thailand",
    firstName: saved.firstName || "",
    lastName: saved.lastName || "",
    email: saved.email || "",
    phone: saved.phone || "",
    category: saved.category || "",
  };

  // Digital orders use this page too, but with only the speed (express-processing) choice —
  // no address, no shipping. Hide the physical-only sections for them.
  const isDigital = order.format !== "physical";
  if (isDigital) {
    document.querySelectorAll("[data-physical-only]").forEach((el) => { el.style.display = "none"; });
    const intro = document.querySelector(".pay-intro p, [data-pay-intro]");
    if (intro) intro.textContent = "Choose how fast you'd like your digital IDP. You'll complete payment securely on the next screen — we never store your card.";
  }

  const productPrice = (() => {
    // Price table — Digital: 49/55/59 · Print+Digital: 79/89/99
    const PRICES = {
      digital:  { 1: 49, 2: 55, 3: 59 },
      physical: { 1: 79, 2: 89, 3: 99 },
    };
    const table = PRICES[order.format] || PRICES.digital;
    const y = order.validYears;
    return table[y] != null ? table[y] : table[3];
  })();
  const expYear = 2026 + order.validYears;

  /* ---------- prefill recipient + country ---------- */
  if (order.firstName) $("#first-name").value = order.firstName;
  if (order.lastName)  $("#last-name").value = order.lastName;

  // Build the country dropdown (editable). Pre-selects the country from step 1,
  // but the customer can change their delivery country if they wish.
  const COUNTRY_NAMES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Cambodia","Cameroon","Canada","Cape Verde","Chad","Chile","China","Colombia","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Dominican Republic","Ecuador","Egypt","El Salvador","Estonia","Ethiopia","Fiji","Finland","France","Gabon","Georgia","Germany","Ghana","Greece","Guatemala","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Mauritius","Mexico","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Macedonia","Norway","Oman","Pakistan","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saudi Arabia","Senegal","Serbia","Seychelles","Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","Spain","Sri Lanka","Sudan","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Togo","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"];
  const countrySelect = $("#country");
  if (countrySelect) {
    const popular = ["Thailand","United States","United Kingdom","Canada","Australia","Germany","France"];
    const mk = (name) => { const o = document.createElement("option"); o.value = name; o.textContent = `${flagFor(name)}  ${name}`; return o; };
    popular.forEach((n) => countrySelect.appendChild(mk(n)));
    const sep = document.createElement("option"); sep.disabled = true; sep.textContent = "──────────"; countrySelect.appendChild(sep);
    COUNTRY_NAMES.forEach((n) => countrySelect.appendChild(mk(n)));
    countrySelect.value = order.country;
    // keep order.country in sync if the customer changes it
    countrySelect.addEventListener("change", () => { order.country = countrySelect.value; });
  }

  $("[data-sum-fmt]").textContent = order.format === "physical" ? "Print + Digital IDP" : "Digital Only IDP";
  $("[data-sum-valid]").textContent = `${order.validYears}-year validity · Expires ${expYear}`;
  $("[data-sum-product]").textContent = `$${productPrice}`;
  $("[data-fmt-label]").textContent = order.format === "physical" ? "Print + Digital" : "Digital Only";

  /* ---------- pricing state ---------- */
  const state = { shipping: isDigital ? 0 : 9, express: true, expressPrice: 19, couponPct: 0, couponCode: "" };

  function recalc() {
    const product = productPrice;
    const ship = state.shipping;
    const express = state.express ? state.expressPrice : 0;
    const subtotal = product + ship + express;
    const discount = Math.round(subtotal * state.couponPct);
    const total = subtotal - discount;

    $("[data-sum-ship]").textContent = `$${ship}`;
    const shipLine = $('[data-line="ship"]') || $("[data-sum-ship]").closest(".sl, .sum-line, li, .summary-row");
    if (isDigital && shipLine) shipLine.classList.add("is-hidden");
    const expressLine = $('[data-line="express"]');
    if (state.express) { expressLine.classList.remove("is-hidden"); $("[data-sum-express]").textContent = `$${express}`; }
    else expressLine.classList.add("is-hidden");

    const couponLine = $('[data-line="coupon"]');
    const wasEl = $("[data-sum-was]");
    if (state.couponPct > 0) {
      couponLine.classList.remove("is-hidden");
      $("[data-sum-coupon]").textContent = `−$${discount}`;
      $("[data-coupon-code]").textContent = state.couponCode ? `(${state.couponCode})` : "";
      wasEl.classList.remove("is-hidden");
      wasEl.textContent = `$${subtotal}`;
    } else {
      couponLine.classList.add("is-hidden");
      wasEl.classList.add("is-hidden");
    }

    $("[data-sum-total]").textContent = total;
    $("[data-pay-text]").textContent = `Pay $${total} securely`;
    state._total = total;
  }

  /* ---------- shipping radios ---------- */
  $$(".ship").forEach((opt) => {
    opt.addEventListener("click", (e) => {
      e.preventDefault();
      $$(".ship").forEach((o) => o.classList.remove("is-active"));
      opt.classList.add("is-active");
      $("input", opt).checked = true;
      state.shipping = parseInt(opt.dataset.price, 10);
      recalc();
    });
  });

  /* ---------- express-processing checkbox ---------- */
  const expressEl = $("[data-express]");
  expressEl.addEventListener("click", (e) => {
    e.preventDefault();
    state.express = !state.express;
    expressEl.classList.toggle("is-active", state.express);
    $("input", expressEl).checked = state.express;
    state.expressPrice = parseInt(expressEl.dataset.price, 10);
    recalc();
  });

  /* ---------- coupon ---------- */
  // TEMPORARY: until real payment (Stripe) is connected, coupons must never
  // reduce the payable amount — payment_orders.amount is computed purely
  // from product_code + express on the backend, with no discount concept
  // yet. Applying a discount here would make the visible Total Due not
  // match what's actually charged. state.couponPct is intentionally never
  // set to a non-zero value below; recalc() already only shows a discount
  // when couponPct > 0, so leaving it at 0 keeps Total Due == subtotal.
  $("[data-coupon-toggle]").addEventListener("click", () => $("[data-coupon-box]").classList.toggle("show"));
  $("[data-coupon-apply]").addEventListener("click", () => {
    const msg = $("[data-coupon-msg]");
    msg.className = "coupon-msg bad";
    msg.textContent = "Coupons will be available after secure payment is activated.";
  });

  /* ---------- validation ---------- */
  function markField(input, ok) {
    const field = input.closest(".field");
    input.classList.toggle("invalid", !ok);
    input.classList.toggle("ok", ok && input.value.trim().length > 0);
    if (field) field.classList.toggle("show-err", !ok);
    return ok;
  }
  const REQUIRED = ["#first-name","#last-name","#addr1","#state","#city","#zip"];
  function validate() {
    let ok = true;
    REQUIRED.forEach((sel) => { const el = $(sel); ok = markField(el, el.value.trim().length > 0) && ok; });
    const terms = $("#agree");
    const termsOk = terms.checked;
    $("[data-terms]").classList.toggle("show-err", !termsOk);
    return ok && termsOk;
  }
  $$(".input").forEach((el) => el.addEventListener("input", () => {
    el.classList.remove("invalid"); el.closest(".field")?.classList.remove("show-err");
  }));
  $("#agree").addEventListener("change", () => $("[data-terms]").classList.remove("show-err"));

  /* ---------- submit → Supabase → payment service ---------- */
  const overlay = $("#overlay");
  const form = $("#pay-form");

  function getRef() {
    let ref = "";
    try { ref = sessionStorage.getItem("worldidp_ref") || ""; } catch(e){}
    if (!ref) { ref = "WIDP-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2,6).toUpperCase();
      try { sessionStorage.setItem("worldidp_ref", ref); } catch(e){} }
    return ref;
  }
  function getFiles() { try { return JSON.parse(sessionStorage.getItem("worldidp_files") || "{}"); } catch(e){ return {}; } }

  function showError(msg) {
    const card = overlay.querySelector(".po-card");
    card.innerHTML =
      '<div style="width:54px;height:54px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,#e4564f,#ff7a73);color:#fff;">' +
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg></div>' +
      '<h3>Something went wrong</h3><p style="margin-top:2px">' + (msg || "Please try again.") + '</p>' +
      '<button type="button" id="err-close" style="margin-top:14px;border:0;border-radius:12px;cursor:pointer;padding:11px 20px;font-weight:800;color:#fff;background:linear-gradient(135deg,#1c3da0,#3168f3);">Try again</button>';
    card.querySelector("#err-close").addEventListener("click", () => { overlay.classList.remove("show"); overlay.setAttribute("aria-hidden","true"); });
  }
  function showDemoNotice(ref, productCode) {
    const card = overlay.querySelector(".po-card");
    card.innerHTML =
      '<div style="width:54px;height:54px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,#1c3da0,#4f86ff);color:#fff;">' +
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h20v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><path d="M2 11h20M6 15h4"/></svg></div>' +
      '<h3>Payment isn\'t connected yet</h3><p style="margin-top:2px">This order (<b>'+productCode+'</b>) has been prepared but payment processing isn\'t live yet. Order reference: <b>'+ref+'</b>.</p>' +
      '<button type="button" id="demo-close" style="margin-top:14px;border:0;border-radius:12px;cursor:pointer;padding:11px 20px;font-weight:800;color:#fff;background:linear-gradient(135deg,#1c3da0,#3168f3);">Got it</button>';
    card.querySelector("#demo-close").addEventListener("click", () => { overlay.classList.remove("show"); overlay.setAttribute("aria-hidden","true"); });
  }
  function showTestSuccessNotice(ref) {
    const card = overlay.querySelector(".po-card");
    card.innerHTML =
      '<div style="width:54px;height:54px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,#15a06b,#1fc285);color:#fff;">' +
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>' +
      '<h3>Test payment order created successfully.</h3><p style="margin-top:2px">Order reference: <b>'+ref+'</b>.</p>' +
      '<button type="button" id="test-ok-close" style="margin-top:14px;border:0;border-radius:12px;cursor:pointer;padding:11px 20px;font-weight:800;color:#fff;background:linear-gradient(135deg,#1c3da0,#3168f3);">Got it</button>';
    card.querySelector("#test-ok-close").addEventListener("click", () => { overlay.classList.remove("show"); overlay.setAttribute("aria-hidden","true"); });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) {
      const bad = $(".input.invalid") || (!$("#agree").checked ? $("[data-terms]") : null);
      bad?.scrollIntoView({ behavior:"smooth", block:"center" });
      return;
    }

    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden","false");

    const ref = getRef();
    const shipName = $(".ship.is-active")?.querySelector(".sm-name")?.textContent || "Express shipping";

    const payload = {
      ref,
      format: order.format,
      validYears: order.validYears,
      country: order.country,
      total: state._total,
      currency: "USD",
      firstName: $("#first-name").value.trim(),
      lastName: $("#last-name").value.trim(),
      email: order.email,
      phone: order.phone,
      category: order.category,
      address1: $("#addr1").value.trim(),
      address2: $("#addr2").value.trim(),
      state: $("#state").value.trim(),
      city: $("#city").value.trim(),
      zip: $("#zip").value.trim(),
      shippingMethod: shipName,
      express: state.express,
      coupon: state.couponCode || null,
      files: getFiles(),
    };

    // 1) Save to Supabase (images already captured on the upload step).
    const res = await window.worldidpSubmitOrder(payload);
    if (!res.ok) { showError(res.error); return; }

    // 2) Hand off to the payment service — TEST MODE call to create-checkout.
    const paymentPayload = window.WorldIDPPayment.buildTestCheckoutPayload({
      format: order.format,
      validYears: order.validYears,
      express: state.express,
      email: order.email,
      orderReference: ref,
    });
    console.log("PAYMENT_PAYLOAD", paymentPayload);
    const result = await window.WorldIDPPayment.createTestPaymentOrder(paymentPayload);

    if (result.ok) showTestSuccessNotice(ref);
    else showDemoNotice(ref, paymentPayload.product_code);
  });

  /* ---------- header scroll ---------- */
  const header = $("[data-header]");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  window.addEventListener("scroll", onScroll, { passive:true });
  onScroll();

  /* ---------- init ---------- */
  recalc();
})();
