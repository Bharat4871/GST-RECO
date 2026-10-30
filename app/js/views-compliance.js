/* Views: Reconciliation, ITC eligibility, Rule 42 & 43, RCM register, RCM wizard */
(function (root) {
  'use strict';
  const C = root.GSTCore, E = root.GSTEngine, AI = root.GSTAI, UI = root.UI, IO = root.GSTIO, App = root.GSTApp, esc = C.esc;
  const V = App.views, KB = () => root.GST_KB;
  const tabs = (id, list, cur) => `<div class="tabs" role="tablist" id="${id}">${list.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === cur}">${l}</button>`).join('')}</div>`;
  const bindTabs = (host, id, cb) => host.querySelector('#' + id).addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) cb(b.dataset.tab); });

  // ================================================================ Reconciliation
  V.recon = {
    title: 'Reconciliation',
    render(app) {
      const a = app.analysis(), s = app.DB.settings, rs = a.reconSum;
      const order = ['MATCHED', 'MATCHED_FUZZY', 'MISMATCH_VALUE', 'MISMATCH_DATE', 'GSTIN_MISMATCH', 'MISSING_IN_2B', 'MISSING_IN_BOOKS', 'DUPLICATE_IN_BOOKS'];
      const tab = app._reconTab || 'all';
      return `<div class="page-head"><div><div class="eyebrow">GSTR-2B vs purchase register · four-pass matching</div><h1>Reconciliation</h1><p>Pass 1 matches GSTIN + normalised invoice number. Pass 2 uses AI fuzzy scoring (invoice-number edit distance, amount and date). Pass 3 rescues GSTIN typos and other registrations under the same PAN. Leftovers become follow-ups.</p></div>
        <div class="actions no-print"><label class="field">Amount tolerance ₹<input id="tol" type="number" step="0.5" value="${s.amount_tolerance}" style="width:90px"></label>
          <label class="field">Date tolerance (days)<input id="dtol" type="number" value="${s.date_tolerance_days}" style="width:90px"></label>
          <label class="field">Fuzzy threshold<input id="fz" type="number" step="0.02" min="0.5" max="0.95" value="${s.fuzzy_threshold}" style="width:90px"></label>
          <button class="btn primary" id="rerun" style="align-self:flex-end">${UI.icon('refresh')}Re-run</button></div></div>
        <div class="row" style="margin-bottom:14px">${order.filter(k => rs[k]).map(k => `<button class="pill" data-st="${k}" style="cursor:pointer">${UI.chip(E.RECON_LABEL[k], UI.RECON_CHIP[k])} <b>${rs[k].count}</b> · ${C.inr(Math.max(rs[k].books_tax, rs[k].b2b_tax), 0)}</button>`).join('')}</div>
        ${tabs('rtabs', [['all', 'All records'], ['follow', 'Vendor follow-up'], ['books', 'Missing in books']], tab)}<div id="pane"></div>`;
    },
    mount(host, app) {
      const a = app.analysis();
      host.querySelector('#rerun').addEventListener('click', () => {
        Object.assign(app.DB.settings, { amount_tolerance: +host.querySelector('#tol').value || 0, date_tolerance_days: +host.querySelector('#dtol').value || 0, fuzzy_threshold: +host.querySelector('#fz').value || 0.72 });
        app.changed('Reconciliation re-run', JSON.stringify({ tol: app.DB.settings.amount_tolerance })); UI.toast('Reconciliation re-run with new tolerances'); app.render({ keepScroll: true });
      });
      bindTabs(host, 'rtabs', (t) => { app._reconTab = t; app.render({ keepScroll: true }); });
      const pane = host.querySelector('#pane'), tab = app._reconTab || 'all';
      if (tab === 'all') {
        const rows = a.recon.filter(r => r.status !== 'NOT_APPLICABLE');
        const tb = UI.table(pane, { rows: () => rows, placeholder: 'Search supplier, GSTIN, invoice…', text: r => `${r.supplier_name} ${r.supplier_gstin} ${r.invoice_no} ${r.note}`,
          filters: [{ label: 'Status', options: Object.entries(E.RECON_LABEL).filter(([k]) => k !== 'NOT_APPLICABLE').map(([k, v]) => [k, v]), get: r => r.status }],
          columns: [{ key: 'status', label: 'Status', render: r => UI.reconChip(r) + (r.status === 'MATCHED_FUZZY' || r.status === 'GSTIN_MISMATCH' ? `<div class="small muted">confidence ${(r.confidence * 100).toFixed(0)}%</div>` : '') },
            { key: 'supplier_name', label: 'Supplier', cls: 'wrap', render: r => `<b>${esc(r.supplier_name)}</b><div>${UI.gstinHTML(r.supplier_gstin)}</div>` },
            { key: 'invoice_no', label: 'Invoice', render: r => `<span class="mono">${esc(r.invoice_no)}</span><div class="small muted">${C.fmtDate(r.invoice_date)}</div>` },
            { key: 'books_tax', label: 'Books GST', num: true, render: r => C.inr(r.books_tax), total: true }, { key: 'b2b_tax', label: '2B GST', num: true, render: r => C.inr(r.b2b_tax), total: true },
            { key: 'tax_diff', label: 'Difference', num: true, render: r => Math.abs(r.tax_diff) > 0.5 ? `<b style="color:var(--${r.tax_diff > 0 ? 'bad' : 'warn'})">${C.inr(r.tax_diff)}</b>` : '—', total: true },
            { key: 'return_period', label: '2B period', render: r => r.return_period ? C.periodLabel(r.return_period) : '—' }, { key: 'ims_action', label: 'IMS' },
            { key: 'note', label: 'Explanation', cls: 'wrap', render: r => `<span class="small">${esc(r.note)}</span>` }],
          onRow: r => r.pr_id ? App.showInvoice(r.pr_id) : null });
        host.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => { const s = pane.querySelector('select[data-f="0"]'); s.value = b.dataset.st; s.dispatchEvent(new Event('change')); }));
      } else if (tab === 'follow') {
        const miss = a.recon.filter(r => ['MISSING_IN_2B', 'MISMATCH_VALUE'].includes(r.status));
        const groups = Object.entries(C.groupBy(miss, r => r.supplier_gstin)).map(([g, list]) => ({ g, list, v: a.V.find(v => v.gstin === g) || { name: list[0].supplier_name, email: '' }, tax: C.sum(list, r => r.books_tax) })).sort((x, y) => y.tax - x.tax);
        pane.innerHTML = groups.length ? `<div class="row" style="margin-bottom:10px"><span class="small muted">${groups.length} supplier(s) to chase for ${C.inr(C.sum(groups, x => x.tax))} of ITC.</span><span style="flex:1"></span><button class="btn" id="exp-letters">${UI.icon('down')}Download all letters (.txt)</button><button class="btn" id="exp-fu">${UI.icon('down')}Follow-up list (.xlsx)</button></div>
          <div class="stack">${groups.map((x, i) => `<section class="panel"><div class="panel-head"><div><h3>${esc(x.v.name)}</h3><div class="small muted">${UI.gstinHTML(x.g)} · ${x.list.length} invoice(s) · <span class="mono">${esc(x.v.email || 'no email on file')}</span></div></div><div class="row"><b>${C.inr(x.tax)}</b><button class="btn sm" data-letter="${i}">${UI.icon('mail')}Letter</button></div></div>
            <div class="small">${x.list.map(r => `<span class="ref">${esc(r.invoice_no)}</span> ${UI.reconChip(r)} `).join(' ')}</div></section>`).join('')}</div>` : '<div class="empty">No supplier follow-ups pending.</div>';
        const letter = (x) => V._followUpText(app, x.v, x.list.map(r => a.P.find(p => p.id === r.pr_id)));
        pane.querySelectorAll('[data-letter]').forEach(b => b.addEventListener('click', () => {
          const x = groups[+b.dataset.letter], txt = letter(x);
          const el = UI.modal({ title: 'Follow-up letter', sub: `To ${esc(x.v.name)} · <span class="mono">${esc(x.v.email || '')}</span>`, body: `<pre class="formula" id="lt" style="white-space:pre-wrap">${esc(txt)}</pre>`, foot: `<button class="btn" data-close>Close</button><button class="btn primary" id="cpl">${UI.icon('copy')}Copy</button>` });
          el.querySelector('#cpl').addEventListener('click', () => UI.copyText(txt, el.querySelector('#lt')));
        }));
        const el1 = pane.querySelector('#exp-letters'); if (el1) el1.addEventListener('click', () => IO.saveFile(`Vendor_followup_letters_${app.clientId()}.txt`, groups.map(letter).join('\n\n' + '='.repeat(70) + '\n\n'), 'text/plain'));
        const el2 = pane.querySelector('#exp-fu'); if (el2) el2.addEventListener('click', () => IO.saveFile(`Vendor_followup_${app.clientId()}.xlsx`, IO.workbookBlob([{ name: 'Follow-up', rows: miss.map(r => ({ supplier: r.supplier_name, gstin: r.supplier_gstin, invoice_no: r.invoice_no, invoice_date: r.invoice_date, books_gst: r.books_tax, gstr2b_gst: r.b2b_tax, status: r.label, note: r.note })) }])));
      } else {
        const rows = a.recon.filter(r => r.status === 'MISSING_IN_BOOKS');
        pane.innerHTML = `<div class="notice info" style="margin-bottom:10px">These documents appear in GSTR-2B but not in the purchase register. Either the bill was not booked (book it to claim ITC) or the supplier reported a supply you did not receive (reject it in IMS so it leaves your GSTR-2B).</div><div id="mb"></div>`;
        UI.table(pane.querySelector('#mb'), { rows: () => rows, columns: [{ key: 'supplier_name', label: 'Supplier', render: r => `<b>${esc(r.supplier_name)}</b><div>${UI.gstinHTML(r.supplier_gstin)}</div>` },
          { key: 'invoice_no', label: 'Invoice', render: r => `<span class="mono">${esc(r.invoice_no)}</span><div class="small muted">${C.fmtDate(r.invoice_date)}</div>` }, { key: 'b2b_tax', label: 'GST', num: true, render: r => C.inr(r.b2b_tax), total: true },
          { key: 'return_period', label: '2B period', render: r => C.periodLabel(r.return_period) }, { key: 'ims_action', label: 'IMS' },
          { key: 'act', label: 'Action', sort: false, render: r => `<button class="btn sm" data-book="${esc(r.b2b_id)}">${UI.icon('plus')}Book it</button> <button class="btn sm danger" data-rej="${esc(r.b2b_id)}">Reject in IMS</button>` }] });
        pane.addEventListener('click', (e) => {
          const bk = e.target.closest('[data-book]'), rj = e.target.closest('[data-rej]');
          if (bk) { const b = app.DB.gstr2b.find(x => x.id === bk.dataset.book), v = a.V.find(x => x.gstin === b.supplier_gstin) || {}; const n = app.DB.purchases.filter(x => x.client_id === b.client_id).length + 1;
            app.DB.purchases.push({ id: `PI-${b.client_id}-${String(n).padStart(4, '0')}B`, client_id: b.client_id, vendor_id: v.id || '', supplier_gstin: b.supplier_gstin, supplier_name: b.supplier_name, supplier_type: 'Regular', supplier_state: b.supplier_gstin.slice(0, 2),
              invoice_no: b.invoice_no, invoice_date: b.invoice_date, receipt_date: b.invoice_date, hsn_sac: '', description: 'Booked from GSTR-2B (verify nature of supply)', expense_head: 'To be classified', category: 'Inputs', pos: b.pos, taxable_value: b.taxable_value, rate: b.rate || 18,
              igst: b.igst, cgst: b.cgst, sgst: b.sgst, cess: b.cess, invoice_value: b.invoice_value, reverse_charge: b.reverse_charge, rcm_type: '', rcm_paid_date: '', self_invoice_no: '', itc_claimed: 'N', claim_period: '', payment_date: '', amount_paid: 0, usage: 'Taxable', irn: b.irn, remarks: 'Booked from GSTR-2B' });
            app.changed('Booked from 2B', b.invoice_no); UI.toast('Bill booked - reconciliation updated'); app.render({ keepScroll: true }); }
          if (rj) { const b = app.DB.gstr2b.find(x => x.id === rj.dataset.rej); b.ims_action = 'Rejected'; app.changed('IMS reject', b.invoice_no); UI.toast('Rejected in IMS'); app.render({ keepScroll: true }); }
        });
      }
    }
  };

  // ================================================================ ITC eligibility
  V.itc = {
    title: 'ITC eligibility',
    render(app) {
      const a = app.analysis(), t = a.totals, tab = app._itcTab || 'rules';
      const k = (cls, l, v, s) => `<div class="kpi ${cls}"><div class="eyebrow">${l}</div><div class="v">${C.inrShort(v)}</div><div class="s">${s}</div></div>`;
      return `<div class="page-head"><div><div class="eyebrow">Sections 16 &amp; 17 · Rules 36(4), 37, 37A · GST 2.0 rate checks</div><h1>ITC eligibility analyser</h1><p>Each bill passes through ${KB().itc_conditions.length} statutory conditions and ${KB().blocked_credits.length} blocked-credit heads. Amounts are classified so the CA knows exactly what to claim, reverse or chase.</p></div></div>
        <div class="kpis">${k('good', 'Eligible', t.eligible_itc, 'claim / retain')}${k('bad', 'Blocked 17(5)', t.blocked_itc, 'reverse in 4B(1)')}${k('warn', 'At risk', t.at_risk_itc, 'not in 2B · 37 · 37A')}${k('', 'Deferred', t.deferred_itc, 'not received · RCM unpaid')}${k('bad', 'Lapsed 16(4)', t.lapsed_itc, 'report in 4D(2)')}${k('warn', 'Wrongly claimed', t.wrongly_claimed, 'claimed but not eligible today')}</div>
        <div style="margin-top:16px">${tabs('itabs', [['rules', 'Rule-wise exceptions'], ['deadline', 'Sec 16(4) deadline'], ['r37', 'Rule 37 · 180 days'], ['blocked', 'Blocked credits'], ['all', 'All non-eligible bills']], tab)}</div><div id="pane"></div>`;
    },
    mount(host, app) {
      const a = app.analysis(), tab = app._itcTab || 'rules', pane = host.querySelector('#pane');
      bindTabs(host, 'itabs', (t) => { app._itcTab = t; app.render({ keepScroll: true }); });
      const P = (id) => a.P.find(p => p.id === id);
      if (tab === 'rules') {
        const groups = {};
        a.evals.forEach(e => e.flags.forEach(f => { if (f.severity === 'info' && f.code !== 'PROPOSED_RELAXATION') return; const g = groups[f.code] = groups[f.code] || { code: f.code, ref: f.ref, sev: f.severity, n: 0, tax: 0, ex: f.msg, ids: [] }; g.n++; g.tax += e.tax; g.ids.push(e.id); }));
        const rows = Object.values(groups).sort((x, y) => ({ high: 0, medium: 1, low: 2, info: 3 }[x.sev] - { high: 0, medium: 1, low: 2, info: 3 }[y.sev]) || y.tax - x.tax);
        UI.table(pane, { rows: () => rows, search: false, columns: [{ key: 'sev', label: 'Severity', render: r => UI.chip(r.sev, { high: 'bad', medium: 'warn', low: 'info', info: 'vi' }[r.sev]) },
          { key: 'code', label: 'Exception', render: r => `<b>${esc(r.code.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()))}</b>` }, { key: 'ref', label: 'Law', render: r => UI.ref(r.ref) },
          { key: 'n', label: 'Bills', num: true }, { key: 'tax', label: 'GST involved', num: true, render: r => C.inr(r.tax) }, { key: 'ex', label: 'Example', cls: 'wrap', render: r => `<span class="small">${esc(r.ex)}</span>` }],
          onRow: r => { const ids = new Set(r.ids); app._itcFilter = ids; app._itcTab = 'all'; app._itcLabel = r.code; app.render({ keepScroll: true }); } });
      } else if (tab === 'deadline') {
        const rows = a.evals.filter(e => !e.claimed && e.tax > 0 && e.status !== 'ELIGIBLE' || e.flags.some(f => f.code === 'DEADLINE_NEAR' || f.code === 'TIME_BARRED')).filter(e => e.flags.some(f => ['DEADLINE_NEAR', 'TIME_BARRED'].includes(f.code)));
        const days = C.daysBetween(app.asOn(), C.d('2026-11-30'));
        pane.innerHTML = `<div class="notice ${days <= 45 ? 'bad' : 'info'}" style="margin-bottom:10px"><b>FY 2025-26 ITC closes on 30-11-2026 (${days} days).</b> The last return in which it can be claimed is GSTR-3B for October 2026, due 20-11-2026. Bills of FY 2024-25 lapsed on 30-11-2025 and must be reported in Table 4D(2).</div><div id="dl"></div>`;
        UI.table(pane.querySelector('#dl'), { rows: () => rows, columns: [{ key: 'id', label: 'Bill', render: e => `<span class="mono">${esc(P(e.id).invoice_no)}</span><div class="small muted">${esc(P(e.id).supplier_name)}</div>` },
          { key: 'date', label: 'Invoice date', value: e => P(e.id).invoice_date, render: e => C.fmtDate(P(e.id).invoice_date) }, { key: 'fy', label: 'FY', render: e => C.fyLabel(C.d(P(e.id).invoice_date)) },
          { key: 'tax', label: 'GST', num: true, render: e => C.inr(e.tax), total: true }, { key: 'status', label: 'Status', render: e => e.status === 'TIME_BARRED' ? UI.chip('Lapsed', 'bad') : UI.chip(e.flags.find(f => f.code === 'DEADLINE_NEAR') ? 'Claim in Oct-26 3B' : e.status_label, 'warn') },
          { key: 'msg', label: 'Detail', cls: 'wrap', render: e => `<span class="small">${esc((e.flags.find(f => ['DEADLINE_NEAR', 'TIME_BARRED'].includes(f.code)) || {}).msg || '')}</span>` }], onRow: e => App.showInvoice(e.id) });
      } else if (tab === 'r37') {
        const rows = a.P.filter(p => p.reverse_charge !== 'Y' && C.taxOf(p) > 0).map(p => ({ p, age: p.payment_date ? C.daysBetween(C.d(p.invoice_date), C.d(p.payment_date)) : C.daysBetween(C.d(p.invoice_date), app.asOn()), paid: !!p.payment_date }))
          .filter(x => (!x.paid && x.age > 120) || (x.paid && x.age > 180)).sort((x, y) => y.age - x.age);
        pane.innerHTML = `<div class="notice info" style="margin-bottom:10px">Second proviso to Sec 16(2) with Rule 37: if the supplier is not paid within 180 days of the invoice date, the ITC is added to output tax with interest and re-availed on payment. Bills unpaid for more than 120 days are shown so the client can pay before the cliff.</div><div id="r37"></div>`;
        UI.table(pane.querySelector('#r37'), { rows: () => rows, columns: [{ key: 'inv', label: 'Bill', render: x => `<span class="mono">${esc(x.p.invoice_no)}</span><div class="small muted">${esc(x.p.supplier_name)}</div>` },
          { key: 'date', label: 'Invoice date', value: x => x.p.invoice_date, render: x => C.fmtDate(x.p.invoice_date) }, { key: 'age', label: 'Days', num: true },
          { key: 'bar', label: 'Towards 180 days', sort: false, render: x => `<div class="gauge" style="width:160px"><i style="width:${Math.min(100, x.age / 180 * 100)}%;background:var(--${x.age > 180 ? 'bad' : x.age > 150 ? 'warn' : 'info'})"></i></div>` },
          { key: 'tax', label: 'ITC', num: true, value: x => C.taxOf(x.p), render: x => C.inr(C.taxOf(x.p)), total: true },
          { key: 'st', label: 'Action', render: x => x.paid ? UI.chip('Paid late · interest due', 'warn') : x.age > 180 ? UI.chip('Reverse now', 'bad') : UI.chip(`Pay within ${180 - x.age} days`, 'info') }], onRow: x => App.showInvoice(x.p.id) });
      } else if (tab === 'blocked') {
        const bl = a.evals.filter(e => e.status === 'BLOCKED'); const by = C.groupBy(bl, e => e.rule_category);
        pane.innerHTML = `<div class="grid g2">${KB().blocked_credits.filter(b => by[b.code]).map(b => `<section class="panel"><div class="panel-head"><div><h3>${esc(b.title)}</h3>${UI.ref(b.ref)}</div><b>${C.inr(C.sum(by[b.code], e => e.tax))}</b></div>
          <p class="small" style="margin-top:0">${esc(b.text)}</p><p class="small muted"><b>Exception:</b> ${esc(b.exceptions)}</p>${b.proposed ? `<div class="notice info small">${esc(b.proposed)}</div>` : ''}
          <div class="small" style="margin-top:8px">${by[b.code].map(e => `<a href="#" data-inv="${esc(e.id)}" class="ref">${esc(P(e.id).invoice_no)}</a>`).join(' ')}</div></section>`).join('') || '<div class="empty">No blocked credits.</div>'}</div>`;
        pane.addEventListener('click', (ev) => { const l = ev.target.closest('[data-inv]'); if (l) { ev.preventDefault(); App.showInvoice(l.dataset.inv); } });
      } else {
        const filter = app._itcFilter; const rows = a.evals.filter(e => filter ? filter.has(e.id) : e.status !== 'ELIGIBLE');
        pane.innerHTML = `${filter ? `<div class="notice" style="margin-bottom:10px">Showing bills with exception <b>${esc(app._itcLabel)}</b>. <button class="btn sm" id="clr">Show all non-eligible</button></div>` : ''}<div id="all"></div>`;
        const clr = pane.querySelector('#clr'); if (clr) clr.addEventListener('click', () => { app._itcFilter = null; app.render({ keepScroll: true }); });
        UI.table(pane.querySelector('#all'), { rows: () => rows, text: e => `${P(e.id).supplier_name} ${P(e.id).invoice_no} ${e.status_label}`,
          filters: [{ label: 'Status', options: Object.entries(E.STATUS).map(([k, v]) => [k, v[1]]), get: e => e.status }],
          columns: [{ key: 'inv', label: 'Bill', render: e => `<span class="mono">${esc(P(e.id).invoice_no)}</span><div class="small muted">${C.fmtDate(P(e.id).invoice_date)}</div>` },
            { key: 'sup', label: 'Supplier', cls: 'wrap', value: e => P(e.id).supplier_name, render: e => `<b>${esc(P(e.id).supplier_name)}</b><div class="small muted">${esc(P(e.id).description)}</div>` },
            { key: 'tax', label: 'GST', num: true, render: e => C.inr(e.tax), total: true }, { key: 'status', label: 'Status', value: e => E.STATUS[e.status][0], render: e => UI.statusChip(e) },
            { key: 'claimed', label: 'Claimed', render: e => e.claimed ? UI.chip('Yes · ' + C.periodLabel(e.claim_period), 'warn') : '<span class="small muted">No</span>' },
            { key: 'why', label: 'Main reason', cls: 'wrap', render: e => `<span class="small">${esc((e.flags.find(f => f.severity === 'high') || e.flags[0] || {}).msg || (e.checks.find(c => !c.ok) || {}).msg || '')}</span>` }], onRow: e => App.showInvoice(e.id) });
      }
    }
  };

  // ================================================================ Rule 42 & 43
  V.rule42 = {
    title: 'Rule 42 & 43', usesPeriod: true,
    render(app) {
      const c = app.client(), per = app.period(), nb = app.DB.settings.non_business_common;
      const r = E.rule42(app.subset(), c.id, per, nb), r3 = E.rule43(app.subset(), c.id, per);
      const fy = per >= `${per.slice(0, 4)}-04` ? +per.slice(0, 4) : +per.slice(0, 4) - 1;
      const months = []; for (let i = 0; i < 12; i++) { const p = C.addMonths(`${fy}-04`, i); if (app.DB.sales.some(s => s.client_id === c.id && s.period === p)) months.push(p); }
      const yr = months.map(p => E.rule42(app.subset(), c.id, p, nb));
      const C2y = C.sum(yr, x => x.C2), Ey = C.sum(yr, x => x.E), Fy = C.sum(yr, x => x.F), D1y = Fy ? C2y * Ey / Fy : 0, D1m = C.sum(yr, x => x.D1);
      const f = (n) => `<b>${C.inr(n)}</b>`;
      return `<div class="page-head"><div><div class="eyebrow">Apportionment of common credit · Sec 17(1) &amp; 17(2)</div><h1>Rule 42 &amp; Rule 43 for ${esc(c.name)}</h1><p>Common ITC on inputs and input services (Rule 42) and on capital goods (Rule 43) is reversed in the ratio of exempt to total turnover. Values below are built from the purchase register and the outward supply summary for ${C.periodLabel(per)}.</p></div>
        <div class="actions"><label class="check"><input type="checkbox" id="nb" ${nb ? 'checked' : ''}> Common inputs also used for non-business purposes (D2 = 5%)</label></div></div>
        ${!c.has_exempt ? `<div class="notice info" style="margin-bottom:12px">${esc(c.name)} makes no exempt supplies, so D1 is nil. Switch to Saurashtra Agro Exports or Konkan Logistics to see a full computation.</div>` : ''}
        <div class="grid g2">
          <section class="panel"><div class="panel-head"><h2>Rule 42 · ${C.periodLabel(per)}</h2>${UI.ref('Rule 42(1)')}</div>
            <div class="formula">T  = total ITC on inputs &amp; input services ……… ${f(r.T)}<br>T1 = used exclusively for non-business ……………… ${f(r.T1)}<br>T2 = used exclusively for exempt supplies …………… ${f(r.T2)}<br>T3 = blocked u/s 17(5) ……………………………………… ${f(r.T3)}<br>
            C1 = T − (T1 + T2 + T3) ………………………………… ${f(r.C1)}<br>T4 = used exclusively for taxable supplies ………… ${f(r.T4)}<br>C2 = C1 − T4 = <b>common credit</b> …………………… ${f(r.C2)}<br><br>
            E = exempt + nil + non-GST turnover ………………… ${f(r.E)}<br>F = total turnover in the State …………………………… ${f(r.F)}<br>E ÷ F = <b>${(r.ratio * 100).toFixed(3)}%</b><br><br>
            D1 = (E ÷ F) × C2 → reverse ……………………………… ${f(r.D1)}<br>D2 = 5% × C2 (non-business) → reverse ……………… ${f(r.D2)}<br>C3 = C2 − (D1 + D2) = eligible common credit ……… ${f(r.C3)}</div>
            <div class="notice ${r.reversal ? 'warn' : 'good'}" style="margin-top:10px">Reverse <b>${C.inr(r.reversal)}</b> in GSTR-3B Table 4B(1) for ${C.periodLabel(per)}. Net eligible ITC on inputs &amp; services: <b>${C.inr(r.eligible_total)}</b>.</div></section>
          <section class="panel"><div class="panel-head"><h2>Annual true-up · FY ${fy}-${String(fy + 1).slice(-2)}</h2>${UI.ref('Rule 42(2)')}</div>
            <div class="table-wrap"><table class="t compact"><thead><tr><th>Month</th><th class="right">C2</th><th class="right">E÷F</th><th class="right">D1</th></tr></thead><tbody>${yr.map(x => `<tr><td>${C.periodLabel(x.period)}</td><td class="num">${C.inr(x.C2, 0)}</td><td class="num">${(x.ratio * 100).toFixed(2)}%</td><td class="num">${C.inr(x.D1, 0)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td>Year to date</td><td class="num">${C.inr(C2y, 0)}</td><td class="num">${Fy ? (Ey / Fy * 100).toFixed(2) : '0.00'}%</td><td class="num">${C.inr(D1m, 0)}</td></tr></tfoot></table></div>
            <p class="small">Annual D1 on full-year turnover = ${C.inr(D1y)}. Monthly reversals so far = ${C.inr(D1m)}. ${D1y > D1m ? `<b>Short reversal ${C.inr(D1y - D1m)}</b> - add to output tax with interest u/s 50(1) by the September return of next year.` : `<b>Excess reversal ${C.inr(D1m - D1y)}</b> - re-claim as ITC in the September return of next year.`}</p></section>
        </div>
        <section class="panel" style="margin-top:14px"><div class="panel-head"><h2>Bucket assignment of bills · ${C.periodLabel(per)}</h2><span class="sub">Driven by the "usage" tag and blocked-credit rules</span></div><div id="items"></div></section>
        <section class="panel" style="margin-top:14px"><div class="panel-head"><div><h2>Rule 43 · common capital goods</h2><div class="sub">ITC spread over 60 months; exempt share reversed every month</div></div>${UI.ref('Rule 43(1)(c)-(g)')}</div>
          ${r3.items.length ? `<div class="table-wrap"><table class="t compact"><thead><tr><th>Asset</th><th>Acquired</th><th class="right">ITC (A)</th><th class="right">Tm = A÷60</th><th class="right">Te = Tm × E÷F</th><th class="right">Months left</th></tr></thead><tbody>${r3.items.map(x => `<tr><td>${esc(x.description)} <span class="small muted mono">${esc(x.id)}</span></td><td>${C.periodLabel(x.acquired)}</td><td class="num">${C.inr(x.itc)}</td><td class="num">${C.inr(x.Tm)}</td><td class="num">${C.inr(x.Te)}</td><td class="num">${x.months_remaining}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">Monthly common credit and reversal</td><td class="num">${C.inr(r3.Tm)}</td><td class="num">${C.inr(r3.Te)}</td><td></td></tr></tfoot></table></div>` : '<div class="empty">No capital goods tagged as common use up to this period.</div>'}</section>`;
    },
    mount(host, app) {
      host.querySelector('#nb').addEventListener('change', (e) => { app.DB.settings.non_business_common = e.target.checked; app.changed('Rule 42 D2 toggled'); app.render({ keepScroll: true }); });
      const r = E.rule42(app.subset(), app.clientId(), app.period(), app.DB.settings.non_business_common);
      UI.table(host.querySelector('#items'), { rows: () => r.items, compact: true, filters: [{ label: 'Bucket', options: [['T1', 'T1 non-business'], ['T2', 'T2 exempt'], ['T3', 'T3 blocked'], ['T4', 'T4 taxable'], ['C2', 'C2 common']], get: x => x.bucket }],
        columns: [{ key: 'bucket', label: 'Bucket', render: x => UI.chip(x.bucket, { T1: 'mute', T2: 'warn', T3: 'bad', T4: 'good', C2: 'vi' }[x.bucket]) }, { key: 'supplier_name', label: 'Supplier' }, { key: 'description', label: 'Description', cls: 'wrap' }, { key: 'tax', label: 'ITC', num: true, render: x => C.inr(x.tax), total: true }],
        onRow: x => App.showInvoice(x.id) });
    }
  };

  // ================================================================ RCM register
  V.rcm = {
    title: 'RCM register',
    render(app) {
      const a = app.analysis(), R = a.rcm, st = (s) => R.filter(r => r.status === s);
      const k = (cls, l, v, s) => `<div class="kpi ${cls}"><div class="eyebrow">${l}</div><div class="v">${typeof v === 'number' ? C.inrShort(v) : v}</div><div class="s">${s}</div></div>`;
      return `<div class="page-head"><div><div class="eyebrow">Sec 9(3), 9(4) CGST · Sec 5(3) IGST · Sec 12(3)/13(3) · Sec 31(3)(f)</div><h1>Reverse charge register</h1><p>Time of supply is computed per bill (earliest of payment, receipt or the 31st/61st day after the supplier's invoice). Tax is due with the GSTR-3B of that month and must be paid in cash; delay attracts interest at 18%.</p></div>
        <div class="actions"><button class="btn" data-go="rcm-wizard">${UI.icon('wand')}Check a new expense</button><button class="btn" id="exp">${UI.icon('down')}Export register</button></div></div>
        <div class="kpis">${k('sa', 'RCM tax (all bills)', C.sum(R, r => r.tax), `${R.length} bills`)}${k('good', 'Paid on time', st('Paid on time').length, C.inr(C.sum(st('Paid on time'), r => r.tax), 0))}${k('warn', 'Paid late', st('Paid late').length, C.inr(C.sum(st('Paid late'), r => r.tax), 0))}${k('bad', 'Overdue', st('Overdue').length, C.inr(C.sum(st('Overdue'), r => r.tax), 0))}${k('bad', 'Interest u/s 50', C.sum(R, r => r.interest), '18% p.a.')}${k('', 'Self-invoices missing', R.filter(r => r.self_invoice_required && !r.self_invoice_no).length, 'Rule 47A: within 30 days')}</div>
        <div style="margin-top:14px" id="tbl"></div>`;
    },
    mount(host, app) {
      const a = app.analysis();
      host.querySelector('[data-go]').addEventListener('click', () => app.navigate('rcm-wizard'));
      host.querySelector('#exp').addEventListener('click', () => V._exportMenu(app, 'rcm', () => a.rcm, 'RCM register'));
      UI.table(host.querySelector('#tbl'), { rows: () => a.rcm, sort: 'tos', dir: -1, text: r => `${r.supplier_name} ${r.invoice_no} ${r.rcm_title}`,
        filters: [{ label: 'Status', options: ['Paid on time', 'Paid late', 'Overdue', 'Due'].map(x => [x, x]), get: r => r.status }, { label: 'Category', options: [...new Set(a.rcm.map(r => r.rcm_type))].map(x => [x, (E.catalog().find(e => e.id === x) || {}).title || x]), get: r => r.rcm_type }],
        columns: [{ key: 'supplier_name', label: 'Supplier', cls: 'wrap', render: r => `<b>${esc(r.supplier_name)}</b><div class="small muted">${esc(r.supplier_type)} · <span class="mono">${esc(r.invoice_no)}</span></div>` },
          { key: 'rcm_title', label: 'Category', cls: 'wrap', render: r => `${esc(r.rcm_title)}<div>${UI.ref(r.notification)}</div>` },
          { key: 'taxable_value', label: 'Value', num: true, render: r => C.inr(r.taxable_value), total: true }, { key: 'tax', label: 'RCM tax', num: true, render: r => `${C.inr(r.tax)}<div class="small muted">@${r.rate}%</div>`, total: true },
          { key: 'tos', label: 'Time of supply', render: r => `${C.fmtDate(r.tos)}<div class="tiny muted">${esc(r.tos_basis.split(' - ')[0])}</div>` }, { key: 'due_date', label: 'Due', render: r => C.fmtDate(r.due_date) },
          { key: 'status', label: 'Status', render: r => UI.chip(r.status, { 'Paid on time': 'good', 'Paid late': 'warn', Overdue: 'bad', Due: 'info' }[r.status]) + (r.paid_date ? `<div class="small muted">${C.fmtDate(r.paid_date)}</div>` : '') },
          { key: 'interest', label: 'Interest', num: true, render: r => r.interest ? C.inr(r.interest) : '—', total: true },
          { key: 'si', label: 'Self-invoice', sort: false, render: r => r.self_invoice_required ? (r.self_invoice_no ? `<span class="small mono">${esc(r.self_invoice_no)}</span>` : `<button class="btn sm" data-si="${esc(r.id)}">${UI.icon('file')}Generate</button>`) : '<span class="small muted">n/a</span>' }],
        onRow: r => App.showInvoice(r.id) });
      host.addEventListener('click', (e) => { const b = e.target.closest('[data-si]'); if (b) V.rcm.selfInvoice(app, b.dataset.si); });
    },
    selfInvoice(app, id) {
      const a = app.analysis(), p = a.P.find(x => x.id === id), r = a.rcm.find(x => x.id === id), c = a.client;
      const fy = C.fyLabel(C.d(p.invoice_date)), no = p.self_invoice_no || `SI/${c.id}/${fy}/${String(app.DB.purchases.filter(x => x.client_id === c.id && x.self_invoice_no).length + 1).padStart(4, '0')}`;
      const words = (n) => { const a1 = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'], b1 = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const two = (x) => x < 20 ? a1[x] : b1[Math.floor(x / 10)] + (x % 10 ? ' ' + a1[x % 10] : ''); const three = (x) => (x >= 100 ? a1[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + two(x % 100);
        n = Math.round(n); if (!n) return 'Zero'; let s = ''; const cr = Math.floor(n / 1e7); n %= 1e7; const l = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1e3); n %= 1e3;
        if (cr) s += three(cr) + ' Crore '; if (l) s += two(l) + ' Lakh '; if (th) s += two(th) + ' Thousand '; if (n) s += three(n); return s.trim(); };
      const doc = `<div class="doc" id="si-doc"><div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><h2>SELF-INVOICE</h2><div class="muted">Issued under Section 31(3)(f) of the CGST Act, 2017 read with Rule 46 and Rule 47A</div></div><div style="text-align:right"><b>No. ${esc(no)}</b><br>Date: ${C.fmtDate(C.iso(C.addDays(C.d(p.receipt_date || p.invoice_date), 3)))}</div></div>
        <table><tr><th style="width:50%">Recipient (liable to pay tax)</th><th>Supplier</th></tr><tr><td><b>${esc(c.name)}</b><br>GSTIN: ${esc(c.gstin)}<br>${esc(c.city)}, ${esc(KB().states[c.state])} (${esc(c.state)})</td><td><b>${esc(p.supplier_name)}</b><br>${p.supplier_type === 'Foreign' ? 'Located outside India (non-taxable territory)' : 'Unregistered supplier'}<br>Supplier's bill: ${esc(p.invoice_no)} dated ${C.fmtDate(p.invoice_date)}</td></tr></table>
        <table><tr><th>Description</th><th>HSN/SAC</th><th class="r">Taxable value</th><th class="r">Rate</th><th class="r">IGST</th><th class="r">CGST</th><th class="r">SGST</th></tr>
        <tr><td>${esc(p.description)}</td><td>${esc(p.hsn_sac)}</td><td class="r">${C.inr(p.taxable_value)}</td><td class="r">${p.rate}%</td><td class="r">${C.inr(p.igst)}</td><td class="r">${C.inr(p.cgst)}</td><td class="r">${C.inr(p.sgst)}</td></tr>
        <tr><th colspan="4">Total tax payable on reverse charge</th><th class="r" colspan="3">${C.inr(C.taxOf(p))}</th></tr></table>
        <p><b>Tax in words:</b> Rupees ${words(C.taxOf(p))} only.</p>
        <p>Place of supply: ${esc(KB().states[p.pos] || p.pos)} (${esc(p.pos)}) · Whether tax is payable on reverse charge: <b>Yes</b> · Category: ${esc(r.rcm_title)} (${esc(r.notification)})</p>
        <p class="muted">Time of supply: ${C.fmtDate(r.tos)} (${esc(r.tos_basis)}). Tax to be discharged through the electronic cash ledger in GSTR-3B for ${C.periodLabel(r.liability_period)} (Table 3.1(d)); ITC thereof in Table ${esc(r.table)}.</p>
        <div style="display:flex;justify-content:space-between;margin-top:36px;gap:16px;flex-wrap:wrap"><div class="muted">Prepared with GSTiQ · ${esc(app.DB.firm.name)}</div><div style="text-align:center">For ${esc(c.name)}<br><br><br>Authorised signatory</div></div>
        <hr style="margin:26px 0;border:0;border-top:1px dashed #999"><h2>PAYMENT VOUCHER</h2><div class="muted">Section 31(3)(g) read with Rule 52</div>
        <table><tr><th>Voucher no.</th><td>PV/${esc(no.split('/').slice(1).join('/'))}</td><th>Date of payment</th><td>${C.fmtDate(p.payment_date) || 'To be paid'}</td></tr><tr><th>Paid to</th><td colspan="3">${esc(p.supplier_name)}</td></tr><tr><th>Amount paid</th><td>${C.inr(p.taxable_value)}</td><th>Tax payable (RCM)</th><td>${C.inr(C.taxOf(p))}</td></tr></table></div>`;
      const el = UI.modal({ title: 'Self-invoice & payment voucher', wide: true, body: doc, foot: `<button class="btn" data-close>Close</button>${UI.framed ? '' : `<button class="btn" id="si-print">${UI.icon('print')}Print</button>`}<button class="btn" id="si-html">${UI.icon('down')}Download .html</button>${p.self_invoice_no ? '' : `<button class="btn primary" id="si-save">${UI.icon('check')}Record self-invoice no.</button>`}` });
      const pr = el.querySelector('#si-print'); if (pr) pr.addEventListener('click', () => { document.body.classList.add('printing-modal'); root.print(); setTimeout(() => document.body.classList.remove('printing-modal'), 500); });
      el.querySelector('#si-html').addEventListener('click', () => IO.saveFile(`Self_invoice_${no.replace(/\//g, '-')}.html`, `<!doctype html><meta charset="utf-8"><title>${esc(no)}</title><style>body{font:13px Arial;padding:24px}table{width:100%;border-collapse:collapse;margin:10px 0}td,th{border:1px solid #999;padding:5px;text-align:left}.r{text-align:right}.muted{color:#555}</style>` + el.querySelector('#si-doc').outerHTML, 'text/html'));
      const sv = el.querySelector('#si-save'); if (sv) sv.addEventListener('click', () => { const x = app.DB.purchases.find(q => q.id === id); x.self_invoice_no = no; app.changed('Self-invoice recorded', no); UI.closeTop(); UI.toast('Self-invoice ' + no + ' recorded'); app.render({ keepScroll: true }); });
    }
  };

  // ================================================================ RCM wizard
  V['rcm-wizard'] = {
    title: 'RCM wizard',
    render(app) {
      const sel = app._wiz || { id: 'RCM_GTA', answers: {}, value: 100000, inter: false, inv: C.iso(app.asOn()), pay: '', rec: '' };
      app._wiz = sel;
      const groups = [['service', 'Services · Notfn 13/2017-CT(R) & 10/2017-IT(R)'], ['goods', 'Goods · Notfn 04/2017-CT(R)'], ['9(4)', 'Section 9(4) · promoters']];
      return `<div class="page-head"><div><div class="eyebrow">Decision support · ${E.catalog().length} notified reverse-charge entries</div><h1>Is reverse charge applicable?</h1><p>Describe the expense and let the AI pick the likely entry, or choose one below. Answer the conditions and the wizard decides RCM, computes the tax, the time of supply, the due date and the documents required.</p></div></div>
        <section class="panel" style="margin-bottom:14px"><div class="row"><input type="text" id="desc" placeholder="e.g. Legal fees paid to Adv. Mehta for GST appeal" style="flex:1;min-width:240px"><button class="btn primary" id="sugg">${UI.icon('ai')}Suggest with AI</button></div><div id="sugg-out" class="small" style="margin-top:8px"></div></section>
        <div class="grid g-12"><div class="stack">${groups.map(([g, l]) => `<section><div class="eyebrow" style="margin-bottom:6px">${l}</div><div class="cards" style="grid-template-columns:1fr">${E.catalog().filter(e => e.kind === g).map(e => `<button class="card-btn" data-id="${e.id}" aria-pressed="${e.id === sel.id}"><span class="t">${esc(e.title)}</span><span class="m">${esc(e.entry)} · ${e.rate}%</span></button>`).join('')}</div></section>`).join('')}</div>
        <div id="wiz"></div></div>`;
    },
    mount(host, app) {
      const draw = () => {
        const s = app._wiz, e = E.catalog().find(x => x.id === s.id), res = E.rcmDetermine(s.id, s.answers, s.value, s.inter);
        const qs = e.questions.map((q, i) => { const done = s.answers[q.id] != null; const reached = e.questions.slice(0, i).every(pq => s.answers[pq.id] != null && pq.rcm_values.includes(s.answers[pq.id]));
          return reached ? `<div class="q-step ${done ? 'done' : ''}"><div style="margin-bottom:6px">${esc(q.text)}</div><div class="seg">${q.options.map(o => `<button data-q="${q.id}" data-v="${o.v}" aria-pressed="${s.answers[q.id] === o.v}">${esc(o.label)}</button>`).join('')}</div></div>` : ''; }).join('');
        let tos = '';
        if (res.complete && res.rcm) {
          const fake = { invoice_date: s.inv, payment_date: s.pay, receipt_date: s.rec, rcm_type: s.id };
          if (C.d(s.inv)) { const [t, basis] = E.timeOfSupply(fake); const lp = C.periodOf(t); tos = `<dl class="kv"><dt>Time of supply</dt><dd><b>${C.fmtDate(C.iso(t))}</b> · ${esc(basis)}</dd><dt>Report in</dt><dd>GSTR-3B for ${C.periodLabel(lp)} · due ${C.fmtDate(C.iso(C.dueDate3B(lp)))}</dd>${s.pay && C.d(s.pay) > C.dueDate3B(lp) ? `<dt>Interest if paid on payment date</dt><dd>${C.inr(E.interest(res.tax, C.dueDate3B(lp), C.d(s.pay))[0])}</dd>` : ''}</dl>`; }
        }
        host.querySelector('#wiz').innerHTML = `<section class="panel stack"><div><div class="eyebrow">${esc(e.entry)} · ${esc(e.notification)}</div><h2>${esc(e.title)}</h2><p class="small muted" style="margin:4px 0 0">Supplier: ${esc(e.supplier)} → Recipient: ${esc(e.recipient)}${e.sac ? ` · SAC ${esc(e.sac)}` : e.hsn ? ` · HSN ${esc(e.hsn)}` : ''}</p></div>
          <div>${qs}</div>
          <div class="form-grid"><label class="field">Value of supply (₹)<input type="number" id="w-val" value="${s.value}"></label><label class="field">Supply type<select id="w-inter"><option value="0" ${!s.inter ? 'selected' : ''}>Intra-State (CGST + SGST)</option><option value="1" ${s.inter ? 'selected' : ''}>Inter-State / import (IGST)</option></select></label>
            <label class="field">Supplier invoice date<input type="date" id="w-inv" value="${s.inv}"></label><label class="field">Payment date<input type="date" id="w-pay" value="${s.pay}"></label>${e.kind === 'goods' ? `<label class="field">Goods received on<input type="date" id="w-rec" value="${s.rec}"></label>` : ''}</div>
          ${res.complete ? `<div class="verdict ${res.rcm ? 'yes' : 'no'}"><h3>${res.rcm ? 'Reverse charge applies' : 'No reverse charge'}</h3><p style="margin:0 0 8px">${esc(res.reason)}</p>
            ${res.rcm ? `<div class="grid g3"><div><div class="eyebrow">Tax @ ${res.rate}%</div><b style="font-size:1.25rem">${C.inr(res.tax)}</b></div><div><div class="eyebrow">Split</div>IGST ${C.inr(res.igst)}<br>CGST ${C.inr(res.cgst)} · SGST ${C.inr(res.sgst)}</div><div><div class="eyebrow">ITC to recipient</div>${esc(res.itc)}</div></div>
            <p class="small" style="margin-bottom:0">${esc(res.gstr3b)}. Pay through the electronic cash ledger only (Sec 49(4)).</p>` : ''}</div>` : '<div class="notice">Answer the questions above to reach a decision.</div>'}
          ${tos}
          ${e.notes ? `<div class="notice info small">${esc(e.notes)}</div>` : ''}
          <div><h3>Compliance checklist</h3><ul class="checklist" style="margin-top:6px">${KB().rcm_compliance.map(x => `<li><span class="ok">•</span>${UI.ref(x.ref)}<span><b>${esc(x.title)}.</b> ${esc(x.text)}</span></li>`).join('')}</ul></div></section>`;
        const w = host.querySelector('#wiz');
        w.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { const s2 = app._wiz; s2.answers[b.dataset.q] = b.dataset.v; const idx = e.questions.findIndex(q => q.id === b.dataset.q); e.questions.slice(idx + 1).forEach(q => delete s2.answers[q.id]); draw(); }));
        const bind = (id, k, f) => { const x = w.querySelector(id); if (x) x.addEventListener('change', () => { app._wiz[k] = f(x.value); draw(); }); };
        bind('#w-val', 'value', v => +v || 0); bind('#w-inter', 'inter', v => v === '1'); bind('#w-inv', 'inv', v => v); bind('#w-pay', 'pay', v => v); bind('#w-rec', 'rec', v => v);
      };
      host.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => { app._wiz = Object.assign(app._wiz, { id: b.dataset.id, answers: {} }); host.querySelectorAll('[data-id]').forEach(x => x.setAttribute('aria-pressed', x.dataset.id === b.dataset.id)); draw(); }));
      host.querySelector('#sugg').addEventListener('click', () => {
        const txt = host.querySelector('#desc').value.trim(); if (!txt) return UI.toast('Describe the expense first');
        const r = AI.classify(txt); const kw = r.rcm_keyword; const id = kw ? kw[0] : r.rcm_id;
        const out = host.querySelector('#sugg-out');
        if (id) { out.innerHTML = `AI suggests <b>${esc(E.catalog().find(x => x.id === id).title)}</b> (${(r.confidence * 100).toFixed(0)}% · ${kw ? `keyword "${esc(kw[1])}"` : 'classifier'}). ${r.group === 'blocked' ? `<span class="chip bad">Also note: ${esc(r.name)}</span>` : ''}`; app._wiz = Object.assign(app._wiz, { id, answers: {} }); host.querySelectorAll('[data-id]').forEach(x => x.setAttribute('aria-pressed', x.dataset.id === id)); draw(); }
        else out.innerHTML = `AI reads this as <b>${esc(r.name)}</b> (${(r.confidence * 100).toFixed(0)}%) - not a notified reverse-charge supply. Normal forward charge applies; check Sec 17(5) if blocked.`;
      });
      draw();
    }
  };
})(window);
