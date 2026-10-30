/* Views: AI lab (classifier, anomalies, Benford, vendor risk, forecast) and GST Mitra assistant */
(function (root) {
  'use strict';
  const C = root.GSTCore, E = root.GSTEngine, AI = root.GSTAI, UI = root.UI, App = root.GSTApp, esc = C.esc;
  const V = App.views, KB = () => root.GST_KB;

  V['ai-lab'] = {
    title: 'AI lab',
    render(app) {
      const tab = app._aiTab || 'classify';
      const T = [['classify', 'Expense classifier'], ['anomaly', 'Anomaly detection'], ['benford', "Benford's law"], ['risk', 'Vendor risk'], ['forecast', 'ITC forecast']];
      return `<div class="page-head"><div><div class="eyebrow">Machine learning on ${esc(app.client().name)}'s data · runs in the browser${app.backend.ok ? ' and in Python (scikit-learn)' : ''}</div><h1>AI lab</h1><p>Five models support the rule engine: they read free-text descriptions, spot unusual bills, test the population of amounts, rank suppliers by compliance risk and project next months' credit. The tax department uses the same family of techniques in GSTN's BIFA and CBIC's ADVAIT.</p></div>
        <div class="actions">${app.backend.ok ? UI.chip('Python engine linked · scikit-learn ' + esc(app.backend.info.sklearn), 'good') : `<span class="small muted">Start <span class="mono">python backend/app.py</span> to compare with scikit-learn</span>`}</div></div>
        <div class="tabs" role="tablist" id="atabs">${T.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div><div id="pane"></div>`;
    },
    mount(host, app) {
      host.querySelector('#atabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { app._aiTab = b.dataset.tab; app.render({ keepScroll: true }); } });
      const pane = host.querySelector('#pane'), tab = app._aiTab || 'classify', a = app.analysis(), pal = UI.palette();
      if (tab === 'classify') {
        pane.innerHTML = `<div class="grid g-12"><section class="panel stack"><div><h2>Try a description</h2><p class="small muted" style="margin:4px 0 0">Multinomial Naive Bayes on word unigrams + bigrams, trained on ${KB().corpus.length} labelled ledger narrations across ${Object.keys(KB().labels).length} classes (eligible, 9 blocked heads, 8 RCM heads).</p></div>
          <label class="field">Expense description<input type="text" id="txt" value="Lorry freight paid for inward cotton bales"></label><label class="field">HSN / SAC (optional)<input type="text" id="hsn" class="mono"></label>
          <button class="btn primary" id="go">${UI.icon('ai')}Classify</button><div id="res"></div>
          <div class="small"><b>Try:</b> ${['Gymkhana annual subscription for director', 'Google Ads campaign invoice USD', 'Cement for new office building', 'Diwali dry fruit boxes for dealers', 'Sitting fees to independent director', 'Printer cartridges'].map(t => `<button class="btn sm ghost" data-try="${esc(t)}">${esc(t)}</button>`).join(' ')}</div></section>
          <section class="panel"><div class="panel-head"><div><h2>Model card</h2><div class="sub">5-fold cross-validation on the training corpus</div></div><button class="btn sm" id="cv">Run cross-validation</button></div><div id="card" class="small muted">Click "Run cross-validation" to measure accuracy on held-out folds.</div>
            <hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><div class="panel-head"><div><h2>Batch: this client's register</h2><div class="sub">AI label vs rule-engine decision for every bill</div></div><button class="btn sm" id="batch">Run on ${a.P.length} bills</button></div><div id="bres"></div></section></div>`;
        const run = async () => {
          const txt = pane.querySelector('#txt').value, r = AI.classify(txt, pane.querySelector('#hsn').value);
          const all = [{ name: r.name, p: r.confidence, label: r.label }].concat(r.alternatives);
          pane.querySelector('#res').innerHTML = `<div class="verdict ${r.group === 'eligible' ? 'no' : 'yes'}"><div class="eyebrow">${r.group === 'rcm' ? 'Reverse charge' : r.group === 'blocked' ? 'Blocked credit' : 'Eligible'}</div><h3>${esc(r.name)}</h3><div>${UI.ref(r.ref)} · confidence ${(r.confidence * 100).toFixed(1)}%</div>
            ${r.because.length ? `<p class="small" style="margin:6px 0 0">Signal words: ${r.because.map(w => `<span class="ref">${esc(w)}</span>`).join(' ')}</p>` : '<p class="small">No known words - low confidence.</p>'}</div>
            <div style="margin-top:10px">${all.map(x => `<div class="hbar"><span class="small">${esc(x.name)}</span><span class="track"><i style="width:${(x.p * 100).toFixed(1)}%;background:var(--accent)"></i></span><span class="small num">${(x.p * 100).toFixed(1)}%</span></div>`).join('')}</div>
            <p class="small">${r.rule_label ? `Rule engine: <b>${esc(KB().labels[r.rule_label].name)}</b> (${esc(r.rule_reason)}) - ${r.agree ? 'agrees' : 'disagrees, rule wins for statutory blocks'}.` : 'Rule engine: no keyword/HSN block.'}${r.rcm_keyword ? ` RCM keyword "${esc(r.rcm_keyword[1])}" found.` : ''}</p><div id="py"></div>`;
          if (app.backend.ok) { try { const j = await app.api('/api/ai/classify', { texts: [txt] }); const p = j.predictions[0]; pane.querySelector('#py').innerHTML = `<div class="notice good small"><b>Python (${esc(j.model)}):</b> ${esc(p.name)} · ${(p.confidence * 100).toFixed(1)}% · because ${p.because.map(esc).join(', ')}</div>`; } catch (e) { /* ignore */ } }
        };
        pane.querySelector('#go').addEventListener('click', run);
        pane.querySelector('#txt').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
        pane.querySelectorAll('[data-try]').forEach(b => b.addEventListener('click', () => { pane.querySelector('#txt').value = b.dataset.try; run(); }));
        pane.querySelector('#cv').addEventListener('click', () => { const r = AI.crossValidate(5); pane.querySelector('#card').innerHTML = `<dl class="kv"><dt>Algorithm</dt><dd>Multinomial Naive Bayes, Laplace α = 0.4</dd><dt>Features</dt><dd>Lower-cased word unigrams + bigrams, stop-words removed</dd><dt>Training set</dt><dd>${r.samples} sentences · ${r.classes} classes</dd>
          <dt>Accuracy</dt><dd><b>${(r.mean_accuracy * 100).toFixed(1)}%</b> ± ${(r.std * 100).toFixed(1)} (folds: ${r.scores.map(s => (s * 100).toFixed(0) + '%').join(', ')})</dd>${app.backend.ok && app.backend.info.classifier_cv ? `<dt>Python model</dt><dd>TF-IDF + Logistic Regression: <b>${(app.backend.info.classifier_cv.mean_accuracy * 100).toFixed(1)}%</b></dd>` : ''}
          <dt>Role</dt><dd>Advisory. Statutory blocks are decided by the deterministic rule engine; disagreements are surfaced for review.</dd></dl>`; });
        pane.querySelector('#batch').addEventListener('click', () => {
          const rows = a.P.map(p => { const r = AI.model().predict(p.description); const e = a.evalMap[p.id]; const ruleBlocked = e.status === 'BLOCKED' || (e.rule_category || '').startsWith('BLK'); const aiBlocked = r.group === 'blocked'; const aiRcm = r.group === 'rcm', isRcm = p.reverse_charge === 'Y';
            return { p, r, e, agree: ruleBlocked === aiBlocked && (aiRcm === isRcm || aiBlocked) }; });
          const ag = rows.filter(x => x.agree).length;
          pane.querySelector('#bres').innerHTML = `<p><b>${(ag / rows.length * 100).toFixed(1)}%</b> agreement on blocked / RCM / eligible grouping (${rows.length - ag} to review).</p><div id="bt"></div>`;
          UI.table(pane.querySelector('#bt'), { rows: () => rows.filter(x => !x.agree), compact: true, search: false, empty: 'AI and rules agree on every bill.',
            columns: [{ key: 'd', label: 'Description', cls: 'wrap', render: x => esc(x.p.description) }, { key: 'ai', label: 'AI says', render: x => `${esc(x.r.name)} <span class="small muted">${(x.r.confidence * 100).toFixed(0)}%</span>` },
              { key: 'rule', label: 'Books / rules', render: x => `${x.p.reverse_charge === 'Y' ? UI.chip('RCM', 'sa') + ' ' : ''}${UI.statusChip(x.e)}` }], onRow: x => App.showInvoice(x.p.id) });
        });
        run();
      } else if (tab === 'anomaly') {
        const res = AI.anomalies(a.P);
        pane.innerHTML = `<div class="grid g-21"><section class="panel"><div class="panel-head"><div><h2>${res.items.length} unusual bills</h2><div class="sub">Isolation Forest (150 trees, sample 128, implemented from scratch) + forensic rules</div></div>${app.backend.ok ? '<button class="btn sm" id="py">Run scikit-learn Isolation Forest</button>' : ''}</div><div id="tbl"></div><div id="pyres"></div></section>
          <section class="panel"><h2>Anomaly score vs value</h2><div class="chart-box tall"><canvas id="sc"></canvas></div><p class="small muted">Each dot is a bill. Isolation Forest isolates points with random splits; points isolated in fewer splits score higher. Features: log value, deviation from the vendor's mean, round sum, Sunday date, days to payment, e-way threshold proximity, rate, month-end.</p></section></div>`;
        UI.table(pane.querySelector('#tbl'), { rows: () => res.items, search: false, compact: true, columns: [{ key: 'score', label: 'Score', num: true, render: x => `<b>${x.score.toFixed(2)}</b>` },
          { key: 'supplier_name', label: 'Supplier', render: x => `${esc(x.supplier_name)}<div class="small mono muted">${esc(x.invoice_no)}</div>` }, { key: 'taxable_value', label: 'Value', num: true, render: x => C.inr(x.taxable_value) },
          { key: 'reasons', label: 'Why', cls: 'wrap', render: x => `<span class="small">${x.reasons.map(esc).join('; ')}</span>` }], onRow: x => App.showInvoice(x.id) });
        UI.chart(pane.querySelector('#sc'), { type: 'scatter', money: false, legend: true, data: { datasets: [
          { label: 'Normal', data: res.scores.filter(s => s.s < res.cut).map(s => ({ x: Math.log10(s.v), y: s.s })), backgroundColor: pal[0] + '66', pointRadius: 3 },
          { label: 'Flagged', data: res.scores.filter(s => s.s >= res.cut).map(s => ({ x: Math.log10(s.v), y: s.s })), backgroundColor: pal[3], pointRadius: 5 }] },
          options: { scales: { x: { title: { display: true, text: 'log10(taxable value ₹)' }, grid: { color: UI.css('--line') } }, y: { title: { display: true, text: 'anomaly score' }, grid: { color: UI.css('--line') }, ticks: { callback: v => v } } } } });
        const py = pane.querySelector('#py'); if (py) py.addEventListener('click', async () => { py.disabled = true; try { const j = await app.api('/api/ai/anomalies', { purchases: a.P }); pane.querySelector('#pyres').innerHTML = `<div class="notice good small" style="margin-top:10px"><b>${esc(j.model)}</b> flagged ${j.anomalies.length} bills: ${j.anomalies.slice(0, 8).map(x => esc(x.invoice_no)).join(', ')}${j.anomalies.length > 8 ? '…' : ''}. Benford (Python): ${esc(j.benford.verdict)}.</div>`; } catch (e) { UI.toast(e.message); } py.disabled = false; });
      } else if (tab === 'benford') {
        const scope = app._bscope || 'client';
        const vals = (scope === 'all' ? app.DB.purchases : a.P).map(p => +p.taxable_value);
        const b = AI.benford(vals);
        pane.innerHTML = `<div class="grid g-21"><section class="panel"><div class="panel-head"><div><h2>First-digit distribution</h2><div class="sub">${b.n} invoice values · ${scope === 'all' ? 'all clients' : esc(a.client.name)}</div></div><div class="seg"><button data-sc="client" aria-pressed="${scope === 'client'}">This client</button><button data-sc="all" aria-pressed="${scope === 'all'}">All clients</button></div></div><div class="chart-box tall"><canvas id="bf"></canvas></div></section>
          <section class="panel stack"><h2>Test result</h2><div class="verdict ${b.mad < 0.012 ? 'no' : 'yes'}"><h3>${esc(b.verdict)}</h3><p class="small" style="margin:0">Mean absolute deviation ${b.mad.toFixed(4)} (Nigrini bands: &lt;0.006 close, &lt;0.012 acceptable, &lt;0.015 marginal). χ² = ${b.chi_square.toFixed(2)} vs critical 15.51 at 5% (8 d.f.).</p></div>
            <p class="small">Benford's law says naturally occurring amounts start with 1 about 30% of the time and with 9 under 5%. Fabricated or threshold-managed invoices often break this pattern. A small, single-vendor or narrow-range population can deviate innocently, so treat the result as a pointer for audit sampling, not as proof.</p>
            <div class="table-wrap"><table class="t compact"><thead><tr><th>Digit</th><th class="right">Observed</th><th class="right">Expected</th><th class="right">Gap</th></tr></thead><tbody>${b.observed.map((o, i) => `<tr><td>${i + 1}</td><td class="num">${(o * 100).toFixed(1)}%</td><td class="num">${(b.expected[i] * 100).toFixed(1)}%</td><td class="num" style="color:var(--${Math.abs(o - b.expected[i]) > 0.03 ? 'bad' : 'ink-3'})">${((o - b.expected[i]) * 100).toFixed(1)}</td></tr>`).join('')}</tbody></table></div></section></div>`;
        pane.querySelectorAll('[data-sc]').forEach(x => x.addEventListener('click', () => { app._bscope = x.dataset.sc; app.render({ keepScroll: true }); }));
        UI.chart(pane.querySelector('#bf'), { type: 'bar', money: false, data: { labels: [1, 2, 3, 4, 5, 6, 7, 8, 9], datasets: [{ label: 'Observed', data: b.observed.map(x => +(x * 100).toFixed(2)), backgroundColor: pal[0] },
          { type: 'line', label: "Benford's expectation", data: b.expected.map(x => +(x * 100).toFixed(2)), borderColor: pal[1], backgroundColor: pal[1], pointRadius: 3, tension: 0.25 }] }, options: { scales: { y: { ticks: { callback: v => v + '%' }, grid: { color: UI.css('--line') } } } } });
      } else if (tab === 'risk') {
        const vr = app.vendorRisk();
        pane.innerHTML = `<section class="panel"><div class="panel-head"><div><h2>Supplier risk ranking</h2><div class="sub">Transparent weighted model: cancelled 30 · GSTR-1 delays 20 · GSTR-3B delays 20 · missing in 2B 15 · mismatches 5 · new registration 5 · average delay 5</div></div></div><div id="vt"></div></section>`;
        const colors = { cancelled: pal[3], gstr1_delay: pal[1], gstr3b_delay: pal[5], missing_2b: pal[4], mismatch: pal[0], new_reg: pal[2], late_days: pal[6] };
        UI.table(pane.querySelector('#vt'), { rows: () => vr, sort: 'score', dir: -1, columns: [{ key: 'name', label: 'Vendor', render: v => `<b>${esc(v.name)}</b><div>${UI.gstinHTML(v.gstin)}</div>` },
          { key: 'score', label: 'Score', num: true, render: v => `<span class="grade ${v.grade}">${v.grade}</span> <b>${v.score}</b>` },
          { key: 'mix', label: 'What drives the score', sort: false, render: v => `<div class="hbar" style="grid-template-columns:1fr"><span class="track" style="height:12px;width:260px">${Object.entries(v.contributions).filter(([, x]) => x > 0).map(([k, x]) => `<i title="${esc(AI.FACTOR_LABEL[k])}: ${x}" style="width:${x}%;background:${colors[k]}"></i>`).join('')}</span></div><div class="tiny muted">${Object.entries(v.contributions).filter(([, x]) => x >= 3).map(([k, x]) => `${AI.FACTOR_LABEL[k]} ${x.toFixed(0)}`).join(' · ')}</div>` },
          { key: 'itc_exposure', label: 'ITC exposure', num: true, render: v => C.inr(v.itc_exposure, 0) }, { key: 'action', label: 'Action' }], onRow: v => V._vendorDrawer(app, v.vendor_id) });
      } else {
        const by = {}; a.P.forEach(p => { if (p.itc_claimed === 'Y' && p.claim_period >= '2026-01') by[p.claim_period] = (by[p.claim_period] || 0) + C.taxOf(p); });
        const series = Object.entries(by).sort(), f = AI.forecast(series);
        const rcmBy = {}; a.rcm.forEach(r => rcmBy[r.liability_period] = (rcmBy[r.liability_period] || 0) + r.tax);
        const fr = AI.forecast(Object.entries(rcmBy).filter(([p]) => p >= '2026-01' && p <= '2026-09').sort());
        if (!f) { pane.innerHTML = '<div class="empty">Need at least four months of claims to forecast.</div>'; return; }
        pane.innerHTML = `<div class="grid g-21"><section class="panel"><div class="panel-head"><div><h2>ITC claimed per month and next 3 months</h2><div class="sub">OLS trend (60%) blended with 3-month moving average (40%); band = ±1.64 × residual σ (≈90%)</div></div></div><div class="chart-box tall"><canvas id="fc"></canvas></div></section>
          <section class="panel stack"><h2>Forecast</h2><div class="table-wrap"><table class="t compact"><thead><tr><th>Month</th><th class="right">ITC forecast</th><th class="right">Range</th>${fr ? '<th class="right">RCM cash</th>' : ''}</tr></thead><tbody>${f.forecast.map((x, i) => `<tr><td>${C.periodLabel(x.period)}</td><td class="num"><b>${C.inr(x.forecast, 0)}</b></td><td class="num small">${C.inrShort(x.low)} – ${C.inrShort(x.high)}</td>${fr ? `<td class="num">${C.inr(fr.forecast[i].forecast, 0)}</td>` : ''}</tr>`).join('')}</tbody></table></div>
            <dl class="kv"><dt>Trend</dt><dd>${f.slope >= 0 ? '+' : ''}${C.inr(f.slope, 0)} per month</dd><dt>R²</dt><dd>${f.r2.toFixed(2)}</dd></dl><p class="small muted">Use it for cash-flow planning: expected credit vs expected output tax tells the client how much cash GST to budget. The January spike reflects the opening month of the data set.</p></section></div>`;
        const labels = f.history.map(h => h.period).concat(f.forecast.map(x => x.period)).map(C.periodLabel), n = f.history.length;
        UI.chart(pane.querySelector('#fc'), { type: 'line', data: { labels, datasets: [
          { label: 'Actual ITC claimed', data: f.history.map(h => h.value).concat(f.forecast.map(() => null)), borderColor: pal[0], backgroundColor: pal[0], tension: 0.25, pointRadius: 3 },
          { label: 'Forecast', data: Array(n - 1).fill(null).concat([f.history[n - 1].value]).concat(f.forecast.map(x => x.forecast)), borderColor: pal[1], borderDash: [6, 4], backgroundColor: pal[1], tension: 0.25, pointRadius: 3 },
          { label: 'Upper band', data: Array(n).fill(null).concat(f.forecast.map(x => x.high)), borderColor: 'transparent', backgroundColor: pal[1] + '22', fill: '+1', pointRadius: 0 },
          { label: 'Lower band', data: Array(n).fill(null).concat(f.forecast.map(x => x.low)), borderColor: 'transparent', backgroundColor: pal[1] + '22', pointRadius: 0 }] },
          options: { plugins: { legend: { labels: { filter: (i) => !i.text.includes('band') } } } } });
      }
    }
  };

  // ================================================================ Assistant
  V.assistant = {
    title: 'GST Mitra assistant',
    render(app) {
      app._chat = app._chat || [{ who: 'bot', text: `Namaste. I am GST Mitra. Ask me about input tax credit and reverse charge law, or about ${app.client().name}'s data. I can compute RCM on an amount, interest u/s 50, check a GSTIN, and list missing-in-2B invoices or risky vendors.`, chips: ['How much ITC is at risk?', 'Which invoices are missing in 2B?', 'RCM on legal fees of 75,000', 'Show high risk vendors', 'What is Rule 37A?', 'Can RCM be paid from the credit ledger?'] }];
      return `<div class="page-head"><div><div class="eyebrow">Retrieval chatbot over ${KB().chatbot_kb.length} curated answers + live client data</div><h1>GST Mitra</h1></div><div class="actions"><button class="btn sm" id="clear">Clear chat</button></div></div>
        <section class="panel chat"><div class="chat-log" id="log" aria-live="polite"></div><form class="chat-input" id="f"><input type="text" id="q" placeholder="Ask about ITC, RCM, or this client's data…" autocomplete="off" aria-label="Your question"><button class="btn primary" type="submit">${UI.icon('send')}Ask</button></form></section>`;
    },
    mount(host, app) {
      const log = host.querySelector('#log');
      const draw = () => {
        log.innerHTML = app._chat.map(m => `<div class="msg ${m.who}">${esc(m.text)}${m.table ? `<div class="table-wrap"><table class="t compact"><thead><tr>${m.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${m.table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
          ${m.meta ? `<div class="meta">${esc(m.meta)}</div>` : ''}${m.chips && m.chips.length ? `<div class="chips">${m.chips.map(c => `<button type="button" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}</div>`).join('');
        log.scrollTop = log.scrollHeight;
      };
      const ask = async (q) => {
        if (!q.trim()) return;
        app._chat.push({ who: 'me', text: q });
        if (q === 'Open RCM wizard') return app.navigate('rcm-wizard');
        if (q === 'Open reconciliation') return app.navigate('recon');
        if (q === 'Open ITC analyzer') return app.navigate('itc');
        const r = AI.ask(q, { analysis: app.analysis(), DB: app.DB, vendorRisk: app.vendorRisk() });
        const m = { who: 'bot', text: r.text, table: r.table, chips: r.chips, meta: r.kind === 'kb' && r.matched ? `Matched: "${r.matched}" · similarity ${(r.score * 100).toFixed(0)}%` : r.kind === 'data' ? `Computed from ${app.client().name}'s live data` : r.kind === 'rcm' ? 'Computed by the RCM engine' : '' };
        app._chat.push(m); draw();
        if (app.backend.ok && r.kind === 'kb') { try { const j = await app.api('/api/chat', { q }); if (j.matched_question && j.matched_question !== r.matched) { m.meta += ` · Python TF-IDF matched "${j.matched_question}"`; draw(); } } catch (e) { /* ignore */ } }
      };
      host.querySelector('#f').addEventListener('submit', (e) => { e.preventDefault(); const q = host.querySelector('#q'); ask(q.value); q.value = ''; });
      log.addEventListener('click', (e) => { const c = e.target.closest('[data-chip]'); if (c) ask(c.dataset.chip); });
      host.querySelector('#clear').addEventListener('click', () => { app._chat = null; app.render(); });
      draw();
    }
  };
})(window);
