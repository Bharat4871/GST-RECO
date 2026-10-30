"""
Excel MIS report generator (openpyxl).

Creates a client-ready workbook from engine results:
  Summary (formula-driven KPIs + chart) | ITC Register | Reconciliation | RCM Register |
  GSTR-3B | Vendor Risk | Action Plan
Detail rows are values; every total / KPI is an Excel formula so the workbook
recalculates when the CA edits a row.
"""
import io
from datetime import date

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

INK = "1F3A5F"
SAFFRON = "C8871B"
THIN = Side(style="thin", color="C9D2DE")
HDR_FILL = PatternFill("solid", fgColor=INK)
SUB_FILL = PatternFill("solid", fgColor="EEF2F7")
NUM = '#,##0.00;(#,##0.00);"-"'
FONT = "Arial"


def _hdr(ws, row, headers, widths=None):
    for i, h in enumerate(headers, 1):
        c = ws.cell(row=row, column=i, value=h)
        c.font = Font(name=FONT, bold=True, color="FFFFFF", size=10)
        c.fill = HDR_FILL
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = Border(top=THIN, bottom=THIN, left=THIN, right=THIN)
    ws.row_dimensions[row].height = 30
    if widths:
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(row=row + 1, column=1)


def _title(ws, title, subtitle):
    ws["A1"] = title
    ws["A1"].font = Font(name=FONT, bold=True, size=14, color=INK)
    ws["A2"] = subtitle
    ws["A2"].font = Font(name=FONT, italic=True, size=9, color="5B6B7F")


def _rows(ws, start, rows, num_cols=()):
    for r_i, row in enumerate(rows):
        for c_i, v in enumerate(row, 1):
            c = ws.cell(row=start + r_i, column=c_i, value=v)
            c.font = Font(name=FONT, size=9)
            c.border = Border(bottom=Side(style="hair", color="D5DCE6"))
            if c_i in num_cols:
                c.number_format = NUM
    return start + len(rows)


def _total(ws, row, label_col, cols, first, last):
    ws.cell(row=row, column=label_col, value="Total").font = Font(name=FONT, bold=True, size=9)
    for c in cols:
        L = get_column_letter(c)
        cell = ws.cell(row=row, column=c, value=f"=SUBTOTAL(9,{L}{first}:{L}{last})")
        cell.font = Font(name=FONT, bold=True, size=9)
        cell.number_format = NUM
        cell.fill = SUB_FILL


