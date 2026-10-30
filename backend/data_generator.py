"""
GSTiQ - Dummy data generator for a CA office.

Creates a realistic, deterministic dataset (seed 2026) for 5 clients:
  * Client master, vendor master (with valid GSTIN check digits)
  * Purchase register Jan-2026 to Sep-2026 (+ a few late FY 2024-25 bills)
  * GSTR-2B (IMS-era) with deliberate, realistic discrepancies
  * Outward supply summary (for GSTR-3B, Rule 42/43 and set-off)

Outputs (all in ../data unless noted):
  clients.csv/json, vendors.csv, purchase_register.csv, gstr2b.csv,
  sales_summary.csv, gstr2b_portal_json/*.json (GST-portal-style JSON),
  GSTiQ_Demo_Dataset.xlsx, and ../app/js/seed.js for the web app.

Run:  python backend/data_generator.py
"""
import csv
import math
import hashlib
import json
import os
import random
from datetime import date, timedelta

from gstin_utils import make_gstin

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data")
AS_ON = date(2026, 10, 29)
RNG = random.Random(2026)

FIRM = {
    "name": "Desai Mehta & Associates",
    "type": "Chartered Accountants",
    "frn": "1XXXXXW (dummy)",
    "city": "Ahmedabad",
    "partner": "CA R. K. Desai (dummy)",
}

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def pan(holder: str, name: str) -> str:
    first = (name.strip()[0] if name.strip() else "X").upper()
    if not first.isalpha():
        first = "X"
    return ("".join(RNG.choice(LETTERS) for _ in range(3)) + holder + first +
            f"{RNG.randint(1000, 9999)}" + RNG.choice(LETTERS))


def fy_of(d: date) -> str:
    y = d.year if d.month >= 4 else d.year - 1
    return f"{y}-{str(y + 1)[-2:]}"


def period_of(d: date) -> str:
    return f"{d.year}-{d.month:02d}"


def add_months(p: str, n: int) -> str:
    y, m = map(int, p.split("-"))
    m += n
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    return f"{y}-{m:02d}"


def rand_date(start: date, end: date) -> date:
    return start + timedelta(days=RNG.randint(0, (end - start).days))


# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------
CLIENTS = [
    {"id": "C1", "name": "Saurashtra Agro Exports Pvt Ltd", "state": "24", "city": "Rajkot", "holder": "C",
     "constitution": "Private Limited Company", "business": "Edible oil processing & export", "nature": "Manufacturer",
     "turnover_cr": 38.5, "filing": "Monthly", "partner": "CA R. K. Desai", "email": "accounts@saurashtraagro.example",
     "has_exempt": True},
    {"id": "C2", "name": "Narmada Infra Projects LLP", "state": "24", "city": "Ahmedabad", "holder": "F",
     "constitution": "Limited Liability Partnership", "business": "Civil construction (works contracts)", "nature": "Works Contractor",
     "turnover_cr": 52.0, "filing": "Monthly", "partner": "CA P. S. Mehta", "email": "finance@narmadainfra.example",
     "has_exempt": False},
    {"id": "C3", "name": "Shree Ganesh Textiles Pvt Ltd", "state": "24", "city": "Surat", "holder": "C",
     "constitution": "Private Limited Company", "business": "Weaving & processing of synthetic fabric", "nature": "Manufacturer",
     "turnover_cr": 24.8, "filing": "Monthly", "partner": "CA R. K. Desai", "email": "gst@shreeganeshtex.example",
     "has_exempt": False},
    {"id": "C4", "name": "Konkan Logistics & Warehousing Pvt Ltd", "state": "27", "city": "Bhiwandi", "holder": "C",
     "constitution": "Private Limited Company", "business": "Warehousing & logistics services", "nature": "Service Provider",
     "turnover_cr": 17.3, "filing": "Monthly", "partner": "CA P. S. Mehta", "email": "ap@konkanlogistics.example",
     "has_exempt": True},
    {"id": "C5", "name": "TechNova Software Solutions Pvt Ltd", "state": "29", "city": "Bengaluru", "holder": "C",
     "constitution": "Private Limited Company", "business": "Software development & IT exports", "nature": "Service Provider / Exporter",
     "turnover_cr": 61.2, "filing": "Monthly", "partner": "CA A. N. Shah", "email": "tax@technova.example",
     "has_exempt": False},
]

# ---------------------------------------------------------------------------
# Vendor templates: kind -> (name parts, holder types, vendor type, einvoice?)
# ---------------------------------------------------------------------------
PFX = ["Shree", "Jay", "Om", "Sai", "Mahalaxmi", "Navkar", "Bharat", "Kaveri", "Sahyadri", "Deccan", "Royal",
       "Prime", "Apex", "Vardhman", "Jalaram", "Ambika", "Trident", "Metro", "Unique", "Kesar", "Narayan",
       "Siddhi", "Umiya", "Pratham", "Sunrise", "Galaxy", "Excel", "Bhavani", "Tulsi", "Vishwa"]
