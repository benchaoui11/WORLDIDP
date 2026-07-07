const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const logoTrack = document.querySelector("[data-logo-track]");
const eligibilityForm = document.querySelector(".eligibility-form");
const eligibilityResult = document.querySelector("[data-eligibility-result]");
const resultText = document.querySelector("[data-result-text]");
const countryCombos = document.querySelectorAll("[data-country-combo]");

const flagEmoji = (code) =>
  code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt()));

const countries = [
  ["Afghanistan", "AF"], ["Albania", "AL"], ["Algeria", "DZ"], ["Andorra", "AD"], ["Angola", "AO"],
  ["Antigua and Barbuda", "AG"], ["Argentina", "AR"], ["Armenia", "AM"], ["Australia", "AU"], ["Austria", "AT"],
  ["Azerbaijan", "AZ"], ["Bahamas", "BS"], ["Bahrain", "BH"], ["Bangladesh", "BD"], ["Barbados", "BB"],
  ["Belarus", "BY"], ["Belgium", "BE"], ["Belize", "BZ"], ["Benin", "BJ"], ["Bhutan", "BT"],
  ["Bolivia", "BO"], ["Bosnia and Herzegovina", "BA"], ["Botswana", "BW"], ["Brazil", "BR"], ["Brunei", "BN"],
  ["Bulgaria", "BG"], ["Burkina Faso", "BF"], ["Burundi", "BI"], ["Cambodia", "KH"], ["Cameroon", "CM"],
  ["Canada", "CA"], ["Cape Verde", "CV"], ["Central African Republic", "CF"], ["Chad", "TD"], ["Chile", "CL"],
  ["China", "CN"], ["Colombia", "CO"], ["Comoros", "KM"], ["Congo", "CG"], ["Costa Rica", "CR"],
  ["Croatia", "HR"], ["Cuba", "CU"], ["Cyprus", "CY"], ["Czech Republic", "CZ"], ["Denmark", "DK"],
  ["Djibouti", "DJ"], ["Dominica", "DM"], ["Dominican Republic", "DO"], ["Ecuador", "EC"], ["Egypt", "EG"],
  ["El Salvador", "SV"], ["Equatorial Guinea", "GQ"], ["Eritrea", "ER"], ["Estonia", "EE"], ["Eswatini", "SZ"],
  ["Ethiopia", "ET"], ["Fiji", "FJ"], ["Finland", "FI"], ["France", "FR"], ["Gabon", "GA"],
  ["Gambia", "GM"], ["Georgia", "GE"], ["Germany", "DE"], ["Ghana", "GH"], ["Greece", "GR"],
  ["Grenada", "GD"], ["Guatemala", "GT"], ["Guinea", "GN"], ["Guinea-Bissau", "GW"], ["Guyana", "GY"],
  ["Haiti", "HT"], ["Honduras", "HN"], ["Hungary", "HU"], ["Iceland", "IS"], ["India", "IN"],
  ["Indonesia", "ID"], ["Iran", "IR"], ["Iraq", "IQ"], ["Ireland", "IE"], ["Israel", "IL"],
  ["Italy", "IT"], ["Jamaica", "JM"], ["Japan", "JP"], ["Jordan", "JO"], ["Kazakhstan", "KZ"],
  ["Kenya", "KE"], ["Kiribati", "KI"], ["Kuwait", "KW"], ["Kyrgyzstan", "KG"], ["Laos", "LA"],
  ["Latvia", "LV"], ["Lebanon", "LB"], ["Lesotho", "LS"], ["Liberia", "LR"], ["Libya", "LY"],
  ["Liechtenstein", "LI"], ["Lithuania", "LT"], ["Luxembourg", "LU"], ["Madagascar", "MG"], ["Malawi", "MW"],
  ["Malaysia", "MY"], ["Maldives", "MV"], ["Mali", "ML"], ["Malta", "MT"], ["Marshall Islands", "MH"],
  ["Mauritania", "MR"], ["Mauritius", "MU"], ["Mexico", "MX"], ["Micronesia", "FM"], ["Moldova", "MD"],
  ["Monaco", "MC"], ["Mongolia", "MN"], ["Montenegro", "ME"], ["Morocco", "MA"], ["Mozambique", "MZ"],
  ["Myanmar", "MM"], ["Namibia", "NA"], ["Nauru", "NR"], ["Nepal", "NP"], ["Netherlands", "NL"],
  ["New Zealand", "NZ"], ["Nicaragua", "NI"], ["Niger", "NE"], ["Nigeria", "NG"], ["North Macedonia", "MK"],
  ["Norway", "NO"], ["Oman", "OM"], ["Pakistan", "PK"], ["Palau", "PW"], ["Palestine", "PS"],
  ["Panama", "PA"], ["Papua New Guinea", "PG"], ["Paraguay", "PY"], ["Peru", "PE"], ["Philippines", "PH"],
  ["Poland", "PL"], ["Portugal", "PT"], ["Qatar", "QA"], ["Romania", "RO"], ["Russia", "RU"],
  ["Rwanda", "RW"], ["Saint Kitts and Nevis", "KN"], ["Saint Lucia", "LC"], ["Saint Vincent and the Grenadines", "VC"],
  ["Samoa", "WS"], ["San Marino", "SM"], ["Sao Tome and Principe", "ST"], ["Saudi Arabia", "SA"], ["Senegal", "SN"],
  ["Serbia", "RS"], ["Seychelles", "SC"], ["Sierra Leone", "SL"], ["Singapore", "SG"], ["Slovakia", "SK"],
  ["Slovenia", "SI"], ["Solomon Islands", "SB"], ["Somalia", "SO"], ["South Africa", "ZA"], ["South Korea", "KR"],
  ["South Sudan", "SS"], ["Spain", "ES"], ["Sri Lanka", "LK"], ["Sudan", "SD"], ["Suriname", "SR"],
  ["Sweden", "SE"], ["Switzerland", "CH"], ["Syria", "SY"], ["Taiwan", "TW"], ["Tajikistan", "TJ"],
  ["Tanzania", "TZ"], ["Thailand", "TH"], ["Timor-Leste", "TL"], ["Togo", "TG"], ["Tonga", "TO"],
  ["Trinidad and Tobago", "TT"], ["Tunisia", "TN"], ["Turkey", "TR"], ["Turkmenistan", "TM"], ["Tuvalu", "TV"],
  ["Uganda", "UG"], ["Ukraine", "UA"], ["United Arab Emirates", "AE"], ["United Kingdom", "GB"], ["United States", "US"],
  ["Uruguay", "UY"], ["Uzbekistan", "UZ"], ["Vanuatu", "VU"], ["Vatican City", "VA"], ["Venezuela", "VE"],
  ["Vietnam", "VN"], ["Yemen", "YE"], ["Zambia", "ZM"], ["Zimbabwe", "ZW"]
].map(([name, code]) => ({ name, code, flag: flagEmoji(code) }));

