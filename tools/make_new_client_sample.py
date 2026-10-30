"""Creates an import-ready sample for a NEW client:
   sample_new_client/Gir_Polymers_Purchase_Register_Sep2026.xlsx   (purchase register + client master + summary + guide)
   sample_new_client/GSTR2B_<GSTIN>_092026.json                    (GST-portal format GSTR-2B for September 2026)
Run:  python tools/make_new_client_sample.py
All names and GSTINs are fictitious (valid check digits, not real taxpayers)."""
import hashlib
import json
import os
import random
import sys
from datetime import date, timedelta

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))
from gstin_utils import make_gstin  # noqa: E402

rnd = random.Random(1966)
OUT = os.path.join(ROOT, "sample_new_client")
os.makedirs(OUT, exist_ok=True)

CLIENT = {"Client ID": "C6", "Client name": "Gir Polymers Pvt Ltd", "GSTIN": make_gstin("24", "AAKCG4821M"), "PAN": "AAKCG4821M",
          "State code": "24", "City": "Rajkot", "Constitution": "Private Limited Company", "Business": "Plastic moulded components & packaging",
          "Nature": "Manufacturer", "Turnover (₹ Cr)": 24.6, "Filing frequency": "Monthly", "Partner in charge": "CA R. K. Desai",
          "Email": "accounts@girpolymers.example", "Has exempt supplies": "No"}


def pan(letter4, name):
    a = "".join(rnd.choice("ABCDEFGHJKLMNPQRSTUVWXYZ") for _ in range(3))
    return f"{a}{letter4}{name[0].upper()}{rnd.randint(1000, 9999)}{rnd.choice('ABCDEFGHJKLMNPRSTUVWXZ')}"


# vendor: key -> (name, state, type, constitution letter)
V = {
    "reliance": ("Saurashtra Petro Granules Pvt Ltd", "24", "Regular", "C"),
    "haldia": ("Bharuch Polymer Traders", "24", "Regular", "F"),
    "mbatch": ("Colourtech Masterbatch LLP", "24", "Regular", "F"),
    "pack": ("Shree Hari Corrugated Boxes", "24", "Regular", "F"),
    "mould": ("Precision Mould Works Pvt Ltd", "27", "Regular", "C"),
    "machine": ("Deccan Plastic Machinery Pvt Ltd", "27", "Regular", "C"),
    "gta": ("Jay Ambe Roadlines", "24", "Regular", "F"),
    "elec": ("Rajkot Electricals & Switchgear", "24", "Regular", "F"),
    "tele": ("Bharat Telelink Ltd", "24", "Regular", "C"),
    "ca": ("Mehta Shah & Co (Cost Accountants)", "24", "Regular", "F"),
    "soft": ("Cloudline Software Solutions Pvt Ltd", "29", "Regular", "C"),
    "car": ("Kathiawar Motors Pvt Ltd", "24", "Regular", "C"),
    "caterer": ("Annapurna Caterers", "24", "Regular", "F"),
    "gifts": ("Rangoli Gift House", "24", "Regular", "F"),
    "insure": ("Suraksha General Insurance Ltd", "27", "Regular", "C"),
    "club": ("Rajkot Gymkhana Club", "24", "Regular", "A"),
    "stationery": ("Navrang Stationers", "24", "Regular", "F"),
    "late": ("Om Sai Industrial Supplies", "24", "Regular", "F"),
    "nonfiler": ("Vardhman Plastic Chemicals", "24", "Regular", "F"),
    "cement": ("Gir Cement Depot", "24", "Regular", "F"),
    "advocate": ("Adv. Nirav J. Trivedi", "24", "Unregistered", "P"),
    "landlord": ("Shri Harsukhbhai K. Patel", "24", "Unregistered", "P"),
    "security": ("Sentinel Guards (Partnership)", "24", "Regular", "F"),
    "director": ("Mr. Kiran Joshi (Independent Director)", "24", "Unregistered", "P"),
}
GST = {}
for k, (name, st, typ, c4) in V.items():
    GST[k] = "" if typ == "Unregistered" else make_gstin(st, pan(c4, name.replace("Shri ", "").replace("Mr. ", "")))

D = lambda dd, mm=9: date(2026, mm, dd)  # noqa: E731
rows, twob, guide = [], [], []
n = 0


