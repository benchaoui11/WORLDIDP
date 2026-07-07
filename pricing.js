/* ============================================================
   WorldIDP — Pricing page interactions
   The price cards, border-orbit glow and validity toggle are
   driven by the shared script.js. This file only adds the
   page-specific reveals, the pricing FAQ accordion, and the
   reduced-motion guard for the hero car.
   ============================================================ */
(function () {
  "use strict";

  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* scroll reveal for comparison / guarantees / faq */
  const rises = document.querySelectorAll(".p-rise");
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
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
    );
    rises.forEach((el) => io.observe(el));
  }

  /* pricing FAQ accordion (scoped to #pricing-faq so it never
     collides with the homepage FAQ logic in script.js) */
  const faq = document.getElementById("pricing-faq");
  if (faq) {
    faq.querySelectorAll(".faq-item").forEach((item) => {
      const btn = item.querySelector(".faq-q");
      btn.addEventListener("click", () => {
        const open = item.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  /* pause the travelling car for reduced-motion visitors */
  if (reduce) {
    const road = document.querySelector(".p-road");
    if (road && typeof road.pauseAnimations === "function") road.pauseAnimations();
    const car = document.querySelector(".p-car");
    if (car) car.style.display = "none";
  }
})();