KIND = {
    "raw":       (["Agro Commodities", "Oil Seeds Traders", "Polymers", "Yarn Traders", "Steel Traders", "Metals"], "C", "Regular"),
    "pack":      (["Packaging", "Containers", "Corrugators", "Poly Pack"], "C", "Regular"),
    "chem":      (["Chemicals", "Dye Chem", "Industries"], "C", "Regular"),
    "mach":      (["Engineering Works", "Machinery", "Automation"], "C", "Regular"),
    "spares":    (["Hardware Stores", "Bearings & Spares", "Electricals"], "F", "Regular"),
    "prof":      (["Consultants", "Management Advisors", "Technical Services"], "F", "Regular"),
    "it":        (["Infotech", "Computers", "Systems"], "C", "Regular"),
    "telecom":   (["Telecom Ltd", "Broadband Services"], "C", "Regular"),
    "gta":       (["Roadlines", "Transport Co.", "Logistics", "Cargo Movers"], "F", "Regular"),
    "gta_fcm":   (["Express Logistics Ltd", "Freight Carriers Ltd"], "C", "Regular"),
    "advocate":  (["Adv.", "Advocates & Solicitors"], "P", "Unregistered"),
    "security":  (["Security Services", "Guarding Agency"], "P", "Regular"),
    "landlord":  (["(Landlord)"], "P", "Unregistered"),
    "director":  (["(Independent Director)"], "P", "Unregistered"),
    "foreign":   (None, None, "Foreign"),
    "scrap":     (["Scrap Traders (Unregd)"], "P", "Unregistered"),
    "car":       (["Motors Pvt Ltd", "Auto Showroom"], "C", "Regular"),
    "food":      (["Caterers", "Restaurant", "Banquets"], "F", "Regular"),
    "club":      (["Gymkhana", "Fitness Club"], "A", "Regular"),
    "travel":    (["Tours & Travels", "Holidays"], "F", "Regular"),
    "insurance": (["General Insurance Co. Ltd"], "C", "Regular"),
    "civil":     (["Constructions", "Builders & Contractors", "Infra Works"], "F", "Regular"),
    "cement":    (["Cement Depot", "Building Materials"], "F", "Regular"),
    "gift":      (["Gift Gallery", "Sweets & Dry Fruits"], "F", "Regular"),
    "comp":      (["Kirana & General Stores", "Small Traders"], "P", "Composition"),
    "csr":       (["Educational Supplies", "Welfare Supplies"], "F", "Regular"),
    "stationery":(["Stationers", "Office Mart"], "F", "Regular"),
    "sponsor":   (["Sports Foundation", "Events Pvt Ltd"], "C", "Regular"),
    "hire":      (["Travels (Car Hire)"], "P", "Regular"),
    "rentreg":   (["Realty Pvt Ltd", "Estates LLP"], "C", "Regular"),
    "warehouse": (["Material Handling", "Forklift Services"], "F", "Regular"),
}
FOREIGN = [("Amazon Web Services EMEA SARL", "Luxembourg"), ("Google Asia Pacific Pte Ltd", "Singapore"),
           ("Meta Platforms Ireland Ltd", "Ireland"), ("Atlassian Pty Ltd", "Australia"),
           ("Brightpath Consulting LLC", "USA"), ("Adobe Systems Software Ireland Ltd", "Ireland")]
INDIAN_NAMES = ["Rakesh Patel", "Meena Shah", "Harish Joshi", "Kiran Desai", "Sunil Mehta", "Anita Rao",
                "Vikram Iyer", "Neha Kulkarni", "Dilip Parmar", "Suresh Nair", "Pooja Trivedi", "Manoj Pillai"]
OTHER_STATES = ["27", "29", "33", "07", "06", "08", "36", "09", "23"]


class VendorFactory:
    def __init__(self):
        self.vendors = []
        self.by_client_kind = {}
        self.used = set()

    def _name(self, kind):
        parts, holder, vtype = KIND[kind]
        if kind == "foreign":
            return None
        if kind in ("advocate",):
            return f"Adv. {RNG.choice(INDIAN_NAMES)}"
        if kind in ("landlord", "director"):
            return f"{RNG.choice(INDIAN_NAMES)} {parts[0]}"
        while True:
            n = f"{RNG.choice(PFX)} {RNG.choice(parts)}"
            if n not in self.used:
                self.used.add(n)
                return n

    def get(self, client, kind, n=1, inter_state_share=0.25):
        key = (client["id"], kind)
        if key in self.by_client_kind:
            return self.by_client_kind[key]
        out = []
        for i in range(n):
            parts, holder, vtype = KIND[kind]
            if kind == "foreign":
                fname, country = FOREIGN[(len(self.vendors) + i) % len(FOREIGN)]
                v = {"name": fname, "gstin": "", "state": "96", "type": "Foreign", "country": country}
            else:
                name = self._name(kind)
                state = client["state"]
                if vtype == "Regular" and RNG.random() < inter_state_share:
                    state = RNG.choice([s for s in OTHER_STATES if s != client["state"]])
                gst = "" if vtype == "Unregistered" else make_gstin(state, pan(holder, name), RNG.choice("1111112"))
                v = {"name": name, "gstin": gst, "state": state, "type": vtype, "country": "India"}
            v.update({
                "id": f"V{len(self.vendors) + 1:03d}",
                "client_id": client["id"],
                "kind": kind,
                "status": "Active",
                "reg_date": str(rand_date(date(2017, 7, 1), date(2024, 3, 31))) if v["gstin"] else "",
                "cancel_date": "",
                "gstr1_rate": round(RNG.uniform(0.86, 1.0), 2),
                "gstr3b_rate": round(RNG.uniform(0.84, 1.0), 2),
                "avg_delay": RNG.randint(0, 9),
                "einvoice": kind in ("raw", "pack", "chem", "mach", "it", "telecom", "car", "gta_fcm", "insurance", "rentreg"),
                "email": f"accounts{len(self.vendors) + 1:03d}@vendor.example",
                "phone": f"9{RNG.randint(100000000, 999999999)}",
            })
            self.vendors.append(v)
            out.append(v)
        self.by_client_kind[key] = out
        return out


