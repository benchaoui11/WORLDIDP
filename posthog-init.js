/* =========================================================================
   FirstIDP — PostHog analytics loader.

   Only loaded from _offer/*.html, so it never runs on the white page.

   ⚠️  SESSION REPLAY RECORDS EVERYTHING. NOTHING IS MASKED. ⚠️

   This was a deliberate, informed choice by the site owner, confirmed
   twice — do not "fix" it without asking him first.

   What the replays contain, as readable content on PostHog's US servers:
     • full name, date of birth, country of birth, sex
     • email, phone, full delivery address
     • the customer's selfie
     • both sides of their driving licence
     • their handwritten signature

   That is a complete identity kit plus photo ID. A PostHog login is now
   worth as much to an attacker as the /admin login or the database itself.
   Put 2FA on the PostHog account and don't share the login.

   To make replays privacy-safe again, add these three lines back into
   session_recording below:
       maskAllInputs: true,
       maskTextSelector: '*',
       blockSelector: '.dropzone, .dz-preview, .sig-preview, #sig-canvas',
   ========================================================================= */

(function () {
  // ---- Official PostHog snippet (loads the real SDK, queues calls made
  // ---- before it finishes downloading) --------------------------------
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="Ni qi init Xi rn Rr tn sn Ki capture calculateEventProperties dn register register_once register_for_session unregister unregister_for_session fn getFeatureFlag getFeatureFlagPayload getFeatureFlagResult getAllFeatureFlags isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync pn identify setPersonProperties unsetPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset shutdown setIdentity clearIdentity get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException addExceptionStep captureLog startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty cn un createPersonProfile setInternalOrTestUser vn Qi yn opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing an debug Or Rt getPageViewId captureTraceFeedback captureTraceMetric Wi".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  posthog.init('phc_kP66BEV52XNvQU7JeFckrgqUTnVW4A6jRFbMoZ8jzT5H', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-05-30',

    // Never build a person profile for an anonymous visitor. We never call
    // identify(), so in practice no profiles get created at all.
    person_profiles: 'identified_only',

    session_recording: {
      // Record what the customer actually types. PostHog masks inputs by
      // default, so this has to be turned OFF explicitly. Owner's decision,
      // made knowingly — see the header comment.
      maskAllInputs: false,

      // maskTextSelector is deliberately not set, so ordinary page text
      // (the order recap: name, email, phone, address) records as-is too.

      // blockSelector is deliberately not set either. That means the selfie
      // and both sides of the driving licence appear in the replay as well.
      // This was asked for explicitly and confirmed twice. It is not an
      // oversight — do not "add the masking back" without asking the owner.
    },
  });
})();

/* -------------------------------------------------------------------------
   Small helper so page scripts can fire events without caring whether
   PostHog loaded (ad-blockers, network failures). Analytics must NEVER
   break the order flow — every call here is best-effort and swallowed.

   Usage:  window.fidpTrack('submit_failed', { reason: '...' })
   ------------------------------------------------------------------------- */
window.fidpTrack = function (name, props) {
  try {
    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(name, props || {});
    }
  } catch (e) {
    /* analytics is never worth breaking a page over */
  }
};
