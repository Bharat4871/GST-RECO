/* Builds docs/GSTiQ_Project_Report.docx  (node docs/build_report.js [pages.json]) */
const fs = require('fs'), path = require('path');
const D = require('docx');
const { Tab, TabStopType, TabStopPosition, Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, ImageRun,
  Footer, Header, PageNumber, NumberFormat, LevelFormat, PositionalTab, PositionalTabAlignment, PositionalTabLeader, PositionalTabRelativeTo, VerticalAlign, PageBreak } = D;

const ROOT = path.resolve(__dirname, '..');
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'report_stats.json'), 'utf8'));
const KB = JSON.parse(fs.readFileSync(path.join(ROOT, 'knowledge', 'gst_knowledge.json'), 'utf8'));
const PAGES = process.argv[2] && fs.existsSync(process.argv[2]) ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : {};
const FONT = 'Arial', INK = '1F3A5F', SAFF = 'A96C12', W = 9026;
const inr = (x, dec = 0) => { const n = Math.round(Number(x) * 100) / 100, neg = n < 0; let [a, b] = Math.abs(n).toFixed(dec).split('.'); if (a.length > 3) { const t = a.slice(-3); let h = a.slice(0, -3); const p = []; while (h.length > 2) { p.unshift(h.slice(-2)); h = h.slice(0, -2); } if (h) p.unshift(h); a = p.join(',') + ',' + t; } return (neg ? '-' : '') + 'Rs ' + a + (dec ? '.' + b : ''); };
const lakh = (x) => 'Rs ' + (x / 1e5).toFixed(2) + ' lakh';

// ---------------------------------------------------------------- helpers
function runs(text, base = {}) {
  return String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean).map(p =>
    p.startsWith('**') ? new TextRun({ text: p.slice(2, -2), bold: true, ...base }) :
      p.startsWith('`') ? new TextRun({ text: p.slice(1, -1), font: 'Consolas', size: 18, ...base }) :
        p.startsWith('*') ? new TextRun({ text: p.slice(1, -1), italics: true, ...base }) : new TextRun({ text: p, ...base }));
}
const P = (t, o = {}) => new Paragraph({ children: runs(t, o.run || {}), spacing: { after: 120, line: 300 }, alignment: o.align || AlignmentType.JUSTIFIED, ...(o.p || {}) });
const TOC_ITEMS = [];
let chap = 0, sec = 0, fig = 0, tab = 0;
function H1(t) { chap++; sec = 0; const txt = `Chapter ${chap}: ${t}`; TOC_ITEMS.push([1, txt]); return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(txt)] }); }
function HX(t) { TOC_ITEMS.push([1, t]); return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(t)] }); }
function H2(t) { sec++; const txt = `${chap}.${sec} ${t}`; TOC_ITEMS.push([2, txt]); return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(txt)] }); }
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
let numInst = 0;
const bullets = (items) => items.map(t => new Paragraph({ numbering: { reference: 'bul', level: 0 }, children: runs(t), spacing: { after: 60, line: 280 } }));
const numbered = (items) => { numInst++; return items.map(t => new Paragraph({ numbering: { reference: 'num', level: 0, instance: numInst }, children: runs(t), spacing: { after: 60, line: 280 } })); };
function table(headers, rows, widths, opt = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'C8D0DC' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (t, w, hdr, i, align) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders, verticalAlign: VerticalAlign.CENTER,
    shading: hdr ? { fill: INK, type: ShadingType.CLEAR, color: 'auto' } : (i % 2 ? { fill: 'F3F6FA', type: ShadingType.CLEAR, color: 'auto' } : undefined),
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [new Paragraph({ alignment: align || AlignmentType.LEFT, children: runs(String(t), { size: opt.size || 17, color: hdr ? 'FFFFFF' : '1A1A1A', bold: hdr || undefined }) })]
  });
  const out = [new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows: [
    new TableRow({ tableHeader: true, children: headers.map((h, j) => cell(h, widths[j], true, 0)) }),
    ...rows.map((r, i) => new TableRow({ children: r.map((c, j) => cell(c, widths[j], false, i, (opt.right || []).includes(j) ? AlignmentType.RIGHT : AlignmentType.LEFT)) }))] })];
  if (opt.caption) { tab++; out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 }, children: [new TextRun({ text: `Table ${tab}: ${opt.caption}`, italics: true, size: 17, color: '555555' })] })); }
  else out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  return out;
}
function pngSize(f) { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
function img(file, caption, maxW = 600, maxH = 760) {
  const f = path.join(ROOT, file); if (!fs.existsSync(f)) return [P(`[missing image ${file}]`)];
  let [w, h] = pngSize(f); const s = Math.min(maxW / w, maxH / h); fig++;
  return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, children: [new ImageRun({ type: 'png', data: fs.readFileSync(f), transformation: { width: Math.round(w * s), height: Math.round(h * s) }, altText: { title: caption, description: caption, name: path.basename(file) } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `Figure ${fig}: ${caption}`, italics: true, size: 17, color: '555555' })] })];
}
const shot = (n, cap, mh) => img(`docs/screenshots/${n}.png`, cap, 600, mh || 420);
const code = (lines) => lines.map(l => new Paragraph({ spacing: { after: 0, line: 240 }, shading: { fill: 'F3F6FA', type: ShadingType.CLEAR, color: 'auto' }, children: [new TextRun({ text: l || ' ', font: 'Consolas', size: 16 })] }));
const spacer = (n = 1) => Array.from({ length: n }, () => new Paragraph({ children: [] }));

// ---------------------------------------------------------------- cover
const C = S.clients, T = S.totals;
const cover = [
  ...spacer(2),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'THE INSTITUTE OF CHARTERED ACCOUNTANTS OF INDIA', bold: true, size: 26, color: INK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: 'Advanced Information Technology (AICITSS) - Project Report', size: 22, color: '444444' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 12, color: SAFF, space: 12 } }, spacing: { before: 300 }, children: [new TextRun({ text: 'ARTIFICIAL INTELLIGENCE AND', bold: true, size: 40, color: INK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'THE GOODS AND SERVICES TAX ACT, 2017', bold: true, size: 40, color: INK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'Input Tax Credit (ITC) and Reverse Charge Mechanism (RCM)', size: 30, color: SAFF, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: SAFF, space: 12 } }, children: [new TextRun({ text: 'GSTiQ - an AI-powered ITC & RCM compliance suite for a Chartered Accountant\'s office', italics: true, size: 24 })] }),
  ...spacer(3),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Submitted by', size: 22, color: '555555' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'LAKHNOTRA BHARAT BHOLABHAI', bold: true, size: 28 })] }),
  ...[['Registration No.', '____________________'], ['Batch No. / Centre', '____________________'], ['Faculty / Guide', '____________________'], ['Date of submission', '____________________']].map(([a, b]) =>
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: `${a}: `, size: 22, color: '555555' }), new TextRun({ text: b, size: 22 })] })),
  ...spacer(3),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Technologies: HTML5 · CSS3 · JavaScript · Python · SQL · Excel & VBA · Jupyter · JSON', size: 18, color: '555555' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Law position as on ${KB.meta.law_as_on.split('-').reverse().join('-')} · all client data is fictitious`, size: 18, color: '555555' })] }),
];

