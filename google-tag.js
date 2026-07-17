/* =========================================================================
   FirstIDP — Google tag (gtag.js)

   Loaded from every _offer/*.html, never from the white page.

   Two IDs are configured on purpose:
     G-1EDDP1521P    — GA4 property (the "Google tag" Google Ads generated)
     AW-11043881603  — Google Ads conversions

   The conversion itself fires from thank-you.html, not here.
   ========================================================================= */

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

gtag('js', new Date());
gtag('config', 'G-1EDDP1521P');

// Configuring the Ads ID explicitly. The G- tag usually carries Ads
// conversions on its own once the accounts are linked, but "usually" is not
// good enough for the thing that tells us whether our ad spend works — this
// line makes the AW destination unconditional.
gtag('config', 'AW-11043881603');

// Load the real library. Kept as a plain injected <script async> rather than
// the copy-pasted inline snippet so there's exactly one place to change the
// IDs instead of 22 copies across the site.
(function () {
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-1EDDP1521P';
  var first = document.getElementsByTagName('script')[0];
  if (first && first.parentNode) first.parentNode.insertBefore(s, first);
  else document.head.appendChild(s);
})();
