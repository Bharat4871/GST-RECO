"""
Returns engine: GSTR-3B builder (Tables 3.1 & 4 per Circular 170/02/2022-GST),
Rule 42 / Rule 43 common-credit reversal, ITC set-off (Sec 49/49A/49B, Rule 88A),
Rule 86B check, Rule 88D (DRC-01C) check and Sec 50 interest.
"""
from datetime import date, timedelta

from common import add_months, d, kb, money, period_of, tax_of
from itc_engine import block_exception, rule_category
from rcm_engine import register as rcm_register

HEADS = ("igst", "cgst", "sgst", "cess")


def _z():
    return {h: 0.0 for h in HEADS}


def _add(acc, r, sign=1):
    for h in HEADS:
        acc[h] = round(acc[h] + sign * money(r.get(h)), 2)


def _sum(acc):
    return round(sum(acc[h] for h in HEADS), 2)


def rcm_itc_period(row):
    """Return the GSTR-3B period in which ITC of RCM paid is taken."""
    if not row["paid_date"]:
        return None
    pd_ = d(row["paid_date"])
    q = add_months(period_of(pd_), -1) if pd_.day <= 20 else period_of(pd_)
    return max(row["liability_period"], q)


def rule42(data, client_id, period, non_business_common=False):
    k = kb()
    client = next(c for c in data["clients"] if c["id"] == client_id)
    sale = next((s for s in data["sales"] if s["client_id"] == client_id and s["period"] == period), None)
    T = T1 = T2 = T3 = T4 = C2 = 0.0
    for p in data["purchases"]:
        if p["client_id"] != client_id or p["category"] == "Capital Goods" or not p["invoice_date"].startswith(period):
            continue
        t = tax_of(p)
        if t <= 0:
            continue
        T += t
        code, _ = rule_category(p, client)
        blocked = code and not block_exception(code, p, client)
        if p["usage"] == "Personal":
            T1 += t
        elif p["usage"] == "Exempt":
            T2 += t
        elif blocked:
            T3 += t
        elif p["usage"] == "Common":
            C2 += t
        else:
            T4 += t
    E = money(sale["exempt"]) + money(sale["nil_rated"]) + money(sale["non_gst"]) if sale else 0.0
    F = (money(sale["taxable_intra"]) + money(sale["taxable_inter"]) + money(sale["zero_rated"]) + E) if sale else 0.0
    C1 = T - (T1 + T2 + T3)
    D1 = round(C2 * E / F, 2) if F else 0.0
    D2 = round(C2 * 0.05, 2) if non_business_common else 0.0
    C3 = round(C2 - D1 - D2, 2)
    return {"period": period, "T": round(T, 2), "T1": round(T1, 2), "T2": round(T2, 2), "T3": round(T3, 2),
            "C1": round(C1, 2), "T4": round(T4, 2), "C2": round(C2, 2), "E": round(E, 2), "F": round(F, 2),
            "ratio": round(E / F, 6) if F else 0, "D1": D1, "D2": D2, "C3": C3, "reversal": round(D1 + D2, 2),
            "eligible_total": round(T4 + C3, 2)}


def rule43(data, client_id, period):
    sale = next((s for s in data["sales"] if s["client_id"] == client_id and s["period"] == period), None)
    E = money(sale["exempt"]) + money(sale["nil_rated"]) + money(sale["non_gst"]) if sale else 0.0
    F = (money(sale["taxable_intra"]) + money(sale["taxable_inter"]) + money(sale["zero_rated"]) + E) if sale else 0.0
    items, Tm_total, Te_total = [], 0.0, 0.0
    for p in data["purchases"]:
        if p["client_id"] != client_id or p["category"] != "Capital Goods" or p["usage"] != "Common":
            continue
        acq = p["invoice_date"][:7]
        if acq > period:
            continue
        months_used = (int(period[:4]) - int(acq[:4])) * 12 + int(period[5:]) - int(acq[5:])
        if months_used >= 60:
            continue
        A = tax_of(p)
        Tm = round(A / 60, 2)
        Te = round(Tm * E / F, 2) if F else 0.0
        Tm_total += Tm
        Te_total += Te
        items.append({"id": p["id"], "description": p["description"], "acquired": acq, "itc": A, "Tm": Tm, "Te": Te,
                      "months_remaining": 60 - months_used})
    return {"period": period, "E": E, "F": F, "ratio": round(E / F, 6) if F else 0, "items": items,
            "Tm": round(Tm_total, 2), "Te": round(Te_total, 2)}