// ---------------------------------------------------------------- front matter
const front = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Certificate')] }),
  P('This is to certify that the project report entitled **"Artificial Intelligence and the Goods and Services Tax Act, 2017 - Input Tax Credit and Reverse Charge Mechanism"**, together with the software application *GSTiQ* and its supporting files, has been prepared by **Lakhnotra Bharat Bholabhai**, Registration No. ____________________, as part of the Advanced Information Technology course under the Advanced Integrated Course on Information Technology and Soft Skills (AICITSS) of the Institute of Chartered Accountants of India.'),
  P('The work is the student\'s own and has been carried out under my guidance. It is found satisfactory for submission.'),
  ...spacer(3),
  new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: W }], children: [new TextRun({ text: 'Signature of Faculty: ______________________', size: 21 }), new TextRun({ children: [new Tab(), 'Seal of the Centre'], size: 21 })] }),
  P('Name of Faculty: ______________________', { align: AlignmentType.LEFT }), P('Date: ______________________   Place: ______________________', { align: AlignmentType.LEFT }),

  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun('Declaration')] }),
  P('I, **Lakhnotra Bharat Bholabhai**, hereby declare that this project report and the accompanying software, data, spreadsheets, notebook and source code are an original work prepared by me for the ICAI Advanced Information Technology course. The client, vendor and invoice data used in the project is entirely fictitious and generated by a program written for this purpose. Legal provisions are summarised from the CGST Act, 2017, the IGST Act, 2017, the CGST Rules, 2017 and notifications and circulars issued by the CBIC, and are presented for academic demonstration.'),
  ...spacer(2), P('Signature: ______________________', { align: AlignmentType.LEFT }), P('Date: ______________________', { align: AlignmentType.LEFT }),

  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun('Acknowledgement')] }),
  P('I express my sincere gratitude to the Institute of Chartered Accountants of India for including a practical project in the Advanced Information Technology course, which encouraged me to apply technology to a real problem faced in the profession.'),
  P('I thank my faculty for the guidance and for suggesting the topic of Artificial Intelligence and the GST Act, 2017 with focus on input tax credit and reverse charge. I also thank the professionals whose published articles, the ICAI GST & Indirect Taxes Committee publications and the CBIC and GSTN material helped me understand the latest position of law, including the Invoice Management System, the GST 2.0 rate rationalisation and the recommendations of the 57th GST Council meeting.'),
  P('Finally, I thank my family for their constant support during the preparation of this project.'),
  ...spacer(2), P('Lakhnotra Bharat Bholabhai', { align: AlignmentType.RIGHT }),

  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun('Abstract')] }),
  P('Input tax credit (ITC) is the mechanism that makes GST a tax on value addition, and the reverse charge mechanism (RCM) shifts the payment of tax to the recipient for notified supplies. Both are rule-heavy and data-heavy: a single client of a CA office may have hundreds of purchase bills a month, each of which must satisfy the conditions of Section 16, avoid the blocked credits of Section 17(5), appear in GSTR-2B under the Invoice Management System, be paid within 180 days and be claimed before the Section 16(4) deadline. RCM adds time-of-supply, cash-payment, self-invoicing and interest obligations.'),
  P(`This project builds **GSTiQ**, a working compliance suite that automates these checks for a CA office with multiple clients. A deterministic rules engine (written once in Python and once in JavaScript, verified to agree on every invoice) evaluates eligibility, reconciles books with GSTR-2B using a four-pass exact-and-fuzzy algorithm, computes RCM liability and interest, builds GSTR-3B Table 3.1(d) and Table 4, applies Rules 42 and 43, optimises ITC set-off and flags DRC-01C exposure under Rule 88D. Artificial intelligence is used where judgement on unstructured or high-volume data is needed: a text classifier reads ledger narrations (85% cross-validated accuracy; 97.4% agreement with the rules on real register lines), an Isolation Forest and Benford's law test flag unusual invoices, a transparent model scores vendor compliance risk, a regression model forecasts ITC, and a retrieval chatbot answers ITC and RCM questions and queries the client's own data.`),
  P(`The suite runs fully offline as a single HTML file, with an optional Python Flask API, a SQLite database with analytical SQL, a formula-driven Excel model with VBA, and a Jupyter notebook. On a dummy data set of 5 clients, ${S.data.vendors} vendors and ${S.data.purchases} purchase invoices carrying GST of ${inr(T.tax)}, GSTiQ classified ${lakh(T.eligible)} as eligible, ${lakh(T.blocked)} as blocked, ${lakh(T.at_risk)} as at risk and ${lakh(T.lapsed)} as lapsed, and identified ${lakh(T.wrong)} of credit already claimed that is not eligible today.`),
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun('Contents')] }),
  'TOC_PLACEHOLDER'
];

// ---------------------------------------------------------------- body
const body = [];
const add = (...x) => x.forEach(i => Array.isArray(i) ? body.push(...i) : body.push(i));

add(H1('Introduction'));
add(H2('Background'));
add(P('The Goods and Services Tax was introduced in India on 1 July 2017, subsuming central excise, service tax, VAT and several other levies into a destination-based tax on supply. Its defining feature is a seamless chain of input tax credit: tax paid on inputs, input services and capital goods is set off against tax payable on outward supplies, so that tax is levied only on value addition. In the reverse charge mechanism the recipient, instead of the supplier, pays the tax on notified supplies - for example goods transport agency services, legal services by advocates, security services, import of services, commercial rent from unregistered landlords and metal scrap.'));
add(P('For a Chartered Accountant\'s office, ITC and RCM are the most time-consuming parts of monthly GST compliance. Since October 2024 the Invoice Management System (IMS) requires recipients to accept, reject or keep pending each supplier document before GSTR-2B is generated, and the rate rationalisation effective 22 September 2025 ("GST 2.0") moved most goods and services to 5% and 18% slabs. Errors are costly: ITC claimed in excess of GSTR-2B attracts a DRC-01C intimation, wrongly utilised credit attracts interest at 18%, and credit not claimed by 30 November of the following year is lost permanently.'));
add(H2('Problem statement'));
add(P('In most small and mid-size CA offices the review of ITC and RCM is done in spreadsheets: the purchase register is exported from the client\'s accounting software, GSTR-2B is downloaded from the portal, and the two are matched with VLOOKUP. This approach has five weaknesses:'));
add(numbered(['**Matching breaks on real data.** Invoice numbers are written differently in books and in GSTR-2B ("INV/26-27/045" vs "INV-2627-45"), GSTINs are mistyped and dates differ by a day.', '**Statutory conditions are checked from memory.** Blocked credits, Rule 37 (180-day payment), Rule 37A (supplier GSTR-3B default) and the Section 16(4) time limit are easy to miss in a large register.', '**RCM is missed or paid late.** Expense ledgers such as freight, legal fees or rent are not tagged for RCM; time of supply is not computed; self-invoices are not issued.', '**No early warning.** The office learns of excess claims only when a DRC-01C or ASMT-10 notice arrives.', '**Knowledge is fragmented.** Notifications and circulars change often, and the latest position (for example the composition-taxpayer exclusion from RCM on commercial rent) is not available at the point of work.']));
add(H2('Objectives'));
add(bullets(['Evaluate every inward invoice against Sections 16 and 17 and Rules 36(4), 37 and 37A, and explain each decision rule by rule.', 'Reconcile the purchase register with GSTR-2B (including IMS actions) using exact, fuzzy and GSTIN-rescue matching.', 'Determine RCM applicability through a decision wizard over all notified entries, and compute time of supply, tax, due date, interest and documents.', 'Build GSTR-3B Tables 3.1(d) and 4, apply Rules 42 and 43, optimise ITC set-off under Sections 49, 49A and 49B, and flag DRC-01C risk.', 'Apply AI techniques - classification, anomaly detection, Benford\'s law, risk scoring, forecasting and a chatbot - with explainable outputs.', 'Support the CA office workflow: multiple clients, import and export in CSV/Excel/JSON/portal format, reports, vendor letters and an audit trail.', 'Use several technologies - HTML, CSS, JavaScript, Python, SQL, Excel/VBA and Jupyter - in one integrated project.']));
add(H2('Scope'));
add(P('**In scope:** inward supplies of goods and services by regular taxpayers; ITC on inputs, input services and capital goods; RCM under Section 9(3)/9(4) of the CGST Act and Section 5(3)/5(4) of the IGST Act; GSTR-2B and IMS; GSTR-3B Table 3.1(d) and Table 4; Rules 37, 37A, 42, 43, 86B, 88A, 88B and 88D; interest under Section 50.'));
add(P('**Out of scope:** outward supply returns (GSTR-1), refunds, input service distributor workings, e-way bills, annual return reconciliation (GSTR-9/9C) and live connection to the GST portal (which requires a GST Suvidha Provider licence).'));
add(H2('Methodology'));
add(numbered(['Study of the law: bare Act, Rules, rate notifications, circulars and recent developments up to October 2026.', 'Encoding the law as data: a single JSON knowledge base with 23 RCM entries, 11 blocked-credit heads, the Section 16 conditions, GSTR-3B mapping, case laws and a labelled training corpus.', 'Designing the system: requirements, architecture, data-flow diagrams, entity-relationship model.', 'Building the engines twice - in Python (server) and JavaScript (browser) - and an automated test proving they agree.', 'Adding AI models in both languages, a user interface of 20 pages, reports, an Excel model with VBA, SQL analytics and a Jupyter notebook.', `Generating realistic dummy data for five clients with deliberate errors, and validating outputs through ${23} unit tests, a cross-language test, a browser test and spreadsheet recalculation.`]));

