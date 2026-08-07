/* =========================================================================
   FirstIDP — Google tag (gtag.js)

   Loaded from every public FirstIDP page.

   Two IDs are configured on purpose:
     G-63NCNG4MRR    — GA4 property
     AW-11043881603  — Google Ads conversions

   The conversion itself fires from thank-you.html, not here.
   ========================================================================= */

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

gtag('js', new Date());
gtag('config', 'G-63NCNG4MRR');

// Configuring the Ads ID explicitly. The G- tag usually carries Ads
// conversions on its own once the accounts are linked, but "usually" is not
// good enough for the thing that tells us whether our ad spend works — this
// line makes the AW destination unconditional.
gtag('config', 'AW-11043881603');

// Load the real library after the browser has had a chance to paint the page.
// Calls above are queued in dataLayer, so pageview/conversion data is preserved
// without making Google Tag part of the critical render path.
(function () {
  var loaded = false;
  function loadTag() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-63NCNG4MRR';
    document.head.appendChild(s);
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadTag, { timeout: 2500 });
  } else {
    window.addEventListener('load', function () { setTimeout(loadTag, 600); }, { once: true });
  }
})();
