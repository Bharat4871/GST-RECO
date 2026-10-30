"""
SQLite persistence layer.
  python backend/database.py            -> (re)build database/gstiq.db from data/seed.json and run engines
  python backend/database.py --queries  -> run every query in database/queries.sql and print results
"""
import json
import os
import sqlite3
import sys

from common import ROOT, kb, load_seed

DB_PATH = os.path.join(ROOT, "database", "gstiq.db")
SCHEMA = os.path.join(ROOT, "database", "schema.sql")
QUERIES = os.path.join(ROOT, "database", "queries.sql")

COLS = {
    "client": ["id", "name", "gstin", "pan", "state", "city", "constitution", "business", "nature", "turnover_cr", "filing",
               "partner", "email", "has_exempt"],
    "vendor": ["id", "client_id", "name", "gstin", "state", "type", "kind", "status", "reg_date", "cancel_date", "gstr1_rate",
               "gstr3b_rate", "avg_delay", "einvoice", "email", "phone", "country"],
    "purchase": ["id", "client_id", "vendor_id", "supplier_gstin", "supplier_name", "supplier_type", "supplier_state", "invoice_no",
                 "invoice_date", "receipt_date", "hsn_sac", "description", "expense_head", "category", "pos", "taxable_value", "rate",
                 "igst", "cgst", "sgst", "cess", "invoice_value", "reverse_charge", "rcm_type", "rcm_paid_date", "self_invoice_no",
                 "itc_claimed", "claim_period", "payment_date", "amount_paid", "usage", "irn", "remarks"],
    "gstr2b": ["id", "client_id", "return_period", "supplier_gstin", "supplier_name", "invoice_no", "invoice_date", "invoice_type",
               "pos", "taxable_value", "rate", "igst", "cgst", "sgst", "cess", "invoice_value", "reverse_charge", "itc_available",
               "reason", "gstr1_filing_date", "supplier_3b_filed", "ims_action", "source", "irn"],
    "sales_summary": ["client_id", "period", "taxable_intra", "taxable_inter", "zero_rated", "exempt", "nil_rated", "non_gst",
                      "output_rate", "out_igst", "out_cgst", "out_sgst"],
}


def connect(path=DB_PATH):
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def _insert(con, table, rows):
    cols = COLS[table]
    con.executemany(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
                    [[(int(r.get(c)) if isinstance(r.get(c), bool) else r.get(c)) for c in cols] for r in rows])


def build(data=None, path=DB_PATH, run_engines=True):
    data = data or load_seed()
    if os.path.exists(path):
        os.remove(path)
    con = connect(path)
    with open(SCHEMA, encoding="utf-8") as f:
        con.executescript(f.read())
    con.executemany("INSERT INTO state VALUES (?,?)", list(kb()["states"].items()))
    _insert(con, "client", data["clients"])
    _insert(con, "vendor", data["vendors"])
    _insert(con, "purchase", data["purchases"])
    _insert(con, "gstr2b", data["gstr2b"])
    _insert(con, "sales_summary", data["sales"])
    if run_engines:
        import itc_engine
        import recon_engine
        rec = recon_engine.reconcile(data["purchases"], data["gstr2b"], data["vendors"])
        rcols = ["pr_id", "b2b_id", "client_id", "status", "label", "confidence", "note", "supplier_gstin", "supplier_name", "invoice_no",
                 "invoice_date", "books_taxable", "books_tax", "b2b_taxable", "b2b_tax", "tax_diff", "return_period", "ims_action",
                 "itc_available", "supplier_3b_filed"]
        con.executemany(f"INSERT INTO recon_result ({','.join(rcols)}) VALUES ({','.join('?' * len(rcols))})",
                        [[r[c] for c in rcols] for r in rec])
        ev = itc_engine.evaluate_all(data, recon_results=rec)
        con.executemany("INSERT INTO itc_evaluation VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        [[e["id"], e["client_id"], e["status"], e["status_label"], e["tax"], e["eligible_itc"], e["blocked_itc"],
                          e["at_risk_itc"], e["deferred_itc"], e["lapsed_itc"], e["wrongly_claimed"], e["rule_category"],
                          e["blocked_ref"], e["recon_status"], e["period"], json.dumps(e["flags"])] for e in ev])
    con.execute("INSERT INTO audit_log(actor, action, detail) VALUES (?,?,?)",
                ("system", "BUILD", f"Loaded {len(data['purchases'])} purchases, {len(data['gstr2b'])} GSTR-2B rows"))
    con.commit()
    return con


def run_queries(con):
    with open(QUERIES, encoding="utf-8") as f:
        sql = f.read()
    blocks = [b.strip() for b in sql.split(";") if b.strip() and "SELECT" in b.upper()]
    results = []
    for b in blocks:
        title = next((ln.strip("- ").strip() for ln in b.splitlines() if ln.strip().startswith("-- Q")), "Query")
        body = "\n".join(ln for ln in b.splitlines() if not ln.strip().startswith("--"))
        cur = con.execute(body)
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        results.append({"title": title, "columns": cols, "rows": [list(r) for r in rows]})
    return results


if __name__ == "__main__":
    con = build()
    print("Database built:", DB_PATH)
    for t in ("client", "vendor", "purchase", "gstr2b", "sales_summary", "recon_result", "itc_evaluation"):
        print(f"  {t:16s} {con.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]:>6} rows")
    if "--queries" in sys.argv:
        for r in run_queries(con):
            print("\n=== " + r["title"] + f"  ({len(r['rows'])} rows)")
            print(" | ".join(r["columns"]))
            for row in r["rows"][:6]:
                print(" | ".join(str(x) for x in row))
