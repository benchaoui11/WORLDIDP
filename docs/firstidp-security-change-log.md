# FirstIDP Security Change Log

## 2026-07-28 - Disable PostHog Session Replay

File changed:

- `/Users/soufiane/Desktop/FIRSTIDP-FINAL2/posthog-init.js`

Reason:

- PostHog Session Replay was configured in a way that could capture unmasked personal data, document previews, uploaded identity images, signature canvas content, checkout details, and other sensitive funnel information.

Expected behavior:

- Privacy-safe PostHog event analytics remains available through `window.fidpTrack`.
- PostHog Session Replay is disabled.
- Checkout, upload, email, Supabase submission, site switching, and public routing behavior are unchanged.

Risk level:

- Low operational risk.
- Intentional analytics impact: new replay recordings should stop.

Rollback:

- Revert the `disable_session_recording: true` change and restore the previous `session_recording` configuration from version control or backup.
- Rollback is not recommended unless all sensitive funnel/admin pages are blocked or masked from replay first.

Historical data note:

- This code change does not delete recordings already stored in PostHog. Historical recordings may need to be reviewed and deleted manually inside PostHog.
