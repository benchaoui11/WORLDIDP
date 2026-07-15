// ════════════════════════════════════════════════════════════════
// POST /api/send-confirmation-email
// Body: { to, firstName, refs: ["WIDP-...", "WIDP-...-2"?], format,
//         validYears, hasCompanion, companionFirstName? }
// ════════════════════════════════════════════════════════════════
// Sends the "application received" confirmation email via Resend,
// right after a customer successfully submits. This NEVER blocks or
// breaks the checkout flow — if it fails, the application is already
// safely saved in Supabase; the email is a courtesy notification only.
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'FirstIDP <contact@firstidp.com>';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request body' }), { status: 400 });
  }

  const { to, firstName, refs, format, validYears, hasCompanion, companionFirstName } = body;

  if (!to || !Array.isArray(refs) || !refs.length) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing required fields' }), { status: 400 });
  }
  if (!RESEND_API_KEY) {
    console.error('[send-confirmation-email] RESEND_API_KEY is not configured');
    return new Response(JSON.stringify({ ok: false, error: 'Email service not configured' }), { status: 500 });
  }

  const name = escapeHtml(firstName || 'there');
  const packageLabel = (format === 'physical' ? 'Print + Digital' : 'Digital Only') +
    (validYears ? ` — ${validYears} Year${validYears > 1 ? 's' : ''}` : '');

  const refsHtml = refs.map((r, i) => {
    const who = hasCompanion
      ? (i === 0 ? 'You' : escapeHtml(companionFirstName || 'Travel companion'))
      : null;
    return `
      <tr>
        <td style="padding:0 0 10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:16px 20px;background:#f4f7ff;border:1.5px solid #dbe4fb;border-radius:14px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#5b6690;text-transform:uppercase;letter-spacing:.06em;margin:0 0 5px;">${who ? who + ' — ' : ''}Tracking number</div>
                <div style="font-family:'Courier New',Courier,monospace;font-size:17px;font-weight:700;color:#0b1f4d;letter-spacing:.02em;">${escapeHtml(r)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  const steps = [
    ['1', 'Document review', 'Our team reviews your documents — usually within 5–15 minutes.'],
    ['2', 'Payment link', 'As soon as your documents are approved, we email you a secure payment link.'],
    ['3', 'Your IDP is prepared', format === 'physical'
      ? 'Digital delivery in minutes, or shipped to you if you chose Print + Digital.'
      : 'Digital delivery in minutes.'],
  ];
  const stepsHtml = steps.map(([n, title, body]) => `
    <tr>
      <td width="34" valign="top" style="padding:0 12px 20px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="26" height="26" align="center" valign="middle" style="background:#1c3da0;border-radius:50%;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#ffffff;">${n}</td></tr></table>
      </td>
      <td valign="top" style="padding:0 0 20px;font-family:Arial,Helvetica,sans-serif;">
        <div style="font-size:14px;font-weight:700;color:#0b1f4d;margin:0 0 2px;">${title}</div>
        <div style="font-size:13px;line-height:1.55;color:#6b7488;">${body}</div>
      </td>
    </tr>`).join('');

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;">
    <tr><td align="center" style="padding:36px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:22px;overflow:hidden;">

        <tr><td style="background:linear-gradient(135deg,#1c3da0,#3168f3);padding:26px 32px;">
          <span style="color:#ffffff;font-size:19px;font-weight:800;letter-spacing:-.01em;">FirstIDP</span>
        </td></tr>

        <tr><td style="padding:36px 32px 8px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
            <tr><td width="56" height="56" align="center" valign="middle" style="background:#e7f8f0;border-radius:50%;">
              <span style="font-size:26px;line-height:1;color:#15a06b;">&#10003;</span>
            </td></tr>
          </table>
          <h1 style="margin:0 0 8px;font-size:22px;color:#0b1f4d;">Application received, ${name}!</h1>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7488;">
            Thank you — we've got everything we need to get started on your<br /><b style="color:#0b1f4d;">${packageLabel}</b> International Driving Permit${hasCompanion ? ' order' : ''}.
          </p>
        </td></tr>

        <tr><td style="padding:24px 32px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${refsHtml}</table>
        </td></tr>

        <tr><td style="padding:4px 32px 8px;">
          <div style="height:1px;background:#eef1f8;margin:12px 0 24px;"></div>
          <div style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#5b6690;text-transform:uppercase;letter-spacing:.06em;margin:0 0 16px;">What happens next</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${stepsHtml}</table>
        </td></tr>

        <tr><td style="padding:4px 32px 32px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr><td style="background:linear-gradient(135deg,#1c3da0,#3168f3);border-radius:12px;">
              <a href="https://firstidp.com/track-order.html" style="display:block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Track my order</a>
            </td></tr>
          </table>
          <p style="margin:20px 0 0;font-size:12px;color:#98a2c0;">
            Questions? Reply to this email or contact us at <a href="mailto:contact@firstidp.com" style="color:#3168f3;text-decoration:none;">contact@firstidp.com</a>
          </p>
        </td></tr>

        <tr><td style="padding:18px 32px;background:#f7f9ff;border-top:1px solid #eef1f8;">
          <p style="margin:0;font-size:11px;color:#98a2c0;">&copy; 2026 FirstIDP International LLC. All rights reserved.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  // A plain-text version is one of the highest-impact things that keeps a
  // transactional email out of spam — many filters penalize HTML-only mail.
  const text = [
    `Application received, ${firstName || 'there'}!`,
    ``,
    `Thank you — we've got everything we need to get started on your ${packageLabel} International Driving Permit${hasCompanion ? ' order' : ''}.`,
    ``,
    ...refs.map((r, i) => {
      const who = hasCompanion ? (i === 0 ? 'You' : (companionFirstName || 'Travel companion')) : null;
      return (who ? `${who} — ` : '') + `Tracking number: ${r}`;
    }),
    ``,
    `What happens next:`,
    `1. Document review — usually within 5–15 minutes.`,
    `2. Payment link — emailed to you as soon as your documents are approved.`,
    `3. Your IDP is prepared — ${format === 'physical' ? 'digital delivery in minutes, or shipped if you chose Print + Digital.' : 'digital delivery in minutes.'}`,
    ``,
    `Track your order: https://firstidp.com/track-order.html`,
    ``,
    `Questions? Contact us at contact@firstidp.com`,
    ``,
    `FirstIDP International LLC`,
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        reply_to: 'contact@firstidp.com',
        subject: hasCompanion ? 'Your 2 applications have been received — FirstIDP' : 'Your application has been received — FirstIDP',
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[send-confirmation-email] Resend error:', errText);
      return new Response(JSON.stringify({ ok: false, error: 'Email provider error' }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error('[send-confirmation-email] failed:', e);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to send email' }), { status: 500 });
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
