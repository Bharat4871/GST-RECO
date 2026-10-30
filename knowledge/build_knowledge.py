"""
GSTiQ — GST Knowledge Base builder
==================================
Single source of truth for the legal rules used by BOTH engines:
  * Python engine  (backend/*.py)   -> reads knowledge/gst_knowledge.json
  * Web app engine (app/js/*.js)     -> reads app/js/kb.js (generated)

Run:  python knowledge/build_knowledge.py

Law position compiled as on 29-Oct-2026 (CGST Act, 2017 as amended up to
Finance Act, 2025; rate notifications effective 22-Sep-2025 "GST 2.0";
57th GST Council recommendations dated 08-Oct-2026 shown as PROPOSED only).
Educational project - always verify with the current bare Act/notifications.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

META = {
    "name": "GSTiQ Knowledge Base",
    "law_as_on": "2026-10-29",
    "version": "3.2.0",
    "gst2_effective": "2025-09-22",
    "disclaimer": (
        "Educational project for ICAI Advanced IT. Rules are simplified for "
        "automation and must be verified against the current CGST/IGST Acts, "
        "Rules, notifications and circulars before use on real returns."
    ),
}

# ---------------------------------------------------------------------------
# 1. State codes (first two digits of GSTIN)
# ---------------------------------------------------------------------------
STATES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
    "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
    "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam",
    "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
    "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra",
    "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala",
    "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
    "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
    "96": "Foreign Country", "97": "Other Territory", "99": "Centre Jurisdiction",
}
SPECIAL_CATEGORY_STATES = ["12", "13", "14", "15", "16", "11", "18", "17", "02", "05"]

PAN_HOLDER_TYPES = {
    "C": "Company", "P": "Individual / Proprietor", "H": "HUF",
    "F": "Firm / LLP", "A": "Association of Persons", "T": "Trust",
    "B": "Body of Individuals", "L": "Local Authority",
    "J": "Artificial Juridical Person", "G": "Government",
}

# Valid GST rates (%) before and after GST 2.0 (22-Sep-2025)
RATES = {
    "pre_gst2": [0, 0.1, 0.25, 1.5, 3, 5, 6, 12, 18, 28],
    "post_gst2": [0, 0.1, 0.25, 1.5, 3, 5, 18, 40],
    "note": ("From 22-09-2025 the slabs were rationalised to 5% (merit) and 18% "
             "(standard) with a 40% special rate; 12% and 28% survive only for "
             "specified tobacco items pending compensation-cess closure."),
}

# ---------------------------------------------------------------------------
# 2. Section 16 – conditions for ITC (used by the eligibility engine)
# ---------------------------------------------------------------------------
ITC_CONDITIONS = [
    {"id": "S16_1", "ref": "Sec 16(1)", "title": "Used in course or furtherance of business",
     "text": "ITC is available only on goods/services used or intended to be used in the course or furtherance of business."},
    {"id": "S16_2a", "ref": "Sec 16(2)(a)", "title": "Possession of tax invoice / debit note",
     "text": "Recipient must hold a tax invoice, debit note or other prescribed document (Rule 36(1))."},
    {"id": "S16_2aa", "ref": "Sec 16(2)(aa) r/w Rule 36(4)", "title": "Invoice reflected in GSTR-2B",
     "text": "Details must be furnished by the supplier in GSTR-1/IFF and communicated to the recipient in GSTR-2B. Under IMS the recipient Accepts / Rejects / keeps Pending each record before GSTR-2B is generated."},
    {"id": "S16_2b", "ref": "Sec 16(2)(b)", "title": "Goods / services received",
     "text": "Goods or services must actually be received (bill-to-ship-to receipt by a third person counts). For lots, ITC on receipt of the last lot."},
    {"id": "S16_2ba", "ref": "Sec 16(2)(ba)", "title": "Not restricted under Section 38",
     "text": "ITC must not be restricted in GSTR-2B (itcavl = 'N', e.g. new registrant / defaulting supplier)."},
    {"id": "S16_2c", "ref": "Sec 16(2)(c) r/w Rule 37A", "title": "Tax actually paid by supplier",
     "text": "Tax charged must be paid to the Government. If the supplier has not filed GSTR-3B by 30 September of the following year, ITC is reversed by 30 November (Rule 37A) and re-availed after the supplier files."},
    {"id": "S16_2d", "ref": "Sec 16(2)(d)", "title": "Recipient has filed return",
     "text": "Recipient must furnish the return under Section 39 (GSTR-3B)."},
    {"id": "S16_2_p2", "ref": "2nd proviso to Sec 16(2) r/w Rule 37", "title": "Payment to supplier within 180 days",
     "text": "If value plus tax is not paid to the supplier within 180 days from invoice date, the ITC is added to output liability (reversed) with interest; it is re-availed when payment is made."},
    {"id": "S16_3", "ref": "Sec 16(3)", "title": "No double benefit with depreciation",
     "text": "If depreciation is claimed on the tax component of capital goods under the Income-tax Act, ITC on that tax is not allowed."},
    {"id": "S16_4", "ref": "Sec 16(4)", "title": "Time limit",
     "text": "ITC for an invoice/debit note cannot be taken after 30 November following the end of the financial year to which it pertains, or the date of filing the annual return, whichever is earlier. For RCM self-invoices the FY of the self-invoice governs (Circular 211/5/2024-GST)."},
    {"id": "S16_5", "ref": "Sec 16(5)", "title": "Relief FY 2017-18 to 2020-21",
     "text": "Inserted retrospectively by Finance (No.2) Act, 2024: ITC for FY 2017-18 to 2020-21 may be taken in any return filed up to 30-11-2021."},
    {"id": "S16_6", "ref": "Sec 16(6)", "title": "Cancelled and revoked registrations",
     "text": "Where registration is cancelled and later revoked, ITC may be taken in a return filed up to 30 November of the next FY / annual return, or within 30 days of the revocation order, subject to conditions."},
]

# ---------------------------------------------------------------------------
# 3. Section 17(5) – blocked credits
# ---------------------------------------------------------------------------
BLOCKED_CREDITS = [
    {"code": "BLK_MOTOR", "ref": "Sec 17(5)(a), (aa), (ab)",
     "title": "Motor vehicles (≤13 seats), vessels, aircraft & their insurance / repair",
     "text": "Motor vehicles for transport of persons with seating capacity of up to 13 (including driver), vessels and aircraft are blocked, together with their general insurance, servicing, repair and maintenance.",
     "exceptions": "Allowed when used for further supply of such vehicles, transport of passengers, or imparting driving training; goods carriers are not blocked.",
     "hsn": ["8703", "8711", "8802", "8901"], "sac": [],
     "keywords": ["car", "sedan", "suv", "motor car", "innova", "fortuner", "scorpio", "city", "vehicle purchase", "car insurance", "car service", "vehicle repair", "two wheeler", "bike"],
     "proposed": None},
    {"code": "BLK_FOOD", "ref": "Sec 17(5)(b)(i)",
     "title": "Food, beverages, outdoor catering, beauty, health, cosmetic surgery, vehicle hire",
     "text": "Food and beverages, outdoor catering, beauty treatment, health services, cosmetic and plastic surgery, leasing/renting/hiring of blocked motor vehicles are blocked.",
     "exceptions": "Allowed where used for making an outward taxable supply of the same category, as part of a taxable composite/mixed supply, or where provision is obligatory for an employer under any law (proviso).",
     "hsn": ["2106", "2202"], "sac": ["9963", "996331", "996334", "999721", "999722", "9993"],
     "keywords": ["lunch", "dinner", "restaurant", "catering", "canteen", "snacks", "tea", "coffee", "hotel food", "party", "beauty", "salon", "spa", "hospital", "medical", "cab hire"],
     "proposed": "57th GST Council (08-10-2026) recommended removing the block on outdoor catering - not yet notified."},
    {"code": "BLK_INS", "ref": "Sec 17(5)(b)(i)",
     "title": "Life insurance and health insurance",
     "text": "Life and health insurance are blocked unless obligatory under law for the employer or used for the same category of outward supply. Individual life/health policies are exempt from 22-09-2025, so the issue now arises mainly on group policies.",
     "exceptions": "Allowed where obligatory for the employer under any law (e.g. ESIC-excluded statutory cover) or for an insurer providing the same service.",
     "hsn": [], "sac": ["997131", "997132", "997133"],
     "keywords": ["group mediclaim", "health insurance", "life insurance", "term insurance", "mediclaim", "group health"],
     "proposed": "57th GST Council (08-10-2026) recommended removing the block on health and life insurance - not yet notified."},
    {"code": "BLK_CLUB", "ref": "Sec 17(5)(b)(ii)",
     "title": "Membership of club, health and fitness centre",
     "text": "Membership of a club, health and fitness centre is blocked.",
     "exceptions": "Allowed only where obligatory for the employer under any law.",
     "hsn": [], "sac": ["999591", "997652"],
     "keywords": ["club membership", "gym", "fitness", "gymkhana", "golf", "yoga membership", "sports club"],
     "proposed": None},
    {"code": "BLK_TRAVEL", "ref": "Sec 17(5)(b)(iii)",
     "title": "Travel benefits to employees on vacation (LTC / home travel)",
     "text": "Travel benefits extended to employees on vacation such as leave or home travel concession are blocked.",
     "exceptions": "Business travel (not vacation) is not covered by this clause.",
     "hsn": [], "sac": ["998552"],
     "keywords": ["ltc", "leave travel", "holiday package", "vacation", "tour package employees", "home travel"],
     "proposed": None},
    {"code": "BLK_CONSTRUCTION", "ref": "Sec 17(5)(c) & (d)",
     "title": "Works contract / goods & services for construction of immovable property",
     "text": "Works contract services and goods/services received for construction (including renovation, repairs to the extent capitalised) of immovable property on own account are blocked, other than 'plant and machinery'. Finance Act, 2025 substituted 'plant or machinery' with 'plant and machinery' in clause (d) retrospectively from 01-07-2017, overriding the Safari Retreats functionality test.",
     "exceptions": "Plant and machinery (apparatus/equipment fixed to earth, excluding land, buildings, civil structures, telecom towers and pipelines outside factory) is allowed; works contractor's input for further works contract supply is allowed.",
     "hsn": ["2523", "7214", "6810", "6907"], "sac": ["9954", "995411", "995414", "995419", "995421"],
     "keywords": ["construction", "civil work", "building", "cement", "tmt bars", "steel bars", "factory shed", "office renovation", "works contract", "flooring", "plaster", "boundary wall", "interior fit out"],
     "proposed": "57th GST Council (08-10-2026) recommended removing the block on telecommunication towers and pipelines outside factory premises - not yet notified."},
    {"code": "BLK_COMPOSITION", "ref": "Sec 17(5)(e)",
     "title": "Goods/services on which composition tax paid",
     "text": "Tax paid under Section 10 is not available as ITC.",
     "exceptions": "None.", "hsn": [], "sac": [], "keywords": ["composition", "bill of supply"], "proposed": None},
    {"code": "BLK_CSR", "ref": "Sec 17(5)(fa)",
     "title": "Goods/services used for CSR obligations",
     "text": "Inward supplies used for Corporate Social Responsibility under Section 135 of the Companies Act, 2013 are blocked (w.e.f. 01-10-2023).",
     "exceptions": "None.", "hsn": [], "sac": [],
     "keywords": ["csr", "corporate social responsibility", "donation drive", "school kits csr", "tree plantation csr", "csr activity"],
     "proposed": None},
    {"code": "BLK_PERSONAL", "ref": "Sec 17(5)(g)",
     "title": "Personal consumption",
     "text": "Goods or services used for personal consumption are blocked.",
     "exceptions": "None.", "hsn": [], "sac": [],
     "keywords": ["personal", "director residence", "household", "family", "personal mobile", "home appliance", "residence furniture"],
     "proposed": None},
    {"code": "BLK_GIFT", "ref": "Sec 17(5)(h)",
     "title": "Goods lost, stolen, destroyed, written off, gifts and free samples",
     "text": "Goods lost, stolen, destroyed, written off or disposed of by way of gift or free samples are blocked; ITC already taken is reversed.",
     "exceptions": "Gifts up to ₹50,000 per employee per year are not a supply, but ITC on such gifts is still blocked.",
     "hsn": [], "sac": [],
     "keywords": ["diwali gift", "gift", "free sample", "festival gift", "sweet boxes", "dry fruits gift", "stolen", "destroyed", "written off", "expired stock"],
     "proposed": "57th GST Council (08-10-2026) recommended removing the block on free samples and goods destroyed on expiry of shelf life as required by law - not yet notified."},
    {"code": "BLK_74", "ref": "Sec 17(5)(i)",
     "title": "Tax paid under Sec 74 (up to FY 2023-24), 129, 130",
     "text": "Tax paid on demands in fraud cases and on detention/confiscation is not available as ITC.",
     "exceptions": "None.", "hsn": [], "sac": [], "keywords": ["penalty", "detention", "confiscation", "drc-03 section 74"], "proposed": None},
]

# ---------------------------------------------------------------------------
# 4. Reverse charge catalogue (Sec 9(3)/9(4) CGST, 5(3)/5(4) IGST)
#    Each question: options with value; rcm_values = answers that keep RCM alive.
# ---------------------------------------------------------------------------
YES_NO = [{"v": "yes", "label": "Yes"}, {"v": "no", "label": "No"}]

RCM_CATALOG = [
    {"id": "RCM_GTA", "kind": "service", "entry": "Sl. 1", "notification": "13/2017-CT(R) / 10/2017-IT(R)",
     "title": "Goods Transport Agency (GTA) services", "sac": "9965", "rate": 5,
     "supplier": "Goods Transport Agency not opting for forward charge",
     "recipient": "Factory, society, co-operative, registered person, body corporate, partnership firm/AOP, casual taxable person",
     "itc_recipient": True,
     "notes": "GTA may opt for forward charge at 18% with ITC (12% before 22-09-2025) by filing Annexure V. Under RCM the recipient pays 5% and can take ITC of the tax paid.",
     "keywords": ["freight", "transport", "lorry", "truck", "gta", "consignment note", "cartage", "bilty", "goods transport"],
     "questions": [
         {"id": "fcm", "text": "Has the GTA opted to pay GST under forward charge (invoice shows 18% GST)?", "options": YES_NO, "rcm_values": ["no"],
          "fail": "Forward charge applies - the GTA charges 18% GST in its invoice; claim normal ITC."},
         {"id": "rec", "text": "Who is the recipient (person paying freight)?",
          "options": [{"v": "registered", "label": "Registered person / body corporate / firm / factory / society"}, {"v": "other", "label": "Unregistered individual end-consumer"}],
          "rcm_values": ["registered"], "fail": "GTA services to an unregistered individual are exempt - no tax."},
     ]},
    {"id": "RCM_LEGAL", "kind": "service", "entry": "Sl. 2", "notification": "13/2017-CT(R) / 10/2017-IT(R)",
     "title": "Legal services by advocate / firm of advocates", "sac": "9982", "rate": 18,
     "supplier": "Individual advocate, senior advocate or firm of advocates",
     "recipient": "Business entity located in the taxable territory", "itc_recipient": True,
     "notes": "Legal services to a business entity whose aggregate turnover in the preceding FY is up to the registration threshold (₹20 lakh; ₹10 lakh special category) are exempt (Notfn 12/2017-CT(R) Sl. 45).",
     "keywords": ["advocate", "legal fees", "lawyer", "legal opinion", "court fees advocate", "litigation", "senior counsel", "law firm"],
     "questions": [
         {"id": "sup", "text": "Is the supplier an advocate / senior advocate / firm of advocates?", "options": YES_NO, "rcm_values": ["yes"],
          "fail": "Professional services by a non-advocate (CA, consultant) are under forward charge."},
         {"id": "biz", "text": "Is the recipient a business entity in the taxable territory?", "options": YES_NO, "rcm_values": ["yes"],
          "fail": "Legal services to a non-business recipient (individual in personal capacity) are exempt."},
         {"id": "turn", "text": "Did the recipient's aggregate turnover in the preceding FY exceed the threshold (₹20 lakh / ₹10 lakh)?", "options": YES_NO, "rcm_values": ["yes"],
          "fail": "Exempt under Notification 12/2017-CT(R) Sl. 45 - business entity below threshold."},
     ]},
    {"id": "RCM_ARBITRAL", "kind": "service", "entry": "Sl. 3", "notification": "13/2017-CT(R)",
     "title": "Arbitral tribunal services", "sac": "998215", "rate": 18,
     "supplier": "Arbitral tribunal", "recipient": "Business entity", "itc_recipient": True,
     "notes": "Same turnover-based exemption as legal services applies.",
     "keywords": ["arbitral", "arbitration", "arbitrator fees", "tribunal"],
     "questions": [{"id": "biz", "text": "Is the recipient a business entity with preceding-FY turnover above threshold?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Exempt."}]},
    {"id": "RCM_SPONSOR", "kind": "service", "entry": "Sl. 4", "notification": "13/2017-CT(R)",
     "title": "Sponsorship services", "sac": "998397", "rate": 18,
     "supplier": "Any person", "recipient": "Body corporate or partnership firm", "itc_recipient": True,
     "notes": "Sponsorship of events, sports, seminars.",
     "keywords": ["sponsorship", "event sponsor", "title sponsor", "sponsoring", "branding at event"],
     "questions": [{"id": "rec", "text": "Is the recipient a body corporate or partnership firm?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Forward charge - supplier charges GST."}]},
    {"id": "RCM_GOVT", "kind": "service", "entry": "Sl. 5", "notification": "13/2017-CT(R)",
     "title": "Services by Government / local authority to business entity", "sac": "9991", "rate": 18,
     "supplier": "Central/State Government, UT or local authority", "recipient": "Business entity", "itc_recipient": True,
     "notes": "Excludes renting of immovable property (see 5A), postal services, transport of goods/passengers and airport services. Many government services are separately exempt.",
     "keywords": ["government fees", "municipal", "local authority", "licence fee", "permission fee", "nagar palika"],
     "questions": [{"id": "biz", "text": "Is the recipient a business entity and the service not separately exempt?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Not taxable / exempt."}]},
    {"id": "RCM_RENT_GOVT", "kind": "service", "entry": "Sl. 5A", "notification": "13/2017-CT(R)",
     "title": "Renting of immovable property by Government to registered person", "sac": "997212", "rate": 18,
     "supplier": "Government / local authority", "recipient": "Registered person", "itc_recipient": True, "notes": "",
     "keywords": ["gidc rent", "government lease rent", "municipal shop rent", "port trust rent"],
     "questions": [{"id": "reg", "text": "Is the tenant registered under GST?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Forward charge by the Government for unregistered tenants."}]},
    {"id": "RCM_RENT_RESI", "kind": "service", "entry": "Sl. 5AA", "notification": "05/2022-CT(R)",
     "title": "Renting of residential dwelling to registered person", "sac": "997211", "rate": 18,
     "supplier": "Any person", "recipient": "Registered person", "itc_recipient": True,
     "notes": "Effective 18-07-2022. Exempt where a registered proprietor rents it for own residence in personal capacity (w.e.f. 01-01-2023).",
     "keywords": ["residential flat rent", "guest house rent", "staff quarters rent", "director residence rent", "house rent"],
     "questions": [
         {"id": "reg", "text": "Is the tenant registered under GST?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Exempt when let to an unregistered person for residence."},
         {"id": "own", "text": "Is the tenant a proprietor renting it for own residence in personal capacity?", "options": YES_NO, "rcm_values": ["no"], "fail": "Exempt (Notfn 15/2022-CT(R))."},
     ]},
    {"id": "RCM_RENT_COMM", "kind": "service", "entry": "Sl. 5AB", "notification": "09/2024-CT(R) as amended by 07/2025-CT(R)",
     "title": "Renting of property other than residential dwelling by unregistered person", "sac": "997212", "rate": 18,
     "supplier": "Unregistered person", "recipient": "Registered person other than composition taxpayer", "itc_recipient": True,
     "notes": "Effective 10-10-2024. Composition taxpayers excluded from 16-01-2025 (Notfn 07/2025-CT(R)).",
     "keywords": ["shop rent", "office rent", "godown rent", "warehouse rent", "commercial rent", "factory rent", "land lease"],
     "questions": [
         {"id": "sup", "text": "Is the landlord unregistered under GST?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Registered landlord charges 18% under forward charge."},
         {"id": "reg", "text": "Is the tenant registered under GST?", "options": YES_NO, "rcm_values": ["yes"], "fail": "No GST - both unregistered."},
         {"id": "comp", "text": "Has the tenant opted for the composition scheme?", "options": YES_NO, "rcm_values": ["no"], "fail": "Composition taxpayers are excluded from 5AB (Notfn 07/2025-CT(R))."},
     ]},
    {"id": "RCM_DIRECTOR", "kind": "service", "entry": "Sl. 6", "notification": "13/2017-CT(R)",
     "title": "Services by a director to the company / body corporate", "sac": "998399", "rate": 18,
     "supplier": "Director (not as employee)", "recipient": "Company / body corporate", "itc_recipient": True,
     "notes": "Remuneration booked as salary with TDS under the Income-tax Act is not a supply (Circular 140/10/2020-GST). Sitting fees and commission are under RCM.",
     "keywords": ["sitting fees", "director commission", "director fees", "independent director", "board meeting fee"],
     "questions": [
         {"id": "sal", "text": "Is the payment salary to a whole-time director as employee (TDS u/s 192)?", "options": YES_NO, "rcm_values": ["no"], "fail": "Salary in employment is outside GST (Schedule III)."},
         {"id": "rec", "text": "Is the recipient a company / body corporate?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Not covered."},
     ]},
    {"id": "RCM_INS_AGENT", "kind": "service", "entry": "Sl. 7", "notification": "13/2017-CT(R)",
     "title": "Insurance agent services to insurance company", "sac": "997161", "rate": 18,
     "supplier": "Insurance agent", "recipient": "Person carrying on insurance business", "itc_recipient": True, "notes": "",
     "keywords": ["insurance agent commission", "agency commission insurance"],
     "questions": [{"id": "rec", "text": "Is the recipient an insurance company?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Not covered."}]},
    {"id": "RCM_RECOVERY", "kind": "service", "entry": "Sl. 8", "notification": "13/2017-CT(R)",
     "title": "Recovery agent services", "sac": "998599", "rate": 18,
     "supplier": "Recovery agent", "recipient": "Banking company / financial institution / NBFC", "itc_recipient": True, "notes": "",
     "keywords": ["recovery agent", "collection agent", "loan recovery"],
     "questions": [{"id": "rec", "text": "Is the recipient a bank / FI / NBFC?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Not covered."}]},
    {"id": "RCM_COPYRIGHT", "kind": "service", "entry": "Sl. 9", "notification": "13/2017-CT(R)",
     "title": "Copyright transfer by author, composer, photographer, artist", "sac": "997331", "rate": 18,
     "supplier": "Author / music composer / photographer / artist", "recipient": "Publisher / music company / producer", "itc_recipient": True,
     "notes": "An author may opt for forward charge after registering and filing the declaration.",
     "keywords": ["royalty author", "copyright", "music composer", "photograph rights", "book royalty"],
     "questions": [{"id": "fcm", "text": "Has the author opted to pay under forward charge?", "options": YES_NO, "rcm_values": ["no"], "fail": "Forward charge by author."}]},
    {"id": "RCM_DSA", "kind": "service", "entry": "Sl. 12-14", "notification": "13/2017-CT(R)",
     "title": "DSA / business facilitator / BC agent services to bank or NBFC", "sac": "998599", "rate": 18,
     "supplier": "DSA (other than body corporate), business facilitator, agent of business correspondent", "recipient": "Banking company / NBFC", "itc_recipient": True, "notes": "",
     "keywords": ["dsa commission", "direct selling agent", "business correspondent", "business facilitator"],
     "questions": [{"id": "sup", "text": "Is the agent a non-body-corporate (individual / firm)?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Forward charge."}]},
    {"id": "RCM_SECURITY", "kind": "service", "entry": "Sl. 14 (Security)", "notification": "29/2018-CT(R)",
     "title": "Security services (supply of security personnel)", "sac": "998525", "rate": 18,
     "supplier": "Any person other than a body corporate", "recipient": "Registered person (other than composition / TDS-only registrants)", "itc_recipient": True,
     "notes": "Effective 01-01-2019.",
     "keywords": ["security guard", "watchman", "security agency", "manpower security", "bouncer", "guarding"],
     "questions": [
         {"id": "sup", "text": "Is the security agency a body corporate (company / LLP)?", "options": YES_NO, "rcm_values": ["no"], "fail": "Body corporate supplier charges GST under forward charge."},
         {"id": "reg", "text": "Is the recipient a regular registered person (not composition / TDS-only)?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Forward charge applies."},
     ]},
    {"id": "RCM_MOTOR_RENT", "kind": "service", "entry": "Sl. 15", "notification": "22/2019-CT(R)",
     "title": "Renting of passenger motor vehicle (fuel included)", "sac": "996601", "rate": 5,
     "supplier": "Person other than body corporate, not charging 18% with ITC", "recipient": "Body corporate", "itc_recipient": True,
     "notes": "Recipient's ITC is still subject to Sec 17(5)(b) - hiring of blocked motor vehicles is blocked unless used for specified purposes.",
     "keywords": ["taxi hire", "cab rent", "vehicle on hire", "car rental monthly", "travels hire"],
     "questions": [
         {"id": "sup", "text": "Is the supplier a non-body-corporate charging 5% (not 18% with ITC)?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Forward charge."},
         {"id": "rec", "text": "Is the recipient a body corporate?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Forward charge / not covered."},
     ]},
    {"id": "RCM_IMPORT_SERVICE", "kind": "service", "entry": "Sl. 1 IGST", "notification": "10/2017-IT(R), Sec 5(3) IGST Act",
     "title": "Import of services (supplier in non-taxable territory)", "sac": "99", "rate": 18,
     "supplier": "Person located in non-taxable territory", "recipient": "Person in taxable territory other than non-taxable online recipient", "itc_recipient": True,
     "notes": "IGST payable in cash. Time of supply: earlier of payment or 60 days from invoice; for associated enterprises, earlier of entry in books or payment.",
     "keywords": ["aws", "google ads", "facebook ads", "linkedin", "foreign consultant", "import of service", "usd invoice", "software subscription foreign", "adobe", "microsoft ireland", "overseas"],
     "questions": [
         {"id": "loc", "text": "Is the supplier located outside India?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Domestic supply - forward charge."},
         {"id": "biz", "text": "Is the service received for business (recipient not a non-taxable online recipient)?", "options": YES_NO, "rcm_values": ["yes"], "fail": "OIDAR to non-taxable online recipient - foreign supplier pays."},
     ]},
    {"id": "RCM_METAL_SCRAP", "kind": "goods", "entry": "Sl. 8 (goods)", "notification": "06/2024-CT(R)",
     "title": "Metal scrap (Chapters 72-81) from unregistered person", "hsn": "7204", "rate": 18,
     "supplier": "Unregistered person", "recipient": "Registered person", "itc_recipient": True,
     "notes": "Effective 10-10-2024. Purchases from registered suppliers instead attract 2% GST TDS under Sec 51 (Notfn 25/2024-CT) where the contract value exceeds ₹2.5 lakh.",
     "keywords": ["scrap", "iron scrap", "ms scrap", "copper scrap", "aluminium scrap", "kabadi", "melting scrap", "steel scrap"],
     "questions": [
         {"id": "sup", "text": "Is the scrap supplier unregistered?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Registered supplier charges GST; deduct 2% GST-TDS if the contract exceeds ₹2.5 lakh."},
         {"id": "reg", "text": "Is the buyer registered under GST?", "options": YES_NO, "rcm_values": ["yes"], "fail": "No GST."},
     ]},
    {"id": "RCM_AGRI", "kind": "goods", "entry": "Sl. 1, 3, 4A (goods)", "notification": "04/2017-CT(R)",
     "title": "Cashew nuts (not shelled), tobacco leaves, raw cotton from agriculturist", "hsn": "0801/2401/5201", "rate": 5,
     "supplier": "Agriculturist", "recipient": "Any registered person", "itc_recipient": True,
     "notes": "Tobacco leaves remained outside the 22-09-2025 rate change pending compensation-cess closure - verify current rate.",
     "keywords": ["raw cotton", "kapas", "cashew raw", "tobacco leaves", "agriculturist"],
     "questions": [{"id": "sup", "text": "Is the supplier an agriculturist and the buyer registered?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Forward charge / not covered."}]},
    {"id": "RCM_BIDI_LEAVES", "kind": "goods", "entry": "Sl. 2 (goods)", "notification": "04/2017-CT(R)",
     "title": "Bidi wrapper (tendu) leaves from agriculturist", "hsn": "14049010", "rate": 18,
     "supplier": "Agriculturist", "recipient": "Any registered person", "itc_recipient": True, "notes": "",
     "keywords": ["tendu leaves", "bidi wrapper"],
     "questions": [{"id": "sup", "text": "Is the supplier an agriculturist?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Not covered."}]},
    {"id": "RCM_SILK", "kind": "goods", "entry": "Sl. 4 (goods)", "notification": "04/2017-CT(R)",
     "title": "Silk yarn by manufacturer from raw silk / cocoons", "hsn": "5004-5006", "rate": 5,
     "supplier": "Person manufacturing silk yarn from raw silk or silk worm cocoons", "recipient": "Any registered person", "itc_recipient": True, "notes": "",
     "keywords": ["silk yarn"],
     "questions": [{"id": "sup", "text": "Is the supplier a silk yarn manufacturer and buyer registered?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Not covered."}]},
    {"id": "RCM_LOTTERY", "kind": "goods", "entry": "Sl. 5 (goods)", "notification": "04/2017-CT(R)",
     "title": "Supply of lottery by State Govt / UT / local authority", "hsn": "-", "rate": 40,
     "supplier": "State Government, UT or local authority", "recipient": "Lottery distributor or selling agent", "itc_recipient": True,
     "notes": "Rate 40% from 22-09-2025 (28% earlier).", "keywords": ["lottery"],
     "questions": [{"id": "rec", "text": "Is the recipient a lottery distributor / selling agent?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Not covered."}]},
    {"id": "RCM_GOVT_GOODS", "kind": "goods", "entry": "Sl. 6 (goods)", "notification": "04/2017-CT(R)",
     "title": "Used vehicles, seized/confiscated goods, old goods, waste & scrap sold by Government", "hsn": "Any", "rate": 18,
     "supplier": "Central/State Government, UT, local authority", "recipient": "Any registered person", "itc_recipient": True, "notes": "",
     "keywords": ["auction government", "seized goods auction", "condemned vehicle"],
     "questions": [{"id": "reg", "text": "Is the buyer registered under GST?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Not covered."}]},
    {"id": "RCM_PROMOTER", "kind": "9(4)", "entry": "Sec 9(4)", "notification": "07/2019-CT(R)",
     "title": "Promoter (real estate) - shortfall of purchases from registered suppliers", "hsn": "Any", "rate": 18,
     "supplier": "Unregistered supplier", "recipient": "Promoter of residential/commercial real estate project",
     "itc_recipient": False,
     "notes": "If less than 80% of inputs/input services (by value) are bought from registered persons, RCM at 18% on the shortfall; cement and capital goods from unregistered persons attract RCM at the applicable rate (cement 18% from 22-09-2025). Promoters paying 1%/5% concessional rates cannot take ITC.",
     "keywords": ["promoter", "real estate project", "cement unregistered", "builder shortfall"],
     "questions": [
         {"id": "pro", "text": "Is the recipient a promoter paying concessional real-estate rates?", "options": YES_NO, "rcm_values": ["yes"], "fail": "Not covered by Sec 9(4) notification."},
         {"id": "short", "text": "Are purchases from registered suppliers below 80% / is it cement or capital goods from an unregistered person?", "options": YES_NO, "rcm_values": ["yes"], "fail": "No RCM - 80% threshold met."},
     ]},
]

RCM_COMPLIANCE = [
    {"ref": "Sec 31(3)(f) r/w Rule 47A", "title": "Self-invoice",
     "text": "Where the supplier is unregistered, the recipient issues a self-invoice within 30 days of receipt of goods/services (Rule 47A, w.e.f. 01-11-2024)."},
    {"ref": "Sec 31(3)(g)", "title": "Payment voucher", "text": "Recipient issues a payment voucher at the time of making payment to the supplier."},
    {"ref": "Sec 49(4)", "title": "Cash payment only",
     "text": "RCM tax cannot be paid using the electronic credit ledger; it must be paid through the electronic cash ledger. ITC of the RCM paid can then be claimed in the same return."},
    {"ref": "Sec 12(3)", "title": "Time of supply - goods",
     "text": "Earliest of (a) date of receipt of goods, (b) date of payment (entry in books or debit in bank, whichever earlier), (c) the 31st day from the supplier's invoice date. If none can be determined, date of entry in recipient's books."},
    {"ref": "Sec 13(3)", "title": "Time of supply - services",
     "text": "Earlier of (a) date of payment, (b) the 61st day from the supplier's invoice date. For import of services from an associated enterprise: earlier of entry in books or payment."},
    {"ref": "GSTR-3B", "title": "Reporting",
     "text": "RCM liability in Table 3.1(d); ITC of RCM paid in Table 4A(3) (domestic) or 4A(2) (import of services)."},
    {"ref": "Circular 211/5/2024-GST", "title": "Time limit for ITC on RCM",
     "text": "Where the supplier is unregistered, the Sec 16(4) time limit is reckoned from the FY in which the recipient issued the self-invoice. Interest is payable for delayed RCM payment."},
]

# ---------------------------------------------------------------------------
# 5. GSTR-3B Table 4 mapping (Circular 170/02/2022-GST)
# ---------------------------------------------------------------------------
GSTR3B_TABLES = {
    "3.1(d)": "Inward supplies liable to reverse charge",
    "4A(1)": "Import of goods",
    "4A(2)": "Import of services",
    "4A(3)": "Inward supplies liable to reverse charge (other than 1 & 2)",
    "4A(4)": "Inward supplies from ISD",
    "4A(5)": "All other ITC",
    "4B(1)": "ITC reversed - Rules 38, 42 & 43 and Sec 17(5) (permanent)",
    "4B(2)": "ITC reversed - Others (Rule 37, 37A, non-receipt etc.; reclaimable)",
    "4C": "Net ITC available (A - B)",
    "4D(1)": "ITC reclaimed which was reversed under 4B(2) earlier",
    "4D(2)": "Ineligible ITC u/s 16(4) and ITC restricted due to PoS rules",
}

# ---------------------------------------------------------------------------
# 6. Statutory dates & thresholds
# ---------------------------------------------------------------------------
DATES = {
    "gstr1_monthly_day": 11, "iff_day": 13, "gstr2b_day": 14, "gstr3b_monthly_day": 20,
    "sec16_4": "30 November of the year following the FY of invoice (or annual return date if earlier)",
    "rule37a": "Supplier must file GSTR-3B by 30 September of next FY; else recipient reverses by 30 November",
    "rule37_days": 180, "self_invoice_days": 30,
    "drc01c_amount": 2500000, "drc01c_percent": 20,
    "rule86b_turnover": 5000000,
    "interest_late_payment": 18, "interest_wrong_itc": 18,
    "eway_threshold": 50000, "metal_scrap_tds_threshold": 250000,
}

# ---------------------------------------------------------------------------
# 7. Case laws & circulars (for knowledge hub)
# ---------------------------------------------------------------------------
CASE_LAWS = [
    {"name": "Chief Commissioner of CGST v. Safari Retreats Pvt. Ltd.", "court": "Supreme Court", "year": 2024, "topic": "Sec 17(5)(d)",
     "held": "Upheld validity of Sec 17(5)(c) and (d) but held that 'plant or machinery' in clause (d) is wider than the defined 'plant and machinery'; whether a building is a 'plant' depends on a functionality test.",
     "status": "Legislatively overridden: Finance Act, 2025 substituted 'plant and machinery' in clause (d) retrospectively from 01-07-2017; review petition dismissed in 2025."},
    {"name": "Union of India v. Mohit Minerals Pvt. Ltd.", "court": "Supreme Court", "year": 2022, "topic": "RCM on ocean freight",
     "held": "IGST under reverse charge on ocean freight for CIF imports is invalid, as the importer already pays IGST on the composite supply of goods including freight.",
     "status": "The RCM entry for ocean freight was omitted from 01-10-2023."},
    {"name": "Union of India v. Bharti Airtel Ltd.", "court": "Supreme Court", "year": 2021, "topic": "Self-assessment of ITC",
     "held": "ITC is self-assessed from the taxpayer's own records; the auto-populated form is only a facilitator. Unilateral rectification of GSTR-3B outside the statutory scheme is not permitted.",
     "status": "Good law."},
    {"name": "Suncraft Energy Pvt. Ltd. v. Assistant Commissioner, State Tax", "court": "Calcutta High Court", "year": 2023, "topic": "Sec 16(2)(c), GSTR-2A mismatch",
     "held": "ITC cannot be reversed from a bona fide recipient merely because of mismatch with GSTR-2A without first proceeding against the defaulting supplier.",
     "status": "SLP filed by the department was dismissed by the Supreme Court (Dec 2023)."},
    {"name": "Arise India Ltd. v. Commissioner of Trade & Taxes, Delhi", "court": "Delhi High Court (affirmed by SC)", "year": 2017, "topic": "Bona fide purchaser (DVAT)",
     "held": "A purchasing dealer who acted bona fide cannot be denied credit for the selling dealer's default when there is no mechanism to verify payment.",
     "status": "VAT-era ruling relied upon for interpretation of Sec 16(2)(c)."},
    {"name": "State of Karnataka v. Ecom Gill Coffee Trading Pvt. Ltd.", "court": "Supreme Court", "year": 2023, "topic": "Burden of proof for ITC",
     "held": "The burden of proving the genuineness of the transaction and actual movement of goods lies on the dealer claiming ITC; invoices and payment by cheque alone are not sufficient.",
     "status": "Karnataka VAT ruling, applied widely to GST ITC disputes."},
    {"name": "Gobinda Construction v. Union of India", "court": "Patna High Court", "year": 2023, "topic": "Sec 16(4)",
     "held": "Time limit under Sec 16(4) is a valid condition; ITC is a concession and statutory conditions must be satisfied.",
     "status": "Followed by other High Courts; Sec 16(5) later gave limited relief for FY 2017-18 to 2020-21."},
    {"name": "Circular 170/02/2022-GST", "court": "CBIC", "year": 2022, "topic": "GSTR-3B Table 4 reporting",
     "held": "Ineligible ITC under Sec 17(5) and reversals under Rules 38/42/43 go in Table 4B(1); other (reclaimable) reversals in 4B(2); 16(4) and PoS-restricted ITC in 4D(2).",
     "status": "Reporting standard used by the GSTR-3B builder in this project."},
    {"name": "Circular 211/5/2024-GST", "court": "CBIC", "year": 2024, "topic": "Time limit for RCM ITC",
     "held": "For RCM supplies from unregistered persons, the Sec 16(4) time limit is computed with reference to the FY in which the recipient issues the self-invoice.",
     "status": "In force."},
    {"name": "Circular 140/10/2020-GST", "court": "CBIC", "year": 2020, "topic": "Director remuneration",
     "held": "Remuneration to directors declared as salary in the books and subjected to TDS u/s 192 is not liable to GST; other payments to directors attract RCM.",
     "status": "In force."},
    {"name": "57th GST Council Meeting (08-10-2026)", "court": "GST Council", "year": 2026, "topic": "Proposed ITC reforms",
     "held": "Recommended removing Sec 17(5) blocks on outdoor catering, health & life insurance, telecom towers, pipelines outside factory, free samples and goods destroyed on expiry; refund of input-service ITC under inverted duty from 01-11-2026; capital-goods refund over 60 months from 01-04-2027; Rule 86A hearing; IMS and 'Electronic Credit Reversal and Reclaim Statement' rules; alternate correction mechanism from April 2027 return.",
     "status": "PROPOSED - not effective until notified. The engine continues to apply current law and only flags these items."},
]

# ---------------------------------------------------------------------------
# 8. Chatbot knowledge (GST Mitra)
# ---------------------------------------------------------------------------
CHATBOT_KB = [
    {"q": "What is input tax credit (ITC)?", "a": "Input tax credit is the GST paid on purchases (inputs, input services, capital goods) that a registered person can set off against output tax, defined in Sec 2(63) and governed by Sections 16 to 21 of the CGST Act. It removes the cascading effect of tax."},
    {"q": "What are the conditions to claim ITC under section 16?", "a": "Under Sec 16(2): (a) possession of tax invoice/debit note, (aa) invoice reflected in GSTR-2B, (b) goods/services received, (ba) ITC not restricted in GSTR-2B, (c) supplier has actually paid the tax, (d) recipient has filed GSTR-3B. Additionally, pay the supplier within 180 days (Rule 37) and claim within the Sec 16(4) time limit."},
    {"q": "What is the time limit to claim ITC under section 16(4)?", "a": "ITC for an invoice must be taken by 30 November following the end of the financial year of the invoice, or the date of filing the annual return (GSTR-9), whichever is earlier. For FY 2025-26 invoices the last date is 30-11-2026."},
    {"q": "What is reverse charge mechanism (RCM)?", "a": "Under RCM [Sec 2(98)], the recipient instead of the supplier pays GST. It applies to notified supplies under Sec 9(3)/5(3) (e.g. GTA, advocate, security, director, import of services, commercial rent from unregistered landlord, metal scrap) and Sec 9(4) for promoters. RCM must be paid in cash and ITC can be taken in the same month."},
    {"q": "Can RCM be paid through ITC / electronic credit ledger?", "a": "No. Sec 49(4) allows the electronic credit ledger only for output tax. RCM liability must be paid from the electronic cash ledger. After payment, ITC of the RCM paid is available (subject to Sec 17(5))."},
    {"q": "Is GTA under RCM?", "a": "Yes, unless the GTA opts for forward charge. Under RCM the recipient (factory, registered person, body corporate, firm, society etc.) pays 5% and can take ITC. A GTA may instead opt for 18% forward charge with ITC (12% before 22-09-2025)."},
    {"q": "Is RCM applicable on rent paid to unregistered landlord?", "a": "For commercial property: yes, from 10-10-2024 (Entry 5AB, Notfn 09/2024-CT(R)) a registered tenant pays 18% RCM, but composition taxpayers are excluded from 16-01-2025 (Notfn 07/2025-CT(R)). For a residential dwelling rented to a registered person, RCM applies irrespective of the landlord's registration (Entry 5AA)."},
    {"q": "Is RCM applicable on legal fees paid to advocate?", "a": "Yes. Legal services by an advocate or firm of advocates to a business entity are under RCM at 18%. They are exempt if the business entity's turnover in the preceding FY was up to ₹20 lakh (₹10 lakh in special category states)."},
    {"q": "Is RCM applicable on security services?", "a": "Yes, when the security agency is not a body corporate and the recipient is a regular registered person. A company/LLP security agency charges GST under forward charge."},
    {"q": "Is RCM applicable on director sitting fees?", "a": "Yes. Services by a director (not as employee) to the company are under RCM at 18%. Salary to a whole-time director with TDS u/s 192 is outside GST (Circular 140/10/2020)."},
    {"q": "What is the time of supply under RCM for services?", "a": "Sec 13(3): earlier of the date of payment or the 61st day after the supplier's invoice. For import of services from an associated enterprise, the earlier of entry in books or payment."},
    {"q": "What is the time of supply under RCM for goods?", "a": "Sec 12(3): earliest of receipt of goods, date of payment, or the 31st day after the supplier's invoice."},
    {"q": "What is a self invoice?", "a": "When goods/services are received from an unregistered supplier under RCM, the recipient issues a self-invoice under Sec 31(3)(f) within 30 days of receipt (Rule 47A), and a payment voucher under Sec 31(3)(g) when paying."},
    {"q": "What are blocked credits under section 17(5)?", "a": "Main blocks: motor vehicles ≤13 seats and their insurance/repair; food, beverages, outdoor catering, beauty, health services, life/health insurance; club and fitness membership; employee vacation travel; works contract and goods/services for construction of immovable property (other than plant and machinery); composition tax; CSR expenditure; personal consumption; goods lost, stolen, destroyed, gifted or given as free samples; tax paid under Sec 74/129/130."},
    {"q": "Is ITC available on car purchase?", "a": "No, ITC on motor vehicles with seating up to 13 persons is blocked under Sec 17(5)(a) unless used for further supply of vehicles, passenger transport or driving training. Goods vehicles are eligible."},
    {"q": "Is ITC available on food and canteen expenses?", "a": "Generally blocked under Sec 17(5)(b)(i). It is allowed where the employer is obliged by law (e.g. Factories Act canteen) or the supply is used for an outward supply of the same category. The 57th GST Council has proposed removing the block on outdoor catering, but it is not notified yet."},
    {"q": "Is ITC available on construction of factory building?", "a": "No. Goods and services for construction of immovable property on own account are blocked under Sec 17(5)(d), except plant and machinery. The Finance Act, 2025 retrospectively replaced 'plant or machinery' with 'plant and machinery', so buildings cannot qualify as 'plant'."},
    {"q": "Is ITC available on Diwali gifts to employees?", "a": "No. Goods disposed of by way of gift are blocked under Sec 17(5)(h). Gifts up to ₹50,000 per employee per year are not a supply, but the ITC on them is still not available."},
    {"q": "What is Rule 37 - 180 days payment rule?", "a": "If the recipient does not pay the supplier (value + tax) within 180 days of the invoice date, the ITC must be reversed in the return for the period immediately following the 180 days, with interest u/s 50. ITC can be re-availed when payment is made."},
    {"q": "What is Rule 37A?", "a": "If a supplier has furnished the invoice in GSTR-1 but not filed GSTR-3B for that period by 30 September of the following year, the recipient must reverse the ITC by 30 November. It is re-availed after the supplier files GSTR-3B."},
    {"q": "What is Rule 42?", "a": "Rule 42 apportions common ITC on inputs and input services used for taxable and exempt/non-business purposes: D1 = (exempt turnover / total turnover) x common credit (C2) is reversed for exempt use, and D2 = 5% of C2 for non-business use. Computed monthly with an annual true-up by the September return of the next year."},
    {"q": "What is Rule 43?", "a": "Rule 43 apportions ITC on common capital goods over a useful life of 5 years (60 months): monthly credit Tm = common ITC / 60, and the exempt share Te = (E/F) x Tm is reversed every month."},
    {"q": "What is GSTR-2B?", "a": "GSTR-2B is the auto-drafted static ITC statement for each month, generated on the 14th of the following month from suppliers' GSTR-1/IFF/1A and IMS actions. Under Rule 36(4) only ITC reflected in GSTR-2B can be claimed."},
    {"q": "What is IMS - Invoice Management System?", "a": "IMS lets the recipient Accept, Reject or keep Pending each inward invoice/debit/credit note uploaded by suppliers before GSTR-2B is generated. Accepted and no-action records flow into GSTR-2B; rejected ones do not; pending ones roll forward. GSTR-2B can be recomputed after changing actions, before filing GSTR-3B."},
    {"q": "What is the difference between GSTR-2A and GSTR-2B?", "a": "GSTR-2A is dynamic and keeps changing as suppliers file; GSTR-2B is a static monthly statement fixed on the 14th (subject to IMS recompute). ITC claims are based on GSTR-2B."},
    {"q": "What is DRC-01C?", "a": "Under Rule 88D, if ITC claimed in GSTR-3B exceeds ITC available in GSTR-2B beyond the notified limit (₹25 lakh and 20%), the taxpayer receives an intimation in DRC-01C and must either pay the excess through DRC-03 or explain the difference in Part B."},
    {"q": "What is the order of utilisation of ITC?", "a": "Sec 49, 49A, 49B and Rule 88A: IGST credit is used first against IGST, then against CGST and SGST in any order/proportion. CGST credit is used against CGST then IGST; SGST against SGST then IGST. CGST can never pay SGST and vice versa. IGST credit must be fully used before CGST/SGST credit."},
    {"q": "What interest is payable on wrong ITC?", "a": "Sec 50(3): interest at 18% p.a. on ITC wrongly availed AND utilised, from the date of utilisation (Rule 88B). Interest on delayed payment of tax u/s 50(1) is also 18% on the net cash liability."},
    {"q": "What is Rule 86B?", "a": "Where the taxable value of supplies in a month exceeds ₹50 lakh, at least 1% of output tax must be paid in cash (ITC can discharge only 99%), subject to exceptions such as income tax paid above ₹1 lakh in each of the last two years or refunds above ₹1 lakh."},
    {"q": "What changed in GST 2.0 from 22 September 2025?", "a": "Rates were rationalised into 5% and 18% slabs with a 40% special rate for demerit goods. Individual health and life insurance became exempt. For ITC work, 12%/28% invoices dated on or after 22-09-2025 should be checked for wrong rates (except specified tobacco items)."},
    {"q": "What did the 57th GST Council recommend on ITC?", "a": "On 08-10-2026 the Council recommended removing Sec 17(5) blocks on outdoor catering, health & life insurance, telecom towers, pipelines outside factory, free samples and goods destroyed on expiry; refunds of ITC on input services (inverted duty) from 01-11-2026 and capital goods over 60 months from 01-04-2027; a hearing under Rule 86A; and new IMS/credit-reversal statements. These are recommendations until notified."},
    {"q": "Is ITC available on import of services?", "a": "Yes. Import of services is under RCM (Sec 5(3) IGST Act). The recipient pays IGST in cash and claims ITC in Table 4A(2) of GSTR-3B, subject to Sec 17(5)."},
    {"q": "What is metal scrap RCM?", "a": "From 10-10-2024 (Notfn 06/2024-CT(R)) a registered buyer pays 18% under RCM on metal scrap of Chapters 72-81 bought from an unregistered person. From registered suppliers, 2% GST-TDS u/s 51 applies above ₹2.5 lakh contract value."},
    {"q": "Can ITC be claimed if supplier has not filed return?", "a": "Under Sec 16(2)(c) tax must be actually paid by the supplier. If the invoice is not in GSTR-2B it cannot be claimed (Rule 36(4)). If it is in GSTR-2B but the supplier has not filed GSTR-3B by 30 September of the next year, Rule 37A requires reversal. Courts (Suncraft Energy) have protected bona fide recipients where the department did not first proceed against the supplier."},
    {"q": "How should ineligible ITC be reported in GSTR-3B?", "a": "Per Circular 170/02/2022: report full ITC as per GSTR-2B in Table 4A, reverse Sec 17(5) and Rule 38/42/43 amounts in 4B(1), temporary reversals in 4B(2), reclaimed ITC in 4D(1) (also included in 4A(5)), and 16(4)/PoS-restricted ITC in 4D(2)."},
    {"q": "What is ITC on capital goods?", "a": "Full ITC on capital goods is available in one go (not in instalments), subject to Sec 16 and 17(5). If depreciation is claimed on the tax component, ITC is not allowed (Sec 16(3)). Common capital goods are apportioned under Rule 43."},
    {"q": "What is the difference between Rule 42 and Rule 43?", "a": "Rule 42 deals with inputs and input services used commonly for taxable and exempt supplies (monthly apportionment with annual true-up). Rule 43 deals with capital goods, spreading common credit over 60 months."},
    {"q": "How does AI help in GST ITC compliance?", "a": "AI automates invoice matching with fuzzy logic, classifies expenses into eligible/blocked/RCM using machine-learning text classification, flags anomalies (duplicate, round-sum, threshold-splitting, Benford's law deviations), scores vendor risk and forecasts ITC. The tax department uses similar analytics - GSTN's BIFA, CBIC's ADVAIT and NETRA - to detect fake ITC."},
    {"q": "What is BIFA and ADVAIT?", "a": "BIFA (Business Intelligence and Fraud Analytics) is GSTN's analytics and machine-learning platform for fraud propensity and network analysis; ADVAIT (Advanced Analytics in Indirect Taxation, 2021) is CBIC's analytics platform. Together with NETRA they help detect fake invoicing and ITC fraud."},
    {"q": "What is Section 16(5) and 16(6)?", "a": "Inserted by Finance (No.2) Act, 2024. 16(5): ITC for FY 2017-18 to 2020-21 allowed in returns filed up to 30-11-2021. 16(6): where registration was cancelled and later revoked, ITC can be claimed within the specified extended period."},
    {"q": "Is ITC available on employee health insurance?", "a": "Blocked under Sec 17(5)(b)(i) unless obligatory under law. Individual policies became exempt from 22-09-2025. The 57th GST Council has proposed removing this block - check notification before claiming."},
    {"q": "Is ITC available on mobile phones and laptops?", "a": "Yes, if used for business. If used for personal consumption it is blocked under Sec 17(5)(g). Mixed use requires apportionment."},
    {"q": "When to reverse ITC on credit notes?", "a": "When a supplier issues a credit note reducing tax (Sec 34), the recipient reduces ITC accordingly. Under IMS a credit note can be kept pending for a limited period; rejecting it will increase the supplier's liability."},
    {"q": "What is ISD?", "a": "Input Service Distributor (Sec 2(61)) is an office that receives input-service invoices and distributes ITC to branches with the same PAN. ISD registration is mandatory from 01-04-2025 for distributing common input-service credit, including RCM services."},
]

# ---------------------------------------------------------------------------
# 9. Training corpus for the expense classifier (text, label)
# ---------------------------------------------------------------------------
CORPUS = {
    "ELIGIBLE": [
        "raw material steel coil purchase", "cotton yarn for weaving", "packing material corrugated boxes", "printer cartridges and stationery",
        "laptop for accounts team", "machine spare parts bearings", "cnc machine purchase", "lubricating oil for machines",
        "chartered accountant audit fees", "software license annual subscription", "internet broadband charges", "telephone bill office",
        "advertisement in newspaper", "consultancy charges professional", "electrical cables and switchgear", "chemicals dyes for processing",
        "office furniture chairs", "repair of production machine", "courier charges documents", "packaging film rolls",
        "air conditioner for office", "testing and calibration charges", "web hosting domain india", "warehouse handling charges registered",
        "printing of brochures", "trading goods purchase for resale", "industrial gases oxygen", "plant machinery installation charges",
        "computer server purchase", "manpower supply company invoice", "bank charges processing fee", "annual maintenance contract computers",
        "freight charged by registered transporter with gst at 18 percent", "seeds and fertilizer trading stock", "mobile phone for sales staff business",
    ],
    "BLK_MOTOR": [
        "purchase of innova crysta car", "motor car for director", "sedan car purchase", "car insurance premium", "servicing of company car",
        "repair of fortuner car", "two wheeler motorcycle purchase for staff", "suv vehicle purchase", "car accessories and tyres for car",
        "general insurance of motor car", "honda city car repair", "scorpio vehicle service charges", "car purchase for managing director",
        "vehicle maintenance passenger car",
    ],
    "BLK_FOOD": [
        "lunch for staff meeting", "restaurant bill client dinner", "outdoor catering for annual function", "canteen food expenses",
        "tea coffee and snacks", "hotel food and beverages", "party catering diwali celebration", "beauty parlour services", "salon charges",
        "hospital charges employee", "medical treatment expenses", "cab hire for directors", "biscuits and refreshments", "pizza order office party",
        "sweets and namkeen for staff",
    ],
    "BLK_INS": [
        "group mediclaim policy employees", "group health insurance premium", "life insurance premium employees", "term insurance group policy",
        "mediclaim renewal staff family", "group personal health cover",
    ],
    "BLK_CLUB": [
        "club membership fees", "gym membership for employees", "golf club annual subscription", "fitness centre membership",
        "gymkhana membership", "sports club fees director", "yoga studio membership",
    ],
    "BLK_TRAVEL": [
        "leave travel concession tickets", "holiday package for employees", "vacation tour for staff family", "home travel concession flight",
        "goa trip employees vacation", "annual holiday tour package",
    ],
    "BLK_CONSTRUCTION": [
        "cement for factory building", "tmt bars for construction", "civil work contractor bill", "works contract for office building",
        "construction of boundary wall", "renovation of office premises capitalised", "factory shed construction", "flooring and tiles for building",
        "plaster and painting new building", "interior fit out of office capitalised", "rmc ready mix concrete for building", "bricks and sand for construction",
        "architect fees new building construction", "waterproofing works building",
    ],
    "BLK_PERSONAL": [
        "furniture for director residence", "household appliances director home", "personal mobile for owner family", "family vacation expenses",
        "personal clothing purchase", "television for director house", "home renovation proprietor residence",
    ],
    "BLK_GIFT": [
        "diwali gifts for customers", "gift hampers for employees", "free samples distribution", "dry fruits gift boxes festival",
        "sweet boxes as gifts to dealers", "gift vouchers for clients", "goods destroyed in fire written off", "expired stock written off",
        "stolen inventory loss", "complimentary products free sample",
    ],
    "BLK_CSR": [
        "csr expenditure school kits", "corporate social responsibility tree plantation", "csr activity health camp", "csr donation of computers to school",
        "csr project village water", "materials for csr programme",
    ],
    "RCM_GTA": [
        "freight paid to transport company", "lorry freight inward goods", "truck hire goods transport agency", "gta consignment note freight",
        "cartage charges transporter", "bilty charges goods transport", "transportation of goods by road gta", "outward freight transporter bill",
        "goods transport agency freight 5 percent",
    ],
    "RCM_LEGAL": [
        "legal fees advocate", "advocate professional fees court case", "lawyer fees for legal opinion", "senior advocate appearance fees",
        "law firm fees litigation", "legal retainer advocate", "advocate fees gst appeal",
    ],
    "RCM_SECURITY": [
        "security guard services", "watchman charges", "security agency bill guards", "security personnel supply", "night guard services factory",
        "bouncers for event security",
    ],
    "RCM_RENT": [
        "shop rent unregistered landlord", "office rent paid to individual", "godown rent unregistered owner", "warehouse rent landlord",
        "factory premises rent individual", "residential flat rent for staff", "guest house rent", "commercial property rent", "land lease rent",
    ],
    "RCM_DIRECTOR": [
        "director sitting fees", "commission to independent director", "board meeting fees", "director remuneration commission not salary",
        "sitting fees independent directors",
    ],
    "RCM_IMPORT": [
        "aws cloud services usd invoice", "google ads campaign", "facebook advertising meta ireland", "foreign consultant fees", "linkedin premium subscription",
        "adobe creative cloud subscription", "microsoft azure services overseas", "zoom subscription foreign", "consultancy from singapore company",
        "software development by us company",
    ],
    "RCM_SPONSOR": [
        "sponsorship of cricket tournament", "event sponsorship fees", "title sponsorship seminar", "sponsoring college fest", "sponsorship marathon branding",
    ],
    "RCM_SCRAP": [
        "iron scrap purchase from kabadi", "ms scrap from unregistered dealer", "copper scrap purchase", "aluminium scrap unregistered", "steel melting scrap",
        "heavy melting scrap", "brass scrap purchase",
    ],
}

for _k, _v in {'ELIGIBLE': ['purchase of raw material from supplier', 'steel sheets for manufacturing', 'plastic granules raw material', 'spare parts for machine maintenance', 'statutory audit fees chartered accountant', 'tally software renewal', 'electrical repair of factory machine', 'packing boxes and tapes', 'printing and stationery for office', 'consumables for production line', 'testing laboratory charges', 'annual maintenance of air conditioners', 'inward raw material polyester chips', 'dyes and chemicals for processing unit', 'computer peripherals keyboard mouse', 'conveyor belt for plant', 'hdpe bags for packing', 'office rent registered landlord with gst', 'advertising hoardings registered agency', 'recruitment agency fees', 'freight charged with gst by logistics company forward charge', 'courier and postage', 'generator set for factory', 'safety shoes and gloves for workers'], 'RCM_GTA': ['freight inward raw material transporter lr', 'transport charges for goods lorry receipt', 'road freight goods carriage', 'truck freight to port', 'freight paid to roadlines', 'goods transport charges consignment', 'inward transportation charges gta 5 percent rcm', 'trailer freight for machinery', 'outward freight to customer by road', 'local cartage tempo goods'], 'RCM_IMPORT': ['aws invoice cloud hosting', 'amazon web services bill', 'google cloud platform invoice', 'meta ads invoice', 'github enterprise subscription', 'slack subscription usd', 'foreign software license invoice', 'consultancy fees to uk firm', 'royalty paid to foreign company', 'overseas marketing agency fees', 'atlassian jira subscription', 'openai api usage invoice usd'], 'RCM_LEGAL': ['advocate fees for high court matter', 'legal consultation advocate', 'fees to firm of advocates', 'counsel fees arbitration matter', 'legal drafting by advocate'], 'RCM_SECURITY': ['security services by proprietor agency', 'guards for warehouse', 'security charges monthly bill', 'watch and ward services', 'security personnel for site'], 'RCM_RENT': ['rent for godown to unregistered landlord', 'monthly office rent individual owner', 'rent of shop premises', 'lease rent for open land', 'rent paid for warehouse space owner not registered', 'residential accommodation rent for employees'], 'RCM_DIRECTOR': ['fees paid to director for board meetings', 'independent director sitting fee', 'commission payable to non executive director', 'director professional fees not employee'], 'RCM_SPONSOR': ['sponsorship charges for exhibition', 'sponsorship of sports event', 'co sponsorship of conference', 'sponsor fees for cultural programme'], 'RCM_SCRAP': ['scrap purchased from unregistered person', 'metal scrap kabadiwala', 'old iron scrap purchase', 'stainless steel scrap purchase', 'melting scrap from local dealer'], 'BLK_MOTOR': ['purchase of passenger car', 'toyota car purchase', 'car repairs and servicing', 'motor car comprehensive insurance', 'car tyres replacement for company car', 'maruti car for office use'], 'BLK_FOOD': ['food expenses for staff', 'dinner with clients at hotel', 'refreshments for meeting', 'canteen contractor bill', 'mess food charges', 'cake and snacks for celebration', 'health checkup employees'], 'BLK_INS': ['mediclaim insurance for staff', 'health policy premium for workers', 'group term life cover'], 'BLK_CLUB': ['club fees for directors', 'health club subscription', 'swimming club membership', 'country club annual charges'], 'BLK_TRAVEL': ['employees vacation travel tickets', 'leave travel package for staff', 'family holiday tickets for employees'], 'BLK_CONSTRUCTION': ['civil construction of warehouse building', 'building material for new office', 'construction contractor running bill', 'roofing and civil work of shed', 'repairs of building capitalised'], 'BLK_PERSONAL': ['personal expenses of proprietor', 'groceries for owner home', 'personal travel of director family', 'jewellery purchase personal'], 'BLK_GIFT': ['new year gifts to clients', 'free samples to customers', 'gift articles for dealers meet', 'goods lost in transit written off', 'damaged goods destroyed'], 'BLK_CSR': ['csr medical camp expenses', 'csr education sponsorship materials', 'csr expenses village development', 'books distributed under csr']}.items():
    CORPUS[_k].extend(_v)

LABELS = {
    "ELIGIBLE": {"name": "Eligible ITC", "group": "eligible", "ref": "Sec 16"},
    "BLK_MOTOR": {"name": "Blocked - Motor vehicle", "group": "blocked", "ref": "Sec 17(5)(a)/(ab)"},
    "BLK_FOOD": {"name": "Blocked - Food / catering / health", "group": "blocked", "ref": "Sec 17(5)(b)(i)"},
    "BLK_INS": {"name": "Blocked - Life / health insurance", "group": "blocked", "ref": "Sec 17(5)(b)(i)"},
    "BLK_CLUB": {"name": "Blocked - Club / fitness membership", "group": "blocked", "ref": "Sec 17(5)(b)(ii)"},
    "BLK_TRAVEL": {"name": "Blocked - Employee vacation travel", "group": "blocked", "ref": "Sec 17(5)(b)(iii)"},
    "BLK_CONSTRUCTION": {"name": "Blocked - Construction of immovable property", "group": "blocked", "ref": "Sec 17(5)(c)/(d)"},
    "BLK_PERSONAL": {"name": "Blocked - Personal consumption", "group": "blocked", "ref": "Sec 17(5)(g)"},
    "BLK_GIFT": {"name": "Blocked - Gifts / samples / loss", "group": "blocked", "ref": "Sec 17(5)(h)"},
    "BLK_CSR": {"name": "Blocked - CSR expenditure", "group": "blocked", "ref": "Sec 17(5)(fa)"},
    "RCM_GTA": {"name": "RCM - Goods Transport Agency", "group": "rcm", "ref": "Notfn 13/2017 Sl. 1", "rcm_id": "RCM_GTA"},
    "RCM_LEGAL": {"name": "RCM - Legal (advocate)", "group": "rcm", "ref": "Notfn 13/2017 Sl. 2", "rcm_id": "RCM_LEGAL"},
    "RCM_SECURITY": {"name": "RCM - Security services", "group": "rcm", "ref": "Notfn 13/2017 Sl. 14", "rcm_id": "RCM_SECURITY"},
    "RCM_RENT": {"name": "RCM - Renting of property", "group": "rcm", "ref": "Notfn 13/2017 Sl. 5AA/5AB", "rcm_id": "RCM_RENT_COMM"},
    "RCM_DIRECTOR": {"name": "RCM - Director services", "group": "rcm", "ref": "Notfn 13/2017 Sl. 6", "rcm_id": "RCM_DIRECTOR"},
    "RCM_IMPORT": {"name": "RCM - Import of services", "group": "rcm", "ref": "Sec 5(3) IGST", "rcm_id": "RCM_IMPORT_SERVICE"},
    "RCM_SPONSOR": {"name": "RCM - Sponsorship", "group": "rcm", "ref": "Notfn 13/2017 Sl. 4", "rcm_id": "RCM_SPONSOR"},
    "RCM_SCRAP": {"name": "RCM - Metal scrap", "group": "rcm", "ref": "Notfn 06/2024-CT(R)", "rcm_id": "RCM_METAL_SCRAP"},
}

# HSN / SAC prefix hints used by the rules engine (prefix -> label)
HSN_HINTS = {
    "8703": "BLK_MOTOR", "8711": "BLK_MOTOR", "2523": "BLK_CONSTRUCTION", "7214": "BLK_CONSTRUCTION",
    "9954": "BLK_CONSTRUCTION", "996331": "BLK_FOOD", "9963": "BLK_FOOD", "999721": "BLK_FOOD",
    "997652": "BLK_CLUB", "999591": "BLK_CLUB", "9965": "RCM_GTA", "998215": "RCM_LEGAL",
    "998211": "RCM_LEGAL", "998212": "RCM_LEGAL", "998525": "RCM_SECURITY", "997212": "RCM_RENT",
    "997211": "RCM_RENT", "7204": "RCM_SCRAP", "7404": "RCM_SCRAP", "7602": "RCM_SCRAP",
}

# GSTIN "type" codes for vendor master
VENDOR_TYPES = ["Regular", "Composition", "Unregistered", "SEZ", "Foreign", "Government", "ISD"]


def build():
    kb = {
        "meta": META, "states": STATES, "special_category_states": SPECIAL_CATEGORY_STATES,
        "pan_types": PAN_HOLDER_TYPES, "rates": RATES, "itc_conditions": ITC_CONDITIONS,
        "blocked_credits": BLOCKED_CREDITS, "rcm_catalog": RCM_CATALOG, "rcm_compliance": RCM_COMPLIANCE,
        "gstr3b_tables": GSTR3B_TABLES, "dates": DATES, "case_laws": CASE_LAWS, "chatbot_kb": CHATBOT_KB,
        "corpus": [[t, lbl] for lbl, texts in CORPUS.items() for t in texts], "labels": LABELS,
        "hsn_hints": HSN_HINTS, "vendor_types": VENDOR_TYPES,
    }
    out_json = os.path.join(HERE, "gst_knowledge.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(kb, f, ensure_ascii=False, indent=1)
    out_js = os.path.join(HERE, "..", "app", "js", "kb.js")
    with open(out_js, "w", encoding="utf-8") as f:
        f.write("/* AUTO-GENERATED by knowledge/build_knowledge.py - do not edit */\n")
        f.write("window.GST_KB = " + json.dumps(kb, ensure_ascii=False) + ";\n")
    print(f"Knowledge base built: {len(RCM_CATALOG)} RCM entries, {len(BLOCKED_CREDITS)} blocked-credit heads, "
          f"{len(kb['corpus'])} training sentences, {len(CHATBOT_KB)} chatbot answers.")
    return kb


if __name__ == "__main__":
    build()
