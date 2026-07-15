/* =========================================================================
   FirstIDP — Checkout interactivity
   ========================================================================= */
(() => {
  "use strict";

  // Checkout is the true start of a new order. Clear any leftover
  // per-order state from a previous application BEFORE anything below
  // reads or generates a ref, so a customer starting a fresh order never
  // inherits a stale application ref (or stale saved photos/info) from an
  // earlier order in the same browser session. Retries that stay on the
  // upload/payment page — never revisiting checkout.html — are
  // unaffected, since they don't re-run this.
  try {
    sessionStorage.removeItem("worldidp_ref");
    sessionStorage.removeItem("worldidp_application");
    sessionStorage.removeItem("worldidp_files");
  } catch (e) { /* sessionStorage may be unavailable */ }

  /* ---------- helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const flagEmoji = (code) =>
    code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt()));

  /* ---------- country data ---------- */
  const COUNTRY_RAW = [
    ["Afghanistan","AF","93"],["Albania","AL","355"],["Algeria","DZ","213"],["Andorra","AD","376"],["Angola","AO","244"],
    ["Argentina","AR","54"],["Armenia","AM","374"],["Australia","AU","61"],["Austria","AT","43"],["Azerbaijan","AZ","994"],
    ["Bahamas","BS","1"],["Bahrain","BH","973"],["Bangladesh","BD","880"],["Barbados","BB","1"],["Belarus","BY","375"],
    ["Belgium","BE","32"],["Belize","BZ","501"],["Benin","BJ","229"],["Bhutan","BT","975"],["Bolivia","BO","591"],
    ["Bosnia and Herzegovina","BA","387"],["Botswana","BW","267"],["Brazil","BR","55"],["Brunei","BN","673"],["Bulgaria","BG","359"],
    ["Burkina Faso","BF","226"],["Cambodia","KH","855"],["Cameroon","CM","237"],["Canada","CA","1"],["Cape Verde","CV","238"],
    ["Chad","TD","235"],["Chile","CL","56"],["China","CN","86"],["Colombia","CO","57"],["Costa Rica","CR","506"],
    ["Croatia","HR","385"],["Cuba","CU","53"],["Cyprus","CY","357"],["Czech Republic","CZ","420"],["Denmark","DK","45"],
    ["Dominican Republic","DO","1"],["Ecuador","EC","593"],["Egypt","EG","20"],["El Salvador","SV","503"],["Estonia","EE","372"],
    ["Ethiopia","ET","251"],["Fiji","FJ","679"],["Finland","FI","358"],["France","FR","33"],["Gabon","GA","241"],
    ["Georgia","GE","995"],["Germany","DE","49"],["Ghana","GH","233"],["Greece","GR","30"],["Guatemala","GT","502"],
    ["Guyana","GY","592"],["Haiti","HT","509"],["Honduras","HN","504"],["Hungary","HU","36"],["Iceland","IS","354"],
    ["India","IN","91"],["Indonesia","ID","62"],["Iran","IR","98"],["Iraq","IQ","964"],["Ireland","IE","353"],
    ["Israel","IL","972"],["Italy","IT","39"],["Jamaica","JM","1"],["Japan","JP","81"],["Jordan","JO","962"],
    ["Kazakhstan","KZ","7"],["Kenya","KE","254"],["Kuwait","KW","965"],["Kyrgyzstan","KG","996"],["Laos","LA","856"],
    ["Latvia","LV","371"],["Lebanon","LB","961"],["Libya","LY","218"],["Liechtenstein","LI","423"],["Lithuania","LT","370"],
    ["Luxembourg","LU","352"],["Madagascar","MG","261"],["Malawi","MW","265"],["Malaysia","MY","60"],["Maldives","MV","960"],
    ["Mali","ML","223"],["Malta","MT","356"],["Mauritius","MU","230"],["Mexico","MX","52"],["Moldova","MD","373"],
    ["Monaco","MC","377"],["Mongolia","MN","976"],["Montenegro","ME","382"],["Morocco","MA","212"],["Mozambique","MZ","258"],
    ["Myanmar","MM","95"],["Namibia","NA","264"],["Nepal","NP","977"],["Netherlands","NL","31"],["New Zealand","NZ","64"],
    ["Nicaragua","NI","505"],["Niger","NE","227"],["Nigeria","NG","234"],["North Macedonia","MK","389"],["Norway","NO","47"],
    ["Oman","OM","968"],["Pakistan","PK","92"],["Palestine","PS","970"],["Panama","PA","507"],["Papua New Guinea","PG","675"],
    ["Paraguay","PY","595"],["Peru","PE","51"],["Philippines","PH","63"],["Poland","PL","48"],["Portugal","PT","351"],
    ["Qatar","QA","974"],["Romania","RO","40"],["Russia","RU","7"],["Rwanda","RW","250"],["Saudi Arabia","SA","966"],
    ["Senegal","SN","221"],["Serbia","RS","381"],["Seychelles","SC","248"],["Singapore","SG","65"],["Slovakia","SK","421"],
    ["Slovenia","SI","386"],["Somalia","SO","252"],["South Africa","ZA","27"],["South Korea","KR","82"],["Spain","ES","34"],
    ["Sri Lanka","LK","94"],["Sudan","SD","249"],["Sweden","SE","46"],["Switzerland","CH","41"],["Syria","SY","963"],
    ["Taiwan","TW","886"],["Tajikistan","TJ","992"],["Tanzania","TZ","255"],["Thailand","TH","66"],["Togo","TG","228"],
    ["Trinidad and Tobago","TT","1"],["Tunisia","TN","216"],["Turkey","TR","90"],["Turkmenistan","TM","993"],["Uganda","UG","256"],
    ["Ukraine","UA","380"],["United Arab Emirates","AE","971"],["United Kingdom","GB","44"],["United States","US","1"],["Uruguay","UY","598"],
    ["Uzbekistan","UZ","998"],["Venezuela","VE","58"],["Vietnam","VN","84"],["Yemen","YE","967"],["Zambia","ZM","260"],
    ["Zimbabwe","ZW","263"]
  ];
  const COUNTRIES = COUNTRY_RAW
    .map(([name, code, dial]) => ({ name, code, dial, flag: flagEmoji(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const POPULAR = ["United States","United Kingdom","Canada","Australia","Thailand","United Arab Emirates","Germany","France","Spain","Italy"];
  const byName = (n) => COUNTRIES.find((c) => c.name === n);

  /* ---------- populate country selects ---------- */
  function buildCountryOptions(select) {
    const def = select.dataset.default || "";
    const popular = POPULAR.map(byName).filter(Boolean);
    const popularNames = new Set(POPULAR);
    const rest = COUNTRIES.filter((c) => !popularNames.has(c.name));

    const ph = document.createElement("option");
    ph.value = ""; ph.disabled = true; ph.textContent = "Select country";
    select.appendChild(ph);

    const gPop = document.createElement("optgroup");
    gPop.label = "Popular";
    popular.forEach((c) => gPop.appendChild(opt(c)));
    select.appendChild(gPop);

    const gAll = document.createElement("optgroup");
    gAll.label = "All countries";
    rest.forEach((c) => gAll.appendChild(opt(c)));
    select.appendChild(gAll);

    if (def && byName(def)) select.value = def;
    else ph.selected = true;

    function opt(c) {
      const o = document.createElement("option");
      o.value = c.name;
      o.dataset.code = c.code;
      o.dataset.dial = c.dial;
      o.dataset.flag = c.flag;
      o.textContent = `${c.flag}  ${c.name}`;
      return o;
    }
  }
  $$("[data-country-select]").forEach(buildCountryOptions);

  /* ---------- references ---------- */
  const previewImg   = $("#preview-img");
  const fmtLabel     = $("[data-fmt-label]");
  const pmName       = $("[data-pm-name]");
  const pmCountry    = $("[data-pm-country]");
  const pmCat        = $("[data-pm-cat]");
  const pmValid      = $("[data-pm-valid]");
  const sumFmt       = $("[data-sum-fmt]");
  const sumValid     = $("[data-sum-valid]");
  const sumBase      = $("[data-sum-base]");
  const sumDisc      = $("[data-sum-disc]");
  const sumTotal     = $("[data-sum-total]");
  const featsList    = $("[data-feats]");

  const FORMAT_INFO = {
    digital: {
      img: "IMAGES/digital-international-driving-permit-on-phone.webp",
      imageTitle: "Digital International Driving Permit on a smartphone",
      label: "Digital Only",
      sumName: "Digital Only IDP",
      feats: [
        "Instant PDF in your inbox — ready in minutes",
        "Accepted across multiple countries",
        "Perfect for last-minute travel",
        "Never lost — always on your phone"
      ]
    },
    physical: {
      img: "IMAGES/printed-international-driving-permit-booklet-card-phone.webp",
      imageTitle: "Printed International Driving Permit booklet, card and phone",
      label: "Print + Digital",
      sumName: "Print + Digital IDP",
      feats: [
        "Printed booklet + pocket ID card shipped to you",
        "Free digital copy included instantly",
        "Globally recognised standard format",
        "Trusted by police & rental desks worldwide"
      ]
    }
  };

  const state = {
    format: "digital",
    validYears: 1,
    validUntil: "2027",
    category: "B",
    country: "Thailand",
  };

  /* ---------- pricing ---------- */
  // base price = digital 79 / physical 99 (already discounted, 23% off shown "was")
  function priceFor(format, years) {
    // Price table — Digital: 49/55/59 · Print+Digital: 79/89/99
    const PRICES = {
      digital:  { 1: 49, 2: 55, 3: 59 },
      physical: { 1: 79, 2: 89, 3: 99 },
    };
    const table = PRICES[format] || PRICES.digital;
    const y = years;
    return table[y] != null ? table[y] : table[3];
  }

  function recalc() {
    const total = priceFor(state.format, state.validYears);
    const was = Math.round(total / 0.77); // reverse the 23% discount for the strikethrough
    const disc = was - total;
    const info = FORMAT_INFO[state.format];

    sumFmt.textContent  = info.sumName;
    sumValid.textContent = `${state.validYears}-year validity · Expires ${state.validUntil}`;
    sumBase.textContent = `$${was}`;
    sumDisc.textContent = `−$${disc}`;

    let grandTotal = total;

    // Travel companion — 20% off the same package, added as a second summary line.
    if (companionAdded) {
      const compPrice = companionPriceFor(state.format, state.validYears);
      const compSavings = total - compPrice;
      const compName = compFirstEl.value.trim() ? `${compFirstEl.value.trim()}'s IDP` : "Travel companion";
      $("[data-sum-comp-name]").textContent = compName;
      $("[data-sum-comp-save]").textContent = `You saved $${compSavings}`;
      $("[data-sum-comp-total]").textContent = `$${compPrice}`;
      sumCompLine.hidden = false;
      grandTotal += compPrice;

      const pkgLabel = `${info.sumName.replace(" IDP", "")}, ${state.validYears}-year`;
      $$("[data-comp-package]").forEach((el) => { el.textContent = pkgLabel; });
    } else {
      sumCompLine.hidden = true;
    }

    sumTotal.textContent = grandTotal;

    // plan card now-prices reflect validity
    $$(".plan").forEach((p) => {
      const fmt = p.dataset.plan;
      const now = priceFor(fmt, state.validYears);
      const w = Math.round(now / 0.77);
      $("[data-now]", p).textContent = `$${now}`;
      $("[data-was-el]", p).textContent = `$${w}`;
    });
  }

  /* ---------- format swap (with image cross-fade) ---------- */
  function setFormat(fmt) {
    state.format = fmt;
    const info = FORMAT_INFO[fmt];

    // image cross-fade
    previewImg.classList.add("swapping");
    setTimeout(() => {
      previewImg.src = info.img;
      previewImg.alt = `Preview of your ${info.label} International Driving Permit`;
      previewImg.title = info.imageTitle;
      previewImg.classList.remove("swapping");
    }, 220);

    fmtLabel.textContent = info.label;

    // feature list
    featsList.innerHTML = info.feats
      .map((f) => `<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/></svg><span>${f}</span></li>`)
      .join("");

    // active states
    $$(".plan").forEach((p) => {
      const on = p.dataset.plan === fmt;
      p.classList.toggle("is-active", on);
      $("input", p).checked = on;
    });

    recalc();
  }

  $$(".plan").forEach((plan) => {
    plan.addEventListener("click", (e) => {
      e.preventDefault();
      setFormat(plan.dataset.plan);
    });
  });

  /* ---------- validity tabs ---------- */
  $$(".valid-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".valid-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.validYears = parseInt(tab.dataset.valid, 10);
      state.validUntil = tab.dataset.year;
      pmValid.textContent = state.validUntil;
      recalc();
    });
  });

  /* ---------- license category (multi-select) -> preview ---------- */
  function refreshCategory() {
    const checked = $$('input[name="category"]:checked').map((c) => c.value).sort();
    state.category = checked.join(", ");
    pmCat.textContent = checked.length ? checked.join(", ") : "—";
  }
  $$('input[name="category"]').forEach((c) => {
    c.addEventListener("change", refreshCategory);
  });
  refreshCategory();

  /* ---------- name -> preview (live typing) ---------- */
  const firstEl = $("#first-name");
  const lastEl  = $("#last-name");

  /* ---------- travel companion ---------- */
  const compInvite   = $("#companion-invite");
  const compPanel    = $("#companion-panel");
  const compAddBtn   = $("#companion-add-btn");
  const compRemoveBtn= $("#companion-remove-btn");
  const compFirstEl  = $("#comp-first-name");
  const compLastEl   = $("#comp-last-name");
  const compEmailEl  = $("#comp-email");
  const compCategoryEl = $("#comp-category");
  const sumCompLine  = $("#sum-companion-line");
  let companionAdded = false;

  function companionPriceFor(format, years) {
    return Math.round(priceFor(format, years) * 0.8);
  }

  compAddBtn.addEventListener("click", () => {
    companionAdded = true;
    compInvite.hidden = true;
    compPanel.hidden = false;
    recalc();
    compFirstEl.focus({ preventScroll: true });
    compPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  compRemoveBtn.addEventListener("click", () => {
    companionAdded = false;
    compPanel.hidden = true;
    compInvite.hidden = false;
    [compFirstEl, compLastEl, compEmailEl].forEach((el) => { el.value = ""; el.classList.remove("invalid"); el.closest(".field")?.classList.remove("show-err"); });
    compCategoryEl.value = "B";
    recalc();
  });

  compFirstEl.addEventListener("input", recalc);
  function updateName() {
    const first = firstEl.value.trim();
    const last  = lastEl.value.trim();
    const full  = [first, last].filter(Boolean).join(" ").toUpperCase();
    if (full) {
      pmName.textContent = full;
      pmName.classList.remove("placeholder");
      pmName.classList.add("typing");
      setTimeout(() => pmName.classList.remove("typing"), 400);
    } else {
      pmName.textContent = "Your name appears here";
      pmName.classList.add("placeholder");
    }
  }
  firstEl.addEventListener("input", updateName);
  lastEl.addEventListener("input", updateName);

  /* ---------- residence country -> preview + phone code ---------- */
  const residenceSel = $("#residence-country");
  const phoneCC = $("#phone-cc");
  let phoneCCManual = false;

  // Changeable country calling-code dropdown (defaults to the customer's country)
  (function buildPhoneCC() {
    if (!phoneCC) return;
    const popularNames = new Set(POPULAR);
    const mkOpt = (c) => {
      const o = document.createElement("option");
      o.value = c.name; o.dataset.dial = c.dial;
      o.textContent = `${c.flag} +${c.dial}`;
      return o;
    };
    const gP = document.createElement("optgroup"); gP.label = "Popular";
    POPULAR.map(byName).filter(Boolean).forEach((c) => gP.appendChild(mkOpt(c)));
    phoneCC.appendChild(gP);
    const gA = document.createElement("optgroup"); gA.label = "All countries";
    COUNTRIES.filter((c) => !popularNames.has(c.name)).forEach((c) => gA.appendChild(mkOpt(c)));
    phoneCC.appendChild(gA);
    phoneCC.addEventListener("change", () => { phoneCCManual = true; });
  })();

  function updateCountry() {
    const c = byName(residenceSel.value);
    if (!c) return;
    state.country = c.name;
    pmCountry.innerHTML = `<span class="pm-flag">${c.flag}</span>${c.name}`;
    pmCountry.classList.add("typing");
    setTimeout(() => pmCountry.classList.remove("typing"), 400);
    // phone code defaults to the customer's country (unless they picked one manually)
    if (phoneCC && !phoneCCManual) phoneCC.value = c.name;
  }
  residenceSel.addEventListener("change", updateCountry);

  /* ---------- validation ---------- */
  function markField(input, ok) {
    const field = input.closest(".field");
    input.classList.toggle("invalid", !ok);
    if (field) field.classList.toggle("show-err", !ok);
    return ok;
  }
  function validate() {
    let ok = true;
    const email = $("#email");
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    ok = markField(email, emailOk) && ok;

    [firstEl, lastEl].forEach((el) => { ok = markField(el, el.value.trim().length > 0) && ok; });

    const phone = $("#phone");
    ok = markField(phone, phone.value.trim().length >= 5) && ok;

    ["dob-month","dob-day","dob-year","birth-country","residence-country"].forEach((id) => {
      const el = $("#" + id);
      ok = markField(el, !!el.value) && ok;
    });

    // Travel companion — only validated if the customer chose to add one.
    if (companionAdded) {
      ok = markField(compFirstEl, compFirstEl.value.trim().length > 0) && ok;
      ok = markField(compLastEl, compLastEl.value.trim().length > 0) && ok;
      const compEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(compEmailEl.value.trim());
      ok = markField(compEmailEl, compEmailOk) && ok;
    }
    return ok;
  }

  // clear error on input/change (change covers <select> dropdowns)
  $$(".input, .select, #phone").forEach((el) => {
    const clear = () => {
      el.classList.remove("invalid");
      el.closest(".field")?.classList.remove("show-err");
    };
    el.addEventListener("input", clear);
    el.addEventListener("change", clear);
  });

  /* ---------- submit ---------- */
  const form = $("#checkout-form");
  const overlay = $("#overlay");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate()) {
      const firstBad = $(".input.invalid, .select.invalid");
      firstBad?.scrollIntoView({ behavior: "smooth", block: "center" });
      firstBad?.focus({ preventScroll: true });
      return;
    }

    const submitBtn = $("#submit-btn");
    if (submitBtn?.disabled) return; // already submitting — ignore repeat clicks
    if (submitBtn) submitBtn.disabled = true;

    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    // Persist a light summary so step 2 can show the order context.
    try {
      const summary = {
        format: state.format,
        validYears: state.validYears,
        validUntil: state.validUntil,
        category: state.category,
        country: state.country,
        firstName: firstEl.value.trim(),
        lastName: lastEl.value.trim(),
        email: $("#email").value.trim(),
        phone: $("#phone").value.trim(),
      };
      sessionStorage.setItem("worldidp_application", JSON.stringify(summary));

      // Travel companion — same trip, same package, their own info + documents.
      if (companionAdded) {
        const companion = {
          firstName: compFirstEl.value.trim(),
          lastName: compLastEl.value.trim(),
          email: compEmailEl.value.trim(),
          category: compCategoryEl.value,
          format: state.format,
          validYears: state.validYears,
          validUntil: state.validUntil,
          country: state.country,
          total: companionPriceFor(state.format, state.validYears),
        };
        sessionStorage.setItem("worldidp_companion", JSON.stringify(companion));
      } else {
        sessionStorage.removeItem("worldidp_companion");
      }
    } catch (err) { /* sessionStorage may be unavailable */ }

    const params = new URLSearchParams();
    params.set("format", state.format);
    params.set("valid", String(state.validYears));
    if (state.country) params.set("country", state.country);
    params.set("person", "1");
    if (companionAdded) params.set("party", "2");
    setTimeout(() => {
      window.location.href = "upload-photos.html?" + params.toString();
    }, 1100);
  });

  /* ---------- header scroll state ---------- */
  const header = $("[data-header]");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- read query params (from homepage eligibility form) ---------- */
  // e.g. checkout.html?destination-country=France&format=physical&valid=3
  const params = new URLSearchParams(location.search);
  const qpFormat = params.get("format");
  const qpValid = parseInt(params.get("valid"), 10);
  const qpDest = params.get("destination-country");
  if (qpDest && byName(qpDest)) {
    residenceSel.value = qpDest;
  }

  /* ---------- init ---------- */
  setFormat(qpFormat === "physical" ? "physical" : "digital");

  // BUG FIX: the pricing page's 1/2/3 Year selection used to never reach
  // this page at all, so this step silently fell back to its own
  // hardcoded 1-year default no matter what the customer picked. Now the
  // year passed in the URL (if any) overrides that default, and the
  // matching tab is highlighted so what's displayed matches what's used.
  if ([1, 2, 3].includes(qpValid)) {
    state.validYears = qpValid;
    const matchingTab = $$(".valid-tab").find((t) => parseInt(t.dataset.valid, 10) === qpValid);
    if (matchingTab) {
      $$(".valid-tab").forEach((t) => t.classList.remove("active"));
      matchingTab.classList.add("active");
      state.validUntil = matchingTab.dataset.year;
    }
    recalc();
  }

  // If the customer chose Digital, hide the Print + Digital upsell (keep validity choice)
  if (qpFormat !== "physical") {
    const physicalPlan = document.querySelector('.plan[data-plan="physical"]');
    if (physicalPlan) physicalPlan.style.display = "none";
    document.querySelector('.plan-grid')?.classList.add('single-plan');
    const fmtHead = document.querySelector('.form-section h2');
    // keep heading; only the plan choice is removed
  }
  updateCountry();
  updateName();
  pmCat.textContent = state.category;
  pmValid.textContent = state.validUntil;
})();