# ---------------------------------------------------------------------------
# Purchase catalogue per client:
# (weight, kind, head, description, hsn, rate, category, (min,max), usage, rcm_id)
# ---------------------------------------------------------------------------
COMMON = [
    (4, "stationery", "Office expenses", "Printer cartridges and stationery", "4820", 18, "Inputs", (2500, 30000), "Taxable", None),
    (3, "it", "IT expenses", "Laptop for accounts team", "8471", 18, "Capital Goods", (45000, 120000), "Taxable", None),
    (3, "telecom", "Communication", "Internet broadband and telephone charges", "998422", 18, "Input Services", (4000, 25000), "Taxable", None),
    (3, "prof", "Professional fees", "Consultancy charges professional", "998311", 18, "Input Services", (20000, 180000), "Taxable", None),
    (3, "gta", "Freight inward", "Freight paid to transport company (GTA)", "996511", 5, "Input Services", (8000, 95000), "Taxable", "RCM_GTA"),
    (2, "gta_fcm", "Freight outward", "Freight charged by registered transporter with GST at 18 percent", "996511", 18, "Input Services", (15000, 120000), "Taxable", None),
    (1, "advocate", "Legal expenses", "Legal fees advocate - GST appeal / litigation", "998212", 18, "Input Services", (25000, 150000), "Taxable", "RCM_LEGAL"),
    (2, "security", "Security charges", "Security guard services (proprietor agency)", "998525", 18, "Input Services", (40000, 110000), "Taxable", "RCM_SECURITY"),
    (1, "food", "Staff welfare", "Outdoor catering for annual function", "996334", 5, "Input Services", (15000, 90000), "Taxable", None),
    (1, "gift", "Sales promotion", "Diwali gifts for customers - dry fruits boxes", "0813", 5, "Inputs", (20000, 160000), "Taxable", None),
    (1, "comp", "Miscellaneous", "Pantry and housekeeping items (composition dealer)", "3402", 0, "Inputs", (2000, 12000), "Taxable", None),
]
CATALOG = {
    "C1": COMMON + [
        (14, "raw", "Raw material", "Groundnut kernels for oil processing", "1202", 5, "Inputs", (300000, 1800000), "Taxable", None),
        (6, "pack", "Packing material", "Tin containers 15 kg", "7310", 18, "Inputs", (80000, 450000), "Taxable", None),
        (4, "chem", "Consumables", "Hexane and refining chemicals", "2901", 18, "Inputs", (40000, 260000), "Taxable", None),
        (2, "mach", "Plant & machinery", "Oil expeller machine spare assembly", "8479", 18, "Capital Goods", (150000, 900000), "Common", None),
        (3, "warehouse", "Handling charges", "Loading unloading and warehouse handling", "996719", 18, "Input Services", (12000, 60000), "Common", None),
        (2, "raw", "Trading goods", "Unbranded pulses for trading (exempt sale)", "0713", 0, "Inputs", (100000, 400000), "Exempt", None),
        (1, "foreign", "Export marketing", "Google ads campaign for export leads", "998366", 18, "Input Services", (40000, 160000), "Taxable", "RCM_IMPORT_SERVICE"),
        (1, "car", "Vehicles", "Purchase of SUV car for director", "8703", 40, "Capital Goods", (1800000, 2600000), "Taxable", None),
        (1, "scrap", "Raw material", "MS scrap from unregistered kabadi", "7204", 18, "Inputs", (60000, 240000), "Taxable", "RCM_METAL_SCRAP"),
    ],
    "C2": COMMON + [
        (10, "cement", "Project material", "Cement and TMT bars for client project (works contract)", "2523", 18, "Inputs", (150000, 1200000), "Project-WC", None),
        (6, "civil", "Sub-contract", "Sub-contract civil works for client project", "995421", 18, "Input Services", (300000, 2200000), "Project-WC", None),
        (3, "mach", "Plant & machinery", "Concrete mixer and batching plant parts", "8474", 18, "Capital Goods", (200000, 1400000), "Taxable", None),
        (2, "civil", "Own office building", "Construction of own office building - civil work", "995411", 18, "Input Services", (250000, 900000), "Own-Building", None),
        (2, "cement", "Own office building", "Cement and tiles for own office building", "6907", 18, "Inputs", (80000, 300000), "Own-Building", None),
        (3, "landlord", "Rent", "Site office rent paid to unregistered landlord", "997212", 18, "Input Services", (35000, 90000), "Taxable", "RCM_RENT_COMM"),
        (2, "hire", "Vehicle hire", "Cab hire for site engineers with fuel (5%)", "996601", 5, "Input Services", (30000, 80000), "Taxable", "RCM_MOTOR_RENT"),
        (1, "car", "Vehicles", "Innova Crysta for partners", "8703", 40, "Capital Goods", (2100000, 2700000), "Taxable", None),
        (1, "insurance", "Insurance", "Car insurance premium for partners vehicle", "997134", 18, "Input Services", (25000, 70000), "Taxable", None),
    ],
    "C3": COMMON + [
        (12, "raw", "Raw material", "Polyester filament yarn", "5402", 5, "Inputs", (200000, 1500000), "Taxable", None),
        (5, "chem", "Dyes & chemicals", "Disperse dyes and processing chemicals", "3204", 18, "Inputs", (60000, 380000), "Taxable", None),
        (3, "mach", "Plant & machinery", "Water jet loom spares and assembly", "8446", 18, "Capital Goods", (180000, 1600000), "Taxable", None),
        (2, "sponsor", "Advertisement", "Sponsorship of district cricket tournament", "998397", 18, "Input Services", (50000, 250000), "Taxable", "RCM_SPONSOR"),
        (1, "director", "Director fees", "Sitting fees to independent director", "998399", 18, "Input Services", (40000, 75000), "Taxable", "RCM_DIRECTOR"),
        (2, "food", "Staff welfare", "Canteen food for workers", "996331", 5, "Input Services", (25000, 85000), "Taxable", None),
        (1, "insurance", "Insurance", "Group mediclaim policy for employees", "997133", 18, "Input Services", (90000, 260000), "Taxable", None),
        (1, "club", "Membership", "Gymkhana club membership for MD", "999591", 18, "Input Services", (40000, 120000), "Taxable", None),
        (1, "csr", "CSR", "CSR expenditure - school kits distribution", "4820", 18, "Inputs", (80000, 300000), "CSR", None),
        (1, "car", "Vehicles", "Motor car (hatchback, below 4 m) for MD", "8703", 18, "Capital Goods", (1300000, 1700000), "Taxable", None),
    ],
    "C4": COMMON + [
        (6, "warehouse", "Handling charges", "Forklift hire and material handling", "997319", 18, "Input Services", (40000, 260000), "Common", None),
        (4, "landlord", "Rent", "Godown rent paid to unregistered owner", "997212", 18, "Input Services", (120000, 300000), "Taxable", "RCM_RENT_COMM"),
        (3, "rentreg", "Rent", "Warehouse rent - registered landlord", "997212", 18, "Input Services", (250000, 600000), "Taxable", None),
        (4, "spares", "Repairs", "Truck tyres and spares for goods carriers", "4011", 18, "Inputs", (30000, 220000), "Taxable", None),
        (2, "mach", "Plant & machinery", "Pallet racking system for warehouse", "9403", 18, "Capital Goods", (300000, 1500000), "Common", None),
        (2, "foreign", "Software", "Warehouse management SaaS subscription (foreign)", "998434", 18, "Input Services", (60000, 220000), "Taxable", "RCM_IMPORT_SERVICE"),
        (1, "travel", "Staff welfare", "Holiday package for employees (vacation)", "998552", 5, "Input Services", (60000, 240000), "Taxable", None),
        (1, "scrap", "Purchases", "Iron scrap purchase from unregistered dealer for rack fabrication", "7204", 18, "Inputs", (40000, 150000), "Taxable", "RCM_METAL_SCRAP"),
    ],
    "C5": COMMON + [
        (6, "it", "IT hardware", "Servers and networking equipment", "8471", 18, "Capital Goods", (200000, 1800000), "Taxable", None),
        (7, "foreign", "Cloud services", "AWS cloud services USD invoice", "998315", 18, "Input Services", (150000, 900000), "Taxable", "RCM_IMPORT_SERVICE"),
        (3, "foreign", "Consultancy", "Foreign consultant fees for software architecture", "998313", 18, "Input Services", (200000, 700000), "Taxable", "RCM_IMPORT_SERVICE"),
        (4, "rentreg", "Rent", "Office rent - registered landlord", "997212", 18, "Input Services", (400000, 800000), "Taxable", None),
        (2, "director", "Director fees", "Commission to independent director", "998399", 18, "Input Services", (100000, 250000), "Taxable", "RCM_DIRECTOR"),
        (2, "club", "Membership", "Fitness centre membership for employees", "997652", 18, "Input Services", (30000, 140000), "Taxable", None),
        (2, "food", "Staff welfare", "Team lunch and restaurant bills", "996331", 5, "Input Services", (12000, 70000), "Taxable", None),
        (1, "travel", "Staff welfare", "Leave travel concession tickets", "998552", 5, "Input Services", (50000, 180000), "Taxable", None),
        (1, "csr", "CSR", "CSR donation of computers to school", "8471", 18, "Inputs", (150000, 500000), "CSR", None),
    ],
}
CLIENT_HAS_EXEMPT = {"C1": True, "C4": True}
MONTHLY_COUNT = {"C1": 15, "C2": 15, "C3": 13, "C4": 12, "C5": 12}