const issuedPriority = [
  "United States", "United Kingdom", "Canada", "Australia", "India", "Germany", "France", "Spain",
  "Italy", "Netherlands", "United Arab Emirates", "Saudi Arabia", "Morocco", "Thailand", "Portugal", "Brazil"
];

const destinationPriority = [
  { name: "Thailand", code: "TH" },
  { name: "Indonesia (Bali)", code: "ID", value: "Indonesia" },
  { name: "Philippines", code: "PH" },
  { name: "Portugal", code: "PT" },
  { name: "Spain", code: "ES" },
  { name: "United Kingdom", code: "GB" },
  { name: "Turkey", code: "TR" },
  { name: "Malaysia", code: "MY" },
  { name: "France", code: "FR" },
  { name: "Greece", code: "GR" },
  { name: "United Arab Emirates", code: "AE" },
  { name: "United States", code: "US" },
  { name: "Italy", code: "IT" },
  { name: "Saudi Arabia", code: "SA" },
  { name: "Japan", code: "JP" },
  { name: "Morocco", code: "MA" }
].map((country) => ({ ...country, flag: flagEmoji(country.code) }));

const updateHeader = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 16);
};

const closeNav = () => {
  header?.classList.remove("nav-open");
  navToggle?.setAttribute("aria-expanded", "false");
};

