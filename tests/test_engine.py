"""Unit tests for the GST rules (run: python -m unittest discover tests  or  python tests/test_engine.py)"""
import os
import sys
import unittest
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

import gstin_utils  # noqa: E402
import itc_engine  # noqa: E402
import rcm_engine  # noqa: E402
import recon_engine  # noqa: E402
import returns_engine  # noqa: E402
from common import last_claim_period, norm_inv, sec16_4_deadline  # noqa: E402

CLIENT = {"id": "T", "nature": "Manufacturer", "business": "Textiles", "state": "24"}


def bill(**kw):
    base = {"id": "X1", "client_id": "T", "vendor_id": "V", "supplier_gstin": gstin_utils.make_gstin("24", "AABCS1234F"), "supplier_name": "Test Supplier",
            "supplier_type": "Regular", "supplier_state": "24", "invoice_no": "INV/1", "invoice_date": "2026-09-10", "receipt_date": "2026-09-11",
            "hsn_sac": "5402", "description": "Polyester yarn", "expense_head": "Raw material", "category": "Inputs", "pos": "24", "taxable_value": 100000,
            "rate": 5, "igst": 0, "cgst": 2500, "sgst": 2500, "cess": 0, "reverse_charge": "N", "rcm_type": "", "rcm_paid_date": "", "self_invoice_no": "",
            "itc_claimed": "Y", "claim_period": "2026-09", "payment_date": "2026-10-01", "usage": "Taxable"}
    base.update(kw)
    return base


MATCHED = {"status": "MATCHED", "ims_action": "Accepted", "itc_available": "Y", "supplier_3b_filed": "Y", "return_period": "2026-09", "label": "Matched"}
AS_ON = date(2026, 10, 29)


class GSTIN(unittest.TestCase):
    def test_checksum_roundtrip(self):
        g = gstin_utils.make_gstin("27", "AAACR5055K")
        self.assertTrue(gstin_utils.validate(g)["valid"])
        bad = g[:-1] + ("0" if g[-1] != "0" else "1")
        self.assertFalse(gstin_utils.validate(bad)["valid"])

    def test_format(self):
        self.assertFalse(gstin_utils.validate("24ABC")["valid"])


class TimeLimits(unittest.TestCase):
    def test_sec16_4(self):
        self.assertEqual(sec16_4_deadline(date(2026, 3, 31)), date(2026, 11, 30))   # FY 2025-26
        self.assertEqual(sec16_4_deadline(date(2026, 4, 1)), date(2027, 11, 30))    # FY 2026-27
        self.assertEqual(last_claim_period(date(2025, 12, 5)), "2026-10")

    def test_invoice_normalisation(self):
        self.assertEqual(norm_inv("INV/26-27/045"), norm_inv("inv-2627-45"))


class ITC(unittest.TestCase):
    def ev(self, p, recon=MATCHED, vendor=None):
        return itc_engine.evaluate(p, CLIENT, recon, vendor or {"status": "Active"}, AS_ON)

    def test_eligible(self):
        self.assertEqual(self.ev(bill())["status"], "ELIGIBLE")

    def test_motor_car_blocked(self):
        e = self.ev(bill(hsn_sac="8703", description="Motor car for director", rate=40, cgst=20000, sgst=20000))
        self.assertEqual(e["status"], "BLOCKED")
        self.assertIn("17(5)(a)", e["blocked_ref"])

    def test_works_contract_exception(self):
        e = self.ev(bill(hsn_sac="2523", description="Cement for client project", usage="Project-WC", rate=18, cgst=9000, sgst=9000))
        self.assertNotEqual(e["status"], "BLOCKED")

    def test_not_in_2b(self):
        e = self.ev(bill(), {"status": "MISSING_IN_2B", "note": ""})
        self.assertEqual(e["status"], "NOT_IN_2B")
        self.assertTrue(any(f["code"] == "EXCESS_CLAIM" for f in e["flags"]))

    def test_rule_37(self):
        e = self.ev(bill(invoice_date="2026-03-01", receipt_date="2026-03-02", payment_date="", claim_period="2026-03"))
        self.assertEqual(e["status"], "REVERSE_37")

    def test_time_barred(self):
        e = self.ev(bill(invoice_date="2025-02-10", receipt_date="2025-02-11", itc_claimed="N", claim_period=""))
        self.assertEqual(e["status"], "TIME_BARRED")

    def test_rule_37a(self):
        r = dict(MATCHED, supplier_3b_filed="N")
        e = self.ev(bill(invoice_date="2026-01-10", receipt_date="2026-01-11", claim_period="2026-01", payment_date="2026-02-01"), r)
        self.assertEqual(e["status"], "REVERSE_37A")

    def test_gst2_rate_flag(self):
        e = self.ev(bill(rate=12, cgst=6000, sgst=6000))
        self.assertTrue(any(f["code"] == "RATE_INVALID" for f in e["flags"]))

    def test_rcm_unpaid(self):
        e = self.ev(bill(reverse_charge="Y", rcm_type="RCM_LEGAL", supplier_gstin="", supplier_type="Unregistered", hsn_sac="998212",
                         description="Advocate fees", rate=18, cgst=9000, sgst=9000), {"status": "NOT_APPLICABLE"})
        self.assertEqual(e["status"], "RCM_UNPAID")


