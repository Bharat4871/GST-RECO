"""Pass helper: reads the PDF render of the report and maps each heading to its printed page number."""
import json, re, subprocess, sys
pdf, items_file, out = sys.argv[1], sys.argv[2], sys.argv[3]
txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout
pages = [re.sub(r"\s+", " ", p) for p in txt.split("\f")]
items = json.load(open(items_file))
def find_all(t):
    t = re.sub(r"\s+", " ", t)
    return [i for i, p in enumerate(pages) if t in p]
start = find_all("Chapter 1: Introduction")[-1]
res = {}
for lvl, t in items:
    hits = [i for i in find_all(t) if i >= start]
    if hits:
        res[t] = hits[0] - start + 1
json.dump(res, open(out, "w"), indent=0)
print(f"{len(res)}/{len(items)} headings located; body starts at PDF page {start + 1}; total pages {len(pages) - 1}")