navToggle?.addEventListener("click", () => {
  const isOpen = header?.classList.toggle("nav-open");
  navToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
});

document.querySelectorAll(".primary-nav a, .header-actions a").forEach((link) => {
  link.addEventListener("click", closeNav);
});

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

const closeCountryCombos = (exceptCombo) => {
  countryCombos.forEach((combo) => {
    if (combo !== exceptCombo) combo.classList.remove("is-open");
  });
};

const buildCountryOptions = (kind) => {
  const priorityNames = kind === "destination" ? destinationPriority.map((item) => item.value || item.name) : issuedPriority;
  const popular =
    kind === "destination"
      ? destinationPriority
      : issuedPriority
          .map((name) => countries.find((country) => country.name === name))
          .filter(Boolean);

  const rest = countries.filter((country) => !priorityNames.includes(country.name));
  return { popular, rest };
};

const renderCountryList = (combo, query = "") => {
  const list = combo.querySelector("[data-country-list]");
  const kind = combo.dataset.kind;
  const { popular, rest } = buildCountryOptions(kind);
  const normalizedQuery = query.trim().toLowerCase();
  const matches = (country) =>
    country.name.toLowerCase().includes(normalizedQuery) ||
    (country.value || "").toLowerCase().includes(normalizedQuery) ||
    country.code.toLowerCase().includes(normalizedQuery);

  const groups = normalizedQuery
    ? [{ label: "Matching countries", items: [...popular, ...rest].filter(matches) }]
    : [
        { label: kind === "destination" ? "Popular destinations" : "Most used issuing countries", items: popular },
        { label: "All countries", items: rest }
      ];

  list.innerHTML = "";
  groups.forEach((group) => {
    const items = group.items.filter(matches);
    if (!items.length) return;

    const title = document.createElement("div");
    title.className = "country-group-title";
    title.textContent = group.label;
    list.append(title);

    items.forEach((country) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "country-option";
      option.dataset.value = country.value || country.name;
      option.dataset.name = country.name;
      option.dataset.flag = country.flag;
      option.innerHTML = `<span class="country-flag" aria-hidden="true">${country.flag}</span><span>${country.name}</span>`;
      list.append(option);
    });
  });

  if (!list.children.length) {
    const empty = document.createElement("div");
    empty.className = "country-empty";
    empty.textContent = "No country found";
    list.append(empty);
  }
};

countryCombos.forEach((combo) => {
  const hiddenInput = combo.querySelector("input[type='hidden']");
  const defaultName = combo.dataset.default;
  const defaultCountry =
    [...destinationPriority, ...countries].find((country) => country.name === defaultName || country.value === defaultName) ||
    countries[0];

  combo.insertAdjacentHTML(
    "beforeend",
    `<button class="country-trigger" type="button" aria-haspopup="true" aria-expanded="false">
      <span class="country-trigger-icon" aria-hidden="true">${defaultCountry.flag}</span>
      <span class="country-trigger-text">${defaultCountry.name}</span>
      <span class="country-trigger-arrow" aria-hidden="true"></span>
    </button>
    <div class="country-menu">
      <div class="country-search-wrap">
        <input class="country-search" type="search" aria-label="Search countries" placeholder="${combo.dataset.placeholder}" autocomplete="off" />
      </div>
      <div class="country-list" data-country-list></div>
    </div>`
  );

  hiddenInput.value = defaultCountry.value || defaultCountry.name;
  renderCountryList(combo);

  const trigger = combo.querySelector(".country-trigger");
  const search = combo.querySelector(".country-search");
  const triggerIcon = combo.querySelector(".country-trigger-icon");
  const triggerText = combo.querySelector(".country-trigger-text");

  trigger.addEventListener("click", () => {
    const willOpen = !combo.classList.contains("is-open");
    closeCountryCombos(combo);
    combo.classList.toggle("is-open", willOpen);
    trigger.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) {
      search.value = "";
      renderCountryList(combo);
      window.setTimeout(() => search.focus(), 40);
    }
  });

  search.addEventListener("input", () => renderCountryList(combo, search.value));

  combo.addEventListener("click", (event) => {
    const option = event.target.closest(".country-option");
    if (!option) return;
    hiddenInput.value = option.dataset.value;
    triggerIcon.textContent = option.dataset.flag;
    triggerText.textContent = option.dataset.name;
    eligibilityResult?.classList.remove("is-visible");
    eligibilityForm?.querySelector(".btn-apply")?.classList.remove("is-success");
    const applyText = eligibilityForm?.querySelector("[data-apply-text]");
    if (applyText) applyText.textContent = "Check My Route";
    combo.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus();
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-country-combo]")) closeCountryCombos();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeCountryCombos();
});

eligibilityForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const button = eligibilityForm.querySelector(".btn-apply");
  const text = eligibilityForm.querySelector("[data-apply-text]");
  if (!button || !text) return;

  const issued = document.querySelector('[data-kind="issued"] .country-trigger-text')?.textContent || "your country";
  const destination = document.querySelector('[data-kind="destination"] .country-trigger-text')?.textContent || "your destination";
  const printedRequired = new Set(["Japan", "China", "France", "Morocco", "Oman", "Saudi Arabia"]);

  // If eligibility already confirmed, this click continues to checkout.
  if (button.classList.contains("is-success")) {
    const params = new URLSearchParams();
    if (destination && destination !== "your destination") params.set("destination-country", destination);
    if (issued && issued !== "your country") params.set("issued-country", issued);
    if (printedRequired.has(destination)) params.set("format", "physical");
    window.location.href = "checkout.html" + (params.toString() ? "?" + params.toString() : "");
    return;
  }

  button.classList.remove("is-success");
  button.classList.add("is-submitted");
  text.textContent = "Checking your route...";
  eligibilityResult?.classList.remove("is-visible");

  window.setTimeout(() => {
    text.textContent = "Continue Application";
    button.classList.remove("is-submitted");
    button.classList.add("is-success");
    if (resultText) {
      resultText.textContent = printedRequired.has(destination)
        ? `You're all set for ${destination}. ${destination} requires a printed IDP — choose Print + Digital.`
        : `You're all set for ${destination}. Digital is enough — ready in minutes.`;
    }
    eligibilityResult?.classList.add("is-visible");
  }, 1600);
});

if (logoTrack) {
  const originalTiles = Array.from(logoTrack.children);
  originalTiles.forEach((tile) => logoTrack.append(tile.cloneNode(true)));

  let activeIndex = 0;

  const getStep = () => {
    const firstTile = logoTrack.querySelector(".logo-tile");
    if (!firstTile) return 0;
    const styles = window.getComputedStyle(logoTrack);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0");
    return firstTile.getBoundingClientRect().width + gap;
  };

  const moveSlider = () => {
    const step = getStep();
    if (!step) return;

    activeIndex += 1;
    logoTrack.style.transform = `translateX(${-activeIndex * step}px)`;

    if (activeIndex >= originalTiles.length) {
      window.setTimeout(() => {
        logoTrack.style.transition = "none";
        activeIndex = 0;
        logoTrack.style.transform = "translateX(0)";
        logoTrack.offsetHeight;
        logoTrack.style.transition = "";
      }, 650);
    }
  };

  window.setInterval(moveSlider, 2400);
  window.addEventListener("resize", () => {
    logoTrack.style.transition = "none";
    logoTrack.style.transform = `translateX(${-activeIndex * getStep()}px)`;
    logoTrack.offsetHeight;
    logoTrack.style.transition = "";
  });
}

