/* ============================================================
   WorldIDP — Contact page interactions
   Scoped so it never clashes with script.js (homepage logic).
   ============================================================ */
(function () {
  "use strict";

  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- scroll reveal --------------------------------------- */
  const rises = document.querySelectorAll(".c-rise");
  if (reduce || !("IntersectionObserver" in window)) {
    rises.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    rises.forEach((el) => io.observe(el));
  }

  /* ---- mini FAQ accordion (scoped to #contact-faq) --------- */
  const faq = document.getElementById("contact-faq");
  if (faq) {
    faq.querySelectorAll(".faq-item").forEach((item) => {
      const btn = item.querySelector(".faq-q");
      btn.addEventListener("click", () => {
        const open = item.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  /* ---- contact form: send animation + success state -------- */
  const card = document.getElementById("contact-form");
  const form = document.querySelector("[data-contact-form]");
  if (form && card) {
    const submit = form.querySelector(".c-submit");

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      // native validation first
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      submit.classList.add("is-sending");
      const label = submit.querySelector(".c-label");
      if (label) label.textContent = "Sending…";

      /* ---------------------------------------------------------
         No backend is wired in yet. To make this form actually
         deliver, point it at your endpoint (e.g. Formspree, or
         your own handler) inside this block, then call
         showSuccess() on a successful response.
         Example:
           fetch("https://formspree.io/f/XXXX", {
             method: "POST",
             headers: { Accept: "application/json" },
             body: new FormData(form)
           }).then(() => showSuccess());
         --------------------------------------------------------- */
      window.setTimeout(showSuccess, reduce ? 0 : 850);
    });

    function showSuccess() {
      card.classList.add("is-sent");
    }

    const resetBtn = card.querySelector("[data-reset]");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        card.classList.remove("is-sent");
        submit.classList.remove("is-sending");
        const label = submit.querySelector(".c-label");
        if (label) label.textContent = "Send message";
        form.reset();
        const name = form.querySelector("#cf-name");
        if (name) name.focus();
      });
    }
  }

  /* ---- "Live chat" card: route to the floating chat button -- */
  const chatTrigger = document.querySelector("[data-chat]");
  const fab = document.querySelector(".chat-fab");
  if (chatTrigger && fab) {
    chatTrigger.addEventListener("click", (event) => {
      // If a real chat widget is connected later, open it here.
      // For now we nudge the floating chat button so it's noticed.
      event.preventDefault();
      fab.classList.add("is-bounce");
      window.setTimeout(() => fab.classList.remove("is-bounce"), 900);
      const formCard = document.getElementById("contact-form");
      if (formCard) formCard.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    });
  }
})();
