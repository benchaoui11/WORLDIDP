/* =========================================================================
   WorldIDP — Step 2: Document Submission interactivity
   ========================================================================= */
(() => {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- state ---------- */
  const done = { selfie:false, front:false, back:false, signature:false };
  const KEYS = ["selfie","front","back","signature"];
  const LABELS = {
    selfie:{ t:"Passport-style photo", ok:"Photo uploaded" },
    front: { t:"License — front", ok:"Front uploaded" },
    back:  { t:"License — back", ok:"Back uploaded" },
    signature:{ t:"Signature", ok:"Signed" },
  };

  /* =======================================================================
     ORDER RECAP (from URL params + sessionStorage)
     ======================================================================= */
  (function recap(){
    const p = new URLSearchParams(location.search);
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem("worldidp_application") || "{}"); } catch(e){}

    // sessionStorage holds the customer's latest choice (e.g. after switching
    // Digital ⇄ Print), so it takes priority over any stale URL parameter.
    const format = saved.format || p.get("format") || "digital";
    const years  = parseInt(saved.validYears || p.get("valid") || "3", 10);
    const country = saved.country || p.get("country") || "Thailand";

    const fmtName = format === "physical" ? "Print + Digital IDP" : "Digital Only IDP";
    const base = format === "physical" ? 99 : 79;
    const adj = years === 1 ? -20 : years === 2 ? -10 : 0;
    const total = base + adj;
    const expYear = 2026 + years;

    const set = (sel,val) => { const el = $(sel); if (el) el.textContent = val; };
    set("[data-recap-format]", fmtName);
    set("[data-recap-valid]", `${years} year${years>1?"s":""} · Expires ${expYear}`);
    set("[data-recap-country]", country);
    set("[data-recap-total]", String(total));
  })();

  /* =======================================================================
     VERIFICATION RING + CHECKLIST
     ======================================================================= */
  const ring = $("[data-ring]");
  const ringPct = $("[data-ring-pct]");
  const ringTitle = $("[data-ring-title]");
  const ringSub = $("[data-ring-sub]");
  const CIRC = 2 * Math.PI * 36; // 226.19

  function refresh() {
    const n = KEYS.filter(k => done[k]).length;
    const pct = Math.round((n / KEYS.length) * 100);
    ring.style.strokeDashoffset = String(CIRC * (1 - n / KEYS.length));
    ringPct.textContent = pct + "%";
    ringSub.textContent = `${n} of ${KEYS.length} items complete`;
    ringTitle.textContent = n === 0 ? "Let's begin" : n === KEYS.length ? "All set!" : "Looking good";

    KEYS.forEach(k => {
      const item = $(`[data-check="${k}"]`);
      const status = $(`[data-status="${k==="front"||k==="back"?"license":k}"]`);
      const num = $(`[data-num="${k==="front"||k==="back"?"license":k}"]`);
      if (item) {
        item.classList.toggle("is-done", done[k]);
        if (done[k]) item.classList.remove("missing");
        const sub = $(".ck-sub", item);
        if (sub) sub.textContent = done[k] ? LABELS[k].ok : (k==="signature"?"Not signed yet":"Not uploaded yet");
      }
    });

    // clear the red "missing" flag from any section that's now complete
    ["selfie","license","signature"].forEach((group) => {
      const ok = group === "license" ? (done.front && done.back) : done[group];
      if (ok) { const card = $(`[data-step-block="${group}"]`); if (card) card.classList.remove("missing"); }
    });

    // section status pills (license needs both)
    setStatus("selfie", done.selfie);
    setStatus("signature", done.signature);
    const licenseDone = done.front && done.back;
    setStatus("license", licenseDone);

    // continue button: always clickable. If steps are missing, clicking it
    // highlights what's missing (handled in the click handler) instead of
    // silently doing nothing.
    const all = KEYS.every(k => done[k]);
    const btn = $("#continue-btn");
    const btnText = $("[data-btn-text]");
    btn.disabled = false;
    btn.classList.toggle("is-incomplete", !all);
    btnText.textContent = all ? "Continue to payment" : "Complete the steps above to continue";
  }

  // Add a red "missing" highlight to any step the customer hasn't completed,
  // and scroll to the first one so they can see exactly what's needed.
  function flagMissing() {
    let firstMissing = null;
    const groups = [
      { key: "selfie", group: "selfie" },
      { key: "front",  group: "license" },
      { key: "back",   group: "license" },
      { key: "signature", group: "signature" },
    ];
    // section cards
    ["selfie","license","signature"].forEach((group) => {
      const need = group === "license" ? (!done.front || !done.back) : !done[group];
      const card = $(`[data-step-block="${group}"]`);
      if (card) card.classList.toggle("missing", need);
      if (need && !firstMissing) firstMissing = card;
    });
    // checklist rows
    KEYS.forEach((k) => {
      const item = $(`[data-check="${k}"]`);
      if (item) item.classList.toggle("missing", !done[k]);
    });
    if (firstMissing) firstMissing.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setStatus(group, isDone) {
    const status = $(`[data-status="${group}"]`);
    const num = $(`[data-num="${group}"]`);
    if (status) {
      status.classList.toggle("is-done", isDone);
      if (isDone) {
        status.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Done';
      }
    }
    if (num) num.classList.toggle("is-done", isDone);
  }

  /* =======================================================================
     DROPZONES (file input + drag&drop + camera + preview)
     ======================================================================= */
  function readImage(file, cb) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => cb(e.target.result, file.name);
    reader.readAsDataURL(file);
  }

  function handleFile(key, file) {
    const zone = $(`[data-dropzone="${key}"]`);
    const preview = $(`[data-preview="${key}"]`);
    const img = $("img", preview);
    const fname = $(`[data-fname="${key}"]`);
    if (!zone || !file) return;

    readImage(file, (dataUrl, name) => {
      img.src = dataUrl;
      if (fname) fname.textContent = name;

      // brief "processing" scan, then reveal verified state
      zone.classList.add("is-processing");
      setTimeout(() => {
        zone.classList.remove("is-processing");
        zone.classList.add("has-file");
        // re-trigger the verified pop animation
        const v = $(".dz-verified", preview);
        if (v) { v.style.animation = "none"; void v.offsetWidth; v.style.animation = ""; }
        done[key] = true;
        refresh();
      }, 1150);
    });
  }

  $$("[data-dropzone]").forEach(zone => {
    const key = zone.dataset.dropzone;
    const input = $(`[data-input="${key}"]`, zone);

    input.addEventListener("change", e => {
      const f = e.target.files && e.target.files[0];
      if (f) handleFile(key, f);
    });

    // drag & drop
    ["dragenter","dragover"].forEach(ev => zone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      if (!zone.classList.contains("has-file")) zone.classList.add("is-drag");
    }));
    ["dragleave","dragend"].forEach(ev => zone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation(); zone.classList.remove("is-drag");
    }));
    zone.addEventListener("drop", e => {
      e.preventDefault(); e.stopPropagation();
      zone.classList.remove("is-drag");
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(key, f);
    });
  });

  // replace buttons
  $$("[data-replace]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      const key = btn.dataset.replace;
      const zone = $(`[data-dropzone="${key}"]`);
      const input = $(`[data-input="${key}"]`, zone);
      zone.classList.remove("has-file");
      input.value = "";
      done[key] = false;
      refresh();
      // open picker again
      setTimeout(() => input.click(), 60);
    });
  });

  // explicit "Upload" buttons -> open that dropzone's own file input.
  // On phones the native picker offers "Take Photo" + "Photo Library",
  // so this single button covers both camera and gallery.
  $$("[data-pick]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      const key = btn.dataset.pick;
      const input = $(`[data-input="${key}"]`);
      if (input) input.click();
    });
  });

  /* =======================================================================
     PHOTO GUIDELINES MODAL
     ======================================================================= */
  const modal = $("#guide-modal");
  const openModal = () => { modal.classList.add("show"); modal.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; };
  const closeModal = () => { modal.classList.remove("show"); modal.setAttribute("aria-hidden","true"); document.body.style.overflow=""; };
  $$("[data-open-guide]").forEach(b => b.addEventListener("click", openModal));
  $("[data-close-guide]")?.addEventListener("click", closeModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && modal.classList.contains("show")) closeModal(); });

  /* =======================================================================
     SIGNATURE — tab toggle + draw canvas + typed
     ======================================================================= */
  const sigBtns = $$("[data-sig-mode]");
  const panes = { draw: $('[data-sig-pane="draw"]'), type: $('[data-sig-pane="type"]') };
  let sigMode = "draw";

  sigBtns.forEach(b => b.addEventListener("click", () => {
    sigMode = b.dataset.sigMode;
    sigBtns.forEach(x => x.classList.toggle("active", x === b));
    Object.entries(panes).forEach(([k,el]) => el.classList.toggle("active", k === sigMode));
    if (sigMode === "draw") setTimeout(fitCanvas, 30);
    evaluateSignature();
  }));

  // ---- canvas drawing ----
  const canvas = $("#sig-canvas");
  const wrap = $("[data-canvas-wrap]");
  const ctx = canvas.getContext("2d");
  let drawing = false, hasInk = false, lastX = 0, lastY = 0;

  function fitCanvas() {
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // preserve existing drawing
    const prev = hasInk ? canvas.toDataURL() : null;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = "#111111"; ctx.lineWidth = 2.6;
    if (prev) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, rect.width, rect.height); im.src = prev; }
  }

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
  function start(e) { e.preventDefault(); drawing = true; const p = pos(e); lastX = p.x; lastY = p.y; }
  function move(e) {
    if (!drawing) return; e.preventDefault();
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke();
    lastX = p.x; lastY = p.y;
    if (!hasInk) { hasInk = true; wrap.classList.add("has-ink"); }
    evaluateSignature();
  }
  function end() { drawing = false; }

  canvas.addEventListener("mousedown", start);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive:false });
  canvas.addEventListener("touchmove", move, { passive:false });
  canvas.addEventListener("touchend", end);

  $("[data-sig-clear]")?.addEventListener("click", () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    hasInk = false; wrap.classList.remove("has-ink");
    evaluateSignature();
  });

  // ---- typed signature ----
  const typeInput = $("[data-sig-type]");
  const typedPreview = $("[data-sig-typed-preview]");
  typeInput?.addEventListener("input", () => {
    const v = typeInput.value.trim();
    if (v) { typedPreview.textContent = v; typedPreview.classList.remove("placeholder"); }
    else { typedPreview.textContent = "Your signature will appear here"; typedPreview.classList.add("placeholder"); }
    evaluateSignature();
  });
  $("[data-sig-clear-type]")?.addEventListener("click", () => {
    typeInput.value = "";
    typedPreview.textContent = "Your signature will appear here";
    typedPreview.classList.add("placeholder");
    evaluateSignature();
  });

  function evaluateSignature() {
    const ok = sigMode === "draw" ? hasInk : typeInput.value.trim().length >= 2;
    done.signature = ok;
    refresh();
  }

  window.addEventListener("resize", () => { if (sigMode === "draw") fitCanvas(); });
  // initial canvas size
  requestAnimationFrame(fitCanvas);

  /* =======================================================================
     SUBMIT → hand off to the payment service
     ======================================================================= */
  const overlay = $("#overlay");

  // Rebuild the order context from URL + saved application summary.
  function getOrder() {
    const p = new URLSearchParams(location.search);
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem("worldidp_application") || "{}"); } catch (e) {}
    // sessionStorage wins over URL so a Digital⇄Print switch is always reflected
    // in the totals and the product code sent to the payment service.
    const format = saved.format || p.get("format") || "digital";
    const validYears = parseInt(saved.validYears || p.get("valid") || "3", 10);
    // a short, unique order reference so the payment can be matched to this order
    let ref = "";
    try { ref = sessionStorage.getItem("worldidp_ref") || ""; } catch (e) {}
    if (!ref) {
      ref = "WIDP-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      try { sessionStorage.setItem("worldidp_ref", ref); } catch (e) {}
    }
    return { format, validYears, email: saved.email || "", ref, country: saved.country || p.get("country") || "" };
  }

  function showDemoNotice(order, productCode) {
    const card = overlay.querySelector(".po-card");
    if (card) {
      card.innerHTML =
        '<div style="width:54px;height:54px;border-radius:16px;display:grid;place-items:center;' +
        'background:linear-gradient(135deg,#1c3da0,#4f86ff);color:#fff;">' +
        '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h20v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/>' +
        '<path d="M2 11h20M6 15h4"/></svg></div>' +
        '<h3>Payment isn\'t connected yet</h3>' +
        '<p style="margin-top:2px">This order (<b>' + productCode + '</b>) has been prepared but payment processing ' +
        'isn\'t live yet. Your order reference is <b>' + order.ref + '</b>.</p>' +
        '<button type="button" id="demo-close" style="margin-top:14px;border:0;border-radius:12px;cursor:pointer;' +
        'padding:11px 20px;font-weight:800;color:#fff;background:linear-gradient(135deg,#1c3da0,#3168f3);">Got it</button>';
      card.querySelector("#demo-close")?.addEventListener("click", () => {
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
      });
    }
  }

  function showTestSuccessNotice(order) {
    const card = overlay.querySelector(".po-card");
    if (card) {
      card.innerHTML =
        '<div style="width:54px;height:54px;border-radius:16px;display:grid;place-items:center;' +
        'background:linear-gradient(135deg,#15a06b,#1fc285);color:#fff;">' +
        '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" ' +
        'stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>' +
        '<h3>Test payment order created successfully.</h3>' +
        '<p style="margin-top:2px">Order reference: <b>' + order.ref + '</b>.</p>' +
        '<button type="button" id="test-ok-close" style="margin-top:14px;border:0;border-radius:12px;cursor:pointer;' +
        'padding:11px 20px;font-weight:800;color:#fff;background:linear-gradient(135deg,#1c3da0,#3168f3);">Got it</button>';
      card.querySelector("#test-ok-close")?.addEventListener("click", () => {
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
      });
    }
  }

  // Collect the captured images + signature as data URLs.
  function collectFiles() {
    const get = (sel) => { const el = $(sel); return el && el.src && el.src.startsWith("data:") ? el.src : null; };
    let signature = null;
    if (sigMode === "draw" && hasInk) {
      try { signature = canvas.toDataURL("image/png"); } catch (e) {}
    } else if (sigMode === "type" && typeInput.value.trim()) {
      signature = renderTypedSignature(typeInput.value.trim());
    }
    return {
      selfie: get('[data-preview="selfie"] img'),
      front:  get('[data-preview="front"] img'),
      back:   get('[data-preview="back"] img'),
      signature,
    };
  }

  // Render a typed signature to a small canvas so it's stored as an image too.
  function renderTypedSignature(text) {
    try {
      const c = document.createElement("canvas");
      c.width = 600; c.height = 160;
      const x = c.getContext("2d");
      x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = "#111111";
      x.font = "64px 'Snell Roundhand','Apple Chancery','Segoe Script','Brush Script MT',cursive";
      x.textBaseline = "middle";
      x.fillText(text, 24, 86);
      return c.toDataURL("image/png");
    } catch (e) { return null; }
  }

  function showError(msg) {
    const card = overlay.querySelector(".po-card");
    if (!card) return;
    card.innerHTML =
      '<div style="width:54px;height:54px;border-radius:16px;display:grid;place-items:center;' +
      'background:linear-gradient(135deg,#e4564f,#ff7a73);color:#fff;">' +
      '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg></div>' +
      '<h3>Something went wrong</h3>' +
      '<p style="margin-top:2px">' + (msg || "Please try again.") + '</p>' +
      '<button type="button" id="err-close" style="margin-top:14px;border:0;border-radius:12px;cursor:pointer;' +
      'padding:11px 20px;font-weight:800;color:#fff;background:linear-gradient(135deg,#1c3da0,#3168f3);">Try again</button>';
    card.querySelector("#err-close")?.addEventListener("click", () => {
      overlay.classList.remove("show"); overlay.setAttribute("aria-hidden", "true");
    });
  }

  // ---- image compression: resize + JPEG so uploads are fast on mobile ----
  function compressDataUrl(dataUrl, maxDim, quality) {
    return new Promise((resolve) => {
      if (!dataUrl || !dataUrl.startsWith("data:")) return resolve(dataUrl);
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        try {
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const cx = c.getContext("2d");
          cx.fillStyle = "#fff"; cx.fillRect(0, 0, w, h);
          cx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", quality));
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
  async function compressFiles(files) {
    const [selfie, front, back] = await Promise.all([
      compressDataUrl(files.selfie, 1600, 0.82),
      compressDataUrl(files.front, 1800, 0.82),
      compressDataUrl(files.back, 1800, 0.82),
    ]);
    // signature stays PNG (small, needs transparency)
    return { selfie, front, back, signature: files.signature };
  }

  $("#continue-btn").addEventListener("click", async () => {
    if (!KEYS.every(k => done[k])) { flagMissing(); return; }

    const order = getOrder();

    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    // Compress photos (resize + JPEG) BEFORE storing/uploading — much faster on mobile
    const files = await compressFiles(collectFiles());

    // Persist files + order context for the payment step (physical) or for retry.
    try {
      sessionStorage.setItem("worldidp_files", JSON.stringify(files));
    } catch (e) { /* storage may be full for large images; handled below */ }

    const params = new URLSearchParams(location.search);

    /* ---- PRINT + DIGITAL: go to the delivery/payment page ---- */
    if (order.format === "physical") {
      setTimeout(() => {
        window.location.href = "payment.html" + (params.toString() ? "?" + params.toString() : "");
      }, 300);
      return;
    }

    /* ---- DIGITAL ONLY: upload now, then hand off to the payment service ---- */
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem("worldidp_application") || "{}"); } catch (e) { return {}; } })();
    const full = Object.assign({}, order, {
      firstName: saved.firstName, lastName: saved.lastName, email: saved.email,
      phone: saved.phone, category: saved.category,
      total: computeTotal(order.format, order.validYears), currency: "USD",
      files,
    });

    const res = await window.worldidpSubmitOrder(full);
    if (!res.ok) { showError(res.error); return; }

    const paymentPayload = window.WorldIDPPayment.buildTestCheckoutPayload({
      format: order.format,
      validYears: order.validYears,
      express: false, // no express-processing choice in the digital-only flow's UI today
      email: order.email,
      orderReference: order.ref,
    });
    const result = await window.WorldIDPPayment.createTestPaymentOrder(paymentPayload);

    if (result.ok) {
      showTestSuccessNotice(order);
    } else {
      showDemoNotice(order, paymentPayload.product_code);
    }
  });

  function computeTotal(format, years) {
    const base = format === "physical" ? 99 : 79;
    const adj = years === 1 ? -20 : years === 2 ? -10 : 0;
    return base + adj;
  }

  /* ---------- header scroll state ---------- */
  const header = $("[data-header]");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  window.addEventListener("scroll", onScroll, { passive:true });
  onScroll();

  /* ---------- init ---------- */
  refresh();
})();