add(H1('Legal framework: Input Tax Credit'));
add(H2('Key definitions'));
add(...table(['Term', 'Section', 'Meaning (summary)'], [['Input', '2(59)', 'Goods other than capital goods used or intended to be used in the course or furtherance of business'], ['Input service', '2(60)', 'Any service used or intended to be used in the course or furtherance of business'], ['Capital goods', '2(19)', 'Goods capitalised in the books and used or intended to be used in the course or furtherance of business'], ['Input tax', '2(62)', 'IGST, CGST, SGST/UTGST charged on supply to a registered person, including RCM tax and IGST on imports'], ['Input tax credit', '2(63)', 'Credit of input tax'], ['Reverse charge', '2(98)', 'Liability to pay tax by the recipient instead of the supplier under Sec 9(3)/9(4) CGST or 5(3)/5(4) IGST']], [1900, 1100, 6026], { caption: 'Definitions relevant to ITC and RCM' }));
add(H2('Eligibility and conditions - Section 16'));
add(P('Section 16(1) entitles a registered person to ITC on supplies used or intended to be used in the course or furtherance of business. Section 16(2) makes the credit conditional; the engine checks each condition and records the result against the invoice.'));
add(...table(['Provision', 'Condition', 'How GSTiQ checks it'], KB.itc_conditions.map(c => [c.ref, c.title, ({ S16_1: 'Usage tag (personal / CSR / exempt)', S16_2a: 'Invoice number, date and valid GSTIN (check digit)', S16_2aa: 'Four-pass match with GSTR-2B and IMS action', S16_2b: 'Receipt date; blank = deferred', S16_2ba: 'itcavl flag in GSTR-2B', S16_2c: 'Supplier GSTR-3B status; Rule 37A after 30 September', S16_2d: 'Assumed (recipient files GSTR-3B)', S16_2_p2: 'Days between invoice and payment', S16_3: 'Advisory note', S16_4: 'FY-wise deadline; last claim in October return', S16_5: 'Historical relief - reference only', S16_6: 'Reference only' })[c.id] || '']), [2100, 2700, 4226], { caption: 'Section 16 conditions and their automation' }));
add(H2('Blocked credits - Section 17(5)'));
add(P('Even when Section 16 is satisfied, credit is blocked for the categories in Section 17(5). The engine combines three signals - the usage tag, HSN/SAC codes and keywords in the description - and applies statutory exceptions (for example, construction materials used by a works contractor for a customer\'s project are not "on own account").'));
add(...table(['Clause', 'Blocked credit', 'Key exception'], KB.blocked_credits.map(b => [b.ref, b.title, b.exceptions]), [1700, 3500, 3826], { caption: 'Blocked credits as applied by the engine', size: 16 }));
add(P('**Section 17(5)(d) after Safari Retreats.** In *Chief Commissioner of CGST v. Safari Retreats Pvt. Ltd.* (2024) the Supreme Court held that "plant or machinery" in clause (d) is wider than the defined "plant and machinery" and that a building may be a "plant" on a functionality test. The Finance Act, 2025 substituted "plant and machinery" in clause (d) with retrospective effect from 1 July 2017, so buildings and civil structures remain blocked. GSTiQ applies the amended text.'));
add(P('**Proposed relaxation.** The 57th GST Council (8 October 2026) recommended removing the blocks on outdoor catering, health and life insurance, telecommunication towers, pipelines outside the factory, free samples and goods destroyed on expiry of shelf life. Until the Act is amended these remain blocked; GSTiQ flags the affected bills as "proposed relaxation" for information only.'));
add(H2('Apportionment - Rules 42 and 43'));
add(P('Where inputs or input services are used partly for exempt supplies or non-business purposes, Section 17(1) and 17(2) restrict credit to the taxable share. Rule 42 prescribes the monthly computation:'));
add(code(['T  = total ITC on inputs and input services of the month', 'T1 = used exclusively for non-business;  T2 = exclusively for exempt supplies;  T3 = blocked u/s 17(5)', 'C1 = T - (T1 + T2 + T3);   T4 = used exclusively for taxable supplies (incl. zero-rated)', 'C2 = C1 - T4  (common credit)', 'D1 = (E / F) x C2   where E = exempt turnover, F = total turnover in the State', 'D2 = 5% x C2       (only where common inputs are also used for non-business purposes)', 'C3 = C2 - (D1 + D2)   eligible common credit;   reversal = D1 + D2 (Table 4B(1))']));
add(P('The monthly figures are trued up on annual turnover by the due date of the September return of the following year; a short reversal is paid with interest and an excess reversal is reclaimed. Rule 43 spreads common credit on capital goods over 60 months (Tm = A/60) and reverses Te = (E/F) x Tm every month.'));
add(H2('Time limits and reversals'));
add(bullets(['**Rule 36(4) and IMS:** only invoices reflected in GSTR-2B can be claimed. Under IMS, accepted and "no action" records flow into GSTR-2B (generated on the 14th); rejected records do not; pending records roll forward.', '**Rule 37:** if the supplier is not paid within 180 days of the invoice date, the ITC is added to output tax with interest and re-availed on payment. It does not apply to RCM supplies.', '**Rule 37A:** if the supplier furnished the invoice in GSTR-1 but did not file GSTR-3B by 30 September of the following year, the recipient reverses the ITC by 30 November and re-avails it when the supplier files.', '**Section 16(4):** ITC cannot be taken after 30 November following the end of the financial year (or the annual return, if earlier). For FY 2025-26 the last return is GSTR-3B for October 2026, due 20 November 2026.', '**Rule 88D (DRC-01C):** where ITC claimed in GSTR-3B exceeds GSTR-2B by more than the notified limits (Rs 25 lakh and 20%), the taxpayer must pay the excess through DRC-03 or explain the difference.', '**Rule 86B:** where taxable value of supplies in a month exceeds Rs 50 lakh, at least 1% of output tax is paid in cash unless an exception applies.']));
add(H2('Utilisation of ITC - Sections 49, 49A, 49B and Rule 88A'));
add(P('IGST credit must be used first, against IGST and then against CGST and SGST in any order or proportion; CGST credit is used against CGST and then IGST; SGST credit against SGST and then IGST; CGST credit can never pay SGST and vice versa. RCM tax cannot be paid from the electronic credit ledger (Section 49(4)). Because the order between CGST and SGST is flexible, GSTiQ allocates the balance of IGST credit first to the head where own credit is short, which minimises cash. The textbook example below is reproduced exactly by the engine and by the Excel model.'));
add(...table(['', 'IGST', 'CGST', 'SGST'], [['Output liability', '1,500', '600', '600'], ['Credit available', '1,000', '300', '500'], ['IGST credit used', '1,000 (IGST)', '-', '-'], ['CGST credit used', '-', '300', '-'], ['SGST credit used', '-', '-', '500'], ['Cash payable', '500', '300', '100']], [2600, 2142, 2142, 2142], { caption: 'Set-off illustration (total cash Rs 900 - the minimum possible)', right: [1, 2, 3] }));
add(H2('Reporting in GSTR-3B and interest'));
add(...table(['Table', 'Content'], Object.entries(KB.gstr3b_tables), [1600, 7426], { caption: 'GSTR-3B Table 3.1(d) and Table 4 (Circular 170/02/2022-GST)' }));
add(P('Interest under Section 50 is 18% per annum on tax paid late (on the cash portion) and on ITC wrongly availed *and utilised* (Rule 88B), computed on actual days divided by 365.'));