def gstr3b(data, client_id, period, evals, recon, as_on=None):
    as_on = as_on or date.fromisoformat(kb()["meta"]["law_as_on"])
    ev = {e["id"]: e for e in evals}
    pmap = {p["id"]: p for p in data["purchases"]}
    sale = next((s for s in data["sales"] if s["client_id"] == client_id and s["period"] == period), None)
    t = {}
    t["3.1(a)"] = {"value": (money(sale["taxable_intra"]) + money(sale["taxable_inter"])) if sale else 0.0,
                   "igst": money(sale["out_igst"]) if sale else 0.0, "cgst": money(sale["out_cgst"]) if sale else 0.0,
                   "sgst": money(sale["out_sgst"]) if sale else 0.0, "cess": 0.0}
    t["3.1(b)"] = {"value": money(sale["zero_rated"]) if sale else 0.0, **_z()}
    t["3.1(c)"] = {"value": (money(sale["exempt"]) + money(sale["nil_rated"])) if sale else 0.0, **_z()}
    t["3.1(e)"] = {"value": money(sale["non_gst"]) if sale else 0.0, **_z()}

    rcm = [r for r in rcm_register(data["purchases"], as_on, client_id)]
    d31 = {"value": 0.0, **_z()}
    for r in rcm:
        if r["liability_period"] == period:
            d31["value"] = round(d31["value"] + r["taxable_value"], 2)
            _add(d31, r)
    t["3.1(d)"] = d31

    a2, a3, a5, b1, b2, d1, d2 = _z(), _z(), _z(), _z(), _z(), _z(), _z()
    detail = {"4A(2)": [], "4A(3)": [], "4A(5)": [], "4B(1)": [], "4B(2)": [], "4D(1)": [], "4D(2)": []}
    for r in rcm:
        if rcm_itc_period(r) != period:
            continue
        tgt = a2 if r["table"] == "4A(2)" else a3
        _add(tgt, r)
        detail[r["table"]].append(r["id"])
        e = ev.get(r["id"])
        if e and e["status"] == "BLOCKED":
            _add(b1, r)
            detail["4B(1)"].append(r["id"])

    rmap_b = {x["b2b_id"]: x for x in recon if x["b2b_id"]}
    for b in data["gstr2b"]:
        if b["client_id"] != client_id or b["return_period"] != period or b["reverse_charge"] == "Y":
            continue
        if b["ims_action"] in ("Rejected", "Pending"):
            continue
        if b["itc_available"] == "N":
            _add(d2, b)
            detail["4D(2)"].append(b["id"])
            continue
        _add(a5, b)
        detail["4A(5)"].append(b["id"])
        rr = rmap_b.get(b["id"])
        if not rr or rr["status"] == "MISSING_IN_BOOKS" or not rr["pr_id"]:
            _add(b2, b)
            detail["4B(2)"].append(b["id"])
            continue
        e = ev.get(rr["pr_id"])
        if not e:
            continue
        if e["status"] in ("BLOCKED", "NO_ITC"):
            _add(b1, b)
            detail["4B(1)"].append(b["id"])
        elif e["status"] in ("TIME_BARRED",):
            _add(b1, b)
            _add(d2, b)
            detail["4D(2)"].append(b["id"])
        elif e["status"] in ("DEFERRED", "INELIGIBLE", "DUPLICATE"):
            _add(b2, b)
            detail["4B(2)"].append(b["id"])

    # Rule 37 reversals falling due in this period & Rule 37A in October return; reclaims (4D(1))
    for p in data["purchases"]:
        if p["client_id"] != client_id or p["reverse_charge"] == "Y" or tax_of(p) <= 0 or p.get("itc_claimed") != "Y":
            continue
        inv = d(p["invoice_date"])
        pay = d(p.get("payment_date"))
        lapse = inv + timedelta(days=181)
        if period_of(lapse) == period and (pay is None or pay > lapse) and lapse <= as_on + timedelta(days=31):
            _add(b2, p)
            detail["4B(2)"].append(p["id"])
        if pay and (pay - inv).days > 180 and period_of(pay) == period:
            _add(d1, p)
            detail["4D(1)"].append(p["id"])
        e = ev.get(p["id"])
        if e and any(f["code"] == "RULE_37A" for f in e["flags"]):
            fy_end = inv.year + (1 if inv.month >= 4 else 0)
            if period == f"{fy_end}-10":
                _add(b2, p)
                detail["4B(2)"].append(p["id"])

    r42 = rule42(data, client_id, period)
    r43 = rule43(data, client_id, period)
    rev42_43 = round(r42["reversal"] + r43["Te"], 2)
    if rev42_43:
        # split reversal across heads in proportion of 4A(5) heads (approximation for presentation)
        base = _sum(a5) or 1
        for h in ("igst", "cgst", "sgst"):
            b1[h] = round(b1[h] + rev42_43 * (a5[h] / base), 2)

    A = _z()
    for x in (a2, a3, a5):
        for h in HEADS:
            A[h] = round(A[h] + x[h], 2)
    # Note: 4D(1) reclaimed ITC is reported in 4A(5) as per Circular 170; add it to A
    for h in HEADS:
        A[h] = round(A[h] + d1[h], 2)
    B = {h: round(b1[h] + b2[h], 2) for h in HEADS}
    C = {h: round(A[h] - B[h], 2) for h in HEADS}
    t.update({"4A(1)": _z(), "4A(2)": a2, "4A(3)": a3, "4A(4)": _z(), "4A(5)": {h: round(a5[h] + d1[h], 2) for h in HEADS},
              "4B(1)": b1, "4B(2)": b2, "4C": C, "4D(1)": d1, "4D(2)": d2})

    claimed = _z()
    for p in data["purchases"]:
        if p["client_id"] == client_id and p.get("itc_claimed") == "Y" and p.get("claim_period") == period:
            _add(claimed, p)
    drc = drc01c(_sum(claimed), _sum(a5) + _sum(a2) + _sum(a3))
    return {"client_id": client_id, "period": period, "tables": t, "detail": detail, "rule42": r42, "rule43": r43,
            "rule42_43_reversal": rev42_43, "net_itc": _sum(C), "itc_claimed_in_books": claimed,
            "itc_claimed_total": _sum(claimed), "difference": round(_sum(claimed) - _sum(C), 2), "drc01c": drc,
            "due_date": f"{add_months(period, 1)}-20"}