INVOICE_STYLES = [
    lambda p, s, fy: f"{p}/{s:04d}/{fy[2:4]}-{fy[-2:]}",
    lambda p, s, fy: f"INV-{fy[2:4]}{fy[-2:]}-{s:05d}",
    lambda p, s, fy: f"GST/{fy}/{s}",
    lambda p, s, fy: f"{p}{s:05d}",
    lambda p, s, fy: f"{fy[:4]}{s:06d}",
]


def morph_invoice_no(inv: str) -> str:
    """How a supplier's GSTR-1 typically differs from the buyer's books."""
    import re
    choice = RNG.randint(0, 3)
    if choice == 0:
        return inv.replace("/", "-")
    if choice == 1:
        return re.sub(r"0+(\d)", r"\1", inv, count=1)
    if choice == 2:
        return inv.replace("-", "").replace("/", "")
    return inv.lower() if any(c.isalpha() for c in inv) else inv + " "


def typo_gstin(g: str) -> str:
    i = RNG.randint(7, 11)
    c = g[i]
    rep = str((int(c) + 1) % 10) if c.isdigit() else "X" if c != "X" else "Y"
    return g[:i] + rep + g[i + 1:]


def tax_split(taxable, rate, sup_state, pos):
    tax = round(taxable * rate / 100, 2)
    if sup_state == pos:
        half = round(tax / 2, 2)
        return 0.0, half, round(tax - half, 2)
    return tax, 0.0, 0.0


