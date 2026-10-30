"""
GSTR-2B vs Purchase Register reconciliation engine.

Four-pass matching (AI-assisted fuzzy logic):
  Pass 1  Exact key       GSTIN + normalised invoice number
  Pass 2  Fuzzy           same GSTIN, invoice-number similarity + amount + date score
  Pass 3  GSTIN rescue    same normalised invoice & value but GSTIN differs
                          (same PAN = other registration; small edit distance = typo)
  Pass 4  Leftovers       Missing in 2B / Missing in books
Duplicates in books are detected before matching.
"""
from collections import defaultdict

from common import d, levenshtein, money, norm_inv, similarity, tax_of

STATUS_LABEL = {
    "MATCHED": "Matched",
    "MATCHED_FUZZY": "Probable match",
    "MISMATCH_VALUE": "Value mismatch",
    "MISMATCH_DATE": "Date mismatch",
    "GSTIN_MISMATCH": "GSTIN mismatch",
    "MISSING_IN_2B": "Missing in 2B",
    "MISSING_IN_BOOKS": "Missing in books",
    "DUPLICATE_IN_BOOKS": "Duplicate in books",
    "NOT_APPLICABLE": "Not expected in 2B",
}

DEFAULTS = {"amount_tolerance": 1.0, "date_tolerance_days": 0, "fuzzy_threshold": 0.72, "value_tolerance_pct": 1.0}


def _expected_in_2b(p):
    return bool(p.get("supplier_gstin")) and p.get("supplier_type") in ("Regular", "SEZ", "ISD", "Government")


def _compare(p, b, tol):
    dt = abs(money(p["taxable_value"]) - money(b["taxable_value"]))
    dtax = abs(tax_of(p) - tax_of(b))
    pd_, bd_ = d(p["invoice_date"]), d(b["invoice_date"])
    ddays = abs((pd_ - bd_).days) if pd_ and bd_ else 999
    return dt, dtax, ddays


