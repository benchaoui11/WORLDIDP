/* ============================================================
   WorldIDP — Track my order
   ------------------------------------------------------------
   IMPORTANT — HONEST DATA ONLY:
   This page never invents a customer's order status. Real
   status is fetched from your backend via fetchOrderStatus().
   Until that is connected, a real lookup returns an honest
   "not found / contact us" message — never fake data.

   The only fabricated content is an explicit, clearly-labelled
   SAMPLE PREVIEW, shown only when the visitor clicks
   "Preview a sample journey". It uses obvious placeholder
   values and is badged so it can never be mistaken for a real
   order.
   ============================================================ */
(function () {
  "use strict";

  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* scroll reveal for the explainer / partners / tips sections */
  (function () {
    const rises = document.querySelectorAll(".t-rise");
    if (!rises.length) return;
    if (reduce || !("IntersectionObserver" in window)) {
      rises.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    rises.forEach((el) => io.observe(el));
  })();

  /* ---- icons ----------------------------------------------- */
  const I = {
    received: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><path d="M3 8 5 4h14l2 4"/><path d="M3 8h6l1 3h4l1-3h6"/></svg>',
    verified: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.4 3 7.7 7 9 4-1.3 7-4.6 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    issued: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    digital: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>',
    dispatched: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>',
    transit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg>',
    delivered: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="m9.5 14 2 2 4-4"/></svg>',
    ready: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/></svg>',
  };
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="t-check" d="m5 13 4 4L19 7"/></svg>';

  const STEP = {
    received:   { key: "received",   label: "Order placed",      title: "Order placed",           desc: "We received your International Driving Permit application." },
    verified:   { key: "verified",   label: "Details verified",  title: "Details verified",       desc: "Your licence details were checked and approved." },
    issued:     { key: "issued",     label: "Permit issued",     title: "Permit issued",          desc: "Your IDP was created in the official UN-convention format." },
    digital:    { key: "digital",    label: "Digital delivered", title: "Digital copy delivered", desc: "Your PDF permit was emailed — check your inbox." },
    dispatched: { key: "dispatched", label: "Printed & posted",  title: "Printed & dispatched",   desc: "Your printed booklet and ID card were posted." },
    transit:    { key: "transit",    label: "Out for delivery",  title: "Out for delivery",       desc: "Your package is on its way to your address." },
    delivered:  { key: "delivered",  label: "Delivered",         title: "Delivered",              desc: "Your permit arrived. Enjoy the road!" },
    ready:      { key: "ready",      label: "Ready to drive",    title: "Ready to drive",         desc: "Everything is set — you're cleared to drive abroad." },
  };
  const FLOW_PRINT = ["received", "verified", "issued", "digital", "dispatched", "transit", "delivered"];
  const FLOW_DIGITAL = ["received", "verified", "issued", "digital", "ready"];

  const HEAD = {
    received:   { tag: "In progress", h: "We've got your order",           s: "Your application is in the queue and will be reviewed shortly." },
    verified:   { tag: "In progress", h: "Your details check out",         s: "We've verified your licence and we're preparing your permit." },
    issued:     { tag: "In progress", h: "Your permit is being finalised", s: "Your IDP has been created and is being prepared for delivery." },
    digital:    { tag: "In progress", h: "Your digital permit is ready",   s: "We've emailed your PDF — your printed copy is being prepared." },
    dispatched: { tag: "On the move", h: "Your permit is on its way",      s: "Your printed booklet and card have been posted." },
    transit:    { tag: "On the move", h: "Out for delivery",               s: "Your package is heading to your address right now." },
    delivered:  { tag: "Complete",    h: "Delivered — enjoy the road!",    s: "Your International Driving Permit has arrived." },
    ready:      { tag: "Complete",    h: "You're ready to drive",          s: "Your digital permit is delivered and ready whenever you travel." },
  };

  /* ============================================================
     CONNECT YOUR BACKEND HERE
     ------------------------------------------------------------
     Look up a real order and return a normalized object, or null
     if it isn't found. NOTHING is invented — if your API has no
     match, the visitor sees an honest "not found" message.

     Expected return shape:
       {
         id, type: "print" | "digital", current: <step index>,
         destination, placed, email, validity,
         eta, etaSub
       }
     ============================================================ */
  async function fetchOrderStatus(orderId, email) {
    // Example wiring (uncomment and adapt to your store/API):
    //
    // const res = await fetch(
    //   `/api/orders/${encodeURIComponent(orderId)}?email=${encodeURIComponent(email || "")}`
    // );
    // if (!res.ok) return null;
    // const data = await res.json();
    // return {
    //   id: data.reference,
    //   type: data.hasPrint ? "print" : "digital",
    //   current: data.stepIndex,
    //   destination: data.destination,
    //   placed: data.placedDate,
    //   email: maskEmail(data.email),
    //   validity: data.validityLabel,
    //   eta: data.etaLabel,
    //   etaSub: data.etaSubLabel,
    // };

    return null; // No backend connected yet — never fabricate a status.
  }

  /* explicit, clearly-labelled sample (NOT a real order) */
  const SAMPLE = {
    id: "SAMPLE-0001", type: "print", current: 5,
    destination: "Sample city", placed: "—", email: "you@email.com",
    validity: "3-year", eta: "Sample", etaSub: "illustration only",
    isSample: true,
  };

  function buildOrder(base) {
    const flowKeys = base.type === "print" ? FLOW_PRINT : FLOW_DIGITAL;
    const steps = flowKeys.map((k, i) => {
      const st = STEP[k];
      let state = i < base.current ? "done" : i === base.current ? "current" : "pending";
      if (i === base.current && base.current === flowKeys.length - 1) state = "done";
      return { ...st, state };
    });
    const completed = base.current >= flowKeys.length - 1;
    return { ...base, steps, currentKey: flowKeys[Math.min(base.current, flowKeys.length - 1)], completed };
  }

  function stamp(i, state) {
    if (state === "pending") return "Pending";
    if (state === "current") return "In progress";
    const times = ["10:24 AM", "10:41 AM", "11:08 AM", "11:15 AM", "2:30 PM", "8:05 AM", "Delivered"];
    return times[i] || "Done";
  }

  /* ---- DOM refs --------------------------------------------- */
  const form = document.querySelector("[data-track-form]");
  const idInput = document.getElementById("t-order");
  const emailInput = document.getElementById("t-email");
  const btn = document.querySelector(".t-search-btn");
  const noticeBox = document.querySelector("[data-error]");
  const result = document.querySelector("[data-result]");
  if (!form || !result) return;

  const planLabel = { print: "Print + Digital", digital: "Digital Only" };

  function showNotice(html, kind) {
    result.classList.remove("is-shown");
    noticeBox.className = "t-error is-shown" + (kind === "info" ? " is-info" : "");
    noticeBox.innerHTML = html;
  }
  function clearNotice() { noticeBox.className = "t-error"; noticeBox.innerHTML = ""; }

  function render(order) {
    const head = HEAD[order.currentKey];
    const statusIcon = I[order.currentKey] || I.received;

    const statusEl = result.querySelector("[data-status]");
    statusEl.className = "t-status" + (order.completed ? " is-complete" : "") + (order.isSample ? " is-sample" : "");
    result.querySelector("[data-status-ic]").innerHTML = statusIcon;
    result.querySelector("[data-status-tag]").innerHTML = order.isSample
      ? "Sample preview"
      : (order.completed ? "" : '<span class="t-dot"></span>') + head.tag;
    result.querySelector("[data-status-h]").textContent = order.isSample ? "This is a sample journey" : head.h;
    result.querySelector("[data-status-s]").textContent = order.isSample
      ? "An illustration of how live tracking looks — not a real order."
      : head.s;
    result.querySelector("[data-eta-b]").textContent = order.eta;
    result.querySelector("[data-eta-s]").textContent = order.etaSub;

    const track = result.querySelector("[data-track]");
    track.style.setProperty("--n", order.steps.length);
    track.classList.remove("is-live");
    track.querySelector("[data-stages]").innerHTML = order.steps.map((st, i) => {
      const cls = st.state === "done" ? "is-done" : st.state === "current" ? "is-current" : "is-pending";
      const nodeInner = st.state === "done" ? CHECK : (I[st.key] || "");
      const puck = st.state === "current"
        ? `<span class="t-puck"><span class="t-puck-bubble">${head.tag === "Complete" ? st.label : head.tag}</span><span class="t-puck-dot"></span><span class="t-puck-ping"></span></span>`
        : "";
      const cd = `--t-cd:${(i * 0.16).toFixed(2)}s`;
      const nd = `--t-nd:${(i * 0.13 + 0.1).toFixed(2)}s`;
      return `<li class="t-stage ${cls}" style="${cd};${nd}">
        <span class="t-conn"><span class="t-conn-fill"></span></span>
        ${puck}
        <span class="t-node">${nodeInner}</span>
        <span class="t-stage-txt"><b>${st.label}</b><time>${stamp(i, st.state)}</time></span>
      </li>`;
    }).join("");

    const sum = result.querySelector("[data-summary]");
    sum.innerHTML = `
      <h3>${order.isSample ? "Order summary · sample" : "Order summary"}</h3>
      <div class="t-sum-row"><span>Order number</span><b>${order.id}</b></div>
      <div class="t-sum-row"><span>Plan</span><b class="t-plan-pill">${planLabel[order.type]}</b></div>
      <div class="t-sum-row"><span>Validity</span><b>${order.validity}</b></div>
      <div class="t-sum-row"><span>Destination</span><b>${order.destination}</b></div>
      <div class="t-sum-row"><span>Placed</span><b>${order.placed}</b></div>
      <div class="t-sum-row"><span>Sent to</span><b>${order.email}</b></div>
      <div class="t-sum-foot">
        <span class="t-sum-thumb"><img src="IMAGES/digital-and-printed-international-driving-permit.webp" alt="Digital and printed International Driving Permit booklet, card and phone" title="Digital and printed International Driving Permit" width="1200" height="960" decoding="async" /></span>
        <p class="t-sum-note">${order.isSample
          ? "Sample data shown for illustration. Real orders display your own details here."
          : "Your digital permit is always available in your inbox" + (order.type === "print" ? ", with the printed copy on the way." : ".")}</p>
      </div>`;

    const log = result.querySelector("[data-log]");
    log.innerHTML = order.steps.map((st, i) => {
      const cls = st.state === "done" ? "is-done" : st.state === "current" ? "is-current" : "is-pending";
      const dot = st.state === "done" ? CHECK : (I[st.key] || "");
      return `<li class="t-log-item ${cls}">
        <span class="t-log-dot">${dot}</span>
        <span class="t-log-body"><b>${st.title}</b><p>${st.desc}</p><time>${stamp(i, st.state)}</time></span>
      </li>`;
    }).join("");

    clearNotice();
    result.classList.add("is-shown");
    if (reduce) {
      track.classList.add("is-live");
    } else {
      void track.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => track.classList.add("is-live")));
    }
  }

  /* real lookup */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = (idInput.value || "").trim();
    clearNotice();
    if (!val) {
      showNotice("Please enter your order number to track your permit.");
      idInput.focus();
      return;
    }
    btn.classList.add("is-busy");
    Promise.resolve(fetchOrderStatus(val, (emailInput.value || "").trim()))
      .catch(() => null)
      .then((order) => {
        btn.classList.remove("is-busy");
        if (order) {
          render(order);
          result.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        } else {
          showNotice(
            'We couldn\'t find a live status for that order number yet. ' +
            'If you\'ve placed an order, our team can give you an update right away — ' +
            '<a href="contact-us.html">contact support</a>.',
            "info"
          );
        }
      });
  });

  /* explicit sample preview (clearly labelled, never a real lookup) */
  const sampleLink = document.querySelector("[data-demo]");
  if (sampleLink) {
    sampleLink.addEventListener("click", () => {
      render(buildOrder(SAMPLE));
      result.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  }

  /* page loads to a clean search state — no order is shown automatically */
})();