def generate():
    os.makedirs(DATA, exist_ok=True)
    vf = VendorFactory()
    purchases, gstr2b = [], []
    seqs = {}

    # Pre-create vendor pools per client
    pool_sizes = {"raw": 4, "pack": 2, "chem": 2, "mach": 2, "spares": 2, "prof": 2, "it": 2, "telecom": 1, "gta": 2,
                  "gta_fcm": 1, "advocate": 1, "security": 1, "landlord": 1, "director": 1, "foreign": 2, "scrap": 1,
                  "car": 1, "food": 2, "club": 1, "travel": 1, "insurance": 1, "civil": 3, "cement": 2, "gift": 1,
                  "comp": 1, "csr": 1, "stationery": 1, "sponsor": 1, "hire": 1, "rentreg": 1, "warehouse": 1}
    for c in CLIENTS:
        c["pan"] = pan(c["holder"], c["name"].split()[0])
        c["gstin"] = make_gstin(c["state"], c["pan"])
        for kind in {row[1] for row in CATALOG[c["id"]]}:
            vf.get(c, kind, pool_sizes.get(kind, 1))

    # Risky vendors: one cancelled + one chronic non-filer per client
    for c in CLIENTS:
        regs = [v for v in vf.vendors if v["client_id"] == c["id"] and v["type"] == "Regular" and v["kind"] in ("spares", "prof", "stationery", "chem", "pack", "warehouse", "civil", "it")]
        if regs:
            bad = regs[-1]
            bad.update({"status": "Cancelled", "cancel_date": "2026-05-31", "gstr1_rate": 0.42, "gstr3b_rate": 0.25, "avg_delay": 46})
        if len(regs) > 1:
            regs[-2].update({"gstr1_rate": 0.58, "gstr3b_rate": 0.5, "avg_delay": 31})
        if len(regs) > 2:  # a new registrant
            regs[0]["reg_date"] = "2026-03-15"

    months = [(2026, m) for m in range(1, 10)]
    for c in CLIENTS:
        cat = CATALOG[c["id"]]
        weights = [r[0] for r in cat]
        once_kinds_done = set()
        for (y, m) in months:
            start = date(y, m, 1)
            end = (date(y, m + 1, 1) if m < 12 else date(y + 1, 1, 1)) - timedelta(days=1)
            n = MONTHLY_COUNT[c["id"]] + RNG.randint(-2, 3)
            for _ in range(n):
                row = RNG.choices(cat, weights=weights)[0]
                w, kind, head, desc, hsn, rate, category, (lo, hi), usage, rcm = row
                if CLIENT_HAS_EXEMPT.get(c["id"]) and kind in ("prof", "telecom", "stationery", "security", "warehouse"):
                    usage = "Common"  # shared by taxable and exempt supplies -> Rule 42
                # one-off items (car, CSR, club...) only once or twice a year
                if w == 1 and kind in ("car", "csr", "club", "travel", "gift", "insurance") and (kind in once_kinds_done):
                    continue
                if w == 1 and kind in ("car", "csr", "club", "travel", "insurance"):
                    once_kinds_done.add(kind)
                if kind == "gift" and m not in (9,):
                    if RNG.random() < 0.8:
                        continue
                vendor = RNG.choice(vf.get(c, kind))
                inv_date = rand_date(start, end)
                if vendor["status"] == "Cancelled" and RNG.random() < 0.3:
                    inv_date = rand_date(date(2026, 6, 1), date(2026, 9, 30))
                _v = math.exp(RNG.uniform(math.log(lo), math.log(hi)))
                taxable = round(_v, 2) if RNG.random() < 0.85 else round(_v / 1000) * 1000
                # GST 2.0: before 22-09-2025 some items had 12%/28% - only relevant for late FY24-25 bills
                eff_rate = rate
                if kind == "comp":
                    eff_rate = 0
                pos = c["state"]
                sup_state = vendor["state"] if vendor["type"] != "Foreign" else "96"
                if rcm == "RCM_IMPORT_SERVICE":
                    igst, cgst, sgst = round(taxable * eff_rate / 100, 2), 0.0, 0.0
                else:
                    igst, cgst, sgst = tax_split(taxable, eff_rate, sup_state if sup_state != "96" else "XX", pos)
                cess = 0.0
                key = vendor["id"]
                seqs[key] = seqs.get(key, RNG.randint(12, 400)) + RNG.randint(1, 9)
                fy = fy_of(inv_date)
                prefix = "".join(w_[0] for w_ in vendor["name"].replace("Adv. ", "").split()[:3] if w_[0].isalpha()).upper()[:4] or "INV"
                style = INVOICE_STYLES[int(hashlib.md5(key.encode()).hexdigest(), 16) % len(INVOICE_STYLES)]
                inv_no = style(prefix, seqs[key], fy)
                if vendor["type"] == "Foreign":
                    inv_no = f"{prefix}-{inv_date.year}{inv_date.month:02d}-{seqs[key]:04d}"
                is_rcm = rcm is not None
                tax_total = igst + cgst + sgst + cess
                inv_value = round(taxable if is_rcm else taxable + tax_total, 2)
                receipt = inv_date + timedelta(days=RNG.randint(0, 6))
                if RNG.random() < 0.025 and inv_date.month >= 8:
                    receipt = None  # goods in transit
                # payment behaviour
                r = RNG.random()
                if r < 0.84:
                    pay = inv_date + timedelta(days=RNG.randint(7, 95))
                    pay = pay if pay <= AS_ON else None
                elif r < 0.93 and (AS_ON - inv_date).days > 185:
                    pay = None  # Rule 37 breach
                else:
                    pay = inv_date + timedelta(days=RNG.randint(190, 230))
                    pay = pay if pay <= AS_ON else None
                rec = {
                    "id": f"PI-{c['id']}-{len([p for p in purchases if p['client_id'] == c['id']]) + 1:04d}",
                    "client_id": c["id"], "vendor_id": vendor["id"], "supplier_gstin": vendor["gstin"],
                    "supplier_name": vendor["name"], "supplier_type": vendor["type"], "supplier_state": sup_state,
                    "invoice_no": inv_no, "invoice_date": str(inv_date), "receipt_date": str(receipt) if receipt else "",
                    "hsn_sac": hsn, "description": desc, "expense_head": head, "category": category, "pos": pos,
                    "taxable_value": taxable, "rate": eff_rate, "igst": igst, "cgst": cgst, "sgst": sgst, "cess": cess,
                    "invoice_value": inv_value, "reverse_charge": "Y" if is_rcm else "N", "rcm_type": rcm or "",
                    "rcm_paid_date": "", "self_invoice_no": "", "itc_claimed": "N", "claim_period": "",
                    "payment_date": str(pay) if pay else "", "amount_paid": inv_value if pay else 0,
                    "usage": usage, "irn": "", "remarks": "",
                }
                if vendor.get("einvoice") and vendor["gstin"] and not is_rcm:
                    rec["irn"] = hashlib.sha256(f"{vendor['gstin']}{inv_no}{fy}".encode()).hexdigest()
                # RCM payment & self-invoice
                if is_rcm:
                    tos = inv_date if rcm == "RCM_METAL_SCRAP" else inv_date
                    pr = RNG.random()
                    if pr < 0.82:
                        paid = date(tos.year, tos.month, 1) + timedelta(days=50)  # paid with 3B of the month (~20th next)
                        paid = date(paid.year, paid.month, 20)
                    elif pr < 0.92:
                        paid = date(tos.year, tos.month, 20) + timedelta(days=RNG.randint(60, 120))  # late -> interest
                    else:
                        paid = None  # still unpaid
                    if paid and paid <= AS_ON:
                        rec["rcm_paid_date"] = str(paid)
                    if vendor["type"] in ("Unregistered", "Foreign"):
                        rec["self_invoice_no"] = f"SI/{c['id']}/{fy}/{len(purchases) + 1:04d}" if RNG.random() < 0.9 else ""
                purchases.append(rec)

    # ---- Late / old invoices: FY 2024-25 found late (time-barred), FY 2025-26 not yet claimed
    for c in CLIENTS:
        raw = [v for v in vf.vendors if v["client_id"] == c["id"] and v["kind"] in ("raw", "pack", "chem", "spares", "stationery", "warehouse") and v["status"] == "Active" and v["type"] == "Regular"] or \
              [v for v in vf.vendors if v["client_id"] == c["id"] and v["status"] == "Active" and v["type"] == "Regular" and v["kind"] in ("it", "prof", "telecom")]
        for i, (d_from, d_to) in enumerate([(date(2025, 2, 1), date(2025, 3, 28)), (date(2025, 7, 1), date(2025, 9, 15)),
                                           (date(2025, 10, 1), date(2025, 12, 20)), (date(2025, 12, 1), date(2026, 3, 25))]):
            v = RNG.choice(raw)
            inv_date = rand_date(d_from, d_to)
            rate = 12 if inv_date < date(2025, 9, 22) and i == 1 else 18
            if i == 2 and c["id"] in ("C1", "C3"):
                rate = 12  # wrong post GST-2.0 rate -> rate-validation flag
            taxable = round(RNG.uniform(60000, 420000) / 10) * 10
            igst, cgst, sgst = tax_split(taxable, rate, v["state"], c["state"])
            fy = fy_of(inv_date)
            inv_no = f"LATE/{fy}/{RNG.randint(100, 999)}"
            purchases.append({
                "id": f"PI-{c['id']}-{len([p for p in purchases if p['client_id'] == c['id']]) + 1:04d}", "client_id": c["id"],
                "vendor_id": v["id"], "supplier_gstin": v["gstin"], "supplier_name": v["name"], "supplier_type": v["type"],
                "supplier_state": v["state"], "invoice_no": inv_no, "invoice_date": str(inv_date),
                "receipt_date": str(inv_date + timedelta(days=3)), "hsn_sac": "3923", "description": "Packing material (bill traced during audit)",
                "expense_head": "Packing material", "category": "Inputs", "pos": c["state"], "taxable_value": taxable, "rate": rate,
                "igst": igst, "cgst": cgst, "sgst": sgst, "cess": 0.0, "invoice_value": round(taxable + igst + cgst + sgst, 2),
                "reverse_charge": "N", "rcm_type": "", "rcm_paid_date": "", "self_invoice_no": "", "itc_claimed": "N",
                "claim_period": "", "payment_date": str(inv_date + timedelta(days=40)), "amount_paid": round(taxable + igst + cgst + sgst, 2),
                "usage": "Taxable", "irn": "", "remarks": "Bill received late from site office",
            })

    # ---- Duplicates in books (accountant booked twice)
    for c in CLIENTS[:4]:
        cand = [p for p in purchases if p["client_id"] == c["id"] and p["reverse_charge"] == "N" and p["supplier_gstin"] and p["invoice_date"] >= "2026-04-01"]
        d = dict(RNG.choice(cand))
        d["id"] = f"PI-{c['id']}-{len([p for p in purchases if p['client_id'] == c['id']]) + 1:04d}"
        d["remarks"] = "Entered from scanned copy"
        purchases.append(d)

    # ---- DRC-01C (Rule 88D) scenario: TechNova claims a large ITC in Aug-2026 that is not in GSTR-2B
    c5 = CLIENTS[4]
    v = [x for x in vf.vendors if x["client_id"] == "C5" and x["kind"] == "it"][0]
    taxable = 16500000.0
    igst, cgst, sgst = tax_split(taxable, 18, v["state"], c5["state"])
    purchases.append({
        "id": f"PI-C5-{len([p for p in purchases if p['client_id'] == 'C5']) + 1:04d}", "client_id": "C5", "vendor_id": v["id"],
        "supplier_gstin": v["gstin"], "supplier_name": v["name"], "supplier_type": "Regular", "supplier_state": v["state"],
        "invoice_no": "DC/2627/0091", "invoice_date": "2026-08-15", "receipt_date": "2026-08-20", "hsn_sac": "8471",
        "description": "Data centre servers and storage arrays", "expense_head": "IT hardware", "category": "Capital Goods",
        "pos": c5["state"], "taxable_value": taxable, "rate": 18, "igst": igst, "cgst": cgst, "sgst": sgst, "cess": 0.0,
        "invoice_value": round(taxable + igst + cgst + sgst, 2), "reverse_charge": "N", "rcm_type": "", "rcm_paid_date": "",
        "self_invoice_no": "", "itc_claimed": "Y", "claim_period": "2026-08", "payment_date": "2026-09-10",
        "amount_paid": round(taxable + igst + cgst + sgst, 2), "usage": "Taxable", "irn": "", "remarks": "Supplier yet to upload invoice",
    })

    # ---- Build GSTR-2B with discrepancies + mark ITC claims
    vend = {v["id"]: v for v in vf.vendors}
    for p in purchases:
        v = vend[p["vendor_id"]]
        inv_date = date.fromisoformat(p["invoice_date"])
        per = period_of(inv_date)
        in_2b = bool(p["supplier_gstin"]) and p["supplier_type"] in ("Regular",) and p["remarks"] not in ("Entered from scanned copy", "Supplier yet to upload invoice")
        if p["supplier_type"] == "Composition":
            in_2b = False
        flags = []
        r = RNG.random()
        miss_prob = 0.05 + (1 - v["gstr1_rate"]) * 0.6
        if v["status"] == "Cancelled" and inv_date > date(2026, 5, 31):
            miss_prob = 0.85
        b = None
        if in_2b and r >= miss_prob:
            b = {
                "client_id": p["client_id"], "return_period": per, "supplier_gstin": p["supplier_gstin"],
                "supplier_name": p["supplier_name"].upper() if RNG.random() < 0.5 else p["supplier_name"],
                "invoice_no": p["invoice_no"], "invoice_date": p["invoice_date"], "invoice_type": "R", "pos": p["pos"],
                "taxable_value": p["taxable_value"], "rate": p["rate"], "igst": p["igst"], "cgst": p["cgst"], "sgst": p["sgst"],
                "cess": p["cess"], "invoice_value": p["invoice_value"] if p["reverse_charge"] == "N" else round(p["taxable_value"], 2),
                "reverse_charge": p["reverse_charge"], "itc_available": "Y", "reason": "",
                "gstr1_filing_date": str(date(inv_date.year, inv_date.month, 1) + timedelta(days=RNG.randint(38, 42))),
                "supplier_3b_filed": "Y" if RNG.random() < v["gstr3b_rate"] + 0.05 else "N",
                "ims_action": "Accepted", "source": "e-Invoice" if p["irn"] else "GSTR-1", "irn": p["irn"],
            }
            q = RNG.random()
            if q < 0.08:
                b["invoice_no"] = morph_invoice_no(p["invoice_no"]); flags.append("inv_format")
            elif q < 0.12:
                delta = round(p["taxable_value"] * RNG.choice([-1, 1]) * RNG.uniform(0.02, 0.09), 2)
                b["taxable_value"] = round(p["taxable_value"] + delta, 2)
                f = b["taxable_value"] / p["taxable_value"]
                for k in ("igst", "cgst", "sgst"):
                    b[k] = round(p[k] * f, 2)
                b["invoice_value"] = round(b["taxable_value"] + b["igst"] + b["cgst"] + b["sgst"], 2); flags.append("value")
            elif q < 0.15:
                nd = inv_date + timedelta(days=RNG.choice([-3, -2, -1, 1, 2, 4]))
                b["invoice_date"] = str(nd); flags.append("date")
            elif q < 0.17 and p["supplier_gstin"]:
                p["supplier_gstin"] = typo_gstin(p["supplier_gstin"]); flags.append("gstin_typo")
            elif q < 0.20 and per < "2026-09":
                b["return_period"] = add_months(per, RNG.choice([1, 2])); flags.append("late")
            elif q < 0.215 and p["supplier_state"] != p["pos"]:
                b["itc_available"] = "N"; b["reason"] = "POS"; flags.append("itc_na")
            # IMS action
            a = RNG.random()
            if p["receipt_date"] == "":
                b["ims_action"] = "Pending"
            elif a < 0.80:
                b["ims_action"] = "Accepted"
            elif a < 0.95:
                b["ims_action"] = "No Action"
            elif a < 0.985:
                b["ims_action"] = "Pending"
            else:
                b["ims_action"] = "Rejected"
            if per <= "2026-03":  # older periods - actions finalised
                if b["ims_action"] == "Pending":
                    b["ims_action"] = "Accepted"
            gstr2b.append(b)
        # ITC claim status in books (what the client actually claimed in GSTR-3B)
        fy = fy_of(inv_date)
        if p["reverse_charge"] == "Y":
            if p["rcm_paid_date"]:
                p["itc_claimed"] = "Y"; p["claim_period"] = period_of(date.fromisoformat(p["rcm_paid_date"]) - timedelta(days=25))
        elif p["supplier_type"] in ("Regular",):
            if fy == "2024-25":
                pass  # found late, never claimed -> time-barred
            elif p["remarks"] == "Bill received late from site office" and fy == "2025-26":
                pass  # not yet claimed - deadline 30-11-2026
            elif b is not None and b["ims_action"] in ("Accepted", "No Action"):
                p["itc_claimed"] = "Y"; p["claim_period"] = b["return_period"]
            elif p["remarks"] == "Supplier yet to upload invoice":
                pass  # already marked claimed (DRC-01C scenario)
            elif b is None and RNG.random() < 0.45:
                p["itc_claimed"] = "Y"; p["claim_period"] = per  # claimed although not in 2B -> excess claim
            elif p["remarks"] == "Entered from scanned copy":
                p["itc_claimed"] = "Y"; p["claim_period"] = per

    # Extra records in 2B not booked in purchase register
    for c in CLIENTS:
        regs = [v for v in vf.vendors if v["client_id"] == c["id"] and v["type"] == "Regular" and v["status"] == "Active"]
        for _ in range(RNG.randint(4, 7)):
            v = RNG.choice(regs)
            d = rand_date(date(2026, 2, 1), date(2026, 9, 25))
            taxable = round(RNG.uniform(5000, 260000) / 10) * 10
            igst, cgst, sgst = tax_split(taxable, 18, v["state"], c["state"])
            gstr2b.append({
                "client_id": c["id"], "return_period": period_of(d), "supplier_gstin": v["gstin"], "supplier_name": v["name"],
                "invoice_no": f"X{RNG.randint(1000, 9999)}/{fy_of(d)}", "invoice_date": str(d), "invoice_type": "R", "pos": c["state"],
                "taxable_value": taxable, "rate": 18, "igst": igst, "cgst": cgst, "sgst": sgst, "cess": 0.0,
                "invoice_value": round(taxable + igst + cgst + sgst, 2), "reverse_charge": "N", "itc_available": "Y", "reason": "",
                "gstr1_filing_date": str(d + timedelta(days=15)), "supplier_3b_filed": "Y",
                "ims_action": RNG.choice(["Accepted", "No Action", "Pending"]) if d >= date(2026, 8, 1) else "Accepted",
                "source": "GSTR-1", "irn": "",
            })

    for i, b in enumerate(gstr2b):
        b["id"] = f"2B-{b['client_id']}-{i + 1:05d}"

    # ---- Outward supplies summary per client per month
    sales = []
    for c in CLIENTS:
        base = c["turnover_cr"] * 1e7 / 12
        for (y, m) in [(2026, mm) for mm in range(1, 10)]:
            tv = base * RNG.uniform(0.82, 1.18)
            exempt = tv * (RNG.uniform(0.08, 0.16) if c["has_exempt"] else 0)
            zero = tv * (0.35 if c["id"] in ("C1", "C5") else 0.0) * RNG.uniform(0.8, 1.2)
            taxable = tv - exempt - zero
            inter = taxable * RNG.uniform(0.25, 0.45)
            intra = taxable - inter
            orate = {"C1": 5, "C2": 18, "C3": 5, "C4": 18, "C5": 18}[c["id"]]
            sales.append({
                "client_id": c["id"], "period": f"{y}-{m:02d}", "taxable_intra": round(intra), "taxable_inter": round(inter),
                "zero_rated": round(zero), "exempt": round(exempt), "nil_rated": 0, "non_gst": 0, "output_rate": orate,
                "out_igst": round(inter * orate / 100), "out_cgst": round(intra * orate / 200), "out_sgst": round(intra * orate / 200),
            })

    vendors_out = []
    for v in vf.vendors:
        vendors_out.append({k: v[k] for k in ("id", "client_id", "name", "gstin", "state", "type", "kind", "status", "reg_date",
                                              "cancel_date", "gstr1_rate", "gstr3b_rate", "avg_delay", "einvoice", "email", "phone", "country")})
    clients_out = []
    for c in CLIENTS:
        clients_out.append({k: c[k] for k in ("id", "name", "gstin", "pan", "state", "city", "constitution", "business", "nature",
                                              "turnover_cr", "filing", "partner", "email", "has_exempt")})
    return clients_out, vendors_out, purchases, gstr2b, sales


