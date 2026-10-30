"""Cross-language test: the JavaScript engine (web app) and Python engine must agree on every invoice."""
import json
import os
import subprocess
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "backend"))

import itc_engine  # noqa: E402
import rcm_engine  # noqa: E402
import recon_engine  # noqa: E402
import returns_engine  # noqa: E402
from common import load_seed  # noqa: E402
from pipeline import subset  # noqa: E402


class CrossLanguage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        out = subprocess.run(["node", os.path.join(ROOT, "tests", "cross_check.js")], capture_output=True, text=True, check=True)
        cls.js = json.loads(out.stdout)
        cls.data = load_seed()

    def test_engines_agree(self):
        for c in self.data["clients"]:
            sd = subset(self.data, c["id"])
            rec = recon_engine.reconcile(sd["purchases"], sd["gstr2b"], sd["vendors"])
            ev = itc_engine.evaluate_all(sd, recon_results=rec)
            js = self.js[c["id"]]
            for r in rec:
                self.assertEqual(js["recon"][r["pr_id"] or r["b2b_id"]], r["status"], f"recon {r['pr_id'] or r['b2b_id']}")
            for e in ev:
                self.assertEqual(js["status"][e["id"]], e["status"], f"status {e['id']}")
                self.assertEqual(js["flags"][e["id"]], ",".join(sorted(f["code"] for f in e["flags"])), f"flags {e['id']}")
            t = itc_engine.totals(ev)
            for k in ("tax", "eligible_itc", "blocked_itc", "at_risk_itc", "lapsed_itc"):
                self.assertAlmostEqual(js["totals"][k], t[k], delta=0.05, msg=f"{c['id']} {k}")
            self.assertAlmostEqual(js["rcm_interest"], sum(r["interest"] for r in rcm_engine.register(sd["purchases"])), delta=0.05)
            for per, g in js["gstr3b"].items():
                py = returns_engine.gstr3b(sd, c["id"], per, ev, rec)
                self.assertAlmostEqual(g["net"], py["net_itc"], delta=0.1, msg=f"{c['id']} {per} net ITC")
                self.assertAlmostEqual(g["claimed"], py["itc_claimed_total"], delta=0.05)
                self.assertEqual(g["drc"], py["drc01c"]["risk"])
                for h in ("igst", "cgst", "sgst"):
                    self.assertAlmostEqual(g["d31"][h], py["tables"]["3.1(d)"][h], delta=0.05)
                    self.assertAlmostEqual(g["c4"][h], py["tables"]["4C"][h], delta=0.1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