add(H1('Legal framework: Reverse Charge Mechanism'));
add(H2('Concept and charging provisions'));
add(P('Section 9(3) of the CGST Act (Section 5(3) of the IGST Act) empowers the Government to notify categories of supply on which the recipient pays tax. Section 9(4) covers specified supplies by unregistered persons to specified classes of registered persons (currently promoters of real-estate projects). A person liable to pay tax under RCM must register irrespective of turnover (Section 24). The recipient pays RCM tax only through the electronic cash ledger and may then take ITC of the same tax, subject to Section 17(5).'));
add(H2('Notified services'));
add(...table(['Entry', 'Service', 'Supplier', 'Recipient', 'Rate'], KB.rcm_catalog.filter(e => e.kind === 'service').map(e => [e.entry, e.title, e.supplier, e.recipient, e.rate + '%']), [900, 2600, 2300, 2526, 700], { caption: 'Services under RCM - Notification 13/2017-CT(R) and 10/2017-IT(R), as amended', size: 15, right: [4] }));
add(H2('Notified goods and Section 9(4)'));
add(...table(['Entry', 'Goods', 'Supplier', 'Recipient', 'Rate'], KB.rcm_catalog.filter(e => e.kind !== 'service').map(e => [e.entry, e.title, e.supplier, e.recipient, e.rate + '%']), [900, 2600, 2300, 2526, 700], { caption: 'Goods under RCM - Notification 04/2017-CT(R) and Section 9(4)', size: 15, right: [4] }));
add(H2('Time of supply, documents and reporting'));
add(...table(['Provision', 'Requirement'], KB.rcm_compliance.map(x => [x.ref, `${x.title}: ${x.text}`]), [2300, 6726], { caption: 'RCM compliance requirements' }));
add(H2('Recent developments (2024 - 2026)'));
add(bullets(['**Commercial rent (Entry 5AB):** from 10 October 2024, renting of any property other than a residential dwelling by an unregistered person to a registered person is under RCM (Notification 09/2024-CT(R)); persons who opted for the composition levy were excluded from 16 January 2025 (Notification 07/2025-CT(R)).', '**Metal scrap:** from 10 October 2024, metal scrap of Chapters 72 to 81 supplied by an unregistered person to a registered person is under RCM (Notification 06/2024-CT(R)); supplies between registered persons attract 2% GST-TDS under Section 51.', '**Self-invoice time limit:** Rule 47A requires the self-invoice within 30 days of receipt (from 1 November 2024); Circular 211/5/2024-GST links the Section 16(4) time limit for RCM credit to the financial year of the self-invoice.', '**GST 2.0 (22 September 2025):** slabs rationalised to 5% and 18% with a 40% special rate; GTA remains 5% without ITC under RCM or 18% with ITC under forward charge; individual health and life insurance became exempt.', '**57th GST Council (8 October 2026):** recommended relaxation of certain blocked credits, refund of accumulated ITC on input services (inverted duty) from 1 November 2026, a hearing before blocking credit under Rule 86A, and new statements for RCM and credit reversal under IMS. These are recommendations until notified.']));
add(H2('Judicial precedents and circulars'));
add(...table(['Case / circular', 'Forum, year', 'Held / clarified'], KB.case_laws.map(c => [c.name, `${c.court}, ${c.year}`, c.held + ' ' + (c.status ? '(' + c.status + ')' : '')]), [2500, 1500, 5026], { caption: 'Precedents and circulars built into the knowledge hub', size: 15 }));

add(H1('Artificial Intelligence in GST compliance'));
add(H2('AI in tax administration'));
add(P('The tax administration already relies on analytics and machine learning. GSTN set up a Business Intelligence and Fraud Analytics (BIFA) unit in 2019, with machine-learning models for fraud propensity, network (graph) analysis of taxpayer communities and anomaly detection. CBIC\'s Advanced Analytics in Indirect Taxation (ADVAIT) platform, launched in 2021, and the NETRA tool support risk profiling of taxpayers. Government statements credit these systems with detecting thousands of fake-ITC cases. A CA office that uses comparable analytics on its own clients\' data can find the same issues before the department does.'));
add(H2('AI in a CA practice'));
add(P('Within an office, AI is most useful where data is unstructured, voluminous or pattern-based: reading inconsistent ledger narrations, matching imperfect invoice numbers, finding unusual bills among hundreds, ranking vendors by compliance behaviour, forecasting cash requirements, and answering routine questions from the team. Statutory conclusions, however, must remain explainable and rule-based. GSTiQ therefore follows a "rules decide, AI advises" design: the deterministic engine decides eligibility, and AI outputs are shown with their reasons and surfaced for review when they disagree.'));
add(H2('Techniques used in GSTiQ'));
add(...table(['Technique', 'Problem solved', 'Browser (JavaScript)', 'Python (scikit-learn)', 'Evaluation'], [
  ['Fuzzy matching', 'Invoice-number and GSTIN errors in reconciliation', 'Token normalisation + Levenshtein similarity score', 'Same algorithm', 'Unit and cross-language tests'],
  ['Text classification', 'Narration -> eligible / blocked head / RCM head', 'Multinomial Naive Bayes (uni+bigrams)', 'TF-IDF (word+char) + Logistic Regression', `5-fold CV ${(S.cv.mean_accuracy * 100).toFixed(1)}% (18 classes); grouped 88%`],
  ['Anomaly detection', 'Unusual bills, splitting, near-duplicates', 'Isolation Forest coded from scratch + rules', 'IsolationForest (300 trees)', 'Flags reviewed with reasons'],
  ["Benford's law", 'Population test of invoice values', 'Chi-square + MAD (Nigrini bands)', 'Same', 'Verdict per client'],
  ['Risk scoring', 'Vendor compliance risk', 'Weighted model with factor contributions', 'Same weights', 'Grades A-D'],
  ['Regression', 'ITC forecast for cash planning', 'OLS trend + moving average', 'LinearRegression', 'R-squared, 90% band'],
  ['Information retrieval', 'GST Mitra chatbot', 'TF-IDF cosine + data-aware intents', 'TF-IDF cosine', '44 curated answers']], [1300, 1900, 2100, 1900, 1826], { caption: 'AI techniques and their implementation', size: 15 }));
add(H2('Responsible use'));
add(bullets(['**Explainability:** every classification shows its signal words; every risk score shows factor contributions; every flag cites the section or rule.', '**Human in the loop:** AI never changes a statutory status; disagreements with the rule engine are listed for review.', '**Privacy:** the application processes data locally in the browser; no client data leaves the computer unless the user exports it.', '**Limitations:** models are trained on a curated corpus and dummy data; real deployment needs retraining on the office\'s own narrations.']));