def add(k, inv, dt, hsn, desc, head, cat, taxable, rate, *, usage="Taxable", rcm="", rcm_type="", paid=None, si="", claimed="Y",
        recv=None, remark="", in2b=True, b2b_inv=None, b2b_val=None, b2b_dt=None, ims="Accepted", itcavl="Y", rsn="", gstin=None, scenario="Clean - should match"):
    global n
    n += 1
    name, st, typ, _ = V[k]
    inter = st != "24"
    tax = round(taxable * rate / 100, 2)
    ig, cg, sg = (tax, 0.0, 0.0) if inter else (0.0, round(tax / 2, 2), round(tax - round(tax / 2, 2), 2))
    invval = round(taxable + (0 if rcm == "Y" else tax), 2)
    g = gstin if gstin is not None else GST[k]
    r = {"Entry ID": f"GP/PUR/{n:03d}", "Supplier GSTIN": g, "Supplier name": name, "Supplier type": typ, "Supplier state code": st,
         "Invoice no": inv, "Invoice date": dt, "Receipt date": recv or dt + timedelta(days=rnd.randint(0, 3)), "HSN/SAC": hsn, "Description": desc,
         "Expense head": head, "ITC category": cat, "Place of supply": "24", "Taxable value": taxable, "GST rate %": rate,
         "IGST": ig, "CGST": cg, "SGST/UTGST": sg, "Cess": 0.0, "Invoice value": invval, "Reverse charge (Y/N)": rcm or "N", "RCM type": rcm_type,
         "RCM paid date": paid, "Self-invoice no": si, "ITC claimed (Y/N)": claimed, "Claim period (yyyy-mm)": "2026-09" if claimed == "Y" else "",
         "Payment date": dt + timedelta(days=rnd.choice([7, 15, 21, 30])) if k not in ("late",) else None,
         "Amount paid": invval if k != "late" else 0, "Usage": usage, "Remarks": remark}
    rows.append(r)
    guide.append((r["Entry ID"], name, inv, scenario))
    if in2b and typ != "Unregistered":
        tv = b2b_val if b2b_val is not None else taxable
        t2 = round(tv * rate / 100, 2)
        i2, c2, s2 = (t2, 0.0, 0.0) if inter else (0.0, round(t2 / 2, 2), round(t2 - round(t2 / 2, 2), 2))
        twob.append({"ctin": GST[k], "trdnm": name.upper(), "inum": b2b_inv or inv, "dt": b2b_dt or dt, "txval": tv, "igst": i2, "cgst": c2, "sgst": s2,
                     "val": round(tv + (0 if rcm == "Y" else t2), 2), "rev": rcm or "N", "itcavl": itcavl, "rsn": rsn, "ims": ims})
    return r


def amt(lo, hi):
    return round(rnd.uniform(lo, hi), 2)


# ---- clean, matching inward supplies (raw material, packing, services)
for i, dd in enumerate([2, 4, 6, 9, 11, 13, 16, 18, 22, 25, 27]):
    add("reliance", f"SPG/26-27/{1180 + i * 7}", D(dd), "3901", "HDPE granules (injection grade) 25 kg bags", "Raw material", "Inputs", amt(180000, 620000), 18)
for i, dd in enumerate([3, 12, 19, 26]):
    add("mbatch", f"CTM-{2650 + i}", D(dd), "3206", "Colour masterbatch - blue/white", "Raw material", "Inputs", amt(35000, 95000), 18)
for i, dd in enumerate([5, 15, 24]):
    add("pack", f"SHC/{410 + i}/2026-27", D(dd), "4819", "Corrugated boxes 5-ply for finished goods", "Packing material", "Inputs", amt(22000, 68000), 5)
add("tele", "BTL/GJ/2627/558812", D(1), "998422", "Leased line & mobile bills - September", "Communication", "Input Services", 18450.00, 18)
add("ca", "MSC/2026-27/071", D(10), "998221", "Cost audit fees FY 2025-26 (first instalment)", "Professional fees", "Input Services", 75000.00, 18)
add("soft", "CSS/KA/26-27/3391", D(14), "997331", "ERP cloud subscription - quarterly", "Software", "Input Services", 64500.00, 18, scenario="Clean - inter-State (IGST) service")
add("elec", "RES/26-27/0942", D(17), "8536", "Switchgear & MCB for moulding shop", "Repairs", "Inputs", 41280.00, 18)
add("stationery", "NS/1187", D(20), "4820", "Registers, printer paper & toner", "Office expenses", "Inputs", 6840.00, 18)

