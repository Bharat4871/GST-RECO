/* GSTiQ application shell: state, persistence, routing, navigation, command palette, backend link */
(function (root) {
  'use strict';
  const C = root.GSTCore, E = root.GSTEngine, UI = root.UI, esc = C.esc;
  const STORE_KEY = 'gstiq.db.v3', UI_KEY = 'gstiq.ui.v3';
  const DEFAULT_SETTINGS = { amount_tolerance: 1, date_tolerance_days: 0, fuzzy_threshold: 0.72, backend_url: 'http://127.0.0.1:5000', non_business_common: false, as_on: '' };

  const store = {
    get(k) { try { const v = root.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { root.localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function freshDB() {
    const s = clone(root.GSTIQ_SEED);
    return { firm: s.firm, clients: s.clients, vendors: s.vendors, purchases: s.purchases, gstr2b: s.gstr2b, sales: s.sales,
      settings: Object.assign({}, DEFAULT_SETTINGS, { as_on: s.as_on }), audit: [{ ts: new Date().toISOString(), action: 'Demo data loaded', detail: `${s.purchases.length} purchase invoices, ${s.gstr2b.length} GSTR-2B rows` }] };
  }

  const App = {
    DB: null, ui: { client: null, period: null, view: 'dashboard', theme: '' }, cache: {}, backend: { ok: false, url: '', info: null },
    views: {},
    init() {
      const saved = store.get(STORE_KEY);
      this.DB = saved && saved.purchases ? saved : freshDB();
      this.DB.settings = Object.assign({}, DEFAULT_SETTINGS, this.DB.settings || {});
      if (!this.DB.settings.as_on) this.DB.settings.as_on = root.GSTIQ_SEED.as_on;
      Object.assign(this.ui, store.get(UI_KEY) || {});
      if (!this.DB.clients.find(c => c.id === this.ui.client) && this.ui.client !== 'ALL') this.ui.client = this.DB.clients[0] ? this.DB.clients[0].id : null;
      this.applyTheme(this.ui.theme);
    },
    asOn() { return C.d(this.DB.settings.as_on) || C.d(root.GST_KB.meta.law_as_on); },
    save() { clearTimeout(this._t); this._t = setTimeout(() => { if (!store.set(STORE_KEY, this.DB)) console.warn('Local storage unavailable - export a backup to keep changes'); }, 250); },
    saveUI() { store.set(UI_KEY, { client: this.ui.client, period: this.ui.period, theme: this.ui.theme }); },
    changed(action, detail) { this.cache = {}; if (action) this.log(action, detail); this.save(); },
    log(action, detail) { this.DB.audit.unshift({ ts: new Date().toISOString(), action, detail: detail || '' }); this.DB.audit = this.DB.audit.slice(0, 300); },
    clientId() { return this.ui.client === 'ALL' ? (this.DB.clients[0] || {}).id : this.ui.client; },
    client() { return this.DB.clients.find(c => c.id === this.clientId()); },
    analysis(id) {
      id = id || this.clientId(); if (!id) return null;
      return this.cache['a:' + id] || (this.cache['a:' + id] = E.analyse(this.DB, id, this.asOn()));
    },
    vendorRisk(id) {
      id = id || this.clientId(); const a = this.analysis(id); if (!a) return [];
      return this.cache['vr:' + id] || (this.cache['vr:' + id] = root.GSTAI.vendorRisk(a.V, a.P, a.reconByPr, this.asOn()));
    },
    subset(id) {
      id = id || this.clientId(); const a = this.analysis(id);
      return { clients: [a.client], purchases: a.P, gstr2b: a.B, vendors: a.V, sales: this.DB.sales.filter(s => s.client_id === id) };
    },
    periods(id) {
      id = id || this.clientId();
      const set = new Set(this.DB.sales.filter(s => s.client_id === id).map(s => s.period));
      this.DB.gstr2b.filter(b => b.client_id === id).forEach(b => set.add(b.return_period));
      const cur = C.periodOf(this.asOn()); set.add(cur);
      return [...set].filter(p => p >= '2026-01').sort();
    },
    period() {
      const ps = this.periods();
      if (!this.ui.period || !ps.includes(this.ui.period)) {
        const withSales = this.DB.sales.filter(s => s.client_id === this.clientId()).map(s => s.period).sort();
        this.ui.period = withSales.length ? withSales[withSales.length - 1] : ps[ps.length - 1];
      }
      return this.ui.period;
    },
    gstr3b(period, id) {
      id = id || this.clientId(); period = period || this.period();
      const key = `3b:${id}:${period}:${this.DB.settings.non_business_common ? 1 : 0}`;
      if (!this.cache[key]) { const a = this.analysis(id); this.cache[key] = E.gstr3b(this.subset(id), id, period, a.evals, a.recon, this.asOn(), { nonBusinessCommon: this.DB.settings.non_business_common }); }
      return this.cache[key];
    },
    applyTheme(t) {
      if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
    },
    isDark() { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches; },

    // ---------------- routing
    navigate(view, opts) { if (!this.views[view]) view = 'dashboard'; if (location.hash !== '#' + view) { location.hash = view; } else this.render(opts); },
    render(opts) {
      const h = (location.hash || '').replace('#', '');
      const view = this.views[h] ? h : 'dashboard';
      this.ui.view = view;
      UI.destroyCharts(); UI.closeAll();
      document.body.classList.remove('nav-open');
      const v = this.views[view];
      document.querySelectorAll('.nav a').forEach(a => a.setAttribute('aria-current', a.dataset.view === view ? 'page' : 'false'));
      const host = document.getElementById('content');
      try {
        host.innerHTML = v.render(this, opts || {});
        if (v.mount) v.mount(host, this, opts || {});
      } catch (err) {
        console.error(err);
        host.innerHTML = `<div class="notice bad"><b>Something went wrong while drawing this page.</b><br><span class="mono small">${esc(err.message)}</span><br>Try Data centre → Reset demo data if your imported data has missing columns.</div>`;
      }
      document.title = `${v.title} · GSTiQ`;
      this.renderTop(); this.renderBadges(); this.saveUI();
      if (!opts || !opts.keepScroll) root.scrollTo(0, 0);
    },
    renderTop() {
      const sel = document.getElementById('client-select');
      sel.innerHTML = (this.views[this.ui.view] && this.views[this.ui.view].allowAll ? '<option value="ALL">All clients · practice overview</option>' : '') +
        this.DB.clients.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
      sel.value = this.ui.client === 'ALL' && !(this.views[this.ui.view] || {}).allowAll ? this.clientId() : this.ui.client;
      const ps = document.getElementById('period-select');
      if (this.clientId()) ps.innerHTML = this.periods().map(p => `<option value="${p}">${C.periodLabel(p)}</option>`).join('');
      ps.value = this.period();
      ps.parentElement.hidden = !(this.views[this.ui.view] || {}).usesPeriod;
      document.getElementById('as-on').textContent = 'As on ' + C.fmtDate(C.iso(this.asOn()));
      const pill = document.getElementById('engine-pill');
      pill.className = 'pill' + (this.backend.ok ? ' on' : '');
      pill.innerHTML = `<span class="dot"></span>${this.backend.ok ? 'Python engine linked' : 'Browser engine'}`;
      pill.title = this.backend.ok ? `Connected to ${this.backend.url} (scikit-learn ${this.backend.info.sklearn})` : 'All calculations run in your browser. Start backend/app.py to add the Python AI engine.';
    },
    renderBadges() {
      const a = this.analysis(); if (!a) return;
      const set = (v, n) => { const el = document.querySelector(`.nav a[data-view="${v}"] .count`); if (el) { el.textContent = n; el.hidden = !n; } };
      set('recon', a.recon.filter(r => r.status === 'MISSING_IN_2B').length);
      set('itc', a.evals.filter(e => e.flags.some(f => f.severity === 'high')).length);
      set('rcm', a.rcm.filter(r => r.status === 'Overdue').length);
    },

    // ---------------- command palette
    palette() {
      const items = [];
      for (const [k, v] of Object.entries(this.views)) items.push({ label: v.title, hint: 'Page', run: () => this.navigate(k) });
      this.DB.clients.forEach(c => items.push({ label: c.name, hint: 'Client · ' + c.gstin, run: () => { this.ui.client = c.id; this.cache = {}; this.navigate('dashboard'); } }));
      const a = this.analysis();
      if (a) {
        a.P.forEach(p => items.push({ label: `${p.invoice_no} · ${p.supplier_name}`, hint: C.inr(C.taxOf(p)), run: () => this.showInvoice(p.id) }));
        a.V.forEach(v => items.push({ label: v.name, hint: 'Vendor · ' + (v.gstin || v.type), run: () => this.navigate('vendors') }));
      }
      const el = UI.modal({ title: 'Go to…', body: '' });
      const box = el.querySelector('.modal');
      box.className = 'palette'; box.innerHTML = `<input type="text" placeholder="Type a page, client, invoice no. or vendor" aria-label="Search everything"><ul role="listbox"></ul>`;
      const inp = box.querySelector('input'), ul = box.querySelector('ul'); let sel = 0, list = [];
      const draw = () => {
        const q = inp.value.toLowerCase().trim();
        list = (q ? items.filter(i => (i.label + ' ' + i.hint).toLowerCase().includes(q)) : items.slice(0, 22)).slice(0, 40);
        sel = Math.min(sel, Math.max(0, list.length - 1));
        ul.innerHTML = list.map((i, k) => `<li role="option" data-k="${k}" aria-selected="${k === sel}"><span>${esc(i.label)}</span><span class="muted small">${esc(i.hint)}</span></li>`).join('') || '<li class="muted">No matches</li>';
      };
      inp.addEventListener('input', () => { sel = 0; draw(); });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { sel = Math.min(list.length - 1, sel + 1); draw(); e.preventDefault(); }
        if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
        if (e.key === 'Enter' && list[sel]) { UI.closeTop(); list[sel].run(); }
      });
      ul.addEventListener('click', (e) => { const li = e.target.closest('li[data-k]'); if (li) { UI.closeTop(); list[+li.dataset.k].run(); } });
      draw(); setTimeout(() => inp.focus(), 20);
    },

    // ---------------- Python backend link
    async detectBackend() {
      if (UI.framed) return;
      const tryUrl = async (base) => {
        try {
          const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 1800);
          const r = await fetch(base + '/api/health', { signal: ctl.signal }); clearTimeout(t);
          if (!r.ok) return false; const j = await r.json(); if (!j.ok) return false;
          this.backend = { ok: true, url: base, info: j }; return true;
        } catch (e) { return false; }
      };
      if (/^https?:/.test(location.protocol) && await tryUrl(location.origin)) { this.renderTop(); return; }
      if (this.DB.settings.backend_url && await tryUrl(this.DB.settings.backend_url.replace(/\/$/, ''))) this.renderTop();
    },
    async api(path, payload) {
      if (!this.backend.ok) throw new Error('Python engine not connected');
      const r = await fetch(this.backend.url + path, { method: payload ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined });
      if (!r.ok) throw new Error('Python engine returned ' + r.status);
      return path.includes('/report/') ? r.blob() : r.json();
    }
  };

  const NAV = [
    ['Overview', [['dashboard', 'Dashboard', 'dashboard'], ['clients', 'Clients', 'clients']]],
    ['Registers', [['purchases', 'Purchase register', 'purchases'], ['gstr2b', 'GSTR-2B & IMS', 'inbox'], ['vendors', 'Vendors', 'vendors']]],
    ['ITC engine', [['recon', 'Reconciliation', 'recon'], ['itc', 'ITC eligibility', 'shield'], ['rule42', 'Rule 42 & 43', 'percent']]],
    ['Reverse charge', [['rcm', 'RCM register', 'rcm'], ['rcm-wizard', 'RCM wizard', 'wand']]],
    ['Returns', [['gstr3b', 'GSTR-3B builder', 'table'], ['setoff', 'Set-off & cash', 'scale'], ['interest', 'Interest calculator', 'clock']]],
    ['Artificial intelligence', [['ai-lab', 'AI lab', 'ai'], ['assistant', 'GST Mitra assistant', 'chat']]],
    ['Office', [['reports', 'Reports', 'report'], ['knowledge', 'Knowledge hub', 'book'], ['data', 'Data centre', 'data'], ['setup', 'Setup', 'gear'], ['about', 'About the project', 'info']]]
  ];

  function shell() {
    const d = document.getElementById('app');
    d.innerHTML = `<div class="shell">
      <nav class="side" aria-label="Main">
        <div class="brand"><div class="brand-mark">iQ</div><div><div class="brand-name">GST<b>iQ</b></div><div class="brand-sub">ITC &amp; RCM intelligence for CA offices</div></div></div>
        ${NAV.map(([g, items]) => `<div class="nav-group eyebrow">${esc(g)}</div><div class="nav">${items.map(([k, l, ic]) => `<a href="#${k}" data-view="${k}">${UI.icon(ic)}<span>${esc(l)}</span><span class="count" hidden></span></a>`).join('')}</div>`).join('')}
        <div class="side-foot">Law position as on ${C.fmtDate(root.GST_KB.meta.law_as_on)} · KB v${esc(root.GST_KB.meta.version)}<br>Dummy data for ICAI Advanced IT project</div>
      </nav>
      <div class="main">
        <header class="topbar">
          <button class="btn ghost menu-btn" id="menu-btn" aria-label="Open menu">${UI.icon('menu')}</button>
          <div class="client-pick"><label class="eyebrow hide-sm" for="client-select">Client</label><select id="client-select"></select></div>
          <div class="client-pick"><label class="eyebrow hide-sm" for="period-select">Period</label><select id="period-select"></select></div>
          <span class="spacer"></span>
          <span class="pill hide-sm" id="as-on"></span>
          <span class="pill hide-sm" id="engine-pill"></span>
          <button class="btn search-btn" id="search-btn" aria-label="Search">${UI.icon('search')}<span class="lbl">Search</span><kbd class="hide-sm">Ctrl K</kbd></button>
          <button class="btn ghost" id="theme-btn" aria-label="Toggle dark mode">${UI.icon('moon')}</button>
        </header>
        <main id="content" class="content" tabindex="-1"></main>
      </div></div>`;
    document.getElementById('menu-btn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    document.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && !e.target.closest('.side') && !e.target.closest('#menu-btn')) document.body.classList.remove('nav-open'); });
    document.getElementById('client-select').addEventListener('change', (e) => { App.ui.client = e.target.value; App.ui.period = null; App.cache = {}; App.render({ keepScroll: true }); });
    document.getElementById('period-select').addEventListener('change', (e) => { App.ui.period = e.target.value; App.render({ keepScroll: true }); });
    document.getElementById('search-btn').addEventListener('click', () => App.palette());
    document.getElementById('theme-btn').addEventListener('click', () => { App.ui.theme = App.isDark() ? 'light' : 'dark'; App.applyTheme(App.ui.theme); App.render({ keepScroll: true }); });
    document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); App.palette(); } });
    root.addEventListener('hashchange', () => App.render());
  }

  root.GSTApp = App;
  root.addEventListener('DOMContentLoaded', () => {
    if (!root.GST_KB || !root.GSTIQ_SEED) { document.getElementById('app').innerHTML = '<p style="padding:20px">Knowledge base or demo data failed to load. Keep the js/ folder next to index.html.</p>'; return; }
    App.init(); shell(); App.render(); App.detectBackend();
  });
})(window);
