"""
Build script
  python tools/build.py
    1. rebuilds the knowledge base (knowledge/build_knowledge.py)
    2. writes dist/GSTiQ_Standalone.html - ONE file, everything inlined, works offline by double-click
    3. writes dist/GSTiQ_artifact.html  - same app for hosted preview (libraries from jsDelivr)
"""
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP = os.path.join(ROOT, "app")
DIST = os.path.join(ROOT, "dist")
CDN = {
    "vendor/chart.umd.min.js": "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js",
    "vendor/xlsx.full.min.js": "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
}


def read(rel):
    with open(os.path.join(APP, rel), encoding="utf-8") as f:
        return f.read()


def safe_js(s):
    return s.replace("</script", "<\\/script")


def build():
    subprocess.run([sys.executable, os.path.join(ROOT, "knowledge", "build_knowledge.py")], check=True)
    html = read("index.html")
    css = read("css/styles.css")
    scripts = re.findall(r'<script src="([^"]+)"></script>', html)
    os.makedirs(DIST, exist_ok=True)

    # ---- 1. offline standalone (full document)
    import base64
    fonts_css = read("css/fonts.css")
    fonts_css = re.sub(r"url\(\.\./fonts/([^)]+)\)", lambda m: "url(data:font/woff2;base64," + base64.b64encode(open(os.path.join(APP, "fonts", m.group(1)), "rb").read()).decode() + ")", fonts_css)
    out = html.replace('<link rel="stylesheet" href="css/fonts.css">', f"<style>\n{fonts_css}\n</style>")
    out = re.sub(r'<link rel="preconnect"[^>]*>\n?', "", out)
    out = re.sub(r'<link rel="stylesheet" href="https://fonts[^>]+>\n?', "", out)
    out = re.sub(r'<link rel="stylesheet" href="css/styles.css">', lambda m: f"<style>\n{css}\n</style>", out)
    for src in scripts:
        out = out.replace(f'<script src="{src}"></script>', f"<script>/* {src} */\n{safe_js(read(src))}\n</script>", 1)
    with open(os.path.join(DIST, "GSTiQ_Standalone.html"), "w", encoding="utf-8") as f:
        f.write(out)

    # ---- 2. hosted artifact (page content only: title + style first, libraries from CDN)
    fonts = re.search(r'<link rel="stylesheet" href="https://fonts[^>]+>', html).group(0)
    body = ['<title>GSTiQ ITC &amp; RCM Suite</title>', '<meta name="claude:viewport-fit-sides" content="cover">',
            f"<style>\n{css}\n</style>", fonts, '<div id="app"><p style="padding:24px">Loading GSTiQ…</p></div>']
    for src in scripts:
        if src in CDN:
            body.append(f'<script src="{CDN[src]}"></script>')
        else:
            body.append(f"<script>/* {src} */\n{safe_js(read(src))}\n</script>")
    with open(os.path.join(DIST, "GSTiQ_artifact.html"), "w", encoding="utf-8") as f:
        f.write("\n".join(body) + "\n")
    for n in ("GSTiQ_Standalone.html", "GSTiQ_artifact.html"):
        print(f"  dist/{n}  {os.path.getsize(os.path.join(DIST, n)) / 1024:,.0f} KB")


if __name__ == "__main__":
    build()