class RCM(unittest.TestCase):
    def test_legal_applies(self):
        r = rcm_engine.determine("RCM_LEGAL", {"sup": "yes", "biz": "yes", "turn": "yes"}, 50000)
        self.assertTrue(r["rcm"])
        self.assertEqual((r["cgst"], r["sgst"]), (4500.0, 4500.0))

    def test_legal_small_entity_exempt(self):
        self.assertFalse(rcm_engine.determine("RCM_LEGAL", {"sup": "yes", "biz": "yes", "turn": "no"}, 50000)["rcm"])

    def test_composition_tenant_excluded(self):
        self.assertFalse(rcm_engine.determine("RCM_RENT_COMM", {"sup": "yes", "reg": "yes", "comp": "yes"}, 60000)["rcm"])

    def test_gta_rate(self):
        r = rcm_engine.determine("RCM_GTA", {"fcm": "no", "rec": "registered"}, 100000, inter_state=True)
        self.assertEqual(r["igst"], 5000.0)

    def test_time_of_supply_services(self):
        tos, basis = rcm_engine.time_of_supply({"invoice_date": "2026-07-01", "payment_date": "2026-10-15", "receipt_date": "", "rcm_type": "RCM_LEGAL"})
        self.assertEqual(tos, date(2026, 8, 30))          # 61st day beats later payment
        self.assertIn("13(3)(b)", basis)


class Returns(unittest.TestCase):
    def test_setoff_textbook(self):
        so = returns_engine.setoff({"igst": 1500, "cgst": 600, "sgst": 600}, {"igst": 1000, "cgst": 300, "sgst": 500})
        self.assertEqual(so["cash_output"], {"igst": 500.0, "cgst": 300.0, "sgst": 100.0})

    def test_igst_used_before_cgst(self):
        so = returns_engine.setoff({"igst": 0, "cgst": 1000, "sgst": 1000}, {"igst": 1200, "cgst": 1000, "sgst": 0})
        # IGST must go first; best order sends it to SGST (shortfall) leaving CGST credit for CGST
        self.assertEqual(so["cash_total"], 0.0)
        self.assertEqual(so["utilisation"]["igst->sgst"], 1000.0)

    def test_negative_credit_added_to_liability(self):
        so = returns_engine.setoff({"igst": 100, "cgst": 0, "sgst": 0}, {"igst": -50, "cgst": 0, "sgst": 0})
        self.assertEqual(so["cash_output"]["igst"], 150.0)

    def test_drc01c(self):
        self.assertTrue(returns_engine.drc01c(4000000, 1000000)["risk"])
        self.assertFalse(returns_engine.drc01c(1100000, 1000000)["risk"])


class Recon(unittest.TestCase):
    def test_fuzzy_and_missing(self):
        g = gstin_utils.make_gstin("24", "AABCS1234F")
        books = [bill(id="A", invoice_no="INV/0451/26-27"), bill(id="B", invoice_no="ZZ/1")]
        twob = [{"id": "b1", "client_id": "T", "return_period": "2026-09", "supplier_gstin": g, "supplier_name": "Test", "invoice_no": "INV-451-2627",
                 "invoice_date": "2026-09-10", "taxable_value": 100000, "igst": 0, "cgst": 2500, "sgst": 2500, "cess": 0, "ims_action": "Accepted",
                 "itc_available": "Y", "supplier_3b_filed": "Y", "reverse_charge": "N"}]
        res = {r["pr_id"] or r["b2b_id"]: r["status"] for r in recon_engine.reconcile(books, twob)}
        self.assertIn(res["A"], ("MATCHED", "MATCHED_FUZZY"))
        self.assertEqual(res["B"], "MISSING_IN_2B")


if __name__ == "__main__":
    unittest.main(verbosity=1)
