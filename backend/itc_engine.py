"""
ITC eligibility engine - applies Sections 16, 17 and Rules 36(4), 37, 37A, 42/43
to every inward invoice and explains the decision rule-by-rule.
"""
from datetime import date

from common import (d, fy_label, kb, kw_match, last_claim_period, money, period_of, sec16_4_deadline, tax_of)
from gstin_utils import validate as validate_gstin

GST2_DATE = date(2025, 9, 22)

# Status priority (lower = more severe, decides headline status)
STATUS = {
    "TIME_BARRED": (1, "Time-barred u/s 16(4)"),
    "DUPLICATE": (2, "Duplicate entry"),
    "BLOCKED": (3, "Blocked u/s 17(5)"),
    "INELIGIBLE": (4, "Ineligible"),
    "NO_ITC": (5, "No ITC (no tax / exempt use)"),
    "RCM_UNPAID": (6, "RCM tax not paid"),
    "NOT_IN_2B": (7, "Not in GSTR-2B"),
    "RESTRICTED": (8, "Restricted in GSTR-2B"),
    "DEFERRED": (9, "Deferred"),
    "REVERSE_37": (10, "Reverse - Rule 37 (180 days)"),
    "REVERSE_37A": (11, "Reverse - Rule 37A"),
    "ELIGIBLE": (12, "Eligible"),
}


def rule_category(p, client):
    """Rule-based (deterministic) classification of an inward supply -> label code or None."""
    k = kb()
    usage = p.get("usage", "")
    if usage == "Personal":
        return "BLK_PERSONAL", "usage tagged personal"
    if usage == "CSR":
        return "BLK_CSR", "usage tagged CSR"
    if usage == "Own-Building":
        return "BLK_CONSTRUCTION", "construction of own immovable property"
    text = f"{p.get('description', '')} {p.get('expense_head', '')}".lower()
    hsn = str(p.get("hsn_sac", ""))
    hints = sorted(k["hsn_hints"].items(), key=lambda kv: -len(kv[0]))
    for prefix, label in hints:
        if hsn.startswith(prefix) and label.startswith("BLK"):
            return label, f"HSN/SAC {hsn} matches {prefix}"
    for blk in k["blocked_credits"]:
        for kw in blk["keywords"]:
            if kw_match(text, kw):
                return blk["code"], f"keyword '{kw}'"
    return None, ""


def block_exception(code, p, client):
    nature = (client.get("nature", "") + " " + client.get("business", "")).lower()
    if code == "BLK_CONSTRUCTION" and p.get("usage") == "Project-WC":
        return "Used for further supply of works contract / construction for customer (not on own account) - exception applies"
    if code == "BLK_MOTOR" and any(x in nature for x in ("transport of passengers", "car dealer", "driving school", "vehicle dealer")):
        return "Used for further supply / passenger transport / driving training - exception applies"
    if code == "BLK_FOOD" and any(x in nature for x in ("restaurant", "caterer", "hotel")):
        return "Used for outward supply of the same category - exception applies"
    return None