def write_csv(path, rows):
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def portal_json(gstin, period, rows):
    """GST-portal-like GSTR-2B JSON (b2b section)."""
    by_ctin = {}
    for b in rows:
        if b["ims_action"] == "Rejected":
            continue
        d = date.fromisoformat(b["invoice_date"])
        by_ctin.setdefault(b["supplier_gstin"], {"ctin": b["supplier_gstin"], "trdnm": b["supplier_name"],
                                                 "supfildt": date.fromisoformat(b["gstr1_filing_date"]).strftime("%d-%m-%Y"),
                                                 "supprd": period.replace("-", "")[4:] + period[:4], "inv": []})
        by_ctin[b["supplier_gstin"]]["inv"].append({
            "inum": b["invoice_no"], "typ": "R", "dt": d.strftime("%d-%m-%Y"), "val": b["invoice_value"], "pos": b["pos"],
            "rev": b["reverse_charge"], "itcavl": b["itc_available"], "rsn": b["reason"], "diffprcnt": 1,
            "srctyp": b["source"], "irn": b["irn"], "txval": b["taxable_value"], "igst": b["igst"], "cgst": b["cgst"],
            "sgst": b["sgst"], "cess": b["cess"], "imsStatus": b["ims_action"],
        })
    return {"chksum": hashlib.sha256(f"{gstin}{period}".encode()).hexdigest()[:32],
            "data": {"gstin": gstin, "rtnprd": period[5:] + period[:4], "version": "1.0",
                     "gendt": f"14-{int(period[5:]) % 12 + 1:02d}-{period[:4] if period[5:] != '12' else int(period[:4]) + 1}",
                     "docdata": {"b2b": list(by_ctin.values())}}}