add(H1('System analysis and design'));
add(H2('Requirements'));
add(...table(['ID', 'Functional requirement'], [['FR1', 'Maintain clients, vendors, purchase register, GSTR-2B and outward supply summary for multiple clients'], ['FR2', 'Import CSV, Excel and GST-portal GSTR-2B JSON with automatic column mapping and validation; export CSV, Excel, JSON and backup'], ['FR3', 'Validate GSTIN with the check-digit algorithm'], ['FR4', 'Reconcile books with GSTR-2B (exact, fuzzy, GSTIN rescue) and generate vendor follow-up letters'], ['FR5', 'Evaluate ITC eligibility per invoice with rule-wise explanation'], ['FR6', 'Compute Rule 42 and Rule 43 reversals with annual true-up'], ['FR7', 'Decide RCM applicability; compute time of supply, tax, due date and interest; generate self-invoice and payment voucher'], ['FR8', 'Build GSTR-3B Table 3.1(d) and Table 4 with drill-down; check DRC-01C and Rule 86B'], ['FR9', 'Optimise ITC set-off and compute cash payable'], ['FR10', 'AI: classifier, anomaly detection, Benford, vendor risk, forecast, chatbot'], ['FR11', 'Dashboards for a client and for the whole practice, with AI insights and compliance calendar'], ['FR12', 'Client reports: MIS workbook, review report, GSTR-3B working; audit trail']], [900, 8126], { caption: 'Functional requirements' }));
add(...table(['Quality', 'Requirement and design response'], [['Availability', 'Works offline as one HTML file - no installation, no internet needed at a client\'s office'], ['Accuracy', 'Two independent engines (Python, JavaScript) verified to agree on every invoice'], ['Explainability', 'Each decision lists the conditions checked and the reasons'], ['Performance', 'Full analysis of a client (about 130 bills) in under 50 ms in the browser'], ['Portability', 'Desktop and mobile layouts; light and dark themes; prints to PDF'], ['Maintainability', 'Law encoded once in a JSON knowledge base shared by all components']], [1800, 7226], { caption: 'Non-functional requirements' }));
add(H2('Architecture'));
add(img('docs/diagrams/arch.png', 'Layered architecture of GSTiQ', 600, 300));
add(P('The presentation layer and the browser engines form a complete application on their own. The Python layer is optional: when the web app is served by the Flask server (or pointed to it in Setup) it detects the API and adds scikit-learn results, the SQL database and formula-driven Excel reports. Both engines read the same knowledge base, so a change in law is made in one place.'));
add(H2('Data-flow diagrams'));
add(img('docs/diagrams/dfd0.png', 'Context diagram (DFD level 0)', 600, 260));
add(img('docs/diagrams/dfd1.png', 'DFD level 1 - processes and data stores', 560, 560));
add(H2('ITC decision logic'));
add(img('docs/diagrams/flow.png', 'ITC decision flow applied to each inward invoice', 470, 600));
add(P('When several conditions fail, the engine reports the most severe status (time-barred, duplicate, blocked, ineligible, no ITC, RCM unpaid, not in 2B, restricted, deferred, Rule 37, Rule 37A) and lists every other issue as a flag, so nothing is hidden behind the headline status.'));
add(H2('Database design'));
add(img('docs/diagrams/er.png', 'Entity-relationship diagram', 600, 330));
add(...table(['Field', 'Type', 'Description'], [['id', 'TEXT PK', 'Entry identifier (PI-C1-0001)'], ['client_id / vendor_id', 'TEXT FK', 'Links to client and vendor'], ['supplier_gstin', 'TEXT', '15-character GSTIN (blank for unregistered / foreign)'], ['invoice_no, invoice_date', 'TEXT', 'Document details (ISO dates)'], ['receipt_date', 'TEXT', 'Goods / services received - Sec 16(2)(b)'], ['hsn_sac, description, category', 'TEXT', 'Classification and narration; Inputs / Input Services / Capital Goods'], ['taxable_value, rate, igst, cgst, sgst, cess', 'REAL', 'Values; CHECK taxable_value >= 0'], ['reverse_charge, rcm_type, rcm_paid_date, self_invoice_no', 'TEXT', 'RCM attributes'], ['usage', 'TEXT', 'Taxable / Common / Exempt / Project-WC / Own-Building / Personal / CSR'], ['itc_claimed, claim_period', 'TEXT', 'What the client actually claimed in GSTR-3B'], ['payment_date, amount_paid', 'TEXT / REAL', 'Payment to supplier - Rule 37']], [3200, 1300, 4526], { caption: 'Data dictionary - PURCHASE table (abridged)' }));
add(P('The database (`database/schema.sql`) also defines views for the ITC summary, vendor follow-up, RCM liability and Section 16(4) alerts, and `database/queries.sql` contains 14 analytical queries using CTEs, window functions (RANK, running totals, share of total) and date arithmetic.'));
add(H2('Technology stack'));
add(...table(['Language / tool', 'Used for', 'Main files', 'Lines'], [['HTML5', 'Application shell, semantic structure', 'app/index.html', S.loc.HTML], ['CSS3', 'Design system, themes, responsive and print layouts', 'app/css/styles.css', S.loc.CSS], ['JavaScript', 'Rules engine, AI, import/export, 20 views', 'app/js/*.js', S.loc.JavaScript], ['Python', 'Engines, scikit-learn, Flask API, CLI, data generator, reports, tests', 'backend/, tests/, tools/', S.loc.Python], ['SQL', 'Schema, views, analytical queries (SQLite)', 'database/*.sql', S.loc.SQL], ['Excel + VBA', 'Formula-driven model (1,281 formulas) and macros/UDFs', 'excel/', S.loc.VBA + ' (VBA)'], ['JSON', 'Knowledge base, demo data, portal GSTR-2B format', 'knowledge/, data/', '-'], ['Jupyter', 'Model documentation with charts', 'notebooks/', '-']], [1700, 3400, 2526, 1400], { caption: 'Technologies used', right: [3] }));

