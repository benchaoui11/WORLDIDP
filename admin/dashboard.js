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
        <td>${escapeHtml(v.country) || '—'}</td>
        <td>${escapeHtml(v.device) || '—'}</td>
        <td>${escapeHtml([v.browser, v.os].filter(Boolean).join(' / ')) || '—'}</td>
        <td>${escapeHtml(truncate(v.referrer, 28)) || 'Direct'}</td>
        <td class="mono-cell">${escapeHtml(v.landing_page) || '/'}</td>
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
        <td>${escapeHtml(r.changed_by) || '—'}</td>
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
    const y = Number(a.validity_years) || 0; // defensively force numeric — never echo raw text
    const yrs = y ? `${y} Year${y > 1 ? 's' : ''}` : '';
    return [fmt, yrs].filter(Boolean).join(' — ');
  }

  async function loadCoreData() {
    const appsRes = await client.from('applications')
      .select('ref, status, format, validity_years, total, currency, first_name, last_name, email, phone, destination_country, shipping_method, address_line1, address_line2, state_region, city, postal_code, vip_processing, group_ref, is_companion, file_selfie, file_license_front, file_license_back, file_signature, created_at')
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
    appStatusSel.innerHTML = '<option value="">Application status: all</option>' + appStatuses.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
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

  // ─────────────────── Grouped order helpers (travel companion support) ───────────────────
  // A companion's row points back to its primary via group_ref; the primary's
  // own key is just its own ref. This lets us always render ONE order row
  // per travel party, never split across two lines.
  function groupKey(a) { return a.group_ref || a.ref; }

  function memberDetailHTML(a, subId, showLabel) {
    const name = escapeHtml([a.first_name, a.last_name].filter(Boolean).join(' '));
    const address = escapeHtml([a.address_line1, a.address_line2, a.city, a.state_region, a.postal_code].filter(Boolean).join(', '));
    const phone = escapeHtml(a.phone);
    const destCountry = escapeHtml(a.destination_country);
    const refSafe = escapeHtml(a.ref);
    const label = showLabel ? (a.is_companion ? 'Travel companion' : 'Primary traveler') : null;
    return `
      <div class="traveler-block">
        ${label ? `<div class="traveler-label">${label} <span class="mono-cell">— ${refSafe}</span></div>` : ''}
        <div class="detail-grid">
          <div><div class="dk">Applicant</div><div class="dv">${name || '—'}</div></div>
          <div><div class="dk">Phone</div><div class="dv">${phone || '—'}</div></div>
          <div><div class="dk">Destination country</div><div class="dv">${destCountry || '—'}</div></div>
          <div><div class="dk">Fast Processing</div><div class="dv">${a.vip_processing ? 'Yes' : 'No'}</div></div>
          ${a.format === 'physical' ? `<div><div class="dk">Shipping address</div><div class="dv">${address || '—'}</div></div>` : ''}
          <div>
            <div class="dk">Status</div>
            <div class="dv" style="display:flex; align-items:center;">
              <select class="status-select" data-status-select="${subId}" data-ref="${refSafe}">
                ${['submitted','reviewing','paid','completed','rejected'].map((s) => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
              </select>
              <span class="status-save-hint" data-status-hint="${subId}">Saved</span>
            </div>
          </div>
        </div>
        <button class="view-docs-btn" data-docs="${subId}">View Documents${label ? ` — ${escapeHtml(a.first_name) || label}` : ''}</button>
      </div>`;
  }

  function renderOrders() {
    const f = getFilters();
    const tbody = document.getElementById('orders-tbody');

    const matched = _applications.filter((a) => {
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

    // Group by travel party — a companion always stays together with their
    // primary applicant as ONE order, even if only one of them individually
    // matched the filter (so a party never gets split apart on screen).
    const matchedKeys = new Set(matched.map(groupKey));
    const groups = new Map();
    _applications.forEach((a) => {
      const key = groupKey(a);
      if (!matchedKeys.has(key)) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    });
    groups.forEach((members) => members.sort((x, y) => (x.is_companion ? 1 : 0) - (y.is_companion ? 1 : 0)));
    const groupList = Array.from(groups.values()).sort((g1, g2) => new Date(g2[0].created_at) - new Date(g1[0].created_at));

    const totalGroups = new Set(_applications.map(groupKey)).size;
    document.getElementById('orders-count').textContent = groupList.length + ' of ' + totalGroups;

    if (!_coreDataReady) return; // still loading
    if (!groupList.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="8">${_applications.length ? 'No applications match your filters.' : 'No applications yet.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = groupList.map((members, i) => {
      const rowId = 'ord-' + i;
      const primary = members[0];
      const isGroup = members.length > 1;
      const totalValue = members.reduce((s, m) => s + (Number(m.total) || 0), 0);
      const refSafe = escapeHtml(primary.ref);
      const email = escapeHtml(primary.email);
      const statuses = new Set(members.map((m) => m.status));
      const statusCell = statuses.size === 1
        ? `<span class="status-pill ${safeStatusClass(primary.status)}">${escapeHtml(primary.status) || '—'}</span>`
        : `<span class="status-pill mixed" title="Travelers have different statuses">Mixed</span>`;

      return `
        <tr>
          <td><button class="row-expand-btn" data-expand="${rowId}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button></td>
          <td class="mono-cell">${refSafe}${isGroup ? ` <span class="party-badge" title="Travel party of ${members.length}">👥 ${members.length}</span>` : ''}</td>
          <td>${email || '—'}</td>
          <td class="mono-cell">${packageLabel(primary)}${isGroup ? ` · ${members.length} travelers` : ''}</td>
          <td>$${totalValue.toLocaleString()}</td>
          <td>${statusCell}</td>
          <td class="mono-cell">${timeAgo(primary.created_at)}</td>
          <td></td>
        </tr>
        <tr class="detail-row" id="${rowId}" style="display:none;">
          <td colspan="8">
            ${members.map((a, mi) => memberDetailHTML(a, rowId + '-m' + mi, isGroup)).join(isGroup ? '<hr class="traveler-divider" />' : '')}
          </td>
        </tr>`;
    }).join('');

    // Wire expand toggles, docs buttons, and status changes for every
    // traveler in every group rendered this pass.
    groupList.forEach((members, i) => {
      const rowId = 'ord-' + i;
      const btn = tbody.querySelector(`[data-expand="${rowId}"]`);
      const detail = document.getElementById(rowId);
      btn.addEventListener('click', () => {
        const open = detail.style.display !== 'none';
        detail.style.display = open ? 'none' : '';
        btn.classList.toggle('is-open', !open);
      });
      members.forEach((member, mi) => {
        const subId = rowId + '-m' + mi;
        const docsBtn = tbody.querySelector(`[data-docs="${subId}"]`);
        if (docsBtn) docsBtn.addEventListener('click', () => openDocsModal(member, member.ref));
        const statusSelect = tbody.querySelector(`[data-status-select="${subId}"]`);
        if (statusSelect) statusSelect.addEventListener('change', () => updateApplicationStatus(member, statusSelect.value, subId));
      });
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

    // Show the WHOLE travel party if any member is paid/completed — so a
    // companion's order is never lost from view just because their own
    // status hasn't been updated yet.
    const paidKeys = new Set(
      _applications.filter((a) => a.status === 'paid' || a.status === 'completed').map(groupKey)
    );
    const groups = new Map();
    _applications.forEach((a) => {
      const key = groupKey(a);
      if (!paidKeys.has(key)) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    });
    groups.forEach((members) => members.sort((x, y) => (x.is_companion ? 1 : 0) - (y.is_companion ? 1 : 0)));
    const groupList = Array.from(groups.values()).sort((g1, g2) => new Date(g2[0].created_at) - new Date(g1[0].created_at));

    document.getElementById('paid-orders-count').textContent = groupList.length + ' order' + (groupList.length === 1 ? '' : 's');

    if (!_coreDataReady) return;
    if (!groupList.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No paid orders yet.</td></tr>';
      return;
    }

    tbody.innerHTML = groupList.map((members, i) => {
      const rowId = 'po-' + i;
      const primary = members[0];
      const isGroup = members.length > 1;
      const totalValue = members.reduce((s, m) => s + (Number(m.total) || 0), 0);
      const refSafe = escapeHtml(primary.ref);
      const email = escapeHtml(primary.email);
      const statuses = new Set(members.map((m) => m.status));
      const statusCell = statuses.size === 1
        ? `<span class="status-pill ${safeStatusClass(primary.status)}">${escapeHtml(primary.status)}</span>`
        : `<span class="status-pill mixed" title="Travelers have different statuses">Mixed</span>`;

      return `
        <tr>
          <td><button class="row-expand-btn" data-expand="${rowId}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button></td>
          <td class="mono-cell">${refSafe}${isGroup ? ` <span class="party-badge" title="Travel party of ${members.length}">👥 ${members.length}</span>` : ''}</td>
          <td>${email || '—'}</td>
          <td class="mono-cell">${packageLabel(primary)}${isGroup ? ` · ${members.length} travelers` : ''}</td>
          <td>$${totalValue.toLocaleString()}</td>
          <td>${statusCell}</td>
          <td class="mono-cell">${timeAgo(primary.created_at)}</td>
          <td></td>
        </tr>
        <tr class="detail-row" id="${rowId}" style="display:none;">
          <td colspan="8">
            ${members.map((a, mi) => memberDetailHTML(a, rowId + '-m' + mi, isGroup)).join(isGroup ? '<hr class="traveler-divider" />' : '')}
          </td>
        </tr>`;
    }).join('');

    groupList.forEach((members, i) => {
      const rowId = 'po-' + i;
      const btn = tbody.querySelector(`[data-expand="${rowId}"]`);
      const detail = document.getElementById(rowId);
      btn.addEventListener('click', () => {
        const open = detail.style.display !== 'none';
        detail.style.display = open ? 'none' : '';
        btn.classList.toggle('is-open', !open);
      });
      members.forEach((member, mi) => {
        const subId = rowId + '-m' + mi;
        const docsBtn = tbody.querySelector(`[data-docs="${subId}"]`);
        if (docsBtn) docsBtn.addEventListener('click', () => openDocsModal(member, member.ref));
        const statusSelect = tbody.querySelector(`[data-status-select="${subId}"]`);
        if (statusSelect) statusSelect.addEventListener('change', () => updateApplicationStatus(member, statusSelect.value, subId));
      });
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
  // SECURITY: applications/visitors data (name, email, phone, referrer...)
  // comes from public, unauthenticated form submissions. It must NEVER be
  // interpolated into innerHTML without escaping — otherwise a malicious
  // submission (e.g. a "first name" containing a <script> tag) would
  // execute inside this authenticated admin session. Every dynamic value
  // rendered below is passed through this first.
  // Only ever allow a known-safe status into a CSS class attribute —
  // stricter than escaping, since this value sits inside an attribute,
  // not text content. Anything unexpected falls back to a neutral class.
  const KNOWN_STATUSES = new Set(['submitted', 'reviewing', 'paid', 'completed', 'rejected']);
  function safeStatusClass(status) {
    return KNOWN_STATUSES.has(status) ? status : 'submitted';
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

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