/* ============================================================
   Advantage "Route Cluster" — draws SVG connectors from the
   steering-wheel hub to each waypoint, recomputed on resize so
   the lines always land precisely on the icons at any width.
   ============================================================ */
(function () {
  const map = document.getElementById("advantageMap");
  if (!map) return;

  const svg = map.querySelector(".advantage-routes");
  const hub = map.querySelector(".advantage-center");
  const items = Array.from(map.querySelectorAll(".advantage-item"));
  if (!svg || !hub || !items.length) return;

  const NS = "http://www.w3.org/2000/svg";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    const b = map.getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
  }

  function draw() {
    const W = map.clientWidth;
    const H = map.clientHeight;
    if (!W || !H) return;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = "";

    const hc = centerOf(hub);
    const hubR = Math.min(hub.offsetWidth, hub.offsetHeight) / 2 - 44;

    items.forEach((item, i) => {
      const icon = item.querySelector(".advantage-icon");
      if (!icon) return;
      const ic = centerOf(icon);

      const ang = Math.atan2(ic.y - hc.y, ic.x - hc.x);
      const sx = hc.x + Math.cos(ang) * hubR;
      const sy = hc.y + Math.sin(ang) * hubR;
      const iconR = icon.offsetWidth / 2 + 7;
      const ex = ic.x - Math.cos(ang) * iconR;
      const ey = ic.y - Math.sin(ang) * iconR;

      // leave the hub radially, then ease into a horizontal approach
      const c1x = sx + (ex - sx) * 0.42;
      const c1y = sy + (ey - sy) * 0.08;
      const c2x = sx + (ex - sx) * 0.62;
      const c2y = ey;
      const d =
        `M ${sx.toFixed(1)} ${sy.toFixed(1)} ` +
        `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ` +
        `${c2x.toFixed(1)} ${c2y.toFixed(1)}, ` +
        `${ex.toFixed(1)} ${ey.toFixed(1)}`;

      const casing = document.createElementNS(NS, "path");
      casing.setAttribute("d", d);
      casing.setAttribute("class", "route-casing");
      svg.appendChild(casing);

      const line = document.createElementNS(NS, "path");
      line.setAttribute("d", d);
      line.setAttribute("class", "route-line");
      svg.appendChild(line);

      if (!reduce) {
        const flow = document.createElementNS(NS, "path");
        flow.setAttribute("d", d);
        flow.setAttribute("class", "route-flow");
        flow.setAttribute("pathLength", "100");
        flow.style.animationDelay = (i * 0.4).toFixed(2) + "s";
        svg.appendChild(flow);
      }

      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", ex.toFixed(1));
      dot.setAttribute("cy", ey.toFixed(1));
      dot.setAttribute("r", "3.6");
      dot.setAttribute("class", "route-dot");
      svg.appendChild(dot);
    });
  }

  let frame;
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }

  let revealed = false;
  function maybeReveal() {
    if (revealed) return;
    const r = map.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < vh * 0.85 && r.bottom > 0) {
      revealed = true;
      map.classList.add("is-revealed");
      draw();
    }
  }

  window.addEventListener("scroll", maybeReveal, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(schedule);
  }
  maybeReveal();
  setTimeout(() => {
    maybeReveal();
    draw();
  }, 400);
})();

/* ============================================================
   Pricing validity toggle — slides the thumb and updates the
   "valid through" date on both plan cards.
   ============================================================ */
