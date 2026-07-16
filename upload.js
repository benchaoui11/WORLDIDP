/* =========================================================================
   FirstIDP — Step 2: Document Submission interactivity
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
  // Fast Processing (+$14) — Digital-only here. Print + Digital customers
  // see the exact same addon later, on the delivery/payment page, so it's
  // not duplicated on this page for them.
  const addonState = { express: false };

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
    const expYear = 2026 + years;

    const set = (sel,val) => { const el = $(sel); if (el) el.textContent = val; };
    set("[data-recap-format]", fmtName);
    set("[data-recap-valid]", `${years} year${years>1?"s":""} · Expires ${expYear}`);
    set("[data-recap-country]", country);

    function refreshTotal() {
      let total = computeTotal(format, years) + (addonState.express ? 14 : 0);
      // Travel companion — keep this total consistent with what the
      // customer already saw at checkout (their price + companion's 20%-off price),
      // instead of silently dropping back to a single-person total.
      try {
        const companion = JSON.parse(sessionStorage.getItem("worldidp_companion") || "null");
        if (companion && companion.total) total += Number(companion.total) || 0;
      } catch (e) {}
      set("[data-recap-total]", String(total));
    }
    refreshTotal();

    // Fast Processing is shown here for Digital only. Print + Digital
    // customers see the exact same addon on the delivery/payment page
    // next, so it's hidden here to avoid asking twice.
    const addonSection = document.querySelector("[data-digital-only]");
    if (format === "physical") {
      if (addonSection) addonSection.style.display = "none";
    } else {
      const expressEl = $("[data-express]");
      if (expressEl) {
        expressEl.addEventListener("click", (e) => {
          e.preventDefault();
          addonState.express = !addonState.express;
          expressEl.classList.toggle("is-active", addonState.express);
          const input = $("input", expressEl);
          if (input) input.checked = addonState.express;
          refreshTotal();
        });
      }
    }
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

      // Which of the required photos got added, and when. This is what
      // shows whether people stall on the selfie vs the licence back.
      // The photo itself is never sent here — only which slot was filled.
      window.fidpTrack?.("photo_added", { slot: key });

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

  // A brand-new reference for EVERY Pay attempt — intentionally never
  // persisted/reused. getOrder().ref above stays stable across the whole
  // session (the application ref, correctly reused so we never duplicate
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
      const btn = $("#continue-btn");
      if (btn) btn.disabled = false; // let the customer retry
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

  // Reset every capture slot back to empty — used when handing off from the
  // primary applicant's documents to their travel companion's, reusing this
  // same page and flow for a second, focused pass.
  function resetCaptureUI() {
    ["selfie", "front", "back"].forEach((key) => {
      const zone = $(`[data-dropzone="${key}"]`);
      const input = $(`[data-input="${key}"]`, zone);
      if (zone) zone.classList.remove("has-file");
      if (input) input.value = "";
      done[key] = false;
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk = false;
    wrap.classList.remove("has-ink");
    if (typeInput) typeInput.value = "";
    if (typedPreview) {
      typedPreview.textContent = "Your signature will appear here";
      typedPreview.classList.add("placeholder");
    }
    done.signature = false;

    refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("#continue-btn").addEventListener("click", async () => {
    if (!KEYS.every(k => done[k])) { flagMissing(); return; }

    const btn = $("#continue-btn");
    if (btn.disabled) return; // already submitting — ignore repeat clicks
    btn.disabled = true;

    const order = getOrder();
    const urlParams = new URLSearchParams(location.search);
    const isCompanionStep = urlParams.get("person") === "2";
    let hasCompanion = false;
    try { hasCompanion = !!sessionStorage.getItem("worldidp_companion"); } catch (e) {}

    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    // Compress photos (resize + JPEG) BEFORE storing/uploading — much faster on mobile
    const files = await compressFiles(collectFiles());

    // Save under the right key for whoever we just captured documents for.
    const filesKey = isCompanionStep ? "worldidp_files_companion" : "worldidp_files";
    try {
      sessionStorage.setItem(filesKey, JSON.stringify(files));
    } catch (e) { /* storage may be full for large images; handled below */ }

    // Travel companion, step 1 done — hand off to their own document capture
    // using this exact same page and flow, just for the second person.
    if (!isCompanionStep && hasCompanion) {
      resetCaptureUI();
      const params = new URLSearchParams(location.search);
      params.set("person", "2");
      setTimeout(() => {
        window.location.href = "upload-photos.html?" + params.toString();
      }, 300);
      return;
    }

    const params = new URLSearchParams(location.search);
    params.delete("person");

    /* ---- PRINT + DIGITAL: go to the delivery/payment page ---- */
    if (order.format === "physical") {
      setTimeout(() => {
        window.location.href = "payment.html" + (params.toString() ? "?" + params.toString() : "");
      }, 300);
      return;
    }

    /* ---- DIGITAL ONLY: submit now (primary + companion, if any), then confirm ---- */
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem("worldidp_application") || "{}"); } catch (e) { return {}; } })();
    const primaryFiles = isCompanionStep
      ? (() => { try { return JSON.parse(sessionStorage.getItem("worldidp_files") || "{}"); } catch (e) { return {}; } })()
      : files;
    const full = Object.assign({}, order, {
      firstName: saved.firstName, lastName: saved.lastName, email: saved.email,
      phone: saved.phone, category: saved.category,
      total: computeTotal(order.format, order.validYears) + (addonState.express ? 14 : 0), currency: "USD",
      express: addonState.express,
      files: primaryFiles,
    });

    // Save the full application (details + documents) to Supabase.
    // No payment is collected here — the team reviews the documents first
    // and sends secure payment instructions afterward.
    const res = await window.worldidpSubmitOrder(full);
    if (!res.ok) {
      // Track the failure. This is the one funnel step pageviews can't show:
      // the customer stays on this page, so in PostHog it just looks like
      // they wandered off. No personal data here — only the fact it failed.
      window.fidpTrack?.("submit_failed", {
        format: full.format,
        has_companion: hasCompanion,
      });
      showError(res.error);
      return;
    }
    window.fidpTrack?.("submit_succeeded", {
      format: full.format,
      has_companion: hasCompanion,
    });

    const refs = [order.ref];
    if (hasCompanion) {
      try {
        const companion = JSON.parse(sessionStorage.getItem("worldidp_companion") || "null");
        const compFiles = JSON.parse(sessionStorage.getItem("worldidp_files_companion") || "null");
        if (companion && compFiles) {
          const companionRef = order.ref + "-2";
          const compRes = await window.worldidpSubmitOrder({
            ref: companionRef,
            format: companion.format, validYears: companion.validYears, country: companion.country,
            total: companion.total, currency: "USD",
            firstName: companion.firstName, lastName: companion.lastName, email: companion.email,
            category: companion.category,
            express: addonState.express, // same order, same processing speed
            files: compFiles,
            groupRef: order.ref, isCompanion: true,
          });
          if (compRes.ok) {
            refs.push(companionRef);
          } else {
            // Your application saved fine, but your companion's did not —
            // don't silently show "success" when only half the order went through.
            showError("Your application was saved, but we couldn't save your travel companion's — please try Continue again.");
            return;
          }
        }
      } catch (e) { console.error("[FirstIDP] companion submit failed:", e); }
    }

    // Fire-and-forget: never let a slow/failed email delay the redirect —
    // the application is already safely saved by this point.
    window.worldidpSendConfirmationEmail({
      to: full.email,
      firstName: full.firstName,
      refs,
      format: full.format,
      validYears: full.validYears,
      hasCompanion: refs.length > 1,
      companionFirstName: refs.length > 1 ? (JSON.parse(sessionStorage.getItem("worldidp_companion") || "{}").firstName) : null,
    });

    window.worldidpSendAdminNotification({
      refs,
      orderNumber: res.orderNumber,
      firstName: full.firstName,
      lastName: full.lastName,
      email: full.email,
      phone: full.phone,
      format: full.format,
      validYears: full.validYears,
      destinationCountry: full.country,
      total: full.total,
      hasExpress: addonState.express,
      hasCompanion: refs.length > 1,
      companionFirstName: refs.length > 1 ? (JSON.parse(sessionStorage.getItem("worldidp_companion") || "{}").firstName) : null,
      companionLastName: refs.length > 1 ? (JSON.parse(sessionStorage.getItem("worldidp_companion") || "{}").lastName) : null,
      companionTotal: refs.length > 1 ? (JSON.parse(sessionStorage.getItem("worldidp_companion") || "{}").total) : null,
    });

    window.location.href = "thank-you.html?ref=" + encodeURIComponent(refs.join(","));
  });

  function computeTotal(format, years) {
    // Same canonical table as the pricing/checkout/payment pages — see the
    // note in the recap() function above for why this replaced the old
    // base+adjustment formula.
    const PRICES = {
      digital:  { 1: 49, 2: 55, 3: 59 },
      physical: { 1: 79, 2: 89, 3: 99 },
    };
    const table = PRICES[format] || PRICES.digital;
    return table[years] != null ? table[years] : table[3];
  }

  /* ---------- header scroll state ---------- */
  const header = $("[data-header]");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  window.addEventListener("scroll", onScroll, { passive:true });
  onScroll();

  /* ---------- init ---------- */
  refresh();

  // Travel companion — show a clear "who's turn is it" banner when this
  // order includes a second driver, so it's never ambiguous whose
  // documents are currently being uploaded.
  (function initPersonBanner() {
    const banner = $("#person-banner");
    if (!banner) return;
    const isCompanionStep = new URLSearchParams(location.search).get("person") === "2";
    let companion = null, primary = null;
    try { companion = JSON.parse(sessionStorage.getItem("worldidp_companion") || "null"); } catch (e) {}
    try { primary = JSON.parse(sessionStorage.getItem("worldidp_application") || "null"); } catch (e) {}

    if (isCompanionStep && companion) {
      banner.hidden = false;
      banner.classList.add("is-companion");
      $("#pb-avatar").textContent = "2";
      $("#pb-name").textContent = companion.firstName ? `${companion.firstName}'s IDP` : "your travel companion";
      $("#pb-step").textContent = "step 2 of 2 — almost done";
    } else if (!isCompanionStep && companion) {
      banner.hidden = false;
      banner.classList.remove("is-companion");
      $("#pb-avatar").textContent = "1";
      $("#pb-name").textContent = primary?.firstName ? `${primary.firstName}, that's you` : "you, first";
      $("#pb-step").textContent = `then ${companion.firstName || "your companion"}'s documents`;
    }
  })();
})();
