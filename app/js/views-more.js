/* Views: Reports, Knowledge hub, Data centre, Setup, About */
(function (root) {
  'use strict';
  const C = root.GSTCore, E = root.GSTEngine, AI = root.GSTAI, UI = root.UI, IO = root.GSTIO, App = root.GSTApp, esc = C.esc;
  const V = App.views, KB = () => root.GST_KB;

  // ================================================================ Reports
  function misSheets(app, id) {
    const a = app.analysis(id), g = app.gstr3b(null, id), c = a.client, t = a.totals;
    const P = (pid) => a.P.find(p => p.id === pid);
    const summary = [['Client', c.name], ['GSTIN', c.gstin], ['As on', C.fmtDate(C.iso(app.asOn()))], ['GST on inward supplies', t.tax], ['Eligible ITC', t.eligible_itc], ['Blocked u/s 17(5)', t.blocked_itc],
      ['At risk', t.at_risk_itc], ['Deferred', t.deferred_itc], ['Lapsed u/s 16(4)', t.lapsed_itc], ['Claimed but not eligible', t.wrongly_claimed], [`GSTR-3B ${g.period} net ITC`, g.net_itc], ['DRC-01C risk', g.drc01c.risk ? 'YES' : 'No']].map(([k, v]) => ({ Indicator: k, Value: v }));
    return [{ name: 'Summary', rows: summary },
      { name: 'ITC Register', rows: a.evals.map(e => { const p = P(e.id); return { id: p.id, supplier: p.supplier_name, gstin: p.supplier_gstin, invoice_no: p.invoice_no, invoice_date: p.invoice_date, description: p.description, taxable: p.taxable_value, gst: e.tax, status: e.status_label, eligible: e.eligible_itc, blocked: e.blocked_itc, at_risk: e.at_risk_itc, deferred: e.deferred_itc, lapsed: e.lapsed_itc, claimed: e.claimed ? 'Y' : 'N', claim_period: e.claim_period, key_issue: (e.flags.find(f => f.severity === 'high') || e.flags[0] || {}).msg || '' }; }) },
      { name: 'Reconciliation', rows: a.recon.filter(r => r.status !== 'NOT_APPLICABLE').map(r => ({ status: r.label, supplier: r.supplier_name, gstin: r.supplier_gstin, invoice_no: r.invoice_no, invoice_date: r.invoice_date, books_gst: r.books_tax, gstr2b_gst: r.b2b_tax, difference: r.tax_diff, period_2b: r.return_period, ims: r.ims_action, confidence: r.confidence, note: r.note })) },
      { name: 'RCM Register', rows: a.rcm.map(r => ({ id: r.id, supplier: r.supplier_name, category: r.rcm_title, notification: r.notification, invoice_date: r.invoice_date, value: r.taxable_value, rate: r.rate, tax: r.tax, time_of_supply: r.tos, basis: r.tos_basis, liability_period: r.liability_period, due: r.due_date, paid: r.paid_date, status: r.status, delay_days: r.delay_days, interest: r.interest, self_invoice: r.self_invoice_no || (r.self_invoice_required ? 'MISSING' : 'n/a'), table: r.table })) },
      { name: `GSTR-3B ${g.period}`, rows: Object.entries(g.tables).map(([k, v]) => Object.assign({ table: k, description: KB().gstr3b_tables[k] || '' }, v)) },
      { name: 'Vendor Risk', rows: app.vendorRisk(id).map(v => Object.assign({ vendor: v.name, gstin: v.gstin, status: v.status, score: v.score, grade: v.grade, invoices: v.invoices, missing_in_2b: v.missing_in_2b, itc_exposure: v.itc_exposure, action: v.action }, v.contributions)) },
      { name: 'Action Plan', rows: V._insights(app, id).map(i => ({ priority: i.sev, finding: i.title, action: i.detail, amount: C.money(i.amount), page: i.go })) }];
  }
  function reviewReportHTML(app) {
    const a = app.analysis(), c = a.client, t = a.totals, g = app.gstr3b(), ins = V._insights(app, c.id), rs = a.reconSum;
    const row = (k, v) => `<tr><td>${esc(k)}</td><td class="r">${C.inr(v)}</td></tr>`;
    return `<div class="doc" id="rpt"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><div class="muted">${esc(app.DB.firm.name)}, ${esc(app.DB.firm.type)}</div><h2>ITC &amp; RCM Review Report</h2><div>${esc(c.name)} · GSTIN ${esc(c.gstin)}</div></div><div style="text-align:right" class="muted">Report date ${C.fmtDate(C.iso(app.asOn()))}<br>Period reviewed: Jan-2026 to Sep-2026<br>GSTR-3B working: ${C.periodLabel(g.period)}</div></div>
      <h3 style="margin-top:18px">1. Executive summary</h3><table>${row('Total GST on inward supplies', t.tax)}${row('Eligible ITC', t.eligible_itc)}${row('Blocked under Section 17(5)', t.blocked_itc)}${row('ITC at risk (not in GSTR-2B / Rule 37 / Rule 37A / cancelled supplier)', t.at_risk_itc)}${row('Deferred (goods not received / RCM unpaid)', t.deferred_itc)}${row('Lapsed under Section 16(4)', t.lapsed_itc)}${row('ITC claimed in returns but not eligible today', t.wrongly_claimed)}</table>
      <h3>2. Key findings and recommended actions</h3><table><tr><th>#</th><th>Priority</th><th>Finding and action</th><th class="r">Amount</th></tr>${ins.map((i, k) => `<tr><td>${k + 1}</td><td>${esc(i.sev.toUpperCase())}</td><td><b>${esc(i.title)}</b><br>${esc(i.detail)}</td><td class="r">${C.inr(i.amount, 0)}</td></tr>`).join('')}</table>
      <h3>3. GSTR-2B reconciliation</h3><table><tr><th>Status</th><th class="r">Records</th><th class="r">GST in books</th><th class="r">GST in 2B</th></tr>${Object.entries(rs).map(([k, v]) => `<tr><td>${esc(E.RECON_LABEL[k])}</td><td class="r">${v.count}</td><td class="r">${C.inr(v.books_tax, 0)}</td><td class="r">${C.inr(v.b2b_tax, 0)}</td></tr>`).join('')}</table>
      <h3>4. Reverse charge</h3><p>${a.rcm.length} supplies attract reverse charge with tax of ${C.inr(C.sum(a.rcm, r => r.tax))}. ${a.rcm.filter(r => r.status === 'Overdue').length} are overdue; interest accrued under Section 50 is ${C.inr(C.sum(a.rcm, r => r.interest))}. ${a.rcm.filter(r => r.self_invoice_required && !r.self_invoice_no).length} self-invoices are yet to be issued under Section 31(3)(f).</p>
      <h3>5. GSTR-3B ${C.periodLabel(g.period)} - Table 4</h3><table><tr><th>Table</th><th class="r">IGST</th><th class="r">CGST</th><th class="r">SGST</th></tr>${['4A(2)', '4A(3)', '4A(5)', '4B(1)', '4B(2)', '4C', '4D(1)', '4D(2)'].map(k => `<tr><td>${k} ${esc(KB().gstr3b_tables[k] || '')}</td><td class="r">${C.inr(g.tables[k].igst, 0)}</td><td class="r">${C.inr(g.tables[k].cgst, 0)}</td><td class="r">${C.inr(g.tables[k].sgst, 0)}</td></tr>`).join('')}</table>
      <p>ITC claimed in books for the period: ${C.inr(g.itc_claimed_total)}; difference from this working: ${C.inr(g.difference)}. DRC-01C (Rule 88D) risk: <b>${g.drc01c.risk ? 'Yes' : 'No'}</b>.</p>
      <h3>6. Basis of preparation</h3><p class="muted">Prepared using GSTiQ from the purchase register, GSTR-2B (IMS actions) and outward-supply summary provided by the client. Law applied as on ${C.fmtDate(KB().meta.law_as_on)}, including GST 2.0 rates from 22-09-2025. Recommendations of the 57th GST Council (08-10-2026) are noted but not applied until notified. This report is based on dummy data for academic demonstration.</p>
      <div style="display:flex;justify-content:flex-end;margin-top:30px"><div style="text-align:center">For ${esc(app.DB.firm.name)}<br>${esc(app.DB.firm.type)}<br><br><br>${esc(c.partner)} (Partner)</div></div></div>`;
  }
  V.reports = {
    title: 'Reports',
    exportMIS: async (app) => { try { await IO.saveFile(`GSTiQ_MIS_${app.client().name.split(' ')[0]}_${app.period()}.xlsx`, IO.workbookBlob(misSheets(app))); app.log('Export', 'Client MIS workbook'); UI.toast('Client MIS workbook ready'); } catch (e) { UI.toast('Export failed: ' + e.message); } },
    render(app) {
      const card = (id, icon, title, text, btns) => `<section class="panel stack" style="gap:10px"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><h3>${esc(title)}</h3><p class="small muted" style="margin:4px 0 0">${text}</p></div>${UI.icon(icon)}</div><div class="row">${btns}</div></section>`;
      return `<div class="page-head"><div><div class="eyebrow">Deliverables for ${esc(app.client().name)}</div><h1>Reports</h1><p>Client-ready outputs generated from the live analysis. Excel files open in Microsoft Excel or LibreOffice; HTML reports can be printed to PDF from the browser.</p></div></div>
        <div class="grid g3">
          ${card('mis', 'report', 'Client MIS workbook', 'Seven sheets: summary, ITC register with status per bill, reconciliation, RCM register, GSTR-3B, vendor risk and action plan.', `<button class="btn primary" data-r="mis">${UI.icon('down')}Excel (.xlsx)</button>`)}
          ${card('review', 'file', 'ITC & RCM review report', 'Narrative report for the client: executive summary, findings with amounts, reconciliation, RCM status and GSTR-3B Table 4.', `<button class="btn" data-r="review">Preview</button><button class="btn" data-r="review-dl">${UI.icon('down')}.html</button>`)}
          ${card('py', 'data', 'Python MIS (formula-driven)', app.backend.ok ? 'Generated by the Python engine with openpyxl: totals and KPIs are live Excel formulas, with a chart and conditional formatting.' : 'Needs the Python engine. Run <span class="mono">python backend/app.py</span> and open http://127.0.0.1:5000.', `<button class="btn" data-r="py" ${app.backend.ok ? '' : 'disabled'}>${UI.icon('down')}Excel from Python</button>`)}
          ${card('letters', 'mail', 'Vendor follow-up letters', 'One letter per supplier whose invoices are missing in GSTR-2B or carry value mismatches.', `<button class="btn" data-r="letters">${UI.icon('down')}Letters (.txt)</button>`)}
          ${card('gstr3b', 'table', 'GSTR-3B working', `Tables 3.1 and 4 for ${C.periodLabel(app.period())} with Rule 42/43 and DRC-01C check.`, `<button class="btn" data-r="3b">${UI.icon('down')}Excel</button>`)}
          ${card('practice', 'clients', 'Practice summary', 'One row per client with ITC position, exceptions and high-priority issues - for the partners\' review meeting.', `<button class="btn" data-r="practice">${UI.icon('down')}Excel</button>`)}
        </div>`;
    },
    mount(host, app) {
      host.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-r]'); if (!b) return; const r = b.dataset.r;
        try {
          if (r === 'mis') await V.reports.exportMIS(app);
          if (r === 'review' || r === 'review-dl') {
            const html = reviewReportHTML(app);
            if (r === 'review-dl') { await IO.saveFile(`ITC_Review_${app.client().name.split(' ')[0]}.html`, `<!doctype html><meta charset="utf-8"><title>ITC Review - ${esc(app.client().name)}</title><style>body{font:13px Arial;padding:24px;max-width:900px;margin:auto}table{width:100%;border-collapse:collapse;margin:8px 0}td,th{border:1px solid #aaa;padding:5px;text-align:left;vertical-align:top}.r{text-align:right}.muted{color:#555}h3{margin-top:18px}</style>` + html, 'text/html'); UI.toast('Report ready'); }
            else { const el = UI.modal({ title: 'ITC & RCM review report', wide: true, body: html, foot: `<button class="btn" data-close>Close</button>${UI.framed ? '' : `<button class="btn primary" id="pr">${UI.icon('print')}Print / save as PDF</button>`}` });
              const pr = el.querySelector('#pr'); if (pr) pr.addEventListener('click', () => { document.body.classList.add('printing-modal'); root.print(); setTimeout(() => document.body.classList.remove('printing-modal'), 500); }); }
          }
          if (r === 'py') { b.disabled = true; const blob = await app.api('/api/report/excel', { data: app.DB, client_id: app.clientId(), period: app.period() }); await IO.saveFile(`GSTiQ_Python_MIS_${app.clientId()}_${app.period()}.xlsx`, blob); b.disabled = false; UI.toast('Python MIS ready'); }
          if (r === 'letters') { const a = app.analysis(); const miss = a.recon.filter(x => ['MISSING_IN_2B', 'MISMATCH_VALUE'].includes(x.status)); const gr = C.groupBy(miss, x => x.supplier_gstin);
            await IO.saveFile(`Vendor_letters_${app.clientId()}.txt`, Object.entries(gr).map(([g, l]) => V._followUpText(app, a.V.find(v => v.gstin === g) || { name: l[0].supplier_name }, l.map(x => a.P.find(p => p.id === x.pr_id)))).join('\n\n' + '='.repeat(70) + '\n\n') || 'No pending follow-ups.', 'text/plain'); }
          if (r === '3b') { const s = misSheets(app); await IO.saveFile(`GSTR3B_${app.clientId()}_${app.period()}.xlsx`, IO.workbookBlob([s[4], s[0]])); }
          if (r === 'practice') { await IO.saveFile('Practice_summary.xlsx', IO.workbookBlob([{ name: 'Clients', rows: app.DB.clients.map(c => { const a = app.analysis(c.id), t = a.totals; return { client: c.name, gstin: c.gstin, partner: c.partner, gst_on_purchases: t.tax, eligible: t.eligible_itc, blocked: t.blocked_itc, at_risk: t.at_risk_itc, deferred: t.deferred_itc, lapsed: t.lapsed_itc, missing_in_2b: a.recon.filter(x => x.status === 'MISSING_IN_2B').length, rcm_overdue: a.rcm.filter(x => x.status === 'Overdue').length, high_priority: V._insights(app, c.id).filter(i => i.sev === 'high').length }; }) }])); }
        } catch (err) { b.disabled = false; UI.toast('Could not create the file: ' + err.message); }
      });
    }
  };

  // ================================================================ Knowledge hub
  V.knowledge = {
    title: 'Knowledge hub',
    render(app) {
      const tab = app._kTab || 'new', k = KB();
      const T = [['new', "What's new"], ['s16', 'Section 16'], ['s175', 'Blocked credits 17(5)'], ['rcm', 'RCM catalogue'], ['rcmc', 'RCM compliance'], ['3b', 'GSTR-3B mapping'], ['cases', 'Case laws & circulars'], ['dates', 'Dates & limits']];
      let body = '';
      if (tab === 'new') body = `<div class="grid g3"><section class="panel"><div class="eyebrow">22 Sep 2025</div><h3>GST 2.0 rate rationalisation</h3><p class="small">${esc(k.rates.note)} GTA remains 5% without ITC under RCM, or 18% with ITC under forward charge. Individual health and life insurance became exempt.</p></section>
        <section class="panel"><div class="eyebrow">Oct 2024 → 2026</div><h3>Invoice Management System</h3><p class="small">Recipients Accept, Reject or keep Pending each supplier record before GSTR-2B is generated on the 14th; GSTR-2B can be recomputed after changing actions. Only accepted and no-action records feed ITC in Table 4A.</p></section>
        <section class="panel"><div class="eyebrow">Finance Act, 2025</div><h3>Sec 17(5)(d) amended retrospectively</h3><p class="small">"Plant or machinery" replaced with "plant and machinery" from 01-07-2017, overriding the Safari Retreats functionality test. Buildings and civil structures stay blocked.</p></section>
        <section class="panel"><div class="eyebrow">10 Oct 2024 · 16 Jan 2025</div><h3>RCM on commercial rent and metal scrap</h3><p class="small">Renting of non-residential property by an unregistered person to a registered person is under RCM (Entry 5AB); composition taxpayers excluded from 16-01-2025. Metal scrap from unregistered persons is under RCM; from registered suppliers, 2% GST-TDS applies.</p></section>
        <section class="panel"><div class="eyebrow">1 Nov 2024</div><h3>Rule 47A self-invoice time limit</h3><p class="small">Self-invoice for supplies from unregistered persons must be issued within 30 days of receipt. Circular 211/5/2024 links the Sec 16(4) limit for RCM ITC to the FY of the self-invoice.</p></section>
        <section class="panel" style="border-color:var(--saffron)"><div class="eyebrow">8 Oct 2026 · proposed</div><h3>57th GST Council recommendations</h3><p class="small">${esc(k.case_laws.find(c => c.name.startsWith('57th')).held)}</p><p class="small"><b>${esc(k.case_laws.find(c => c.name.startsWith('57th')).status)}</b></p></section></div>`;
      if (tab === 's16') body = `<div class="table-wrap"><table class="t"><thead><tr><th>Provision</th><th>Condition</th><th>Explanation</th></tr></thead><tbody>${k.itc_conditions.map(c => `<tr><td>${UI.ref(c.ref)}</td><td><b>${esc(c.title)}</b></td><td class="wrap">${esc(c.text)}</td></tr>`).join('')}</tbody></table></div>`;
      if (tab === 's175') body = `<div class="grid g2">${k.blocked_credits.map(b => `<section class="panel"><div class="row" style="justify-content:space-between"><h3>${esc(b.title)}</h3>${UI.ref(b.ref)}</div><p class="small">${esc(b.text)}</p><p class="small muted"><b>Exception:</b> ${esc(b.exceptions)}</p>${b.proposed ? `<div class="notice info small">${esc(b.proposed)}</div>` : ''}${b.hsn.length || b.sac.length ? `<p class="tiny muted">Codes watched: ${b.hsn.concat(b.sac).map(esc).join(', ')}</p>` : ''}</section>`).join('')}</div>`;
      if (tab === 'rcm') body = `<div class="table-wrap"><table class="t"><thead><tr><th>Entry</th><th>Supply</th><th>Supplier</th><th>Recipient</th><th class="right">Rate</th><th>Notes</th></tr></thead><tbody>${k.rcm_catalog.map(e => `<tr><td>${UI.ref(e.entry)}<div class="tiny muted">${esc(e.notification)}</div></td><td><b>${esc(e.title)}</b></td><td class="wrap small">${esc(e.supplier)}</td><td class="wrap small">${esc(e.recipient)}</td><td class="num">${e.rate}%</td><td class="wrap small">${esc(e.notes)}</td></tr>`).join('')}</tbody></table></div>`;
      if (tab === 'rcmc') body = `<ul class="checklist">${k.rcm_compliance.map(x => `<li><span class="ok">•</span>${UI.ref(x.ref)}<span><b>${esc(x.title)}.</b> ${esc(x.text)}</span></li>`).join('')}</ul>`;
      if (tab === '3b') body = `<div class="table-wrap"><table class="t"><thead><tr><th>Table</th><th>Content</th></tr></thead><tbody>${Object.entries(k.gstr3b_tables).map(([a, b]) => `<tr><td class="mono">${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>`;
      if (tab === 'cases') body = `<div class="stack">${k.case_laws.map(c => `<section class="panel"><div class="row" style="justify-content:space-between"><h3>${esc(c.name)}</h3><span>${UI.chip(c.court + ' · ' + c.year, 'info')} ${UI.ref(c.topic)}</span></div><p class="small"><b>Held:</b> ${esc(c.held)}</p><p class="small muted"><b>Status:</b> ${esc(c.status)}</p></section>`).join('')}</div>`;
      if (tab === 'dates') body = `<div class="table-wrap"><table class="t"><tbody>${[['GSTR-1 (monthly)', k.dates.gstr1_monthly_day + 'th of next month'], ['IFF (QRMP)', k.dates.iff_day + 'th of next month'], ['GSTR-2B generation', k.dates.gstr2b_day + 'th of next month'], ['GSTR-3B (monthly)', k.dates.gstr3b_monthly_day + 'th of next month'], ['Sec 16(4) time limit', k.dates.sec16_4], ['Rule 37A', k.dates.rule37a], ['Rule 37', k.dates.rule37_days + ' days from invoice date'], ['Self-invoice (Rule 47A)', k.dates.self_invoice_days + ' days from receipt'], ['DRC-01C (Rule 88D)', `Excess ITC > ₹${(k.dates.drc01c_amount / 1e5).toFixed(0)} lakh and > ${k.dates.drc01c_percent}%`], ['Rule 86B', `Taxable value > ₹${(k.dates.rule86b_turnover / 1e5).toFixed(0)} lakh in a month → 1% cash`], ['Interest (Sec 50)', k.dates.interest_late_payment + '% p.a. on delayed tax and wrongly availed & utilised ITC'], ['Metal scrap GST-TDS', `2% where contract value > ₹${(k.dates.metal_scrap_tds_threshold / 1e5).toFixed(1)} lakh`]].map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>`;
      return `<div class="page-head"><div><div class="eyebrow">Law as on ${C.fmtDate(k.meta.law_as_on)} · ${esc(k.meta.disclaimer)}</div><h1>Knowledge hub</h1></div></div>
        <div class="tabs" role="tablist" id="ktabs">${T.map(([a, b]) => `<button role="tab" data-tab="${a}" aria-selected="${a === tab}">${b}</button>`).join('')}</div>${body}`;
    },
    mount(host, app) { host.querySelector('#ktabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { app._kTab = b.dataset.tab; app.render({ keepScroll: true }); } }); }
  };

  // ================================================================ Data centre
  const DATASETS = [['purchases', 'Purchase register'], ['gstr2b', 'GSTR-2B (CSV / Excel)'], ['portal2b', 'GSTR-2B portal JSON'], ['vendors', 'Vendor master'], ['clients', 'Client master'], ['sales', 'Outward supplies summary'], ['backup', 'Full backup (.json)']];
  V.data = {
    title: 'Data centre',
    render(app) {
      const counts = { purchases: app.DB.purchases.length, gstr2b: app.DB.gstr2b.length, vendors: app.DB.vendors.length, clients: app.DB.clients.length, sales: app.DB.sales.length };
      let storageOk = true; try { localStorage.setItem('gstiq.t', '1'); localStorage.removeItem('gstiq.t'); } catch (e) { storageOk = false; }
      return `<div class="page-head"><div><div class="eyebrow">Import · export · backup · audit trail</div><h1>Data centre</h1><p>Bring in a client's purchase register from Tally/Busy/Excel, GSTR-2B as downloaded from the GST portal, or vendor masters. Columns are matched automatically using fuzzy header matching; you confirm the mapping before anything is saved.</p></div></div>
        ${storageOk ? '' : '<div class="notice warn" style="margin-bottom:12px">Browser storage is unavailable in this view, so changes last until the page is closed. Use "Full backup" to keep your work.</div>'}
        <div class="grid g-21"><section class="panel stack"><h2>Import</h2>
          <div class="form-grid"><label class="field">What are you importing?<select id="kind">${DATASETS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
            <label class="field">Into client<select id="cl">${app.DB.clients.map(c => `<option value="${c.id}" ${c.id === app.clientId() ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
            <label class="field">Mode<select id="mode"><option value="append">Append to existing</option><option value="replace">Replace this client's records</option></select></label></div>
          <label class="drop" id="drop"><input type="file" id="file" accept=".csv,.xlsx,.xls,.json" hidden><b>Drop a file here or click to browse</b><div class="small muted">CSV, Excel (.xlsx) or JSON · GST portal GSTR-2B JSON is recognised automatically</div></label>
          <div id="mapper"></div></section>
          <div class="stack"><section class="panel"><h2>Export</h2><div class="table-wrap" style="margin-top:8px"><table class="t compact"><tbody>${Object.entries(counts).map(([k, n]) => `<tr><td>${esc(IO.SCHEMAS[k].label)}</td><td class="num">${n}</td><td class="right nowrap"><button class="btn sm" data-x="${k}:xlsx">xlsx</button> <button class="btn sm" data-x="${k}:csv">csv</button> <button class="btn sm" data-x="${k}:json">json</button></td></tr>`).join('')}</tbody></table></div>
            <div class="row" style="margin-top:10px"><button class="btn primary" data-x="all:xlsx">${UI.icon('down')}Everything in one workbook</button><button class="btn" data-x="backup">${UI.icon('down')}Full backup (.json)</button></div>
            <div class="row" style="margin-top:8px"><button class="btn sm" data-x="portal">GSTR-2B portal JSON (${C.periodLabel(app.period())})</button></div></section>
            <section class="panel"><h2>Blank templates</h2><p class="small muted">Column layouts accepted by the importer.</p><div class="row">${Object.keys(IO.SCHEMAS).map(k => `<button class="btn sm" data-t="${k}">${esc(IO.SCHEMAS[k].label)}</button>`).join('')}</div></section>
            <section class="panel"><h2>Reset</h2><p class="small muted">Restore the five demo clients with their original data. Your changes are lost unless exported.</p><button class="btn danger" id="reset">${UI.icon('refresh')}Reset demo data</button></section></div></div>
        <section class="panel" style="margin-top:14px"><div class="panel-head"><h2>Activity log</h2><span class="sub">Audit trail of changes in this browser</span></div><div id="audit"></div></section>`;
    },
    mount(host, app) {
      const $ = (s) => host.querySelector(s);
      UI.table($('#audit'), { rows: () => app.DB.audit, pageSize: 15, search: false, compact: true, columns: [{ key: 'ts', label: 'When', render: r => new Date(r.ts).toLocaleString('en-IN') }, { key: 'action', label: 'Action' }, { key: 'detail', label: 'Detail', cls: 'wrap' }] });
      host.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => IO.saveFile(`GSTiQ_template_${b.dataset.t}.csv`, IO.template(b.dataset.t), 'text/csv')));
      host.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', async () => {
        const [k, fmt] = b.dataset.x.split(':');
        try {
          if (k === 'backup') return void await IO.saveFile(`GSTiQ_backup_${C.iso(new Date())}.json`, JSON.stringify(app.DB), 'application/json');
          if (k === 'portal') { const per = app.period(); const rows = app.DB.gstr2b.filter(x => x.client_id === app.clientId() && x.return_period === per); return void await IO.saveFile(`GSTR2B_${app.client().gstin}_${per.replace('-', '')}.json`, JSON.stringify(IO.toPortal2B(rows, app.client().gstin, per), null, 1), 'application/json'); }
          if (k === 'all') return void await IO.saveFile('GSTiQ_all_data.xlsx', IO.workbookBlob(['clients', 'vendors', 'purchases', 'gstr2b', 'sales'].map(x => ({ name: IO.SCHEMAS[x].label, rows: app.DB[x] }))));
          const rows = app.DB[k];
          if (fmt === 'xlsx') await IO.saveFile(`GSTiQ_${k}.xlsx`, IO.workbookBlob([{ name: IO.SCHEMAS[k].label, rows }]));
          if (fmt === 'csv') await IO.saveFile(`GSTiQ_${k}.csv`, IO.toCSV(rows), 'text/csv');
          if (fmt === 'json') await IO.saveFile(`GSTiQ_${k}.json`, JSON.stringify(rows, null, 1), 'application/json');
          app.log('Export', `${k} ${fmt || ''}`);
        } catch (e) { UI.toast('Export failed: ' + e.message); }
      }));
      $('#reset').addEventListener('click', async () => { if (await UI.confirmBox('Reset all data to the original demo set? Imported and edited records will be lost.', 'Reset', true)) { try { localStorage.removeItem('gstiq.db.v3'); } catch (e) { /* ignore */ } app.DB = null; app.init(); app.cache = {}; app.log('Reset', 'Demo data restored'); app.save(); UI.toast('Demo data restored'); app.render(); } });
      const drop = $('#drop'), file = $('#file');
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
      file.addEventListener('change', () => { if (file.files[0]) handle(file.files[0]); file.value = ''; });

      async function handle(f) {
        let kind = $('#kind').value; const cid = $('#cl').value, mode = $('#mode').value;
        try {
          const raw = await IO.readFile(f);
          if (raw.kind === 'json') {
            const obj = JSON.parse(raw.data);
            if (obj.purchases && obj.clients) { // full backup
              if (!(await UI.confirmBox(`Restore backup with ${obj.purchases.length} purchases and ${obj.clients.length} clients? Current data will be replaced.`, 'Restore'))) return;
              app.DB = obj; app.DB.audit = app.DB.audit || []; app.changed('Backup restored', f.name); UI.toast('Backup restored'); return app.render();
            }
            if (obj.data && obj.data.docdata || obj.docdata) { const r = IO.parsePortal2B(obj, cid); return preview('gstr2b', r.rows.map(x => Object.assign(x, { client_id: cid })), cid, mode, `GSTR-2B portal JSON · GSTIN ${r.gstin} · period ${r.period}`, true); }
            if (Array.isArray(obj)) return mapper(kind === 'portal2b' || kind === 'backup' ? 'purchases' : kind, Object.keys(obj[0] || {}), obj, cid, mode);
            throw new Error('Unrecognised JSON structure');
          }
          if (raw.kind === 'xlsx') {
            if (!IO.hasXLSX()) throw new Error('Excel library not loaded');
            const sheets = IO.readWorkbook(raw.data);
            const pick = sheets.length === 1 ? sheets[0] : await new Promise(res => { const el = UI.modal({ title: 'Choose a sheet', body: `<div class="stack">${sheets.map((s, i) => `<button class="btn" data-s="${i}">${esc(s.name)} · ${s.rows.length} rows</button>`).join('')}</div>`, onClose: () => res(null) }); el.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => { const s = sheets[+b.dataset.s]; res(s); UI.closeTop(); })); });
            if (!pick) return;
            return mapper(kind === 'portal2b' || kind === 'backup' ? 'gstr2b' : kind, pick.headers, pick.rows, cid, mode);
          }
          const csv = IO.parseCSV(raw.data);
          mapper(kind === 'portal2b' || kind === 'backup' ? 'purchases' : kind, csv.headers, csv.rows, cid, mode);
        } catch (e) { UI.toast('Import failed: ' + e.message); }
      }
      function mapper(kind, headers, rows, cid, mode) {
        const schema = IO.SCHEMAS[kind], map = IO.autoMap(headers, schema);
        $('#mapper').innerHTML = `<div class="notice info">${rows.length} rows read. ${Object.keys(map).length} of ${schema.fields.length} fields matched automatically - check the mapping below.</div>
          <div class="table-wrap" style="max-height:340px;overflow:auto;margin-top:8px"><table class="t compact"><thead><tr><th>GSTiQ field</th><th>Column in your file</th><th>Sample</th></tr></thead><tbody>${schema.fields.map(([f, label, , req]) => `<tr><td>${esc(label)}${req ? ' <b style="color:var(--bad)">*</b>' : ''}</td><td><select data-m="${f}"><option value="">— not in file —</option>${headers.map(h => `<option ${map[f] === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></td><td class="small muted" data-s="${f}">${esc(map[f] ? rows[0] && rows[0][map[f]] : '')}</td></tr>`).join('')}</tbody></table></div>
          <div class="row" style="margin-top:10px"><button class="btn primary" id="go">Validate &amp; preview</button></div>`;
        $('#mapper').querySelectorAll('[data-m]').forEach(s => s.addEventListener('change', () => { map[s.dataset.m] = s.value; $('#mapper').querySelector(`[data-s="${s.dataset.m}"]`).textContent = s.value && rows[0] ? rows[0][s.value] : ''; }));
        $('#go').addEventListener('click', () => { const out = IO.applyMap(rows, map, schema); preview(kind, out, cid, mode, `${rows.length} rows from file`); });
      }
      function preview(kind, rows, cid, mode, title, fromPortal) {
        rows.forEach((r, i) => { if ('client_id' in r || kind !== 'clients') r.client_id = r.client_id || cid; });
        const errs = IO.validateRows(kind, rows), hard = errs.filter(e => e.level !== 'warn');
        const el = UI.modal({ title: 'Import preview', sub: esc(title), wide: true, body: `<div class="notice ${hard.length ? 'warn' : 'good'}">${rows.length} rows ready · ${hard.length} missing required values · ${errs.length - hard.length} warnings${hard.length ? ' (rows with missing required values are skipped)' : ''}.</div>
          ${errs.length ? `<details style="margin-top:8px"><summary class="small">Show issues</summary><ul class="small">${errs.slice(0, 60).map(e => `<li>Row ${e.row}: ${esc(e.field)} - ${esc(e.msg)}</li>`).join('')}</ul></details>` : ''}
          <div class="table-wrap" style="margin-top:8px;max-height:300px;overflow:auto"><table class="t compact"><thead><tr>${Object.keys(rows[0] || {}).slice(0, 10).map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 8).map(r => `<tr>${Object.values(r).slice(0, 10).map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
          foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="imp">Import ${rows.length - new Set(hard.map(e => e.row)).size} rows</button>` });
        el.querySelector('#imp').addEventListener('click', () => {
          const bad = new Set(hard.map(e => e.row)); const good = rows.filter((_, i) => !bad.has(i + 1));
          const target = kind === 'gstr2b' ? 'gstr2b' : kind;
          if (mode === 'replace' && kind !== 'clients') app.DB[target] = app.DB[target].filter(x => x.client_id !== cid);
          const stamp = Date.now().toString(36).slice(-4).toUpperCase();
          good.forEach((r, i) => {
            if (kind === 'purchases') { r.id = r.id || `PI-${cid}-I${stamp}${String(i + 1).padStart(4, '0')}`; r.supplier_type = r.supplier_type || (r.supplier_gstin ? 'Regular' : 'Unregistered'); r.supplier_state = r.supplier_state || (r.supplier_gstin ? r.supplier_gstin.slice(0, 2) : app.DB.clients.find(c => c.id === cid).state); r.pos = r.pos || app.DB.clients.find(c => c.id === cid).state; r.category = r.category || 'Inputs'; r.usage = r.usage || 'Taxable'; r.reverse_charge = r.reverse_charge || 'N'; r.itc_claimed = r.itc_claimed || 'N';
              if (!r.receipt_date) r.receipt_date = r.invoice_date; let v = app.DB.vendors.find(x => x.client_id === cid && ((r.supplier_gstin && x.gstin === r.supplier_gstin) || x.name === r.supplier_name));
              if (!v) { v = { id: `V${stamp}${i}`, client_id: cid, name: r.supplier_name, gstin: r.supplier_gstin, state: r.supplier_state, type: r.supplier_type, kind: 'imported', status: 'Active', reg_date: '', cancel_date: '', gstr1_rate: 1, gstr3b_rate: 1, avg_delay: 0, einvoice: false, email: '', phone: '', country: 'India' }; app.DB.vendors.push(v); } r.vendor_id = r.vendor_id || v.id; }
            if (kind === 'gstr2b') { r.id = r.id || `2B-${cid}-I${stamp}${String(i + 1).padStart(5, '0')}`; r.ims_action = r.ims_action || 'No Action'; r.itc_available = r.itc_available || 'Y'; r.reverse_charge = r.reverse_charge || 'N'; r.supplier_3b_filed = r.supplier_3b_filed || 'Y'; }
            if (kind === 'vendors') r.id = r.id || `V${stamp}${i}`;
            if (kind === 'clients') { const g = C.validateGSTIN(r.gstin); r.pan = r.pan || g.pan; r.state = r.state || g.state_code; }
          });
          app.DB[target].push(...good);
          app.changed('Import', `${good.length} ${kind} rows into ${cid} (${mode})`); UI.closeTop(); $('#mapper').innerHTML = `<div class="notice good">Imported ${good.length} rows. Reconciliation and ITC evaluation have been refreshed.</div>`; UI.toast(`Imported ${good.length} rows`);
          app.renderBadges();
        });
      }
    }
  };

  // ================================================================ Setup
  V.setup = {
    title: 'Setup',
    render(app) {
      const s = app.DB.settings, f = app.DB.firm;
      return `<div class="page-head"><div><div class="eyebrow">Preferences for this browser</div><h1>Setup</h1></div></div>
        <div class="grid g2"><section class="panel stack"><h2>CA firm</h2><div class="form-grid"><label class="field">Firm name<input id="fn" type="text" value="${esc(f.name)}"></label><label class="field">Description<input id="ft" type="text" value="${esc(f.type)}"></label><label class="field">FRN<input id="frn" type="text" value="${esc(f.frn)}"></label><label class="field">City<input id="fc" type="text" value="${esc(f.city)}"></label></div>
          <h2>Evaluation date</h2><p class="small muted" style="margin:0">All time limits (Sec 16(4), Rule 37, RCM due dates, interest) are measured from this date. The demo data is built around 29-Oct-2026.</p>
          <div class="row"><input type="date" id="ason" value="${esc(s.as_on)}"><button class="btn sm" id="today">Use today</button></div>
          <button class="btn primary" id="save" style="align-self:flex-start">Save</button></section>
          <section class="panel stack"><h2>Python engine</h2><p class="small muted" style="margin:0">The browser engine is complete on its own. The optional Python engine adds scikit-learn models, the SQLite database and formula-driven Excel reports. ${UI.framed ? 'It is not reachable from this hosted preview; open the downloaded project on your computer.' : ''}</p>
            <label class="field">Engine URL<input id="burl" type="text" value="${esc(s.backend_url)}" class="mono"></label><div class="row"><button class="btn" id="test">Test connection</button><span id="bstat" class="small">${app.backend.ok ? UI.chip('Connected · ' + esc(app.backend.url), 'good') : UI.chip('Not connected', 'mute')}</span></div>
            <div class="formula">cd GSTiQ<br>pip install -r requirements.txt<br>python backend/app.py &nbsp;&nbsp;→ open http://127.0.0.1:5000</div>
            <h2>Appearance</h2><div class="seg">${['', 'light', 'dark'].map(t => `<button data-th="${t}" aria-pressed="${(app.ui.theme || '') === t}">${t ? t[0].toUpperCase() + t.slice(1) : 'System'}</button>`).join('')}</div></section></div>`;
    },
    mount(host, app) {
      const $ = (x) => host.querySelector(x);
      $('#today').addEventListener('click', () => { $('#ason').value = C.iso(new Date()); });
      $('#save').addEventListener('click', () => { Object.assign(app.DB.firm, { name: $('#fn').value, type: $('#ft').value, frn: $('#frn').value, city: $('#fc').value }); app.DB.settings.as_on = $('#ason').value || app.DB.settings.as_on; app.DB.settings.backend_url = $('#burl').value; app.changed('Settings saved'); UI.toast('Saved'); app.render(); });
      $('#test').addEventListener('click', async () => { app.DB.settings.backend_url = $('#burl').value; app.backend.ok = false; await app.detectBackend(); $('#bstat').innerHTML = app.backend.ok ? UI.chip('Connected · scikit-learn ' + esc(app.backend.info.sklearn), 'good') : UI.chip('Could not reach the engine', 'bad'); app.save(); });
      host.querySelectorAll('[data-th]').forEach(b => b.addEventListener('click', () => { app.ui.theme = b.dataset.th; app.applyTheme(app.ui.theme); app.render(); }));
    }
  };

  // ================================================================ About
  V.about = {
    title: 'About the project',
    render(app) {
      const k = KB();
      return `<div class="page-head"><div><div class="eyebrow">ICAI · Advanced Information Technology · Project</div><h1>AI &amp; GST Act, 2017: Input Tax Credit and Reverse Charge</h1><p>GSTiQ is a working compliance tool for a CA office. It automates the review of input tax credit under Sections 16 to 18 of the CGST Act and of supplies liable to reverse charge under Section 9(3)/9(4) of the CGST Act and Section 5(3) of the IGST Act, and uses artificial intelligence where judgement on unstructured data is needed.</p></div></div>
        <div class="grid g2"><section class="panel stack"><h2>Objectives</h2><ol class="small" style="margin:0;padding-left:18px">
          <li>Evaluate every inward invoice against the conditions of Section 16 and the blocked credits of Section 17(5), with an explanation for each decision.</li><li>Reconcile the purchase register with GSTR-2B under the Invoice Management System, using fuzzy matching for real-world data errors.</li>
          <li>Identify reverse-charge supplies, compute time of supply, tax, interest and the documents required.</li><li>Build GSTR-3B Table 3.1(d) and Table 4, apply Rules 42/43, optimise ITC set-off and flag DRC-01C exposure.</li>
          <li>Apply AI: text classification of expenses, anomaly detection, Benford's law, vendor risk scoring, forecasting and a GST chatbot.</li><li>Support the CA office workflow: multiple clients, import/export, reports, letters and an audit trail.</li></ol></section>
          <section class="panel stack"><h2>Technology</h2><div class="table-wrap"><table class="t compact"><tbody>
            <tr><td><b>HTML5 · CSS3</b></td><td>Responsive single-page interface, light/dark themes, print styles</td></tr><tr><td><b>JavaScript (ES2020)</b></td><td>Rules engine, reconciliation, Naive Bayes, Isolation Forest, chatbot, charts (Chart.js), Excel I/O (SheetJS)</td></tr>
            <tr><td><b>Python 3</b></td><td>Same engines in Python, scikit-learn models, Flask REST API, CLI, data generator, openpyxl Excel MIS</td></tr><tr><td><b>SQL (SQLite)</b></td><td>Normalised schema, views and 14 analytical queries (CTEs, window functions)</td></tr>
            <tr><td><b>Excel + VBA</b></td><td>Formula-driven working model and a VBA module with GSTIN check-digit UDF</td></tr><tr><td><b>Jupyter</b></td><td>Notebook documenting the AI models and results</td></tr><tr><td><b>JSON</b></td><td>Single knowledge base shared by both engines; GST-portal GSTR-2B format</td></tr></tbody></table></div></section></div>
        <section class="panel" style="margin-top:14px"><h2>Architecture</h2><div class="arch" style="margin-top:10px">
          <div class="lane">Data sources</div><div class="box"><b>Purchase register</b>Tally / Excel / CSV import with smart column mapping</div><div class="box"><b>GSTR-2B (IMS)</b>Portal JSON or Excel; Accept / Reject / Pending</div><div class="box"><b>Masters &amp; sales</b>Clients, vendors, outward supply summary</div>
          <div class="lane">↓ Knowledge base (${k.rcm_catalog.length} RCM entries · ${k.blocked_credits.length} blocked heads · ${k.case_laws.length} rulings) ↓</div>
          <div class="box"><b>Rule engines</b>Sec 16/17 eligibility · Rules 36(4), 37, 37A, 42, 43 · RCM time of supply · GSTR-3B · set-off · interest</div><div class="box"><b>Reconciliation</b>Exact → AI fuzzy → GSTIN rescue → follow-ups</div><div class="box"><b>AI models</b>Naive Bayes / Logistic Regression · Isolation Forest · Benford · risk scoring · forecasting · chatbot</div>
          <div class="lane">↓ Outputs ↓</div><div class="box"><b>Dashboards</b>Client &amp; practice view, AI insights, calendar</div><div class="box"><b>Documents</b>Self-invoice, payment voucher, vendor letters, review report</div><div class="box"><b>Files</b>Excel MIS, CSV, JSON, SQLite, backup</div></div>
          <p class="small muted">The browser and Python engines are verified against each other by an automated cross-language test on all ${app.DB.purchases.length} demo invoices.</p></section>
        <section class="panel" style="margin-top:14px"><h2>Submitted by</h2><dl class="kv" style="margin-top:8px"><dt>Student</dt><dd>Lakhnotra Bharat Bholabhai</dd><dt>Course</dt><dd>ICAI Advanced Information Technology (AICITSS)</dd><dt>Registration no.</dt><dd>_______________</dd><dt>Batch / centre</dt><dd>_______________</dd><dt>Faculty</dt><dd>_______________</dd></dl>
          <p class="small muted">All client, vendor and invoice data is fictitious and generated by <span class="mono">backend/data_generator.py</span>. ${esc(k.meta.disclaimer)}</p></section>`;
    }
  };
})(window);
