"""
GSTIN utilities - validation, checksum generation and decoding.

GSTIN structure (15 characters):
  [0:2]   State code              e.g. 24 = Gujarat
  [2:12]  PAN of the taxpayer     e.g. AABCS1234F (4th char = holder type)
  [12]    Entity number           1-9, A-Z (registrations under same PAN in a state)
  [13]    'Z' by default
  [14]    Check digit             Luhn mod-36 over the first 14 characters
"""
import re

CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$")
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")


def checksum(first14: str) -> str:
    """Return the GSTIN check character for the first 14 characters (Luhn mod 36)."""
    factor, total, mod = 2, 0, len(CHARSET)
    for ch in reversed(first14.upper()):
        addend = factor * CHARSET.index(ch)
        factor = 1 if factor == 2 else 2
        total += addend // mod + addend % mod
    return CHARSET[(mod - total % mod) % mod]


def validate(gstin: str, states=None) -> dict:
    """Validate a GSTIN. Returns dict(valid, errors, state_code, pan, holder_type)."""
    g = (gstin or "").strip().upper()
    errors = []
    if len(g) != 15:
        errors.append("GSTIN must be 15 characters")
    elif not GSTIN_RE.match(g):
        errors.append("Format must be 99AAAAA9999A9Z9")
    else:
        if checksum(g[:14]) != g[14]:
            errors.append(f"Check digit mismatch (expected {checksum(g[:14])})")
        if states is not None and g[:2] not in states:
            errors.append(f"Unknown state code {g[:2]}")
    return {
        "gstin": g, "valid": not errors, "errors": errors,
        "state_code": g[:2] if len(g) >= 2 else "",
        "pan": g[2:12] if len(g) >= 12 else "",
        "holder_type": g[5] if len(g) >= 6 else "",
    }


def make_gstin(state_code: str, pan: str, entity: str = "1") -> str:
    base = f"{state_code}{pan}{entity}Z"
    return base + checksum(base)


def same_pan(g1: str, g2: str) -> bool:
    return bool(g1 and g2 and len(g1) >= 12 and len(g2) >= 12 and g1[2:12] == g2[2:12])


if __name__ == "__main__":
    demo = make_gstin("24", "AABCS1234F")
    print(demo, validate(demo))
    print(validate(demo[:-1] + ("A" if demo[-1] != "A" else "B")))