add(H1('Implementation'));
add(P('This chapter walks through the modules of the application with screenshots taken from the offline build (`dist/GSTiQ_Standalone.html`) on the dummy data.'));
add(H2('Dashboard and practice overview'));
add(P('The client dashboard summarises where every rupee of input GST stands, lists AI-generated insights in order of priority with amounts and links, and shows the compliance calendar computed from the evaluation date. Selecting "All clients" turns it into a practice overview for the partners.'));
add(shot('01_dashboard', 'Client dashboard with KPIs, AI insights and compliance calendar'));
add(shot('27_practice_overview', 'Practice overview across all clients'));
add(H2('Purchase register and invoice explanation'));
add(P('Each bill is evaluated live. Clicking a bill opens an explanation panel: the issues that need attention with legal references, the rule-by-rule checklist, the AI reading of the description, the books-versus-GSTR-2B comparison (differences highlighted), RCM details and the invoice data. Bills can be added or edited with automatic IGST/CGST+SGST split and an AI suggestion that can apply the RCM category.'));
add(shot('03_purchases', 'Purchase register with ITC status and GSTR-2B match for every bill'));
add(shot('22_invoice_drawer_flags', 'Explanation of a blocked bill (motor vehicle, Sec 17(5)(a))'));
add(H2('GSTR-2B and the Invoice Management System'));
add(P('GSTR-2B records can be imported in the GST-portal JSON format. The IMS action of each record can be changed (Accept, Reject, Pending, No Action), and the effect on reconciliation and GSTR-3B is visible immediately.'));
add(shot('04_gstr2b', 'GSTR-2B with IMS actions'));
add(H2('Reconciliation engine'));
add(P('The reconciliation runs in four passes. (1) Exact key: GSTIN plus a normalised invoice number - alphabetic and numeric tokens with leading zeros removed, so "INV/26-27/045" and "inv-2627-45" both become "INV262745". (2) Fuzzy: within the same GSTIN, a score of 0.5 x invoice-number similarity (Levenshtein) + 0.35 x amount similarity + 0.15 x date proximity; accepted above the threshold with amount agreement. (3) GSTIN rescue: same normalised invoice and value but a GSTIN that differs by one or two characters (data-entry error) or shares the PAN (another registration). (4) Leftovers become "missing in 2B" or "missing in books". Duplicates in books are detected first. Tolerances are configurable.'));
add(shot('06_recon', 'Reconciliation results with status filters and explanations'));
add(H2('ITC eligibility analyser'));
add(P('The analyser groups exceptions by rule, tracks the Section 16(4) deadline, shows bills approaching the 180-day limit of Rule 37 with a progress bar, and lists blocked credits by clause with their exceptions and proposed relaxations.'));
add(shot('07_itc', 'ITC eligibility analyser - rule-wise exceptions'));
add(H2('Rule 42 and Rule 43'));
const r42 = S.c1sep.r42;
add(P(`For Saurashtra Agro Exports (September 2026), T = ${inr(r42.T, 2)}, T3 (blocked) = ${inr(r42.T3, 2)}, C2 (common credit) = ${inr(r42.C2, 2)}, E = ${inr(r42.E)} and F = ${inr(r42.F)}, so E/F = ${(r42.ratio * 100).toFixed(3)}% and **D1 = ${inr(r42.D1, 2)}** to be reversed. The same figure is produced independently by the Python engine, the JavaScript engine and the Excel model.`));
add(shot('08_rule42', 'Rule 42 computation with annual true-up and Rule 43 table'));
add(H2('RCM register and self-invoice'));
add(P('The register computes the time of supply for each RCM bill, the GSTR-3B period and due date, the payment status and interest, and whether a self-invoice is required. A self-invoice and payment voucher can be generated in the format of Rule 46 and downloaded or printed.'));
add(shot('09_rcm', 'RCM register'));
add(shot('26_self_invoice', 'Self-invoice and payment voucher generated by GSTiQ'));
add(H2('RCM decision wizard'));
add(P('The wizard covers all 23 notified entries. The user describes the expense and the AI suggests the entry; the wizard then asks only the conditions relevant to that entry (for legal services: supplier is an advocate, recipient is a business entity, turnover above the threshold) and reaches a verdict with tax, split, time of supply and the compliance checklist.'));
add(shot('23_rcm_wizard_verdict', 'RCM wizard - legal services suggested by AI and decided'));
add(H2('GSTR-3B builder and DRC-01C check'));
add(P('The builder lays out Tables 3.1 and 4 like the portal. Every amount can be clicked to see the bills behind it. The panel on the right compares the working with what the client claimed in books and checks Rule 88D.'));
add(shot('11_gstr3b', 'GSTR-3B working with books comparison and DRC-01C gauge'));
add(H2('Set-off and cash payable'));
add(P('The set-off module shows a utilisation matrix (liability heads in rows, credit heads in columns), the step-by-step order with legal references, the challan amount for output tax and RCM, credit carried forward and the Rule 86B test. If reversals exceed credit in a head (negative Table 4C), the excess is added to output tax.'));
add(shot('12_setoff', 'Optimised ITC set-off'));
add(H2('AI lab'));
add(P('The AI lab exposes each model with its inputs, outputs and evaluation: the classifier with probability bars and signal words, the anomaly detector with a scatter of score against value, the Benford chart, vendor risk with stacked factor contributions, and the ITC forecast with a confidence band.'));
add(shot('14_ai-lab', 'AI lab - expense classifier'));
add(shot('29_ai_anomaly', 'Isolation Forest anomaly detection'));
add(shot('29_ai_benford', "Benford's law first-digit test"));
add(shot('29_ai_risk', 'Vendor risk scoring with factor contributions'));
add(shot('29_ai_forecast', 'ITC forecast with confidence band'));
add(H2('GST Mitra assistant'));
add(P('The assistant answers law questions from 44 curated answers using TF-IDF retrieval, and understands data questions such as "which invoices are missing in 2B?", "how much ITC is at risk?", "RCM on legal fees of 75,000" or "interest on 2 lakh for 45 days", computing the answer from the client\'s data or the RCM engine.'));
add(shot('24_assistant_chat', 'GST Mitra answering data and law questions'));
add(H2('Reports, data centre and knowledge hub'));
add(P('Reports include a seven-sheet client MIS workbook, a narrative ITC and RCM review report, vendor letters, the GSTR-3B working and a practice summary. The data centre imports files with automatic column mapping (exact, alias and fuzzy header matching), validates rows, and exports every data set; it also keeps an audit trail. The knowledge hub presents the law, recent changes and case laws.'));
add(shot('16_reports', 'Reports'));
add(shot('28_import_mapping', 'Import with automatic column mapping'));
add(shot('17_knowledge', 'Knowledge hub - what is new'));
add(H2('Python engine, API and command line'));
add(P('The Python engine (`backend/`) implements the same rules and adds scikit-learn models, a SQLite database, an openpyxl report generator and a Flask REST API that also serves the web app. When linked, the web app shows the Python model\'s prediction next to the browser model and can download a formula-driven Excel MIS built by Python.'));
add(...table(['Endpoint', 'Purpose'], [['GET /api/health', 'Engine status, versions, classifier cross-validation'], ['POST /api/analyse', 'Full pipeline for a client: reconciliation, ITC, RCM, GSTR-3B, set-off, AI'], ['POST /api/reconcile', 'Reconcile purchase register with GSTR-2B'], ['POST /api/ai/classify', 'Classify expense descriptions'], ['POST /api/ai/anomalies', 'Isolation Forest + Benford'], ['POST /api/ai/vendor-risk', 'Vendor risk scores'], ['POST /api/ai/forecast', 'ITC forecast'], ['POST /api/chat', 'GST Mitra answer'], ['POST /api/rcm/determine', 'RCM decision for an entry and answers'], ['POST /api/setoff', 'Optimal set-off'], ['POST /api/report/excel', 'Excel MIS download'], ['GET /api/db/query?n=1..14', 'Run analytical SQL']], [3000, 6026], { caption: 'REST API endpoints' }));
add(shot('33_ai_lab_python_linked', 'Web app linked to the Python engine (scikit-learn results shown)'));
add(code(['$ python backend/gstiq_cli.py --client C5 --period 2026-08 --excel', ' TechNova Software Solutions Pvt Ltd | Software development & IT exports', ' Total GST on inward supplies             Rs 79,16,751.71', ' Eligible ITC                             Rs 40,63,188.45', ` GSTR-3B 2026-08: net ITC ... | DRC-01C risk: YES`, ' Excel MIS saved -> output/GSTiQ_MIS_C5_2026-08.xlsx']));
add(H2('Excel working model and VBA'));
add(P('`excel/ITC_RCM_Working_Model.xlsx` reproduces the core rules with 1,281 Excel formulas and no hard-coded results: an ITC register where each row computes the tax split, financial year, Section 16(4) deadline, days unpaid, Rule 37 status, blocked clause (VLOOKUP on HSN/SAC) and ITC status; a GSTIN check-digit validator written as a single SUMPRODUCT formula; an RCM calculator with time of supply, due date and interest; Rule 42/43 using SUMIFS over the register; a set-off sheet; an interest calculator; a GSTR-3B summary and a dashboard with a chart. `excel/GSTiQ_Macros.bas` adds VBA user-defined functions (GSTIN_VALID, SEC16_4_DEADLINE, RCM_TOS, INTEREST_SEC50, RULE42_D1) and macros to colour risky rows, validate all GSTINs, draft vendor letters and export the register.'));
add(H2('Usability'));
add(P('The interface follows the viewer\'s light or dark preference, works at phone width without horizontal scrolling, supports keyboard search (Ctrl+K) across pages, clients, invoices and vendors, and prints reports cleanly.'));
add(shot('31_dashboard_dark', 'Dark theme'));
add(img('docs/screenshots/32_mobile_dashboard.png', 'Phone layout', 260, 520));

