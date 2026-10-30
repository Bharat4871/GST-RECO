"""Shared helpers: knowledge base loader, dates, money."""
import json
import os
import re
from datetime import date, timedelta
from functools import lru_cache

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
KB_PATH = os.path.join(ROOT, "knowledge", "gst_knowledge.json")
SEED_PATH = os.path.join(ROOT, "data", "seed.json")


@lru_cache(maxsize=1)
def kb() -> dict:
    with open(KB_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_seed() -> dict:
    with open(SEED_PATH, encoding="utf-8") as f:
        return json.load(f)


def d(s):
    """Parse ISO date (yyyy-mm-dd) -> date or None."""
    if not s:
        return None
    if isinstance(s, date):
        return s
    s = str(s).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return date(int(m[1]), int(m[2]), int(m[3]))
    m = re.match(r"^(\d{2})[-/](\d{2})[-/](\d{4})$", s)  # dd-mm-yyyy (portal)
    if m:
        return date(int(m[3]), int(m[2]), int(m[1]))
    return None


def fy_start_year(dt: date) -> int:
    return dt.year if dt.month >= 4 else dt.year - 1


def fy_label(dt: date) -> str:
    y = fy_start_year(dt)
    return f"{y}-{str(y + 1)[-2:]}"


def sec16_4_deadline(inv_date: date) -> date:
    """30 November following the end of the FY to which the invoice pertains."""
    return date(fy_start_year(inv_date) + 1, 11, 30)


def last_claim_period(inv_date: date) -> str:
    """Last GSTR-3B period whose due date (20th of next month) falls on/before 30-Nov: October."""
    return f"{fy_start_year(inv_date) + 1}-10"


def period_of(dt: date) -> str:
    return f"{dt.year}-{dt.month:02d}"


def add_months(period: str, n: int) -> str:
    y, m = map(int, period.split("-"))
    m += n
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    return f"{y}-{m:02d}"


def due_date_3b(period: str) -> date:
    """GSTR-3B (monthly) due date: 20th of the following month."""
    nxt = add_months(period, 1)
    y, m = map(int, nxt.split("-"))
    return date(y, m, 20)


def money(x) -> float:
    try:
        return round(float(x or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def tax_of(r: dict) -> float:
    return money(money(r.get("igst")) + money(r.get("cgst")) + money(r.get("sgst")) + money(r.get("cess")))


def norm_inv(s: str) -> str:
    """Normalise an invoice number: alphabetic and numeric tokens, leading zeros stripped."""
    toks = re.findall(r"[A-Z]+|\d+", (s or "").upper())
    return "".join(t.lstrip("0") or "0" if t.isdigit() else t for t in toks)


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def similarity(a: str, b: str) -> float:
    if not a and not b:
        return 1.0
    return 1 - levenshtein(a, b) / max(len(a), len(b))


def inr(x) -> str:
    """Indian digit grouping: 12,34,567.89"""
    x = money(x)
    neg = x < 0
    x = abs(x)
    whole, frac = f"{x:.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        whole = ",".join(parts + [tail])
    return ("-" if neg else "") + "₹" + whole + "." + frac


def kw_match(text: str, keyword: str) -> bool:
    return re.search(r"(?<![a-z0-9])" + re.escape(keyword.lower()) + r"(?![a-z0-9])", text.lower()) is not None
