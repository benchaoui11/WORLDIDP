(async function () {
  const cfg = window.WORLDIDP_SUPABASE || {};
  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // ── Auth guard: no session -> back to login ──
  const { data: { session } } = await client.auth.getSession();
  if (!session) { location.href = 'login.html'; return; }
  document.getElementById('admin-email').textContent = session.user.email;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await client.auth.signOut();
    location.href = 'login.html';
  });

  const MODE_LABEL = { offer: 'OFFER PAGE', white: 'WHITE PAGE', maintenance: 'MAINTENANCE' };
  const MODE_DOT_CLASS = { offer: 'live', white: 'neutral', maintenance: 'danger' };

  // ═══════════════════ Load current site mode ═══════════════════
  async function loadSiteMode() {
    const { data, error } = await client
      .from('site_settings')
      .select('mode, updated_at, updated_by')
      .eq('id', 1)
      .single();

    if (error || !data) return;
    renderMode(data.mode, data.updated_at, data.updated_by);
  }

  function renderMode(mode, updatedAt, updatedBy) {
    const modeText = document.getElementById('board-mode-text');
    modeText.textContent = MODE_LABEL[mode] || mode.toUpperCase();
    modeText.classList.remove('skeleton');

    const dot = document.getElementById('board-dot');
    dot.className = 'board-dot ' + (MODE_DOT_CLASS[mode] || 'live');

    document.getElementById('meta-last-switch').textContent = updatedAt ? timeAgo(updatedAt) : '—';
    document.getElementById('meta-last-by').textContent = updatedBy || '—';
    document.getElementById('stat-active-mode').textContent = MODE_LABEL[mode] || mode;
    document.getElementById('stat-active-mode').classList.remove('skeleton');

    ['offer', 'white', 'maintenance'].forEach((m) => {
      const card = document.getElementById('card-' + m);
      const pill = card.querySelector('[data-live-pill]');
      const isActive = m === mode;
      card.classList.toggle('is-active', isActive);
      pill.style.display = isActive ? 'inline-flex' : 'none';
    });
  }

  // ═══════════════════ Sales analytics (real `applications` table) ═══════════════════
  async function loadSales() {
    const { data, error } = await client
      .from('applications')
      .select('total, currency, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error || !data) return;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);

    let total = 0, today = 0, week = 0, revenue = 0;
    data.forEach((row) => {
      const created = new Date(row.created_at);
      total++;
      if (created >= startOfToday) today++;
      if (created >= startOfWeek) week++;
      revenue += Number(row.total) || 0;
    });

    setStat('stat-orders-total', total.toLocaleString());
    setStat('stat-orders-today', today.toLocaleString());
    setStat('stat-orders-week', week.toLocaleString());
    setStat('stat-revenue-total', '$' + revenue.toLocaleString(undefined, { maximumFractionDigits: 0 }));
  }

  // ═══════════════════ Visitor analytics (real `visitors` table) ═══════════════════
  async function loadVisitors() {
    const { data, error } = await client
      .from('visitors')
      .select('created_at, country, browser, os, device, referrer, landing_page')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error || !data) return;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);

    let today = 0, week = 0;
    data.forEach((row) => {
      const created = new Date(row.created_at);
      if (created >= startOfToday) today++;
      if (created >= startOfWeek) week++;
    });

    setStat('stat-visitors-total', data.length.toLocaleString() + (data.length >= 500 ? '+' : ''));
    setStat('stat-visitors-today', today.toLocaleString());
    setStat('stat-visitors-week', week.toLocaleString());

    const tbody = document.getElementById('visitors-tbody');
    document.getElementById('recent-visitors-count').textContent = data.length + ' recent';

    if (!data.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No visits recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.slice(0, 25).map((v) => `
      <tr>
        <td class="mono-cell">${timeAgo(v.created_at)}</td>
        <td>${v.country || '—'}</td>
        <td>${v.device || '—'}</td>
        <td>${[v.browser, v.os].filter(Boolean).join(' / ') || '—'}</td>
        <td>${truncate(v.referrer, 28) || 'Direct'}</td>
        <td class="mono-cell">${v.landing_page || '/'}</td>
      </tr>`).join('');
  }

  // ═══════════════════ Switch history ═══════════════════
  async function loadLog() {
    const { data, error } = await client
      .from('switch_log')
      .select('changed_at, from_mode, to_mode, changed_by')
      .order('changed_at', { ascending: false })
      .limit(20);

    const tbody = document.getElementById('log-tbody');
    if (error || !data || !data.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No switches yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map((r) => `
      <tr>
        <td class="mono-cell">${timeAgo(r.changed_at)}</td>
        <td><span class="tag ${r.from_mode}">${r.from_mode || '—'}</span></td>
        <td><span class="tag ${r.to_mode}">${r.to_mode}</span></td>
        <td>${r.changed_by || '—'}</td>
      </tr>`).join('');
  }

  // ═══════════════════ Switching (with confirmation modal) ═══════════════════
  const overlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalConfirm = document.getElementById('modal-confirm');
  const modalCancel = document.getElementById('modal-cancel');
  let pendingMode = null;

  const MODE_CONFIRM_COPY = {
    offer: { title: 'Activate the Offer Page?', body: 'Every visitor will immediately see the real production site again.' },
    white: { title: 'Activate the White Page?', body: 'Every visitor — including anyone browsing right now — will immediately see the neutral White Page instead of the Offer Page.' },
    maintenance: { title: 'Activate Maintenance mode?', body: 'Every visitor will see a brief "we\u2019ll be right back" page until you switch back.' },
  };

  document.querySelectorAll('.switch-card').forEach((card) => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      if (card.classList.contains('is-active')) return; // already live, nothing to do
      pendingMode = mode;
      const copy = MODE_CONFIRM_COPY[mode];
      modalTitle.textContent = copy.title;
      modalBody.textContent = copy.body;
      modalConfirm.className = 'modal-confirm' + (mode === 'maintenance' ? ' danger' : '');
      overlay.classList.add('show');
    });
  });

  modalCancel.addEventListener('click', () => overlay.classList.remove('show'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('show'); });

  modalConfirm.addEventListener('click', async () => {
    if (!pendingMode) return;
    modalConfirm.disabled = true;
    modalConfirm.textContent = 'Switching…';

    try {
      const res = await fetch('/api/switch-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode: pendingMode }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'Switch failed');

      renderMode(pendingMode, new Date().toISOString(), session.user.email);
      showToast(`Live site switched to ${MODE_LABEL[pendingMode]}`);
      loadLog();
    } catch (e) {
      showToast('Could not switch — please try again', true);
    } finally {
      overlay.classList.remove('show');
      modalConfirm.disabled = false;
      modalConfirm.textContent = 'Confirm switch';
      pendingMode = null;
    }
  });

  // ═══════════════════ Helpers ═══════════════════
  function setStat(id, text) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.classList.remove('skeleton');
  }

  function timeAgo(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    return days + 'd ago';
  }

  function truncate(str, n) {
    if (!str) return '';
    try { const u = new URL(str); return u.hostname; } catch { /* not a URL */ }
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  let toastTimer;
  function showToast(text, isError) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-text').textContent = text;
    toast.querySelector('.dot').style.background = isError ? '#ef4444' : '#2ecc71';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  // ═══════════════════ Init ═══════════════════
  loadSiteMode();
  loadSales();
  loadVisitors();
  loadLog();
})();
