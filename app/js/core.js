/* GSTiQ core utilities - dates, money, text, GSTIN. Works in browser and Node (for tests). */
(function (root) {
  'use strict';
  const KB = () => root.GST_KB;

  // ---------- dates (ISO yyyy-mm-dd strings, UTC-safe) ----------
  function d(s) {
    if (!s) return null;
    if (s instanceof Date) return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
    s = String(s).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    if (/^\d{5}$/.test(s)) { // Excel serial
      const base = Date.UTC(1899, 11, 30);
      return new Date(base + (+s) * 86400000);
    }
    return null;
  }
  const iso = (dt) => dt ? dt.toISOString().slice(0, 10) : '';
  const addDays = (dt, n) => new Date(dt.getTime() + n * 86400000);
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);
  const fyStartYear = (dt) => dt.getUTCMonth() >= 3 ? dt.getUTCFullYear() : dt.getUTCFullYear() - 1;
  const fyLabel = (dt) => { const y = fyStartYear(dt); return `${y}-${String(y + 1).slice(-2)}`; };
  const sec16_4Deadline = (dt) => new Date(Date.UTC(fyStartYear(dt) + 1, 10, 30));
  const lastClaimPeriod = (dt) => `${fyStartYear(dt) + 1}-10`;
  const periodOf = (dt) => `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
  function addMonths(p, n) {
    let [y, m] = p.split('-').map(Number);
    m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  const dueDate3B = (p) => { const [y, m] = addMonths(p, 1).split('-').map(Number); return new Date(Date.UTC(y, m - 1, 20)); };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const periodLabel = (p) => p ? `${MONTHS[+p.slice(5, 7) - 1]} ${p.slice(0, 4)}` : '';
  const fmtDate = (s) => { const x = d(s); return x ? `${String(x.getUTCDate()).padStart(2, '0')}-${MONTHS[x.getUTCMonth()]}-${x.getUTCFullYear()}` : ''; };

  // ---------- money ----------
  const money = (x) => { const n = Number(x); return isFinite(n) ? Math.round(n * 100) / 100 : 0; };
  const taxOf = (r) => money(money(r.igst) + money(r.cgst) + money(r.sgst) + money(r.cess));
  function inr(x, dec = 2) {
    const n = money(x); const neg = n < 0;
    let [w, f] = Math.abs(n).toFixed(dec).split('.');
    if (w.length > 3) { const tail = w.slice(-3); let head = w.slice(0, -3); const parts = []; while (head.length > 2) { parts.unshift(head.slice(-2)); head = head.slice(0, -2); } if (head) parts.unshift(head); w = parts.join(',') + ',' + tail; }
    return (neg ? '−' : '') + '₹' + w + (dec ? '.' + f : '');
  }
  function inrShort(x) {
    const n = money(x), a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
    if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)} L`;
    if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)} K`;
    return `${s}₹${a.toFixed(0)}`;
  }

  // ---------- text ----------
  function normInv(s) {
    const toks = String(s || '').toUpperCase().match(/[A-Z]+|\d+/g) || [];
    return toks.map(t => /^\d+$/.test(t) ? (t.replace(/^0+/, '') || '0') : t).join('');
  }
  function levenshtein(a, b) {
    if (a === b) return 0; if (!a) return b.length; if (!b) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)));
      prev = cur;
    }
    return prev[b.length];
  }
  const similarity = (a, b) => (!a && !b) ? 1 : 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const kwMatch = (text, kw) => new RegExp('(?<![a-z0-9])' + escRe(kw.toLowerCase()) + '(?![a-z0-9])').test(String(text).toLowerCase());
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- GSTIN ----------
  const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function gstinChecksum(first14) {
    let factor = 2, total = 0; const mod = 36;
    const s = first14.toUpperCase();
    for (let i = s.length - 1; i >= 0; i--) {
      const cp = CHARSET.indexOf(s[i]);
      let add = factor * cp; factor = factor === 2 ? 1 : 2;
      total += Math.floor(add / mod) + (add % mod);
    }
    return CHARSET[(mod - (total % mod)) % mod];
  }
  function validateGSTIN(g) {
    g = String(g || '').trim().toUpperCase();
    const errors = [];
    if (g.length !== 15) errors.push('GSTIN must be 15 characters');
    else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) errors.push('Format must be 99AAAAA9999A9Z9');
    else {
      const cs = gstinChecksum(g.slice(0, 14));
      if (cs !== g[14]) errors.push(`Check digit should be ${cs}`);
      if (KB() && !KB().states[g.slice(0, 2)]) errors.push(`Unknown state code ${g.slice(0, 2)}`);
    }
    const kb = KB();
    return {
      gstin: g, valid: errors.length === 0, errors,
      state_code: g.slice(0, 2), state: kb && kb.states[g.slice(0, 2)] || '',
      pan: g.slice(2, 12), holder: kb && kb.pan_types[g[5]] || '', entity: g[12] || ''
    };
  }

  // ---------- stats ----------
  const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
  const mean = (a) => a.length ? sum(a) / a.length : 0;
  const std = (a) => { const m = mean(a); return a.length ? Math.sqrt(mean(a.map(x => (x - m) ** 2))) : 0; };
  const groupBy = (arr, f) => arr.reduce((acc, x) => { const k = f(x); (acc[k] = acc[k] || []).push(x); return acc; }, {});
  function linreg(y) {
    const n = y.length, xs = y.map((_, i) => i), mx = mean(xs), my = mean(y);
    const sxx = sum(xs.map(x => (x - mx) ** 2)), sxy = sum(xs.map((x, i) => (x - mx) * (y[i] - my)));
    const b = sxx ? sxy / sxx : 0, a = my - b * mx;
    const fit = xs.map(x => a + b * x);
    const ssr = sum(y.map((v, i) => (v - fit[i]) ** 2)), sst = sum(y.map(v => (v - my) ** 2));
    return { a, b, r2: sst ? 1 - ssr / sst : 0, resid: Math.sqrt(ssr / Math.max(1, n)), predict: (x) => a + b * x };
  }
  // seeded PRNG (mulberry32) for reproducible ML in the browser
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  root.GSTCore = {
    d, iso, addDays, daysBetween, fyStartYear, fyLabel, sec16_4Deadline, lastClaimPeriod, periodOf, addMonths, dueDate3B,
    periodLabel, fmtDate, MONTHS, money, taxOf, inr, inrShort, normInv, levenshtein, similarity, kwMatch, esc,
    gstinChecksum, validateGSTIN, sum, mean, std, groupBy, linreg, rng
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GSTCore;
})(typeof window !== 'undefined' ? window : globalThis);
