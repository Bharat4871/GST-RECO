// Builds presentation/GSTiQ_Group_One_Presentation.pptx   (node presentation/build_ppt.js)
// Interactive: clickable agenda, Menu button on every slide, case quiz with hidden answer slides,
// live-demo deep links, QR codes, slide transitions, speaker notes on every slide.
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const { applyTheme } = require("/root/.claude/skills/synced/b83fc6d6-2d29-489a-beaa-5253c4d6e018_7fb7c657-a65a-4b2e-92e5-28763de8d612/pptx/scripts/apply_theme.js");

const ROOT = path.join(__dirname, "..");
const SHOT = (f) => path.join(ROOT, "docs", "screenshots", f);
const STATS = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "report_stats.json"), "utf8"));
const OUT = path.join(__dirname, "GSTiQ_Group_One_Presentation.pptx");
const SITE = "https://humaregrouponekaproject.online";
const REPO = "https://github.com/Bharat4871/GST-RECO";

const HEX = {
  ink: "132134", navy: "0F1B2D", paper: "FFFFFF", mist: "F1F4F8", line: "D9E0EA",
  blue: "1D4D9C", saffron: "A96C12", green: "17763F", red: "B42318", slate: "5B6B80", gold: "E3A740",
  sky: "C9D8F2",
};
const THEME = {
  name: "GSTiQ Ledger", headFontFace: "Cambria", bodyFontFace: "Calibri",
  colors: { dk1: HEX.ink, lt1: HEX.paper, dk2: HEX.navy, lt2: HEX.mist, accent1: HEX.blue, accent2: HEX.saffron, accent3: HEX.green,
    accent4: HEX.red, accent5: HEX.slate, accent6: HEX.gold, hlink: HEX.blue, folHlink: "6B3FA0" },
};

const MEMBERS = [
  ["Dudhat Ankur", "WRO0738763"], ["Hariom Bhati", "CRO0694015"], ["Bharat Lakhnotra", "WRO0752641"], ["Takshil Chodvadiya", "WRO0758843"],
];

const L = (n) => (n / 100000); // rupees -> lakh
const lakh = (n) => `₹${(n / 100000).toFixed(2)} L`;
const T = STATS.totals;