# ---- capital goods (inter-State)
add("machine", "DPM/MH/2627/0057", D(8), "8477", "Injection moulding machine 250 T with robot arm", "Plant & machinery", "Capital Goods", 3850000.00, 18,
    scenario="Capital goods, inter-State IGST - should match")
add("mould", "PMW/0319/26-27", D(21), "8480", "Injection mould for 20 L bucket (4 cavity)", "Plant & machinery", "Capital Goods", 465000.00, 18,
    scenario="Capital goods, inter-State IGST - should match")

# ---- reconciliation problems
add("reliance", "SPG/26-27/1263", D(29), "3901", "LLDPE granules", "Raw material", "Inputs", 288400.00, 18,
    b2b_inv="SPG-2627-1263", scenario="Invoice no format differs (SPG/26-27/1263 vs SPG-2627-1263) - AI fuzzy match")
add("mbatch", "CTM-2657", D(28), "3206", "Colour masterbatch - black", "Raw material", "Inputs", 52300.00, 18,
    b2b_inv="CTM/2657", scenario="Invoice no format differs - AI fuzzy match")
add("pack", "SHC/416/2026-27", D(30), "4819", "Corrugated boxes 3-ply", "Packing material", "Inputs", 38900.00, 5,
    b2b_val=39890.00, scenario="Value mismatch: books 38,900 vs 2B 39,890")
add("elec", "RES/26-27/0981", D(23), "8544", "Power cables 4 core", "Repairs", "Inputs", 27650.00, 18,
    b2b_val=26750.00, scenario="Value mismatch: books 27,650 vs 2B 26,750 (digit transposed)")
add("haldia", "BPT/2627/115", D(7), "3902", "PP homopolymer granules", "Raw material", "Inputs", 214300.00, 18,
    b2b_dt=D(17), scenario="Date mismatch: books 07-09 vs 2B 17-09")
bad = GST["haldia"][:-1] + ("A" if GST["haldia"][-1] != "A" else "B")
add("haldia", "BPT/2627/131", D(19), "3902", "PP copolymer granules", "Raw material", "Inputs", 176800.00, 18,
    gstin=bad, scenario="GSTIN typo in books (wrong check digit) - GSTIN rescue match")
add("nonfiler", "VPC/26/088", D(9), "3812", "UV stabiliser additive", "Raw material", "Inputs", 58600.00, 18, in2b=False,
    scenario="Missing in GSTR-2B - supplier did not file GSTR-1; ITC claimed (excess claim)")
add("nonfiler", "VPC/26/094", D(22), "3812", "Anti-static additive", "Raw material", "Inputs", 44250.00, 18, in2b=False,
    scenario="Missing in GSTR-2B - supplier did not file GSTR-1")
add("late", "OSIS/552", D(26), "8482", "Bearings & spares for machines", "Repairs", "Inputs", 19870.00, 18, in2b=False, claimed="N",
    remark="Supplier says will upload in October GSTR-1; payment pending", scenario="Missing in 2B, not claimed, unpaid - defer ITC")
add("stationery", "NS/1201", D(27), "4820", "Office files and folders", "Office expenses", "Inputs", 3920.00, 18,
    ims="Pending", scenario="IMS action Pending on portal")
add("elec", "RES/26-27/0990", D(29), "8536", "Contactors (wrongly billed)", "Repairs", "Inputs", 15400.00, 18,
    ims="Rejected", scenario="IMS Rejected by client - goods returned; ITC not available")
dup = add("pack", "SHC/413/2026-27", D(12), "4819", "Corrugated boxes 5-ply (duplicate posting)", "Packing material", "Inputs", 0, 5, in2b=False,
          scenario="Duplicate entry in books (same invoice posted twice)")
first_pack = next(r for r in rows if r["Supplier name"] == V["pack"][0])
for f in ("Invoice no", "Invoice date", "Receipt date", "HSN/SAC", "Taxable value", "IGST", "CGST", "SGST/UTGST", "Invoice value", "Payment date", "Amount paid"):
    dup[f] = first_pack[f]
dup["Description"] = first_pack["Description"] + " (posted twice)"

# ---- rate issue after GST 2.0
add("cement", "GCD/5521", D(16), "6810", "Concrete blocks for factory compound wall", "Repairs", "Inputs", 48200.00, 12,
    scenario="12% rate charged - not a valid GST 2.0 rate after 22-09-2025 - flag; also wall = immovable property 17(5)(d)")

