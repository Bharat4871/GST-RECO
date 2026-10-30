"""Imports sample_new_client (Excel + portal JSON) through the real web-app UI and checks every planted error is caught.
Run: python tests/test_import_new_client.py   (needs: pip install playwright)"""
import glob, json, sys
from playwright.sync_api import sync_playwright
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
X = glob.glob(R + "/sample_new_client/*.xlsx")[0]; J = glob.glob(R + "/sample_new_client/*.json")[0]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + R + "/OPEN_ME_GSTiQ_App.html#data"); pg.wait_for_timeout(1500)
    def imp(kind, path, sheet=None, cl=None):
        pg.goto("file://" + R + "/OPEN_ME_GSTiQ_App.html#dashboard"); pg.wait_for_timeout(300)
        pg.evaluate("location.hash='#data'"); pg.wait_for_timeout(800)
        pg.select_option("#kind", kind)
        if cl: pg.select_option("#cl", cl)
        pg.set_input_files("#file", path); pg.wait_for_timeout(800)
        if sheet: pg.click(f"button[data-s]:has-text('{sheet}')"); pg.wait_for_timeout(500)
        if pg.locator("#go").count(): pg.click("#go"); pg.wait_for_timeout(500)
        pg.wait_for_timeout(300); print(kind, "|", pg.evaluate("document.querySelector('.modal')?.innerText?.slice(0,300) || ('NO MODAL: '+document.querySelector('#mapper')?.innerText.slice(0,300)+' toast:'+(document.querySelector('.toast')||{}).innerText)"))
        if not pg.locator("#imp").count(): return
        pg.click("#imp"); pg.wait_for_timeout(500)
    imp("clients", X, "Client Master")
    imp("purchases", X, "Purchase Register", "C6")
    imp("purchases", J, None, "C6")
    out = pg.evaluate("""() => { const a = GSTEngine.analyse(GSTApp.DB, 'C6', GSTApp.asOn());
      const st = {}; a.evals.forEach(e => st[e.status] = (st[e.status]||0)+1);
      return {client: a.client.name, P: a.P.length, B: a.B.length, recon: a.reconSum, status: st, rcm: a.rcm.length, totals: a.totals}; }""")
    print({k:v['count'] for k,v in out['recon'].items()})
    rows = pg.evaluate('''() => { const a = GSTEngine.analyse(GSTApp.DB, 'C6', GSTApp.asOn()); return a.P.map(p => [p.id, p.invoice_no, (a.reconByPr[p.id]||{}).status, a.evalMap[p.id].status, (a.evalMap[p.id].flags||[]).map(f=>f.code).join(',')]); }''')
    for r in rows: print(r)
    for v in ["recon", "itc", "rcm", "gstr3b", "ai-lab"]:
        pg.evaluate(f"location.hash='#{v}'"); pg.wait_for_timeout(700)
    print("JS errors:", errs)
    st = {r[0]: (r[2], r[3]) for r in rows}
    exp = {"GP/PUR/028": "MISMATCH_VALUE", "GP/PUR/030": "MISMATCH_DATE", "GP/PUR/031": "GSTIN_MISMATCH", "GP/PUR/032": "MISSING_IN_2B", "GP/PUR/037": "DUPLICATE_IN_BOOKS"}
    bad = [k for k, v in exp.items() if st[k][0] != v]
    bad += [k for k in ["GP/PUR/039", "GP/PUR/040", "GP/PUR/041", "GP/PUR/042", "GP/PUR/043"] if st[k][1] != "BLOCKED"]
    bad += [] if st["GP/PUR/048"][1] == "RCM_UNPAID" else ["GP/PUR/048"]
    assert len(rows) == 49 and out["B"] == 44 and not errs and not bad, bad
    print("New-client import test passed - 49 bills, 44 GSTR-2B rows, every planted error detected.")