add(H1('Case study on dummy data'));
add(H2('Data set'));
add(P(`The data generator (\`backend/data_generator.py\`, seed 2026) creates a CA firm ("Desai Mehta & Associates", fictitious) with five clients of different profiles, ${S.data.vendors} vendors with valid GSTIN check digits, ${S.data.purchases} purchase invoices from January to September 2026 (plus late FY 2024-25 and FY 2025-26 bills), ${S.data.gstr2b} GSTR-2B records and a monthly outward-supply summary. Errors are injected deliberately: invoice-number format differences, value and date mismatches, GSTIN typos, suppliers who did not file, a cancelled supplier, duplicates, unpaid bills, unpaid RCM, missing self-invoices, a pre-GST 2.0 rate after 22 September 2025, and a large ITC claim not in GSTR-2B.`));
add(...table(['Client', 'Business', 'State', 'Bills', 'GST on purchases'], C.map(c => [c.name, c.business, c.state, c.bills, inr(c.tax)]), [2600, 2700, 1200, 700, 1826], { caption: 'Clients in the demo data set', right: [3, 4] }));
add(H2('ITC position'));
add(...table(['Client', 'Eligible', 'Blocked', 'At risk', 'Deferred', 'Lapsed', 'Claimed but not eligible'], C.map(c => [c.name.split(' ').slice(0, 2).join(' '), lakh(c.eligible), lakh(c.blocked), lakh(c.at_risk), lakh(c.deferred), lakh(c.lapsed), lakh(c.wrong)]).concat([['**Total**', lakh(T.eligible), lakh(T.blocked), lakh(T.at_risk), lakh(T.deferred), lakh(T.lapsed), lakh(T.wrong)]]), [1726, 1200, 1200, 1200, 1200, 1100, 1400], { caption: 'ITC classification by client (all figures in Rs lakh)', right: [1, 2, 3, 4, 5, 6], size: 15 }));
add(P(`Of the total input GST of ${lakh(T.tax)}, ${((T.eligible / T.tax) * 100).toFixed(1)}% is eligible. The most significant finding is that ${lakh(T.wrong)} has already been claimed in returns but is not eligible as on the evaluation date - mainly bills not reflected in GSTR-2B, blocked credits (motor vehicles, food, club membership, gifts, CSR, own construction) and Rule 37/37A reversals.`));
add(H2('Reconciliation and reverse charge'));
const st = ['MATCHED', 'MATCHED_FUZZY', 'MISMATCH_VALUE', 'MISMATCH_DATE', 'GSTIN_MISMATCH', 'MISSING_IN_2B', 'MISSING_IN_BOOKS', 'DUPLICATE_IN_BOOKS'];
add(...table(['Client', 'Matched', 'Fuzzy', 'Value diff', 'Date diff', 'GSTIN', 'Missing 2B', 'Missing books', 'Dup.'], C.map(c => [c.name.split(' ').slice(0, 2).join(' '), ...st.map(k => c.recon[k] || 0)]), [1826, 900, 900, 950, 900, 850, 950, 950, 800], { caption: 'Reconciliation results', right: [1, 2, 3, 4, 5, 6, 7, 8], size: 15 }));
add(...table(['Client', 'RCM bills', 'RCM tax', 'Overdue', 'Interest u/s 50', 'Vendors graded C/D', 'Anomalies'], C.map(c => [c.name.split(' ').slice(0, 2).join(' '), c.rcm_n, inr(c.rcm_tax), c.rcm_overdue, inr(c.rcm_interest, 2), (c.grades.C || 0) + (c.grades.D || 0), c.anomalies]), [1826, 1000, 1500, 900, 1400, 1300, 1100], { caption: 'Reverse charge, vendor risk and anomalies', right: [1, 2, 3, 4, 5, 6], size: 15 }));
add(H2('GSTR-3B for Saurashtra Agro Exports - September 2026'));
const t3 = S.c1sep.tables, row3 = (k) => [k, KB.gstr3b_tables[k] || '', inr(t3[k].igst, 2), inr(t3[k].cgst, 2), inr(t3[k].sgst, 2)];
add(...table(['Table', 'Description', 'IGST', 'CGST', 'SGST'], ['3.1(d)', '4A(3)', '4A(5)', '4B(1)', '4B(2)', '4C'].map(row3), [800, 3626, 1500, 1550, 1550], { caption: 'GSTR-3B working (extract)', right: [2, 3, 4], size: 15 }));
add(P(`Table 4B(2) carries the Rule 37 reversal for March 2026 bills that remained unpaid for 180 days. Because the IGST reversal exceeds the IGST credit of the month, the negative balance is added to output tax in the set-off. Net ITC in Table 4C is ${inr(S.c1sep.net, 2)} against ${inr(S.c1sep.claimed, 2)} claimed in the books, and the set-off gives total cash of ${inr(S.c1sep.setoff.cash_total, 2)} including RCM.`));
add(H2('DRC-01C scenario - TechNova Software Solutions, August 2026'));
add(P(`TechNova claimed ITC of ${inr(S.drc.claimed, 2)} in August 2026 whereas GSTR-2B (including RCM credit) supported only ${inr(S.drc.available, 2)}, mainly because a supplier had not uploaded a Rs 1.65 crore data-centre invoice. The excess of ${inr(S.drc.excess, 2)} (${S.drc.excess_pct.toFixed(0)}%) is above both Rule 88D limits, so GSTiQ raises a high-priority insight to pay through DRC-03 or prepare a Part B explanation before the intimation arrives. The same invoice is also flagged by the Isolation Forest as a value outlier for that vendor.`));
add(H2('AI results'));
add(bullets([`Expense classifier: 5-fold cross-validated accuracy ${(S.cv.mean_accuracy * 100).toFixed(1)}% (+/- ${(S.cv.std * 100).toFixed(1)}) over 18 classes in Python and about 84% for the browser Naive Bayes; 88% when grouped into eligible / blocked / RCM.`, 'Agreement between the classifier and the rule engine on the blocked / not-blocked decision for the real register lines: 97.4% (the rest are surfaced for review).', `Anomaly detection flagged ${C.reduce((a, c) => a + c.anomalies, 0)} bills across the five clients, including all booked duplicates (same vendor and amount within 10 days) and the Rs 1.65 crore outlier.`, `Benford's law: ${C.map(c => c.name.split(' ')[0] + ' - ' + c.benford.toLowerCase()).join('; ')}. Deviations in small, narrow-range populations are expected and are treated as audit pointers only.`, `Vendor risk: ${C.reduce((a, c) => a + (c.grades.D || 0), 0)} vendors graded D (critical) - all of them either cancelled or chronic non-filers - with a recommendation to hold payments.`]));

add(H1('Testing and validation'));
add(H2('Test strategy'));
add(...table(['Level', 'What is tested', 'Tool', 'Result'], [['Unit', '23 tests: GSTIN check digit, 16(4) dates, eligibility, blocked credits and exceptions, Rule 37/37A, GST 2.0 rates, RCM decisions (incl. composition-tenant exclusion), time of supply, set-off, DRC-01C, fuzzy reconciliation', 'Python unittest', 'All passed'], ['Cross-language', `Python and JavaScript engines on all ${S.data.purchases} invoices: reconciliation status, ITC status, every flag, totals, RCM interest, GSTR-3B for four periods per client`, 'Node.js + unittest', 'Identical'], ['User interface', 'All 20 pages render without JavaScript errors; invoice drawer, RCM wizard, chatbot, GSTR-3B drill-down, self-invoice, Excel download, CSV import, dark mode, phone width without overflow', 'Playwright + headless Chromium', 'Passed'], ['Spreadsheet', 'Recalculation of the Excel model and the Python MIS', 'LibreOffice', '1,281 + 162 formulas, 0 errors'], ['Notebook', 'End-to-end execution of all cells', 'nbclient', '0 errors, 4 charts'], ['API', 'Health, classify, RCM decision, chat, Excel report, SQL query; web app linked to Python', 'curl + Playwright', 'Passed']], [1400, 4426, 1800, 1400], { caption: 'Testing summary', size: 15 }));
add(H2('Sample test cases'));
add(...table(['ID', 'Scenario', 'Expected', 'Actual'], [['T1', 'Motor car HSN 8703, used by director', 'Blocked u/s 17(5)(a)', 'Blocked u/s 17(5)(a)'], ['T2', 'Cement used by works contractor for a customer project', 'Not blocked (exception)', 'Eligible'], ['T3', 'Invoice dated 01-03-2026, unpaid on 29-10-2026', 'Reverse under Rule 37', 'REVERSE_37'], ['T4', 'FY 2024-25 bill never claimed', 'Time-barred u/s 16(4)', 'TIME_BARRED'], ['T5', 'Supplier did not file GSTR-3B by 30-09-2026 (FY 2025-26 bill)', 'Reverse under Rule 37A', 'REVERSE_37A'], ['T6', '12% invoice dated after 22-09-2025', 'Flag GST 2.0 rate', 'RATE_INVALID flag'], ['T7', 'Legal fees Rs 50,000, business entity above threshold', 'RCM 18%: CGST 4,500 + SGST 4,500', 'As expected'], ['T8', 'Commercial rent from unregistered landlord to composition tenant', 'No RCM', 'No RCM'], ['T9', 'Service invoice 01-07-2026 paid 15-10-2026', 'Time of supply 30-08-2026 (61st day)', '30-08-2026'], ['T10', 'Liability 1,500/600/600; credit 1,000/300/500', 'Cash 500/300/100', 'Cash 500/300/100'], ['T11', 'Claimed Rs 40 lakh vs Rs 10 lakh in 2B', 'DRC-01C risk', 'Risk = true'], ['T12', '"INV/0451/26-27" vs "INV-451-2627" in 2B', 'Matched', 'Matched']], [700, 4100, 2300, 1926], { caption: 'Selected test cases', size: 15 }));
add(H2('Verification against manual computation'));
add(P(`The Rule 42 reversal for Saurashtra Agro Exports for September 2026 was computed by hand as (2,753,336 / 31,955,843) x 43,129.07 = ${inr(r42.D1, 2)}; the Python engine, the JavaScript engine and the Excel model each return exactly this figure. The set-off illustration of Chapter 2 is reproduced by all three implementations.`));

add(H1('Conclusion'));
add(H2('Benefits to a CA office'));
add(bullets(['Hours of monthly reconciliation reduced to minutes, with fuzzy matching that tolerates real-world data errors.', 'Every ITC decision is explained with the section or rule, which improves review quality and training of article assistants.', 'Early warnings for the costliest errors: Section 16(4) lapse, Rule 37/37A reversals, blocked credits claimed, DRC-01C exposure and unpaid RCM.', 'Client-ready outputs - MIS workbook, review report, vendor letters, self-invoices - generated from the same analysis.', 'Practice-level view of all clients for partners, and a knowledge hub that keeps the team current with recent changes.']));
add(H2('Limitations'));
add(bullets(['No live connection to the GST portal; GSTR-2B must be downloaded and imported.', 'Blocked-credit detection depends on narrations, HSN/SAC and usage tags; unusual narrations need human review.', 'Data is dummy; AI models need retraining on an office\'s own data before production use.', 'Law changes (for example the 57th GST Council recommendations once notified) require updating the knowledge base.']));
add(H2('Future scope'));
add(bullets(['Integration with a GST Suvidha Provider API to fetch GSTR-2B and supplier filing status automatically.', 'OCR of scanned invoices and e-invoice IRN/QR verification.', 'A large-language-model assistant grounded in the knowledge base and the client\'s data, with citations.', 'Support for the Electronic Credit Reversal and Reclaim Statement and the RCM statement proposed by the 57th GST Council, once notified.', 'Multi-user deployment with role-based access for partners, managers and article assistants.']));
add(H2('Conclusion'));
add(P('The project shows that the GST provisions on input tax credit and reverse charge can be encoded as a transparent rules engine, and that artificial intelligence adds most value around it - reading narrations, tolerating imperfect data, finding unusual patterns and answering questions - rather than replacing professional judgement. Built with HTML, CSS, JavaScript, Python, SQL, Excel/VBA and Jupyter, GSTiQ is a complete, tested and practical tool that a CA office can use to make ITC and RCM compliance faster, more accurate and easier to explain to clients.'));

