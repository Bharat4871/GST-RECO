"""
UI smoke test (Playwright + headless Chromium)
  python tests/ui_smoke_test.py [--shots]
Opens dist/GSTiQ_Standalone.html, visits every page, exercises the main interactions,
fails on any JavaScript error and (with --shots) saves screenshots to docs/screenshots/.
"""
import os
import sys

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
URL = "file://" + os.path.join(ROOT, "dist", "GSTiQ_Standalone.html")
SHOTS = os.path.join(ROOT, "docs", "screenshots")
VIEWS = ["dashboard", "clients", "purchases", "gstr2b", "vendors", "recon", "itc", "rule42", "rcm", "rcm-wizard", "gstr3b", "setoff",
         "interest", "ai-lab", "assistant", "reports", "knowledge", "data", "setup", "about"]


def main(shots=False):
    errors = []
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, accept_downloads=True)
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.goto(URL)
        page.wait_for_selector(".kpis", timeout=15000)

        def shot(name, full=False):
            if shots:
                page.wait_for_timeout(450)
                page.screenshot(path=os.path.join(SHOTS, f"{name}.png"), full_page=full)

        for v in VIEWS:
            page.evaluate(f"location.hash = '{v}'")
            page.wait_for_timeout(350)
            bad = page.locator(".notice.bad b", has_text="Something went wrong")
            if bad.count():
                errors.append(f"view {v}: render error - {page.locator('.notice.bad').inner_text()}")
            print(f"  ok  #{v:12s} {page.title()}")
            shot(f"{VIEWS.index(v) + 1:02d}_{v}")

        # --- interactions
        page.evaluate("location.hash='purchases'"); page.wait_for_timeout(300)
        page.locator("table.t tbody tr.clickable").first.click(); page.wait_for_selector(".drawer")
        shot("21_invoice_drawer"); page.keyboard.press("Escape")
        # invoice with flags: filter not-in-2B
        page.evaluate("location.hash='itc'"); page.wait_for_timeout(300)
        page.locator("table.t tbody tr.clickable").first.click(); page.wait_for_timeout(300)
        page.locator("table.t tbody tr.clickable").first.click(); page.wait_for_selector(".drawer")
        shot("22_invoice_drawer_flags"); page.keyboard.press("Escape")
        # RCM wizard: legal services
        page.evaluate("location.hash='rcm-wizard'"); page.wait_for_timeout(300)
        page.fill("#desc", "Legal fees paid to Adv. Mehta for GST appeal"); page.click("#sugg"); page.wait_for_timeout(200)
        for q in ("sup", "biz", "turn"):
            page.click(f'button[data-q="{q}"][data-v="yes"]'); page.wait_for_timeout(120)
        assert "Reverse charge applies" in page.inner_text("#wiz"), "wizard verdict missing"
        shot("23_rcm_wizard_verdict")
        # assistant
        page.evaluate("location.hash='assistant'"); page.wait_for_timeout(300)
        for q in ("Which invoices are missing in 2B?", "RCM on rent of 1.2 lakh to unregistered landlord", "What is Rule 37A?"):
            page.fill("#q", q); page.keyboard.press("Enter"); page.wait_for_timeout(200)
        shot("24_assistant_chat")
        # GSTR-3B drill-down
        page.evaluate("location.hash='gstr3b'"); page.wait_for_timeout(300)
        page.locator('td[data-cell="4A(5)"]').nth(1).click(); page.wait_for_timeout(250)
        shot("25_gstr3b_drilldown"); page.keyboard.press("Escape")
        # Self-invoice
        page.evaluate("location.hash='rcm'"); page.wait_for_timeout(300)
        if page.locator("button[data-si]").count():
            page.locator("button[data-si]").first.click(); page.wait_for_selector("#si-doc"); shot("26_self_invoice"); page.keyboard.press("Escape")
        # Portfolio view
        page.select_option("#client-select", "ALL") if page.evaluate("location.hash") == "#dashboard" else None
        page.evaluate("location.hash='dashboard'"); page.wait_for_timeout(300); page.select_option("#client-select", "ALL"); page.wait_for_timeout(400)
        shot("27_practice_overview"); page.select_option("#client-select", "C5"); page.wait_for_timeout(400)
        # Export (download)
        page.evaluate("location.hash='data'"); page.wait_for_timeout(300)
        with page.expect_download() as dl:
            page.click('button[data-x="purchases:xlsx"]')
        print("  ok  download", dl.value.suggested_filename)
        # Import CSV (first 15 rows of purchase register into C3)
        csvp = os.path.join(ROOT, "data", "purchase_register.csv")
        lines = open(csvp, encoding="utf-8").read().splitlines()[:16]
        tmp = os.path.join(ROOT, "output", "import_sample.csv"); os.makedirs(os.path.dirname(tmp), exist_ok=True)
        open(tmp, "w", encoding="utf-8").write("\n".join(lines).replace("Invoice", "Invoice"))
        page.select_option("#cl", "C3"); page.set_input_files("#file", tmp); page.wait_for_selector("#go"); shot("28_import_mapping")
        page.click("#go"); page.wait_for_selector("#imp"); page.click("#imp"); page.wait_for_timeout(300)
        assert "Imported" in page.inner_text("#mapper"), "import did not complete"
        print("  ok  import of", len(lines) - 1, "rows")
        # AI lab tabs
        page.evaluate("location.hash='ai-lab'"); page.wait_for_timeout(300)
        for t in ("anomaly", "benford", "risk", "forecast"):
            page.click(f'#atabs [data-tab="{t}"]'); page.wait_for_timeout(500); shot(f"29_ai_{t}")
        page.click('#atabs [data-tab="classify"]'); page.wait_for_timeout(300); page.click("#cv"); page.wait_for_timeout(500); shot("30_ai_model_card")
        # Dark mode + mobile
        page.evaluate("location.hash='dashboard'"); page.wait_for_timeout(300); page.click("#theme-btn"); page.wait_for_timeout(500); shot("31_dashboard_dark")
        page.click("#theme-btn"); page.wait_for_timeout(200)
        m = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        mp = m.new_page(); mp.on("pageerror", lambda e: errors.append(f"mobile pageerror: {e}"))
        mp.goto(URL + "#dashboard"); mp.wait_for_selector(".kpis")
        if shots:
            mp.wait_for_timeout(500); mp.screenshot(path=os.path.join(SHOTS, "32_mobile_dashboard.png"))
        sw = mp.evaluate("document.documentElement.scrollWidth"); cw = mp.evaluate("document.documentElement.clientWidth")
        if sw > cw + 1:
            errors.append(f"mobile horizontal overflow: {sw} > {cw}")
        b.close()
    errors = [e for e in errors if "fonts.g" not in e and "ERR_" not in e]
    if errors:
        print("\nERRORS:")
        for e in errors:
            print("  ", e)
        sys.exit(1)
    print("\nUI smoke test passed - no JavaScript errors.")


if __name__ == "__main__":
    main(shots="--shots" in sys.argv)