def reconcile(purchases, gstr2b, vendors=None, settings=None):
    s = dict(DEFAULTS, **(settings or {}))
    tol = s["amount_tolerance"]
    vend = {v["id"]: v for v in (vendors or [])}
    results = []
    used_b = set()

    b_by_key = defaultdict(list)
    b_by_gstin = defaultdict(list)
    for b in gstr2b:
        b_by_key[(b["supplier_gstin"], norm_inv(b["invoice_no"]))].append(b)
        b_by_gstin[b["supplier_gstin"]].append(b)

    # Duplicate detection in books
    seen = {}
    dup_ids = set()
    for p in sorted(purchases, key=lambda r: r["id"]):
        if not p.get("supplier_gstin"):
            continue
        k = (p["supplier_gstin"], norm_inv(p["invoice_no"]), round(money(p["taxable_value"])))
        if k in seen:
            dup_ids.add(p["id"])
        else:
            seen[k] = p["id"]

    pending = []
    for p in purchases:
        if p["id"] in dup_ids:
            results.append(_res(p, None, "DUPLICATE_IN_BOOKS", 1.0, f"Same invoice already booked as {seen[(p['supplier_gstin'], norm_inv(p['invoice_no']), round(money(p['taxable_value'])))]}"))
            continue
        if not _expected_in_2b(p):
            note = {"Unregistered": "Unregistered supplier - RCM / no ITC from 2B",
                    "Foreign": "Import of services - IGST paid under RCM (Table 4A(2))",
                    "Composition": "Composition supplier issues bill of supply - no ITC"}.get(p.get("supplier_type"), "Not reported in GSTR-2B")
            results.append(_res(p, None, "NOT_APPLICABLE", 1.0, note))
            continue
        pending.append(p)

    # Pass 1 - exact key
    still = []
    for p in pending:
        cands = [b for b in b_by_key.get((p["supplier_gstin"], norm_inv(p["invoice_no"])), []) if b["id"] not in used_b]
        if not cands:
            still.append(p)
            continue
        b = min(cands, key=lambda x: abs(money(x["taxable_value"]) - money(p["taxable_value"])))
        used_b.add(b["id"])
        dt, dtax, ddays = _compare(p, b, tol)
        notes = []
        if p["invoice_no"].strip() != b["invoice_no"].strip():
            notes.append(f"Invoice no. format differs ('{b['invoice_no']}' in 2B)")
        if dtax > tol or dt > tol:
            st, conf = "MISMATCH_VALUE", 0.9
            notes.append(f"Tax differs by {dtax:,.2f}; taxable by {dt:,.2f}")
        elif ddays > s["date_tolerance_days"]:
            st, conf = "MISMATCH_DATE", 0.95
            notes.append(f"Invoice date differs by {ddays} day(s)")
        else:
            st, conf = "MATCHED", 1.0 if not notes else 0.97
        results.append(_res(p, b, st, conf, "; ".join(notes)))

    # Pass 2 - fuzzy within GSTIN
    still2 = []
    for p in still:
        best, best_score, best_parts = None, 0, None
        for b in b_by_gstin.get(p["supplier_gstin"], []):
            if b["id"] in used_b:
                continue
            inv_sim = similarity(norm_inv(p["invoice_no"]), norm_inv(b["invoice_no"]))
            pv, bv = money(p["taxable_value"]), money(b["taxable_value"])
            amt_sim = 1 - min(1, abs(pv - bv) / max(pv, bv, 1))
            pd_, bd_ = d(p["invoice_date"]), d(b["invoice_date"])
            date_sim = max(0, 1 - abs((pd_ - bd_).days) / 30) if pd_ and bd_ else 0
            score = 0.5 * inv_sim + 0.35 * amt_sim + 0.15 * date_sim
            if score > best_score:
                best, best_score, best_parts = b, score, (inv_sim, amt_sim, date_sim)
        if best and best_score >= s["fuzzy_threshold"] and best_parts[1] >= 0.98 and best_parts[0] >= 0.6:
            used_b.add(best["id"])
            results.append(_res(p, best, "MATCHED_FUZZY", round(best_score, 3),
                                f"AI fuzzy match: invoice similarity {best_parts[0]:.0%}, amount {best_parts[1]:.0%}, date {best_parts[2]:.0%} "
                                f"('{best['invoice_no']}' in 2B)"))
        else:
            still2.append(p)

    # Pass 3 - GSTIN rescue
    free_b = [b for b in gstr2b if b["id"] not in used_b]
    by_inv = defaultdict(list)
    for b in free_b:
        by_inv[norm_inv(b["invoice_no"])].append(b)
    for p in still2:
        cands = [b for b in by_inv.get(norm_inv(p["invoice_no"]), []) if b["id"] not in used_b
                 and abs(money(b["taxable_value"]) - money(p["taxable_value"])) <= max(tol, money(p["taxable_value"]) * 0.001)]
        hit = None
        for b in cands:
            dist = levenshtein(p["supplier_gstin"], b["supplier_gstin"])
            if p["supplier_gstin"][2:12] == b["supplier_gstin"][2:12]:
                hit = (b, "Same PAN - invoice reported under another GSTIN of the supplier", 0.85)
            elif dist <= 2:
                hit = (b, f"GSTIN in books differs from 2B by {dist} character(s) - probable data-entry error; 2B has {b['supplier_gstin']}", 0.9)
            if hit:
                break
        if hit:
            used_b.add(hit[0]["id"])
            results.append(_res(p, hit[0], "GSTIN_MISMATCH", hit[2], hit[1]))
        else:
            v = vend.get(p.get("vendor_id"), {})
            why = "Supplier has not reported this invoice in GSTR-1/IFF"
            if v.get("status") == "Cancelled":
                why += f"; supplier registration cancelled on {v.get('cancel_date')}"
            elif v and float(v.get("gstr1_rate", 1)) < 0.7:
                why += f"; chronic late filer (GSTR-1 on time {float(v['gstr1_rate']):.0%})"
            results.append(_res(p, None, "MISSING_IN_2B", 1.0, why))

    for b in gstr2b:
        if b["id"] not in used_b:
            results.append(_res(None, b, "MISSING_IN_BOOKS", 1.0, "Present in GSTR-2B but not booked - verify and account (or reject in IMS)"))
    return results


def _res(p, b, status, conf, note):
    r = {
        "pr_id": p["id"] if p else "", "b2b_id": b["id"] if b else "", "client_id": (p or b)["client_id"],
        "status": status, "label": STATUS_LABEL[status], "confidence": conf, "note": note,
        "supplier_gstin": (p or b)["supplier_gstin"], "supplier_name": (p or b)["supplier_name"],
        "invoice_no": p["invoice_no"] if p else b["invoice_no"], "invoice_date": p["invoice_date"] if p else b["invoice_date"],
        "books_taxable": money(p["taxable_value"]) if p else 0.0, "books_tax": tax_of(p) if p else 0.0,
        "b2b_taxable": money(b["taxable_value"]) if b else 0.0, "b2b_tax": tax_of(b) if b else 0.0,
        "return_period": b["return_period"] if b else "", "ims_action": b["ims_action"] if b else "",
        "itc_available": b["itc_available"] if b else "", "supplier_3b_filed": b.get("supplier_3b_filed", "") if b else "",
    }
    r["tax_diff"] = round(r["books_tax"] - r["b2b_tax"], 2)
    return r


def summary(results):
    out = defaultdict(lambda: {"count": 0, "books_tax": 0.0, "b2b_tax": 0.0})
    for r in results:
        o = out[r["status"]]
        o["count"] += 1
        o["books_tax"] = round(o["books_tax"] + r["books_tax"], 2)
        o["b2b_tax"] = round(o["b2b_tax"] + r["b2b_tax"], 2)
    return dict(out)
