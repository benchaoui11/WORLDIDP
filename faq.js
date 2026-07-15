/* ============================================================
   FirstIDP — FAQ page interactions
   Scoped so it never clashes with script.js. Uses .fq- ids/classes
   only, and the shared script.js FAQ block (#faq) is absent here,
   so this file owns all FAQ behaviour on this page.
   ============================================================ */
(function () {
  "use strict";

  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const page = document.querySelector(".fq-page");
  if (!page) return;

  const items = Array.from(document.querySelectorAll(".fq-item"));
  const blocks = Array.from(document.querySelectorAll(".fq-cat-block"));
  const featured = document.querySelector("[data-featured]");
  const spine = document.querySelector("[data-spine]");
  const empty = document.querySelector("[data-empty]");
  const emptyTerm = document.querySelector("[data-empty-term]");

  /* ---- cache each item's question text (for highlight restore) ---- */
  items.forEach((it) => {
    const qEl = it.querySelector(".fq-q-text");
    it._qText = qEl ? qEl.textContent : "";
    it._hay = (
      (it.getAttribute("data-q") || "") +
      " " +
      it._qText +
      " " +
      (it.querySelector(".fq-a") ? it.querySelector(".fq-a").textContent : "")
    ).toLowerCase();
  });

  /* ---- accordion -------------------------------------------------- */
  function setOpen(item, open) {
    item.classList.toggle("is-open", open);
    const btn = item.querySelector(".fq-q");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  items.forEach((it) => {
    const btn = it.querySelector(".fq-q");
    if (!btn) return;
    btn.addEventListener("click", () => setOpen(it, !it.classList.contains("is-open")));
  });

  /* ---- live search ------------------------------------------------ */
  const wrap = document.querySelector("[data-search]");
  const input = document.getElementById("fqSearch");
  const clearBtn = document.querySelector("[data-clear]");
  const goBtn = document.querySelector("[data-go]");
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function highlight(item, tokens) {
    const qEl = item.querySelector(".fq-q-text");
    if (!qEl) return;
    if (!tokens.length) {
      qEl.textContent = item._qText;
      return;
    }
    const rx = new RegExp("(" + tokens.map(esc).join("|") + ")", "gi");
    qEl.innerHTML = item._qText.replace(/[&<>]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])
    ).replace(rx, "<mark>$1</mark>");
  }

  function runSearch(raw) {
    const q = (raw || "").trim().toLowerCase();
    const tokens = q ? q.split(/\s+/) : [];
    const searching = tokens.length > 0;

    page.classList.toggle("fq-searching", searching);
    if (wrap) wrap.classList.toggle("has-text", !!q);
    if (featured) featured.hidden = searching;
    if (spine) spine.hidden = searching;

    let total = 0;

    items.forEach((it) => {
      const hit = !searching || tokens.every((t) => it._hay.indexOf(t) !== -1);
      it.hidden = !hit;
      if (hit) {
        total++;
        highlight(it, searching ? tokens : []);
        // reveal answers automatically while searching so results are readable
        if (searching) setOpen(it, true);
      }
    });

    // hide category blocks that ended up empty
    blocks.forEach((b) => {
      const visible = b.querySelectorAll(".fq-item:not([hidden])").length;
      b.hidden = searching && visible === 0;
    });

    // when search cleared, restore the default open-first state
    if (!searching) {
      items.forEach((it, i) => setOpen(it, i === 0));
    }

    if (empty) empty.classList.toggle("is-shown", searching && total === 0);
    if (emptyTerm) emptyTerm.textContent = raw;
  }

  let t;
  if (input) {
    input.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => runSearch(input.value), 110);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        input.value = "";
        runSearch("");
        input.blur();
      }
    });
  }
  if (clearBtn)
    clearBtn.addEventListener("click", () => {
      input.value = "";
      runSearch("");
      input.focus();
    });
  if (goBtn)
    goBtn.addEventListener("click", () => {
      runSearch(input.value);
      const first = items.find((it) => !it.hidden);
      if (first && input.value.trim()) {
        first.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      }
    });

  document.querySelectorAll("[data-suggest]").forEach((b) => {
    b.addEventListener("click", () => {
      input.value = b.getAttribute("data-suggest");
      runSearch(input.value);
      const target = document.querySelector(".fq-body");
      if (target) target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  });

  /* ---- featured "most asked" cards -------------------------------- */
  function openAndFlash(id) {
    if (input && input.value) {
      input.value = "";
      runSearch("");
    }
    const target = document.getElementById(id);
    if (!target) return;
    items.forEach((it) => setOpen(it, it === target));
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    target.classList.add("fq-flash");
    setTimeout(() => target.classList.remove("fq-flash"), 1400);
  }
  document.querySelectorAll(".fq-pop[data-target]").forEach((card) => {
    card.addEventListener("click", () => openAndFlash(card.getAttribute("data-target")));
  });

  /* ---- sticky bar + jump links ------------------------------------ */
  const sticky = document.querySelector("[data-sticky]");
  const hero = document.querySelector(".fq-hero");
  const jumps = Array.from(document.querySelectorAll(".fq-jump"));

  if (sticky && hero) {
    const onScroll = () => {
      const past = hero.getBoundingClientRect().bottom < 90;
      sticky.classList.toggle("is-shown", past);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  jumps.forEach((j) => {
    j.addEventListener("click", () => {
      const sec = document.getElementById(j.getAttribute("data-jump"));
      if (!sec) return;
      if (sec.hidden) {
        if (input) {
          input.value = "";
          runSearch("");
        }
      }
      sec.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  });

  // active jump highlighting
  const sections = [...blocks, document.getElementById("countries")].filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const id = e.target.id;
          jumps.forEach((j) => j.classList.toggle("is-active", j.getAttribute("data-jump") === id));
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((s) => io.observe(s));
  }

  /* ---- glowing route spine progress ------------------------------- */
  const journey = document.querySelector(".fq-journey");
  if (spine && journey && !reduce) {
    const updateSpine = () => {
      if (spine.hidden) return;
      const r = journey.getBoundingClientRect();
      const mid = window.innerHeight * 0.5;
      const pct = Math.max(0, Math.min(1, (mid - r.top) / r.height));
      spine.style.setProperty("--fill", (pct * 100).toFixed(2) + "%");
    };
    window.addEventListener("scroll", updateSpine, { passive: true });
    window.addEventListener("resize", updateSpine, { passive: true });
    updateSpine();
  }

  /* ---- scroll reveal ---------------------------------------------- */
  const reveals = Array.from(document.querySelectorAll(".fq-reveal"));
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-in"));
  } else {
    const ro = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const sibs = Array.from(e.target.parentElement.children).filter((c) =>
            c.classList.contains("fq-reveal")
          );
          const i = Math.max(0, sibs.indexOf(e.target));
          e.target.style.transitionDelay = Math.min(i * 60, 300) + "ms";
          e.target.classList.add("is-in");
          obs.unobserve(e.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    reveals.forEach((el) => ro.observe(el));
  }

  /* ---- country grid ----------------------------------------------- */
  const ANSWERS = {
    thailand: ["🇹🇭 Thailand", "Recognized — and Thailand drives on the left. Police road-checks and rental desks routinely ask foreign drivers for an IDP, so carry it with your national license and passport whether you're renting a car or a scooter (your license must already cover the vehicle)."],
    italy: ["🇮🇹 Italy", "Recognized. Non-EU visitors are expected to carry an IDP alongside their national license, and rental companies in Italy commonly ask for it. EU/EEA licenses don't strictly need one, but it still smooths any roadside check."],
    uae: ["🇦🇪 UAE / Dubai", "Recognized. Tourists renting a car in Dubai or anywhere in the UAE are widely asked to show an IDP together with their home license and passport. It's one of the most-requested destinations for exactly that reason."],
    japan: ["🇯🇵 Japan", "Recognized — Japan drives on the left and most visitors need a 1949-convention IDP to drive or rent. Carry it with your passport and national license. A few nationalities use an official Japanese translation instead, so confirm your country's rule before you go."],
    vietnam: ["🇻🇳 Vietnam", "Recognized for IDP holders under the 1968 convention, carried with your national license. If you plan to ride a motorbike, make sure your home license includes that category before you rent."],
    spain: ["🇪🇸 Spain", "Recognized. Non-EU visitors should carry an IDP with their national license; rental agencies frequently request it. EU/EEA license holders can drive without one."],
    usa: ["🇺🇸 United States", "Recognized. Visitors can often drive on a valid foreign license, but an IDP translates it into a format police and rental companies read instantly — which is why most US rental desks recommend or request one, especially for non-English licenses."],
    uk: ["🇬🇧 United Kingdom", "Recognized — and the UK drives on the left. Short visits are usually fine on your national license, while an IDP translates a non-English license for police and rental staff and removes any doubt at the counter."],
    europe: ["🇪🇺 Europe (Schengen)", "Recognized across the EU. For a non-EU license an IDP is widely required or requested, and a single IDP carries you across borders throughout the Schengen area — handy for multi-country road trips."],
    france: ["🇫🇷 France", "Recognized. Non-EU visitors should carry an IDP with their national license; it's useful at rentals and any roadside check. EU/EEA licenses are accepted on their own."],
    greece: ["🇬🇷 Greece", "Recognized. Non-EU visitors are expected to hold an IDP, and rental agencies — including the island car and ATV desks — commonly require it alongside your license."],
    turkey: ["🇹🇷 Turkey", "Recognized. Carry your IDP with your national license; rental companies regularly ask for it, and it makes any traffic stop straightforward."],
    portugal: ["🇵🇹 Portugal", "Recognized. Non-EU visitors should carry an IDP with their national license; it's accepted at rentals and checks. EU/EEA licenses don't require one."],
    indonesia: ["🇮🇩 Indonesia / Bali", "Recognized — and traffic drives on the left. Police checks in Bali frequently ask tourists for an IDP, so it's strongly recommended for both cars and scooters (your license must cover the vehicle you ride)."],
    korea: ["🇰🇷 South Korea", "Recognized. Visitors need a 1949-convention IDP to drive or rent, carried with your passport and national license, and it's typically valid for up to one year from issue."],
    qatar: ["🇶🇦 Qatar", "Recognized. Tourists renting a car are expected to present an IDP with their national license; rental desks in Doha commonly ask for it."],
  };

  const cgrid = document.querySelector("[data-cgrid]");
  const panel = document.querySelector("[data-country-panel]");
  const cpTitle = document.querySelector("[data-cp-title]");
  const cpBody = document.querySelector("[data-cp-body]");
  let activeCountry = null;

  if (cgrid && panel) {
    cgrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".fq-country");
      if (!btn) return;
      const key = btn.getAttribute("data-country");
      const data = ANSWERS[key];
      if (!data) return;

      if (activeCountry === btn) {
        panel.classList.remove("is-open");
        btn.classList.remove("is-active");
        activeCountry = null;
        return;
      }
      cgrid.querySelectorAll(".fq-country.is-active").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeCountry = btn;
      cpTitle.textContent = data[0];
      cpBody.textContent = data[1];
      panel.classList.add("is-open");
    });
  }

  /* initialise default state */
  runSearch("");
})();