def drc01c(claimed, available):
    k = kb()["dates"]
    excess = round(claimed - available, 2)
    pct = (excess / available * 100) if available else (100.0 if excess > 0 else 0.0)
    risk = excess > k["drc01c_amount"] and pct > k["drc01c_percent"]
    return {"claimed": claimed, "available": available, "excess": excess, "excess_pct": round(pct, 2), "risk": risk,
            "threshold_amount": k["drc01c_amount"], "threshold_pct": k["drc01c_percent"]}


def setoff(liability, credit, rcm_cash=None, taxable_value=0.0):
    """Optimal utilisation of ITC under Sec 49/49A/49B & Rule 88A.
    liability, credit: dicts with igst/cgst/sgst. Returns utilisation matrix and cash payable."""
    L = {h: money(liability.get(h)) for h in ("igst", "cgst", "sgst")}
    Cr = {h: max(0.0, money(credit.get(h))) for h in ("igst", "cgst", "sgst")}
    use = {f"{a}->{b}": 0.0 for a in ("igst", "cgst", "sgst") for b in ("igst", "cgst", "sgst")}
    steps = []
    for h in ("igst", "cgst", "sgst"):  # reversal exceeding credit (negative 4C) is added to output liability
        if money(credit.get(h)) < 0:
            L[h] = round(L[h] - money(credit.get(h)), 2)
            steps.append({"from": "REVERSAL", "to": h.upper(), "amount": round(-money(credit.get(h)), 2),
                          "rule": "Net ITC negative (reversal > credit) - added to output tax liability"})

    def apply(src, dst, amt, why):
        amt = round(min(amt, Cr[src], L[dst]), 2)
        if amt > 0:
            Cr[src] = round(Cr[src] - amt, 2)
            L[dst] = round(L[dst] - amt, 2)
            use[f"{src}->{dst}"] = round(use[f"{src}->{dst}"] + amt, 2)
            steps.append({"from": src.upper(), "to": dst.upper(), "amount": amt, "rule": why})

    apply("igst", "igst", L["igst"], "Sec 49(5)(a): IGST credit first against IGST")
    need_c = max(0.0, L["cgst"] - Cr["cgst"])
    need_s = max(0.0, L["sgst"] - Cr["sgst"])
    apply("igst", "cgst", need_c, "Rule 88A: balance IGST credit against CGST (shortfall first)")
    apply("igst", "sgst", need_s, "Rule 88A: balance IGST credit against SGST (shortfall first)")
    apply("igst", "cgst", L["cgst"], "Sec 49A: IGST credit must be exhausted before CGST/SGST credit")
    apply("igst", "sgst", L["sgst"], "Sec 49A: IGST credit must be exhausted before CGST/SGST credit")
    apply("cgst", "cgst", L["cgst"], "Sec 49(5)(b): CGST credit against CGST")
    apply("cgst", "igst", L["igst"], "Sec 49(5)(b): balance CGST credit against IGST")
    apply("sgst", "sgst", L["sgst"], "Sec 49(5)(c)/(d): SGST credit against SGST")
    apply("sgst", "igst", L["igst"], "Sec 49(5)(d): balance SGST credit against IGST")
    cash = {h: round(L[h], 2) for h in L}
    rc = {h: money((rcm_cash or {}).get(h)) for h in ("igst", "cgst", "sgst")}
    total_liab = sum(money(liability.get(h)) + max(0.0, -money(credit.get(h))) for h in ("igst", "cgst", "sgst"))
    out = {"utilisation": use, "steps": steps, "cash_output": cash, "cash_rcm": rc,
           "cash_total": round(sum(cash.values()) + sum(rc.values()), 2), "credit_carried_forward": Cr,
           "rule86b": None}
    if taxable_value > kb()["dates"]["rule86b_turnover"] and total_liab > 0:
        min_cash = round(total_liab * 0.01, 2)
        paid_cash = round(sum(cash.values()), 2)
        out["rule86b"] = {"applicable": True, "min_cash": min_cash, "cash_paid": paid_cash, "shortfall": round(max(0, min_cash - paid_cash), 2),
                          "note": "Taxable value > ₹50 lakh in the month: at least 1% of output tax in cash unless an exception in Rule 86B proviso applies."}
    return out


def interest_sec50(amount, from_date, to_date, rate=18.0):
    days = max(0, (d(to_date) - d(from_date)).days)
    return {"amount": money(amount), "days": days, "rate": rate, "interest": round(money(amount) * rate / 100 * days / 365, 2)}
