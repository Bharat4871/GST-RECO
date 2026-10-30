/* GSTiQ UI kit: icons, formatting helpers, data table, modal, drawer, toast, confirm, charts */
(function (root) {
  'use strict';
  const C = root.GSTCore, esc = C.esc;

  // ---------------- icons (24x24 stroke)
  const P = {
    dashboard: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z',
    clients: 'M3 21V7l9-4 9 4v14M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01',
    vendors: 'M3 7h11v10H3zM14 10h4l3 3v4h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    purchases: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8M9 9h3',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7z',
    recon: 'M7 3v18M17 3v18M3 8h8M13 16h8M9 6l-2 2 2 2M15 14l2 2-2 2',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
    percent: 'M19 5L5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    rcm: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
    wand: 'M15 4V2M15 10V8M11 6h2M17 6h2M3 21l12-12M13 7l2 2',
    table: 'M3 4h18v16H3zM3 10h18M3 15h18M9 4v16',
    scale: 'M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    ai: 'M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
    chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12zM8 11h.01M12 11h.01M16 11h.01',
    report: 'M4 20V4h16v16zM8 16v-4M12 16V8M16 16v-6',
    book: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 21.5A2.5 2.5 0 0 1 6.5 19H20',
    data: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.8H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.8-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.8H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01',
    plus: 'M12 5v14M5 12h14', down: 'M12 4v12M6 12l6 6 6-6M4 21h16', up: 'M12 20V8M6 12l6-6 6 6M4 3h16',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', menu: 'M3 6h18M3 12h18M3 18h18',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z', play: 'M6 4l14 8-14 8z', copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    mail: 'M3 5h18v14H3zM3 6l9 7 9-7', print: 'M6 9V2h12v7M6 18H4v-7h16v7h-2M6 14h12v8H6z', trash: 'M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15',
    edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z', file: 'M6 2h9l5 5v15H6zM14 2v6h6', x: 'M18 6L6 18M6 6l12 12',
    check: 'M20 6L9 17l-5-5', refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5', alert: 'M12 3l10 18H2zM12 10v5M12 18h.01'
  };
  const icon = (n, cls = '') => `<svg class="ico ${cls}" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n] || P.info}"/></svg>`;

  // ---------------- small formatters
  function gstinHTML(g) {
    if (!g) return '<span class="muted small">Unregistered</span>';
    const v = C.validateGSTIN(g);
    return `<span class="gstin${v.valid ? '' : ' bad'}" title="${esc(v.valid ? v.state + ' · ' + (v.holder || '') : v.errors.join('; '))}"><span class="st">${esc(g.slice(0, 2))}</span><span class="pn">${esc(g.slice(2, 12))}</span><span class="ck">${esc(g.slice(12))}</span></span>`;
  }
  const STATUS_CHIP = { ELIGIBLE: 'good', BLOCKED: 'bad', TIME_BARRED: 'bad', DUPLICATE: 'bad', INELIGIBLE: 'bad', NO_ITC: 'mute', RCM_UNPAID: 'sa', NOT_IN_2B: 'warn', RESTRICTED: 'warn', DEFERRED: 'info', REVERSE_37: 'warn', REVERSE_37A: 'warn' };
  const RECON_CHIP = { MATCHED: 'good', MATCHED_FUZZY: 'vi', MISMATCH_VALUE: 'warn', MISMATCH_DATE: 'info', GSTIN_MISMATCH: 'warn', MISSING_IN_2B: 'bad', MISSING_IN_BOOKS: 'sa', DUPLICATE_IN_BOOKS: 'bad', NOT_APPLICABLE: 'mute' };
  const chip = (text, kind) => `<span class="chip ${kind || 'mute'}">${esc(text)}</span>`;
  const statusChip = (e) => chip(e.status_label, STATUS_CHIP[e.status]);
  const reconChip = (r) => chip(r.label, RECON_CHIP[r.status]);
  const ref = (t) => `<span class="ref">${esc(t)}</span>`;
  const money = (v) => `<span class="num">${C.inr(v)}</span>`;

  // ---------------- toast
  function toast(msg, ms = 3200) {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // ---------------- modal / drawer / confirm
  let openLayers = [];
  function closeTop() { const l = openLayers.pop(); if (l) { l.el.remove(); l.onClose && l.onClose(); } if (!openLayers.length) document.body.classList.remove('printing-modal'); }
  function closeAll() { while (openLayers.length) closeTop(); }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openLayers.length) closeTop(); });
  function layer(html, cls, onClose) {
    const scrim = document.createElement('div');
    scrim.className = 'scrim ' + (cls === 'drawer' ? '' : 'modal-scrim');
    scrim.innerHTML = html;
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) closeTop(); });
    document.body.appendChild(scrim);
    openLayers.push({ el: scrim, onClose });
    scrim.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeTop));
    const f = scrim.querySelector('input, select, textarea, button:not(.x)'); if (f) setTimeout(() => f.focus(), 30);
    return scrim;
  }
  function modal({ title, sub = '', body, foot = '', wide = false, onClose }) {
    return layer(`<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><div><h2>${esc(title)}</h2>${sub ? `<div class="muted small">${sub}</div>` : ''}</div><button class="x" data-close aria-label="Close">×</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`, 'modal', onClose);
  }
  function drawer({ title, sub = '', body }) {
    return layer(`<aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="drawer-head"><div><h2>${esc(title)}</h2>${sub ? `<div class="muted small">${sub}</div>` : ''}</div><button class="x" data-close aria-label="Close">×</button></div>${body}</aside>`, 'drawer');
  }
  function confirmBox(message, okLabel = 'Confirm', danger = false) {
    return new Promise((resolve) => {
      let done = false;
      const el = modal({ title: 'Please confirm', body: `<p>${message}</p>`, foot: `<button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okLabel)}</button>`, onClose: () => { if (!done) resolve(false); } });
      el.querySelector('[data-ok]').addEventListener('click', () => { done = true; closeTop(); resolve(true); });
    });
  }

  // ---------------- data table
  function table(host, opts) {
    const st = { q: '', sort: opts.sort || null, dir: opts.dir || 1, page: 0, filters: {} };
    const size = opts.pageSize || 50;
    host.innerHTML = `${opts.tools === false ? '' : `<div class="tbl-tools">${opts.search === false ? '' : `<input type="search" placeholder="${esc(opts.placeholder || 'Search…')}" aria-label="Search table">`}
      ${(opts.filters || []).map((f, i) => `<select data-f="${i}" aria-label="${esc(f.label)}"><option value="">${esc(f.label)}: all</option>${f.options.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select>`).join('')}
      <span class="spacer" style="flex:1"></span><span class="small muted" data-count></span>${opts.toolsRight || ''}</div>`}
      <div class="table-wrap"><table class="t${opts.compact ? ' compact' : ''}"><thead></thead><tbody></tbody><tfoot></tfoot></table><div class="pager" hidden></div></div>`;
    const q = host.querySelector('input[type=search]');
    if (q) q.addEventListener('input', () => { st.q = q.value.toLowerCase(); st.page = 0; draw(); });
    host.querySelectorAll('select[data-f]').forEach(s => s.addEventListener('change', () => { st.filters[s.dataset.f] = s.value; st.page = 0; draw(); }));
    const thead = host.querySelector('thead'), tbody = host.querySelector('tbody'), tfoot = host.querySelector('tfoot'), pager = host.querySelector('.pager');
    thead.innerHTML = '<tr>' + opts.columns.map((c, i) => `<th class="${c.num ? 'right ' : ''}${c.sort !== false ? 'sortable' : ''}" data-i="${i}" scope="col">${esc(c.label)} <span class="arr"></span></th>`).join('') + '</tr>';
    thead.addEventListener('click', (e) => {
      const th = e.target.closest('th'); if (!th || !th.classList.contains('sortable')) return;
      const c = opts.columns[+th.dataset.i];
      if (st.sort === c.key) st.dir = -st.dir; else { st.sort = c.key; st.dir = c.num ? -1 : 1; }
      draw();
    });
    let current = [];
    tbody.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input, select')) return;
      const tr = e.target.closest('tr[data-k]'); if (tr && opts.onRow) opts.onRow(current[+tr.dataset.k]);
    });
    function value(c, r) { return c.value ? c.value(r) : r[c.key]; }
    function draw() {
      let rows = opts.rows();
      (opts.filters || []).forEach((f, i) => { const v = st.filters[i]; if (v) rows = rows.filter(r => String(f.get(r)) === v); });
      if (st.q) rows = rows.filter(r => (opts.text ? opts.text(r) : Object.values(r).join(' ')).toLowerCase().includes(st.q));
      if (st.sort) { const c = opts.columns.find(x => x.key === st.sort); if (c) rows = [...rows].sort((a, b) => { const x = value(c, a), y = value(c, b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; }); }
      current = rows;
      const n = rows.length, pages = Math.max(1, Math.ceil(n / size)); st.page = Math.min(st.page, pages - 1);
      const view = rows.slice(st.page * size, st.page * size + size);
      thead.querySelectorAll('th').forEach((th, i) => th.querySelector('.arr').textContent = opts.columns[i].key === st.sort ? (st.dir > 0 ? '▲' : '▼') : '');
      tbody.innerHTML = view.length ? view.map((r, i) => `<tr data-k="${st.page * size + i}" class="${opts.onRow ? 'clickable' : ''}">${opts.columns.map(c => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${c.render ? c.render(r) : esc(value(c, r) ?? '')}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${opts.columns.length}"><div class="empty">${opts.empty || 'No records match.'}</div></td></tr>`;
      const totals = opts.columns.some(c => c.total);
      tfoot.innerHTML = totals && n ? '<tr>' + opts.columns.map((c, i) => `<td class="${c.num ? 'num' : ''}">${c.total ? C.inr(rows.reduce((a, r) => a + (+value(c, r) || 0), 0)) : (i === 0 ? `Total (${n})` : '')}</td>`).join('') + '</tr>' : '';
      const cnt = host.querySelector('[data-count]'); if (cnt) cnt.textContent = `${n} record${n === 1 ? '' : 's'}`;
      pager.hidden = pages <= 1;
      pager.innerHTML = `<span>Page ${st.page + 1} of ${pages}</span><button class="btn sm" data-p="-1" ${st.page ? '' : 'disabled'}>Previous</button><button class="btn sm" data-p="1" ${st.page < pages - 1 ? '' : 'disabled'}>Next</button>`;
      pager.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { st.page += +b.dataset.p; draw(); }));
      if (opts.onDraw) opts.onDraw(rows);
    }
    draw();
    return { redraw: draw, rows: () => current };
  }

  // ---------------- charts (Chart.js, themed from CSS tokens)
  const charts = [];
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const palette = () => ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--c7'].map(css);
  function chart(canvas, cfg) {
    if (!root.Chart || !canvas) { if (canvas) canvas.parentElement.innerHTML = '<div class="empty small">Chart library unavailable.</div>'; return null; }
    const ink2 = css('--ink-2'), line = css('--line');
    root.Chart.defaults.font.family = css('--font-body') || 'sans-serif';
    root.Chart.defaults.color = ink2;
    const base = { responsive: true, maintainAspectRatio: false, animation: { duration: 350 }, plugins: { legend: { display: cfg.legend !== false, position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: false } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${cfg.money === false ? ctx.formattedValue : C.inr(ctx.raw && ctx.raw.y !== undefined ? ctx.raw.y : ctx.raw, 0)}` } } } };
    if (cfg.type !== 'doughnut') base.scales = { x: { grid: { display: false }, stacked: !!cfg.stacked, ticks: { color: ink2 } },
      y: { grid: { color: line }, stacked: !!cfg.stacked, beginAtZero: true, ticks: { color: ink2, callback: (v) => cfg.money === false ? v : C.inrShort(v) } } };
    if (cfg.horizontal) { base.indexAxis = 'y'; base.scales.x.ticks.callback = (v) => C.inrShort(v); base.scales.y.ticks.callback = undefined; base.scales.x.grid = { color: line }; base.scales.y.grid = { display: false }; }
    const ch = new root.Chart(canvas, { type: cfg.type, data: cfg.data, options: Object.assign(base, cfg.options || {}) });
    charts.push(ch); return ch;
  }
  function destroyCharts() { while (charts.length) { try { charts.pop().destroy(); } catch (e) { /* ignore */ } } }

  function copyText(text, el) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard')).catch(() => select(el));
    else select(el);
    function select(n) { if (!n) return; const r = document.createRange(); r.selectNodeContents(n); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Text selected - press Ctrl+C to copy'); }
  }
  const framed = (() => { try { return root.self !== root.top; } catch (e) { return true; } })();

  root.UI = { icon, gstinHTML, chip, statusChip, reconChip, ref, money, STATUS_CHIP, RECON_CHIP, toast, modal, drawer, closeTop, closeAll, confirmBox, table, chart, destroyCharts, palette, css, copyText, framed };
})(window);