(function () {
  const toggle = document.querySelector(".validity-toggle");
  if (!toggle) return;
  const opts = Array.from(toggle.querySelectorAll(".validity-opt"));
  const validEls = Array.from(document.querySelectorAll(".pc-valid [data-valid]"));
  const cards = Array.from(document.querySelectorAll(".price-card"));

  // Price table — Digital: 49/55/59 · Print+Digital: 79/89/99
  const PRICES = {
    digital:  { 1: 49, 2: 55, 3: 59 },
    physical: { 1: 79, 2: 89, 3: 99 },
  };
  const wasOf = (n) => Math.round(n / 0.77);

  function cardFormat(card) {
    if (card.dataset.format) return card.dataset.format;
    const href = (card.querySelector(".pc-cta") || {}).getAttribute
      ? card.querySelector(".pc-cta").getAttribute("href") || ""
      : "";
    return /physical/.test(href) ? "physical" : "digital";
  }

  function setPrices(years) {
    cards.forEach((card) => {
      const table = PRICES[cardFormat(card)] || PRICES.digital;
      const now = table[years] != null ? table[years] : table[3];
      const a = card.querySelector(".pc-amount");
      const w = card.querySelector(".pc-was");
      if (a) a.textContent = `$${now}`;
      if (w) w.textContent = `$${wasOf(now)}`;
    });
  }

  function select(idx) {
    opts.forEach((o, i) => {
      const active = i === idx;
      o.classList.toggle("is-active", active);
      o.setAttribute("aria-selected", active ? "true" : "false");
    });
    toggle.style.setProperty("--i", idx);
    const opt = opts[idx];
    const label = `${opt.dataset.month} ${opt.dataset.expiry}`;
    validEls.forEach((el) => (el.textContent = label));
    const years = parseInt(opt.dataset.years, 10) || (idx + 1);
    setPrices(years);
  }

  opts.forEach((opt, i) => opt.addEventListener("click", () => select(i)));
  select(0);
})();

/* ============================================================
   Pricing cards reveal — adds .is-revealed when in view to
   trigger entrance, glow, floating images and drawing checks.
   ============================================================ */
(function () {
  const cards = Array.from(document.querySelectorAll(".price-card.pc-reveal"));
  if (!cards.length) return;

  function check() {
    const vh = window.innerHeight || document.documentElement.clientHeight;
    let done = true;
    cards.forEach((c) => {
      if (c.classList.contains("is-revealed")) return;
      const r = c.getBoundingClientRect();
      if (r.top < vh * 0.86 && r.bottom > 0) {
        c.classList.add("is-revealed");
      } else {
        done = false;
      }
    });
    if (done) window.removeEventListener("scroll", check);
  }

  window.addEventListener("scroll", check, { passive: true });
  window.addEventListener("resize", check, { passive: true });
  check();
  setTimeout(check, 400);
})();

/* ============================================================
   Reviews — reveal trust badge + animated count-up.
   ============================================================ */
