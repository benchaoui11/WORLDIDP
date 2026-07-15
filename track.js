/* ============================================================
   FirstIDP — Track my order
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
    submitted:           '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><path d="M3 8 5 4h14l2 4"/><path d="M3 8h6l1 3h4l1-3h6"/></svg>',
    under_review:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
    documents_accepted:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.4 3 7.7 7 9 4-1.3 7-4.6 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    paid:                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
    processing:          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    delivered:           '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="m9.5 14 2 2 4-4"/></svg>',
    rejected:            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/></svg>',
  };
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="t-check" d="m5 13 4 4L19 7"/></svg>';

  const STEP = {
    submitted:          { key: "submitted",          label: "Submitted",           title: "Application submitted",  desc: "We received your International Driving Permit application." },
    under_review:       { key: "under_review",        label: "Under review",        title: "Documents under review", desc: "Our team is checking your details and uploaded documents." },
    documents_accepted: { key: "documents_accepted",  label: "Docs accepted",       title: "Documents accepted",     desc: "Your documents were reviewed and accepted." },
    paid:               { key: "paid",                label: "Paid",                title: "Payment received",       desc: "We've received your payment and we're getting your IDP ready." },
    processing:         { key: "processing",          label: "Processing",          title: "Preparing your IDP",     desc: "Your International Driving Permit is being prepared." },
    delivered:          { key: "delivered",            label: "Delivered",           title: "Delivered",              desc: "Your permit has been delivered. Enjoy the road!" },
  };
  const FLOW = ["submitted", "under_review", "documents_accepted", "paid", "processing", "delivered"];

  const HEAD = {
    submitted:          { tag: "In progress", h: "We've got your application",     s: "It's in the queue and will be reviewed shortly." },
    under_review:       { tag: "In progress", h: "Your documents are under review", s: "Our team is checking your details and documents now." },
    documents_accepted: { tag: "In progress", h: "Your documents were accepted",    s: "We'll send secure payment instructions to your email shortly." },
    paid:               { tag: "In progress", h: "Payment received",                s: "We're now preparing your International Driving Permit." },
    processing:         { tag: "In progress", h: "Your IDP is being prepared",      s: "Almost there — we're finalizing your permit." },
    delivered:          { tag: "Complete",    h: "Delivered — enjoy the road!",     s: "Your International Driving Permit has been delivered." },
    rejected:           { tag: "Action needed", h: "We couldn't accept your documents", s: "Please contact us so we can help you resubmit — we're here to help." },
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
    if (!window.worldidpTrackOrder) return null;
    const res = await window.worldidpTrackOrder(orderId, email);
    if (!res.ok || !res.rows || !res.rows.length) return null;

    const primary = res.rows[0];
    const companionCount = res.rows.length - 1;
    const placedDate = primary.created_at
      ? new Date(primary.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : "—";

    const isRejected = primary.status === "rejected";
    const stepIndex = isRejected ? 1 : Math.max(0, FLOW.indexOf(primary.status));

    return {
      id: primary.ref,
      type: primary.format === "physical" ? "print" : "digital",
      current: stepIndex,
      isRejected,
      destination: primary.destination_country || "—",
      placed: placedDate,
      email: maskEmail(email),
      validity: primary.validity_years ? `${primary.validity_years}-year` : "—",
      companionCount,
      eta: primary.ref,
      etaSub: companionCount > 0 ? `+ ${companionCount} travel companion tracked together` : "",
    };
  }

  function maskEmail(email) {
    const at = (email || "").indexOf("@");
    if (at < 2) return email || "—";
    return email.slice(0, 2) + "***" + email.slice(at);
  }

  /* explicit, clearly-labelled sample (NOT a real order) */
  const SAMPLE = {
    id: "SAMPLE-0001", type: "print", current: 2,
    destination: "Sample city", placed: "—", email: "you@email.com",
    validity: "3-year", eta: "Sample", etaSub: "illustration only",
    isSample: true,
  };

  function buildOrder(base) {
    const steps = FLOW.map((k, i) => {
      const st = STEP[k];
      let state = i < base.current ? "done" : i === base.current ? "current" : "pending";
      if (i === base.current && base.current === FLOW.length - 1) state = "done";
      return { ...st, state };
    });
    const completed = base.current >= FLOW.length - 1;
    const currentKey = base.isRejected ? "rejected" : FLOW[Math.min(base.current, FLOW.length - 1)];
    return { ...base, steps, currentKey, completed };
  }

  // Honest timestamps only: we know exactly when the application was
  // submitted (step 0), but we don't track a timestamp for every later
  // status change, so later steps show a plain state label instead of a
  // fabricated clock time.
  function stamp(i, state, order) {
    if (i === 0 && order && order.placed) return order.placed;
    if (state === "pending") return "Pending";
    if (state === "current") return "In progress";
    return "Done";
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
        <span class="t-stage-txt"><b>${st.label}</b><time>${stamp(i, st.state, order)}</time></span>
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
        <span class="t-log-body"><b>${st.title}</b><p>${st.desc}</p><time>${stamp(i, st.state, order)}</time></span>
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

  /* pre-fill the order ID from a tracking link (?ref=...), e.g. the one
     sent in the confirmation email — the customer still has to enter
     their email themselves, which is the point of the two-factor check */
  (function prefillFromUrl() {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref && idInput) {
      idInput.value = ref;
      emailInput?.focus({ preventScroll: true });
    }
  })();

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