# ---- blocked credits u/s 17(5)
add("car", "KM/SAL/26-27/0388", D(5), "8703", "Motor car (sedan, 1497 cc) for Managing Director", "Vehicles", "Capital Goods", 1240000.00, 40,
    scenario="Blocked 17(5)(a) - motor car (seating < 13)")
add("caterer", "AC/261", D(30), "996334", "Lunch & dinner for staff - Ganesh Chaturthi function", "Staff welfare", "Input Services", 36500.00, 5,
    scenario="Blocked 17(5)(b)(i) - food & beverages")
add("gifts", "RGH/0912", D(25), "7113", "Silver coins as Diwali gift to dealers", "Sales promotion", "Inputs", 84000.00, 3,
    usage="Gift", scenario="Blocked 17(5)(h) - goods given as gift")
add("insure", "SGI/MH/HLT/774521", D(3), "997133", "Group health insurance for employees", "Insurance", "Input Services", 128600.00, 18,
    scenario="Blocked 17(5)(b) - health insurance, unless obligatory under law")
add("club", "RGC/MEM/2627/0142", D(1), "999599", "Corporate membership fee - Rajkot Gymkhana Club", "Membership", "Input Services", 59000.00, 18,
    scenario="Blocked 17(5)(b)(ii) - club membership")

# ---- reverse charge
add("gta", "JAR/LR/4471", D(10), "996511", "Lorry freight - granules from Hazira (GTA, RCM 5%)", "Freight inward", "Input Services", 42800.00, 5,
    rcm="Y", rcm_type="RCM_GTA", paid=D(20, 10), scenario="RCM - GTA (appears in 2B with Reverse charge = Y)")
add("gta", "JAR/LR/4532", D(24), "996511", "Lorry freight - finished goods to Ahmedabad (GTA, RCM 5%)", "Freight outward", "Input Services", 18600.00, 5,
    rcm="Y", rcm_type="RCM_GTA", paid=D(20, 10), scenario="RCM - GTA (appears in 2B with Reverse charge = Y)")
add("advocate", "NJT/26/41", D(12), "998212", "Legal fees - recovery suit against dealer", "Legal expenses", "Input Services", 55000.00, 18,
    rcm="Y", rcm_type="RCM_LEGAL", paid=D(20, 10), si="SI/GP/2026-27/0007", scenario="RCM - advocate services; self-invoice issued")
add("landlord", "RENT/SEP-26", D(1), "997212", "Rent of godown (commercial) - September", "Rent", "Input Services", 65000.00, 18,
    rcm="Y", rcm_type="RCM_RENT_COMM", paid=D(20, 10), si="",
    scenario="RCM - commercial rent from unregistered landlord; SELF-INVOICE MISSING (Rule 47A)")
add("security", "SG/2627/219", D(30), "998525", "Security guards for factory - September", "Security charges", "Input Services", 72000.00, 18,
    rcm="Y", rcm_type="RCM_SECURITY", paid=None, scenario="RCM - security services by partnership firm; RCM NOT YET PAID")
add("director", "DSF/Q2", D(28), "999799", "Sitting fees - board meeting 28-09-2026", "Director fees", "Input Services", 40000.00, 18,
    rcm="Y", rcm_type="RCM_DIRECTOR", paid=D(20, 10), si="SI/GP/2026-27/0008", scenario="RCM - director sitting fees")

# ---- GSTR-2B records with no entry in books
extra = [("mould", "PMW/0331/26-27", D(30), 12500.00, "Mould repair charges - invoice not yet received / not booked"),
         ("tele", "BTL/GJ/2627/561230", D(15), 2340.00, "Additional data pack - not booked")]
for k, inv, dt, tv, why in extra:
    name, st, *_ = V[k]
    t2 = round(tv * 0.18, 2)
    inter = st != "24"
    twob.append({"ctin": GST[k], "trdnm": name.upper(), "inum": inv, "dt": dt, "txval": tv, "igst": t2 if inter else 0.0, "cgst": 0.0 if inter else round(t2 / 2, 2),
                 "sgst": 0.0 if inter else round(t2 - round(t2 / 2, 2), 2), "val": round(tv + t2, 2), "rev": "N", "itcavl": "Y", "rsn": "", "ims": "No Action"})
    guide.append(("(2B only)", name, inv, f"Missing in books - {why}"))