def evaluate(p, client, recon=None, vendor=None, as_on=None):
    """Evaluate one purchase record. Returns dict with status, amounts and rule-wise checks."""
    k = kb()
    as_on = as_on or date.fromisoformat(k["meta"]["law_as_on"])
    tax = tax_of(p)
    inv_date = d(p["invoice_date"])
    flags, checks = [], []
    statuses = set()

    def flag(code, sev, ref, msg):
        flags.append({"code": code, "severity": sev, "ref": ref, "msg": msg})

    def check(ref, ok, msg):
        checks.append({"ref": ref, "ok": ok, "msg": msg})

    is_rcm = p.get("reverse_charge") == "Y"
    claimed = p.get("itc_claimed") == "Y"
    rstat = (recon or {}).get("status", "")

    # --- GSTIN validity
    if p.get("supplier_gstin"):
        v = validate_gstin(p["supplier_gstin"], k["states"])
        check("GSTIN", v["valid"], "Supplier GSTIN valid" if v["valid"] else "Invalid GSTIN: " + "; ".join(v["errors"]))
        if not v["valid"]:
            flag("GSTIN_INVALID", "high", "Rule 46", "Supplier GSTIN fails checksum - correct the vendor master / obtain revised invoice")

    # --- Supplier registration status
    if vendor and vendor.get("status") == "Cancelled" and vendor.get("cancel_date") and inv_date and inv_date > d(vendor["cancel_date"]):
        statuses.add("INELIGIBLE")
        flag("SUPPLIER_CANCELLED", "high", "Sec 16(2)(c)", f"Invoice dated after supplier's registration was cancelled ({vendor['cancel_date']}) - no ITC")

    # --- Tax present?
    if tax <= 0:
        statuses.add("NO_ITC")
        reason = "Bill of supply from composition supplier" if p.get("supplier_type") == "Composition" else "No GST charged (nil/exempt goods)"
        check("Tax", False, reason)
    if p.get("usage") == "Exempt" and tax > 0:
        statuses.add("NO_ITC")
        flag("EXEMPT_USE", "medium", "Sec 17(2)", "Used exclusively for exempt supplies - ITC not available")

    # --- 17(5) blocked credits
    code, why = rule_category(p, client)
    blocked_ref = ""
    if code:
        exc = block_exception(code, p, client)
        meta = next((b for b in k["blocked_credits"] if b["code"] == code), None)
        if exc:
            check(meta["ref"] if meta else "17(5)", True, exc)
        else:
            statuses.add("BLOCKED")
            blocked_ref = meta["ref"] if meta else "Sec 17(5)"
            flag("BLOCKED", "high", blocked_ref, f"{meta['title'] if meta else 'Blocked credit'} ({why})")
            if meta and meta.get("proposed"):
                flag("PROPOSED_RELAXATION", "info", "57th GSTC", meta["proposed"])
    else:
        check("Sec 17(5)", True, "Not a blocked credit")

    # --- Receipt of goods/services
    if not p.get("receipt_date"):
        statuses.add("DEFERRED")
        check("Sec 16(2)(b)", False, "Goods/services not yet received - defer ITC")
    else:
        check("Sec 16(2)(b)", True, f"Received on {p['receipt_date']}")

    # --- GSTR-2B / IMS (forward charge B2B, and RCM from registered suppliers)
    if rstat == "DUPLICATE_IN_BOOKS":
        statuses.add("DUPLICATE")
        flag("DUPLICATE", "high", "Books", recon.get("note", "Duplicate"))
    elif rstat == "NOT_APPLICABLE" or not rstat:
        pass
    elif rstat == "MISSING_IN_2B":
        if not is_rcm:
            statuses.add("NOT_IN_2B")
            check("Sec 16(2)(aa) / Rule 36(4)", False, "Invoice not in GSTR-2B - " + recon.get("note", ""))
            if claimed:
                flag("EXCESS_CLAIM", "high", "Rule 36(4) / Rule 88D", "ITC claimed though not in GSTR-2B - reverse or expect DRC-01C intimation")
    else:
        ims = recon.get("ims_action", "")
        if ims == "Rejected":
            statuses.add("NOT_IN_2B")
            check("IMS", False, "Rejected by recipient in IMS - not part of GSTR-2B")
        elif ims == "Pending":
            statuses.add("DEFERRED")
            check("IMS", False, "Kept pending in IMS - will flow to a later GSTR-2B")
        else:
            check("Sec 16(2)(aa)", True, f"Reflected in GSTR-2B {recon.get('return_period')} ({recon.get('label')})")
        if recon.get("itc_available") == "N":
            statuses.add("RESTRICTED")
            flag("ITC_RESTRICTED", "high", "Sec 16(2)(ba)", "ITC shown as not available in GSTR-2B (place-of-supply rule) - report in 4D(2)")
        if rstat == "MISMATCH_VALUE":
            flag("VALUE_MISMATCH", "medium", "Rule 36(4)", f"Tax in books differs from 2B by {recon.get('tax_diff', 0):,.2f} - claim lower of the two")
        if rstat in ("MATCHED_FUZZY", "GSTIN_MISMATCH", "MISMATCH_DATE"):
            flag(rstat, "low", "Recon", recon.get("note", ""))
        if recon.get("supplier_3b_filed") == "N" and inv_date:
            cutoff = date(inv_date.year + (1 if inv_date.month >= 4 else 0), 9, 30)
            if as_on > cutoff:
                statuses.add("REVERSE_37A")
                flag("RULE_37A", "high", "Rule 37A", f"Supplier has not filed GSTR-3B by {cutoff:%d-%m-%Y}; reverse ITC by 30-11-{cutoff.year} and re-avail when supplier files")
            else:
                flag("SUPPLIER_3B_PENDING", "medium", "Sec 16(2)(c)", f"Supplier GSTR-3B pending - Rule 37A reversal if not filed by {cutoff:%d-%m-%Y}")

    # --- RCM
    if is_rcm:
        if p.get("rcm_paid_date"):
            check("Sec 49(4)", True, f"RCM tax paid in cash on {p['rcm_paid_date']}")
        else:
            statuses.add("RCM_UNPAID")
            flag("RCM_UNPAID", "high", "Sec 9(3)/49(4)", "RCM liability not yet paid in cash - pay with interest; ITC available only after payment")
        if p.get("supplier_type") in ("Unregistered", "Foreign") and not p.get("self_invoice_no"):
            flag("SELF_INVOICE", "medium", "Sec 31(3)(f) / Rule 47A", "Self-invoice not issued (due within 30 days of receipt)")
    elif p.get("supplier_type") in ("Unregistered",) and tax <= 0:
        flag("RCM_CHECK", "low", "Sec 9(4)", "Purchase from unregistered person - check RCM applicability")

    # --- Rule 37: 180 days payment (not for RCM)
    if not is_rcm and tax > 0 and inv_date:
        pay = d(p.get("payment_date"))
        if pay is None and (as_on - inv_date).days > 180:
            statuses.add("REVERSE_37")
            flag("RULE_37", "high", "Rule 37", f"Supplier unpaid for {(as_on - inv_date).days} days - reverse ITC with interest; re-avail on payment")
        elif pay is not None and (pay - inv_date).days > 180:
            flag("RULE_37_LATE", "medium", "Rule 37", f"Paid after {(pay - inv_date).days} days - reversal and re-availment with interest required for the gap")
        else:
            check("Rule 37", True, "Payment within 180 days" if pay else f"Unpaid, {(as_on - inv_date).days} days old")

    # --- Section 16(4) time limit
    if inv_date:
        deadline = sec16_4_deadline(inv_date)
        lcp = last_claim_period(inv_date)
        if claimed and p.get("claim_period") and p["claim_period"] > lcp:
            statuses.add("TIME_BARRED")
            flag("TIME_BARRED", "high", "Sec 16(4)", f"Claimed in {p['claim_period']} return - after the 30-11-{deadline.year} limit")
        elif not claimed and as_on > deadline and tax > 0:
            statuses.add("TIME_BARRED")
            flag("TIME_BARRED", "high", "Sec 16(4)", f"Not claimed by {deadline:%d-%m-%Y} - ITC lapsed (report in 4D(2))")
        elif not claimed and tax > 0:
            days_left = (deadline - as_on).days
            sev = "high" if days_left <= 45 else "info"
            check("Sec 16(4)", True, f"Claim by GSTR-3B for {lcp} (deadline {deadline:%d-%m-%Y}, {days_left} days left)")
            if days_left <= 45:
                flag("DEADLINE_NEAR", sev, "Sec 16(4)", f"Only {days_left} days left to claim ITC of FY {fy_label(inv_date)} (last return: {lcp})")
        else:
            check("Sec 16(4)", True, f"Claimed within time limit ({fy_label(inv_date)} limit 30-11-{deadline.year})")

    # --- Rate validation (GST 2.0) and arithmetic
    rate = money(p.get("rate"))
    valid_rates = k["rates"]["post_gst2"] if inv_date and inv_date >= GST2_DATE else k["rates"]["pre_gst2"]
    if tax > 0 and rate not in valid_rates:
        flag("RATE_INVALID", "medium", "GST 2.0", f"{rate:g}% is not a valid slab for invoices dated on/after 22-09-2025 - verify classification / seek credit note")
    exp = money(p.get("taxable_value")) * rate / 100
    if tax > 0 and abs(exp - (tax - money(p.get("cess")))) > max(1, exp * 0.005):
        flag("TAX_ARITH", "medium", "Rule 46", f"Tax {tax:,.2f} does not equal {rate:g}% of taxable value ({exp:,.2f})")

    # --- Place of supply / tax head
    sup, pos = p.get("supplier_state"), p.get("pos")
    if not is_rcm and sup and pos and sup not in ("96", "97") and tax > 0:
        if sup == pos and money(p.get("igst")) > 0:
            flag("WRONG_HEAD", "medium", "Sec 8 IGST / Sec 77", "IGST charged on an intra-State supply - wrong tax head")
        if sup != pos and (money(p.get("cgst")) > 0 or money(p.get("sgst")) > 0):
            flag("WRONG_HEAD", "medium", "Sec 7 IGST / Sec 77", "CGST+SGST charged on an inter-State supply - wrong tax head")

    if p.get("usage") == "Common":
        flag("COMMON_CREDIT", "info", "Rule 42 / 43", "Common credit - apportion between taxable and exempt supplies")

    # --- Headline status and amounts
    status = min(statuses, key=lambda s: STATUS[s][0]) if statuses else "ELIGIBLE"
    eligible = tax if status == "ELIGIBLE" else 0.0
    out = {
        "id": p["id"], "client_id": p["client_id"], "status": status, "status_label": STATUS[status][1],
        "tax": tax, "eligible_itc": round(eligible, 2), "blocked_itc": round(tax if status == "BLOCKED" else 0, 2),
        "at_risk_itc": round(tax if status in ("NOT_IN_2B", "REVERSE_37", "REVERSE_37A", "RESTRICTED", "DUPLICATE", "INELIGIBLE") else 0, 2),
        "deferred_itc": round(tax if status in ("DEFERRED", "RCM_UNPAID") else 0, 2),
        "lapsed_itc": round(tax if status == "TIME_BARRED" else 0, 2),
        "claimed": claimed, "claim_period": p.get("claim_period", ""), "rule_category": code or "", "blocked_ref": blocked_ref,
        "flags": flags, "checks": checks, "recon_status": rstat,
        "period": period_of(inv_date) if inv_date else "",
    }
    # wrongly claimed = claimed but not eligible now (excluding deferred RCM pending payment)
    out["wrongly_claimed"] = round(tax if claimed and status not in ("ELIGIBLE",) else 0, 2)
    return out


def evaluate_all(data, client_id=None, recon_results=None, as_on=None):
    clients = {c["id"]: c for c in data["clients"]}
    vendors = {v["id"]: v for v in data["vendors"]}
    rmap = {r["pr_id"]: r for r in (recon_results or []) if r["pr_id"]}
    out = []
    for p in data["purchases"]:
        if client_id and p["client_id"] != client_id:
            continue
        out.append(evaluate(p, clients[p["client_id"]], rmap.get(p["id"]), vendors.get(p.get("vendor_id")), as_on))
    return out


def totals(evals):
    keys = ("tax", "eligible_itc", "blocked_itc", "at_risk_itc", "deferred_itc", "lapsed_itc", "wrongly_claimed")
    t = {k: round(sum(e[k] for e in evals), 2) for k in keys}
    t["count"] = len(evals)
    t["by_status"] = {}
    for e in evals:
        s = t["by_status"].setdefault(e["status"], {"count": 0, "tax": 0.0})
        s["count"] += 1
        s["tax"] = round(s["tax"] + e["tax"], 2)
    return t
