# GSTiQ — AI-powered ITC & RCM Suite for CA Offices

**ICAI Advanced IT (AICITSS) project** · *Artificial Intelligence and the Goods and Services Tax Act, 2017 — Input Tax Credit and Reverse Charge Mechanism*
Submitted by **Lakhnotra Bharat Bholabhai** · Law position as on **29-10-2026** · all client data is fictitious

---

## Open it in 10 seconds

Double-click **`OPEN_ME_GSTiQ_App.html`** (same file as `dist/GSTiQ_Standalone.html`).
It runs completely offline in Chrome, Edge or Firefox — no installation, no internet, nothing to configure.

## Run with the Python engine (optional)

Adds scikit-learn models, the SQLite database, formula-driven Excel reports and a REST API.

| Windows | macOS / Linux |
|---|---|
| double-click `run_windows.bat` | `./run_mac_linux.sh` |

or manually:

```bash
pip install -r requirements.txt
python backend/app.py          # then open http://127.0.0.1:5000
```

The web app detects the engine automatically (top bar shows **Python engine linked**).

---

## What the project does

| Area | Features |
|---|---|
| **ITC eligibility** | Every bill checked against Sec 16(2)(a)–(d), 16(2)(aa)/(ba), 16(4), 17(5), Rules 36(4), 37, 37A; GSTIN check digit; supplier cancellation; GST 2.0 rate validation; rule-by-rule explanation per invoice |
| **Reconciliation** | Books vs GSTR-2B in four passes — exact key, AI fuzzy match (Levenshtein + amount + date), GSTIN rescue, leftovers; duplicates; IMS Accept/Reject/Pending; vendor follow-up letters |
| **Reverse charge** | Decision wizard over all 23 notified entries (services, goods, Sec 9(4)); time of supply u/s 12(3)/13(3); due date; interest; self-invoice & payment voucher generator; RCM register |
| **Returns** | GSTR-3B Table 3.1(d) and Table 4 per Circular 170/02/2022 with drill-down; Rule 42 & 43 with annual true-up; optimal set-off (Sec 49, 49A, 49B, Rule 88A); Rule 86B; DRC-01C (Rule 88D) check; interest u/s 50 |
| **Artificial intelligence** | Expense classifier (Naive Bayes in browser / TF-IDF + Logistic Regression in Python), Isolation Forest anomaly detection, Benford's law, vendor risk scoring, ITC forecast, GST Mitra chatbot with data-aware answers |
| **CA office workflow** | 5 clients, practice overview, AI insights, compliance calendar, Ctrl+K search, import CSV/Excel/portal JSON with smart column mapping, export everything, client MIS workbook, review report, audit trail, dark mode, mobile layout |

## Technologies

HTML5 · CSS3 · JavaScript · Python (Flask, scikit-learn, pandas, openpyxl) · SQL (SQLite) · Excel formulas + VBA · Jupyter · JSON

## Folder structure

```
OPEN_ME_GSTiQ_App.html   single-file offline app (start here)
dist/                    built app: GSTiQ_Standalone.html (offline) and GSTiQ_artifact.html (CDN version)
app/                     source of the web app - index.html, css/, js/, vendor/ (Chart.js, SheetJS), fonts/
backend/                 Python: Flask API (app.py), engines (recon, itc, rcm, returns), ai_engine, report_generator,
                         database, pipeline, CLI (gstiq_cli.py), dummy-data generator
knowledge/               build_knowledge.py -> gst_knowledge.json (the law encoded as data, shared by both engines)
data/                    dummy data: CSV, JSON, Excel workbook, GST-portal-format GSTR-2B JSON files
database/                schema.sql (tables, views), queries.sql (14 analytical queries), gstiq.db
excel/                   ITC_RCM_Working_Model.xlsx (1,281 formulas), GSTiQ_Macros.bas (VBA), builder script
notebooks/               AI_ITC_RCM_Analysis.ipynb (executed, with charts)
docs/                    GSTiQ_Project_Report.docx / .pdf, diagrams, screenshots, report builder
presentation/            GSTiQ_Group_One_Presentation.pptx (interactive deck) and its builder script
sample_outputs/          files produced by the app: client MIS, review report, vendor letters, self-invoice, Python MIS
sample_new_client/       ready-to-import new client (Gir Polymers): purchase register Excel + GST-portal GSTR-2B JSON
tests/                   unit tests, Python-vs-JavaScript cross-check, browser UI smoke test
tools/build.py           rebuilds the knowledge base and the single-file app
```

