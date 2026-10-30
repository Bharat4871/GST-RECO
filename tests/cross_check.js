// Runs the browser (JavaScript) engine in Node.js on the demo data and prints a JSON summary.
// Used by tests/test_cross_language.py to prove the Python and JS engines agree.
const fs = require('fs'), path = require('path'), vm = require('vm');
const js = (f) => fs.readFileSync(path.join(__dirname, '..', 'app', 'js', f), 'utf8');
vm.runInThisContext(js('kb.js').replace('window.GST_KB', 'globalThis.GST_KB'));
vm.runInThisContext(js('seed.js').replace('window.GSTIQ_SEED', 'globalThis.GSTIQ_SEED'));
const C = require('../app/js/core.js'); globalThis.GSTCore = C;
const E = require('../app/js/engine.js');
const DB = Object.assign({ settings: {} }, globalThis.GSTIQ_SEED);
const asOn = C.d(DB.as_on);
const out = {};
for (const c of DB.clients) {
  const a = E.analyse(DB, c.id, asOn);
  const sub = { clients: [c], purchases: a.P, gstr2b: a.B, sales: DB.sales.filter(s => s.client_id === c.id) };
  const g = {};
  for (const per of ['2026-03', '2026-08', '2026-09', '2026-10']) {
    const r = E.gstr3b(sub, c.id, per, a.evals, a.recon, asOn);
    g[per] = { net: r.net_itc, claimed: r.itc_claimed_total, d31: r.tables['3.1(d)'], c4: r.tables['4C'], r42: r.rule42.reversal, r43: r.rule43.Te, drc: r.drc01c.risk };
  }
  out[c.id] = {
    recon: Object.fromEntries(a.recon.map(r => [r.pr_id || r.b2b_id, r.status])),
    status: Object.fromEntries(a.evals.map(e => [e.id, e.status])),
    flags: Object.fromEntries(a.evals.map(e => [e.id, e.flags.map(f => f.code).sort().join(',')])),
    totals: a.totals, rcm_interest: a.rcm.reduce((s, r) => s + r.interest, 0), gstr3b: g
  };
}
process.stdout.write(JSON.stringify(out));
