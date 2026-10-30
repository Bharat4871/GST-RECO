/* GSTiQ rules engine (JavaScript port of backend/*.py - kept in lock-step; see tests/cross_check.js)
   Reconciliation | ITC eligibility (Sec 16, 17, Rules 36(4), 37, 37A) | RCM | GSTR-3B | Rule 42/43 | Set-off | Interest */
(function (root) {
  'use strict';
  const C = root.GSTCore || require('./core.js');
  const KB = () => root.GST_KB;
  const { d, iso, addDays, daysBetween, money, taxOf, normInv, levenshtein, similarity, periodOf, addMonths, dueDate3B,
    sec16_4Deadline, lastClaimPeriod, fyLabel, kwMatch, validateGSTIN } = C;

  // =====================================================================
  // Reconciliation
  // =====================================================================
  const RECON_LABEL = {
    MATCHED: 'Matched', MATCHED_FUZZY: 'Probable match', MISMATCH_VALUE: 'Value mismatch', MISMATCH_DATE: 'Date mismatch',
    GSTIN_MISMATCH: 'GSTIN mismatch', MISSING_IN_2B: 'Missing in 2B', MISSING_IN_BOOKS: 'Missing in books',
    DUPLICATE_IN_BOOKS: 'Duplicate in books', NOT_APPLICABLE: 'Not expected in 2B'
  };
  const RECON_DEFAULTS = { amount_tolerance: 1.0, date_tolerance_days: 0, fuzzy_threshold: 0.72 };
  const expectedIn2B = (p) => !!p.supplier_gstin && ['Regular', 'SEZ', 'ISD', 'Government'].includes(p.supplier_type);

  function res(p, b, status, conf, note) {
    const src = p || b;
    const r = {
      pr_id: p ? p.id : '', b2b_id: b ? b.id : '', client_id: src.client_id, status, label: RECON_LABEL[status], confidence: conf, note,
      supplier_gstin: src.supplier_gstin, supplier_name: src.supplier_name, invoice_no: p ? p.invoice_no : b.invoice_no,
      invoice_date: p ? p.invoice_date : b.invoice_date, books_taxable: p ? money(p.taxable_value) : 0, books_tax: p ? taxOf(p) : 0,
      b2b_taxable: b ? money(b.taxable_value) : 0, b2b_tax: b ? taxOf(b) : 0, return_period: b ? b.return_period : '',
      ims_action: b ? b.ims_action : '', itc_available: b ? b.itc_available : '', supplier_3b_filed: b ? (b.supplier_3b_filed || '') : ''
    };
    r.tax_diff = money(r.books_tax - r.b2b_tax);
    return r;
  }

  function reconcile(purchases, gstr2b, vendors, settings) {
    const s = Object.assign({}, RECON_DEFAULTS, settings || {});
    const tol = Number(s.amount_tolerance);
    const vend = {}; (vendors || []).forEach(v => vend[v.id] = v);
    const results = [], used = new Set();
    const byKey = new Map(), byGstin = new Map();
    for (const b of gstr2b) {
      const k = b.supplier_gstin + '|' + normInv(b.invoice_no);
      if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(b);
      if (!byGstin.has(b.supplier_gstin)) byGstin.set(b.supplier_gstin, []); byGstin.get(b.supplier_gstin).push(b);
    }
    const seen = new Map(), dup = new Set();
    [...purchases].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).forEach(p => {
      if (!p.supplier_gstin) return;
      const k = p.supplier_gstin + '|' + normInv(p.invoice_no) + '|' + Math.round(money(p.taxable_value));
      if (seen.has(k)) dup.add(p.id); else seen.set(k, p.id);
    });
    const pending = [];
    for (const p of purchases) {
      if (dup.has(p.id)) {
        const k = p.supplier_gstin + '|' + normInv(p.invoice_no) + '|' + Math.round(money(p.taxable_value));
        results.push(res(p, null, 'DUPLICATE_IN_BOOKS', 1, `Same invoice already booked as ${seen.get(k)}`)); continue;
      }
      if (!expectedIn2B(p)) {
        const note = { Unregistered: 'Unregistered supplier - RCM / no ITC from 2B', Foreign: 'Import of services - IGST paid under RCM (Table 4A(2))', Composition: 'Composition supplier issues bill of supply - no ITC' }[p.supplier_type] || 'Not reported in GSTR-2B';
        results.push(res(p, null, 'NOT_APPLICABLE', 1, note)); continue;
      }
      pending.push(p);
    }
    // Pass 1
    const still = [];
    for (const p of pending) {
      const cands = (byKey.get(p.supplier_gstin + '|' + normInv(p.invoice_no)) || []).filter(b => !used.has(b.id));
      if (!cands.length) { still.push(p); continue; }
      let b = cands[0];
      for (const x of cands) if (Math.abs(money(x.taxable_value) - money(p.taxable_value)) < Math.abs(money(b.taxable_value) - money(p.taxable_value))) b = x;
      used.add(b.id);
      const dt = Math.abs(money(p.taxable_value) - money(b.taxable_value)), dtax = Math.abs(taxOf(p) - taxOf(b));
      const pd = d(p.invoice_date), bd = d(b.invoice_date), ddays = pd && bd ? Math.abs(daysBetween(bd, pd)) : 999;
      const notes = []; let st, conf;
      if (String(p.invoice_no).trim() !== String(b.invoice_no).trim()) notes.push(`Invoice no. format differs ('${b.invoice_no}' in 2B)`);
      if (dtax > tol || dt > tol) { st = 'MISMATCH_VALUE'; conf = 0.9; notes.push(`Tax differs by ${dtax.toFixed(2)}; taxable by ${dt.toFixed(2)}`); }
      else if (ddays > s.date_tolerance_days) { st = 'MISMATCH_DATE'; conf = 0.95; notes.push(`Invoice date differs by ${ddays} day(s)`); }
      else { st = 'MATCHED'; conf = notes.length ? 0.97 : 1; }
      results.push(res(p, b, st, conf, notes.join('; ')));
    }
    // Pass 2 - fuzzy
    const still2 = [];
    for (const p of still) {
      let best = null, bestScore = 0, parts = null;
      for (const b of (byGstin.get(p.supplier_gstin) || [])) {
        if (used.has(b.id)) continue;
        const invSim = similarity(normInv(p.invoice_no), normInv(b.invoice_no));
        const pv = money(p.taxable_value), bv = money(b.taxable_value);
        const amtSim = 1 - Math.min(1, Math.abs(pv - bv) / Math.max(pv, bv, 1));
        const pd = d(p.invoice_date), bd = d(b.invoice_date);
        const dateSim = pd && bd ? Math.max(0, 1 - Math.abs(daysBetween(bd, pd)) / 30) : 0;
        const score = 0.5 * invSim + 0.35 * amtSim + 0.15 * dateSim;
        if (score > bestScore) { best = b; bestScore = score; parts = [invSim, amtSim, dateSim]; }
      }
      if (best && bestScore >= s.fuzzy_threshold && parts[1] >= 0.98 && parts[0] >= 0.6) {
        used.add(best.id);
        results.push(res(p, best, 'MATCHED_FUZZY', Math.round(bestScore * 1000) / 1000,
          `AI fuzzy match: invoice similarity ${Math.round(parts[0] * 100)}%, amount ${Math.round(parts[1] * 100)}%, date ${Math.round(parts[2] * 100)}% ('${best.invoice_no}' in 2B)`));
      } else still2.push(p);
    }
    // Pass 3 - GSTIN rescue
    const byInv = new Map();
    gstr2b.filter(b => !used.has(b.id)).forEach(b => { const k = normInv(b.invoice_no); if (!byInv.has(k)) byInv.set(k, []); byInv.get(k).push(b); });
    for (const p of still2) {
      const cands = (byInv.get(normInv(p.invoice_no)) || []).filter(b => !used.has(b.id) &&
        Math.abs(money(b.taxable_value) - money(p.taxable_value)) <= Math.max(tol, money(p.taxable_value) * 0.001));
      let hit = null;
      for (const b of cands) {
        const dist = levenshtein(p.supplier_gstin, b.supplier_gstin);
        if (p.supplier_gstin.slice(2, 12) === b.supplier_gstin.slice(2, 12)) hit = [b, 'Same PAN - invoice reported under another GSTIN of the supplier', 0.85];
        else if (dist <= 2) hit = [b, `GSTIN in books differs from 2B by ${dist} character(s) - probable data-entry error; 2B has ${b.supplier_gstin}`, 0.9];
        if (hit) break;
      }
      if (hit) { used.add(hit[0].id); results.push(res(p, hit[0], 'GSTIN_MISMATCH', hit[2], hit[1])); }
      else {
        const v = vend[p.vendor_id] || {};
        let why = 'Supplier has not reported this invoice in GSTR-1/IFF';
        if (v.status === 'Cancelled') why += `; supplier registration cancelled on ${v.cancel_date}`;
        else if (v.id && Number(v.gstr1_rate ?? 1) < 0.7) why += `; chronic late filer (GSTR-1 on time ${Math.round(Number(v.gstr1_rate) * 100)}%)`;
        results.push(res(p, null, 'MISSING_IN_2B', 1, why));
      }
    }
    for (const b of gstr2b) if (!used.has(b.id)) results.push(res(null, b, 'MISSING_IN_BOOKS', 1, 'Present in GSTR-2B but not booked - verify and account (or reject in IMS)'));
    return results;
  }
  function reconSummary(results) {
    const out = {};
    for (const r of results) { const o = out[r.status] = out[r.status] || { count: 0, books_tax: 0, b2b_tax: 0 }; o.count++; o.books_tax = money(o.books_tax + r.books_tax); o.b2b_tax = money(o.b2b_tax + r.b2b_tax); }
    return out;
  }

  // =====================================================================
  // ITC eligibility
  // =====================================================================
  const GST2 = d('2025-09-22');
  const STATUS = {
    TIME_BARRED: [1, 'Time-barred u/s 16(4)'], DUPLICATE: [2, 'Duplicate entry'], BLOCKED: [3, 'Blocked u/s 17(5)'],
    INELIGIBLE: [4, 'Ineligible'], NO_ITC: [5, 'No ITC (no tax / exempt use)'], RCM_UNPAID: [6, 'RCM tax not paid'],
    NOT_IN_2B: [7, 'Not in GSTR-2B'], RESTRICTED: [8, 'Restricted in GSTR-2B'], DEFERRED: [9, 'Deferred'],
    REVERSE_37: [10, 'Reverse - Rule 37 (180 days)'], REVERSE_37A: [11, 'Reverse - Rule 37A'], ELIGIBLE: [12, 'Eligible']
  };

  function ruleCategory(p) {
    const k = KB();
    const usage = p.usage || '';
    if (usage === 'Personal') return ['BLK_PERSONAL', 'usage tagged personal'];
    if (usage === 'CSR') return ['BLK_CSR', 'usage tagged CSR'];
    if (usage === 'Own-Building') return ['BLK_CONSTRUCTION', 'construction of own immovable property'];
    const text = `${p.description || ''} ${p.expense_head || ''}`.toLowerCase();
    const hsn = String(p.hsn_sac || '');
    const hints = Object.entries(k.hsn_hints).sort((a, b) => b[0].length - a[0].length);
    for (const [prefix, label] of hints) if (hsn.startsWith(prefix) && label.startsWith('BLK')) return [label, `HSN/SAC ${hsn} matches ${prefix}`];
    for (const blk of k.blocked_credits) for (const kw of blk.keywords) if (kwMatch(text, kw)) return [blk.code, `keyword '${kw}'`];
    return [null, ''];
  }
  function blockException(code, p, client) {
    const nature = ((client.nature || '') + ' ' + (client.business || '')).toLowerCase();
    if (code === 'BLK_CONSTRUCTION' && p.usage === 'Project-WC') return 'Used for further supply of works contract / construction for customer (not on own account) - exception applies';
    if (code === 'BLK_MOTOR' && ['transport of passengers', 'car dealer', 'driving school', 'vehicle dealer'].some(x => nature.includes(x))) return 'Used for further supply / passenger transport / driving training - exception applies';
    if (code === 'BLK_FOOD' && ['restaurant', 'caterer', 'hotel'].some(x => nature.includes(x))) return 'Used for outward supply of the same category - exception applies';
    return null;
  }

  function evaluate(p, client, recon, vendor, asOn) {
    const k = KB();
    asOn = asOn || d(k.meta.law_as_on);
    const tax = taxOf(p), inv = d(p.invoice_date);
    const flags = [], checks = [], statuses = new Set();
    const flag = (code, severity, ref, msg) => flags.push({ code, severity, ref, msg });
    const check = (ref, ok, msg) => checks.push({ ref, ok, msg });
    const isRcm = p.reverse_charge === 'Y', claimed = p.itc_claimed === 'Y';
    recon = recon || {}; const rstat = recon.status || '';

    if (p.supplier_gstin) {
      const v = validateGSTIN(p.supplier_gstin);
      check('GSTIN', v.valid, v.valid ? 'Supplier GSTIN valid' : 'Invalid GSTIN: ' + v.errors.join('; '));
      if (!v.valid) flag('GSTIN_INVALID', 'high', 'Rule 46', 'Supplier GSTIN fails checksum - correct the vendor master / obtain revised invoice');
    }
    if (vendor && vendor.status === 'Cancelled' && vendor.cancel_date && inv && inv > d(vendor.cancel_date)) {
      statuses.add('INELIGIBLE');
      flag('SUPPLIER_CANCELLED', 'high', 'Sec 16(2)(c)', `Invoice dated after supplier's registration was cancelled (${vendor.cancel_date}) - no ITC`);
    }
    if (tax <= 0) { statuses.add('NO_ITC'); check('Tax', false, p.supplier_type === 'Composition' ? 'Bill of supply from composition supplier' : 'No GST charged (nil/exempt goods)'); }
    if (p.usage === 'Exempt' && tax > 0) { statuses.add('NO_ITC'); flag('EXEMPT_USE', 'medium', 'Sec 17(2)', 'Used exclusively for exempt supplies - ITC not available'); }

    const [code, why] = ruleCategory(p);
    let blockedRef = '';
    if (code) {
      const exc = blockException(code, p, client);
      const meta = k.blocked_credits.find(b => b.code === code);
      if (exc) check(meta ? meta.ref : '17(5)', true, exc);
      else {
        statuses.add('BLOCKED'); blockedRef = meta ? meta.ref : 'Sec 17(5)';
        flag('BLOCKED', 'high', blockedRef, `${meta ? meta.title : 'Blocked credit'} (${why})`);
        if (meta && meta.proposed) flag('PROPOSED_RELAXATION', 'info', '57th GSTC', meta.proposed);
      }
    } else check('Sec 17(5)', true, 'Not a blocked credit');

    if (!p.receipt_date) { statuses.add('DEFERRED'); check('Sec 16(2)(b)', false, 'Goods/services not yet received - defer ITC'); }
    else check('Sec 16(2)(b)', true, `Received on ${p.receipt_date}`);

    if (rstat === 'DUPLICATE_IN_BOOKS') { statuses.add('DUPLICATE'); flag('DUPLICATE', 'high', 'Books', recon.note || 'Duplicate'); }
    else if (rstat === 'NOT_APPLICABLE' || !rstat) { /* not expected in 2B */ }
    else if (rstat === 'MISSING_IN_2B') {
      if (!isRcm) {
        statuses.add('NOT_IN_2B');
        check('Sec 16(2)(aa) / Rule 36(4)', false, 'Invoice not in GSTR-2B - ' + (recon.note || ''));
        if (claimed) flag('EXCESS_CLAIM', 'high', 'Rule 36(4) / Rule 88D', 'ITC claimed though not in GSTR-2B - reverse or expect DRC-01C intimation');
      }
    } else {
      const ims = recon.ims_action || '';
      if (ims === 'Rejected') { statuses.add('NOT_IN_2B'); check('IMS', false, 'Rejected by recipient in IMS - not part of GSTR-2B'); }
      else if (ims === 'Pending') { statuses.add('DEFERRED'); check('IMS', false, 'Kept pending in IMS - will flow to a later GSTR-2B'); }
      else check('Sec 16(2)(aa)', true, `Reflected in GSTR-2B ${recon.return_period} (${recon.label})`);
      if (recon.itc_available === 'N') { statuses.add('RESTRICTED'); flag('ITC_RESTRICTED', 'high', 'Sec 16(2)(ba)', 'ITC shown as not available in GSTR-2B (place-of-supply rule) - report in 4D(2)'); }
      if (rstat === 'MISMATCH_VALUE') flag('VALUE_MISMATCH', 'medium', 'Rule 36(4)', `Tax in books differs from 2B by ${money(recon.tax_diff).toLocaleString('en-IN', { minimumFractionDigits: 2 })} - claim lower of the two`);
      if (['MATCHED_FUZZY', 'GSTIN_MISMATCH', 'MISMATCH_DATE'].includes(rstat)) flag(rstat, 'low', 'Recon', recon.note || '');
      if (recon.supplier_3b_filed === 'N' && inv) {
        const cutoff = new Date(Date.UTC(inv.getUTCFullYear() + (inv.getUTCMonth() >= 3 ? 1 : 0), 8, 30));
        if (asOn > cutoff) { statuses.add('REVERSE_37A'); flag('RULE_37A', 'high', 'Rule 37A', `Supplier has not filed GSTR-3B by ${C.fmtDate(iso(cutoff))}; reverse ITC by 30-11-${cutoff.getUTCFullYear()} and re-avail when supplier files`); }
        else flag('SUPPLIER_3B_PENDING', 'medium', 'Sec 16(2)(c)', `Supplier GSTR-3B pending - Rule 37A reversal if not filed by ${C.fmtDate(iso(cutoff))}`);
      }
    }

    if (isRcm) {
      if (p.rcm_paid_date) check('Sec 49(4)', true, `RCM tax paid in cash on ${p.rcm_paid_date}`);
      else { statuses.add('RCM_UNPAID'); flag('RCM_UNPAID', 'high', 'Sec 9(3)/49(4)', 'RCM liability not yet paid in cash - pay with interest; ITC available only after payment'); }
      if (['Unregistered', 'Foreign'].includes(p.supplier_type) && !p.self_invoice_no) flag('SELF_INVOICE', 'medium', 'Sec 31(3)(f) / Rule 47A', 'Self-invoice not issued (due within 30 days of receipt)');
    } else if (p.supplier_type === 'Unregistered' && tax <= 0) flag('RCM_CHECK', 'low', 'Sec 9(4)', 'Purchase from unregistered person - check RCM applicability');

    if (!isRcm && tax > 0 && inv) {
      const pay = d(p.payment_date), age = daysBetween(inv, asOn);
      if (!pay && age > 180) { statuses.add('REVERSE_37'); flag('RULE_37', 'high', 'Rule 37', `Supplier unpaid for ${age} days - reverse ITC with interest; re-avail on payment`); }
      else if (pay && daysBetween(inv, pay) > 180) flag('RULE_37_LATE', 'medium', 'Rule 37', `Paid after ${daysBetween(inv, pay)} days - reversal and re-availment with interest required for the gap`);
      else check('Rule 37', true, pay ? 'Payment within 180 days' : `Unpaid, ${age} days old`);
    }

    if (inv) {
      const deadline = sec16_4Deadline(inv), lcp = lastClaimPeriod(inv);
      if (claimed && p.claim_period && p.claim_period > lcp) { statuses.add('TIME_BARRED'); flag('TIME_BARRED', 'high', 'Sec 16(4)', `Claimed in ${p.claim_period} return - after the 30-11-${deadline.getUTCFullYear()} limit`); }
      else if (!claimed && asOn > deadline && tax > 0) { statuses.add('TIME_BARRED'); flag('TIME_BARRED', 'high', 'Sec 16(4)', `Not claimed by ${C.fmtDate(iso(deadline))} - ITC lapsed (report in 4D(2))`); }
      else if (!claimed && tax > 0) {
        const left = daysBetween(asOn, deadline);
        check('Sec 16(4)', true, `Claim by GSTR-3B for ${lcp} (deadline ${C.fmtDate(iso(deadline))}, ${left} days left)`);
        if (left <= 45) flag('DEADLINE_NEAR', 'high', 'Sec 16(4)', `Only ${left} days left to claim ITC of FY ${fyLabel(inv)} (last return: ${lcp})`);
      } else check('Sec 16(4)', true, `Claimed within time limit (${fyLabel(inv)} limit 30-11-${deadline.getUTCFullYear()})`);
    }

    const rate = money(p.rate);
    const valid = inv && inv >= GST2 ? k.rates.post_gst2 : k.rates.pre_gst2;
    if (tax > 0 && !valid.includes(rate)) flag('RATE_INVALID', 'medium', 'GST 2.0', `${rate}% is not a valid slab for invoices dated on/after 22-09-2025 - verify classification / seek credit note`);
    const exp = money(p.taxable_value) * rate / 100;
    if (tax > 0 && Math.abs(exp - (tax - money(p.cess))) > Math.max(1, exp * 0.005)) flag('TAX_ARITH', 'medium', 'Rule 46', `Tax ${tax.toFixed(2)} does not equal ${rate}% of taxable value (${exp.toFixed(2)})`);

    const sup = p.supplier_state, pos = p.pos;
    if (!isRcm && sup && pos && !['96', '97'].includes(sup) && tax > 0) {
      if (sup === pos && money(p.igst) > 0) flag('WRONG_HEAD', 'medium', 'Sec 8 IGST / Sec 77', 'IGST charged on an intra-State supply - wrong tax head');
      if (sup !== pos && (money(p.cgst) > 0 || money(p.sgst) > 0)) flag('WRONG_HEAD', 'medium', 'Sec 7 IGST / Sec 77', 'CGST+SGST charged on an inter-State supply - wrong tax head');
    }
    if (p.usage === 'Common') flag('COMMON_CREDIT', 'info', 'Rule 42 / 43', 'Common credit - apportion between taxable and exempt supplies');

    let status = 'ELIGIBLE';
    if (statuses.size) status = [...statuses].sort((a, b) => STATUS[a][0] - STATUS[b][0])[0];
    const elig = status === 'ELIGIBLE' ? tax : 0;
    const out = {
      id: p.id, client_id: p.client_id, status, status_label: STATUS[status][1], tax, eligible_itc: money(elig),
      blocked_itc: money(status === 'BLOCKED' ? tax : 0),
      at_risk_itc: money(['NOT_IN_2B', 'REVERSE_37', 'REVERSE_37A', 'RESTRICTED', 'DUPLICATE', 'INELIGIBLE'].includes(status) ? tax : 0),
      deferred_itc: money(['DEFERRED', 'RCM_UNPAID'].includes(status) ? tax : 0), lapsed_itc: money(status === 'TIME_BARRED' ? tax : 0),
      claimed, claim_period: p.claim_period || '', rule_category: code || '', blocked_ref: blockedRef, flags, checks, recon_status: rstat,
      period: inv ? periodOf(inv) : ''
    };
    out.wrongly_claimed = money(claimed && status !== 'ELIGIBLE' ? tax : 0);
    return out;
  }
  function itcTotals(evals) {
    const keys = ['tax', 'eligible_itc', 'blocked_itc', 'at_risk_itc', 'deferred_itc', 'lapsed_itc', 'wrongly_claimed'];
    const t = {}; keys.forEach(k => t[k] = money(evals.reduce((a, e) => a + e[k], 0)));
    t.count = evals.length; t.by_status = {};
    evals.forEach(e => { const s = t.by_status[e.status] = t.by_status[e.status] || { count: 0, tax: 0 }; s.count++; s.tax = money(s.tax + e.tax); });
    return t;
  }

  // =====================================================================
  // RCM
  // =====================================================================
  const catalog = () => KB().rcm_catalog;
  function rcmDetermine(entryId, answers, value, interState) {
    const entry = catalog().find(e => e.id === entryId);
    if (!entry) throw new Error('Unknown RCM entry ' + entryId);
    const trail = [];
    for (const q of entry.questions) {
      const a = answers[q.id];
      if (a == null) return { entry, complete: false, next_question: q, trail };
      const ok = q.rcm_values.includes(a);
      trail.push({ q: q.text, a, keeps_rcm: ok });
      if (!ok) return { entry, complete: true, rcm: false, reason: q.fail, trail, tax: null };
    }
    const rate = entry.rate; value = money(value);
    const tax = money(value * rate / 100);
    const split = (interState || entry.id === 'RCM_IMPORT_SERVICE') ? { igst: tax, cgst: 0, sgst: 0 } : { igst: 0, cgst: money(tax / 2), sgst: money(tax - money(tax / 2)) };
    return Object.assign({
      entry, complete: true, rcm: true, trail, rate, value, tax,
      reason: `RCM applies under ${entry.notification} ${entry.entry}: recipient pays ${rate}% in cash.`,
      itc: entry.itc_recipient ? 'ITC of tax paid available in the same return (subject to Sec 17(5))' : 'No ITC (concessional scheme)',
      gstr3b: 'Table 3.1(d) liability; ITC in ' + (entry.id === 'RCM_IMPORT_SERVICE' ? '4A(2)' : '4A(3)')
    }, split);
  }
  function timeOfSupply(p) {
    const inv = d(p.invoice_date), pay = d(p.payment_date), rec = d(p.receipt_date);
    const entry = catalog().find(e => e.id === p.rcm_type);
    const goods = !!(entry && entry.kind === 'goods');
    const cands = [];
    if (goods) {
      if (rec) cands.push([rec, 'date of receipt of goods - Sec 12(3)(a)']);
      if (pay) cands.push([pay, 'date of payment - Sec 12(3)(b)']);
      cands.push([addDays(inv, 30), '31st day from supplier invoice - Sec 12(3)(c)']);
    } else {
      if (pay) cands.push([pay, 'date of payment - Sec 13(3)(a)']);
      cands.push([addDays(inv, 60), '61st day from supplier invoice - Sec 13(3)(b)']);
    }
    let best = cands[0]; for (const c of cands) if (c[0] < best[0]) best = c;
    return best;
  }
  const interest = (amount, from, to, rate = 18) => { const days = Math.max(0, daysBetween(from, to)); return [money(money(amount) * rate / 100 * days / 365), days]; };
  function rcmRegister(purchases, asOn, clientId) {
    asOn = asOn || d(KB().meta.law_as_on);
    const cat = {}; catalog().forEach(e => cat[e.id] = e);
    const rows = [];
    for (const p of purchases) {
      if (p.reverse_charge !== 'Y' || (clientId && p.client_id !== clientId)) continue;
      const [tos, basis] = timeOfSupply(p);
      const lp = periodOf(tos), due = dueDate3B(lp), paid = d(p.rcm_paid_date), tax = taxOf(p);
      let [ia, days] = [0, 0];
      if (paid && paid > due) [ia, days] = interest(tax, due, paid);
      else if (!paid && asOn > due) [ia, days] = interest(tax, due, asOn);
      const e = cat[p.rcm_type] || {};
      const siDue = addDays(d(p.receipt_date) || d(p.invoice_date), 30);
      const status = paid && paid <= due ? 'Paid on time' : paid ? 'Paid late' : (asOn > due ? 'Overdue' : 'Due');
      rows.push({
        id: p.id, client_id: p.client_id, supplier_name: p.supplier_name, supplier_type: p.supplier_type, rcm_type: p.rcm_type,
        rcm_title: e.title || p.rcm_type, notification: e.notification || '', invoice_no: p.invoice_no, invoice_date: p.invoice_date,
        taxable_value: money(p.taxable_value), rate: money(p.rate), igst: money(p.igst), cgst: money(p.cgst), sgst: money(p.sgst), tax,
        tos: iso(tos), tos_basis: basis, liability_period: lp, due_date: iso(due), paid_date: p.rcm_paid_date || '', status, delay_days: days,
        interest: ia, self_invoice_no: p.self_invoice_no || '', self_invoice_required: ['Unregistered', 'Foreign'].includes(p.supplier_type),
        self_invoice_due: iso(siDue), table: p.rcm_type === 'RCM_IMPORT_SERVICE' ? '4A(2)' : '4A(3)'
      });
    }
    return rows;
  }

  // =====================================================================
  // Returns: Rule 42 / 43, GSTR-3B, DRC-01C, set-off
  // =====================================================================
  const HEADS = ['igst', 'cgst', 'sgst', 'cess'];
  const Z = () => ({ igst: 0, cgst: 0, sgst: 0, cess: 0 });
  const add = (acc, r, sign = 1) => HEADS.forEach(h => acc[h] = money(acc[h] + sign * money(r[h])));
  const hsum = (acc) => money(HEADS.reduce((a, h) => a + acc[h], 0));
  function turnover(sale) {
    if (!sale) return { E: 0, F: 0 };
    const E = money(sale.exempt) + money(sale.nil_rated) + money(sale.non_gst);
    return { E, F: money(sale.taxable_intra) + money(sale.taxable_inter) + money(sale.zero_rated) + E };
  }
  function rule42(data, clientId, period, nonBusinessCommon) {
    const client = data.clients.find(c => c.id === clientId);
    const sale = data.sales.find(s => s.client_id === clientId && s.period === period);
    let T = 0, T1 = 0, T2 = 0, T3 = 0, T4 = 0, C2 = 0; const items = [];
    for (const p of data.purchases) {
      if (p.client_id !== clientId || p.category === 'Capital Goods' || !String(p.invoice_date).startsWith(period)) continue;
      const t = taxOf(p); if (t <= 0) continue;
      T += t;
      const [code] = ruleCategory(p); const blocked = code && !blockException(code, p, client);
      let bucket;
      if (p.usage === 'Personal') { T1 += t; bucket = 'T1'; } else if (p.usage === 'Exempt') { T2 += t; bucket = 'T2'; }
      else if (blocked) { T3 += t; bucket = 'T3'; } else if (p.usage === 'Common') { C2 += t; bucket = 'C2'; } else { T4 += t; bucket = 'T4'; }
      items.push({ id: p.id, supplier_name: p.supplier_name, description: p.description, tax: t, bucket });
    }
    const { E, F } = turnover(sale);
    const C1 = T - (T1 + T2 + T3);
    const D1 = F ? money(C2 * E / F) : 0, D2 = nonBusinessCommon ? money(C2 * 0.05) : 0, C3 = money(C2 - D1 - D2);
    return { period, T: money(T), T1: money(T1), T2: money(T2), T3: money(T3), C1: money(C1), T4: money(T4), C2: money(C2), E: money(E), F: money(F),
      ratio: F ? Math.round(E / F * 1e6) / 1e6 : 0, D1, D2, C3, reversal: money(D1 + D2), eligible_total: money(T4 + C3), items };
  }
  function rule43(data, clientId, period) {
    const sale = data.sales.find(s => s.client_id === clientId && s.period === period);
    const { E, F } = turnover(sale);
    const items = []; let Tm = 0, Te = 0;
    for (const p of data.purchases) {
      if (p.client_id !== clientId || p.category !== 'Capital Goods' || p.usage !== 'Common') continue;
      const acq = String(p.invoice_date).slice(0, 7); if (acq > period) continue;
      const used = (+period.slice(0, 4) - +acq.slice(0, 4)) * 12 + (+period.slice(5) - +acq.slice(5)); if (used >= 60) continue;
      const A = taxOf(p), tm = money(A / 60), te = F ? money(tm * E / F) : 0;
      Tm += tm; Te += te;
      items.push({ id: p.id, description: p.description, acquired: acq, itc: A, Tm: tm, Te: te, months_remaining: 60 - used });
    }
    return { period, E, F, ratio: F ? Math.round(E / F * 1e6) / 1e6 : 0, items, Tm: money(Tm), Te: money(Te) };
  }
  function rcmItcPeriod(r) {
    if (!r.paid_date) return null;
    const pd = d(r.paid_date);
    const q = pd.getUTCDate() <= 20 ? addMonths(periodOf(pd), -1) : periodOf(pd);
    return r.liability_period > q ? r.liability_period : q;
  }
  function drc01c(claimed, available) {
    const k = KB().dates;
    const excess = money(claimed - available);
    const pct = available ? excess / available * 100 : (excess > 0 ? 100 : 0);
    return { claimed, available, excess, excess_pct: Math.round(pct * 100) / 100, risk: excess > k.drc01c_amount && pct > k.drc01c_percent, threshold_amount: k.drc01c_amount, threshold_pct: k.drc01c_percent };
  }
  function gstr3b(data, clientId, period, evals, recon, asOn, opts) {
    asOn = asOn || d(KB().meta.law_as_on);
    opts = opts || {};
    const ev = {}; evals.forEach(e => ev[e.id] = e);
    const sale = data.sales.find(s => s.client_id === clientId && s.period === period);
    const t = {};
    t['3.1(a)'] = { value: sale ? money(sale.taxable_intra) + money(sale.taxable_inter) : 0, igst: sale ? money(sale.out_igst) : 0, cgst: sale ? money(sale.out_cgst) : 0, sgst: sale ? money(sale.out_sgst) : 0, cess: 0 };
    t['3.1(b)'] = Object.assign({ value: sale ? money(sale.zero_rated) : 0 }, Z());
    t['3.1(c)'] = Object.assign({ value: sale ? money(sale.exempt) + money(sale.nil_rated) : 0 }, Z());
    t['3.1(e)'] = Object.assign({ value: sale ? money(sale.non_gst) : 0 }, Z());
    const rcm = rcmRegister(data.purchases, asOn, clientId);
    const d31 = Object.assign({ value: 0 }, Z());
    rcm.forEach(r => { if (r.liability_period === period) { d31.value = money(d31.value + r.taxable_value); add(d31, r); } });
    t['3.1(d)'] = d31;
    const a2 = Z(), a3 = Z(), a5 = Z(), b1 = Z(), b2 = Z(), d1 = Z(), d2 = Z();
    const detail = { '3.1(d)': rcm.filter(r => r.liability_period === period).map(r => r.id), '4A(2)': [], '4A(3)': [], '4A(5)': [], '4B(1)': [], '4B(2)': [], '4D(1)': [], '4D(2)': [] };
    for (const r of rcm) {
      if (rcmItcPeriod(r) !== period) continue;
      add(r.table === '4A(2)' ? a2 : a3, r); detail[r.table].push(r.id);
      const e = ev[r.id]; if (e && e.status === 'BLOCKED') { add(b1, r); detail['4B(1)'].push(r.id); }
    }
    const rmapB = {}; recon.forEach(x => { if (x.b2b_id) rmapB[x.b2b_id] = x; });
    for (const b of data.gstr2b) {
      if (b.client_id !== clientId || b.return_period !== period || b.reverse_charge === 'Y') continue;
      if (['Rejected', 'Pending'].includes(b.ims_action)) continue;
      if (b.itc_available === 'N') { add(d2, b); detail['4D(2)'].push(b.id); continue; }
      add(a5, b); detail['4A(5)'].push(b.id);
      const rr = rmapB[b.id];
      if (!rr || rr.status === 'MISSING_IN_BOOKS' || !rr.pr_id) { add(b2, b); detail['4B(2)'].push(b.id); continue; }
      const e = ev[rr.pr_id]; if (!e) continue;
      if (['BLOCKED', 'NO_ITC'].includes(e.status)) { add(b1, b); detail['4B(1)'].push(b.id); }
      else if (e.status === 'TIME_BARRED') { add(b1, b); add(d2, b); detail['4D(2)'].push(b.id); }
      else if (['DEFERRED', 'INELIGIBLE', 'DUPLICATE'].includes(e.status)) { add(b2, b); detail['4B(2)'].push(b.id); }
    }
    for (const p of data.purchases) {
      if (p.client_id !== clientId || p.reverse_charge === 'Y' || taxOf(p) <= 0 || p.itc_claimed !== 'Y') continue;
      const inv = d(p.invoice_date), pay = d(p.payment_date), lapse = addDays(inv, 181);
      if (periodOf(lapse) === period && (!pay || pay > lapse) && lapse <= addDays(asOn, 31)) { add(b2, p); detail['4B(2)'].push(p.id); }
      if (pay && daysBetween(inv, pay) > 180 && periodOf(pay) === period) { add(d1, p); detail['4D(1)'].push(p.id); }
      const e = ev[p.id];
      if (e && e.flags.some(f => f.code === 'RULE_37A')) {
        const fyEnd = inv.getUTCFullYear() + (inv.getUTCMonth() >= 3 ? 1 : 0);
        if (period === `${fyEnd}-10`) { add(b2, p); detail['4B(2)'].push(p.id); }
      }
    }
    const r42 = rule42(data, clientId, period, opts.nonBusinessCommon), r43 = rule43(data, clientId, period);
    const rev = money(r42.reversal + r43.Te);
    if (rev) { const base = hsum(a5) || 1; ['igst', 'cgst', 'sgst'].forEach(h => b1[h] = money(b1[h] + rev * (a5[h] / base))); }
    const A = Z(); [a2, a3, a5].forEach(x => HEADS.forEach(h => A[h] = money(A[h] + x[h]))); HEADS.forEach(h => A[h] = money(A[h] + d1[h]));
    const B = {}, Cc = {}; HEADS.forEach(h => { B[h] = money(b1[h] + b2[h]); Cc[h] = money(A[h] - B[h]); });
    const a5r = {}; HEADS.forEach(h => a5r[h] = money(a5[h] + d1[h]));
    Object.assign(t, { '4A(1)': Z(), '4A(2)': a2, '4A(3)': a3, '4A(4)': Z(), '4A(5)': a5r, '4B(1)': b1, '4B(2)': b2, '4C': Cc, '4D(1)': d1, '4D(2)': d2 });
    const claimed = Z();
    data.purchases.forEach(p => { if (p.client_id === clientId && p.itc_claimed === 'Y' && p.claim_period === period) add(claimed, p); });
    const drc = drc01c(hsum(claimed), hsum(a5) + hsum(a2) + hsum(a3));
    return { client_id: clientId, period, tables: t, detail, rule42: r42, rule43: r43, rule42_43_reversal: rev, net_itc: hsum(Cc),
      itc_claimed_in_books: claimed, itc_claimed_total: hsum(claimed), difference: money(hsum(claimed) - hsum(Cc)), drc01c: drc, due_date: `${addMonths(period, 1)}-20` };
  }
  function setoff(liability, credit, rcmCash, taxableValue) {
    const L = {}, Cr = {}; ['igst', 'cgst', 'sgst'].forEach(h => { L[h] = money(liability[h]); Cr[h] = Math.max(0, money(credit[h])); });
    const use = {}; ['igst', 'cgst', 'sgst'].forEach(a => ['igst', 'cgst', 'sgst'].forEach(b => use[`${a}->${b}`] = 0));
    const steps = [];
    ['igst', 'cgst', 'sgst'].forEach(h => { if (money(credit[h]) < 0) { L[h] = money(L[h] - money(credit[h])); steps.push({ from: 'REVERSAL', to: h.toUpperCase(), amount: money(-money(credit[h])), rule: 'Net ITC negative (reversal > credit) - added to output tax liability' }); } });
    const apply = (src, dst, amt, why) => {
      amt = money(Math.min(amt, Cr[src], L[dst]));
      if (amt > 0) { Cr[src] = money(Cr[src] - amt); L[dst] = money(L[dst] - amt); use[`${src}->${dst}`] = money(use[`${src}->${dst}`] + amt); steps.push({ from: src.toUpperCase(), to: dst.toUpperCase(), amount: amt, rule: why }); }
    };
    apply('igst', 'igst', L.igst, 'Sec 49(5)(a): IGST credit first against IGST');
    const needC = Math.max(0, L.cgst - Cr.cgst), needS = Math.max(0, L.sgst - Cr.sgst);
    apply('igst', 'cgst', needC, 'Rule 88A: balance IGST credit against CGST (shortfall first)');
    apply('igst', 'sgst', needS, 'Rule 88A: balance IGST credit against SGST (shortfall first)');
    apply('igst', 'cgst', L.cgst, 'Sec 49A: IGST credit must be exhausted before CGST/SGST credit');
    apply('igst', 'sgst', L.sgst, 'Sec 49A: IGST credit must be exhausted before CGST/SGST credit');
    apply('cgst', 'cgst', L.cgst, 'Sec 49(5)(b): CGST credit against CGST');
    apply('cgst', 'igst', L.igst, 'Sec 49(5)(b): balance CGST credit against IGST');
    apply('sgst', 'sgst', L.sgst, 'Sec 49(5)(c)/(d): SGST credit against SGST');
    apply('sgst', 'igst', L.igst, 'Sec 49(5)(d): balance SGST credit against IGST');
    const cash = {}; ['igst', 'cgst', 'sgst'].forEach(h => cash[h] = money(L[h]));
    const rc = {}; ['igst', 'cgst', 'sgst'].forEach(h => rc[h] = money((rcmCash || {})[h]));
    const totalLiab = ['igst', 'cgst', 'sgst'].reduce((a, h) => a + money(liability[h]) + Math.max(0, -money(credit[h])), 0);
    const out = { utilisation: use, steps, cash_output: cash, cash_rcm: rc, cash_total: money(C.sum(Object.values(cash)) + C.sum(Object.values(rc))), credit_carried_forward: Cr, rule86b: null };
    if (taxableValue > KB().dates.rule86b_turnover && totalLiab > 0) {
      const minCash = money(totalLiab * 0.01), paid = money(C.sum(Object.values(cash)));
      out.rule86b = { applicable: true, min_cash: minCash, cash_paid: paid, shortfall: money(Math.max(0, minCash - paid)), note: 'Taxable value > ₹50 lakh in the month: at least 1% of output tax in cash unless an exception in Rule 86B proviso applies.' };
    }
    return out;
  }

  // =====================================================================
  // Orchestration with cache
  // =====================================================================
  function analyse(DB, clientId, asOn) {
    const P = DB.purchases.filter(p => p.client_id === clientId);
    const B = DB.gstr2b.filter(b => b.client_id === clientId);
    const V = DB.vendors.filter(v => v.client_id === clientId);
    const client = DB.clients.find(c => c.id === clientId);
    const recon = reconcile(P, B, V, DB.settings);
    const reconByPr = {}, reconByB = {}; recon.forEach(r => { if (r.pr_id) reconByPr[r.pr_id] = r; if (r.b2b_id) reconByB[r.b2b_id] = r; });
    const vmap = {}; V.forEach(v => vmap[v.id] = v);
    const evals = P.map(p => evaluate(p, client, reconByPr[p.id], vmap[p.vendor_id], asOn));
    const evalMap = {}; evals.forEach(e => evalMap[e.id] = e);
    const rcm = rcmRegister(P, asOn);
    return { client, P, B, V, vmap, recon, reconByPr, reconByB, evals, evalMap, rcm, totals: itcTotals(evals), reconSum: reconSummary(recon) };
  }

  root.GSTEngine = { RECON_LABEL, STATUS, reconcile, reconSummary, ruleCategory, blockException, evaluate, itcTotals, catalog, rcmDetermine,
    timeOfSupply, interest, rcmRegister, rule42, rule43, rcmItcPeriod, drc01c, gstr3b, setoff, analyse, HEADS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GSTEngine;
})(typeof window !== 'undefined' ? window : globalThis);
