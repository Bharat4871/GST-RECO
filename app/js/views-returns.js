/* Views: GSTR-3B builder, Set-off & cash, Interest calculator */
(function (root) {
  'use strict';
  const C = root.GSTCore, E = root.GSTEngine, UI = root.UI, IO = root.GSTIO, App = root.GSTApp, esc = C.esc;
  const V = App.views, KB = () => root.GST_KB;
  const H = ['igst', 'cgst', 'sgst', 'cess'];
  const NAMES = Object.assign({}, { '3.1(a)': 'Outward taxable supplies (other than zero-rated, nil-rated and exempted)', '3.1(b)': 'Outward taxable supplies (zero-rated)', '3.1(c)': 'Other outward supplies (nil-rated, exempted)', '3.1(e)': 'Non-GST outward supplies' });

  // ================================================================ GSTR-3B
  V.gstr3b = {
    title: 'GSTR-3B builder', usesPeriod: true,
    render(app) {
      const g = app.gstr3b(), t = g.tables, per = g.period, names = Object.assign({}, KB().gstr3b_tables, NAMES);
      const hasSales = app.DB.sales.some(s => s.client_id === app.clientId() && s.period === per);
      const row = (code, cls = '', value = true) => { const r = t[code]; return `<tr class="${cls}"><td class="code">${code}</td><td>${esc(names[code])}</td>${value ? `<td class="num">${r.value != null ? C.inr(r.value) : ''}</td>` : ''}${H.map(h => `<td class="num cell" data-cell="${code}">${C.inr(r[h])}</td>`).join('')}</tr>`; };
      const drc = g.drc01c, pct = Math.max(0, Math.min(100, drc.available ? (drc.claimed / drc.available) * 50 : 0));
      return `<div class="page-head"><div><div class="eyebrow">Form GSTR-3B · ${esc(app.client().gstin)} · return period ${C.periodLabel(per)} · due ${C.fmtDate(g.due_date)}</div><h1>GSTR-3B working</h1><p>Table 4 follows Circular 170/02/2022-GST: ITC as per GSTR-2B in 4A, permanent reversals (Sec 17(5), Rules 38/42/43) in 4B(1), temporary reversals (Rules 37/37A, not received, not booked) in 4B(2). Click any amount to see the bills behind it.</p></div>
        <div class="actions"><button class="btn" id="exp-x">${UI.icon('down')}Excel working</button><button class="btn" id="exp-j">${UI.icon('down')}JSON</button><button class="btn primary" data-go="setoff">${UI.icon('scale')}Set-off &amp; cash</button></div></div>
        ${!hasSales ? `<div class="notice warn" style="margin-bottom:12px">No outward-supply summary for ${C.periodLabel(per)} yet - Table 3.1(a) is blank. Only reversals and RCM known so far are shown (the October return is where Rule 37A and FY 2025-26 claims land).</div>` : ''}
        <div class="grid g-21">
          <div class="stack">
            <section class="panel"><div class="panel-head"><h2>3.1 Outward and reverse-charge inward supplies</h2></div><div class="table-wrap"><table class="t r3b"><thead><tr><th>Table</th><th>Nature of supplies</th><th class="right">Taxable value</th><th class="right">IGST</th><th class="right">CGST</th><th class="right">SGST/UTGST</th><th class="right">Cess</th></tr></thead>
              <tbody>${row('3.1(a)')}${row('3.1(b)')}${row('3.1(c)')}${row('3.1(d)')}${row('3.1(e)')}</tbody></table></div></section>
            <section class="panel"><div class="panel-head"><h2>4 Eligible ITC</h2></div><div class="table-wrap"><table class="t r3b"><thead><tr><th>Table</th><th>Details</th><th class="right">IGST</th><th class="right">CGST</th><th class="right">SGST/UTGST</th><th class="right">Cess</th></tr></thead>
              <tbody><tr class="grp"><td colspan="6">(A) ITC available (whether in full or part)</td></tr>${['4A(1)', '4A(2)', '4A(3)', '4A(4)', '4A(5)'].map(c => row(c, '', false)).join('')}
              <tr class="grp"><td colspan="6">(B) ITC reversed</td></tr>${row('4B(1)', '', false)}${row('4B(2)', '', false)}
              ${row('4C', 'sum', false)}<tr class="grp"><td colspan="6">(D) Other details</td></tr>${row('4D(1)', '', false)}${row('4D(2)', '', false)}</tbody></table></div></section>
          </div>
          <div class="stack">
            <section class="panel"><h2>Books vs this working</h2><dl class="kv" style="margin-top:10px"><dt>Net ITC (4C)</dt><dd><b>${C.inr(g.net_itc)}</b></dd><dt>ITC claimed in books</dt><dd>${C.inr(g.itc_claimed_total)}</dd>
              <dt>Difference</dt><dd><b style="color:var(--${Math.abs(g.difference) < 1 ? 'good' : g.difference > 0 ? 'bad' : 'warn'})">${C.inr(g.difference)}</b></dd><dt>Rule 42/43 reversal</dt><dd>${C.inr(g.rule42_43_reversal)} <span class="small muted">(in 4B(1))</span></dd></dl>
              <p class="small muted">${g.difference > 1 ? 'Client claimed more than the law allows this month - reverse the excess with interest or reduce the claim before filing.' : g.difference < -1 ? 'Client claimed less than available - additional ITC can be taken (within the Sec 16(4) time limit).' : 'Books agree with the working.'}</p></section>
            <section class="panel"><div class="panel-head"><h2>DRC-01C check</h2>${UI.ref('Rule 88D')}</div>
              <div class="gauge" style="margin:8px 0 6px"><i style="width:${pct}%;background:var(--${drc.risk ? 'bad' : drc.excess > 0 ? 'warn' : 'good'})"></i><span class="mark" style="left:50%"></span><span class="mark" style="left:60%;background:var(--bad)"></span></div>
              <div class="small muted">Marker 1 = ITC in 2B · marker 2 = +20%</div>
              <dl class="kv" style="margin-top:8px"><dt>ITC claimed</dt><dd>${C.inr(drc.claimed)}</dd><dt>ITC in GSTR-2B</dt><dd>${C.inr(drc.available)}</dd><dt>Excess</dt><dd><b>${C.inr(drc.excess)}</b> (${drc.excess_pct.toFixed(1)}%)</dd></dl>
              <div class="notice ${drc.risk ? 'bad' : 'good'}" style="margin-top:8px">${drc.risk ? 'Intimation in DRC-01C is likely: excess exceeds ₹25 lakh and 20%. Pay the excess through DRC-03 or explain in Part B within 7 days, else GSTR-1 for the next period is blocked.' : 'Below the Rule 88D thresholds (₹25 lakh and 20%).'}</div></section>
            <section class="panel"><h2>Filing checklist</h2><ul class="checklist" style="margin-top:8px">
              <li><span class="ok">1</span>${UI.ref('IMS')}<span>Finalise Accept / Reject / Pending before 2B is regenerated</span></li>
              <li><span class="ok">2</span>${UI.ref('Rule 36(4)')}<span>4A(5) only from GSTR-2B; bills not in 2B wait</span></li>
              <li><span class="ok">3</span>${UI.ref('Sec 49(4)')}<span>RCM in 3.1(d) paid in cash; ITC in 4A(2)/(3)</span></li>
              <li><span class="ok">4</span>${UI.ref('Sec 16(4)')}<span>October return is the last one for FY 2025-26 ITC</span></li>
              <li><span class="ok">5</span>${UI.ref('Rule 37A')}<span>Reverse unpaid-supplier ITC in October return</span></li></ul></section>
          </div></div>`;
    },
    mount(host, app) {
      const g = app.gstr3b(), a = app.analysis();
      host.querySelector('[data-go]').addEventListener('click', () => app.navigate('setoff'));
      host.querySelectorAll('[data-cell]').forEach(td => td.addEventListener('click', () => {
        const code = td.dataset.cell, ids = (g.detail[code] || []);
        if (!ids.length) { UI.toast(code === '4C' ? '4C = 4A − 4B' : code === '3.1(a)' || code.startsWith('3.1') ? 'From the outward supply summary' : code === '4B(1)' && g.rule42_43_reversal ? 'Rule 42/43 reversal - see the Rule 42 & 43 page' : 'No documents in this cell'); return; }
        const docs = ids.map(id => a.P.find(p => p.id === id) || a.B.find(b => b.id === id)).filter(Boolean);
        const el = UI.modal({ title: `Table ${code} · ${C.periodLabel(g.period)}`, sub: `${docs.length} document(s)`, wide: true, body: `<div class="table-wrap"><table class="t compact"><thead><tr><th>Source</th><th>Supplier</th><th>Invoice</th><th class="right">IGST</th><th class="right">CGST</th><th class="right">SGST</th><th>Reason</th></tr></thead><tbody>
          ${docs.map(d => { const isP = !!d.vendor_id || d.id.startsWith('PI'); const pr = isP ? d.id : (a.reconByB[d.id] || {}).pr_id; const e = pr ? a.evalMap[pr] : null;
            return `<tr ${pr ? `data-inv="${esc(pr)}" class="clickable"` : ''}><td>${isP ? 'Books' : 'GSTR-2B'}</td><td>${esc(d.supplier_name)}</td><td class="mono">${esc(d.invoice_no)}</td><td class="num">${C.inr(d.igst)}</td><td class="num">${C.inr(d.cgst)}</td><td class="num">${C.inr(d.sgst)}</td><td>${e ? UI.statusChip(e) : (a.reconByB[d.id] ? UI.reconChip(a.reconByB[d.id]) : '')}</td></tr>`; }).join('')}</tbody></table></div>` });
        el.querySelectorAll('[data-inv]').forEach(tr => tr.addEventListener('click', () => { UI.closeTop(); App.showInvoice(tr.dataset.inv); }));
      }));
      const flat = () => Object.entries(g.tables).map(([k, v]) => Object.assign({ table: k, description: (KB().gstr3b_tables[k] || NAMES[k] || '') }, v));
      host.querySelector('#exp-x').addEventListener('click', () => IO.saveFile(`GSTR3B_${app.clientId()}_${g.period}.xlsx`, IO.workbookBlob([{ name: 'GSTR-3B', rows: flat() },
        { name: 'Rule 42', rows: [Object.fromEntries(Object.entries(g.rule42).filter(([k]) => k !== 'items'))] }, { name: 'Rule 43', rows: g.rule43.items.length ? g.rule43.items : [{ note: 'No common capital goods' }] },
        { name: 'DRC-01C check', rows: [g.drc01c] }])));
      host.querySelector('#exp-j').addEventListener('click', () => IO.saveFile(`GSTR3B_${app.clientId()}_${g.period}.json`, JSON.stringify({ gstin: app.client().gstin, ret_period: g.period.slice(5) + g.period.slice(0, 4), tables: g.tables, prepared_by: 'GSTiQ', note: 'Working file - not the GSTN offline-tool schema' }, null, 2), 'application/json'));
    }
  };

  // ================================================================ Set-off
  V.setoff = {
    title: 'Set-off & cash', usesPeriod: true,
    render(app) {
      const g = app.gstr3b(), t = g.tables, s = app._so && app._so.key === app.clientId() + g.period ? app._so : (app._so = { key: app.clientId() + g.period,
        L: { igst: t['3.1(a)'].igst, cgst: t['3.1(a)'].cgst, sgst: t['3.1(a)'].sgst }, Cr: { igst: t['4C'].igst, cgst: t['4C'].cgst, sgst: t['4C'].sgst },
        O: { igst: 0, cgst: 0, sgst: 0 }, R: { igst: t['3.1(d)'].igst, cgst: t['3.1(d)'].cgst, sgst: t['3.1(d)'].sgst }, tv: t['3.1(a)'].value });
      const cr = {}; ['igst', 'cgst', 'sgst'].forEach(h => cr[h] = C.money(s.Cr[h] + s.O[h]));
      const negs = ['igst', 'cgst', 'sgst'].filter(h => cr[h] < 0);
      const so = E.setoff(s.L, cr, s.R, s.tv), u = so.utilisation;
      const inp = (grp, h) => `<input type="number" step="0.01" data-g="${grp}" data-h="${h}" value="${s[grp][h]}" aria-label="${grp} ${h}">`;
      const cell = (v, cls = '') => `<div class="${cls}">${v ? C.inr(v, 0) : '—'}</div>`;
      return `<div class="page-head"><div><div class="eyebrow">Sec 49, 49A, 49B · Rule 88A · Rule 86B · ${C.periodLabel(g.period)}</div><h1>Set-off of ITC and cash payable</h1><p>IGST credit is used first against IGST and then, in the order that minimises cash, against CGST and SGST. CGST credit never pays SGST and vice versa. Reverse-charge tax is always paid in cash. Values are pre-filled from the GSTR-3B working and can be edited.</p></div></div>
        <div class="grid g-12">
          <section class="panel"><h2>Inputs</h2><div class="table-wrap" style="margin-top:10px"><table class="t compact so-in"><thead><tr><th></th><th>IGST</th><th>CGST</th><th>SGST</th></tr></thead><tbody>
            <tr><td>Output 3.1(a)</td>${['igst', 'cgst', 'sgst'].map(h => `<td>${inp('L', h)}</td>`).join('')}</tr><tr><td>ITC 4C</td>${['igst', 'cgst', 'sgst'].map(h => `<td>${inp('Cr', h)}</td>`).join('')}</tr>
            <tr><td>Opening credit</td>${['igst', 'cgst', 'sgst'].map(h => `<td>${inp('O', h)}</td>`).join('')}</tr><tr><td>RCM 3.1(d)</td>${['igst', 'cgst', 'sgst'].map(h => `<td>${inp('R', h)}</td>`).join('')}</tr></tbody></table></div>
            ${negs.length ? `<div class="notice warn small" style="margin-top:10px">Reversals exceed credit in ${negs.map(h => h.toUpperCase()).join(', ')} - the negative balance is added to output tax and paid like tax.</div>` : ''}<p class="small muted" style="margin:8px 0 0">RCM is always paid in cash (Sec 49(4)).</p>
            <label class="field" style="margin-top:10px">Taxable value of outward supplies this month (Rule 86B test)<input type="number" id="tv" value="${s.tv}"></label>
            <div class="row" style="margin-top:10px"><button class="btn" id="reset">${UI.icon('refresh')}Reset from GSTR-3B</button><button class="btn" id="ex">Load textbook example</button></div></section>
          <div class="stack">
            <section class="panel"><div class="panel-head"><h2>Utilisation matrix</h2><span class="sub">rows = liability · columns = credit used</span></div>
              <div style="overflow-x:auto"><div class="setoff-grid"><div class="h"></div><div class="h">Liability</div><div class="h">IGST credit</div><div class="h">CGST credit</div><div class="h">SGST credit</div><div class="h">Cash</div>
              ${['igst', 'cgst', 'sgst'].map(h => `<div class="rh">${h.toUpperCase()}</div>${cell(C.money(s.L[h] + Math.max(0, -cr[h])))}${cell(u['igst->' + h])}${cell(u['cgst->' + h])}${cell(u['sgst->' + h])}${cell(so.cash_output[h], 'cash')}`).join('')}
              <div class="rh">RCM</div>${cell(C.sum(Object.values(s.R)))}<div>—</div><div>—</div><div>—</div>${cell(C.sum(Object.values(so.cash_rcm)), 'cash')}</div></div>
              <div class="kpis" style="margin-top:12px;grid-template-columns:repeat(3,minmax(0,1fr))"><div class="kpi sa"><div class="eyebrow">Total cash (PMT-06)</div><div class="v">${C.inr(so.cash_total, 0)}</div><div class="s">output ${C.inr(C.sum(Object.values(so.cash_output)), 0)} + RCM ${C.inr(C.sum(Object.values(so.cash_rcm)), 0)}</div></div>
                <div class="kpi good"><div class="eyebrow">ITC utilised</div><div class="v">${C.inr(C.sum(Object.values(u)), 0)}</div><div class="s">${so.steps.filter(x => x.from !== 'REVERSAL').length} set-off steps</div></div>
                <div class="kpi"><div class="eyebrow">Credit carried forward</div><div class="v">${C.inr(C.sum(Object.values(so.credit_carried_forward)), 0)}</div><div class="s">I ${C.inrShort(so.credit_carried_forward.igst)} · C ${C.inrShort(so.credit_carried_forward.cgst)} · S ${C.inrShort(so.credit_carried_forward.sgst)}</div></div></div>
              ${so.rule86b ? `<div class="notice ${so.rule86b.shortfall ? 'bad' : 'good'}" style="margin-top:10px">${UI.ref('Rule 86B')} ${esc(so.rule86b.note)} Minimum cash ${C.inr(so.rule86b.min_cash)}; cash paid against output tax ${C.inr(so.rule86b.cash_paid)}${so.rule86b.shortfall ? ` - <b>pay ${C.inr(so.rule86b.shortfall)} more in cash</b>` : ' - satisfied'}.</div>` : ''}</section>
            <section class="panel"><h2>Step-by-step</h2><ol class="small" style="margin:8px 0 0;padding-left:18px">${so.steps.map(x => `<li style="margin-bottom:4px">${x.from === 'REVERSAL' ? `Negative net ${x.to} ITC <b>${C.inr(x.amount)}</b> added to ${x.to} liability` : `${x.from} credit → ${x.to} liability: <b>${C.inr(x.amount)}</b>`} <span class="muted">(${esc(x.rule)})</span></li>`).join('') || '<li>No credit to utilise.</li>'}
              ${['igst', 'cgst', 'sgst'].filter(h => so.cash_output[h] > 0).map(h => `<li>${h.toUpperCase()} balance <b>${C.inr(so.cash_output[h])}</b> paid in cash</li>`).join('')}${C.sum(Object.values(so.cash_rcm)) > 0 ? `<li>RCM ${C.inr(C.sum(Object.values(so.cash_rcm)))} paid in cash (Sec 49(4)); its ITC is already inside 4C</li>` : ''}</ol></section>
          </div></div>`;
    },
    mount(host, app) {
      host.querySelectorAll('input[data-g]').forEach(i => i.addEventListener('change', () => { app._so[i.dataset.g][i.dataset.h] = +i.value || 0; app.render({ keepScroll: true }); }));
      host.querySelector('#tv').addEventListener('change', (e) => { app._so.tv = +e.target.value || 0; app.render({ keepScroll: true }); });
      host.querySelector('#reset').addEventListener('click', () => { app._so = null; app.render({ keepScroll: true }); });
      host.querySelector('#ex').addEventListener('click', () => { // classic ICAI-style illustration
        Object.assign(app._so, { L: { igst: 1500, cgst: 600, sgst: 600 }, Cr: { igst: 1000, cgst: 300, sgst: 500 }, O: { igst: 0, cgst: 0, sgst: 0 }, R: { igst: 0, cgst: 0, sgst: 0 }, tv: 0 });
        UI.toast('Example: liability I 1,500 / C 600 / S 600; credit I 1,000 / C 300 / S 500'); app.render({ keepScroll: true });
      });
    }
  };

  // ================================================================ Interest
  V.interest = {
    title: 'Interest calculator',
    render(app) {
      const s = app._int || (app._int = { amt: 100000, due: '2026-08-20', paid: '2026-10-05', itc: 250000, availed: '2026-06-20', reversed: '2026-10-20', rate1: 18, rate3: 18 });
      const [i1, d1] = E.interest(s.amt, C.d(s.due), C.d(s.paid), s.rate1), [i3, d3] = E.interest(s.itc, C.d(s.availed), C.d(s.reversed), s.rate3);
      const a = app.analysis();
      return `<div class="page-head"><div><div class="eyebrow">Section 50 · Rule 88B</div><h1>Interest calculator</h1><p>Simple interest on actual days ÷ 365. Sec 50(1) applies to tax paid late (on the cash portion); Sec 50(3) applies to ITC wrongly availed <i>and utilised</i>, from the date of utilisation to the date of reversal.</p></div></div>
        <div class="grid g2">
          <section class="panel"><div class="panel-head"><h2>Delayed payment of tax</h2>${UI.ref('Sec 50(1)')}</div><div class="form-grid">
            <label class="field">Tax paid late (cash) ₹<input type="number" id="amt" value="${s.amt}"></label><label class="field">Due date<input type="date" id="due" value="${s.due}"></label>
            <label class="field">Paid on<input type="date" id="paid" value="${s.paid}"></label><label class="field">Rate % p.a.<input type="number" id="rate1" value="${s.rate1}"></label></div>
            <div class="formula" style="margin-top:12px">${C.inr(s.amt)} × ${s.rate1}% × ${d1} ÷ 365 = <b>${C.inr(i1)}</b></div></section>
          <section class="panel"><div class="panel-head"><h2>ITC wrongly availed and utilised</h2>${UI.ref('Sec 50(3) · Rule 88B(3)')}</div><div class="form-grid">
            <label class="field">ITC wrongly availed &amp; utilised ₹<input type="number" id="itc" value="${s.itc}"></label><label class="field">Utilised on (return filing date)<input type="date" id="availed" value="${s.availed}"></label>
            <label class="field">Reversed / paid on<input type="date" id="reversed" value="${s.reversed}"></label><label class="field">Rate % p.a.<input type="number" id="rate3" value="${s.rate3}"></label></div>
            <div class="formula" style="margin-top:12px">${C.inr(s.itc)} × ${s.rate3}% × ${d3} ÷ 365 = <b>${C.inr(i3)}</b></div>
            <p class="small muted">Under Rule 88B(3), ITC is "utilised" when the electronic credit ledger balance falls below the wrongly availed amount; interest runs only on the utilised portion.</p></section>
        </div>
        <section class="panel" style="margin-top:14px"><div class="panel-head"><h2>Late RCM payments of ${esc(a.client.name)}</h2><span class="sub">Interest from GSTR-3B due date to payment (or today if unpaid)</span></div><div id="rcm"></div></section>
        <section class="panel" style="margin-top:14px"><div class="panel-head"><h2>Rule 37 interest exposure</h2><span class="sub">Bills unpaid or paid beyond 180 days - interest from the return in which reversal was due</span></div><div id="r37"></div></section>`;
    },
    mount(host, app) {
      ['amt', 'due', 'paid', 'rate1', 'itc', 'availed', 'reversed', 'rate3'].forEach(k => host.querySelector('#' + k).addEventListener('change', (e) => { app._int[k] = e.target.type === 'number' ? +e.target.value : e.target.value; app.render({ keepScroll: true }); }));
      const a = app.analysis();
      UI.table(host.querySelector('#rcm'), { rows: () => a.rcm.filter(r => r.interest > 0), search: false, compact: true, columns: [{ key: 'supplier_name', label: 'Supplier' }, { key: 'rcm_title', label: 'Category', cls: 'wrap' },
        { key: 'tax', label: 'RCM tax', num: true, render: r => C.inr(r.tax), total: true }, { key: 'due_date', label: 'Due', render: r => C.fmtDate(r.due_date) }, { key: 'paid_date', label: 'Paid', render: r => r.paid_date ? C.fmtDate(r.paid_date) : UI.chip('Unpaid', 'bad') },
        { key: 'delay_days', label: 'Days', num: true }, { key: 'interest', label: 'Interest', num: true, render: r => C.inr(r.interest), total: true }], empty: 'No delayed RCM payments.', onRow: r => App.showInvoice(r.id) });
      const r37 = a.evals.filter(e => e.flags.some(f => f.code === 'RULE_37' || f.code === 'RULE_37_LATE')).map(e => { const p = a.P.find(x => x.id === e.id); const from = C.dueDate3B(C.periodOf(C.addDays(C.d(p.invoice_date), 181))); const to = p.payment_date ? C.d(p.payment_date) : app.asOn(); const [ii, dd] = E.interest(e.tax, from, to > from ? to : from); return { id: p.id, sup: p.supplier_name, inv: p.invoice_no, tax: e.tax, from: C.iso(from), to: C.iso(to), dd, ii, paid: !!p.payment_date }; });
      UI.table(host.querySelector('#r37'), { rows: () => r37, search: false, compact: true, columns: [{ key: 'sup', label: 'Supplier' }, { key: 'inv', label: 'Invoice', cls: 'mono' }, { key: 'tax', label: 'ITC', num: true, render: x => C.inr(x.tax), total: true },
        { key: 'from', label: 'From', render: x => C.fmtDate(x.from) }, { key: 'to', label: 'To', render: x => `${C.fmtDate(x.to)} ${x.paid ? '' : UI.chip('still unpaid', 'warn')}` }, { key: 'dd', label: 'Days', num: true }, { key: 'ii', label: 'Interest @18%', num: true, render: x => C.inr(x.ii), total: true }],
        empty: 'No Rule 37 exposure.', onRow: x => App.showInvoice(x.id) });
    }
  };
})(window);
