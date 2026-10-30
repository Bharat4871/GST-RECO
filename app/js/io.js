/* GSTiQ import / export: CSV, Excel (SheetJS), JSON, GST-portal GSTR-2B JSON, smart column mapping */
(function (root) {
  'use strict';
  const C = root.GSTCore;

  // ---------------- schemas (field, label, type, required, aliases for smart mapping)
  const SCHEMAS = {
    purchases: { label: 'Purchase register', key: 'id', fields: [
      ['id', 'Entry ID', 's', 0, ['entry id', 'voucher no', 'sr no', 'ref']], ['client_id', 'Client ID', 's', 0, ['client']],
      ['vendor_id', 'Vendor ID', 's', 0, ['vendor code', 'party code']], ['supplier_gstin', 'Supplier GSTIN', 's', 0, ['gstin', 'gstin of supplier', 'party gstin', 'ctin', 'gst no']],
      ['supplier_name', 'Supplier name', 's', 1, ['supplier', 'party name', 'vendor name', 'trade name', 'name of supplier', 'ledger']],
      ['supplier_type', 'Supplier type', 's', 0, ['registration type', 'type of supplier']], ['supplier_state', 'Supplier state code', 's', 0, ['state code', 'supplier state']],
      ['invoice_no', 'Invoice no', 's', 1, ['invoice number', 'bill no', 'inv no', 'document number', 'supplier invoice no', 'inum']],
      ['invoice_date', 'Invoice date', 'd', 1, ['date', 'bill date', 'inv date', 'document date', 'dt']], ['receipt_date', 'Receipt date', 'd', 0, ['grn date', 'received on', 'date of receipt']],
      ['hsn_sac', 'HSN/SAC', 's', 0, ['hsn', 'sac', 'hsn code']], ['description', 'Description', 's', 0, ['particulars', 'item', 'narration', 'goods description']],
      ['expense_head', 'Expense head', 's', 0, ['ledger head', 'account head', 'gl']], ['category', 'ITC category', 's', 0, ['itc type', 'eligibility type', 'type']],
      ['pos', 'Place of supply', 's', 0, ['pos', 'place of supply code']], ['taxable_value', 'Taxable value', 'n', 1, ['taxable', 'taxable amount', 'assessable value', 'txval', 'value']],
      ['rate', 'GST rate %', 'n', 0, ['rate', 'tax rate', 'gst %']], ['igst', 'IGST', 'n', 0, ['integrated tax', 'igst amount']], ['cgst', 'CGST', 'n', 0, ['central tax', 'cgst amount']],
      ['sgst', 'SGST/UTGST', 'n', 0, ['state tax', 'sgst amount', 'utgst']], ['cess', 'Cess', 'n', 0, ['cess amount']], ['invoice_value', 'Invoice value', 'n', 0, ['total', 'invoice amount', 'gross amount', 'val']],
      ['reverse_charge', 'Reverse charge (Y/N)', 'yn', 0, ['rcm', 'reverse charge', 'rev']], ['rcm_type', 'RCM type', 's', 0, []], ['rcm_paid_date', 'RCM paid date', 'd', 0, ['rcm payment date']],
      ['self_invoice_no', 'Self-invoice no', 's', 0, []], ['itc_claimed', 'ITC claimed (Y/N)', 'yn', 0, ['claimed', 'itc availed']], ['claim_period', 'Claim period (yyyy-mm)', 's', 0, ['claimed in', 'return period']],
      ['payment_date', 'Payment date', 'd', 0, ['paid on', 'date of payment']], ['amount_paid', 'Amount paid', 'n', 0, ['paid amount']], ['usage', 'Usage', 's', 0, ['use', 'used for']],
      ['irn', 'IRN', 's', 0, ['e-invoice irn']], ['remarks', 'Remarks', 's', 0, ['notes', 'comment']]] },
    gstr2b: { label: 'GSTR-2B', key: 'id', fields: [
      ['id', 'ID', 's', 0, []], ['client_id', 'Client ID', 's', 0, ['client']], ['return_period', 'Return period (yyyy-mm)', 's', 1, ['period', 'rtnprd', 'tax period']],
      ['supplier_gstin', 'Supplier GSTIN', 's', 1, ['gstin of supplier', 'ctin', 'gstin']], ['supplier_name', 'Supplier name', 's', 0, ['trade/legal name', 'trdnm', 'trade name']],
      ['invoice_no', 'Invoice no', 's', 1, ['invoice number', 'inum', 'document number']], ['invoice_date', 'Invoice date', 'd', 1, ['invoice date', 'dt', 'document date']],
      ['invoice_type', 'Invoice type', 's', 0, ['typ']], ['pos', 'Place of supply', 's', 0, []], ['taxable_value', 'Taxable value', 'n', 1, ['txval', 'taxable value (₹)']],
      ['rate', 'Rate', 'n', 0, []], ['igst', 'IGST', 'n', 0, ['integrated tax']], ['cgst', 'CGST', 'n', 0, ['central tax']], ['sgst', 'SGST', 'n', 0, ['state/ut tax', 'state tax']],
      ['cess', 'Cess', 'n', 0, []], ['invoice_value', 'Invoice value', 'n', 0, ['val']], ['reverse_charge', 'Reverse charge', 'yn', 0, ['rev', 'supply attract reverse charge']],
      ['itc_available', 'ITC available', 'yn', 0, ['itcavl', 'itc availability']], ['reason', 'Reason', 's', 0, ['rsn']], ['gstr1_filing_date', 'GSTR-1 filing date', 'd', 0, ['supfildt']],
      ['supplier_3b_filed', 'Supplier 3B filed', 'yn', 0, []], ['ims_action', 'IMS action', 's', 0, ['ims status', 'imsstatus', 'action']], ['source', 'Source', 's', 0, ['srctyp']], ['irn', 'IRN', 's', 0, []]] },
    vendors: { label: 'Vendor master', key: 'id', fields: [
      ['id', 'Vendor ID', 's', 0, ['code']], ['client_id', 'Client ID', 's', 0, []], ['name', 'Vendor name', 's', 1, ['supplier name', 'party name']], ['gstin', 'GSTIN', 's', 0, []],
      ['state', 'State code', 's', 0, []], ['type', 'Type', 's', 0, ['registration type']], ['status', 'Status', 's', 0, []], ['reg_date', 'Registration date', 'd', 0, []],
      ['cancel_date', 'Cancellation date', 'd', 0, []], ['gstr1_rate', 'GSTR-1 on-time share', 'n', 0, []], ['gstr3b_rate', 'GSTR-3B on-time share', 'n', 0, []],
      ['avg_delay', 'Average delay (days)', 'n', 0, []], ['email', 'Email', 's', 0, []], ['phone', 'Phone', 's', 0, ['mobile']]] },
    clients: { label: 'Client master', key: 'id', fields: [
      ['id', 'Client ID', 's', 1, []], ['name', 'Client name', 's', 1, ['legal name']], ['gstin', 'GSTIN', 's', 1, []], ['pan', 'PAN', 's', 0, []], ['state', 'State code', 's', 0, []],
      ['city', 'City', 's', 0, []], ['constitution', 'Constitution', 's', 0, []], ['business', 'Business', 's', 0, []], ['nature', 'Nature', 's', 0, []],
      ['turnover_cr', 'Turnover (₹ Cr)', 'n', 0, []], ['filing', 'Filing frequency', 's', 0, []], ['partner', 'Partner in charge', 's', 0, []], ['email', 'Email', 's', 0, []],
      ['has_exempt', 'Has exempt supplies', 'b', 0, []]] },
    sales: { label: 'Outward supplies summary', key: null, fields: [
      ['client_id', 'Client ID', 's', 1, []], ['period', 'Period (yyyy-mm)', 's', 1, []], ['taxable_intra', 'Taxable intra-State', 'n', 0, []], ['taxable_inter', 'Taxable inter-State', 'n', 0, []],
      ['zero_rated', 'Zero-rated', 'n', 0, ['exports']], ['exempt', 'Exempt', 'n', 0, []], ['nil_rated', 'Nil-rated', 'n', 0, []], ['non_gst', 'Non-GST', 'n', 0, []],
      ['output_rate', 'Output rate', 'n', 0, []], ['out_igst', 'Output IGST', 'n', 0, []], ['out_cgst', 'Output CGST', 'n', 0, []], ['out_sgst', 'Output SGST', 'n', 0, []]] }
  };

  // ---------------- CSV
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    text = String(text).replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const nonEmpty = rows.filter(r => r.some(c => String(c).trim() !== ''));
    if (!nonEmpty.length) return { headers: [], rows: [] };
    const headers = nonEmpty[0].map(h => String(h).trim());
    return { headers, rows: nonEmpty.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))) };
  }
  function toCSV(rows, cols) {
    cols = cols || (rows[0] ? Object.keys(rows[0]) : []);
    const q = (v) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\r\n');
  }

  // ---------------- Excel via SheetJS
  const hasXLSX = () => typeof root.XLSX !== 'undefined';
  function readWorkbook(buf) {
    const wb = root.XLSX.read(buf, { type: 'array', cellDates: false });
    return wb.SheetNames.map(name => {
      const rows = root.XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: false });
      return { name, headers: rows.length ? Object.keys(rows[0]) : [], rows };
    });
  }
  function workbookBlob(sheets) { // sheets: [{name, rows, cols?}]
    const wb = root.XLSX.utils.book_new();
    for (const s of sheets) {
      const ws = root.XLSX.utils.json_to_sheet(s.rows, { header: s.cols });
      const cols = s.cols || (s.rows[0] ? Object.keys(s.rows[0]) : []);
      ws['!cols'] = cols.map(c => ({ wch: Math.min(40, Math.max(10, String(c).length + 2)) }));
      root.XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
    }
    const out = root.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  // ---------------- GST portal GSTR-2B JSON -> rows
  function parsePortal2B(obj, clientId) {
    const data = obj.data || obj;
    const rp = String(data.rtnprd || ''); // mmyyyy
    const period = rp.length === 6 ? `${rp.slice(2)}-${rp.slice(0, 2)}` : '';
    const b2b = (data.docdata && data.docdata.b2b) || [];
    const rows = [];
    for (const sup of b2b) for (const inv of (sup.inv || [])) {
      rows.push({ client_id: clientId, return_period: period, supplier_gstin: sup.ctin, supplier_name: sup.trdnm || '', invoice_no: inv.inum,
        invoice_date: C.iso(C.d(inv.dt)), invoice_type: inv.typ || 'R', pos: inv.pos || '', taxable_value: +inv.txval || 0, rate: '',
        igst: +inv.igst || 0, cgst: +inv.cgst || 0, sgst: +inv.sgst || 0, cess: +inv.cess || 0, invoice_value: +inv.val || 0,
        reverse_charge: inv.rev || 'N', itc_available: inv.itcavl || 'Y', reason: inv.rsn || '', gstr1_filing_date: C.iso(C.d(sup.supfildt)),
        supplier_3b_filed: 'Y', ims_action: inv.imsStatus || 'No Action', source: inv.srctyp || 'GSTR-1', irn: inv.irn || '' });
    }
    return { period, gstin: data.gstin, rows };
  }
  function toPortal2B(rows, gstin, period) {
    const by = {};
    rows.filter(b => b.ims_action !== 'Rejected').forEach(b => {
      const s = by[b.supplier_gstin] = by[b.supplier_gstin] || { ctin: b.supplier_gstin, trdnm: b.supplier_name, supfildt: C.fmtDate(b.gstr1_filing_date), inv: [] };
      const dt = C.d(b.invoice_date);
      s.inv.push({ inum: b.invoice_no, typ: 'R', dt: `${String(dt.getUTCDate()).padStart(2, '0')}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${dt.getUTCFullYear()}`,
        val: b.invoice_value, pos: b.pos, rev: b.reverse_charge, itcavl: b.itc_available, rsn: b.reason, txval: b.taxable_value, igst: b.igst, cgst: b.cgst, sgst: b.sgst, cess: b.cess, imsStatus: b.ims_action });
    });
    return { data: { gstin, rtnprd: period.slice(5) + period.slice(0, 4), version: '1.0', docdata: { b2b: Object.values(by) } } };
  }

  // ---------------- smart column mapping (exact -> alias -> fuzzy)
  const canon = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function autoMap(headers, schema) {
    const map = {}, used = new Set();
    for (const [f, label, , , aliases] of schema.fields) {
      const cands = [f, label, ...aliases].map(canon);
      let best = null, bestScore = 0;
      for (const h of headers) {
        if (used.has(h)) continue;
        const ch = canon(h);
        let sc = cands.includes(ch) ? 1 : Math.max(...cands.map(c => C.similarity(c, ch)));
        if (cands.some(c => c.length > 3 && (ch.includes(c) || c.includes(ch)))) sc = Math.max(sc, 0.82);
        if (sc > bestScore) { bestScore = sc; best = h; }
      }
      if (best && bestScore >= 0.78) { map[f] = best; used.add(best); }
    }
    return map;
  }
  function coerce(v, type) {
    if (v == null) return type === 'n' ? 0 : '';
    if (type === 'n') { const n = parseFloat(String(v).replace(/[₹,\s]/g, '')); return isFinite(n) ? n : 0; }
    if (type === 'd') { const x = C.d(v); return x ? C.iso(x) : ''; }
    if (type === 'yn') { const s = String(v).trim().toUpperCase(); return ['Y', 'YES', 'TRUE', '1'].includes(s) ? 'Y' : (s ? 'N' : ''); }
    if (type === 'b') { const s = String(v).trim().toLowerCase(); return ['y', 'yes', 'true', '1'].includes(s); }
    return String(v).trim();
  }
  function applyMap(rows, map, schema) {
    return rows.map(r => { const o = {}; for (const [f, , type] of schema.fields) o[f] = map[f] ? coerce(r[map[f]], type) : (type === 'n' ? 0 : ''); return o; });
  }
  function validateRows(kind, rows) {
    const schema = SCHEMAS[kind], errors = [];
    rows.forEach((r, i) => {
      for (const [f, label, type, req] of schema.fields) if (req && (r[f] === '' || r[f] == null || (type === 'n' && !isFinite(r[f])))) errors.push({ row: i + 1, field: label, msg: 'required' });
      const g = r.supplier_gstin || r.gstin;
      if (g) { const v = C.validateGSTIN(g); if (!v.valid) errors.push({ row: i + 1, field: 'GSTIN', msg: v.errors[0], level: 'warn' }); }
      if (kind === 'purchases' && r.taxable_value && !(r.igst || r.cgst || r.sgst) && r.rate) {
        const t = C.money(r.taxable_value * r.rate / 100);
        if (r.supplier_state && r.pos && r.supplier_state !== r.pos) r.igst = t; else { r.cgst = C.money(t / 2); r.sgst = C.money(t - C.money(t / 2)); }
      }
    });
    return errors;
  }

  // ---------------- saving files (artifact viewer downloads capability -> browser download fallback)
  let dlPromise = null;
  function downloadsCap() {
    if (!dlPromise) {
      dlPromise = (root.claude && typeof root.claude.use === 'function')
        ? Promise.race([root.claude.use('downloads').catch(() => null), new Promise(r => setTimeout(() => r(null), 4000))])
        : Promise.resolve(null);
    }
    return dlPromise;
  }
  async function saveFile(filename, data, mime) {
    const dl = await downloadsCap();
    if (dl) {
      try { await dl.save({ filename, data }); return 'saved'; }
      catch (e) { if (e && e.code === 'declined') return 'declined'; if (e && !['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code)) throw e; }
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    return 'downloaded';
  }
  function readFile(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = () => rej(r.error);
      if (/\.(xlsx|xls|xlsm)$/i.test(file.name)) { r.onload = () => res({ kind: 'xlsx', data: new Uint8Array(r.result) }); r.readAsArrayBuffer(file); }
      else { r.onload = () => res({ kind: /\.json$/i.test(file.name) ? 'json' : 'csv', data: r.result }); r.readAsText(file); }
    });
  }
  function template(kind) { return toCSV([], SCHEMAS[kind].fields.map(f => f[0])); }

  root.GSTIO = { SCHEMAS, parseCSV, toCSV, hasXLSX, readWorkbook, workbookBlob, parsePortal2B, toPortal2B, autoMap, applyMap, coerce, validateRows, saveFile, readFile, template };
})(typeof window !== 'undefined' ? window : globalThis);
