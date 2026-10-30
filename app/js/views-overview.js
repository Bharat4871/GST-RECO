/* Views: Dashboard (client + practice portfolio), Clients, Vendors */
(function (root) {
  'use strict';
  const C = root.GSTCore, E = root.GSTEngine, AI = root.GSTAI, UI = root.UI, App = root.GSTApp, esc = C.esc;
  const V = App.views;

  // ------------------------------------------------------------------ AI insights
  function insights(app, id) {
    const a = app.analysis(id), out = [];
    const flagged = (code) => a.evals.filter(e => e.flags.some(f => f.code === code));
    const amt = (list) => C.sum(list, e => e.tax);
    const periods = app.periods(id).filter(p => app.DB.sales.some(s => s.client_id === id && s.period === p));
    const drc = periods.map(p => app.gstr3b(p, id)).filter(g => g.drc01c.risk);
    if (drc.length) out.push({ sev: 'high', title: `DRC-01C intimation likely for ${drc.map(g => C.periodLabel(g.period)).join(', ')}`, detail: `ITC claimed exceeds GSTR-2B by ${C.inr(drc[0].drc01c.excess, 0)} (${drc[0].drc01c.excess_pct.toFixed(0)}%) - above the Rule 88D limit of ₹25 lakh and 20%. Reverse via DRC-03 or prepare Part B reply.`, amount: drc[0].drc01c.excess, go: 'gstr3b' });
    const dl = flagged('DEADLINE_NEAR');
    if (dl.length) out.push({ sev: 'high', title: `${dl.length} bill(s) of FY 2025-26 not yet claimed - last chance is the October 2026 GSTR-3B`, detail: 'Section 16(4) bars ITC after 30-11-2026. Claim these in the return due 20-11-2026 after confirming GSTR-2B reflection.', amount: amt(dl), go: 'itc' });
    const ex = flagged('EXCESS_CLAIM');
    if (ex.length) { const top = Object.entries(C.groupBy(ex, e => a.P.find(p => p.id === e.id).supplier_name)).sort((x, y) => amt(y[1]) - amt(x[1]))[0]; out.push({ sev: 'high', title: `ITC claimed on ${ex.length} invoice(s) that are not in GSTR-2B`, detail: `Rule 36(4) violation. Largest exposure: ${top[0]}. Reverse in 4B(2) or get suppliers to upload via GSTR-1A/IFF.`, amount: amt(ex), go: 'recon' }); }
    const r37 = flagged('RULE_37'); if (r37.length) out.push({ sev: 'high', title: `${r37.length} supplier bill(s) unpaid beyond 180 days`, detail: 'Rule 37: add the ITC to output tax with interest u/s 50; re-avail when payment is made.', amount: amt(r37), go: 'itc' });
    const r37a = flagged('RULE_37A'); if (r37a.length) out.push({ sev: 'high', title: `Rule 37A reversal due by 30-11-2026 on ${r37a.length} bill(s)`, detail: 'Suppliers furnished GSTR-1 but did not file GSTR-3B by 30-09-2026. Reverse in the October return; re-avail once they file.', amount: amt(r37a), go: 'itc' });
    const bc = a.evals.filter(e => e.status === 'BLOCKED' && e.claimed); if (bc.length) out.push({ sev: 'high', title: `Blocked credit claimed on ${bc.length} bill(s)`, detail: 'Motor vehicles, food, club, gifts, CSR and own construction are blocked u/s 17(5). Reverse in Table 4B(1).', amount: amt(bc), go: 'itc' });
    const dup = flagged('DUPLICATE'); if (dup.length) out.push({ sev: 'high', title: `${dup.length} duplicate purchase entr${dup.length > 1 ? 'ies' : 'y'} in books`, detail: 'Same supplier, invoice number and value booked twice - ITC double counted.', amount: amt(dup), go: 'purchases' });
    const od = a.rcm.filter(r => r.status === 'Overdue'); if (od.length) out.push({ sev: 'medium', title: `${od.length} RCM liabilit${od.length > 1 ? 'ies' : 'y'} overdue`, detail: `Interest accrued ${C.inr(C.sum(od, r => r.interest))}. Pay in cash (Sec 49(4)); ITC follows in the same return.`, amount: C.sum(od, r => r.tax), go: 'rcm' });
    const si = a.rcm.filter(r => r.self_invoice_required && !r.self_invoice_no); if (si.length) out.push({ sev: 'medium', title: `${si.length} self-invoice(s) not issued for RCM purchases`, detail: 'Sec 31(3)(f) with Rule 47A requires a self-invoice within 30 days of receipt. Generate them from the RCM register.', amount: C.sum(si, r => r.tax), go: 'rcm' });
    const vr = app.vendorRisk(id).filter(v => v.grade === 'D' || v.grade === 'C'); if (vr.length) out.push({ sev: 'medium', title: `${vr.length} high-risk vendor(s) detected by AI`, detail: `Top: ${vr.slice(0, 2).map(v => `${v.name} (${v.score})`).join(', ')}. Hold payments until they file GSTR-1/3B.`, amount: C.sum(vr, v => v.itc_exposure), go: 'vendors' });
    const rate = flagged('RATE_INVALID'); if (rate.length) out.push({ sev: 'medium', title: `${rate.length} invoice(s) carry a pre-GST 2.0 rate`, detail: '12%/28% slabs were rationalised from 22-09-2025. Check classification and seek credit notes for excess tax.', amount: amt(rate), go: 'itc' });
    const prop = a.evals.filter(e => e.status === 'BLOCKED' && e.flags.some(f => f.code === 'PROPOSED_RELAXATION'));
    if (prop.length) out.push({ sev: 'low', title: 'Watch: 57th GST Council proposed to unblock some credits', detail: `If notified, ${prop.length} currently blocked bill(s) (catering, insurance, gifts/samples) may become eligible prospectively. No change until the CGST Act is amended.`, amount: amt(prop), go: 'knowledge' });
    return out;
  }
  V._insights = insights;

  const calendar = (app) => {
    const asOn = app.asOn(), y = asOn.getUTCFullYear(), m = asOn.getUTCMonth();
    const nm = (dd, mo = m + 1) => new Date(Date.UTC(y + Math.floor(mo / 12), mo % 12, dd));
    const items = [[nm(11), 'GSTR-1 for ' + C.MONTHS[m] + ' (monthly filers)'], [nm(13), 'IFF for QRMP taxpayers'], [nm(14), `GSTR-2B for ${C.MONTHS[m]} generated - finalise IMS actions`],
      [nm(20), `GSTR-3B for ${C.MONTHS[m]} - RCM in cash, 16(4) last return for FY ${y - 1}-${String(y).slice(-2)}`], [new Date(Date.UTC(y, 10, 30)), 'Sec 16(4) & Rule 37A reversal deadline'], [new Date(Date.UTC(y, 11, 31)), `GSTR-9 / 9C for FY ${y - 1}-${String(y).slice(-2)}`]];
    return `<ul class="cal">${items.filter(i => i[0] >= asOn).sort((a, b) => a[0] - b[0]).map(([dt, t]) => { const days = C.daysBetween(asOn, dt); return `<li class="${days <= 10 ? 'urgent' : ''}"><div class="date"><b>${dt.getUTCDate()}</b><span>${C.MONTHS[dt.getUTCMonth()]}</span></div><div><div>${esc(t)}</div><div class="small muted">${days === 0 ? 'Today' : `in ${days} day${days > 1 ? 's' : ''}`}</div></div></li>`; }).join('')}</ul>`;
  };

  // ------------------------------------------------------------------ Dashboard
  V.dashboard = {
    title: 'Dashboard', allowAll: true, usesPeriod: true,
    render(app) {
      if (app.ui.client === 'ALL') return portfolio(app);
      const a = app.analysis(), c = a.client, t = a.totals, g = app.gstr3b();
      const dl = a.evals.filter(e => e.flags.some(f => f.code === 'DEADLINE_NEAR'));
      const days = C.daysBetween(app.asOn(), C.d('2026-11-30'));
      const pct = t.tax ? t.eligible_itc / t.tax : 0;
      const ins = insights(app, c.id);
      const kpi = (cls, label, v, s, bar) => `<div class="kpi ${cls}"><div class="eyebrow">${label}</div><div class="v" title="${C.inr(v)}">${typeof v === 'number' ? C.inrShort(v) : v}</div><div class="s">${s}</div>${bar != null ? `<div class="bar" style="color:var(--${cls === 'good' ? 'good' : cls === 'bad' ? 'bad' : 'accent'})"><i style="width:${Math.min(100, bar * 100).toFixed(1)}%"></i></div>` : ''}</div>`;
      return `
      <div class="page-head"><div>
        <div class="eyebrow">Client dashboard · FY 2026-27 &amp; FY 2025-26 carry-over</div>
        <div class="client-head"><h1>${esc(c.name)}</h1>${UI.gstinHTML(c.gstin)}</div>
        <p>${esc(c.business)} · ${esc(c.constitution)} · ${esc(c.city)}, ${esc(root.GST_KB.states[c.state] || '')} · ${esc(c.filing)} filer · Partner: ${esc(c.partner)}</p>
      </div><div class="actions"><button class="btn" data-go="itc">${UI.icon('shield')}Review ITC</button><button class="btn primary" data-act="mis">${UI.icon('down')}Export client MIS</button></div></div>
      <div class="kpis">
        ${kpi('', 'GST on inward supplies', t.tax, `${t.count} bills · Jan–Sep 2026`, null)}
        ${kpi('good', 'Eligible ITC', t.eligible_itc, `${(pct * 100).toFixed(1)}% of GST paid`, pct)}
        ${kpi('bad', 'Blocked u/s 17(5)', t.blocked_itc, `${t.by_status.BLOCKED ? t.by_status.BLOCKED.count : 0} bills`, t.tax ? t.blocked_itc / t.tax : 0)}
        ${kpi('warn', 'ITC at risk', t.at_risk_itc, 'Not in 2B · Rule 37/37A · cancelled', t.tax ? t.at_risk_itc / t.tax : 0)}
        ${kpi('sa', `RCM · ${C.periodLabel(g.period)}`, C.sum(['igst', 'cgst', 'sgst'], h => g.tables['3.1(d)'][h]), `Table 3.1(d) · pay in cash`, null)}
        ${kpi(days <= 45 ? 'bad' : '', '16(4) deadline FY 25-26', `${days} days`, dl.length ? `${dl.length} bills · ${C.inrShort(C.sum(dl, e => e.tax))} unclaimed` : 'Nothing pending', null)}
      </div>
      <div class="grid g-21" style="margin-top:14px">
        <section class="panel"><div class="panel-head"><div><h2>${UI.icon('ai', 'inline')} AI compliance insights</h2><div class="sub">Generated from ${a.evals.length} rule evaluations, reconciliation and vendor-risk models</div></div><span class="chip ${ins.some(i => i.sev === 'high') ? 'bad' : 'good'}">${ins.filter(i => i.sev === 'high').length} high priority</span></div>
          ${ins.length ? `<ul class="insights">${ins.slice(0, 8).map(i => `<li><span class="sev ${i.sev}"></span><div><b>${esc(i.title)}</b><div class="small muted">${esc(i.detail)}</div></div><div class="right"><div class="amt">${C.inrShort(i.amount)}</div><button class="btn sm ghost" data-go="${i.go}">Open →</button></div></li>`).join('')}</ul>` : '<div class="empty">No issues found. ITC position is clean.</div>'}
        </section>
        <section class="panel"><div class="panel-head"><h2>Compliance calendar</h2><span class="sub">${C.MONTHS[app.asOn().getUTCMonth()]}–Dec</span></div>${calendar(app)}</section>
      </div>
      <div class="grid g-21" style="margin-top:14px">
        <section class="panel"><div class="panel-head"><div><h2>ITC by invoice month</h2><div class="sub">Where each rupee of input GST stands today</div></div></div><div class="chart-box"><canvas id="ch-month" aria-label="Monthly ITC chart"></canvas></div></section>
        <section class="panel"><div class="panel-head"><div><h2>GSTR-2B reconciliation</h2><div class="sub">${a.recon.length} records matched across books and 2B</div></div></div><div class="chart-box"><canvas id="ch-recon" aria-label="Reconciliation status chart"></canvas></div></section>
      </div>
      <div class="grid g2" style="margin-top:14px">
        <section class="panel"><div class="panel-head"><h2>Why ITC is not eligible</h2><span class="sub">Headline status per bill</span></div><div id="why"></div></section>
        <section class="panel"><div class="panel-head"><h2>Reverse charge by category</h2><span class="sub">Tax paid by ${esc(c.name.split(' ')[0])} as recipient</span></div><div class="chart-box short"><canvas id="ch-rcm" aria-label="RCM by category chart"></canvas></div></section>
      </div>`;
    },
    mount(host, app) {
      host.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => app.navigate(b.dataset.go)));
      if (app.ui.client === 'ALL') return mountPortfolio(host, app);
      host.querySelector('[data-act="mis"]').addEventListener('click', () => V.reports.exportMIS(app));
      const a = app.analysis(), pal = UI.palette();
      const months = [...new Set(a.evals.map(e => e.period))].filter(p => p >= '2026-01').sort();
      const series = (fn) => months.map(m => C.money(C.sum(a.evals.filter(e => e.period === m), fn)));
      UI.chart(host.querySelector('#ch-month'), { type: 'bar', stacked: true, data: { labels: months.map(C.periodLabel), datasets: [
        { label: 'Eligible', data: series(e => e.eligible_itc), backgroundColor: pal[2] }, { label: 'Blocked', data: series(e => e.blocked_itc), backgroundColor: pal[3] },
        { label: 'At risk', data: series(e => e.at_risk_itc), backgroundColor: pal[1] }, { label: 'Deferred / RCM unpaid', data: series(e => e.deferred_itc), backgroundColor: pal[0] }] } });
      const rs = a.reconSum, keys = Object.keys(rs).filter(k => k !== 'NOT_APPLICABLE');
      const colors = { MATCHED: pal[2], MATCHED_FUZZY: pal[4], MISMATCH_VALUE: pal[1], MISMATCH_DATE: pal[5], GSTIN_MISMATCH: pal[6], MISSING_IN_2B: pal[3], MISSING_IN_BOOKS: pal[0], DUPLICATE_IN_BOOKS: pal[6] };
      UI.chart(host.querySelector('#ch-recon'), { type: 'doughnut', money: false, data: { labels: keys.map(k => E.RECON_LABEL[k]), datasets: [{ data: keys.map(k => rs[k].count), backgroundColor: keys.map(k => colors[k]), borderWidth: 0 }] }, options: { cutout: '62%' } });
      const bs = a.totals.by_status, tot = a.totals.tax || 1;
      host.querySelector('#why').innerHTML = Object.entries(bs).filter(([k]) => k !== 'ELIGIBLE').sort((x, y) => y[1].tax - x[1].tax).map(([k, v]) =>
        `<div class="hbar"><span>${UI.chip(E.STATUS[k][1], UI.STATUS_CHIP[k])} <span class="muted small">${v.count}</span></span><span class="track"><i style="width:${(v.tax / tot * 100).toFixed(1)}%;background:var(--${UI.STATUS_CHIP[k] === 'bad' ? 'bad' : UI.STATUS_CHIP[k] === 'warn' ? 'warn' : UI.STATUS_CHIP[k] === 'sa' ? 'saffron' : 'info'})"></i></span><span class="num small">${C.inr(v.tax, 0)}</span></div>`).join('') || '<div class="empty">All bills eligible.</div>';
      const by = C.groupBy(a.rcm, r => r.rcm_title.split(' (')[0]);
      const ent = Object.entries(by).map(([k, v]) => [k, C.sum(v, r => r.tax)]).sort((x, y) => y[1] - x[1]);
      UI.chart(host.querySelector('#ch-rcm'), { type: 'bar', horizontal: true, legend: false, data: { labels: ent.map(e => e[0].length > 34 ? e[0].slice(0, 33) + '…' : e[0]), datasets: [{ label: 'RCM tax', data: ent.map(e => C.money(e[1])), backgroundColor: pal[1] }] } });
    }
  };

  function portfolio(app) {
    const rows = app.DB.clients.map(c => { const a = app.analysis(c.id); const vr = app.vendorRisk(c.id); const ins = insights(app, c.id);
      return { c, t: a.totals, miss: a.recon.filter(r => r.status === 'MISSING_IN_2B').length, od: a.rcm.filter(r => r.status === 'Overdue').length, hv: vr.filter(v => v.grade === 'C' || v.grade === 'D').length, high: ins.filter(i => i.sev === 'high').length }; });
    const T = (k) => C.sum(rows, r => r.t[k]);
    return `<div class="page-head"><div><div class="eyebrow">Practice overview · ${esc(app.DB.firm.name)}, ${esc(app.DB.firm.type)}</div><h1>${rows.length} GST clients under review</h1><p>Aggregated ITC position, open exceptions and risk for every client the office handles. Select a client to drill down.</p></div></div>
      <div class="kpis">
        <div class="kpi"><div class="eyebrow">GST on inward supplies</div><div class="v">${C.inrShort(T('tax'))}</div><div class="s">${C.sum(rows, r => r.t.count)} bills</div></div>
        <div class="kpi good"><div class="eyebrow">Eligible ITC</div><div class="v">${C.inrShort(T('eligible_itc'))}</div><div class="s">${(T('eligible_itc') / T('tax') * 100).toFixed(1)}% of GST</div></div>
        <div class="kpi bad"><div class="eyebrow">Blocked 17(5)</div><div class="v">${C.inrShort(T('blocked_itc'))}</div><div class="s">across clients</div></div>
        <div class="kpi warn"><div class="eyebrow">At risk</div><div class="v">${C.inrShort(T('at_risk_itc'))}</div><div class="s">needs follow-up</div></div>
        <div class="kpi"><div class="eyebrow">Missing in 2B</div><div class="v">${C.sum(rows, r => r.miss)}</div><div class="s">invoices</div></div>
        <div class="kpi bad"><div class="eyebrow">High-priority issues</div><div class="v">${C.sum(rows, r => r.high)}</div><div class="s">AI insights</div></div>
      </div>
      <section class="panel" style="margin-top:14px"><div class="panel-head"><h2>Client-wise position</h2><span class="sub">Click a row to open the client dashboard</span></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Client</th><th>GSTIN</th><th class="right">Eligible ITC</th><th class="right">Blocked</th><th class="right">At risk</th><th class="right">Missing in 2B</th><th class="right">RCM overdue</th><th class="right">Risky vendors</th><th>Priority</th></tr></thead>
        <tbody>${rows.map(r => `<tr class="clickable" data-client="${esc(r.c.id)}"><td><b>${esc(r.c.name)}</b><div class="small muted">${esc(r.c.business)}</div></td><td>${UI.gstinHTML(r.c.gstin)}</td><td class="num">${C.inr(r.t.eligible_itc, 0)}</td><td class="num">${C.inr(r.t.blocked_itc, 0)}</td><td class="num">${C.inr(r.t.at_risk_itc, 0)}</td><td class="num">${r.miss}</td><td class="num">${r.od}</td><td class="num">${r.hv}</td><td>${r.high ? UI.chip(r.high + ' high', 'bad') : UI.chip('Clean', 'good')}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel" style="margin-top:14px"><div class="panel-head"><h2>ITC composition by client</h2></div><div class="chart-box tall"><canvas id="ch-port"></canvas></div></section>`;
  }
  function mountPortfolio(host, app) {
    host.querySelectorAll('tr[data-client]').forEach(tr => tr.addEventListener('click', () => { app.ui.client = tr.dataset.client; app.cache = {}; app.render(); }));
    const pal = UI.palette(), cl = app.DB.clients, a = cl.map(c => app.analysis(c.id).totals);
    UI.chart(host.querySelector('#ch-port'), { type: 'bar', stacked: true, data: { labels: cl.map(c => c.name.split(' ').slice(0, 2).join(' ')), datasets: [
      { label: 'Eligible', data: a.map(t => t.eligible_itc), backgroundColor: pal[2] }, { label: 'Blocked', data: a.map(t => t.blocked_itc), backgroundColor: pal[3] },
      { label: 'At risk', data: a.map(t => t.at_risk_itc), backgroundColor: pal[1] }, { label: 'Deferred', data: a.map(t => t.deferred_itc), backgroundColor: pal[0] }, { label: 'Lapsed', data: a.map(t => t.lapsed_itc), backgroundColor: pal[6] }] } });
  }

  // ------------------------------------------------------------------ Clients
  function clientForm(app, c) {
    c = c || { id: 'C' + (app.DB.clients.length + 1), name: '', gstin: '', pan: '', state: '24', city: '', constitution: 'Private Limited Company', business: '', nature: 'Manufacturer', turnover_cr: 0, filing: 'Monthly', partner: '', email: '', has_exempt: false };
    const isNew = !app.DB.clients.some(x => x.id === c.id);
    const el = UI.modal({ title: isNew ? 'Add client' : 'Edit client', sub: 'GSTIN is validated with the official check-digit algorithm as you type',
      body: `<form id="cf" class="form-grid">
        <label class="field" style="grid-column:1/-1">Legal name<input id="f-name" type="text" required value="${esc(c.name)}"></label>
        <label class="field">GSTIN<input id="f-gstin" type="text" maxlength="15" required value="${esc(c.gstin)}" class="mono"><span class="field-hint" id="g-msg"></span></label>
        <label class="field">PAN<input id="f-pan" type="text" maxlength="10" value="${esc(c.pan)}" class="mono"></label>
        <label class="field">City<input id="f-city" type="text" value="${esc(c.city)}"></label>
        <label class="field">Constitution<select id="f-const">${['Private Limited Company', 'Public Limited Company', 'Limited Liability Partnership', 'Partnership Firm', 'HUF', 'Trust', 'Society'].map(o => `<option ${o === c.constitution ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
        <label class="field">Nature of business<select id="f-nature">${['Manufacturer', 'Trader', 'Service Provider', 'Works Contractor', 'Service Provider / Exporter', 'Restaurant / Hotel', 'Transport of passengers'].map(o => `<option ${o === c.nature ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
        <label class="field">Business description<input id="f-bus" type="text" value="${esc(c.business)}"></label>
        <label class="field">Turnover (₹ crore)<input id="f-to" type="number" step="0.1" value="${esc(c.turnover_cr)}"></label>
        <label class="field">Return filing<select id="f-fil"><option ${c.filing === 'Monthly' ? 'selected' : ''}>Monthly</option><option ${c.filing === 'QRMP' ? 'selected' : ''}>QRMP</option></select></label>
        <label class="field">Partner in charge<input id="f-par" type="text" value="${esc(c.partner)}"></label>
        <label class="field">Email<input id="f-mail" type="email" value="${esc(c.email)}"></label>
        <label class="check" style="grid-column:1/-1"><input id="f-ex" type="checkbox" ${c.has_exempt ? 'checked' : ''}> Makes exempt / nil-rated supplies (Rule 42/43 apply)</label></form>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="f-save">${isNew ? 'Add client' : 'Save changes'}</button>` });
    const g = el.querySelector('#f-gstin'), msg = el.querySelector('#g-msg');
    const chk = () => { const v = C.validateGSTIN(g.value); msg.className = v.valid ? 'field-hint' : 'field-err'; msg.textContent = !g.value ? '' : v.valid ? `✓ ${v.state} · ${v.holder}` : v.errors[0]; if (v.valid) el.querySelector('#f-pan').value = v.pan; };
    g.addEventListener('input', () => { g.value = g.value.toUpperCase(); chk(); }); chk();
    el.querySelector('#f-save').addEventListener('click', () => {
      const v = C.validateGSTIN(g.value), name = el.querySelector('#f-name').value.trim();
      if (!name || !v.valid) { UI.toast(!name ? 'Enter the legal name' : 'Fix the GSTIN: ' + v.errors[0]); return; }
      Object.assign(c, { name, gstin: v.gstin, pan: v.pan, state: v.state_code, city: el.querySelector('#f-city').value, constitution: el.querySelector('#f-const').value, nature: el.querySelector('#f-nature').value,
        business: el.querySelector('#f-bus').value, turnover_cr: +el.querySelector('#f-to').value || 0, filing: el.querySelector('#f-fil').value, partner: el.querySelector('#f-par').value, email: el.querySelector('#f-mail').value, has_exempt: el.querySelector('#f-ex').checked });
      if (isNew) app.DB.clients.push(c);
      app.changed(isNew ? 'Client added' : 'Client updated', c.name); UI.closeTop(); UI.toast(isNew ? 'Client added' : 'Client saved'); app.render({ keepScroll: true });
    });
  }
  V.clients = {
    title: 'Clients',
    render(app) {
      return `<div class="page-head"><div><div class="eyebrow">Client master</div><h1>Clients</h1><p>Every GST registration the office handles. Selecting a client switches the whole workspace to that GSTIN.</p></div>
        <div class="actions"><button class="btn primary" id="add-client">${UI.icon('plus')}Add client</button></div></div><div id="tbl"></div>`;
    },
    mount(host, app) {
      host.querySelector('#add-client').addEventListener('click', () => clientForm(app));
      UI.table(host.querySelector('#tbl'), { rows: () => app.DB.clients, placeholder: 'Search name, GSTIN, city…',
        columns: [{ key: 'id', label: 'ID', cls: 'mono' }, { key: 'name', label: 'Client', render: c => `<b>${esc(c.name)}</b><div class="small muted">${esc(c.business)}</div>` },
          { key: 'gstin', label: 'GSTIN', render: c => UI.gstinHTML(c.gstin) }, { key: 'state', label: 'State', render: c => esc(root.GST_KB.states[c.state] || c.state) },
          { key: 'constitution', label: 'Constitution' }, { key: 'turnover_cr', label: 'Turnover', num: true, render: c => `₹${(+c.turnover_cr).toFixed(1)} Cr` },
          { key: 'partner', label: 'Partner' }, { key: 'act', label: '', sort: false, render: c => `<button class="btn sm" data-edit="${esc(c.id)}">${UI.icon('edit')}Edit</button> <button class="btn sm" data-open="${esc(c.id)}">Open</button>` }],
        onRow: c => { app.ui.client = c.id; app.cache = {}; app.navigate('dashboard'); } });
      host.addEventListener('click', (e) => {
        const ed = e.target.closest('[data-edit]'); if (ed) clientForm(app, app.DB.clients.find(c => c.id === ed.dataset.edit));
        const op = e.target.closest('[data-open]'); if (op) { app.ui.client = op.dataset.open; app.cache = {}; app.navigate('dashboard'); }
      });
    }
  };

  // ------------------------------------------------------------------ Vendors
  function followUpText(app, v, items) {
    const c = app.client();
    return `Subject: GSTR-1 reporting of invoices issued to ${c.name} (GSTIN ${c.gstin})

Dear ${v.name} team,

While reconciling our GSTR-2B for the periods up to ${C.periodLabel(app.period())}, we found that the following invoice(s) issued by you are not reflected in GSTR-2B:

${items.map((p, i) => `${i + 1}. Invoice ${p.invoice_no} dated ${C.fmtDate(p.invoice_date)} - taxable ${C.inr(p.taxable_value)}, GST ${C.inr(C.taxOf(p))}`).join('\n')}

Under Section 16(2)(aa) read with Rule 36(4) of the CGST Rules, we can claim input tax credit only for invoices reported in your GSTR-1/IFF. Kindly upload these through GSTR-1A or your next GSTR-1 and confirm filing of GSTR-3B for the period.

Please note that payments for these invoices are on hold until they appear in our GSTR-2B.

Regards,
Accounts Team, ${c.name}
(Prepared by ${app.DB.firm.name}, ${app.DB.firm.type})`;
  }
  V._followUpText = followUpText;
  function vendorDrawer(app, vid) {
    const a = app.analysis(), v = a.vmap[vid], r = app.vendorRisk().find(x => x.vendor_id === vid);
    const bills = a.P.filter(p => p.vendor_id === vid);
    const miss = bills.filter(p => (a.reconByPr[p.id] || {}).status === 'MISSING_IN_2B');
    const el = UI.drawer({ title: v.name, sub: `${v.type} · ${esc(v.kind || '')} · ${v.status}`, body: `
      <div class="stack">
        <dl class="kv"><dt>GSTIN</dt><dd>${UI.gstinHTML(v.gstin)}</dd><dt>State</dt><dd>${esc(root.GST_KB.states[v.state] || v.state)}</dd>
          <dt>Registered</dt><dd>${C.fmtDate(v.reg_date) || '—'}${v.cancel_date ? ` · <b style="color:var(--bad)">cancelled ${C.fmtDate(v.cancel_date)}</b>` : ''}</dd>
          <dt>GSTR-1 on time</dt><dd>${Math.round(v.gstr1_rate * 100)}%</dd><dt>GSTR-3B on time</dt><dd>${Math.round(v.gstr3b_rate * 100)}%</dd><dt>Email</dt><dd>${esc(v.email)}</dd><dt>Phone</dt><dd>${esc(v.phone)}</dd></dl>
        ${r ? `<section><div class="row" style="justify-content:space-between"><h3>AI risk score</h3><span><span class="grade ${r.grade}">${r.grade}</span> <b>${r.score}</b>/100</span></div>
          <div style="margin-top:8px">${Object.entries(r.contributions).map(([k, val]) => `<div class="hbar"><span class="small">${AI.FACTOR_LABEL[k]}</span><span class="track"><i style="width:${val / 30 * 100}%;background:var(--${val > 10 ? 'bad' : val > 4 ? 'warn' : 'info'})"></i></span><span class="small num">${val.toFixed(1)}</span></div>`).join('')}</div>
          <div class="notice ${r.grade === 'D' ? 'bad' : r.grade === 'C' ? 'warn' : 'good'}" style="margin-top:8px"><b>Recommended:</b> ${esc(r.action)}</div></section>` : ''}
        <section><h3>Bills (${bills.length})</h3><div class="table-wrap" style="margin-top:6px"><table class="t compact"><thead><tr><th>Invoice</th><th>Date</th><th class="right">GST</th><th>2B</th></tr></thead><tbody>
          ${bills.map(p => `<tr><td class="mono">${esc(p.invoice_no)}</td><td>${C.fmtDate(p.invoice_date)}</td><td class="num">${C.inr(C.taxOf(p))}</td><td>${a.reconByPr[p.id] ? UI.reconChip(a.reconByPr[p.id]) : ''}</td></tr>`).join('')}</tbody></table></div></section>
        ${miss.length ? `<section><h3>Follow-up letter</h3><p class="small muted">Copy and send from your email. ${miss.length} invoice(s) missing in GSTR-2B.</p><pre class="formula" id="fu" style="white-space:pre-wrap">${esc(followUpText(app, v, miss))}</pre>
          <div class="row"><button class="btn" id="cp">${UI.icon('copy')}Copy letter</button><span class="small muted">To: <span class="mono">${esc(v.email)}</span></span></div></section>` : ''}
      </div>` });
    const cp = el.querySelector('#cp'); if (cp) cp.addEventListener('click', () => UI.copyText(el.querySelector('#fu').textContent, el.querySelector('#fu')));
  }
  V._vendorDrawer = vendorDrawer;
  function vendorForm(app) {
    const el = UI.modal({ title: 'Add vendor', body: `<div class="form-grid"><label class="field" style="grid-column:1/-1">Vendor name<input id="v-name" type="text"></label>
      <label class="field">GSTIN (blank if unregistered)<input id="v-g" type="text" maxlength="15" class="mono"><span class="field-hint" id="v-msg"></span></label>
      <label class="field">Type<select id="v-type">${root.GST_KB.vendor_types.map(t => `<option>${t}</option>`).join('')}</select></label>
      <label class="field">Email<input id="v-mail" type="email"></label><label class="field">Phone<input id="v-ph" type="text"></label></div>`,
      foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="v-save">Add vendor</button>' });
    const g = el.querySelector('#v-g'); g.addEventListener('input', () => { g.value = g.value.toUpperCase(); const v = C.validateGSTIN(g.value); const m = el.querySelector('#v-msg'); m.className = v.valid ? 'field-hint' : 'field-err'; m.textContent = g.value ? (v.valid ? '✓ ' + v.state : v.errors[0]) : ''; });
    el.querySelector('#v-save').addEventListener('click', () => {
      const name = el.querySelector('#v-name').value.trim(), gst = g.value.trim(), type = el.querySelector('#v-type').value;
      if (!name) return UI.toast('Enter vendor name');
      if (gst && !C.validateGSTIN(gst).valid) return UI.toast('GSTIN is not valid');
      const n = app.DB.vendors.length + 1;
      app.DB.vendors.push({ id: 'V' + String(n).padStart(3, '0') + 'N', client_id: app.clientId(), name, gstin: gst, state: gst ? gst.slice(0, 2) : app.client().state, type, kind: 'other', status: 'Active', reg_date: '', cancel_date: '', gstr1_rate: 1, gstr3b_rate: 1, avg_delay: 0, einvoice: false, email: el.querySelector('#v-mail').value, phone: el.querySelector('#v-ph').value, country: 'India' });
      app.changed('Vendor added', name); UI.closeTop(); UI.toast('Vendor added'); app.render({ keepScroll: true });
    });
  }
  V.vendors = {
    title: 'Vendors',
    render(app) {
      const vr = app.vendorRisk(), cnt = (g) => vr.filter(v => v.grade === g).length;
      return `<div class="page-head"><div><div class="eyebrow">Vendor master · AI risk scoring</div><h1>Vendors of ${esc(app.client().name)}</h1><p>Each registered supplier is scored 0–100 on filing discipline, GSTR-2B gaps, mismatches and registration status. The score decides whether to release payments and claim ITC.</p></div>
        <div class="actions"><button class="btn" id="add-v">${UI.icon('plus')}Add vendor</button></div></div>
        <div class="row" style="margin-bottom:12px">${['A', 'B', 'C', 'D'].map(g => `<span class="pill"><span class="grade ${g}">${g}</span> ${cnt(g)} vendor${cnt(g) === 1 ? '' : 's'} · ${{ A: 'Low risk', B: 'Watch', C: 'Elevated', D: 'Critical' }[g]}</span>`).join('')}</div><div id="tbl"></div>`;
    },
    mount(host, app) {
      host.querySelector('#add-v').addEventListener('click', () => vendorForm(app));
      const a = app.analysis(), risk = {}; app.vendorRisk().forEach(r => risk[r.vendor_id] = r);
      const rows = a.V.map(v => Object.assign({}, v, { r: risk[v.id], bills: a.P.filter(p => p.vendor_id === v.id).length, itc: C.sum(a.P.filter(p => p.vendor_id === v.id), C.taxOf) }));
      UI.table(host.querySelector('#tbl'), { rows: () => rows, sort: 'score', dir: -1, placeholder: 'Search vendor or GSTIN…',
        filters: [{ label: 'Type', options: root.GST_KB.vendor_types.map(t => [t, t]), get: r => r.type }, { label: 'Grade', options: ['A', 'B', 'C', 'D'].map(g => [g, 'Grade ' + g]), get: r => r.r ? r.r.grade : '' }],
        columns: [{ key: 'name', label: 'Vendor', render: r => `<b>${esc(r.name)}</b>${r.status !== 'Active' ? ' ' + UI.chip(r.status, 'bad') : ''}<div class="small muted">${esc(r.country !== 'India' ? r.country : root.GST_KB.states[r.state] || '')}</div>` },
          { key: 'gstin', label: 'GSTIN', render: r => UI.gstinHTML(r.gstin) }, { key: 'type', label: 'Type', render: r => UI.chip(r.type, r.type === 'Regular' ? 'info' : r.type === 'Foreign' ? 'vi' : 'sa') },
          { key: 'gstr1_rate', label: 'GSTR-1 on time', num: true, render: r => r.gstin ? Math.round(r.gstr1_rate * 100) + '%' : '—' },
          { key: 'bills', label: 'Bills', num: true }, { key: 'itc', label: 'GST', num: true, render: r => C.inr(r.itc, 0), total: true },
          { key: 'score', label: 'AI risk', num: true, value: r => r.r ? r.r.score : -1, render: r => r.r ? `<span class="grade ${r.r.grade}">${r.r.grade}</span> ${r.r.score}` : '<span class="muted small">n/a</span>' }],
        onRow: r => vendorDrawer(app, r.id) });
    }
  };
})(window);