def build_workbook(client, evals, recon, rcm_rows, g3b, vendor_risk, purchases, as_on=None, firm=None):
    as_on = as_on or date.today().isoformat()
    firm = firm or {}
    pmap = {p["id"]: p for p in purchases}
    wb = Workbook()

    # ---------------- ITC Register
    ws = wb.active
    ws.title = "ITC Register"
    _title(ws, f"ITC Eligibility Register - {client['name']}", f"GSTIN {client['gstin']} | As on {as_on} | Prepared by GSTiQ")
    heads = ["Entry ID", "Supplier", "GSTIN", "Invoice No", "Invoice Date", "Description", "Taxable (₹)", "GST (₹)",
             "Status", "Eligible ITC (₹)", "Blocked (₹)", "At risk (₹)", "Deferred (₹)", "Lapsed (₹)", "Claimed", "Key issue"]
    _hdr(ws, 4, heads, [12, 28, 17, 18, 11, 34, 13, 12, 22, 13, 12, 12, 12, 11, 8, 60])
    rows = []
    for e in evals:
        p = pmap[e["id"]]
        issue = next((f["msg"] for f in e["flags"] if f["severity"] == "high"), next((f["msg"] for f in e["flags"]), ""))
        rows.append([e["id"], p["supplier_name"], p["supplier_gstin"], p["invoice_no"], p["invoice_date"], p["description"],
                     float(p["taxable_value"]), e["tax"], e["status_label"], e["eligible_itc"], e["blocked_itc"],
                     e["at_risk_itc"], e["deferred_itc"], e["lapsed_itc"], "Y" if e["claimed"] else "N", issue])
    end = _rows(ws, 5, rows, num_cols=(7, 8, 10, 11, 12, 13, 14))
    _total(ws, end, 6, (7, 8, 10, 11, 12, 13, 14), 5, end - 1)
    ws.auto_filter.ref = f"A4:P{end - 1}"
    red = PatternFill("solid", fgColor="FBE3E1")
    ws.conditional_formatting.add(f"I5:I{end - 1}", CellIsRule(operator="notEqual", formula=['"Eligible"'], fill=red))
    itc_last = end - 1

    # ---------------- Reconciliation
    ws = wb.create_sheet("Reconciliation")
    _title(ws, "GSTR-2B vs Purchase Register Reconciliation", "Exact, fuzzy (AI) and GSTIN-rescue matching | tolerance ₹1")
    heads = ["Status", "Supplier", "GSTIN", "Invoice No", "Invoice Date", "Books tax (₹)", "2B tax (₹)", "Difference (₹)",
             "2B period", "IMS action", "Confidence", "Note"]
    _hdr(ws, 4, heads, [18, 28, 17, 18, 11, 13, 13, 13, 9, 11, 10, 70])
    rows = [[r["label"], r["supplier_name"], r["supplier_gstin"], r["invoice_no"], r["invoice_date"], r["books_tax"], r["b2b_tax"],
             None, r["return_period"], r["ims_action"], r["confidence"], r["note"]] for r in recon if r["status"] != "NOT_APPLICABLE"]
    end = _rows(ws, 5, rows, num_cols=(6, 7, 8))
    for i in range(5, end):
        ws.cell(row=i, column=8, value=f"=F{i}-G{i}").number_format = NUM
        ws.cell(row=i, column=11).number_format = "0%"
    _total(ws, end, 5, (6, 7, 8), 5, end - 1)
    ws.auto_filter.ref = f"A4:L{end - 1}"
    recon_last = end - 1

    # ---------------- RCM Register
    ws = wb.create_sheet("RCM Register")
    _title(ws, "Reverse Charge Register", "Time of supply u/s 12(3)/13(3) | payment in cash u/s 49(4) | interest @18% u/s 50")
    heads = ["Entry ID", "Supplier", "RCM type", "Invoice Date", "Taxable (₹)", "Rate %", "RCM tax (₹)", "Time of supply",
             "Liability period", "Due date", "Paid on", "Status", "Delay (days)", "Interest (₹)", "Self-invoice", "3B table"]
    _hdr(ws, 4, heads, [12, 28, 34, 11, 13, 7, 12, 12, 10, 11, 11, 13, 9, 11, 22, 8])
    rows = [[r["id"], r["supplier_name"], r["rcm_title"], r["invoice_date"], r["taxable_value"], r["rate"], None, r["tos"],
             r["liability_period"], r["due_date"], r["paid_date"], r["status"], r["delay_days"], r["interest"],
             r["self_invoice_no"] or ("MISSING" if r["self_invoice_required"] else "N/A"), r["table"]] for r in rcm_rows]
    end = _rows(ws, 5, rows, num_cols=(5, 7, 14))
    for i in range(5, end):
        ws.cell(row=i, column=7, value=f"=ROUND(E{i}*F{i}/100,2)").number_format = NUM
    _total(ws, end, 4, (5, 7, 14), 5, end - 1)
    rcm_last = end - 1

    # ---------------- GSTR-3B
    ws = wb.create_sheet("GSTR-3B")
    _title(ws, f"GSTR-3B working - period {g3b['period']}", "Table 3.1 & Table 4 as per Circular 170/02/2022-GST")
    _hdr(ws, 4, ["Table", "Description", "Taxable value (₹)", "IGST (₹)", "CGST (₹)", "SGST (₹)", "Cess (₹)"], [9, 58, 16, 14, 14, 14, 10])
    from common import kb
    names = kb()["gstr3b_tables"]
    names.update({"3.1(a)": "Outward taxable supplies (other than zero-rated, nil, exempt)", "3.1(b)": "Zero-rated supplies",
                  "3.1(c)": "Nil-rated and exempted supplies", "3.1(e)": "Non-GST outward supplies"})
    order = ["3.1(a)", "3.1(b)", "3.1(c)", "3.1(d)", "3.1(e)", "4A(1)", "4A(2)", "4A(3)", "4A(4)", "4A(5)", "4B(1)", "4B(2)", "4C", "4D(1)", "4D(2)"]
    r = 5
    row_of = {}
    for key in order:
        t = g3b["tables"][key]
        ws.cell(row=r, column=1, value=key).font = Font(name=FONT, bold=True, size=9)
        ws.cell(row=r, column=2, value=names.get(key, key)).font = Font(name=FONT, size=9)
        vals = [t.get("value"), t.get("igst"), t.get("cgst"), t.get("sgst"), t.get("cess")]
        for j, v in enumerate(vals, 3):
            c = ws.cell(row=r, column=j, value=v if key != "4C" else None)
            c.number_format = NUM
            c.font = Font(name=FONT, size=9)
        row_of[key] = r
        r += 1
    rc = row_of["4C"]
    for j in range(4, 8):
        L = get_column_letter(j)
        a = "+".join(f"{L}{row_of[k]}" for k in ("4A(1)", "4A(2)", "4A(3)", "4A(4)", "4A(5)"))
        ws.cell(row=rc, column=j, value=f"=({a})-({L}{row_of['4B(1)']}+{L}{row_of['4B(2)']})").number_format = NUM
        ws.cell(row=rc, column=j).fill = SUB_FILL
    r += 1
    ws.cell(row=r, column=2, value="ITC claimed in books for this period").font = Font(name=FONT, bold=True, size=9)
    ws.cell(row=r, column=4, value=g3b["itc_claimed_total"]).number_format = NUM
    ws.cell(row=r + 1, column=2, value="Net ITC as per GSTiQ (4C total)").font = Font(name=FONT, bold=True, size=9)
    ws.cell(row=r + 1, column=4, value=f"=SUM(D{rc}:G{rc})").number_format = NUM
    ws.cell(row=r + 2, column=2, value="Difference (books - GSTiQ)").font = Font(name=FONT, bold=True, size=9)
    ws.cell(row=r + 2, column=4, value=f"=D{r}-D{r + 1}").number_format = NUM
    ws.cell(row=r + 3, column=2, value="Rule 42/43 reversal included in 4B(1)").font = Font(name=FONT, size=9)
    ws.cell(row=r + 3, column=4, value=g3b["rule42_43_reversal"]).number_format = NUM
    ws.cell(row=r + 4, column=2, value=f"DRC-01C risk (Rule 88D): {'YES - excess ITC beyond ₹25 lakh and 20%' if g3b['drc01c']['risk'] else 'No'}").font = Font(name=FONT, size=9, bold=True, color="B42318" if g3b["drc01c"]["risk"] else "067647")

    # ---------------- Vendor Risk
    ws = wb.create_sheet("Vendor Risk")
    _title(ws, "AI Vendor Risk Scorecard", "Score 0-100 from filing behaviour, 2B gaps, mismatches, registration status")
    heads = ["Vendor", "GSTIN", "Status", "Score", "Grade", "Invoices", "Missing in 2B", "ITC exposure (₹)", "Recommended action"]
    _hdr(ws, 4, heads, [30, 17, 10, 8, 7, 9, 12, 15, 36])
    rows = [[v["name"], v["gstin"], v["status"], v["score"], v["grade"], v["invoices"], v["missing_in_2b"], v["itc_exposure"], v["action"]]
            for v in vendor_risk]
    end = _rows(ws, 5, rows, num_cols=(8,))
    ws.conditional_formatting.add(f"D5:D{max(5, end - 1)}", CellIsRule(operator="greaterThanOrEqual", formula=["50"], fill=red))
    ws.conditional_formatting.add(f"D5:D{max(5, end - 1)}", CellIsRule(operator="between", formula=["30", "49.99"],
                                                                         fill=PatternFill("solid", fgColor="FDF0D5")))

    # ---------------- Action plan
    ws = wb.create_sheet("Action Plan")
    _title(ws, "Action plan for the client", "Generated from rule flags - review before sharing")
    _hdr(ws, 4, ["Priority", "Area", "Action", "Reference", "Entries", "Amount (₹)"], [9, 22, 70, 22, 9, 15])
    groups = {}
    for e in evals:
        for f in e["flags"]:
            if f["severity"] in ("high", "medium"):
                g = groups.setdefault(f["code"], {"sev": f["severity"], "ref": f["ref"], "n": 0, "amt": 0.0, "msg": f["msg"]})
                g["n"] += 1
                g["amt"] += e["tax"]
    text = {"BLOCKED": "Reverse blocked credits u/s 17(5) in Table 4B(1)", "EXCESS_CLAIM": "Reverse ITC claimed without 2B reflection / follow up suppliers",
            "RULE_37": "Reverse ITC for bills unpaid beyond 180 days (re-avail on payment)", "RULE_37A": "Reverse ITC where supplier GSTR-3B not filed by 30 Sept",
            "RCM_UNPAID": "Pay pending RCM in cash with interest", "SUPPLIER_CANCELLED": "Stop claiming ITC on bills of cancelled suppliers",
            "DEADLINE_NEAR": "Claim pending FY 2025-26 ITC in October 2026 GSTR-3B (due 20-Nov-2026)", "TIME_BARRED": "Write off lapsed ITC (Sec 16(4))",
            "DUPLICATE": "Delete duplicate purchase entry and reverse ITC", "VALUE_MISMATCH": "Claim the lower of books / 2B or get supplier to amend in GSTR-1A",
            "SELF_INVOICE": "Issue self-invoices for RCM purchases from unregistered/foreign suppliers", "GSTIN_INVALID": "Correct supplier GSTIN in vendor master",
            "ITC_RESTRICTED": "Report PoS-restricted ITC in 4D(2)", "SUPPLIER_3B_PENDING": "Follow up suppliers to file GSTR-3B before 30 September",
            "RATE_INVALID": "Verify GST rate after GST 2.0 rationalisation (22-09-2025)", "WRONG_HEAD": "Ask supplier to correct IGST/CGST+SGST head",
            "TAX_ARITH": "Verify tax computation on invoice", "RULE_37_LATE": "Pay interest for period between reversal and re-availment"}
    rows = []
    for code, g in sorted(groups.items(), key=lambda kv: (kv[1]["sev"] != "high", -kv[1]["amt"])):
        rows.append(["High" if g["sev"] == "high" else "Medium", code.replace("_", " ").title(), text.get(code, g["msg"]), g["ref"], g["n"], round(g["amt"], 2)])
    end = _rows(ws, 5, rows, num_cols=(6,))

    # ---------------- Summary (first sheet)
    ws = wb.create_sheet("Summary", 0)
    _title(ws, f"{firm.get('name', 'CA Office')} - ITC & RCM Review", f"{client['name']} | GSTIN {client['gstin']} | As on {as_on}")
    ws.column_dimensions["A"].width = 44
    ws.column_dimensions["B"].width = 20
    ws.column_dimensions["C"].width = 14
    kpis = [
        ("Total GST on inward supplies (₹)", f"='ITC Register'!H{itc_last + 1}"),
        ("Eligible ITC (₹)", f"='ITC Register'!J{itc_last + 1}"),
        ("Blocked u/s 17(5) (₹)", f"='ITC Register'!K{itc_last + 1}"),
        ("ITC at risk - reversal / not in 2B (₹)", f"='ITC Register'!L{itc_last + 1}"),
        ("Deferred - not received / RCM unpaid (₹)", f"='ITC Register'!M{itc_last + 1}"),
        ("Lapsed u/s 16(4) (₹)", f"='ITC Register'!N{itc_last + 1}"),
        ("Invoices evaluated", f"=COUNTA('ITC Register'!A5:A{itc_last})"),
        ("Invoices not Eligible", f"=COUNTIF('ITC Register'!I5:I{itc_last},\"<>Eligible\")"),
        ("Reconciliation - matched records", f"=COUNTIF(Reconciliation!A5:A{recon_last},\"Matched\")+COUNTIF(Reconciliation!A5:A{recon_last},\"Probable match\")"),
        ("Reconciliation - missing in 2B", f"=COUNTIF(Reconciliation!A5:A{recon_last},\"Missing in 2B\")"),
        ("Reconciliation - missing in books", f"=COUNTIF(Reconciliation!A5:A{recon_last},\"Missing in books\")"),
        ("RCM tax (₹)", f"='RCM Register'!G{rcm_last + 1}"),
        ("Interest on delayed RCM (₹)", f"='RCM Register'!N{rcm_last + 1}"),
        ("Eligible ITC as % of total GST", "=IFERROR(B6/B5,0)"),
    ]
    _hdr(ws, 4, ["Key indicator", "Value"])
    ws.freeze_panes = None
    for i, (k, f) in enumerate(kpis, 5):
        ws.cell(row=i, column=1, value=k).font = Font(name=FONT, size=10)
        c = ws.cell(row=i, column=2, value=f)
        c.font = Font(name=FONT, size=10, bold=True, color="008000")  # green = cross-sheet links
        c.number_format = "0.0%" if "%" in k else ("#,##0" if k.startswith(("Invoices", "Reconciliation")) else NUM)
    # chart data
    ws["D4"], ws["E4"] = "Bucket", "Amount (₹)"
    for j, (lab, ref) in enumerate([("Eligible", "B6"), ("Blocked", "B7"), ("At risk", "B8"), ("Deferred", "B9"), ("Lapsed", "B10")], 5):
        ws.cell(row=j, column=4, value=lab).font = Font(name=FONT, size=9)
        ws.cell(row=j, column=5, value=f"={ref}").number_format = NUM
    ch = BarChart()
    ch.type = "bar"
    ch.title = "ITC position"
    ch.y_axis.title = "₹"
    ch.add_data(Reference(ws, min_col=5, min_row=4, max_row=9), titles_from_data=True)
    ch.set_categories(Reference(ws, min_col=4, min_row=5, max_row=9))
    ch.height, ch.width = 7.5, 15
    ch.legend = None
    ws.add_chart(ch, "D12")
    ws["A21"] = "Notes"
    ws["A21"].font = Font(name=FONT, bold=True)
    ws["A22"] = "Figures are computed by GSTiQ rule & AI engines on dummy data; verify against books, GSTR-2B and current law."
    ws["A23"] = "Green values link to detail sheets; edit a detail row and the summary recalculates."
    for c in ("A22", "A23"):
        ws[c].font = Font(name=FONT, size=9, italic=True, color="5B6B7F")

    for sh in wb.worksheets:
        sh.sheet_view.showGridLines = False
    return wb


def to_bytes(wb):
    bio = io.BytesIO()
    wb.save(bio)
    return bio.getvalue()
