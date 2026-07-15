// ════════════════════════════════════════════════════════════════
// POST /api/send-admin-notification
// Body: { refs, firstName, lastName, email, phone, format, validYears,
//         destinationCountry, total, hasExpress, hasCompanion,
//         companionFirstName?, companionLastName?, companionTotal? }
// ════════════════════════════════════════════════════════════════
// Sends a "New Order" alert to the business inbox right after a
// customer successfully submits. Fire-and-forget — like the customer
// confirmation email, this never blocks or breaks the checkout flow.
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'FirstIDP Orders <contact@firstidp.com>';
// Change this to any inbox you actually check — no code changes needed.
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'contact@firstidp.com';

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

  const {
    refs, orderNumber, firstName, lastName, email, phone, format, validYears,
    destinationCountry, total, hasExpress, hasCompanion,
    companionFirstName, companionLastName, companionTotal,
  } = body;

  if (!Array.isArray(refs) || !refs.length) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing required fields' }), { status: 400 });
  }
  if (!RESEND_API_KEY) {
    console.error('[send-admin-notification] RESEND_API_KEY is not configured');
    return new Response(JSON.stringify({ ok: false, error: 'Email service not configured' }), { status: 500 });
  }

  const packageLabel = (format === 'physical' ? 'Print + Digital' : 'Digital Only') +
    (validYears ? ` — ${validYears} Year${validYears > 1 ? 's' : ''}` : '');
  const grandTotal = (Number(total) || 0) + (hasCompanion ? (Number(companionTotal) || 0) : 0);
  const shortId = orderNumber ? 'N' + String(orderNumber).padStart(3, '0') : '—';

  const rows = [
    ['Customer', `${escapeHtml(firstName || '')} ${escapeHtml(lastName || '')}`.trim() || '—'],
    ['Email', escapeHtml(email) || '—'],
    ['Phone', escapeHtml(phone) || '—'],
    ['Package', escapeHtml(packageLabel)],
    ['Destination', escapeHtml(destinationCountry) || '—'],
    ['Fast Processing', hasExpress ? 'Yes' : 'No'],
  ];
  if (hasCompanion) {
    rows.push(['Travel companion', `${escapeHtml(companionFirstName || '')} ${escapeHtml(companionLastName || '')}`.trim() || '—']);
  }

  const rowsHtml = rows.map(([k, v]) => `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #eef1f8;font-size:13px;color:#8993b8;width:150px;">${k}</td>
      <td style="padding:9px 0;border-bottom:1px solid #eef1f8;font-size:13px;color:#0b1f4d;font-weight:600;">${v}</td>
    </tr>`).join('');

  const refsHtml = refs.map((r, i) => `
    <div style="font-family:'Courier New',Courier,monospace;font-size:14px;font-weight:700;color:#0b1f4d;margin:${i > 0 ? '6px' : '0'} 0 0;">${escapeHtml(r)}</div>`).join('');

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#eef2ff;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;">

        <tr><td style="background:linear-gradient(135deg,#15a06b,#1ec98a);padding:22px 28px;">
          <span style="color:#ffffff;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;">New order received</span>
          <div style="color:#ffffff;font-size:20px;font-weight:800;margin-top:4px;">Order N&deg; ${escapeHtml(shortId)}${hasCompanion ? ' (2 travelers)' : ''}</div>
        </td></tr>

        <tr><td style="padding:24px 28px 8px;">
          <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#5b6690;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;">Tracking number${refs.length > 1 ? 's' : ''}</div>
          <div style="padding:12px 16px;background:#f4f7ff;border:1.5px solid #dbe4fb;border-radius:12px;">${refsHtml}</div>
        </td></tr>

        <tr><td style="padding:16px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
        </td></tr>

        <tr><td style="padding:20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:16px 18px;background:#e7f8f0;border-radius:14px;">
              <span style="font-size:12px;font-weight:700;color:#0f7a51;text-transform:uppercase;letter-spacing:.04em;">Total</span>
              <div style="font-size:24px;font-weight:800;color:#0b1f4d;margin-top:2px;">$${grandTotal.toLocaleString()} USD</div>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:4px 28px 28px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr><td style="background:linear-gradient(135deg,#1c3da0,#3168f3);border-radius:12px;">
              <a href="https://firstidp.com/admin" style="display:block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;">Open in Control Tower</a>
            </td></tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `New order received — Order N° ${shortId}${hasCompanion ? ' (2 travelers)' : ''}`,
    ``,
    `Tracking number(s): ${refs.join(', ')}`,
    ``,
    ...rows.map(([k, v]) => `${k}: ${v.replace(/<[^>]+>/g, '')}`),
    ``,
    `Total: $${grandTotal.toLocaleString()} USD`,
    ``,
    `View in Control Tower: https://firstidp.com/admin`,
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
        to: [ADMIN_EMAIL],
        subject: `New order — N° ${shortId}${hasCompanion ? ' (2 travelers)' : ''} — $${grandTotal.toLocaleString()}`,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[send-admin-notification] Resend error:', errText);
      return new Response(JSON.stringify({ ok: false, error: 'Email provider error' }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error('[send-admin-notification] failed:', e);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to send email' }), { status: 500 });
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