(function () {
  const section = document.getElementById("reviews");
  if (!section) return;
  const countEl = section.querySelector("[data-count]");
  const target = countEl ? parseInt(countEl.dataset.count, 10) : 0;
  let started = false;

  function fmt(n) {
    return n.toLocaleString("en-US");
  }

  function run() {
    if (started) return;
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < vh * 0.82 && r.bottom > 0) {
      started = true;
      section.classList.add("is-revealed");
      if (countEl && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const dur = 1400;
        const t0 = performance.now();
        const tick = (now) => {
          const p = Math.min((now - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          countEl.textContent = fmt(Math.floor(eased * target));
          if (p < 1) requestAnimationFrame(tick);
          else countEl.textContent = fmt(target);
        };
        requestAnimationFrame(tick);
      }
      window.removeEventListener("scroll", run);
    }
  }

  window.addEventListener("scroll", run, { passive: true });
  run();
  setTimeout(run, 400);
})();

/* ============================================================
   Countries & Coverage — search + region filter, reveal,
   and animated stat count-up.
   ============================================================ */
(function () {
  const section = document.getElementById("countries");
  if (!section) return;
  const grid = document.getElementById("countriesGrid");
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll(".country-card"));
  const search = document.getElementById("countrySearch");
  const chips = Array.from(section.querySelectorAll(".region-chip"));
  const countEl = document.getElementById("countryCount");
  const emptyEl = document.getElementById("countriesEmpty");
  let region = "popular";

  function apply() {
    const q = (search.value || "").trim().toLowerCase();
    let shown = 0;
    cards.forEach((c) => {
      const hay = c.dataset.name + " " + (c.dataset.keywords || "");
      let okR;
      if (q) okR = true;                                   // searching looks across all countries
      else if (region === "popular") okR = c.dataset.popular === "true";
      else if (region === "all") okR = true;
      else okR = c.dataset.region === region;
      let okQ;
      if (!q) okQ = true;
      else if (q.includes(" ")) okQ = hay.includes(q);
      else okQ = hay.split(/\s+/).some((w) => w.startsWith(q));
      const vis = okR && okQ;
      c.style.display = vis ? "" : "none";
      if (vis) shown++;
    });
    if (countEl) countEl.textContent = shown;
    if (emptyEl) emptyEl.hidden = shown !== 0;
  }

  search.addEventListener("input", apply);
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => {
        c.classList.toggle("is-active", c === chip);
        c.setAttribute("aria-pressed", c === chip ? "true" : "false");
      });
      region = chip.dataset.region;
      apply();
    });
  });

  apply(); // initialise the Popular view on load

  /* reveal + count-up */
  const countEls = Array.from(section.querySelectorAll(".cstat b[data-count]"));
  let started = false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function run() {
    if (started) return;
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < vh * 0.82 && r.bottom > 0) {
      started = true;
      section.classList.add("is-revealed");
      countEls.forEach((el) => {
        const target = parseInt(el.dataset.count, 10);
        if (reduce) { el.textContent = target + "+"; return; }
        const t0 = performance.now(), dur = 1300;
        const tick = (now) => {
          const p = Math.min((now - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.floor(eased * target) + "+";
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = target + "+";
        };
        requestAnimationFrame(tick);
      });
      window.removeEventListener("scroll", run);
    }
  }
  window.addEventListener("scroll", run, { passive: true });
  run();
  setTimeout(run, 400);
})();

/* ============================================================
   FAQ — accordion + topic filter + live search + reveal
   ============================================================ */
(function () {
  const section = document.getElementById("faq");
  if (!section) return;
  const items = Array.from(section.querySelectorAll(".faq-item"));
  const cats = Array.from(section.querySelectorAll(".faq-cat"));
  const search = document.getElementById("faqSearch");
  const empty = document.getElementById("faqEmpty");
  let activeCat = "basics";

  /* accordion (independent toggle) */
  items.forEach((it) => {
    const btn = it.querySelector(".faq-q");
    btn.addEventListener("click", () => {
      const open = it.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  function setOpen(it, open) {
    it.classList.toggle("is-open", open);
    it.querySelector(".faq-q").setAttribute("aria-expanded", open ? "true" : "false");
  }

  function apply(openFirst) {
    const q = (search.value || "").trim().toLowerCase();
    const searching = q.length > 0;

    /* category highlight: cleared while searching (results span topics) */
    cats.forEach((x) => {
      const on = !searching && x.dataset.cat === activeCat;
      x.classList.toggle("is-active", on);
      x.setAttribute("aria-selected", on ? "true" : "false");
    });

    let shown = 0;
    let firstVisible = null;
    items.forEach((it) => {
      const okC = searching ? true : it.dataset.cat === activeCat;
      let okQ = true;
      if (searching) {
        const hay =
          (it.dataset.q || "") +
          " " +
          it.querySelector(".faq-q-text").textContent.toLowerCase() +
          " " +
          it.querySelector(".faq-a").textContent.toLowerCase();
        okQ = hay.includes(q);
      }
      const vis = okC && okQ;
      it.style.display = vis ? "" : "none";
      if (!vis) setOpen(it, false);
      if (vis) {
        shown++;
        if (!firstVisible) firstVisible = it;
      }
    });

    /* when switching topic, open the first question so the panel never looks bare */
    if (openFirst && !searching && firstVisible) {
      items.forEach((it) => setOpen(it, it === firstVisible));
    }

    if (empty) {
      empty.hidden = shown !== 0;
      const s = empty.querySelector("span");
      if (s) s.textContent = q;
    }
  }

  cats.forEach((c) => {
    c.addEventListener("click", () => {
      activeCat = c.dataset.cat;
      if (search.value) search.value = "";
      apply(true);
    });
  });

  search.addEventListener("input", () => apply(false));

  apply(false);

  /* one-time reveal */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            section.classList.add("is-revealed");
            io.disconnect();
          }
        });
      },
      { threshold: 0.12 }
    );
    io.observe(section);
  } else {
    section.classList.add("is-revealed");
  }
})();

