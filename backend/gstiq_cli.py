"""
GSTiQ command-line tool - batch ITC & RCM review for every client of the CA office.

Examples
  python backend/gstiq_cli.py                       # summary for all clients
  python backend/gstiq_cli.py --client C2 --period 2026-08 --excel
  python backend/gstiq_cli.py --classify "Freight paid to Sai Roadlines"
  python backend/gstiq_cli.py --ask "Is RCM applicable on rent from unregistered landlord?"
  python backend/gstiq_cli.py --gstin 24AABCS1234F1Z5
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import gstin_utils  # noqa: E402
import pipeline  # noqa: E402
import report_generator  # noqa: E402
from common import ROOT, inr, kb, load_seed  # noqa: E402


def line(ch="-", n=96):
    print(ch * n)


def client_report(data, cid, period, excel):
    r = pipeline.run(data, cid, period)
    t = r["totals"]
    c = r["client"]
    line("=")
    print(f" {c['name']}  |  {c['gstin']}  |  {c['business']}")
    line("=")
    print(f" {'Total GST on inward supplies':40s}{inr(t['tax']):>22s}")
    for k, lbl in (("eligible_itc", "Eligible ITC"), ("blocked_itc", "Blocked u/s 17(5)"), ("at_risk_itc", "At risk (2B / Rule 37 / 37A)"),
                   ("deferred_itc", "Deferred (not received / RCM unpaid)"), ("lapsed_itc", "Lapsed u/s 16(4)"),
                   ("wrongly_claimed", "Claimed but not eligible now")):
        print(f" {lbl:40s}{inr(t[k]):>22s}")
    line()
    print(" Reconciliation:", ", ".join(f"{k.replace('_', ' ').title()} {v['count']}" for k, v in r["recon_summary"].items()))
    g = r["gstr3b"]
    if g:
        print(f" GSTR-3B {g['period']}: net ITC {inr(g['net_itc'])} | claimed in books {inr(g['itc_claimed_total'])} | "
              f"DRC-01C risk: {'YES' if g['drc01c']['risk'] else 'no'}")
        so = r["setoff"]
        print(f" Cash payable after set-off: {inr(so['cash_total'])} (incl. RCM {inr(sum(so['cash_rcm'].values()))})")
    hi = [v for v in r["vendor_risk"] if v["grade"] in ("C", "D")]
    print(f" High-risk vendors: {len(hi)}  " + "; ".join(f"{v['name']} ({v['score']})" for v in hi[:4]))
    print(f" Anomalies flagged by AI: {len(r['anomalies'])} | Benford: {r['benford']['verdict'] if r['benford'] else 'n/a'}")
    print(f" AI classifier agreement with rule engine (blocked vs not): {r['ai_agreement']:.1%}")
    if excel:
        out = os.path.join(ROOT, "output")
        os.makedirs(out, exist_ok=True)
        wb = report_generator.build_workbook(c, r["evaluations"], r["recon"], r["rcm"], g, r["vendor_risk"],
                                             [p for p in data["purchases"] if p["client_id"] == cid], data.get("as_on"), data.get("firm"))
        fn = os.path.join(out, f"GSTiQ_MIS_{cid}_{g['period']}.xlsx")
        wb.save(fn)
        print(f" Excel MIS saved -> {fn}")


def main():
    ap = argparse.ArgumentParser(description="GSTiQ ITC & RCM batch review")
    ap.add_argument("--client")
    ap.add_argument("--period")
    ap.add_argument("--excel", action="store_true")
    ap.add_argument("--classify")
    ap.add_argument("--ask")
    ap.add_argument("--gstin")
    a = ap.parse_args()
    if a.gstin:
        print(gstin_utils.validate(a.gstin, kb()["states"]))
        return
    if a.classify:
        for p in pipeline.classifier().predict([a.classify]):
            print(f"{p['name']}  ({p['confidence']:.0%})  ref {p['ref']}  because: {', '.join(p['because'])}")
        return
    if a.ask:
        r = pipeline.mitra().ask(a.ask)
        print(r["answer"])
        return
    data = load_seed()
    ids = [a.client] if a.client else [c["id"] for c in data["clients"]]
    for cid in ids:
        client_report(data, cid, a.period, a.excel)


if __name__ == "__main__":
    main()