# ---------------- GSTR-2B portal JSON
f = lambda dt: dt.strftime("%d-%m-%Y")  # noqa: E731
by = {}
for b in twob:
    s = by.setdefault(b["ctin"], {"ctin": b["ctin"], "trdnm": b["trdnm"], "supfildt": f(D(rnd.randint(5, 11), 10)), "supprd": "092026", "inv": []})
    s["inv"].append({"inum": b["inum"], "typ": "R", "dt": f(b["dt"]), "val": b["val"], "pos": "24", "rev": b["rev"], "itcavl": b["itcavl"], "rsn": b["rsn"],
                     "diffprcnt": 1, "srctyp": "e-Invoice" if b["txval"] > 500000 else "GSTR-1", "irn": "", "txval": b["txval"], "igst": b["igst"],
                     "cgst": b["cgst"], "sgst": b["sgst"], "cess": 0.0, "imsStatus": b["ims"]})
data = {"gstin": CLIENT["GSTIN"], "rtnprd": "092026", "version": "1.0", "gendt": "14-10-2026", "docdata": {"b2b": list(by.values())}}
doc = {"chksum": hashlib.md5(json.dumps(data, sort_keys=True).encode()).hexdigest(), "data": data}
jpath = os.path.join(OUT, f"GSTR2B_{CLIENT['GSTIN']}_092026.json")
with open(jpath, "w", encoding="utf-8") as fh:
    json.dump(doc, fh, indent=1, ensure_ascii=False)

# ---------------- Excel workbook
ARIAL = "Arial"
HEAD = PatternFill("solid", fgColor="1D4D9C")
thin = Side(style="thin", color="C7D1DE")
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
wb = Workbook()
ws = wb.active
ws.title = "Purchase Register"
cols = list(rows[0].keys())
ws.append(cols)
for r in rows:
    ws.append([r[c] for c in cols])
money_cols = {"Taxable value", "IGST", "CGST", "SGST/UTGST", "Cess", "Invoice value", "Amount paid"}
date_cols = {"Invoice date", "Receipt date", "RCM paid date", "Payment date"}
widths = {"Supplier name": 34, "Description": 46, "Supplier GSTIN": 18, "Remarks": 40, "Invoice no": 20, "Expense head": 18}
for j, c in enumerate(cols, 1):
    h = ws.cell(1, j)
    h.font = Font(name=ARIAL, bold=True, color="FFFFFF", size=10)
    h.fill = HEAD
    h.alignment = Alignment(wrap_text=True, vertical="center")
    h.border = BOX
    ws.column_dimensions[get_column_letter(j)].width = widths.get(c, 14)
    for i in range(2, len(rows) + 2):
        cell = ws.cell(i, j)
        cell.font = Font(name=ARIAL, size=10)
        cell.border = BOX
        if c in money_cols:
            cell.number_format = "#,##0.00"
        elif c in date_cols:
            cell.number_format = "dd-mm-yyyy"
        elif c == "GST rate %":
            cell.number_format = "0"
ws.row_dimensions[1].height = 32
ws.freeze_panes = "C2"
ws.auto_filter.ref = f"A1:{get_column_letter(len(cols))}{len(rows) + 1}"

cm = wb.create_sheet("Client Master")
cm.append(list(CLIENT.keys()))
cm.append(list(CLIENT.values()))
for j in range(1, len(CLIENT) + 1):
    cm.cell(1, j).font = Font(name=ARIAL, bold=True, color="FFFFFF", size=10)
    cm.cell(1, j).fill = HEAD
    cm.cell(2, j).font = Font(name=ARIAL, size=10)
    cm.column_dimensions[get_column_letter(j)].width = 22

