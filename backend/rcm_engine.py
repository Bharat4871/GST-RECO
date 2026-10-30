"""
Reverse Charge Mechanism engine.
  * determine()   - question-driven decision wizard over the notified RCM catalogue
  * time_of_supply() - Sec 12(3) (goods) / Sec 13(3) (services)
  * register()    - RCM register with due dates, delays, interest and documents
"""
from datetime import date, timedelta

from common import add_months, d, due_date_3b, kb, money, period_of, tax_of


def catalog():
    return kb()["rcm_catalog"]


def determine(entry_id, answers, value=0.0, inter_state=False):
    """Run the wizard for one catalogue entry.
    answers: {question_id: 'yes'/'no'/option}. Returns decision with computed tax."""
    entry = next((e for e in catalog() if e["id"] == entry_id), None)
    if not entry:
        raise ValueError(f"Unknown RCM entry {entry_id}")
    trail = []
    for q in entry["questions"]:
        a = answers.get(q["id"])
        if a is None:
            return {"entry": entry, "complete": False, "next_question": q, "trail": trail}
        ok = a in q["rcm_values"]
        trail.append({"q": q["text"], "a": a, "keeps_rcm": ok})
        if not ok:
            return {"entry": entry, "complete": True, "rcm": False, "reason": q["fail"], "trail": trail, "tax": None}
    rate = entry["rate"]
    value = money(value)
    tax = round(value * rate / 100, 2)
    split = {"igst": tax, "cgst": 0.0, "sgst": 0.0} if inter_state or entry["id"] == "RCM_IMPORT_SERVICE" else \
        {"igst": 0.0, "cgst": round(tax / 2, 2), "sgst": round(tax - round(tax / 2, 2), 2)}
    return {
        "entry": entry, "complete": True, "rcm": True, "trail": trail, "rate": rate, "value": value, "tax": tax, **split,
        "reason": f"RCM applies under {entry['notification']} {entry['entry']}: recipient pays {rate}% in cash.",
        "itc": "ITC of tax paid available in the same return (subject to Sec 17(5))" if entry["itc_recipient"] else "No ITC (concessional scheme)",
        "gstr3b": "Table 3.1(d) liability; ITC in " + ("4A(2)" if entry["id"] == "RCM_IMPORT_SERVICE" else "4A(3)"),
    }


def time_of_supply(p):
    """Return (tos_date, basis) for an RCM purchase."""
    inv = d(p["invoice_date"])
    pay = d(p.get("payment_date"))
    rec = d(p.get("receipt_date"))
    entry = next((e for e in catalog() if e["id"] == p.get("rcm_type")), None)
    is_goods = bool(entry and entry["kind"] == "goods")
    cands = []
    if is_goods:
        if rec:
            cands.append((rec, "date of receipt of goods - Sec 12(3)(a)"))
        if pay:
            cands.append((pay, "date of payment - Sec 12(3)(b)"))
        cands.append((inv + timedelta(days=30), "31st day from supplier invoice - Sec 12(3)(c)"))
    else:
        if pay:
            cands.append((pay, "date of payment - Sec 13(3)(a)"))
        cands.append((inv + timedelta(days=60), "61st day from supplier invoice - Sec 13(3)(b)"))
    return min(cands, key=lambda x: x[0])


def interest(amount, from_date, to_date, rate=18.0):
    days = max(0, (to_date - from_date).days)
    return round(money(amount) * rate / 100 * days / 365, 2), days


def register(purchases, as_on=None, client_id=None):
    as_on = as_on or date.fromisoformat(kb()["meta"]["law_as_on"])
    cat = {e["id"]: e for e in catalog()}
    rows = []
    for p in purchases:
        if p.get("reverse_charge") != "Y" or (client_id and p["client_id"] != client_id):
            continue
        tos, basis = time_of_supply(p)
        liab_period = period_of(tos)
        due = due_date_3b(liab_period)
        paid = d(p.get("rcm_paid_date"))
        tax = tax_of(p)
        int_amt, days = (interest(tax, due, paid) if paid and paid > due else
                         interest(tax, due, as_on) if not paid and as_on > due else (0.0, 0))
        e = cat.get(p.get("rcm_type"), {})
        si_due = (d(p.get("receipt_date")) or d(p["invoice_date"])) + timedelta(days=30)
        status = "Paid on time" if paid and paid <= due else "Paid late" if paid else ("Overdue" if as_on > due else "Due")
        rows.append({
            "id": p["id"], "client_id": p["client_id"], "supplier_name": p["supplier_name"], "supplier_type": p["supplier_type"],
            "rcm_type": p.get("rcm_type"), "rcm_title": e.get("title", p.get("rcm_type")), "notification": e.get("notification", ""),
            "invoice_no": p["invoice_no"], "invoice_date": p["invoice_date"], "taxable_value": money(p["taxable_value"]),
            "rate": money(p["rate"]), "igst": money(p["igst"]), "cgst": money(p["cgst"]), "sgst": money(p["sgst"]), "tax": tax,
            "tos": str(tos), "tos_basis": basis, "liability_period": liab_period, "due_date": str(due),
            "paid_date": p.get("rcm_paid_date", ""), "status": status, "delay_days": days, "interest": int_amt,
            "self_invoice_no": p.get("self_invoice_no", ""),
            "self_invoice_required": p.get("supplier_type") in ("Unregistered", "Foreign"),
            "self_invoice_due": str(si_due), "table": "4A(2)" if p.get("rcm_type") == "RCM_IMPORT_SERVICE" else "4A(3)",
        })
    return rows


def suggest(description, kb_obj=None):
    """Keyword-based RCM catalogue suggestion for free text."""
    text = (description or "").lower()
    scores = []
    for e in catalog():
        s = sum(1 for kw in e["keywords"] if kw in text)
        if s:
            scores.append((s, e["id"], e["title"]))
    return [{"id": i, "title": t, "score": s} for s, i, t in sorted(scores, reverse=True)[:3]]


if __name__ == "__main__":
    r = determine("RCM_LEGAL", {"sup": "yes", "biz": "yes", "turn": "yes"}, 50000)
    print(r["reason"], r["tax"], r["cgst"], r["sgst"])
    print(determine("RCM_RENT_COMM", {"sup": "yes", "reg": "yes", "comp": "yes"}, 60000)["reason"])