/* ============================================================
   Hero journey route — pause the SVG marker motion for
   visitors who prefer reduced motion.
   ============================================================ */
(function () {
  if (!window.matchMedia) return;
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const route = document.querySelector(".hero-route");
  if (route && typeof route.pauseAnimations === "function") route.pauseAnimations();
  const marker = document.querySelector(".hr-marker");
  if (marker) marker.style.display = "none";
})();

/* ============================================================
   Country cards & footer CTA -> route to checkout, passing the
   chosen destination country so the application pre-fills it.
   ============================================================ */
(function () {
  try {
  // Canonical country names accepted by the checkout dropdown.
  const CANON = [
    "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan",
    "Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
    "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Cambodia","Cameroon","Canada","Cape Verde",
    "Chad","Chile","China","Colombia","Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark",
    "Dominican Republic","Ecuador","Egypt","El Salvador","Estonia","Ethiopia","Fiji","Finland","France","Gabon",
    "Georgia","Germany","Ghana","Greece","Guatemala","Guyana","Haiti","Honduras","Hungary","Iceland",
    "India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan",
    "Kazakhstan","Kenya","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Libya","Liechtenstein","Lithuania",
    "Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Mauritius","Mexico","Moldova",
    "Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nepal","Netherlands","New Zealand",
    "Nicaragua","Niger","Nigeria","North Macedonia","Norway","Oman","Pakistan","Palestine","Panama","Papua New Guinea",
    "Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saudi Arabia",
    "Senegal","Serbia","Seychelles","Singapore","Slovakia","Slovenia","Somalia","South Africa","South Korea","Spain",
    "Sri Lanka","Sudan","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Togo",
    "Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay",
    "Uzbekistan","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
  ];
  const lower = new Map(CANON.map((n) => [n.toLowerCase(), n]));

  function resolveName(raw) {
    if (!raw) return "";
    const key = raw.trim().toLowerCase();
    if (lower.has(key)) return lower.get(key);
    // light fallbacks for slug variants
    if (key === "uae") return "United Arab Emirates";
    if (key === "usa" || key === "us") return "United States";
    if (key === "uk") return "United Kingdom";
    return "";
  }

  document.querySelectorAll(".country-card").forEach((card) => {
    const name = resolveName(card.dataset.name || card.dataset.slug);
    const href = name
      ? "checkout.html?destination-country=" + encodeURIComponent(name)
      : "checkout.html";
    card.setAttribute("href", href);
  });

  // Countries page flag links: <a href="checkout.html"><span class="co-fl">🇫🇷</span>France</a>
  document.querySelectorAll('a > .co-fl').forEach((flag) => {
    const link = flag.closest("a");
    if (!link) return;
    // textContent includes the flag emoji; strip non-letters from the start.
    const raw = (link.textContent || "").replace(/[^A-Za-z\u00C0-\u024F ]/g, " ").trim();
    const name = resolveName(raw);
    if (name) {
      link.setAttribute("href", "checkout.html?destination-country=" + encodeURIComponent(name));
    }
  });

  // Footer "Start application" CTA and any remaining #apply anchors.
  document.querySelectorAll('a[href="#apply"]').forEach((a) => {
    a.setAttribute("href", "checkout.html");
  });
  } catch (e) { /* non-critical: routing enrichment only */ }
})();