# Summary with live formulas (separate sheet so the register stays import-clean)
sm = wb.create_sheet("Summary")
N = len(rows) + 1
col = {c: get_column_letter(cols.index(c) + 1) for c in cols}
rng = lambda c: f"'Purchase Register'!${col[c]}$2:${col[c]}${N}"  # noqa: E731
sm["A1"] = "Gir Polymers Pvt Ltd - Purchase register summary, September 2026"
sm["A1"].font = Font(name=ARIAL, bold=True, size=13)
sm["A2"] = "All figures are formulas on the 'Purchase Register' sheet - edit the register and these update."
sm["A2"].font = Font(name=ARIAL, italic=True, size=9, color="6F7D90")
lines = [("Number of bills", f"=COUNTA({rng('Entry ID')})"),
         ("Taxable value", f"=SUM({rng('Taxable value')})"),
         ("IGST", f"=SUM({rng('IGST')})"), ("CGST", f"=SUM({rng('CGST')})"), ("SGST", f"=SUM({rng('SGST/UTGST')})"),
         ("Total GST", "=SUM(B6:B8)"),
         ("GST on forward-charge bills", f"=SUMIFS({rng('IGST')},{rng('Reverse charge (Y/N)')},\"N\")+SUMIFS({rng('CGST')},{rng('Reverse charge (Y/N)')},\"N\")+SUMIFS({rng('SGST/UTGST')},{rng('Reverse charge (Y/N)')},\"N\")"),
         ("GST payable under reverse charge", f"=SUMIFS({rng('IGST')},{rng('Reverse charge (Y/N)')},\"Y\")+SUMIFS({rng('CGST')},{rng('Reverse charge (Y/N)')},\"Y\")+SUMIFS({rng('SGST/UTGST')},{rng('Reverse charge (Y/N)')},\"Y\")"),
         ("GST on capital goods", f"=SUMIFS({rng('IGST')},{rng('ITC category')},\"Capital Goods\")+SUMIFS({rng('CGST')},{rng('ITC category')},\"Capital Goods\")+SUMIFS({rng('SGST/UTGST')},{rng('ITC category')},\"Capital Goods\")"),
         ("Bills with ITC claimed", f"=COUNTIF({rng('ITC claimed (Y/N)')},\"Y\")"),
         ("Bills unpaid", f"=COUNTIF({rng('Amount paid')},0)")]
sm["A4"], sm["B4"] = "Item", "Amount (₹)"
for c in ("A4", "B4"):
    sm[c].font = Font(name=ARIAL, bold=True, color="FFFFFF")
    sm[c].fill = HEAD
for i, (lab, fml) in enumerate(lines, 5):
    sm.cell(i, 1, lab).font = Font(name=ARIAL, size=10)
    c = sm.cell(i, 2, fml)
    c.font = Font(name=ARIAL, size=10)
    c.number_format = "#,##0" if lab.startswith(("Number", "Bills")) else "#,##0.00"
sm.column_dimensions["A"].width = 36
sm.column_dimensions["B"].width = 20

g = wb.create_sheet("Test Scenarios")
g.append(["Entry ID", "Supplier", "Invoice no", "What GSTiQ should detect"])
for x in guide:
    g.append(list(x))
for j, w in enumerate([12, 40, 24, 90], 1):
    g.column_dimensions[get_column_letter(j)].width = w
    g.cell(1, j).font = Font(name=ARIAL, bold=True, color="FFFFFF")
    g.cell(1, j).fill = HEAD
for row in g.iter_rows(min_row=2):
    for c in row:
        c.font = Font(name=ARIAL, size=10)

h = wb.create_sheet("How to import")
steps = ["HOW TO LOAD THIS CLIENT INTO GSTiQ",
         "",
         "1. Open GSTiQ -> Clients -> Add client. Enter the details from the 'Client Master' sheet (GSTIN " + CLIENT["GSTIN"] + "). Save.",
         "   (or: Data -> Import -> choose this file -> sheet 'Client Master' -> type 'Client master')",
         "2. Select 'Gir Polymers Pvt Ltd' in the client selector at the top and period September 2026.",
         "3. Data -> Import -> choose this Excel file -> sheet 'Purchase Register' -> type 'Purchase register'. Columns map automatically. Import.",
         f"4. Data -> Import -> choose GSTR2B_{CLIENT['GSTIN']}_092026.json (GST portal format). Import.",
         "5. Open Reconciliation, ITC eligibility, RCM register, GSTR-3B and AI Lab to see the results.",
         "",
         "The 'Test Scenarios' sheet lists every deliberate error, so you can check the tool catches each one.",
         "Do not add totals or blank rows inside 'Purchase Register' - it must stay a clean table for import.",
         "All names and GSTINs are fictitious (valid check digits, not real taxpayers)."]
for s in steps:
    h.append([s])
h["A1"].font = Font(name=ARIAL, bold=True, size=13)
for r in range(2, len(steps) + 1):
    h.cell(r, 1).font = Font(name=ARIAL, size=10)
h.column_dimensions["A"].width = 130

xpath = os.path.join(OUT, "Gir_Polymers_Purchase_Register_Sep2026.xlsx")
wb.save(xpath)
print(len(rows), "purchase rows,", len(twob), "GSTR-2B rows,", len(by), "suppliers in 2B")
print(xpath)
print(jpath)
