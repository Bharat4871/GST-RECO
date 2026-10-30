/* Views: Purchase register (+ invoice drawer and form), GSTR-2B & IMS */
(function (root) {
  'use strict';
  const C = root.GSTCore, E = root.GSTEngine, AI = root.GSTAI, UI = root.UI, IO = root.GSTIO, App = root.GSTApp, esc = C.esc;
  const V = App.views, KB = () => root.GST_KB;

  // ------------------------------------------------------------------ invoice drawer ("explain my ITC")
  App.showInvoice = function (id) {
    const app = App, a = app.analysis(), p = a.P.find(x => x.id === id);
    if (!p) return UI.toast('Invoice not found for this client');
    const e = a.evalMap[id], r = a.reconByPr[id], b = r && r.b2b_id ? a.B.find(x => x.id === r.b2b_id) : null;
    const ai = AI.classify(p.description, p.hsn_sac), rc = p.reverse_charge === 'Y' ? a.rcm.find(x => x.id === id) : null;
    const cmp = (label, x, y, isMoney) => { const dx = isMoney ? C.inr(x) : esc(x || '—'), dy = b ? (isMoney ? C.inr(y) : esc(y || '—')) : '—'; const diff = b && String(isMoney ? C.money(x) : x).trim().toUpperCase() !== String(isMoney ? C.money(y) : y).trim().toUpperCase(); return `<div class="h">${label}</div><div class="${diff ? 'diff' : ''}">${dx}</div><div class="${diff ? 'diff' : ''}">${dy}</div>`; };
    const el = UI.drawer({ title: `${p.invoice_no}`, sub: `${esc(p.supplier_name)} · ${C.fmtDate(p.invoice_date)} · ${esc(p.id)}`, body: `
      <div class="stack">
        <div class="row" style="justify-content:space-between">${UI.statusChip(e)}<span>GST <b>${C.inr(e.tax)}</b> · eligible <b style="color:var(--good)">${C.inr(e.eligible_itc)}</b></span></div>
        ${e.flags.length ? `<section><h3>What needs attention</h3><ul class="flags" style="margin-top:6px">${e.flags.map(f => `<li class="${f.severity}">${UI.ref(f.ref)} <span>${esc(f.msg)}</span></li>`).join('')}</ul></section>` : '<div class="notice good">All ITC conditions satisfied.</div>'}
        <section><h3>Rule-by-rule check</h3><ul class="checklist" style="margin-top:6px">${e.checks.map(c => `<li><span class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✕'}</span>${UI.ref(c.ref)}<span>${esc(c.msg)}</span></li>`).join('')}</ul></section>
        <section class="panel" style="background:var(--violet-soft);border-color:transparent"><div class="row" style="justify-content:space-between"><h3>${UI.icon('ai')} AI reading of the description</h3><span class="small">${(ai.confidence * 100).toFixed(0)}% confidence</span></div>
          <p style="margin:6px 0 0"><b>${esc(ai.name)}</b> ${UI.ref(ai.ref)} ${ai.because.length ? `<span class="small muted">· signal words: ${ai.because.map(esc).join(', ')}</span>` : ''}</p>
          <p class="small" style="margin:4px 0 0">${ai.rule_label ? (ai.agree ? 'Agrees with the rule engine.' : `Rule engine says <b>${esc(KB().labels[ai.rule_label] ? KB().labels[ai.rule_label].name : ai.rule_label)}</b> (${esc(ai.rule_reason)}); review classification.`) : (ai.group !== 'eligible' && e.status === 'ELIGIBLE' ? 'Rule engine found no block - AI suggests a second look.' : 'No rule-based block applies.')}</p></section>
        ${rc ? `<section><h3>Reverse charge</h3><dl class="kv" style="margin-top:6px"><dt>Category</dt><dd>${esc(rc.rcm_title)} ${UI.ref(rc.notification)}</dd><dt>Time of supply</dt><dd>${C.fmtDate(rc.tos)} <span class="small muted">(${esc(rc.tos_basis)})</span></dd>
          <dt>Liability period</dt><dd>${C.periodLabel(rc.liability_period)} · due ${C.fmtDate(rc.due_date)}</dd><dt>Paid</dt><dd>${rc.paid_date ? C.fmtDate(rc.paid_date) : '<b style="color:var(--bad)">Not paid</b>'} ${UI.chip(rc.status, rc.status === 'Paid on time' ? 'good' : rc.status === 'Due' ? 'info' : 'bad')}</dd>
          <dt>Interest u/s 50</dt><dd>${C.inr(rc.interest)} (${rc.delay_days} days)</dd><dt>Self-invoice</dt><dd>${rc.self_invoice_required ? (rc.self_invoice_no ? esc(rc.self_invoice_no) : `<b style="color:var(--bad)">Missing</b> (due ${C.fmtDate(rc.self_invoice_due)})`) : 'Not required (registered supplier)'}</dd></dl></section>` : ''}
        ${r && r.status !== 'NOT_APPLICABLE' ? `<section><div class="row" style="justify-content:space-between"><h3>Books vs GSTR-2B</h3>${UI.reconChip(r)}</div>
          <div class="compare" style="margin-top:6px"><div class="h"></div><div class="h">Purchase register</div><div class="h">GSTR-2B ${b ? esc(C.periodLabel(b.return_period)) : ''}</div>
          ${cmp('GSTIN', p.supplier_gstin, b && b.supplier_gstin)}${cmp('Invoice no', p.invoice_no, b && b.invoice_no)}${cmp('Date', p.invoice_date, b && b.invoice_date)}
          ${cmp('Taxable', p.taxable_value, b && b.taxable_value, true)}${cmp('GST', C.taxOf(p), b && C.taxOf(b), true)}
          <div class="h">IMS</div><div>—</div><div>${b ? esc(b.ims_action) + (b.itc_available === 'N' ? ' · ITC not available' : '') : '—'}</div></div>
          ${r.note ? `<p class="small muted">${esc(r.note)}</p>` : ''}</section>` : ''}
        <section><h3>Invoice details</h3><dl class="kv" style="margin-top:6px">
          <dt>Supplier</dt><dd>${esc(p.supplier_name)} · ${esc(p.supplier_type)}</dd><dt>GSTIN</dt><dd>${UI.gstinHTML(p.supplier_gstin)}</dd>
          <dt>HSN/SAC</dt><dd class="mono">${esc(p.hsn_sac)}</dd><dt>Description</dt><dd>${esc(p.description)}</dd><dt>Category · usage</dt><dd>${esc(p.category)} · ${esc(p.usage)}</dd>
          <dt>Taxable · rate</dt><dd>${C.inr(p.taxable_value)} @ ${p.rate}%</dd><dt>IGST / CGST / SGST</dt><dd>${C.inr(p.igst)} / ${C.inr(p.cgst)} / ${C.inr(p.sgst)}</dd>
          <dt>Received</dt><dd>${C.fmtDate(p.receipt_date) || '<b>Not received</b>'}</dd><dt>Paid to supplier</dt><dd>${p.payment_date ? C.fmtDate(p.payment_date) : 'Unpaid'}</dd>
          <dt>ITC claimed</dt><dd>${p.itc_claimed === 'Y' ? 'Yes, in ' + C.periodLabel(p.claim_period) : 'No'}</dd>${p.irn ? `<dt>IRN</dt><dd class="mono tiny">${esc(p.irn)}</dd>` : ''}${p.remarks ? `<dt>Remarks</dt><dd>${esc(p.remarks)}</dd>` : ''}</dl></section>
        <div class="row"><button class="btn" id="d-edit">${UI.icon('edit')}Edit</button>${rc && rc.self_invoice_required ? `<button class="btn" id="d-si">${UI.icon('file')}Self-invoice</button>` : ''}<button class="btn danger" id="d-del">${UI.icon('trash')}Delete</button></div>
      </div>` });
    el.querySelector('#d-edit').addEventListener('click', () => { UI.closeTop(); invoiceForm(app, p); });
    const si = el.querySelector('#d-si'); if (si) si.addEventListener('click', () => { UI.closeTop(); V.rcm.selfInvoice(app, id); });
    el.querySelector('#d-del').addEventListener('click', async () => {
      if (!(await UI.confirmBox(`Delete purchase entry <b>${esc(p.invoice_no)}</b> of ${esc(p.supplier_name)}? This cannot be undone (export a backup first if unsure).`, 'Delete', true))) return;
      app.DB.purchases = app.DB.purchases.filter(x => x.id !== id); app.changed('Purchase deleted', `${p.id} ${p.invoice_no}`); UI.closeTop(); UI.toast('Entry deleted'); app.render({ keepScroll: true });
    });
  };

  // ------------------------------------------------------------------ invoice form
  function invoiceForm(app, p) {
    const c = app.client(), a = app.analysis(), isNew = !p;
    p = p ? Object.assign({}, p) : { id: '', client_id: c.id, vendor_id: '', supplier_gstin: '', supplier_name: '', supplier_type: 'Regular', supplier_state: c.state, invoice_no: '', invoice_date: C.iso(app.asOn()), receipt_date: C.iso(app.asOn()),
      hsn_sac: '', description: '', expense_head: '', category: 'Inputs', pos: c.state, taxable_value: 0, rate: 18, igst: 0, cgst: 0, sgst: 0, cess: 0, invoice_value: 0, reverse_charge: 'N', rcm_type: '', rcm_paid_date: '', self_invoice_no: '',
      itc_claimed: 'N', claim_period: '', payment_date: '', amount_paid: 0, usage: 'Taxable', irn: '', remarks: '' };
    const opt = (arr, v) => arr.map(o => `<option value="${esc(o[0] ?? o)}" ${String(o[0] ?? o) === String(v) ? 'selected' : ''}>${esc(o[1] ?? o)}</option>`).join('');
    const el = UI.modal({ title: isNew ? 'Add purchase invoice' : `Edit ${p.invoice_no}`, sub: 'Tax splits automatically into IGST or CGST+SGST from the supplier state and place of supply', wide: true, body: `
      <div class="form-grid">
        <label class="field">Vendor<select id="i-vendor"><option value="">— New / one-time supplier —</option>${a.V.map(v => `<option value="${esc(v.id)}" ${v.id === p.vendor_id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
        <label class="field">Supplier name<input id="i-name" type="text" value="${esc(p.supplier_name)}"></label>
        <label class="field">Supplier GSTIN<input id="i-gstin" type="text" maxlength="15" class="mono" value="${esc(p.supplier_gstin)}"><span class="field-hint" id="i-gmsg"></span></label>
        <label class="field">Supplier type<select id="i-stype">${opt(KB().vendor_types, p.supplier_type)}</select></label>
        <label class="field">Supplier state<select id="i-sstate">${opt(Object.entries(KB().states), p.supplier_state)}</select></label>
        <label class="field">Place of supply<select id="i-pos">${opt(Object.entries(KB().states), p.pos)}</select></label>
        <label class="field">Invoice no<input id="i-no" type="text" class="mono" value="${esc(p.invoice_no)}"></label>
        <label class="field">Invoice date<input id="i-date" type="date" value="${esc(p.invoice_date)}"></label>
        <label class="field">Goods/services received on<input id="i-rec" type="date" value="${esc(p.receipt_date)}"></label>
        <label class="field" style="grid-column:span 2">Description<input id="i-desc" type="text" value="${esc(p.description)}"><span class="field-hint" id="i-ai">AI suggestion appears as you type</span></label>
        <label class="field">HSN / SAC<input id="i-hsn" type="text" class="mono" value="${esc(p.hsn_sac)}"></label>
        <label class="field">ITC category<select id="i-cat">${opt(['Inputs', 'Input Services', 'Capital Goods'], p.category)}</select></label>
        <label class="field">Usage<select id="i-use">${opt([['Taxable', 'Taxable supplies'], ['Common', 'Common (taxable + exempt)'], ['Exempt', 'Exempt supplies only'], ['Project-WC', 'Works contract for customer'], ['Own-Building', 'Own immovable property'], ['Personal', 'Personal / non-business'], ['CSR', 'CSR activity']], p.usage)}</select></label>
        <label class="field">Taxable value (₹)<input id="i-tv" type="number" step="0.01" value="${p.taxable_value}"></label>
        <label class="field">GST rate %<select id="i-rate">${opt([0, 0.25, 3, 5, 18, 40, 12, 28], p.rate)}</select></label>
        <label class="field">IGST<input id="i-igst" type="number" step="0.01" value="${p.igst}"></label>
        <label class="field">CGST<input id="i-cgst" type="number" step="0.01" value="${p.cgst}"></label>
        <label class="field">SGST / UTGST<input id="i-sgst" type="number" step="0.01" value="${p.sgst}"></label>
        <label class="field">Reverse charge<select id="i-rcm">${opt([['N', 'No - forward charge'], ['Y', 'Yes - recipient pays (RCM)']], p.reverse_charge)}</select></label>
        <label class="field">RCM category<select id="i-rcmtype"><option value="">—</option>${E.catalog().map(x => `<option value="${x.id}" ${x.id === p.rcm_type ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></label>
        <label class="field">RCM paid on<input id="i-rcmpaid" type="date" value="${esc(p.rcm_paid_date)}"></label>
        <label class="field">Self-invoice no<input id="i-si" type="text" value="${esc(p.self_invoice_no)}"></label>
        <label class="field">Paid to supplier on<input id="i-pay" type="date" value="${esc(p.payment_date)}"></label>
        <label class="field">ITC claimed in 3B<select id="i-claimed">${opt([['N', 'Not yet'], ['Y', 'Yes']], p.itc_claimed)}</select></label>
        <label class="field">Claim period<input id="i-cper" type="month" value="${esc(p.claim_period)}"></label>
        <label class="field" style="grid-column:1/-1">Remarks<input id="i-rem" type="text" value="${esc(p.remarks)}"></label>
      </div>`, foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="i-save">${isNew ? 'Add invoice' : 'Save changes'}</button>` });
    const $ = (s) => el.querySelector(s);
    const recompute = () => {
      const tv = +$('#i-tv').value || 0, rate = +$('#i-rate').value || 0, tax = C.money(tv * rate / 100);
      const inter = $('#i-sstate').value !== $('#i-pos').value || $('#i-sstate').value === '96';
      $('#i-igst').value = inter ? tax : 0; $('#i-cgst').value = inter ? 0 : C.money(tax / 2); $('#i-sgst').value = inter ? 0 : C.money(tax - C.money(tax / 2));
    };
    ['#i-tv', '#i-rate', '#i-sstate', '#i-pos'].forEach(s => $(s).addEventListener('change', recompute));
    $('#i-vendor').addEventListener('change', () => { const v = a.vmap[$('#i-vendor').value]; if (!v) return; $('#i-name').value = v.name; $('#i-gstin').value = v.gstin; $('#i-stype').value = v.type; $('#i-sstate').value = v.state; gchk(); recompute(); });
    const gchk = () => { const g = $('#i-gstin').value.toUpperCase(); $('#i-gstin').value = g; const v = C.validateGSTIN(g); const m = $('#i-gmsg'); m.className = v.valid || !g ? 'field-hint' : 'field-err'; m.textContent = !g ? 'Leave blank for unregistered / foreign supplier' : v.valid ? '✓ ' + v.state : v.errors[0]; if (v.valid) $('#i-sstate').value = v.state_code; };
    $('#i-gstin').addEventListener('input', gchk); gchk();
    let t; $('#i-desc').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => {
      const txt = $('#i-desc').value; if (txt.length < 4) { $('#i-ai').textContent = 'AI suggestion appears as you type'; return; }
      const r = AI.classify(txt, $('#i-hsn').value);
      $('#i-ai').innerHTML = `AI: <b>${esc(r.name)}</b> (${(r.confidence * 100).toFixed(0)}%) ${r.group === 'rcm' && r.rcm_id ? `<button class="btn sm" type="button" id="i-apply">Apply RCM</button>` : ''}`;
      const ap = $('#i-apply'); if (ap) ap.addEventListener('click', () => { $('#i-rcm').value = 'Y'; $('#i-rcmtype').value = r.rcm_id; const ent = E.catalog().find(x => x.id === r.rcm_id); if (ent) { $('#i-rate').value = ent.rate; recompute(); } });
    }, 250); });
    $('#i-save').addEventListener('click', () => {
      const req = [['#i-name', 'supplier name'], ['#i-no', 'invoice number'], ['#i-date', 'invoice date']].find(([s]) => !$(s).value.trim());
      if (req) return UI.toast('Enter the ' + req[1]);
      const g = $('#i-gstin').value.trim();
      if (g && !C.validateGSTIN(g).valid) UI.toast('Saved with an invalid GSTIN - the bill will be flagged until it is corrected');
      Object.assign(p, { vendor_id: $('#i-vendor').value, supplier_name: $('#i-name').value.trim(), supplier_gstin: g, supplier_type: $('#i-stype').value, supplier_state: $('#i-sstate').value, pos: $('#i-pos').value,
        invoice_no: $('#i-no').value.trim(), invoice_date: $('#i-date').value, receipt_date: $('#i-rec').value, description: $('#i-desc').value, hsn_sac: $('#i-hsn').value, category: $('#i-cat').value, usage: $('#i-use').value,
        taxable_value: +$('#i-tv').value || 0, rate: +$('#i-rate').value || 0, igst: +$('#i-igst').value || 0, cgst: +$('#i-cgst').value || 0, sgst: +$('#i-sgst').value || 0,
        reverse_charge: $('#i-rcm').value, rcm_type: $('#i-rcm').value === 'Y' ? $('#i-rcmtype').value : '', rcm_paid_date: $('#i-rcmpaid').value, self_invoice_no: $('#i-si').value,
        payment_date: $('#i-pay').value, itc_claimed: $('#i-claimed').value, claim_period: $('#i-cper').value, remarks: $('#i-rem').value });
      p.invoice_value = C.money(p.taxable_value + (p.reverse_charge === 'Y' ? 0 : C.taxOf(p))); p.amount_paid = p.payment_date ? p.invoice_value : 0;
      if (!p.vendor_id) { // create a vendor so risk scoring works
        const vid = 'V' + String(app.DB.vendors.length + 1).padStart(3, '0') + 'N';
        app.DB.vendors.push({ id: vid, client_id: c.id, name: p.supplier_name, gstin: p.supplier_gstin, state: p.supplier_state, type: p.supplier_type, kind: 'other', status: 'Active', reg_date: '', cancel_date: '', gstr1_rate: 1, gstr3b_rate: 1, avg_delay: 0, einvoice: false, email: '', phone: '', country: p.supplier_state === '96' ? 'Foreign' : 'India' });
        p.vendor_id = vid;
      }
      if (isNew) { const n = app.DB.purchases.filter(x => x.client_id === c.id).length + 1; p.id = `PI-${c.id}-${String(n).padStart(4, '0')}N`; app.DB.purchases.push(p); }
      else { const i = app.DB.purchases.findIndex(x => x.id === p.id); app.DB.purchases[i] = p; }
      app.changed(isNew ? 'Purchase added' : 'Purchase edited', `${p.id} ${p.invoice_no}`); UI.closeTop(); UI.toast(isNew ? 'Invoice added and evaluated' : 'Invoice updated'); app.render({ keepScroll: true });
      setTimeout(() => App.showInvoice(p.id), 60);
    });
  }
  V._invoiceForm = invoiceForm;

  function exportMenu(app, kind, rowsFn, name) {
    const el = UI.modal({ title: 'Export ' + name, body: `<p class="small muted">${rowsFn().length} records of ${esc(app.client().name)}.</p><div class="row">
      <button class="btn primary" data-fmt="xlsx">${UI.icon('down')}Excel (.xlsx)</button><button class="btn" data-fmt="csv">CSV</button><button class="btn" data-fmt="json">JSON</button></div>` });
    el.querySelectorAll('[data-fmt]').forEach(b => b.addEventListener('click', async () => {
      const rows = rowsFn(), base = `${name.replace(/\W+/g, '_')}_${app.clientId()}`;
      try {
        if (b.dataset.fmt === 'xlsx') await IO.saveFile(base + '.xlsx', IO.workbookBlob([{ name, rows }]));
        if (b.dataset.fmt === 'csv') await IO.saveFile(base + '.csv', IO.toCSV(rows), 'text/csv');
        if (b.dataset.fmt === 'json') await IO.saveFile(base + '.json', JSON.stringify(rows, null, 1), 'application/json');
        UI.closeTop(); UI.toast('Export ready'); app.log('Export', `${name} (${b.dataset.fmt})`);
      } catch (e) { UI.toast('Export failed: ' + e.message); }
    }));
  }
  V._exportMenu = exportMenu;

  // ------------------------------------------------------------------ Purchase register
  V.purchases = {
    title: 'Purchase register',
    render(app) {
      const a = app.analysis();
      return `<div class="page-head"><div><div class="eyebrow">Inward supplies · ${esc(a.client.name)}</div><h1>Purchase register</h1><p>Every bill is evaluated live against Sections 16 &amp; 17, Rules 36(4), 37 and 37A, the GSTR-2B match and the RCM rules. Click a bill to see the reasoning.</p></div>
        <div class="actions"><button class="btn" data-go="data">${UI.icon('up')}Import</button><button class="btn" id="exp">${UI.icon('down')}Export</button><button class="btn primary" id="add">${UI.icon('plus')}Add invoice</button></div></div>
        <div id="tbl"></div>`;
    },
    mount(host, app) {
      const a = app.analysis();
      host.querySelector('[data-go]').addEventListener('click', () => app.navigate('data'));
      host.querySelector('#add').addEventListener('click', () => invoiceForm(app));
      const rows = a.P.map(p => Object.assign({}, p, { _e: a.evalMap[p.id], _r: a.reconByPr[p.id], _tax: C.taxOf(p) }));
      host.querySelector('#exp').addEventListener('click', () => exportMenu(app, 'purchases', () => a.P.map(p => Object.assign({}, p, { itc_status: a.evalMap[p.id].status_label, eligible_itc: a.evalMap[p.id].eligible_itc, recon_status: (a.reconByPr[p.id] || {}).label || '' })), 'Purchase register'));
      const months = [...new Set(rows.map(r => r.invoice_date.slice(0, 7)))].sort();
      UI.table(host.querySelector('#tbl'), { rows: () => rows, sort: 'invoice_date', dir: -1, placeholder: 'Search supplier, invoice no, GSTIN, description…',
        text: r => `${r.supplier_name} ${r.invoice_no} ${r.supplier_gstin} ${r.description} ${r.hsn_sac}`,
        filters: [{ label: 'ITC status', options: Object.entries(E.STATUS).map(([k, v]) => [k, v[1]]), get: r => r._e.status },
          { label: 'Month', options: months.map(m => [m, C.periodLabel(m)]), get: r => r.invoice_date.slice(0, 7) },
          { label: 'Charge', options: [['Y', 'Reverse charge'], ['N', 'Forward charge']], get: r => r.reverse_charge },
          { label: 'Category', options: ['Inputs', 'Input Services', 'Capital Goods'].map(x => [x, x]), get: r => r.category }],
        columns: [
          { key: 'invoice_date', label: 'Date', render: r => `<span class="nowrap">${C.fmtDate(r.invoice_date)}</span>` },
          { key: 'invoice_no', label: 'Invoice', render: r => `<span class="mono">${esc(r.invoice_no)}</span>` },
          { key: 'supplier_name', label: 'Supplier', cls: 'wrap', render: r => `<b>${esc(r.supplier_name)}</b><div>${r.supplier_gstin ? UI.gstinHTML(r.supplier_gstin) : `<span class="small muted">${esc(r.supplier_type)}</span>`}</div>` },
          { key: 'description', label: 'Description', cls: 'wrap', render: r => `${esc(r.description)}<div class="small muted"><span class="mono">${esc(r.hsn_sac)}</span> · ${esc(r.category)}${r.usage !== 'Taxable' ? ' · ' + esc(r.usage) : ''}</div>` },
          { key: 'taxable_value', label: 'Taxable', num: true, render: r => C.inr(r.taxable_value), total: true },
          { key: '_tax', label: 'GST', num: true, render: r => C.inr(r._tax), total: true },
          { key: 'reverse_charge', label: 'RCM', render: r => r.reverse_charge === 'Y' ? UI.chip('RCM', 'sa') : '' },
          { key: 'status', label: 'ITC status', value: r => E.STATUS[r._e.status][0], render: r => UI.statusChip(r._e) },
          { key: 'recon', label: '2B', value: r => r._r ? r._r.label : '', render: r => r._r && r._r.status !== 'NOT_APPLICABLE' ? UI.reconChip(r._r) : '<span class="small muted">n/a</span>' },
          { key: 'claim_period', label: 'Claimed', render: r => r.itc_claimed === 'Y' ? `<span class="small">${C.periodLabel(r.claim_period)}</span>` : '<span class="small muted">—</span>' }],
        onRow: r => App.showInvoice(r.id) });
    }
  };

  // ------------------------------------------------------------------ GSTR-2B & IMS
  V.gstr2b = {
    title: 'GSTR-2B & IMS', usesPeriod: true,
    render(app) {
      const per = app.period(), B = app.analysis().B.filter(b => app._all2b || b.return_period === per);
      const by = C.groupBy(B, b => b.ims_action), sumT = (l) => C.sum(l || [], C.taxOf);
      return `<div class="page-head"><div><div class="eyebrow">Inward supplies as reported by suppliers</div><h1>GSTR-2B &amp; Invoice Management System</h1><p>Suppliers' GSTR-1/IFF/1A records land in IMS, where the recipient Accepts, Rejects or keeps them Pending before GSTR-2B is generated on the 14th. Change an action here to see its effect on reconciliation and GSTR-3B.</p></div>
        <div class="actions"><label class="check"><input type="checkbox" id="all2b" ${app._all2b ? 'checked' : ''}> All periods</label><button class="btn" data-go="data">${UI.icon('up')}Import portal JSON</button><button class="btn" id="exp">${UI.icon('down')}Export</button></div></div>
        <div class="row" style="margin-bottom:12px">${['Accepted', 'No Action', 'Pending', 'Rejected'].map(k => `<span class="pill">${UI.chip(k, { Accepted: 'good', 'No Action': 'info', Pending: 'warn', Rejected: 'bad' }[k])} ${(by[k] || []).length} · ${C.inr(sumT(by[k]), 0)}</span>`).join('')}
          <span class="pill">ITC as per 2B (accepted + no action): <b>${C.inr(sumT((by.Accepted || []).concat(by['No Action'] || []).filter(b => b.itc_available === 'Y')), 0)}</b></span>
          <button class="btn sm" id="acc-all">${UI.icon('check')}Accept all "No Action"</button></div>
        <div id="tbl"></div>`;
    },
    mount(host, app) {
      const a = app.analysis(), per = app.period();
      host.querySelector('[data-go]').addEventListener('click', () => app.navigate('data'));
      host.querySelector('#all2b').addEventListener('change', (e) => { app._all2b = e.target.checked; app.render({ keepScroll: true }); });
      const rows = () => app.analysis().B.filter(b => app._all2b || b.return_period === per);
      host.querySelector('#exp').addEventListener('click', () => exportMenu(app, 'gstr2b', rows, 'GSTR-2B'));
      host.querySelector('#acc-all').addEventListener('click', () => { let n = 0; rows().forEach(b => { if (b.ims_action === 'No Action') { b.ims_action = 'Accepted'; n++; } }); app.changed('IMS bulk accept', `${n} records`); UI.toast(`${n} record(s) accepted`); app.render({ keepScroll: true }); });
      UI.table(host.querySelector('#tbl'), { rows, placeholder: 'Search supplier, GSTIN, invoice…', text: b => `${b.supplier_name} ${b.supplier_gstin} ${b.invoice_no}`,
        filters: [{ label: 'IMS action', options: ['Accepted', 'No Action', 'Pending', 'Rejected'].map(x => [x, x]), get: b => b.ims_action }, { label: 'Charge', options: [['N', 'Forward'], ['Y', 'Reverse charge']], get: b => b.reverse_charge }],
        columns: [{ key: 'return_period', label: 'Period', render: b => C.periodLabel(b.return_period) }, { key: 'supplier_name', label: 'Supplier', cls: 'wrap', render: b => `<b>${esc(b.supplier_name)}</b><div>${UI.gstinHTML(b.supplier_gstin)}</div>` },
          { key: 'invoice_no', label: 'Invoice', render: b => `<span class="mono">${esc(b.invoice_no)}</span><div class="small muted">${C.fmtDate(b.invoice_date)} · ${esc(b.source)}</div>` },
          { key: 'taxable_value', label: 'Taxable', num: true, render: b => C.inr(b.taxable_value), total: true }, { key: 'tax', label: 'GST', num: true, value: C.taxOf, render: b => C.inr(C.taxOf(b)), total: true },
          { key: 'itc_available', label: 'ITC avl.', render: b => b.itc_available === 'Y' ? UI.chip('Yes', 'good') : UI.chip('No · ' + (b.reason || ''), 'bad') },
          { key: 'supplier_3b_filed', label: 'Supplier 3B', render: b => b.supplier_3b_filed === 'Y' ? '<span class="small">Filed</span>' : UI.chip('Not filed', 'warn') },
          { key: 'recon', label: 'In books?', value: b => (a.reconByB[b.id] || {}).label, render: b => a.reconByB[b.id] ? UI.reconChip(a.reconByB[b.id]) : '' },
          { key: 'ims_action', label: 'IMS action', render: b => `<select data-ims="${esc(b.id)}" aria-label="IMS action">${['Accepted', 'No Action', 'Pending', 'Rejected'].map(o => `<option ${o === b.ims_action ? 'selected' : ''}>${o}</option>`).join('')}</select>` }] });
      host.addEventListener('change', (e) => {
        const s = e.target.closest('[data-ims]'); if (!s) return;
        const b = app.DB.gstr2b.find(x => x.id === s.dataset.ims); b.ims_action = s.value;
        app.changed('IMS action', `${b.invoice_no} → ${s.value}`); UI.toast(`IMS: ${b.invoice_no} marked ${s.value}`); app.render({ keepScroll: true });
      });
    }
  };
})(window);