add(HX('References'));
add(numbered(['Central Goods and Services Tax Act, 2017 (as amended up to the Finance Act, 2025) - Sections 2, 9, 12, 13, 16, 17, 18, 24, 31, 34, 49, 49A, 49B, 50, 51.', 'Integrated Goods and Services Tax Act, 2017 - Sections 5(3), 5(4), 7, 8.', 'Central Goods and Services Tax Rules, 2017 - Rules 36, 37, 37A, 42, 43, 46, 47A, 52, 86B, 88A, 88B, 88D.', 'Notification 13/2017-Central Tax (Rate) and 10/2017-Integrated Tax (Rate) - services under reverse charge, as amended (incl. 05/2022, 09/2024, 07/2025).', 'Notification 04/2017-Central Tax (Rate) - goods under reverse charge, as amended by 06/2024-Central Tax (Rate) (metal scrap).', 'Notification 25/2024-Central Tax - GST-TDS on metal scrap.', 'CBIC Circulars 140/10/2020-GST, 170/02/2022-GST and 211/5/2024-GST.', 'GST Council, press releases of the 56th meeting (3 September 2025) and 57th meeting (8 October 2026).', 'GSTN advisories on the Invoice Management System (IMS) and GSTR-2B.', 'Chief Commissioner of CGST v. Safari Retreats Pvt. Ltd., Supreme Court, 2024; Union of India v. Mohit Minerals Pvt. Ltd., Supreme Court, 2022; Union of India v. Bharti Airtel Ltd., Supreme Court, 2021; Suncraft Energy Pvt. Ltd. v. Assistant Commissioner, Calcutta High Court, 2023.', 'ICAI, Background Material and Study Material on GST (Indirect Tax Laws).', 'Liu, F. T., Ting, K. M. and Zhou, Z.-H., "Isolation Forest", IEEE ICDM, 2008.', 'Nigrini, M. J., Benford\'s Law: Applications for Forensic Accounting, Auditing, and Fraud Detection, Wiley, 2012.', 'Pedregosa et al., "Scikit-learn: Machine Learning in Python", JMLR 12, 2011; Flask, Chart.js and SheetJS documentation.']));

add(HX('Annexure A: How to run the project'));
add(code(['1. Offline (no installation)', '   Double-click  dist/GSTiQ_Standalone.html  - works in Chrome, Edge or Firefox without internet.', '', '2. With the Python engine (adds scikit-learn, SQL database, Excel MIS)', '   pip install -r requirements.txt', '   python backend/app.py            -> open http://127.0.0.1:5000', '   (Windows: double-click run_windows.bat)', '', '3. Command line', '   python backend/gstiq_cli.py --client C2 --period 2026-08 --excel', '   python backend/gstiq_cli.py --classify "Freight paid to Sai Roadlines"', '   python backend/database.py --queries', '', '4. Tests', '   python tests/test_engine.py', '   python tests/test_cross_language.py', '   python tests/ui_smoke_test.py', '', '5. Rebuild data and bundles', '   python backend/data_generator.py && python tools/build.py']));
add(HX('Annexure B: Project folder structure'));
add(code(['GSTiQ_ITC_RCM_Project/', '|-- dist/        GSTiQ_Standalone.html (single-file offline app)', '|-- app/         index.html, css/, js/ (core, engine, ai, io, ui, app, 6 view files), vendor/, fonts/', '|-- backend/     Flask API, engines (recon, itc, rcm, returns), ai_engine, report_generator, database, CLI, data_generator', '|-- knowledge/   build_knowledge.py -> gst_knowledge.json (law as data)', '|-- data/        dummy CSV / JSON / Excel data, GST-portal GSTR-2B JSON files', '|-- database/    schema.sql, queries.sql, gstiq.db', '|-- excel/       ITC_RCM_Working_Model.xlsx, GSTiQ_Macros.bas, build script', '|-- notebooks/   AI_ITC_RCM_Analysis.ipynb', '|-- tests/       unit, cross-language and UI tests', '|-- docs/        this report, diagrams, screenshots', '|-- tools/       build.py (bundles the offline app)', '|-- README.md, requirements.txt, run_windows.bat, run_mac_linux.sh']));
add(HX('Annexure C: Glossary'));
add(...table(['Term', 'Meaning'], [['DRC-01C', 'Intimation of difference between ITC in GSTR-3B and GSTR-2B (Rule 88D)'], ['ECL / ECrL', 'Electronic cash ledger / electronic credit ledger'], ['GSTR-2B', 'Auto-drafted monthly ITC statement'], ['IMS', 'Invoice Management System - accept / reject / pending supplier documents'], ['ISD', 'Input Service Distributor'], ['GTA', 'Goods Transport Agency'], ['ToS', 'Time of supply'], ['MAD', 'Mean absolute deviation (Benford test)'], ['CV', 'Cross-validation - accuracy measured on data not used for training'], ['Isolation Forest', 'Unsupervised anomaly-detection algorithm based on random partitioning']], [2200, 6826], {}));

// ---------------------------------------------------------------- TOC
function tocParas() {
  return TOC_ITEMS.map(([lvl, t]) => new Paragraph({ spacing: { after: lvl === 1 ? 80 : 30, before: lvl === 1 ? 100 : 0 }, indent: { left: lvl === 1 ? 0 : 360 },
    tabStops: [{ type: TabStopType.RIGHT, position: W, leader: 'dot' }],
    children: [new TextRun({ text: t, bold: lvl === 1, size: lvl === 1 ? 21 : 19 }), new TextRun({ children: [new Tab(), String(PAGES[t] || '')], size: lvl === 1 ? 21 : 19, bold: lvl === 1 })] }));
}
const frontFinal = []; front.forEach(x => x === 'TOC_PLACEHOLDER' ? frontFinal.push(...tocParas()) : frontFinal.push(x));

const footer = (fmt) => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '666666' })] })] });
const header = new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: W }], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C8D0DC', space: 4 } }, children: [new TextRun({ text: 'AI & GST Act, 2017 - ITC and RCM', size: 16, color: '666666' }), new TextRun({ children: [new Tab(), 'GSTiQ · ICAI Advanced IT project'], size: 16, color: '666666' })] })] });
const margin = { top: 1300, right: 1440, bottom: 1300, left: 1440 };

const doc = new Document({
  creator: 'Lakhnotra Bharat Bholabhai', title: 'AI and GST Act 2017 - ITC and RCM - Project Report', description: 'ICAI Advanced IT project report - GSTiQ',
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 34, bold: true, color: INK, font: FONT }, paragraph: { spacing: { before: 120, after: 240 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: SAFF, space: 6 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, color: INK, font: FONT }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: '333333', font: FONT }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2, keepNext: true } }]
  },
  numbering: { config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] }] },
  sections: [
    { properties: { page: { margin } }, children: cover },
    { properties: { page: { margin, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } } }, footers: { default: footer() }, children: frontFinal },
    { properties: { page: { margin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } }, headers: { default: header }, footers: { default: footer() }, children: body }]
});
const out = path.join(ROOT, 'docs', 'GSTiQ_Project_Report.docx');
Packer.toBuffer(doc).then(b => { fs.writeFileSync(out, b); fs.writeFileSync(path.join(ROOT, 'docs', 'toc_items.json'), JSON.stringify(TOC_ITEMS)); console.log('written', out, (b.length / 1024).toFixed(0) + ' KB', fig, 'figures', tab, 'tables'); });
