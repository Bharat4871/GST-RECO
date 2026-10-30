/* GSTiQ in-browser AI (no server needed)
   1. Multinomial Naive Bayes expense classifier (+ k-fold cross-validation, explanation)
   2. Isolation Forest (implemented from scratch) + forensic rules for invoice anomalies
   3. Benford's law first-digit test
   4. Vendor risk scoring (same weights as Python engine)
   5. ITC forecast (OLS trend + moving average)
   6. GST Mitra - retrieval chatbot (TF-IDF cosine) with data-aware intents */
(function (root) {
  'use strict';
  const C = root.GSTCore, KB = () => root.GST_KB;
  const STOP = new Set('a an the of for to and in on by with from at is are be paid bill invoice charges charge expenses expense purchase'.split(' '));
  const tokens = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && w.length > 1);
  function feats(t) {
    const w = tokens(t).filter(x => !STOP.has(x));
    const f = [...w];
    for (let i = 0; i + 1 < w.length; i++) f.push(w[i] + '_' + w[i + 1]);
    return f;
  }

  // ---------------------------------------------------------------- 1. Naive Bayes
  class NaiveBayes {
    constructor(alpha = 0.4) { this.alpha = alpha; }
    fit(samples) {
      this.classes = [...new Set(samples.map(s => s[1]))];
      this.vocab = new Set(); this.count = {}; this.total = {}; this.prior = {};
      for (const c of this.classes) { this.count[c] = {}; this.total[c] = 0; this.prior[c] = 0; }
      for (const [text, c] of samples) {
        this.prior[c]++;
        for (const f of feats(text)) { this.vocab.add(f); this.count[c][f] = (this.count[c][f] || 0) + 1; this.total[c]++; }
      }
      const n = samples.length; for (const c of this.classes) this.prior[c] = Math.log(this.prior[c] / n);
      return this;
    }
    logp(c, f) { return Math.log(((this.count[c][f] || 0) + this.alpha) / (this.total[c] + this.alpha * this.vocab.size)); }
    predict(text, top = 3) {
      const fs = feats(text).filter(f => this.vocab.has(f));
      const scores = this.classes.map(c => [c, this.prior[c] + fs.reduce((a, f) => a + this.logp(c, f), 0)]);
      const mx = Math.max(...scores.map(s => s[1]));
      const ex = scores.map(([c, s]) => [c, Math.exp(s - mx)]); const Z = C.sum(ex, x => x[1]);
      const probs = ex.map(([c, e]) => [c, e / Z]).sort((a, b) => b[1] - a[1]);
      const best = probs[0][0];
      const because = [...new Set(fs)].map(f => [f, this.logp(best, f) - C.mean(this.classes.filter(c => c !== best).map(c => this.logp(c, f)))])
        .filter(x => x[1] > 0.4).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0].replace('_', ' '));
      const L = KB().labels[best];
      return { label: best, name: L.name, group: L.group, ref: L.ref, rcm_id: L.rcm_id, confidence: probs[0][1], because, known: fs.length,
        alternatives: probs.slice(1, top).map(([c, p]) => ({ label: c, name: KB().labels[c].name, p })) };
    }
  }
  let _model = null;
  const model = () => _model || (_model = new NaiveBayes().fit(KB().corpus));
  function crossValidate(k = 5) {
    const data = [...KB().corpus]; const r = C.rng(7);
    for (let i = data.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [data[i], data[j]] = [data[j], data[i]]; }
    const scores = [];
    for (let f = 0; f < k; f++) {
      const test = data.filter((_, i) => i % k === f), train = data.filter((_, i) => i % k !== f);
      const m = new NaiveBayes().fit(train);
      scores.push(test.filter(([t, c]) => m.predict(t).label === c).length / test.length);
    }
    return { folds: k, mean_accuracy: C.mean(scores), std: C.std(scores), scores, samples: data.length, classes: new Set(data.map(x => x[1])).size };
  }
  // Hybrid: rule hints override when they are certain (HSN / keyword), ML fills the gaps
  function classify(text, hsn) {
    const ml = model().predict(text);
    const E = root.GSTEngine;
    const [rule, why] = E.ruleCategory({ description: text, hsn_sac: hsn || '' });
    let rcmKw = null;
    for (const e of KB().rcm_catalog) for (const kw of e.keywords) if (C.kwMatch(text, kw)) { rcmKw = rcmKw || [e.id, kw]; }
    return Object.assign(ml, { rule_label: rule, rule_reason: why, rcm_keyword: rcmKw, agree: !rule || rule === ml.label });
  }

  // ---------------------------------------------------------------- 2. Isolation Forest
  function cFactor(n) { return n <= 1 ? 0 : 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n; }
  function buildTree(X, depth, limit, r) {
    if (depth >= limit || X.length <= 1) return { size: X.length };
    const dims = X[0].length; const q = Math.floor(r() * dims);
    let mn = Infinity, mx = -Infinity; for (const x of X) { if (x[q] < mn) mn = x[q]; if (x[q] > mx) mx = x[q]; }
    if (mn === mx) return { size: X.length };
    const split = mn + r() * (mx - mn);
    return { q, split, left: buildTree(X.filter(x => x[q] < split), depth + 1, limit, r), right: buildTree(X.filter(x => x[q] >= split), depth + 1, limit, r) };
  }
  function pathLen(x, node, depth) { if (node.size !== undefined) return depth + cFactor(node.size); return pathLen(x, x[node.q] < node.split ? node.left : node.right, depth + 1); }
  function isolationForest(X, nTrees = 150, sample = 128, seed = 42) {
    const r = C.rng(seed), n = X.length, s = Math.min(sample, n), limit = Math.ceil(Math.log2(s));
    const trees = [];
    for (let t = 0; t < nTrees; t++) { const sub = []; for (let i = 0; i < s; i++) sub.push(X[Math.floor(r() * n)]); trees.push(buildTree(sub, 0, limit, r)); }
    const cn = cFactor(s);
    return X.map(x => Math.pow(2, -C.mean(trees.map(tr => pathLen(x, tr, 0))) / cn));
  }
  function anomalies(purchases, contamination = 0.04) {
    const rows = purchases.filter(p => C.money(p.taxable_value) > 0);
    if (rows.length < 20) return [];
    const byV = C.groupBy(rows, p => p.vendor_id), vs = {};
    for (const [v, list] of Object.entries(byV)) { const vals = list.map(p => C.money(p.taxable_value)); vs[v] = [C.mean(vals), C.std(vals)]; }
    const X = rows.map(p => {
      const tv = C.money(p.taxable_value), dt = C.d(p.invoice_date), pay = C.d(p.payment_date);
      const [m, s] = vs[p.vendor_id] || [tv, 0];
      return [Math.log10(tv + 1), s > 0 ? (tv - m) / s : 0, tv >= 10000 && tv % 10000 === 0 ? 1 : 0, dt && dt.getUTCDay() === 0 ? 1 : 0,
        pay && dt ? C.daysBetween(dt, pay) : 200, (tv + C.taxOf(p)) >= 47500 && (tv + C.taxOf(p)) < 50000 ? 1 : 0, Number(p.rate) || 0, dt && dt.getUTCDate() >= 28 ? 1 : 0];
    });
    // standardise features so that no single scale dominates the random splits
    const cols = X[0].map((_, j) => X.map(x => x[j])); const mu = cols.map(C.mean), sd = cols.map(c => C.std(c) || 1);
    const Xs = X.map(x => x.map((v, j) => (v - mu[j]) / sd[j]));
    const score = isolationForest(Xs);
    const cut = [...score].sort((a, b) => b - a)[Math.max(0, Math.floor(rows.length * contamination) - 1)];
    const out = {};
    rows.forEach((p, i) => {
      const x = X[i], strong = [], support = [];
      if (Math.abs(x[1]) >= 3) strong.push(`Value is ${x[1] > 0 ? '+' : ''}${x[1].toFixed(1)}σ from this vendor's usual bills`);
      if (x[5] && !String(p.hsn_sac || '').startsWith('99')) strong.push('Goods invoice just below ₹50,000 e-way bill threshold (possible splitting)');
      if (x[2]) support.push('Round-sum invoice value'); if (x[3]) support.push('Invoice dated on a Sunday');
      const outlier = score[i] >= cut;
      if (outlier || strong.length) out[p.id] = { id: p.id, supplier_name: p.supplier_name, invoice_no: p.invoice_no, invoice_date: p.invoice_date,
        taxable_value: C.money(p.taxable_value), score: Math.round(score[i] * 1000) / 1000, isolation_outlier: outlier,
        reasons: strong.concat(strong.length || outlier ? support : []).concat(strong.length || support.length ? [] : ['Unusual combination of value, timing and payment pattern (Isolation Forest)']) };
    });
    const seen = C.groupBy(rows, p => p.vendor_id + '|' + Math.round(C.money(p.taxable_value)));
    for (const g of Object.values(seen)) {
      if (g.length < 2) continue;
      g.sort((a, b) => a.invoice_date < b.invoice_date ? -1 : 1);
      for (let i = 1; i < g.length; i++) if (C.daysBetween(C.d(g[i - 1].invoice_date), C.d(g[i].invoice_date)) <= 10) {
        const b = g[i]; const o = out[b.id] = out[b.id] || { id: b.id, supplier_name: b.supplier_name, invoice_no: b.invoice_no, invoice_date: b.invoice_date, taxable_value: C.money(b.taxable_value), score: 0.9, isolation_outlier: false, reasons: [] };
        o.reasons.unshift(`Same vendor and amount as ${g[i - 1].invoice_no} within 10 days`); o.score = Math.max(o.score, 0.9);
      }
    }
    return { items: Object.values(out).sort((a, b) => b.score - a.score), scores: rows.map((p, i) => ({ id: p.id, v: C.money(p.taxable_value), s: score[i] })), cut };
  }

  // ---------------------------------------------------------------- 3. Benford
  const BENFORD = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(dg => Math.log10(1 + 1 / dg));
  function benford(values) {
    const firsts = values.filter(v => Math.abs(v) >= 10).map(v => +String(Math.floor(Math.abs(v))).replace(/^0+/, '')[0]);
    const n = firsts.length; if (!n) return null;
    const cnt = Array(10).fill(0); firsts.forEach(f => cnt[f]++);
    const obs = BENFORD.map((_, i) => cnt[i + 1] / n);
    const chi = C.sum(BENFORD.map((e, i) => (cnt[i + 1] - n * e) ** 2 / (n * e)));
    const mad = C.mean(obs.map((o, i) => Math.abs(o - BENFORD[i])));
    const verdict = mad < 0.006 ? 'Close conformity' : mad < 0.012 ? 'Acceptable conformity' : mad < 0.015 ? 'Marginal conformity' : 'Nonconformity - investigate';
    return { n, observed: obs, expected: BENFORD, chi_square: chi, chi_critical_5pct: 15.507, mad, verdict };
  }

  // ---------------------------------------------------------------- 4. Vendor risk
  const W = { cancelled: 30, gstr1_delay: 20, gstr3b_delay: 20, missing_2b: 15, mismatch: 5, new_reg: 5, late_days: 5 };
  const FACTOR_LABEL = { cancelled: 'Registration cancelled', gstr1_delay: 'GSTR-1 filing delays', gstr3b_delay: 'GSTR-3B filing delays', missing_2b: 'Invoices missing in 2B', mismatch: 'Value/date mismatches', new_reg: 'New registration (<1 yr)', late_days: 'Average filing delay' };
  function vendorRisk(vendors, purchases, reconByPr, asOn) {
    const pv = C.groupBy(purchases, p => p.vendor_id), out = [];
    for (const v of vendors) {
      const inv = pv[v.id] || []; if (!inv.length || !v.gstin) continue;
      const exp = inv.filter(p => reconByPr[p.id] && reconByPr[p.id].status !== 'NOT_APPLICABLE');
      const miss = exp.filter(p => reconByPr[p.id].status === 'MISSING_IN_2B').length;
      const mism = exp.filter(p => ['MISMATCH_VALUE', 'MISMATCH_DATE', 'GSTIN_MISMATCH'].includes(reconByPr[p.id].status)).length;
      const reg = C.d(v.reg_date);
      const f = { cancelled: v.status !== 'Active' ? 1 : 0, gstr1_delay: Math.max(0, 1 - Number(v.gstr1_rate ?? 1)) / 0.6, gstr3b_delay: Math.max(0, 1 - Number(v.gstr3b_rate ?? 1)) / 0.6,
        missing_2b: exp.length ? miss / exp.length : 0, mismatch: exp.length ? mism / exp.length : 0, new_reg: reg && C.daysBetween(reg, asOn) < 365 ? 1 : 0, late_days: Math.min(1, Number(v.avg_delay || 0) / 45) };
      const contrib = {}; for (const k in W) contrib[k] = Math.round(W[k] * Math.min(1, f[k]) * 100) / 100;
      const score = Math.round(C.sum(Object.values(contrib)) * 10) / 10;
      const grade = score < 15 ? 'A' : score < 30 ? 'B' : score < 50 ? 'C' : 'D';
      out.push({ vendor_id: v.id, name: v.name, gstin: v.gstin, status: v.status, score, grade, contributions: contrib, invoices: inv.length,
        itc_exposure: C.money(C.sum(inv, C.taxOf)), missing_in_2b: miss,
        action: { A: 'Routine', B: 'Monitor monthly', C: 'Follow up before claiming ITC', D: 'Hold payment / insist on compliance' }[grade] });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  // ---------------------------------------------------------------- 5. Forecast
  function forecast(series, horizon = 3) {
    if (series.length < 4) return null;
    const y = series.map(s => s[1]), lr = C.linreg(y), ma = C.mean(y.slice(-3));
    const out = [];
    for (let h = 1; h <= horizon; h++) {
      const val = Math.max(0, 0.6 * lr.predict(y.length - 1 + h) + 0.4 * ma);
      out.push({ period: C.addMonths(series[series.length - 1][0], h), forecast: val, low: Math.max(0, val - 1.64 * lr.resid), high: val + 1.64 * lr.resid });
    }
    return { history: series.map(([p, v]) => ({ period: p, value: v })), forecast: out, slope: lr.b, r2: lr.r2 };
  }

  // ---------------------------------------------------------------- 6. Chatbot
  let _tfidf = null;
  function tfidfIndex() {
    if (_tfidf) return _tfidf;
    const docs = KB().chatbot_kb.map(x => tokens(`${x.q} ${x.q} ${x.a}`).filter(w => !STOP.has(w)));
    const df = {}; docs.forEach(d => new Set(d).forEach(w => df[w] = (df[w] || 0) + 1));
    const N = docs.length, idf = {}; for (const w in df) idf[w] = Math.log((1 + N) / (1 + df[w])) + 1;
    const vec = (ws) => { const tf = {}; ws.forEach(w => tf[w] = (tf[w] || 0) + 1); const v = {}; let n = 0; for (const w in tf) { if (!idf[w]) continue; v[w] = (1 + Math.log(tf[w])) * idf[w]; n += v[w] ** 2; } n = Math.sqrt(n) || 1; for (const w in v) v[w] /= n; return v; };
    _tfidf = { vec, mats: docs.map(vec) };
    return _tfidf;
  }
  function retrieve(q) {
    const t = tfidfIndex(), qv = t.vec(tokens(q).filter(w => !STOP.has(w)));
    const sims = t.mats.map((m, i) => [i, Object.keys(qv).reduce((a, w) => a + qv[w] * (m[w] || 0), 0)]).sort((a, b) => b[1] - a[1]);
    const kb = KB().chatbot_kb;
    return { best: kb[sims[0][0]], score: sims[0][1], related: sims.slice(1, 4).map(s => kb[s[0]].q) };
  }
  function parseAmount(q) {
    const m = q.toLowerCase().replace(/,/g, '').match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(crore|cr|lakhs?|lacs?|l|k|thousand)?\b/);
    if (!m) return null;
    let v = parseFloat(m[1]); const u = m[2] || '';
    if (/^cr/.test(u)) v *= 1e7; else if (/^(lakh|lac|l$)/.test(u)) v *= 1e5; else if (/^(k|thousand)/.test(u)) v *= 1e3;
    return v;
  }
  /* ctx = { analysis, DB, asOn, vendorRisk } supplied by the app; returns {text, table?, chips?} */
  function ask(q, ctx) {
    const s = q.toLowerCase().trim(), E = root.GSTEngine, A = ctx && ctx.analysis;
    const gm = q.toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/);
    if (gm) { const v = C.validateGSTIN(gm[0]); return { text: v.valid ? `GSTIN ${v.gstin} is structurally valid: state ${v.state} (${v.state_code}), PAN ${v.pan} (${v.holder || 'holder type ' + v.pan[3]}), registration no. ${v.entity} under this PAN.` : `GSTIN ${v.gstin} is not valid: ${v.errors.join('; ')}.`, kind: 'gstin' }; }
    const amt = parseAmount(s);
    if (/(rcm|reverse charge)/.test(s) && amt && amt >= 100) {
      const c = classify(q);
      let entry = c.rcm_keyword ? E.catalog().find(e => e.id === c.rcm_keyword[0]) : (c.rcm_id ? E.catalog().find(e => e.id === c.rcm_id) : null);
      if (entry) {
        const tax = C.money(amt * entry.rate / 100), inter = /inter.?state|igst|import|foreign/.test(s) || entry.id === 'RCM_IMPORT_SERVICE';
        return { kind: 'rcm', text: `${entry.title}: RCM @ ${entry.rate}% under ${entry.notification} (${entry.entry}). On ${C.inr(amt)} the recipient pays ${C.inr(tax)} in cash` +
          (inter ? ` as IGST.` : ` (CGST ${C.inr(C.money(tax / 2))} + SGST ${C.inr(C.money(tax - C.money(tax / 2)))}).`) +
          ` ITC of the tax paid is ${entry.itc_recipient ? 'available in the same GSTR-3B (Table ' + (entry.id === 'RCM_IMPORT_SERVICE' ? '4A(2)' : '4A(3)') + ')' : 'not available'}. ${entry.notes || ''}`,
          chips: ['Open RCM wizard'] };
      }
    }
    if (/interest/.test(s) && amt && /(\d+)\s*days?/.test(s)) {
      const days = +s.match(/(\d+)\s*days?/)[1]; const pct = /24\s*%/.test(s) ? 24 : 18;
      return { kind: 'calc', text: `Interest u/s 50 @ ${pct}% p.a. on ${C.inr(amt)} for ${days} days = ${C.inr(amt * pct / 100 * days / 365)} (simple interest, actual days / 365).` };
    }
    if (A) {
      const t = A.totals;
      if (/(high|top).*risk.*vendor|risky vendor|vendor.*risk/.test(s)) {
        const vr = (ctx.vendorRisk || []).filter(v => v.grade === 'C' || v.grade === 'D').slice(0, 6);
        return { kind: 'data', text: vr.length ? `${vr.length} vendor(s) of ${A.client.name} are high risk. Hold payments or insist on GSTR-1/3B compliance before claiming their ITC.` : 'No vendor is graded C or D for this client.',
          table: { head: ['Vendor', 'Score', 'Grade', 'ITC exposure'], rows: vr.map(v => [v.name, v.score, v.grade, C.inr(v.itc_exposure)]) } };
      }
      if (/missing.*2b|not in 2b|not.*reflect/.test(s)) {
        const miss = A.recon.filter(r => r.status === 'MISSING_IN_2B'); const by = C.groupBy(miss, r => r.supplier_name);
        const rows = Object.entries(by).map(([k, v]) => [k, v.length, C.inr(C.sum(v, x => x.books_tax))]).sort((a, b) => b[1] - a[1]).slice(0, 8);
        return { kind: 'data', text: `${miss.length} invoice(s) with GST of ${C.inr(C.sum(miss, r => r.books_tax))} are in the books but not in GSTR-2B. Under Rule 36(4) this ITC cannot be claimed until suppliers report them.`, table: { head: ['Supplier', 'Invoices', 'GST'], rows }, chips: ['Open reconciliation'] };
      }
      if (/(at risk|summary|position|how much itc|total itc|eligible itc)/.test(s)) {
        return { kind: 'data', text: `${A.client.name}: total GST on inward supplies ${C.inr(t.tax)}. Eligible ${C.inr(t.eligible_itc)}, blocked u/s 17(5) ${C.inr(t.blocked_itc)}, at risk ${C.inr(t.at_risk_itc)}, deferred ${C.inr(t.deferred_itc)}, lapsed ${C.inr(t.lapsed_itc)}. ITC already claimed but not eligible today: ${C.inr(t.wrongly_claimed)}.` };
      }
      if (/blocked/.test(s) && /(how much|amount|total|which|list)/.test(s)) {
        const by = C.groupBy(A.evals.filter(e => e.status === 'BLOCKED'), e => e.blocked_ref);
        return { kind: 'data', text: `Blocked credit of ${C.inr(t.blocked_itc)} for ${A.client.name}:`, table: { head: ['Section', 'Bills', 'GST'], rows: Object.entries(by).map(([k, v]) => [k, v.length, C.inr(C.sum(v, e => e.tax))]) } };
      }
      if (/(deadline|last date|16\(4\)|time limit|lapse)/.test(s) && !/what is/.test(s)) {
        const pend = A.evals.filter(e => e.flags.some(f => f.code === 'DEADLINE_NEAR'));
        return { kind: 'data', text: `ITC for FY 2025-26 must be claimed by 30-11-2026 (GSTR-3B for October 2026, due 20-11-2026). ${A.client.name} has ${pend.length} unclaimed bill(s) worth ${C.inr(C.sum(pend, e => e.tax))} in that window.` + (A.totals.lapsed_itc ? ` Already lapsed: ${C.inr(A.totals.lapsed_itc)}.` : ''), chips: ['Open ITC analyzer'] };
      }
      if (/rcm|reverse charge/.test(s) && /(unpaid|pending|overdue|due)/.test(s)) {
        const od = A.rcm.filter(r => r.status === 'Overdue' || r.status === 'Due');
        return { kind: 'data', text: `${od.length} RCM bill(s) unpaid with tax ${C.inr(C.sum(od, r => r.tax))}; interest accrued ${C.inr(C.sum(od, r => r.interest))}. Pay through the electronic cash ledger (Sec 49(4)).`, table: { head: ['Supplier', 'Type', 'Tax', 'Due'], rows: od.slice(0, 8).map(r => [r.supplier_name, r.rcm_title, C.inr(r.tax), r.due_date]) } };
      }
    }
    const r = retrieve(q);
    if (r.score < 0.08) return { kind: 'kb', text: 'I could not find that in my ITC/RCM knowledge base. Try asking about Sec 16 conditions, 17(5) blocked credits, RCM on a service, Rule 37/42/43, GSTR-2B/IMS, set-off, or your client data ("which invoices are missing in 2B?").', chips: r.related };
    return { kind: 'kb', text: r.best.a, matched: r.best.q, score: r.score, chips: r.related };
  }

  root.GSTAI = { NaiveBayes, model, crossValidate, classify, isolationForest, anomalies, benford, vendorRisk, FACTOR_LABEL, forecast, ask, retrieve, parseAmount };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GSTAI;
})(typeof window !== 'undefined' ? window : globalThis);