// ---------- icons
async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pres.title = "GSTiQ - AI & GST: ITC and RCM";
  pres.author = "Group One";
  pres.company = "Group One";
  pres.subject = "ICAI AICITSS Advanced IT project";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const W = 13.333, H = 7.5;

  // ---------- layouts
  pres.defineSlideMaster({
    title: "Title Dark", background: { color: HEX.navy },
    objects: [],
  });
  pres.defineSlideMaster({
    title: "Section Divider", background: { color: HEX.navy },
    objects: [
      { placeholder: { options: { name: "num", type: "body", x: 0.8, y: 1.55, w: 4, h: 1.6, fontSize: 96, bold: true, color: C.accent6, fontFace: "Cambria", margin: 0, valign: "bottom", align: "left" }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 3.25, w: 9.5, h: 1.2, fontSize: 44, bold: true, color: C.background1, margin: 0, valign: "top", align: "left" }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.5, w: 8.6, h: 1.4, fontSize: 18, color: "C9D8F2", margin: 0, valign: "top", align: "left" }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "Content", background: { color: HEX.paper },
    margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 10.9, h: 0.85, fontSize: 32, bold: true, color: C.text1, margin: 0, valign: "middle", align: "left" }, text: "" } },
      { text: { text: "GSTiQ  ·  Group One  ·  ICAI AICITSS – Advanced IT", options: { x: 0.6, y: 7.0, w: 7, h: 0.3, fontSize: 10, color: "6F7D90", fontFace: "Calibri", margin: 0 } } },
    ],
    slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: "6F7D90", fontFace: "Calibri", align: "right" },
  });

  // ---------- icons used
  const I = {};
  const need = {
    bars: [fa.FaBars, HEX.blue], law: [fa.FaBalanceScale, "FFFFFF"], robot: [fa.FaRobot, "FFFFFF"], sync: [fa.FaSyncAlt, "FFFFFF"],
    invoice: [fa.FaFileInvoiceDollar, "FFFFFF"], exch: [fa.FaExchangeAlt, "FFFFFF"], calc: [fa.FaCalculator, "FFFFFF"], db: [fa.FaDatabase, "FFFFFF"],
    excel: [fa.FaFileExcel, "FFFFFF"], python: [fa.FaPython, "FFFFFF"], html: [fa.FaHtml5, "FFFFFF"], js: [fa.FaJsSquare, "FFFFFF"],
    chart: [fa.FaChartLine, "FFFFFF"], shield: [fa.FaShieldAlt, "FFFFFF"], users: [fa.FaUsers, "FFFFFF"], clock: [fa.FaClock, "FFFFFF"],
    ban: [fa.FaBan, "FFFFFF"], check: [fa.FaCheckCircle, "FFFFFF"], warn: [fa.FaExclamationTriangle, "FFFFFF"], car: [fa.FaCar, "FFFFFF"],
    food: [fa.FaUtensils, "FFFFFF"], gift: [fa.FaGift, "FFFFFF"], health: [fa.FaHeartbeat, "FFFFFF"], club: [fa.FaGlassCheers, "FFFFFF"],
    building: [fa.FaBuilding, "FFFFFF"], plane: [fa.FaPlane, "FFFFFF"], csr: [fa.FaHandsHelping, "FFFFFF"], user: [fa.FaUser, "FFFFFF"],
    truck: [fa.FaTruck, "FFFFFF"], gavel: [fa.FaGavel, "FFFFFF"], warehouse: [fa.FaWarehouse, "FFFFFF"], guard: [fa.FaUserShield, "FFFFFF"],
    tie: [fa.FaUserTie, "FFFFFF"], globe: [fa.FaGlobeAsia, "FFFFFF"], recycle: [fa.FaRecycle, "FFFFFF"], horn: [fa.FaBullhorn, "FFFFFF"],
    code: [fa.FaLaptopCode, "FFFFFF"], chat: [fa.FaCommentDots, "FFFFFF"], search: [fa.FaSearch, "FFFFFF"], brain: [fa.FaBrain, "FFFFFF"],
    bar: [fa.FaChartBar, "FFFFFF"], imp: [fa.FaFileImport, "FFFFFF"], exp: [fa.FaFileExport, "FFFFFF"], dbl: [fa.FaCheckDouble, "FFFFFF"],
    bulb: [fa.FaLightbulb, "FFFFFF"], rocket: [fa.FaRocket, "FFFFFF"], back: [fa.FaArrowLeft, "FFFFFF"], cogs: [fa.FaCogs, "FFFFFF"],
    sitemap: [fa.FaSitemap, "FFFFFF"], bolt: [fa.FaBolt, "FFFFFF"], lock: [fa.FaLock, "FFFFFF"], mobile: [fa.FaMobileAlt, "FFFFFF"],
    book: [fa.FaBook, "FFFFFF"], play: [fa.FaPlayCircle, "FFFFFF"], question: [fa.FaQuestion, "FFFFFF"], cube: [fa.FaCube, "FFFFFF"],
    tasks: [fa.FaTasks, "FFFFFF"], percent: [fa.FaPercent, "FFFFFF"], github: [fa.FaGithub, "FFFFFF"], link: [fa.FaExternalLinkAlt, "FFFFFF"],
    times: [fa.FaTimesCircle, "FFFFFF"], hourglass: [fa.FaHourglassHalf, "FFFFFF"], list: [fa.FaListAlt, "FFFFFF"], target: [fa.FaBullseye, "FFFFFF"],
    barsW: [fa.FaBars, "FFFFFF"], timesRed: [fa.FaTimesCircle, "B42318"], fingerprint: [fa.FaFingerprint, "FFFFFF"], cart: [fa.FaShoppingCart, "FFFFFF"],
  };
  for (const [k, [comp, col]] of Object.entries(need)) I[k] = await icon(comp, col);

  // ---------- slide plan (numbers needed for hyperlinks)
  const order = [
    "title", "agenda", "team",
    "d1", "problem", "objectives",
    "d2", "sec16", "sec175", "rcm", "reversal", "whatsnew",
    "d3", "arch", "stack", "workflow", "recon", "itc", "rcmtool", "returns",
    "d4", "aimodels", "airesults", "mitra",
    "d5", "data", "io", "quiz", "demo", "testing",
    "d6", "benefits", "future", "thanks",
    "q1", "q2", "q3", "q4",
  ];
  const N = (k) => order.indexOf(k) + 1;
  let sectionsAdded = new Set();
  const SECT = {
    title: "Opening", agenda: "Opening", team: "Opening",
    d1: "01 Why this project", problem: "01 Why this project", objectives: "01 Why this project",
    d2: "02 The law", sec16: "02 The law", sec175: "02 The law", rcm: "02 The law", reversal: "02 The law", whatsnew: "02 The law",
    d3: "03 The solution", arch: "03 The solution", stack: "03 The solution", workflow: "03 The solution", recon: "03 The solution", itc: "03 The solution", rcmtool: "03 The solution", returns: "03 The solution",
    d4: "04 Artificial intelligence", aimodels: "04 Artificial intelligence", airesults: "04 Artificial intelligence", mitra: "04 Artificial intelligence",
    d5: "05 Data, demo & testing", data: "05 Data, demo & testing", io: "05 Data, demo & testing", quiz: "05 Data, demo & testing", demo: "05 Data, demo & testing", testing: "05 Data, demo & testing",
    d6: "06 Conclusion", benefits: "06 Conclusion", future: "06 Conclusion", thanks: "06 Conclusion",
    q1: "Quiz answers (hidden)", q2: "Quiz answers (hidden)", q3: "Quiz answers (hidden)", q4: "Quiz answers (hidden)",
  };
  const made = [];
  function slideFor(key, masterName) {
    const sec = SECT[key];
    if (!sectionsAdded.has(sec)) { pres.addSection({ title: sec }); sectionsAdded.add(sec); }
    const s = pres.addSlide({ masterName, sectionTitle: sec });
    if (made.length + 1 !== N(key)) throw new Error(`slide order mismatch at ${key}: ${made.length + 1} vs ${N(key)}`);
    made.push(key);
    return s;
  }

  // ---------- helpers
  const shadow = () => ({ type: "outer", color: "0F1B2D", blur: 8, offset: 2, angle: 90, opacity: 0.12 });
  function menuBtn(s, dark = false) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 11.75, y: 0.5, w: 1.0, h: 0.5, rectRadius: 0.1, fill: { color: dark ? HEX.navy : HEX.mist }, line: { color: dark ? "33445E" : HEX.line, width: 0.75 }, objectName: "Menu button" });
    s.addImage({ data: dark ? I.barsW : I.bars, x: 11.86, y: 0.62, w: 0.24, h: 0.24, hyperlink: { slide: N("agenda"), tooltip: "Back to agenda" }, altText: "Menu" });
    s.addText([{ text: "Menu", options: { hyperlink: { slide: N("agenda"), tooltip: "Back to agenda" }, color: dark ? "FFFFFF" : HEX.blue } }],
      { x: 12.12, y: 0.5, w: 0.6, h: 0.5, fontSize: 12, bold: true, margin: 0, valign: "middle", isTextBox: true, objectName: "Menu link" });
  }
  function tile(s, x, y, size, ic, fillColor) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: size, h: size, rectRadius: size * 0.22, fill: { color: fillColor }, line: { color: fillColor }, objectName: "Icon tile" });
    const p = size * 0.24;
    s.addImage({ data: ic, x: x + p, y: y + p, w: size - 2 * p, h: size - 2 * p, altText: "icon" });
  }
  function card(s, x, y, w, h, fill = HEX.mist, opts = {}) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: opts.line || fill, width: 0.75 }, shadow: opts.shadow ? shadow() : undefined, objectName: opts.name || "Card" });
  }
  function shot(s, file, x, y, w, caption) {
    const h = w / 1.6;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12, rectRadius: 0.08, fill: { color: HEX.paper }, line: { color: HEX.line, width: 0.75 }, shadow: shadow(), objectName: "Screenshot frame" });
    s.addImage({ path: SHOT(file), x, y, w, h, altText: caption || file });
    if (caption) s.addText(caption, { x, y: y + h + 0.12, w, h: 0.3, fontSize: 11, color: "6F7D90", italic: true, margin: 0, isTextBox: true });
    return h;
  }
  function body(s, runs, x, y, w, h, size = 15, color) {
    s.addText(runs, { x, y, w, h, fontSize: size, color: color || C.text1, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 10 });
  }
  const bullets = (arr, size) => arr.map((t, i) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: i < arr.length - 1, fontSize: size } }));
  function stat(s, x, y, w, big, label, color) {
    s.addText(big, { x, y, w, h: 0.75, fontSize: 36, bold: true, color: color || C.accent1, fontFace: "Cambria", margin: 0, valign: "bottom", isTextBox: true });
    s.addText(label, { x, y: y + 0.78, w, h: 0.55, fontSize: 13, color: "445468", margin: 0, valign: "top", isTextBox: true });
  }
  function divider(key, num, title, sub, notes) {
    const s = slideFor(key, "Section Divider");
    s.addText(num, { placeholder: "num" });
    s.addText(title, { placeholder: "title" });
    s.addText(sub, { placeholder: "body" });
    s.addShape(pres.shapes.OVAL, { x: 9.6, y: 1.2, w: 4.6, h: 4.6, fill: { color: "16294A" }, line: { color: "16294A" }, objectName: "Decor circle" });
    s.addShape(pres.shapes.OVAL, { x: 10.6, y: 2.2, w: 2.6, h: 2.6, fill: { color: HEX.blue }, line: { color: HEX.blue }, objectName: "Decor circle inner" });
    menuBtn(s, true);
    s.addNotes(notes);
    return s;
  }

  // =========================== 1 TITLE
  {
    const s = slideFor("title", "Title Dark");
    s.addText("ICAI  ·  AICITSS – ADVANCED INFORMATION TECHNOLOGY  ·  PROJECT PRESENTATION", { x: 0.8, y: 0.6, w: 9.5, h: 0.4, fontSize: 12, color: HEX.gold, bold: true, charSpacing: 2, margin: 0, isTextBox: true });
    tile(s, 0.8, 1.35, 0.95, I.law, HEX.blue);
    s.addText("GSTiQ", { x: 1.95, y: 1.25, w: 6, h: 1.15, fontSize: 66, bold: true, color: "FFFFFF", fontFace: "Cambria", margin: 0, valign: "middle", isTextBox: true });
    s.addText("Artificial Intelligence & the Goods and Services Tax Act, 2017", { x: 0.8, y: 2.6, w: 8.6, h: 0.5, fontSize: 24, color: "FFFFFF", fontFace: "Cambria", margin: 0, isTextBox: true });
    s.addText("Input Tax Credit (ITC) and Reverse Charge Mechanism (RCM) — an AI-powered suite for a CA office", { x: 0.8, y: 3.1, w: 8.6, h: 0.8, fontSize: 17, color: "C9D8F2", margin: 0, valign: "top", isTextBox: true });
    s.addText("Submitted by GROUP ONE", { x: 0.8, y: 4.25, w: 6, h: 0.4, fontSize: 14, bold: true, color: HEX.gold, charSpacing: 1, margin: 0, isTextBox: true });
    MEMBERS.forEach(([n, r], i) => {
      const x = 0.8 + (i % 2) * 4.2, y = 4.75 + Math.floor(i / 2) * 0.82;
      card(s, x, y, 3.95, 0.7, "16294A", { line: "2A3D5E", name: "Member card" });
      s.addText([{ text: n, options: { bold: true, color: "FFFFFF", fontSize: 15, breakLine: true } }, { text: "ICAI Reg. No. " + r, options: { color: "AFC0DA", fontSize: 12 } }],
        { x: x + 0.2, y, w: 3.6, h: 0.7, margin: 0, valign: "middle", isTextBox: true });
    });
    card(s, 9.85, 1.3, 2.75, 3.75, "FFFFFF", { name: "QR card" });
    s.addImage({ path: path.join(__dirname, "assets", "qr_site.png"), x: 10.12, y: 1.5, w: 2.2, h: 2.2, hyperlink: { url: SITE, tooltip: "Open the live app" }, altText: "QR code to the live GSTiQ app" });
    s.addText([{ text: "Scan to open the live app", options: { bold: true, color: HEX.ink, breakLine: true, fontSize: 13 } },
      { text: "humaregrouponekaproject.online", options: { color: HEX.blue, fontSize: 11, hyperlink: { url: SITE } } }],
      { x: 9.95, y: 3.8, w: 2.55, h: 1.0, align: "center", margin: 0, valign: "top", isTextBox: true });
    s.addText("Law as on 29-10-2026  ·  all client data is fictitious", { x: 9.85, y: 5.3, w: 2.75, h: 0.6, fontSize: 11, color: "AFC0DA", align: "center", margin: 0, isTextBox: true });
    s.addNotes("Good morning. We are Group One. Our project is GSTiQ - an AI-powered suite that helps a CA office manage Input Tax Credit and Reverse Charge under the GST Act, 2017. Introduce each member by name. The QR code opens the live web app - the audience can follow the demo on their phones. Tip: during the presentation click 'Menu' at the top-right of any slide to jump back to the agenda.");
  }

  // =========================== 2 AGENDA (interactive menu)
  {
    const s = slideFor("agenda", "Content");
    s.addText("Agenda — click any tile to jump there", { placeholder: "title" });
    const items = [
      ["01", "Why this project", "Problems a CA office faces with ITC & RCM", "d1", I.target, HEX.blue],
      ["02", "The law: ITC & RCM", "Sec 16, 17(5), 9(3)/9(4), Rules 36–88D, GST 2.0", "d2", I.law, HEX.saffron],
      ["03", "The solution: GSTiQ", "Architecture, modules, workflow", "d3", I.cogs, HEX.green],
      ["04", "Artificial intelligence", "Six models and how they are used", "d4", I.brain, "6B3FA0"],
      ["05", "Data, demo & testing", "Dummy data, import/export, quiz, live demo", "d5", I.play, HEX.red],
      ["06", "Conclusion", "Benefits and future features", "d6", I.check, HEX.slate],
    ];
    items.forEach(([n, t, d, key, ic, col], i) => {
      const x = 0.6 + (i % 3) * 4.1, y = 1.5 + Math.floor(i / 3) * 2.2;
      card(s, x, y, 3.85, 1.95, HEX.mist, { line: HEX.line, name: "Agenda tile " + n });
      tile(s, x + 0.25, y + 0.3, 0.75, ic, col);
      s.addText(n, { x: x + 2.6, y: y + 0.25, w: 1.0, h: 0.6, fontSize: 30, bold: true, color: col, fontFace: "Cambria", align: "right", margin: 0, isTextBox: true });
      s.addText([{ text: t, options: { hyperlink: { slide: N(key), tooltip: "Go to " + t }, color: HEX.ink } }], { x: x + 0.25, y: y + 1.12, w: 3.4, h: 0.4, fontSize: 18, bold: true, margin: 0, isTextBox: true });
      s.addText(d, { x: x + 0.25, y: y + 1.48, w: 3.4, h: 0.4, fontSize: 12, color: "445468", margin: 0, isTextBox: true });
      s.addImage({ data: ic, x: x + 0.43, y: y + 0.48, w: 0.39, h: 0.39, hyperlink: { slide: N(key), tooltip: "Go to " + t }, altText: t });
    });
    const quick = [["Case quiz", "quiz", I.question, HEX.saffron], ["Live demo", "demo", I.play, HEX.red], ["Testing", "testing", I.dbl, HEX.green], ["Q & A", "thanks", I.chat, HEX.blue]];
    s.addText("Quick jump", { x: 0.6, y: 6.05, w: 1.5, h: 0.45, fontSize: 13, bold: true, color: "445468", margin: 0, valign: "middle", isTextBox: true });
    quick.forEach(([t, key, ic, col], i) => {
      const x = 2.1 + i * 2.45;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 6.05, w: 2.25, h: 0.45, rectRadius: 0.1, fill: { color: col }, line: { color: col }, objectName: "Quick jump " + t });
      s.addImage({ data: ic, x: x + 0.15, y: 6.14, w: 0.27, h: 0.27, hyperlink: { slide: N(key) }, altText: t });
      s.addText([{ text: t, options: { hyperlink: { slide: N(key), tooltip: t }, color: "FFFFFF" } }], { x: x + 0.5, y: 6.05, w: 1.7, h: 0.45, fontSize: 13, bold: true, margin: 0, valign: "middle", isTextBox: true });
    });
    s.addNotes("This agenda is a clickable menu. Click a section title or its icon to jump to that section; the 'Quick jump' buttons go straight to the quiz, the live demo, testing, or Q&A. Every slide has a 'Menu' button (top right) that returns here, so we can answer questions in any order.");
  }

  // =========================== 3 TEAM
  {
    const s = slideFor("team", "Content");
    s.addText("Group One — the team behind GSTiQ", { placeholder: "title" });
    menuBtn(s);
    const cols = [HEX.blue, HEX.saffron, HEX.green, "6B3FA0"];
    MEMBERS.forEach(([n, r], i) => {
      const x = 0.6 + i * 3.1, y = 1.55;
      card(s, x, y, 2.85, 2.9, HEX.mist, { line: HEX.line, name: "Member " + n });
      const initials = n.split(" ").map((p) => p[0]).join("");
      s.addShape(pres.shapes.OVAL, { x: x + 0.92, y: y + 0.3, w: 1.0, h: 1.0, fill: { color: cols[i] }, line: { color: cols[i] }, objectName: "Avatar" });
      s.addText(initials, { x: x + 0.92, y: y + 0.3, w: 1.0, h: 1.0, fontSize: 26, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, fontFace: "Cambria", isTextBox: true });
      s.addText(n, { x: x + 0.1, y: y + 1.5, w: 2.65, h: 0.5, fontSize: 18, bold: true, color: HEX.ink, align: "center", margin: 0, isTextBox: true });
      s.addText([{ text: "ICAI Registration No.", options: { breakLine: true, fontSize: 11, color: "6F7D90" } }, { text: r, options: { fontSize: 16, bold: true, color: cols[i], fontFace: "Consolas" } }],
        { x: x + 0.1, y: y + 2.0, w: 2.65, h: 0.75, align: "center", margin: 0, valign: "top", isTextBox: true });
    });
    card(s, 0.6, 4.75, 12.1, 1.85, "FFFFFF", { line: HEX.line, name: "Project facts" });
    const facts = [["Course", "AICITSS – Advanced Information Technology (ICAI)"], ["Topic", "AI & GST Act, 2017 – Input Tax Credit & Reverse Charge"],
      ["Deliverable", "GSTiQ web app, Python engine, SQL database, Excel model + VBA, AI notebook, report"], ["Live at", "humaregrouponekaproject.online  ·  github.com/Bharat4871/GST-RECO"]];
    facts.forEach(([k, v], i) => {
      const y = 4.92 + i * 0.4;
      s.addText(k, { x: 0.9, y, w: 1.6, h: 0.36, fontSize: 13, bold: true, color: "6F7D90", margin: 0, valign: "middle", isTextBox: true });
      s.addText(v, { x: 2.5, y, w: 10, h: 0.36, fontSize: 14, color: HEX.ink, margin: 0, valign: "middle", isTextBox: true });
    });
    s.addNotes("Group One has four members (read names and registration numbers). Suggested split for presenting: Section 1 & 2 (problem and law) - one member; Section 3 (solution and modules) - one member; Section 4 (AI) - one member; Section 5 & 6 (data, quiz, live demo, testing and conclusion) - one member. Change this to match your own division of work.");
  }

  // =========================== SECTION 1
  divider("d1", "01", "Why this project", "What goes wrong with Input Tax Credit and Reverse Charge in a real CA office — and what we set out to automate.",
    "Section 1. We start with the practical problem, then our objectives.");

  {
    const s = slideFor("problem", "Content");
    s.addText("ITC and RCM are checked bill by bill — by hand", { placeholder: "title" });
    menuBtn(s);
    const pains = [
      [I.sync, HEX.blue, "Books never match GSTR-2B", "Invoice numbers typed differently, wrong GSTINs, suppliers who file late or not at all."],
      [I.ban, HEX.red, "Blocked credits hide in ledgers", "Cars, food, gifts, club fees and construction are claimed by mistake under Sec 17(5)."],
      [I.exch, HEX.saffron, "Reverse charge is missed", "Freight, legal fees, rent from unregistered landlords, director fees — tax and self-invoice forgotten."],
      [I.clock, HEX.green, "Deadlines are unforgiving", "Sec 16(4) time limit, Rule 37 (180 days), Rule 37A, DRC-01C notices and interest u/s 50."],
    ];
    pains.forEach(([ic, col, t, d], i) => {
      const y = 1.55 + i * 1.3;
      tile(s, 0.6, y, 0.8, ic, col);
      s.addText(t, { x: 1.65, y: y - 0.04, w: 5.6, h: 0.42, fontSize: 18, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
      s.addText(d, { x: 1.65, y: y + 0.38, w: 5.6, h: 0.75, fontSize: 14, color: "445468", margin: 0, valign: "top", isTextBox: true });
    });
    card(s, 7.75, 1.5, 4.95, 5.1, HEX.navy, { name: "Stats panel" });
    s.addText("IN OUR DEMO PRACTICE OF 5 CLIENTS", { x: 8.1, y: 1.75, w: 4.4, h: 0.35, fontSize: 12, bold: true, color: HEX.gold, charSpacing: 1, margin: 0, isTextBox: true });
    const st = [["₹2.41 Cr", "GST paid on 609 purchase bills"], [lakh(T.at_risk), "ITC at risk — not in GSTR-2B, unpaid or supplier default"], [lakh(T.wrong), "ITC already claimed that is not eligible today"]];
    st.forEach(([b, l], i) => {
      const y = 2.25 + i * 1.4;
      s.addText(b, { x: 8.1, y, w: 4.4, h: 0.72, fontSize: 38, bold: true, color: "FFFFFF", fontFace: "Cambria", margin: 0, valign: "bottom", isTextBox: true });
      s.addText(l, { x: 8.1, y: y + 0.74, w: 4.4, h: 0.5, fontSize: 13, color: "C9D8F2", margin: 0, valign: "top", isTextBox: true });
    });
    s.addNotes(`Four recurring problems. In our own demo dataset of five fictitious clients, GSTiQ found ${lakh(T.at_risk)} of ITC at risk and ${lakh(T.wrong)} already claimed but not eligible today - exactly the kind of exposure that leads to DRC-01C notices, interest and penalty. Doing this manually for every client every month is slow and error-prone.`);
  }

  {
    const s = slideFor("objectives", "Content");
    s.addText("Six objectives we set for GSTiQ", { placeholder: "title" });
    menuBtn(s);
    const ob = [
      [I.check, HEX.green, "Decide ITC eligibility", "Test every bill against Sec 16, 17(5) and Rules 36(4), 37, 37A — with a reason."],
      [I.sync, HEX.blue, "Reconcile with AI", "Match books with GSTR-2B even when numbers, GSTINs or dates differ."],
      [I.exch, HEX.saffron, "Handle RCM end to end", "Decide applicability, time of supply, cash payment and self-invoice."],
      [I.calc, "6B3FA0", "Prepare returns", "GSTR-3B Tables 3.1(d) & 4, Rule 42/43, set-off, DRC-01C, interest."],
      [I.brain, HEX.red, "Use AI where it helps", "Classify expenses, flag anomalies, score vendors, forecast ITC, answer questions."],
      [I.exp, HEX.slate, "Fit the office workflow", "Import Excel/CSV/portal JSON, export MIS & letters, work fully offline."],
    ];
    ob.forEach(([ic, col, t, d], i) => {
      const x = 0.6 + (i % 3) * 4.1, y = 1.55 + Math.floor(i / 3) * 2.6;
      card(s, x, y, 3.85, 2.35, HEX.mist, { line: HEX.line, name: "Objective " + (i + 1) });
      tile(s, x + 0.3, y + 0.3, 0.7, ic, col);
      s.addText(String(i + 1).padStart(2, "0"), { x: x + 2.7, y: y + 0.25, w: 0.9, h: 0.5, fontSize: 22, bold: true, color: "B7C2D1", align: "right", margin: 0, fontFace: "Cambria", isTextBox: true });
      s.addText(t, { x: x + 0.3, y: y + 1.12, w: 3.3, h: 0.4, fontSize: 18, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
      s.addText(d, { x: x + 0.3, y: y + 1.52, w: 3.3, h: 0.75, fontSize: 13, color: "445468", margin: 0, valign: "top", isTextBox: true });
    });
    s.addNotes("These six objectives drove every design decision. The rule engine is the authority for legal decisions; AI supports it where the data is messy.");
  }

  // =========================== SECTION 2 LAW
  divider("d2", "02", "The law: ITC & RCM", "The provisions GSTiQ encodes — Sections 16, 17(5), 9(3), 9(4) and the Rules that reverse or restrict credit. Position as on 29-10-2026.",
    "Section 2 - the law. Everything here is encoded as data in one knowledge base that both the browser engine and the Python engine read.");

  {
    const s = slideFor("sec16", "Content");
    s.addText("Section 16: conditions for taking ITC", { placeholder: "title" });
    menuBtn(s);
    const cond = [
      ["16(2)(a)", "Possession of tax invoice or debit note"],
      ["16(2)(aa)", "Invoice reflected in GSTR-2B (Rule 36(4))"],
      ["16(2)(b)", "Goods or services actually received"],
      ["16(2)(ba)", "ITC not restricted in GSTR-2B (Sec 38)"],
      ["16(2)(c)", "Tax actually paid to Government by supplier"],
      ["16(2)(d)", "Recipient has filed return u/s 39"],
      ["2nd proviso", "Pay supplier within 180 days, else reverse (Rule 37)"],
    ];
    cond.forEach(([k, v], i) => {
      const y = 1.5 + i * 0.72;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y, w: 1.55, h: 0.56, rectRadius: 0.1, fill: { color: i === 6 ? HEX.saffron : HEX.blue }, line: { color: i === 6 ? HEX.saffron : HEX.blue }, objectName: "Clause chip" });
      s.addText(k, { x: 0.6, y, w: 1.55, h: 0.56, fontSize: 13, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
      s.addText(v, { x: 2.35, y, w: 5.0, h: 0.56, fontSize: 15, color: HEX.ink, valign: "middle", margin: 0, isTextBox: true });
    });
    card(s, 7.85, 1.5, 4.85, 2.75, HEX.navy, { name: "16(4) card" });
    s.addText("SECTION 16(4) — TIME LIMIT", { x: 8.15, y: 1.7, w: 4.3, h: 0.35, fontSize: 12, bold: true, color: HEX.gold, charSpacing: 1, margin: 0, isTextBox: true });
    s.addText("30 November", { x: 8.15, y: 2.05, w: 4.3, h: 0.7, fontSize: 36, bold: true, color: "FFFFFF", fontFace: "Cambria", margin: 0, isTextBox: true });
    s.addText("following the end of the financial year, or the annual return if filed earlier. ITC of FY 2025-26 lapses after 30-11-2026 — only 32 days left on 29-10-2026.", { x: 8.15, y: 2.8, w: 4.3, h: 1.3, fontSize: 13, color: "C9D8F2", margin: 0, valign: "top", isTextBox: true });
    card(s, 7.85, 4.45, 4.85, 2.05, HEX.mist, { line: HEX.line, name: "Relief card" });
    s.addText([{ text: "Relief provisions", options: { bold: true, fontSize: 15, color: HEX.ink, breakLine: true } },
      { text: "16(5): FY 2017-18 to 2020-21 ITC allowed up to 30-11-2021.", options: { fontSize: 13, color: "445468", breakLine: true } },
      { text: "16(6): ITC on registrations revoked after cancellation.", options: { fontSize: 13, color: "445468", breakLine: true } },
      { text: "GSTiQ shows a live countdown for every unclaimed bill.", options: { fontSize: 13, color: HEX.blue, bold: true } }],
      { x: 8.15, y: 4.6, w: 4.3, h: 1.8, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 4 });
    s.addNotes("Section 16 has the core conditions - including clause (aa), which makes GSTR-2B the gatekeeper, and clause (ba) added later. The 180-day payment rule is in the second proviso, operated by Rule 37. Section 16(4) is the hard time limit: for FY 2025-26 the last date is 30 November 2026. GSTiQ shows this countdown on the dashboard.");
  }

  {
    const s = slideFor("sec175", "Content");
    s.addText("Section 17(5): credits that are blocked", { placeholder: "title" });
    menuBtn(s);
    const blk = [
      [I.car, "Motor vehicles ≤ 13 seats", "17(5)(a)–(ab)"], [I.food, "Food, beauty, health services, insurance", "17(5)(b)(i)"],
      [I.club, "Club, health & fitness membership", "17(5)(b)(ii)"], [I.plane, "Travel benefits to employees (LTC)", "17(5)(b)(iii)"],
      [I.building, "Works contract for immovable property", "17(5)(c)"], [I.cube, "Own construction incl. plant or machinery*", "17(5)(d)"],
      [I.percent, "Supplies taxed under composition", "17(5)(e)"], [I.csr, "CSR expenditure", "17(5)(fa)"],
      [I.user, "Goods or services for personal use", "17(5)(g)"], [I.gift, "Goods lost, stolen, destroyed, gifted, free samples", "17(5)(h)"],
      [I.gavel, "Tax paid u/s 74 (fraud demand)", "17(5)(i)"],
    ];
    blk.forEach(([ic, t, ref], i) => {
      const x = 0.6 + (i % 4) * 3.05, y = 1.45 + Math.floor(i / 4) * 1.62;
      card(s, x, y, 2.85, 1.45, HEX.mist, { line: HEX.line, name: "Blocked " + ref });
      tile(s, x + 0.2, y + 0.22, 0.55, ic, HEX.red);
      s.addText(ref, { x: x + 0.9, y: y + 0.22, w: 1.8, h: 0.3, fontSize: 11, bold: true, color: HEX.red, margin: 0, isTextBox: true });
      s.addText(t, { x: x + 0.2, y: y + 0.82, w: 2.5, h: 0.6, fontSize: 13, bold: true, color: HEX.ink, margin: 0, valign: "top", isTextBox: true });
    });
    card(s, 9.75, 4.69, 2.95, 1.45, HEX.navy, { name: "How GSTiQ checks" });
    s.addText([{ text: "How GSTiQ checks", options: { bold: true, color: HEX.gold, fontSize: 13, breakLine: true } }, { text: "HSN/SAC + narration keywords + usage, with the exceptions (e.g. cement for a works-contract client).", options: { color: "FFFFFF", fontSize: 12 } }],
      { x: 9.95, y: 4.8, w: 2.6, h: 1.3, margin: 0, valign: "top", isTextBox: true });
    s.addText("* Finance Act 2025 amended 17(5)(d) retrospectively from 01-07-2017 to read “plant or machinery”, after the Supreme Court’s Safari Retreats ruling.", { x: 0.6, y: 6.35, w: 12.1, h: 0.45, fontSize: 11, italic: true, color: "6F7D90", margin: 0, isTextBox: true });
    s.addNotes("Section 17(5) lists credits that are blocked even if all Section 16 conditions are met. GSTiQ detects each one from the HSN/SAC code, keywords in the narration and the usage field - and applies the exceptions, for example a motor car bought by a dealer for resale, or cement used by a works-contractor client for its own outward supply. Note the Finance Act 2025 amendment to 17(5)(d) after Safari Retreats.");
  }

  {
    const s = slideFor("rcm", "Content");
    s.addText("Reverse charge: the recipient pays the tax", { placeholder: "title" });
    menuBtn(s);
    card(s, 0.6, 1.45, 3.6, 5.15, HEX.navy, { name: "RCM basis" });
    s.addText([{ text: "LEGAL BASIS", options: { bold: true, color: HEX.gold, fontSize: 12, charSpacing: 1, breakLine: true } },
      { text: "Sec 9(3) CGST / 5(3) IGST", options: { bold: true, color: "FFFFFF", fontSize: 15, breakLine: true } },
      { text: "Notified goods & services (Notfn 13/2017 & 4/2017-CT(R), 10/2017-IT(R))", options: { color: "C9D8F2", fontSize: 13, breakLine: true } },
      { text: " ", options: { fontSize: 8, breakLine: true } },
      { text: "Sec 9(4) CGST / 5(4) IGST", options: { bold: true, color: "FFFFFF", fontSize: 15, breakLine: true } },
      { text: "Specified supplies from unregistered persons (e.g. promoters)", options: { color: "C9D8F2", fontSize: 13, breakLine: true } },
      { text: " ", options: { fontSize: 8, breakLine: true } },
      { text: "Sec 49(4)", options: { bold: true, color: "FFFFFF", fontSize: 15, breakLine: true } },
      { text: "RCM tax is paid only in cash — never from the credit ledger", options: { color: "C9D8F2", fontSize: 13 } }],
      { x: 0.85, y: 1.65, w: 3.15, h: 4.8, margin: 0, valign: "top", isTextBox: true });
    const sv = [[I.truck, "Goods transport agency"], [I.gavel, "Advocate / legal services"], [I.tie, "Director’s fees"], [I.guard, "Security (non-body corporate)"],
      [I.warehouse, "Rent from unregistered landlord (5AB)"], [I.car, "Renting of motor vehicle"], [I.horn, "Sponsorship"], [I.globe, "Import of services"], [I.recycle, "Metal scrap (goods)"]];
    sv.forEach(([ic, t], i) => {
      const x = 4.45 + (i % 3) * 2.1, y = 1.45 + Math.floor(i / 3) * 1.18;
      card(s, x, y, 1.95, 1.02, HEX.mist, { line: HEX.line, name: "RCM item" });
      tile(s, x + 0.12, y + 0.24, 0.52, ic, HEX.saffron);
      s.addText(t, { x: x + 0.72, y: y + 0.08, w: 1.17, h: 0.86, fontSize: 11.5, bold: true, color: HEX.ink, margin: 0, valign: "middle", isTextBox: true });
    });
    s.addText("GSTiQ’s wizard covers all 23 notified entries", { x: 4.45, y: 5.05, w: 6.2, h: 0.35, fontSize: 13, italic: true, color: HEX.saffron, margin: 0, isTextBox: true });
    const steps = ["Time of supply u/s 12(3) / 13(3)", "Pay in cash with GSTR-3B (3.1(d))", "Self-invoice within 30 days (Rule 47A)", "Take ITC in same return (4A(3))"];
    steps.forEach((t, i) => {
      const y = 1.45 + i * 1.3;
      s.addShape(pres.shapes.OVAL, { x: 10.95, y, w: 0.5, h: 0.5, fill: { color: HEX.blue }, line: { color: HEX.blue }, objectName: "Step dot" });
      s.addText(String(i + 1), { x: 10.95, y, w: 0.5, h: 0.5, fontSize: 14, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
      s.addText(t, { x: 11.55, y: y - 0.05, w: 1.2, h: 1.1, fontSize: 12, bold: true, color: HEX.ink, margin: 0, valign: "top", isTextBox: true });
      if (i < 3) s.addShape(pres.shapes.LINE, { x: 11.2, y: y + 0.55, w: 0, h: 0.72, line: { color: HEX.line, width: 1.5 }, objectName: "Step line" });
    });
    s.addNotes("Under reverse charge the recipient pays the tax. Section 9(3) covers notified supplies - common ones in a CA office are GTA freight, advocate fees, director sitting fees, security from a non-corporate supplier, commercial rent from an unregistered landlord (Entry 5AB from 10-10-2024; composition tenants excluded from 16-01-2025) and import of services. The compliance chain on the right is what GSTiQ tracks: time of supply, cash payment, self-invoice within 30 days for unregistered suppliers, and ITC in the same return.");
  }

  {
    const s = slideFor("reversal", "Content");
    s.addText("Rules that restrict or reverse ITC", { placeholder: "title" });
    menuBtn(s);
    const r = [
      ["Rule 36(4)", "Only credit shown in GSTR-2B can be claimed", I.list, HEX.blue],
      ["Rule 37", "Supplier unpaid for 180 days → add ITC to output tax with interest; re-avail on payment", I.hourglass, HEX.saffron],
      ["Rule 37A", "Supplier filed GSTR-1 but not GSTR-3B by 30 Sept → reverse by 30 Nov", I.warn, HEX.red],
      ["Rules 42 & 43", "Common credit used for exempt or non-business supplies is reversed (D1, D2, Tm, Te)", I.percent, "6B3FA0"],
      ["Rule 86B", "Taxable supply above ₹50 lakh a month → at least 1% of tax in cash", I.lock, HEX.slate],
      ["Rule 88D", "ITC in 3B exceeds 2B by ₹25 lakh and 20% → DRC-01C intimation", I.bolt, HEX.green],
    ];
    r.forEach(([k, d, ic, col], i) => {
      const x = 0.6 + (i % 2) * 6.15, y = 1.5 + Math.floor(i / 2) * 1.72;
      card(s, x, y, 5.95, 1.5, HEX.mist, { line: HEX.line, name: k });
      tile(s, x + 0.25, y + 0.3, 0.9, ic, col);
      s.addText(k, { x: x + 1.4, y: y + 0.18, w: 4.3, h: 0.42, fontSize: 18, bold: true, color: col, margin: 0, isTextBox: true });
      s.addText(d, { x: x + 1.4, y: y + 0.6, w: 4.35, h: 0.8, fontSize: 14, color: HEX.ink, margin: 0, valign: "top", isTextBox: true });
    });
    s.addNotes("These rules either restrict credit to GSTR-2B or force reversals. GSTiQ applies all of them automatically: Rule 37 and 37A reversals appear with due dates; Rule 42 and 43 are computed with the full formula (T, T1 to T4, C1, C2, D1, D2, C3); Rule 86B and the DRC-01C check of Rule 88D appear in the GSTR-3B builder.");
  }

  {
    const s = slideFor("whatsnew", "Content");
    s.addText("Latest changes GSTiQ already follows", { placeholder: "title" });
    menuBtn(s);
    const nw = [
      ["GST 2.0 rates", "From 22-09-2025", "Slabs rationalised to 5%, 18% and 40%. A bill charging 12% after this date is flagged as a rate error.", HEX.blue, I.percent],
      ["Invoice Management System", "IMS on the GST portal", "Accept, reject or keep pending each supplier invoice before GSTR-2B is generated on the 14th. GSTiQ stores the IMS action per invoice.", HEX.green, I.tasks],
      ["Sec 17(5)(d) amended", "Finance Act 2025", "“Plant or machinery” — retrospective from 01-07-2017, overriding the Safari Retreats judgment on own-construction ITC.", HEX.saffron, I.building],
      ["57th GST Council", "08-10-2026 — proposed", "ITC-related recommendations are shown as proposed and not applied until notified. The knowledge base marks them separately.", HEX.slate, I.horn],
    ];
    nw.forEach(([t, w, d, col, ic], i) => {
      const x = 0.6 + i * 3.08;
      card(s, x, 1.5, 2.88, 4.4, HEX.mist, { line: HEX.line, name: t });
      tile(s, x + 0.25, 1.75, 0.8, ic, col);
      s.addText(t, { x: x + 0.25, y: 2.75, w: 2.4, h: 0.85, fontSize: 18, bold: true, color: HEX.ink, margin: 0, valign: "top", isTextBox: true });
      s.addText(w, { x: x + 0.25, y: 3.6, w: 2.4, h: 0.35, fontSize: 12, bold: true, color: col, margin: 0, isTextBox: true });
      s.addText(d, { x: x + 0.25, y: 4.05, w: 2.4, h: 2.2, fontSize: 13, color: "445468", margin: 0, valign: "top", isTextBox: true });
    });
    s.addNotes("Our law position is as on 29 October 2026. GST 2.0 rates from 22 September 2025; the Invoice Management System; the Finance Act 2025 amendment to 17(5)(d); and the 57th GST Council recommendations of 8 October 2026, which we show only as proposals until they are notified.");
  }

  // =========================== SECTION 3 SOLUTION
  divider("d3", "03", "The solution: GSTiQ", "One knowledge base, two engines (browser JavaScript and Python), a CA-office web app, and outputs in Excel, SQL, JSON and Word.",
    "Section 3 - how we built the solution.");

  {
    const s = slideFor("arch", "Content");
    s.addText("Architecture: one law base, two engines", { placeholder: "title" });
    menuBtn(s);
    const ar = 2203 / 697, w = 11.0, h = w / ar, dx = (13.333 - 11.0) / 2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: dx - 0.05, y: 1.45, w: w + 0.1, h: h + 0.1, rectRadius: 0.08, fill: { color: HEX.paper }, line: { color: HEX.line, width: 0.75 }, objectName: "Diagram frame" });
    s.addImage({ path: path.join(ROOT, "docs", "diagrams", "arch.png"), x: dx, y: 1.5, w, h, altText: "GSTiQ architecture diagram" });
    const pts = [["Knowledge base", "The GST law as data (JSON): rates, conditions, 17(5) list, 23 RCM entries, deadlines, chatbot answers."],
      ["Two identical engines", "JavaScript runs in any browser offline; Python adds ML, SQL and Excel. A test proves both agree on all 609 bills."],
      ["Many outputs", "Web app, REST API, SQLite database, Excel MIS with formulas, VBA, Jupyter notebook and Word report."]];
    pts.forEach(([t, d], i) => {
      const x = 0.6 + i * 4.1, y = 1.5 + h + 0.3;
      card(s, x, y, 3.85, 1.4, HEX.mist, { line: HEX.line, name: t });
      s.addText([{ text: t, options: { bold: true, fontSize: 15, color: HEX.blue, breakLine: true } }, { text: d, options: { fontSize: 13, color: HEX.ink } }], { x: x + 0.22, y: y + 0.12, w: 3.45, h: 1.2, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 4 });
    });
    s.addNotes("The heart of GSTiQ is a single knowledge base - the law written as structured data. Two engines read it: a JavaScript engine inside the web app, and a Python engine with machine learning, SQL and Excel reporting. Because they share the same rules, our cross-language test confirms both give identical results on all 609 bills.");
  }

  {
    const s = slideFor("stack", "Content");
    s.addText("Technology stack — eight languages and tools", { placeholder: "title" });
    menuBtn(s);
    const tech = [[I.html, "E34F26", "HTML5 · CSS3", "Single-page app, light/dark, mobile"], [I.js, "B58B00", "JavaScript", "Rule engine, AI, import/export in browser"],
      [I.python, "306998", "Python", "Flask API, pandas, scikit-learn, openpyxl"], [I.db, HEX.green, "SQL (SQLite)", "Tables, views, 14 analytical queries"],
      [I.excel, "1D6F42", "Excel + VBA", "1,281-formula model, UDFs and macros"], [I.book, "6B3FA0", "Jupyter · JSON", "AI notebook, law base, portal 2B format"]];
    tech.forEach(([ic, col, t, d], i) => {
      const y = 1.45 + i * 0.86;
      tile(s, 0.6, y, 0.66, ic, col);
      s.addText(t, { x: 1.45, y: y - 0.02, w: 4.6, h: 0.36, fontSize: 16, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
      s.addText(d, { x: 1.45, y: y + 0.34, w: 4.6, h: 0.34, fontSize: 13, color: "445468", margin: 0, isTextBox: true });
    });
    const loc = STATS.loc, keys = ["Python", "JavaScript", "CSS", "SQL", "VBA"];
    s.addChart(pres.charts.BAR, [{ name: "Lines of code", labels: keys, values: keys.map((k) => loc[k]) }], {
      x: 6.4, y: 1.4, w: 6.3, h: 5.2, barDir: "bar", chartColors: [HEX.blue], showTitle: true, title: "Lines of code we wrote", titleFontSize: 15, titleColor: HEX.ink, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 12, dataLabelColor: HEX.ink, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0",
      catAxisLabelColor: "445468", valAxisLabelColor: "445468", catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: "E3E9F1", size: 0.75 }, catGridLine: { style: "none" }, showLegend: false, catAxisOrientation: "maxMin", valAxisHidden: true,
    });
    s.addText(`≈ ${(keys.reduce((a, k) => a + loc[k], 0) + loc.HTML).toLocaleString("en-IN")} lines in total, excluding data and libraries`, { x: 6.4, y: 6.55, w: 6.3, h: 0.35, fontSize: 12, italic: true, color: "6F7D90", margin: 0, align: "right", isTextBox: true });
    s.addNotes("We used the right tool for each job: HTML, CSS and JavaScript for an app that runs anywhere without installation; Python for machine learning and reports; SQL for analysis; Excel with formulas and VBA because that is what a CA office already uses; Jupyter to document the models; and JSON for the law base and the GST portal format.");
  }

  {
    const s = slideFor("workflow", "Content");
    s.addText("A month-end workflow in six clicks", { placeholder: "title" });
    menuBtn(s);
    const st = [[I.imp, "Import", "Purchase register (Excel/CSV) and GSTR-2B portal JSON with smart column mapping"],
      [I.sync, "Reconcile", "Four-pass AI matching of books with GSTR-2B; IMS actions"],
      [I.check, "Evaluate ITC", "Status + reason for every bill; deadlines and reversals"],
      [I.exch, "Reverse charge", "RCM register, time of supply, interest, self-invoices"],
      [I.calc, "GSTR-3B & set-off", "Tables 3.1(d) & 4, Rule 42/43, optimal set-off, DRC-01C"],
      [I.exp, "Report", "Client MIS workbook, review report, vendor follow-up letters"]];
    const cols = [HEX.slate, HEX.blue, HEX.green, HEX.saffron, "6B3FA0", HEX.red];
    st.forEach(([ic, t, d], i) => {
      const x = 0.6 + i * 2.0;
      s.addShape(pres.shapes.CHEVRON, { x, y: 1.75, w: 2.0, h: 1.1, fill: { color: cols[i] }, line: { color: "FFFFFF", width: 2 }, objectName: "Step " + t });
      s.addImage({ data: ic, x: x + 0.75, y: 2.05, w: 0.5, h: 0.5, altText: t });
      s.addText(String(i + 1).padStart(2, "0"), { x, y: 3.1, w: 1.9, h: 0.5, fontSize: 26, bold: true, color: cols[i], fontFace: "Cambria", margin: 0, isTextBox: true });
      s.addText(t, { x, y: 3.6, w: 1.9, h: 0.45, fontSize: 16, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
      s.addText(d, { x, y: 4.05, w: 1.88, h: 1.6, fontSize: 12.5, color: "445468", margin: 0, valign: "top", isTextBox: true });
    });
    card(s, 0.6, 5.85, 12.1, 0.8, HEX.mist, { line: HEX.line, name: "Workflow note" });
    s.addText([{ text: "Everything updates instantly: ", options: { bold: true, color: HEX.blue } }, { text: "change one bill or one IMS action and the reconciliation, ITC status, GSTR-3B and dashboard recalculate together." }],
      { x: 0.85, y: 5.85, w: 11.7, h: 0.8, fontSize: 14, color: HEX.ink, margin: 0, valign: "middle", isTextBox: true });
    s.addNotes("This is how an article assistant uses GSTiQ at month end - six steps instead of days of spreadsheet work.");
  }

  {
    const s = slideFor("recon", "Content");
    s.addText("Reconciliation: books vs GSTR-2B in four passes", { placeholder: "title" });
    menuBtn(s);
    shot(s, "06_recon.png", 0.65, 1.55, 7.2, "Reconciliation screen — follow-up tab");
    const ps = [["1", "Exact key", "Normalised GSTIN + invoice number (INV/045 = inv-45)"],
      ["2", "AI fuzzy match", "Score = 50% invoice similarity + 35% amount + 15% date; match if ≥ 0.72"],
      ["3", "GSTIN rescue", "Same PAN or ≤ 2 character typo in GSTIN"],
      ["4", "Leftovers", "Missing in GSTR-2B / missing in books; duplicates flagged first"]];
    ps.forEach(([n, t, d], i) => {
      const y = 1.5 + i * 1.18;
      s.addShape(pres.shapes.OVAL, { x: 8.3, y, w: 0.55, h: 0.55, fill: { color: HEX.blue }, line: { color: HEX.blue }, objectName: "Pass number" });
      s.addText(n, { x: 8.3, y, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true });
      s.addText(t, { x: 9.05, y: y - 0.03, w: 3.65, h: 0.4, fontSize: 16, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
      s.addText(d, { x: 9.05, y: y + 0.36, w: 3.65, h: 0.75, fontSize: 13, color: "445468", margin: 0, valign: "top", isTextBox: true });
    });
    s.addText("Tolerances are adjustable · vendor letters are generated for every gap", { x: 8.3, y: 6.25, w: 4.4, h: 0.5, fontSize: 12, italic: true, color: HEX.blue, margin: 0, isTextBox: true });
    s.addNotes("Exact matching fails in practice because suppliers write invoice numbers differently. Our four-pass method first normalises keys, then uses an AI similarity score combining invoice number, amount and date, then rescues GSTIN typos using PAN, and finally lists what is missing on either side. For every gap GSTiQ drafts a follow-up letter to the vendor.");
  }

  {
    const s = slideFor("itc", "Content");
    s.addText("ITC eligibility: a status and a reason for every bill", { placeholder: "title" });
    menuBtn(s);
    const lab = ["Eligible", "At risk", "Blocked u/s 17(5)", "Deferred", "Lapsed u/s 16(4)"];
    const val = [T.eligible, T.at_risk, T.blocked, T.deferred, T.lapsed].map((v) => +L(v).toFixed(2));
    s.addChart(pres.charts.BAR, [{ name: "₹ lakh", labels: lab, values: val }], {
      x: 0.5, y: 1.4, w: 6.9, h: 5.2, barDir: "bar", chartColors: [HEX.green, HEX.saffron, HEX.red, HEX.slate, "6B3FA0"], showTitle: true,
      title: "Input GST of all 5 demo clients (₹ lakh)", titleFontSize: 15, titleColor: HEX.ink, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 12, dataLabelColor: HEX.ink, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0.00",
      catAxisLabelColor: "445468", valAxisLabelColor: "445468", catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: "E3E9F1", size: 0.75 }, catGridLine: { style: "none" }, showLegend: false, catAxisOrientation: "maxMin", valAxisHidden: true,
    });
    card(s, 7.75, 1.5, 4.95, 5.1, HEX.mist, { line: HEX.line, name: "ITC explanation" });
    s.addText([{ text: "12 checks, in priority order", options: { bold: true, fontSize: 17, color: HEX.ink, breakLine: true } },
      { text: "Duplicate → time-barred 16(4) → blocked 17(5) → RCM unpaid → not received → not in 2B / IMS rejected → Rule 37 → Rule 37A → mismatch → eligible.", options: { fontSize: 13, color: "445468", breakLine: true } },
      { text: " ", options: { fontSize: 6, breakLine: true } },
      { text: "Explained in plain words", options: { bold: true, fontSize: 17, color: HEX.ink, breakLine: true } },
      { text: "Clicking a bill opens a drawer showing each condition with a tick or cross and the section that applies.", options: { fontSize: 13, color: "445468", breakLine: true } },
      { text: " ", options: { fontSize: 6, breakLine: true } },
      { text: "Flags beyond the status", options: { bold: true, fontSize: 17, color: HEX.ink, breakLine: true } },
      { text: "Excess claim, invalid GSTIN, GST 2.0 rate error, missing self-invoice, proposed 57th Council relaxations.", options: { fontSize: 13, color: "445468" } }],
      { x: 8.05, y: 1.75, w: 4.4, h: 4.7, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 3 });
    s.addNotes(`Across 609 demo bills: ${lakh(T.eligible)} eligible, ${lakh(T.at_risk)} at risk, ${lakh(T.blocked)} blocked under 17(5), ${lakh(T.deferred)} deferred and ${lakh(T.lapsed)} lapsed under 16(4). The order of checks matters - for example a duplicate is caught before anything else, and a time-barred bill is never shown as eligible.`);
  }

  {
    const s = slideFor("rcmtool", "Content");
    s.addText("RCM wizard, register and self-invoice", { placeholder: "title" });
    menuBtn(s);
    shot(s, "23_rcm_wizard_verdict.png", 0.65, 1.55, 5.85, "RCM wizard — answer 2–3 questions, get the verdict and tax");
    shot(s, "26_self_invoice.png", 6.85, 1.55, 5.85, "Self-invoice generated under Rule 47A");
    s.addText([{ text: "23 ", options: { bold: true, color: HEX.saffron } }, { text: "notified entries in the wizard   ·   " }, { text: lakh(T.rcm_tax) + " ", options: { bold: true, color: HEX.saffron } },
      { text: "RCM tax tracked in the demo   ·   time of supply, due date and interest u/s 50 per bill" }],
      { x: 0.65, y: 5.75, w: 12.05, h: 0.6, fontSize: 14, color: HEX.ink, margin: 0, valign: "middle", isTextBox: true });
    s.addNotes("The RCM wizard asks two or three yes/no questions taken from the notification - for example for legal services: is the supplier an advocate, is the recipient a business entity, is its turnover above the threshold - and returns the verdict with the tax amount. The register then tracks time of supply, the due date, payment and interest, and generates the self-invoice and payment voucher.");
  }

  {
    const s = slideFor("returns", "Content");
    s.addText("GSTR-3B builder, Rule 42/43, set-off and DRC-01C", { placeholder: "title" });
    menuBtn(s);
    shot(s, "25_gstr3b_drilldown.png", 0.65, 1.55, 7.2, "GSTR-3B Table 4 with drill-down to the bills behind each figure");
    const d = STATS.drc;
    stat(s, 8.3, 1.45, 4.4, "₹3,716.03", "Rule 42 reversal (D1) for Saurashtra Agro, Sep-2026 — identical in Python, JavaScript and Excel", HEX.blue);
    stat(s, 8.3, 3.05, 4.4, "+" + d.excess_pct.toFixed(1) + "%", `ITC claimed (${lakh(d.claimed)}) above GSTR-2B (${lakh(d.available)}) — DRC-01C triggered for TechNova, Aug-2026`, HEX.red);
    stat(s, 8.3, 4.65, 4.4, "Optimal", "Set-off order u/s 49, 49A, 49B & Rule 88A — IGST first, minimising cash; negative credit added to liability", HEX.green);
    s.addNotes("The GSTR-3B builder maps every bill to the right table as per Circular 170/02/2022. Rule 42 is computed with the full formula and our three implementations agree to the paisa. The DRC-01C check of Rule 88D caught a planted case where TechNova claimed 355% more than GSTR-2B. The set-off follows the legal order and picks the combination that minimises cash.");
  }

  // =========================== SECTION 4 AI
  divider("d4", "04", "Artificial intelligence", "Where rules end and judgement begins: six models that read narrations, spot unusual bills, rank suppliers, forecast credit and answer questions.",
    "Section 4 - the AI layer. Key message: the law decides; AI assists and flags for human review.");

  {
    const s = slideFor("aimodels", "Content");
    s.addText("Six AI models, each with a job", { placeholder: "title" });
    menuBtn(s);
    const m = [
      [I.list, HEX.blue, "Expense classifier", "Reads ledger narrations and predicts eligible / blocked (17(5)) / RCM. Naive Bayes in browser; TF-IDF + Logistic Regression in Python — 85.0% 5-fold CV, 18 classes."],
      [I.search, HEX.red, "Anomaly detection", "Isolation Forest on value, vendor deviation, round sums, Sundays, e-way bill threshold — plus forensic rules for near-duplicates."],
      [I.bar, HEX.saffron, "Benford’s law", "First-digit test with chi-square and MAD (Nigrini bands) to spot manipulated invoice values."],
      [I.shield, HEX.green, "Vendor risk score", "Cancelled GSTIN, late GSTR-1/3B, missing in 2B, new registration → grades A to D with action."],
      [I.chart, "6B3FA0", "ITC forecast", "Trend regression (60%) + 3-month moving average (40%) with a 90% band to plan cash."],
      [I.chat, HEX.slate, "GST Mitra chatbot", "TF-IDF retrieval over 44 curated answers, plus live answers from the client’s own data."],
    ];
    m.forEach(([ic, col, t, d], i) => {
      const x = 0.6 + (i % 3) * 4.1, y = 1.45 + Math.floor(i / 3) * 2.62;
      card(s, x, y, 3.85, 2.42, HEX.mist, { line: HEX.line, name: t });
      tile(s, x + 0.25, y + 0.25, 0.62, ic, col);
      s.addText(t, { x: x + 1.05, y: y + 0.25, w: 2.65, h: 0.62, fontSize: 17, bold: true, color: HEX.ink, margin: 0, valign: "middle", isTextBox: true });
      s.addText(d, { x: x + 0.25, y: y + 1.0, w: 3.4, h: 1.35, fontSize: 12.5, color: "445468", margin: 0, valign: "top", isTextBox: true });
    });
    s.addNotes("Each model has a clear job. The classifier helps when narrations are messy. Anomaly detection and Benford's law are audit tools - similar in spirit to what the GST department does with BIFA and ADVAIT. Vendor risk tells the office whom to chase. The forecast helps cash planning. GST Mitra answers questions in plain language.");
  }

  {
    const s = slideFor("airesults", "Content");
    s.addText("AI results on our data", { placeholder: "title" });
    menuBtn(s);
    const cv = STATS.cv;
    s.addChart(pres.charts.BAR, [{ name: "Accuracy", labels: cv.scores.map((_, i) => "Fold " + (i + 1)), values: cv.scores.map((v) => +(v * 100).toFixed(1)) }], {
      x: 0.5, y: 1.4, w: 6.2, h: 4.0, barDir: "col", chartColors: [HEX.blue], showTitle: true, title: "Classifier accuracy, 5-fold cross-validation (%)", titleFontSize: 14, titleColor: HEX.ink, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 12, dataLabelColor: HEX.ink, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "0.0",
      catAxisLabelColor: "445468", valAxisLabelColor: "445468", catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
      valAxisMinVal: 0, valAxisMaxVal: 100, valGridLine: { color: "E3E9F1", size: 0.75 }, catGridLine: { style: "none" }, showLegend: false,
    });
    stat(s, 0.7, 5.5, 2.0, "85.0%", "mean accuracy", HEX.blue);
    stat(s, 2.75, 5.5, 2.0, "97.4%", "agreement with rule engine", HEX.green);
    stat(s, 4.8, 5.5, 2.0, "294", "training sentences", HEX.saffron);
    shot(s, "29_ai_anomaly.png", 7.15, 1.55, 5.55, "AI lab — anomaly detection tab");
    card(s, 7.1, 5.25, 5.65, 1.4, HEX.navy, { name: "Human in the loop" });
    s.addText([{ text: "Human in the loop", options: { bold: true, color: HEX.gold, fontSize: 15, breakLine: true } }, { text: "AI never changes a legal decision. Disagreements with the rule engine are shown for the CA to review.", options: { color: "FFFFFF", fontSize: 13 } }],
      { x: 7.35, y: 5.35, w: 5.2, h: 1.2, margin: 0, valign: "middle", isTextBox: true });
    s.addNotes("The classifier averages 85% accuracy on unseen sentences across five folds, and agrees with the rule engine on blocked versus not-blocked for 97.4% of real register lines. The anomaly tab lists unusual bills with reasons. Our principle: AI flags, the CA decides.");
  }

  {
    const s = slideFor("mitra", "Content");
    s.addText("GST Mitra — ask in plain language", { placeholder: "title" });
    menuBtn(s);
    shot(s, "24_assistant_chat.png", 0.65, 1.55, 7.2, "GST Mitra assistant inside the app");
    const qa = [["“Is RCM applicable on rent from an unregistered landlord?”", "Yes for commercial property from 10-10-2024 (Entry 5AB), composition tenants excluded from 16-01-2025."],
      ["“Can I pay reverse charge from the credit ledger?”", "No — Sec 49(4): RCM is paid in cash; ITC follows in the same return."],
      ["“How much ITC is at risk for this client?”", "Answered from the client’s live data with the bills behind it."]];
    qa.forEach(([q, a], i) => {
      const y = 1.5 + i * 1.72;
      card(s, 8.25, y, 4.45, 1.55, HEX.mist, { line: HEX.line, name: "QA " + (i + 1) });
      s.addText([{ text: q, options: { bold: true, color: HEX.blue, fontSize: 13, breakLine: true } }, { text: a, options: { color: HEX.ink, fontSize: 12.5 } }],
        { x: 8.45, y: y + 0.12, w: 4.05, h: 1.35, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 4 });
    });
    s.addNotes("GST Mitra uses TF-IDF retrieval over a curated question bank, so every answer cites the section, rule or notification. It also recognises data questions and answers from the selected client's figures.");
  }

  // =========================== SECTION 5
  divider("d5", "05", "Data, demo & testing", "Realistic dummy data with planted errors, import and export in every office format, an audience quiz, the live demo and how we proved it works.",
    "Section 5 - data, an interactive quiz, the live demo, and testing.");

  {
    const s = slideFor("data", "Content");
    s.addText("Dummy data built to catch real-world mistakes", { placeholder: "title" });
    menuBtn(s);
    const d = [["5", "clients — Gujarat, Maharashtra, Karnataka"], ["133", "vendors with filing behaviour"], ["609", "purchase bills, Jan–Sep 2026 + late bills"], ["474", "GSTR-2B records with IMS actions"]];
    d.forEach(([b, l], i) => stat(s, 0.6 + i * 3.05, 1.45, 2.85, b, l, [HEX.blue, HEX.saffron, HEX.green, "6B3FA0"][i]));
    s.addText("Planted errors the engine must find", { x: 0.6, y: 3.05, w: 8, h: 0.4, fontSize: 17, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
    const errs = ["Invoice number format differs", "Value mismatch", "Date mismatch", "GSTIN typo", "Supplier did not file", "Cancelled supplier", "Duplicate entry",
      "Unpaid > 180 days (Rule 37)", "Supplier 3B default (37A)", "Unpaid RCM", "Missing self-invoice", "12% rate after GST 2.0", "₹1.65 Cr claim not in 2B (DRC-01C)", "Time-barred bill"];
    let x = 0.6, y = 3.6;
    errs.forEach((e) => {
      const w = Math.min(4.2, 0.25 + e.length * 0.105);
      if (x + w > 12.75) { x = 0.6; y += 0.6; }
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.45, rectRadius: 0.2, fill: { color: "FBEAE8" }, line: { color: "F1C4BF" }, objectName: "Error chip" });
      s.addText(e, { x, y, w, h: 0.45, fontSize: 12.5, color: HEX.red, bold: true, align: "center", valign: "middle", margin: 0, isTextBox: true });
      x += w + 0.15;
    });
    card(s, 0.6, 5.65, 12.1, 1.0, HEX.mist, { line: HEX.line, name: "New client note" });
    tile(s, 0.8, 5.8, 0.7, I.imp, HEX.green);
    s.addText([{ text: "New client test — Gir Polymers Pvt Ltd: ", options: { bold: true, color: HEX.green } }, { text: "49 bills (Excel) + September GSTR-2B (portal JSON) imported through the app; all planted errors were caught." }],
      { x: 1.7, y: 5.65, w: 10.8, h: 1.0, fontSize: 14, color: HEX.ink, margin: 0, valign: "middle", isTextBox: true });
    s.addNotes("All names and GSTINs are fictitious but GSTINs carry valid check digits. We deliberately planted fourteen kinds of errors so we could prove the engine finds each one. We also created a brand-new client, Gir Polymers, and imported its Excel register and portal JSON through the app as a real office would.");
  }

  {
    const s = slideFor("io", "Content");
    s.addText("Import and export in every format an office uses", { placeholder: "title" });
    menuBtn(s);
    shot(s, "28_import_mapping.png", 0.65, 1.55, 6.3, "Smart column mapping — any column names are recognised");
    const io = [[I.imp, HEX.blue, "Import", "Excel (.xlsx), CSV, GST portal GSTR-2B JSON, full backup; columns matched automatically; validation before saving"],
      [I.exp, HEX.green, "Export", "Client MIS workbook (7 sheets), review report, vendor letters, self-invoice, portal JSON, CSV/Excel of every register"],
      [I.excel, "1D6F42", "Excel model + VBA", "1,281 live formulas: ITC register, RCM calculator, Rule 42/43, set-off, interest; VBA UDFs such as GSTIN_VALID()"],
      [I.db, "6B3FA0", "SQL & API", "SQLite schema with views and 14 queries; Flask REST API so other tools can call the engine"]];
    io.forEach(([ic, col, t, d], i) => {
      const y = 1.5 + i * 1.3;
      tile(s, 7.35, y, 0.7, ic, col);
      s.addText(t, { x: 8.25, y: y - 0.04, w: 4.45, h: 0.38, fontSize: 16, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
      s.addText(d, { x: 8.25, y: y + 0.34, w: 4.45, h: 0.9, fontSize: 12.5, color: "445468", margin: 0, valign: "top", isTextBox: true });
    });
    s.addNotes("Offices have data in many shapes, so import is forgiving: column names like 'Bill No' or 'Party GSTIN' are mapped automatically, and the GST portal's GSTR-2B JSON is recognised directly. Outputs go to Excel, HTML, text letters and JSON. The separate Excel model and VBA show the same logic in the tool every CA already knows.");
  }

  {
    const s = slideFor("quiz", "Content");
    s.addText("Audience quiz — will GSTiQ allow the ITC?", { placeholder: "title" });
    menuBtn(s);
    s.addText("Click a case to reveal GSTiQ’s verdict. Each answer slide has a button to come back here.", { x: 0.6, y: 1.25, w: 11, h: 0.4, fontSize: 15, color: "445468", margin: 0, isTextBox: true });
    const qs = [["Case 1", "A company buys a 5-seater car for its Managing Director. GST ₹4.96 lakh. ITC?", I.car, HEX.blue, "q1"],
      ["Case 2", "Godown rent ₹65,000 a month from an unregistered landlord; tenant is a regular taxpayer.", I.warehouse, HEX.saffron, "q2"],
      ["Case 3", "Bill dated 10-02-2025 found unclaimed on 29-10-2026. Can ITC still be taken?", I.hourglass, HEX.red, "q3"],
      ["Case 4", "Supplier filed GSTR-1 for Jan-2026 but not GSTR-3B by 30-09-2026. ITC already claimed.", I.warn, HEX.green, "q4"]];
    qs.forEach(([t, d, ic, col, key], i) => {
      const x = 0.6 + (i % 2) * 6.15, y = 1.9 + Math.floor(i / 2) * 2.4;
      card(s, x, y, 5.95, 2.15, HEX.mist, { line: HEX.line, shadow: true, name: t });
      tile(s, x + 0.3, y + 0.3, 0.85, ic, col);
      s.addText([{ text: t, options: { hyperlink: { slide: N(key), tooltip: "Reveal verdict" }, color: col } }], { x: x + 1.4, y: y + 0.25, w: 2.5, h: 0.45, fontSize: 20, bold: true, margin: 0, isTextBox: true });
      s.addText(d, { x: x + 1.4, y: y + 0.72, w: 4.3, h: 0.9, fontSize: 14, color: HEX.ink, margin: 0, valign: "top", isTextBox: true });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 4.1, y: y + 1.6, w: 1.6, h: 0.4, rectRadius: 0.1, fill: { color: col }, line: { color: col }, objectName: "Reveal button" });
      s.addText([{ text: "Reveal ›", options: { hyperlink: { slide: N(key), tooltip: "Reveal verdict" }, color: "FFFFFF" } }], { x: x + 4.1, y: y + 1.6, w: 1.6, h: 0.4, fontSize: 13, bold: true, align: "center", valign: "middle", margin: 0, isTextBox: true });
      s.addImage({ data: ic, x: x + 0.51, y: y + 0.51, w: 0.43, h: 0.43, hyperlink: { slide: N(key), tooltip: "Reveal verdict" }, altText: t });
    });
    s.addNotes("Interactive part: ask the audience to vote on each case, then click 'Reveal' (or the case title) to jump to the hidden answer slide. Each answer slide has a 'Back to quiz' button. Answers: 1 blocked u/s 17(5)(a); 2 RCM applies - pay 18% in cash, issue self-invoice, ITC in same return; 3 lapsed u/s 16(4) - deadline was 30-11-2025; 4 reverse under Rule 37A by 30-11-2026, re-avail when supplier files.");
  }

  {
    const s = slideFor("demo", "Content");
    s.addText("Live demo — click to open any screen", { placeholder: "title" });
    menuBtn(s);
    card(s, 0.6, 1.45, 7.0, 1.4, HEX.navy, { name: "Domain card" });
    s.addText([{ text: "LIVE WEB APP", options: { bold: true, color: HEX.gold, fontSize: 12, charSpacing: 1, breakLine: true } },
      { text: "humaregrouponekaproject.online", options: { bold: true, color: "FFFFFF", fontSize: 26, fontFace: "Cambria", hyperlink: { url: SITE, tooltip: "Open the live app" } } }],
      { x: 0.9, y: 1.5, w: 6.6, h: 1.3, margin: 0, valign: "middle", isTextBox: true });
    const links = [["Dashboard", "dashboard", I.bar], ["Reconciliation", "recon", I.sync], ["ITC eligibility", "itc", I.check], ["RCM wizard", "rcm-wizard", I.exch],
      ["GSTR-3B builder", "gstr3b", I.calc], ["AI lab", "ai-lab", I.brain], ["GST Mitra", "assistant", I.chat], ["Import / export", "data", I.imp]];
    const cols = [HEX.blue, HEX.blue, HEX.green, HEX.saffron, "6B3FA0", HEX.red, HEX.slate, HEX.green];
    links.forEach(([t, h, ic], i) => {
      const x = 0.6 + (i % 2) * 3.55, y = 3.1 + Math.floor(i / 2) * 0.88;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 3.4, h: 0.7, rectRadius: 0.12, fill: { color: HEX.mist }, line: { color: HEX.line }, objectName: "Demo link " + t });
      tile(s, x + 0.12, y + 0.1, 0.5, ic, cols[i]);
      s.addText([{ text: t + "  ↗", options: { hyperlink: { url: `${SITE}/#${h}`, tooltip: "Open " + t + " in the browser" }, color: HEX.ink } }], { x: x + 0.78, y, w: 2.55, h: 0.7, fontSize: 15, bold: true, margin: 0, valign: "middle", isTextBox: true });
    });
    card(s, 8.0, 1.45, 4.7, 5.2, HEX.mist, { line: HEX.line, name: "QR panel" });
    s.addImage({ path: path.join(__dirname, "assets", "qr_site.png"), x: 8.35, y: 1.7, w: 1.9, h: 1.9, hyperlink: { url: SITE }, altText: "QR code to the live app" });
    s.addText([{ text: "Live app", options: { bold: true, fontSize: 14, color: HEX.ink, breakLine: true } }, { text: "Scan on your phone", options: { fontSize: 12, color: "445468" } }], { x: 10.4, y: 2.2, w: 2.2, h: 0.9, margin: 0, valign: "middle", isTextBox: true });
    s.addImage({ path: path.join(__dirname, "assets", "qr_github.png"), x: 8.35, y: 3.85, w: 1.9, h: 1.9, hyperlink: { url: REPO }, altText: "QR code to the GitHub repository" });
    s.addText([{ text: "Source code", options: { bold: true, fontSize: 14, color: HEX.ink, breakLine: true } }, { text: "GitHub repository", options: { fontSize: 12, color: HEX.blue, hyperlink: { url: REPO } } }], { x: 10.4, y: 4.35, w: 2.2, h: 0.9, margin: 0, valign: "middle", isTextBox: true });
    s.addText("Works offline too: double-click OPEN_ME_GSTiQ_App.html", { x: 8.3, y: 6.0, w: 4.2, h: 0.5, fontSize: 12, italic: true, color: "6F7D90", margin: 0, isTextBox: true });
    s.addNotes("Demo script (5 minutes): 1) Dashboard - show AI insights and the 16(4) countdown. 2) Reconciliation - open the follow-up tab and show a fuzzy match. 3) ITC eligibility - click a blocked bill to show the rule-by-rule drawer. 4) RCM wizard - legal services, answer the questions, show the verdict. 5) GSTR-3B - drill into Table 4. 6) AI lab - classify 'Diwali gifts to dealers'. 7) GST Mitra - ask about RCM on rent. 8) Import - drop the Gir Polymers Excel file. Every button on this slide opens that screen directly in the browser. If there is no internet, use OPEN_ME_GSTiQ_App.html from the project folder.");
  }

  {
    const s = slideFor("testing", "Content");
    s.addText("Testing: how we proved it works", { placeholder: "title" });
    menuBtn(s);
    const rows = [["Test", "What it checks", "Result"],
      ["Law unit tests", "23 cases: 16(4), 17(5), Rule 37/37A, RCM, set-off, DRC-01C, reconciliation", "All pass"],
      ["Cross-language", "Python and JavaScript engines on all 609 bills and GSTR-3B for 20 client-months", "Identical"],
      ["Browser UI test", "Opens all 18 screens, clicks, imports and exports in headless Chromium", "0 JS errors"],
      ["New-client import", "Gir Polymers Excel + portal JSON imported through the real UI", "All errors caught"],
      ["Excel recalculation", "1,454 formulas recalculated in LibreOffice", "0 errors"],
      ["Notebook & API", "Jupyter notebook executed; Flask endpoints called", "Pass"],
      ["Live website", "humaregrouponekaproject.online over HTTPS", "Online"]];
    s.addTable(rows.map((r, i) => r.map((c, j) => ({ text: c, options: i === 0 ? { bold: true, color: "FFFFFF", fill: { color: HEX.navy }, fontSize: 14 } : { fontSize: 13.5, color: j === 2 ? HEX.green : HEX.ink, bold: j !== 1, fill: { color: i % 2 ? "FFFFFF" : HEX.mist } } }))),
      { x: 0.6, y: 1.5, w: 12.1, colW: [2.6, 7.4, 2.1], rowH: 0.56, border: { type: "solid", pt: 0.75, color: HEX.line }, valign: "middle", margin: 0.1 });
    s.addNotes("We tested at every level: law-specific unit tests, a cross-check that the two engines agree, a browser test that opens every screen, an end-to-end import of a new client, Excel recalculation, the notebook and the API. Debugging found and fixed real bugs - for example an Excel sheet-picker issue during import.");
  }

  // =========================== SECTION 6
  divider("d6", "06", "Conclusion", "What a CA office gains with GSTiQ today, and the features that can be added next.", "Section 6 - conclusion.");

  {
    const s = slideFor("benefits", "Content");
    s.addText("What changes for a CA office", { placeholder: "title" });
    menuBtn(s);
    const rows = [["Month-end ITC review", "Days of spreadsheet matching", "Minutes, with every gap listed"], ["Blocked credits", "Found at audit — with interest", "Flagged the day the bill is entered"],
      ["Reverse charge", "Missed rent, freight, legal fees", "Wizard + register + self-invoice"], ["Deadlines", "Remembered by individuals", "Countdown, calendar and alerts"],
      ["Vendor follow-up", "Phone calls without data", "Risk grade + ready letter"], ["Review by partner", "Re-checks samples", "Reads the reason for every bill"]];
    s.addText("Today (manual)", { x: 4.05, y: 1.35, w: 4.1, h: 0.45, fontSize: 16, bold: true, color: HEX.red, margin: 0, isTextBox: true });
    s.addText("With GSTiQ", { x: 8.45, y: 1.35, w: 4.2, h: 0.45, fontSize: 16, bold: true, color: HEX.green, margin: 0, isTextBox: true });
    rows.forEach(([k, a, b], i) => {
      const y = 1.9 + i * 0.8;
      card(s, 0.6, y, 12.1, 0.68, i % 2 ? "FFFFFF" : HEX.mist, { line: HEX.line, name: "Row " + k });
      s.addText(k, { x: 0.85, y, w: 3.1, h: 0.68, fontSize: 15, bold: true, color: HEX.ink, margin: 0, valign: "middle", isTextBox: true });
      s.addImage({ data: I.timesRed, x: 4.05, y: y + 0.2, w: 0.28, h: 0.28, altText: "manual" });
      s.addText(a, { x: 4.45, y, w: 3.8, h: 0.68, fontSize: 14, color: "445468", margin: 0, valign: "middle", isTextBox: true });
      s.addText(b, { x: 8.45, y, w: 4.15, h: 0.68, fontSize: 14, bold: true, color: HEX.green, margin: 0, valign: "middle", isTextBox: true });
    });
    s.addNotes("The real benefit is time and risk: what took days now takes minutes, and problems are found when the bill is entered rather than at audit or in a notice.");
  }

  {
    const s = slideFor("future", "Content");
    s.addText("Future features that can be added", { placeholder: "title" });
    menuBtn(s);
    const ff = [
      [I.globe, HEX.blue, "Direct GSTN connection", "Fetch GSTR-2B and IMS actions automatically through GSP APIs — no downloads."],
      [I.search, HEX.saffron, "Invoice OCR & QR check", "Read scanned bills and verify e-invoice IRN and signed QR codes instantly."],
      [I.users, HEX.green, "Multi-user cloud workspace", "Partner, manager and article logins with review and approval steps."],
      [I.brain, "6B3FA0", "LLM-powered GST assistant", "A large language model answering from GSTiQ’s own law base and client data."],
      [I.calc, HEX.red, "GSTR-9 / 9C & e-way bills", "Annual return reconciliation and e-way bill matching on the same engine."],
      [I.mobile, HEX.slate, "Mobile alerts", "Deadline and ITC-at-risk alerts to clients by WhatsApp, SMS or e-mail."],
    ];
    ff.forEach(([ic, col, t, d], i) => {
      const x = 0.6 + (i % 3) * 4.1, y = 1.5 + Math.floor(i / 3) * 2.6;
      card(s, x, y, 3.85, 2.35, HEX.mist, { line: HEX.line, name: t });
      tile(s, x + 0.3, y + 0.3, 0.7, ic, col);
      s.addText(t, { x: x + 0.3, y: y + 1.12, w: 3.3, h: 0.4, fontSize: 18, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
      s.addText(d, { x: x + 0.3, y: y + 1.52, w: 3.3, h: 0.75, fontSize: 13.5, color: "445468", margin: 0, valign: "top", isTextBox: true });
    });
    s.addNotes("GSTiQ is built so that new features plug into the same knowledge base and engines. Features that can be added next: a direct GSTN connection through GSP APIs, OCR for scanned invoices with e-invoice QR verification, a multi-user cloud workspace for the whole office, a large-language-model assistant grounded on our law base, GSTR-9/9C and e-way bill reconciliation, and mobile alerts to clients.");
  }

  {
    const s = slideFor("thanks", "Title Dark");
    s.addText("Thank you", { x: 0.8, y: 1.0, w: 8, h: 1.2, fontSize: 60, bold: true, color: "FFFFFF", fontFace: "Cambria", margin: 0, isTextBox: true });
    s.addText("Questions and discussion are welcome", { x: 0.8, y: 2.2, w: 8, h: 0.5, fontSize: 22, color: "C9D8F2", margin: 0, isTextBox: true });
    s.addText("GROUP ONE", { x: 0.8, y: 3.15, w: 6, h: 0.4, fontSize: 14, bold: true, color: HEX.gold, charSpacing: 2, margin: 0, isTextBox: true });
    MEMBERS.forEach(([n, r], i) => {
      const x = 0.8 + (i % 2) * 4.2, y = 3.65 + Math.floor(i / 2) * 0.82;
      card(s, x, y, 3.95, 0.7, "16294A", { line: "2A3D5E", name: "Member card" });
      s.addText([{ text: n, options: { bold: true, color: "FFFFFF", fontSize: 15, breakLine: true } }, { text: "ICAI Reg. No. " + r, options: { color: "AFC0DA", fontSize: 12 } }],
        { x: x + 0.2, y, w: 3.6, h: 0.7, margin: 0, valign: "middle", isTextBox: true });
    });
    s.addText([{ text: "Live app: ", options: { color: "AFC0DA" } }, { text: "humaregrouponekaproject.online", options: { color: "FFFFFF", bold: true, hyperlink: { url: SITE } } },
      { text: "     Code: ", options: { color: "AFC0DA" } }, { text: "github.com/Bharat4871/GST-RECO", options: { color: "FFFFFF", bold: true, hyperlink: { url: REPO } } }],
      { x: 0.8, y: 5.6, w: 8.8, h: 0.45, fontSize: 14, margin: 0, isTextBox: true });
    card(s, 9.85, 1.3, 2.75, 3.75, "FFFFFF", { name: "QR card" });
    s.addImage({ path: path.join(__dirname, "assets", "qr_site.png"), x: 10.12, y: 1.5, w: 2.2, h: 2.2, hyperlink: { url: SITE }, altText: "QR code to the live app" });
    s.addText("Try GSTiQ now", { x: 9.95, y: 3.85, w: 2.55, h: 0.5, fontSize: 14, bold: true, color: HEX.ink, align: "center", margin: 0, isTextBox: true });
    menuBtn(s, true);
    s.addNotes("Thank the faculty and the audience. Invite questions; use the Menu button to jump to any section that a question relates to.");
  }

  // =========================== HIDDEN QUIZ ANSWERS
  function answer(key, caseNo, verdict, vColor, vIcon, headline, points, gstiq) {
    const s = slideFor(key, "Content");
    s.hidden = true;
    s.addText(`Case ${caseNo} — GSTiQ’s verdict`, { placeholder: "title" });
    card(s, 0.6, 1.5, 4.2, 4.6, vColor, { name: "Verdict" });
    s.addImage({ data: vIcon, x: 2.1, y: 1.9, w: 1.2, h: 1.2, altText: verdict });
    s.addText(verdict, { x: 0.8, y: 3.3, w: 3.8, h: 0.9, fontSize: 30, bold: true, color: "FFFFFF", align: "center", valign: "middle", fontFace: "Cambria", margin: 0, isTextBox: true });
    s.addText(headline, { x: 0.8, y: 4.25, w: 3.8, h: 1.7, fontSize: 14, color: "FFFFFF", align: "center", valign: "top", margin: 0, isTextBox: true });
    s.addText("Why", { x: 5.2, y: 1.45, w: 7, h: 0.45, fontSize: 18, bold: true, color: HEX.ink, margin: 0, isTextBox: true });
    body(s, bullets(points, 15), 5.2, 1.95, 7.5, 2.9);
    card(s, 5.2, 4.95, 7.5, 1.15, HEX.mist, { line: HEX.line, name: "What GSTiQ shows" });
    s.addText([{ text: "What GSTiQ shows: ", options: { bold: true, color: HEX.blue } }, { text: gstiq }], { x: 5.45, y: 4.95, w: 7.1, h: 1.15, fontSize: 13.5, color: HEX.ink, margin: 0, valign: "middle", isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 6.3, w: 2.6, h: 0.5, rectRadius: 0.12, fill: { color: HEX.navy }, line: { color: HEX.navy }, objectName: "Back to quiz" });
    s.addImage({ data: I.back, x: 0.78, y: 6.41, w: 0.28, h: 0.28, hyperlink: { slide: N("quiz") }, altText: "Back" });
    s.addText([{ text: "Back to quiz", options: { hyperlink: { slide: N("quiz"), tooltip: "Back to quiz" }, color: "FFFFFF" } }], { x: 1.15, y: 6.3, w: 2.0, h: 0.5, fontSize: 14, bold: true, margin: 0, valign: "middle", isTextBox: true });
    const nxt = caseNo < 4 ? "q" + (caseNo + 1) : "demo";
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 3.4, y: 6.3, w: 2.6, h: 0.5, rectRadius: 0.12, fill: { color: HEX.mist }, line: { color: HEX.line }, objectName: "Next" });
    s.addText([{ text: caseNo < 4 ? `Next case ›` : "Go to live demo ›", options: { hyperlink: { slide: N(nxt), tooltip: "Next" }, color: HEX.blue } }], { x: 3.4, y: 6.3, w: 2.6, h: 0.5, fontSize: 14, bold: true, align: "center", margin: 0, valign: "middle", isTextBox: true });
    menuBtn(s);
    s.addNotes("Hidden slide - shown only when its case is clicked on the quiz slide. Use 'Back to quiz' or 'Next case'.");
  }
  answer("q1", 1, "BLOCKED", HEX.red, I.ban, "No ITC — Section 17(5)(a)", [
    "Motor vehicles for transport of persons with seating capacity of 13 or less (including driver) are blocked.",
    "Exceptions: further supply of such vehicles, transport of passengers, imparting driving training — none apply here.",
    "ITC on repairs and insurance of this car is also blocked u/s 17(5)(ab).",
  ], "status ‘Blocked u/s 17(5)(a)’ from HSN 8703 and the narration; if the ITC was claimed, a red flag to reverse it in Table 4B(1).");
  answer("q2", 2, "RCM APPLIES", HEX.saffron, I.exch, "Tenant pays 18% GST in cash; ITC in the same return", [
    "Entry 5AB of Notfn 13/2017-CT(R) (inserted by 09/2024, from 10-10-2024): renting of commercial property by an unregistered person to a registered person.",
    "Composition tenants are excluded from 16-01-2025 (Notfn 07/2025) — this tenant is a regular taxpayer.",
    "Pay ₹11,700 a month in cash (Sec 49(4)), issue a self-invoice within 30 days (Rule 47A), report in 3.1(d) and claim in 4A(3).",
  ], "RCM register entry with time of supply, due date and interest; a ‘self-invoice missing’ flag until one is generated.");
  answer("q3", 3, "LAPSED", "6B3FA0", I.hourglass, "Time-barred under Section 16(4)", [
    "The invoice belongs to FY 2024-25.",
    "Last date to claim was 30-11-2025 (or the annual return for FY 2024-25, if filed earlier).",
    "On 29-10-2026 the credit can no longer be taken; it becomes a cost.",
  ], "status ‘Lapsed u/s 16(4)’ with the deadline that was missed; the dashboard counts lapsed ITC so the client sees the loss.");
  answer("q4", 4, "REVERSE", HEX.green, I.warn, "Reverse under Rule 37A by 30-11-2026; re-avail later", [
    "Rule 37A: if the supplier has furnished GSTR-1 but not GSTR-3B for the period by 30 September of the next FY, the recipient reverses the ITC.",
    "Reversal is made in a return filed on or before 30 November (Table 4B(2)).",
    "The ITC can be re-availed once the supplier files GSTR-3B.",
  ], "status ‘Reverse – Rule 37A’, the amount in the dashboard insights and a vendor follow-up letter to the supplier.");

  // ---------- write, theme, transitions
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("written", OUT, made.length, "slides");
})().catch((e) => { console.error(e); process.exit(1); });
