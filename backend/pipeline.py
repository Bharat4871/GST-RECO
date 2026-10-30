"""Runs every engine for one client and returns a single result object (used by the CLI, Flask API and tests)."""
from datetime import date

import ai_engine
import itc_engine
import rcm_engine
import recon_engine
import returns_engine
from common import kb, tax_of

_CLASSIFIER = None
_MITRA = None


def classifier():
    global _CLASSIFIER
    if _CLASSIFIER is None:
        _CLASSIFIER = ai_engine.ExpenseClassifier()
    return _CLASSIFIER


def mitra():
    global _MITRA
    if _MITRA is None:
        _MITRA = ai_engine.GSTMitra()
    return _MITRA


def subset(data, client_id):
    if not client_id:
        return data
    return {
        "firm": data.get("firm", {}), "as_on": data.get("as_on"),
        "clients": [c for c in data["clients"] if c["id"] == client_id],
        "vendors": [v for v in data["vendors"] if v["client_id"] == client_id],
        "purchases": [p for p in data["purchases"] if p["client_id"] == client_id],
        "gstr2b": [b for b in data["gstr2b"] if b["client_id"] == client_id],
        "sales": [s for s in data["sales"] if s["client_id"] == client_id],
    }


def run(data, client_id, period=None, as_on=None, with_ai=True):
    as_on = as_on or date.fromisoformat(data.get("as_on") or kb()["meta"]["law_as_on"])
    sd = subset(data, client_id)
    client = sd["clients"][0]
    recon = recon_engine.reconcile(sd["purchases"], sd["gstr2b"], sd["vendors"])
    evals = itc_engine.evaluate_all(sd, recon_results=recon, as_on=as_on)
    rcm = rcm_engine.register(sd["purchases"], as_on)
    periods = sorted({s["period"] for s in sd["sales"]})
    period = period or (periods[-1] if periods else None)
    g3b = returns_engine.gstr3b(sd, client_id, period, evals, recon, as_on) if period else None
    out = {"client": client, "period": period, "periods": periods, "recon": recon, "recon_summary": recon_engine.summary(recon),
           "evaluations": evals, "totals": itc_engine.totals(evals), "rcm": rcm, "gstr3b": g3b}
    if g3b:
        t = g3b["tables"]
        out["setoff"] = returns_engine.setoff(t["3.1(a)"], t["4C"], t["3.1(d)"], t["3.1(a)"]["value"])
    if with_ai:
        out["vendor_risk"] = ai_engine.vendor_risk(sd["vendors"], sd["purchases"], recon, as_on)
        out["anomalies"] = ai_engine.detect_anomalies(sd["purchases"])
        out["benford"] = ai_engine.benford([float(p["taxable_value"]) for p in sd["purchases"]])
        monthly = {}
        for p in sd["purchases"]:
            if p.get("itc_claimed") == "Y" and p.get("claim_period", "") >= "2026-01":
                monthly[p["claim_period"]] = monthly.get(p["claim_period"], 0) + tax_of(p)
        out["forecast"] = ai_engine.forecast_itc(sorted(monthly.items()))
        preds = classifier().predict([p["description"] for p in sd["purchases"]])
        agree = sum(1 for p, pr, e in zip(sd["purchases"], preds, evals)
                    if (pr["group"] == "blocked") == (e["status"] == "BLOCKED" or e["rule_category"].startswith("BLK")))
        out["ai_agreement"] = round(agree / max(1, len(preds)), 4)
    return out
