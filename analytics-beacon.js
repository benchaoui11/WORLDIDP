/* WorldIDP — lightweight, privacy-conscious visit beacon.
   Fires once per page load. Never blocks rendering. Never collects
   personal data — only coarse browser/OS/device + referrer + country
   (country comes server-side from Vercel's own geo headers). */
(function () {
  try {
    var ua = navigator.userAgent || '';
    var browser = /Edg\//.test(ua) ? 'Edge'
      : /Chrome\//.test(ua) ? 'Chrome'
      : /Firefox\//.test(ua) ? 'Firefox'
      : /Safari\//.test(ua) && !/Chrome/.test(ua) ? 'Safari'
      : 'Other';
    var os = /Windows/.test(ua) ? 'Windows'
      : /Mac OS X/.test(ua) ? 'macOS'
      : /Android/.test(ua) ? 'Android'
      : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
      : /Linux/.test(ua) ? 'Linux'
      : 'Other';
    var device = /Mobi|Android|iPhone/.test(ua) ? 'Mobile'
      : /iPad|Tablet/.test(ua) ? 'Tablet' : 'Desktop';

    var sessionId = sessionStorage.getItem('widp_sid');
    if (!sessionId) {
      sessionId = 'sid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      sessionStorage.setItem('widp_sid', sessionId);
    }

    var payload = JSON.stringify({
      sessionId: sessionId,
      siteMode: document.documentElement.getAttribute('data-site-mode') || 'offer',
      referrer: document.referrer || null,
      landingPage: location.pathname,
      browser: browser,
      os: os,
      device: device,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track', { method: 'POST', body: payload, keepalive: true });
    }
  } catch (e) {
    /* tracking must never break the page */
  }
})();