def main():
    clients, vendors, purchases, gstr2b, sales = generate()
    write_csv(os.path.join(DATA, "clients.csv"), clients)
    write_csv(os.path.join(DATA, "vendors.csv"), vendors)
    write_csv(os.path.join(DATA, "purchase_register.csv"), purchases)
    write_csv(os.path.join(DATA, "gstr2b.csv"), gstr2b)
    write_csv(os.path.join(DATA, "sales_summary.csv"), sales)
    with open(os.path.join(DATA, "clients.json"), "w") as f:
        json.dump(clients, f, indent=1)

    pj = os.path.join(DATA, "gstr2b_portal_json")
    os.makedirs(pj, exist_ok=True)
    for c in clients:
        periods = sorted({b["return_period"] for b in gstr2b if b["client_id"] == c["id"]})
        for per in periods:
            rows = [b for b in gstr2b if b["client_id"] == c["id"] and b["return_period"] == per]
            with open(os.path.join(pj, f"GSTR2B_{c['gstin']}_{per.replace('-', '')}.json"), "w") as f:
                json.dump(portal_json(c["gstin"], per, rows), f, indent=1)

    import pandas as pd
    with pd.ExcelWriter(os.path.join(DATA, "GSTiQ_Demo_Dataset.xlsx")) as xw:
        for name, rows in (("Clients", clients), ("Vendors", vendors), ("Purchase_Register", purchases),
                           ("GSTR_2B", gstr2b), ("Sales_Summary", sales)):
            pd.DataFrame(rows).to_excel(xw, sheet_name=name, index=False)

    seed = {"firm": FIRM, "as_on": str(AS_ON), "clients": clients, "vendors": vendors, "purchases": purchases,
            "gstr2b": gstr2b, "sales": sales}
    with open(os.path.join(ROOT, "app", "js", "seed.js"), "w", encoding="utf-8") as f:
        f.write("/* AUTO-GENERATED by backend/data_generator.py - dummy data for demonstration */\n")
        f.write("window.GSTIQ_SEED = " + json.dumps(seed, separators=(",", ":")) + ";\n")
    with open(os.path.join(DATA, "seed.json"), "w", encoding="utf-8") as f:
        json.dump(seed, f)
    print(f"Generated {len(clients)} clients, {len(vendors)} vendors, {len(purchases)} purchase invoices, "
          f"{len(gstr2b)} GSTR-2B records, {len(sales)} monthly sales rows.")


if __name__ == "__main__":
    main()
