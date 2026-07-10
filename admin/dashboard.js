(async function () {
  const cfg = window.WORLDIDP_SUPABASE || {};
  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // ── Auth guard: no session -> back to login ── (unchanged)
  const { data: { session } } = await client.auth.getSession();
  if (!session) { location.href = '/admin/login.html'; return; }
  document.getElementById('admin-email').textContent = session.user.email;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await client.auth.signOut();
    location.href = '/admin/login.html';
  });

  const MODE_LABEL = { offer: 'OFFER PAGE', white: 'WHITE PAGE', maintenance: 'MAINTENANCE' };
  const MODE_DOT_CLASS = { offer: 'live', white: 'neutral', maintenance: 'danger' };

  // ═══════════════════ Sidebar navigation ═══════════════════
  const sideLinks = Array.from(document.querySelectorAll('.side-link'));
  const pages = Array.from(document.querySelectorAll('.page'));
  let chartsRendered = false;

  sideLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const target = link.dataset.page;
      sideLinks.forEach((l) => l.classList.toggle('is-active', l === link));
      pages.forEach((p) => p.classList.toggle('is-active', p.dataset.pagePanel === target));
      // Charts need their canvas to be visible (non-zero size) to size correctly —
      // render them the first time the Analytics tab is actually opened.
      if (target === 'analytics' && !chartsRendered && _coreDataReady) {
        renderCharts();
        chartsRendered = true;
      }
    });
  });

  // ═══════════════════ Load current site mode ═══════════════════ (unchanged)
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

  // ═══════════════════ Visitor analytics (real `visitors` table) ═══════════════════ (unchanged)
  let _visitorsCache = [];
  async function loadVisitors() {
    const { data, error } = await client
      .from('visitors')
      .select('created_at, country, browser, os, device, referrer, landing_page')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error || !data) return;
    _visitorsCache = data;

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
    setStat('ov-visitors-total', data.length.toLocaleString() + (data.length >= 500 ? '+' : ''));

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

  // ═══════════════════ Switch history ═══════════════════ (unchanged)
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

  // ═══════════════════ Switching (with confirmation modal) ═══════════════════ (unchanged)
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
      showToast('Error: ' + (e.message || 'unknown'), true); console.error('[switch-mode]', e);
    } finally {
      overlay.classList.remove('show');
      modalConfirm.disabled = false;
      modalConfirm.textContent = 'Confirm switch';
      pendingMode = null;
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // Overview + Analytics + Applications — all built from `applications`
  // alone. No online payment is collected at submission, so there is
  // no separate "orders" table to read — every application already
  // carries its package, price and documents.
  // ═══════════════════════════════════════════════════════════════
  let _applications = [];
  let _coreDataReady = false;

  function showBanner(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function packageLabel(a) {
    const fmt = a.format === 'physical' ? 'Print + Digital' : 'Digital Only';
    const yrs = a.validity_years ? `${a.validity_years} Year${a.validity_years > 1 ? 's' : ''}` : '';
    return [fmt, yrs].filter(Boolean).join(' — ');
  }

  async function loadCoreData() {
    const appsRes = await client.from('applications')
      .select('ref, status, format, validity_years, total, currency, first_name, last_name, email, phone, destination_country, shipping_method, address_line1, address_line2, state_region, city, postal_code, vip_processing, file_selfie, file_license_front, file_license_back, file_signature, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (appsRes.error) {
      console.error('[applications]', appsRes.error);
      showBanner('overview-error', 'Could not load applications: ' + appsRes.error.message);
      showBanner('orders-error', 'Could not load applications: ' + appsRes.error.message);
    } else {
      _applications = appsRes.data || [];
    }

    _coreDataReady = true;
    renderOverview();
    renderOrdersFilters();
    renderOrders();
    renderPaidOrders();
    if (document.querySelector('.page.is-active')?.dataset.pagePanel === 'analytics') {
      renderCharts();
      chartsRendered = true;
    }
  }

  // ─────────────────── Overview cards ───────────────────
  function renderOverview() {
    const totalApps = _applications.length;
    const completedApps = _applications.filter((a) => (a.status || '').toLowerCase() === 'completed').length;
    const pendingApps = _applications.filter((a) => ['submitted', 'reviewing'].includes((a.status || '').toLowerCase())).length;
    const totalValue = _applications.reduce((sum, a) => sum + (Number(a.total) || 0), 0);

    setStat('ov-app-total', totalApps.toLocaleString());
    setStat('ov-app-pending', pendingApps.toLocaleString());
    setStat('ov-app-completed', completedApps.toLocaleString());
    setStat('ov-app-value', '$' + totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 }));
  }

  // ─────────────────── Applications table: filters ───────────────────
  function renderOrdersFilters() {
    const productSel = document.getElementById('f-product');
    const appStatusSel = document.getElementById('f-app-status');

    const packages = Array.from(new Set(_applications.map((a) => packageLabel(a)).filter(Boolean))).sort();
    productSel.innerHTML = '<option value="">Package: all</option>' + packages.map((p) => `<option value="${p}">${p}</option>`).join('');

    const appStatuses = Array.from(new Set(_applications.map((a) => a.status).filter(Boolean))).sort();
    appStatusSel.innerHTML = '<option value="">Application status: all</option>' + appStatuses.map((s) => `<option value="${s}">${s}</option>`).join('');
  }

  function getFilters() {
    return {
      search: document.getElementById('f-search').value.trim().toLowerCase(),
      appStatus: document.getElementById('f-app-status').value,
      product: document.getElementById('f-product').value,
      dateFrom: document.getElementById('f-date-from').value,
      dateTo: document.getElementById('f-date-to').value,
    };
  }

  ['f-search', 'f-app-status', 'f-product', 'f-date-from', 'f-date-to'].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderOrders);
  });
  document.getElementById('f-clear').addEventListener('click', () => {
    ['f-search', 'f-app-status', 'f-product', 'f-date-from', 'f-date-to'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    renderOrders();
  });

  function renderOrders() {
    const f = getFilters();
    const tbody = document.getElementById('orders-tbody');

    const rows = _applications.filter((a) => {
      if (f.search) {
        const hay = (a.ref + ' ' + (a.email || '')).toLowerCase();
        if (!hay.includes(f.search)) return false;
      }
      if (f.appStatus && a.status !== f.appStatus) return false;
      if (f.product && packageLabel(a) !== f.product) return false;
      if (f.dateFrom && new Date(a.created_at) < new Date(f.dateFrom)) return false;
      if (f.dateTo && new Date(a.created_at) > new Date(f.dateTo + 'T23:59:59')) return false;
      return true;
    });

    document.getElementById('orders-count').textContent = rows.length + ' of ' + _applications.length;

    if (!_coreDataReady) return; // still loading
    if (!rows.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="8">${_applications.length ? 'No applications match your filters.' : 'No applications yet.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((a, i) => {
      const rowId = 'ord-' + i;
      const name = [a.first_name, a.last_name].filter(Boolean).join(' ');
      const address = [a.address_line1, a.address_line2, a.city, a.state_region, a.postal_code].filter(Boolean).join(', ');
      return `
        <tr>
          <td><button class="row-expand-btn" data-expand="${rowId}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button></td>
          <td class="mono-cell">${a.ref}</td>
          <td>${a.email || '—'}</td>
          <td class="mono-cell">${packageLabel(a)}</td>
          <td>$${Number(a.total || 0).toLocaleString()}</td>
          <td><span class="status-pill ${a.status}">${a.status || '—'}</span></td>
          <td class="mono-cell">${timeAgo(a.created_at)}</td>
          <td></td>
        </tr>
        <tr class="detail-row" id="${rowId}" style="display:none;">
          <td colspan="8">
            <div class="detail-grid">
              <div><div class="dk">Applicant</div><div class="dv">${name || '—'}</div></div>
              <div><div class="dk">Phone</div><div class="dv">${a.phone || '—'}</div></div>
              <div><div class="dk">Destination country</div><div class="dv">${a.destination_country || '—'}</div></div>
              <div><div class="dk">Fast Processing</div><div class="dv">${a.vip_processing ? 'Yes' : 'No'}</div></div>
              ${a.format === 'physical' ? `<div><div class="dk">Shipping address</div><div class="dv">${address || '—'}</div></div>` : ''}
              <div>
                <div class="dk">Status</div>
                <div class="dv" style="display:flex; align-items:center;">
                  <select class="status-select" data-status-select="${rowId}" data-ref="${a.ref}">
                    ${['submitted','reviewing','paid','completed','rejected'].map((s) => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
                  </select>
                  <span class="status-save-hint" data-status-hint="${rowId}">Saved</span>
                </div>
              </div>
            </div>
            <button class="view-docs-btn" data-docs="${rowId}">View Documents</button>
          </td>
        </tr>`;
    }).join('');

    // Wire expand toggles + docs buttons + status changes for this render pass.
    rows.forEach((a, i) => {
      const rowId = 'ord-' + i;
      const btn = tbody.querySelector(`[data-expand="${rowId}"]`);
      const detail = document.getElementById(rowId);
      btn.addEventListener('click', () => {
        const open = detail.style.display !== 'none';
        detail.style.display = open ? 'none' : '';
        btn.classList.toggle('is-open', !open);
      });
      const docsBtn = tbody.querySelector(`[data-docs="${rowId}"]`);
      if (docsBtn) {
        docsBtn.addEventListener('click', () => openDocsModal(a, a.ref));
      }
      const statusSelect = tbody.querySelector(`[data-status-select="${rowId}"]`);
      if (statusSelect) {
        statusSelect.addEventListener('change', () => updateApplicationStatus(a, statusSelect.value, rowId));
      }
    });
  }

  // ─────────────────── Change an application's status ───────────────────
  async function updateApplicationStatus(app, newStatus, rowId) {
    const hint = document.querySelector(`[data-status-hint="${rowId}"]`);
    const { error } = await client.from('applications').update({ status: newStatus }).eq('ref', app.ref);

    if (error) {
      console.error('[update status]', error);
      if (hint) { hint.textContent = 'Failed to save'; hint.className = 'status-save-hint show err'; }
      showToast('Could not update status: ' + error.message, true);
      return;
    }

    app.status = newStatus; // keep local cache in sync
    if (hint) {
      hint.textContent = 'Saved';
      hint.className = 'status-save-hint show ok';
      setTimeout(() => hint.classList.remove('show'), 1800);
    }
    showToast(`${app.ref} marked as ${newStatus}`);
    renderOverview();
    renderPaidOrders();
  }

  // ─────────────────── Orders page: applications marked paid/completed ───────────────────
  function renderPaidOrders() {
    const tbody = document.getElementById('paid-orders-tbody');
    if (!tbody) return;
    const rows = _applications.filter((a) => a.status === 'paid' || a.status === 'completed');
    document.getElementById('paid-orders-count').textContent = rows.length + ' order' + (rows.length === 1 ? '' : 's');

    if (!_coreDataReady) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No paid orders yet.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((a, i) => {
      const rowId = 'po-' + i;
      const name = [a.first_name, a.last_name].filter(Boolean).join(' ');
      const address = [a.address_line1, a.address_line2, a.city, a.state_region, a.postal_code].filter(Boolean).join(', ');
      return `
        <tr>
          <td><button class="row-expand-btn" data-expand="${rowId}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button></td>
          <td class="mono-cell">${a.ref}</td>
          <td>${a.email || '—'}</td>
          <td class="mono-cell">${packageLabel(a)}</td>
          <td>$${Number(a.total || 0).toLocaleString()}</td>
          <td><span class="status-pill ${a.status}">${a.status}</span></td>
          <td class="mono-cell">${timeAgo(a.created_at)}</td>
          <td></td>
        </tr>
        <tr class="detail-row" id="${rowId}" style="display:none;">
          <td colspan="8">
            <div class="detail-grid">
              <div><div class="dk">Applicant</div><div class="dv">${name || '—'}</div></div>
              <div><div class="dk">Phone</div><div class="dv">${a.phone || '—'}</div></div>
              <div><div class="dk">Destination country</div><div class="dv">${a.destination_country || '—'}</div></div>
              <div><div class="dk">Fast Processing</div><div class="dv">${a.vip_processing ? 'Yes' : 'No'}</div></div>
              ${a.format === 'physical' ? `<div><div class="dk">Shipping address</div><div class="dv">${address || '—'}</div></div>` : ''}
            </div>
            <button class="view-docs-btn" data-docs="${rowId}">View Documents</button>
          </td>
        </tr>`;
    }).join('');

    rows.forEach((a, i) => {
      const rowId = 'po-' + i;
      const btn = tbody.querySelector(`[data-expand="${rowId}"]`);
      const detail = document.getElementById(rowId);
      btn.addEventListener('click', () => {
        const open = detail.style.display !== 'none';
        detail.style.display = open ? 'none' : '';
        btn.classList.toggle('is-open', !open);
      });
      const docsBtn = tbody.querySelector(`[data-docs="${rowId}"]`);
      if (docsBtn) docsBtn.addEventListener('click', () => openDocsModal(a, a.ref));
    });
  }

  // ─────────────────── Documents viewer ───────────────────
  const docsOverlay = document.getElementById('docs-overlay');
  const docsGrid = document.getElementById('docs-grid');
  const docsSub = document.getElementById('docs-sub');
  document.getElementById('docs-close').addEventListener('click', () => docsOverlay.classList.remove('show'));
  docsOverlay.addEventListener('click', (e) => { if (e.target === docsOverlay) docsOverlay.classList.remove('show'); });

  function publicUrlFor(path) {
    if (!path) return null;
    try { return client.storage.from(cfg.BUCKET).getPublicUrl(path).data.publicUrl; } catch { return null; }
  }

  function docSlot(label, path) {
    const url = publicUrlFor(path);
    if (!url) {
      return `<div class="doc-slot"><div class="doc-label">${label}</div><div class="doc-empty">Not uploaded</div></div>`;
    }
    return `<div class="doc-slot"><div class="doc-label">${label}</div><img src="${url}" alt="${label}" loading="lazy" /><a class="doc-open" href="${url}" target="_blank" rel="noopener">Open full size ↗</a></div>`;
  }

  function openDocsModal(app, orderRef) {
    docsSub.textContent = 'Order reference — ' + orderRef;
    if (!app) {
      docsGrid.innerHTML = '<p style="color:var(--muted); font-size:.85rem;">No linked application found for this order.</p>';
    } else {
      docsGrid.innerHTML = [
        docSlot('Driver license — front', app.file_license_front),
        docSlot('Driver license — back', app.file_license_back),
        docSlot('Personal photo', app.file_selfie),
        docSlot('Signature', app.file_signature),
      ].join('');
    }
    docsOverlay.classList.add('show');
  }

  // ─────────────────── Charts (Chart.js) ───────────────────
  const CHART_COLORS = { brand: '#3168f3', live: '#2ecc71', neutral: '#f5b301', muted: '#8a93b8' };
  let _chartInstances = [];

  function last14Days() {
    const days = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }

  function groupByDay(rows, dateField, valueFn) {
    const days = last14Days();
    const buckets = Object.fromEntries(days.map((d) => [d, 0]));
    rows.forEach((row) => {
      const day = (row[dateField] || '').slice(0, 10);
      if (day in buckets) buckets[day] += valueFn ? valueFn(row) : 1;
    });
    return { labels: days.map((d) => d.slice(5)), values: days.map((d) => buckets[d]) };
  }

  function drawChart(canvasId, labels, values, color, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    _chartInstances.push(new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label, data: values, borderColor: color, backgroundColor: color + '22',
          fill: true, tension: .3, pointRadius: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8a93b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.05)' } },
          y: { beginAtZero: true, ticks: { color: '#8a93b8', font: { size: 10 }, precision: 0 }, grid: { color: 'rgba(255,255,255,.05)' } },
        },
      },
    }));
  }

  function renderCharts() {
    _chartInstances.forEach((c) => c.destroy());
    _chartInstances = [];

    const apps = groupByDay(_applications, 'created_at');
    drawChart('chart-applications', apps.labels, apps.values, CHART_COLORS.brand, 'Applications');

    const value = groupByDay(_applications, 'created_at', (a) => Number(a.total) || 0);
    drawChart('chart-revenue', value.labels, value.values, CHART_COLORS.live, 'Submitted value ($)');

    const visitors = groupByDay(_visitorsCache, 'created_at');
    drawChart('chart-visitors', visitors.labels, visitors.values, CHART_COLORS.muted, 'Visitors');
  }

  // ═══════════════════ Helpers ═══════════════════
  function setStat(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
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
  loadLog();
  loadVisitors().then(() => { if (chartsRendered) renderCharts(); });
  loadCoreData();
})();