## Useful commands

```bash
python backend/gstiq_cli.py                                   # ITC & RCM summary for all clients
python backend/gstiq_cli.py --client C2 --period 2026-08 --excel
python backend/gstiq_cli.py --classify "Freight paid to Sai Roadlines"
python backend/gstiq_cli.py --ask "Is RCM applicable on rent from unregistered landlord?"
python backend/database.py --queries                          # rebuild SQLite DB and run all SQL queries
python backend/data_generator.py && python tools/build.py     # regenerate dummy data and rebuild the app
python excel/build_excel_model.py                             # rebuild the Excel model
```

## Try importing a new client

`sample_new_client/` holds a fresh client with 49 purchase bills (Excel) and its September 2026 GSTR-2B (portal JSON). The workbook's *How to import* sheet gives the steps and *Test Scenarios* lists every planted error. Regenerate with `python tools/make_new_client_sample.py`.

## Tests

```bash
python tests/test_engine.py            # 23 law-specific unit tests
python tests/test_cross_language.py    # Python and JavaScript engines agree on all 609 invoices (needs Node.js)
python tests/ui_smoke_test.py          # opens every page in headless Chromium (needs: pip install playwright)
python tests/test_import_new_client.py # imports the new-client Excel + GSTR-2B JSON through the app and checks every planted error
```

## Demo data at a glance

5 clients (Gujarat, Maharashtra, Karnataka), 133 vendors, 609 purchase invoices (Jan–Sep 2026 plus late FY 2024-25 / 2025-26 bills), 474 GSTR-2B records, monthly outward-supply summaries. Deliberate errors are injected — invoice-number format differences, value/date mismatches, GSTIN typos, non-filing and cancelled suppliers, duplicates, unpaid bills (Rule 37), supplier 3B default (Rule 37A), unpaid RCM, missing self-invoices, a 12% rate after GST 2.0, and a ₹1.65 crore claim not in GSTR-2B (DRC-01C scenario).

## Law covered (as on 29-10-2026)

CGST Act Sec 2, 9(3), 9(4), 12, 13, 16 (incl. 16(5), 16(6)), 17(5) (incl. Finance Act 2025 amendment to 17(5)(d)), 24, 31(3)(f)/(g), 49, 49A, 49B, 50, 51; IGST Act Sec 5(3), 5(4); CGST Rules 36(4), 37, 37A, 42, 43, 46, 47A, 86B, 88A, 88B, 88D; Notifications 13/2017 & 04/2017-CT(R) as amended (05/2022, 06/2024, 09/2024, 07/2025), 10/2017-IT(R); Circulars 140/10/2020, 170/02/2022, 211/5/2024; GST 2.0 rates from 22-09-2025; Invoice Management System; 57th GST Council recommendations (08-10-2026) shown as *proposed*, not applied.

## Third-party components

Chart.js 4.4.1 (MIT), SheetJS xlsx 0.18.5 (Apache-2.0), IBM Plex Sans/Mono and Bricolage Grotesque fonts (SIL Open Font License), Flask, scikit-learn, pandas, openpyxl.

## Disclaimer

Educational project. Rules are simplified for automation; verify with the current Acts, Rules, notifications and circulars before use on real returns. All names, GSTINs and figures in the demo data are fictitious.
