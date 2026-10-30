"""
GSTiQ AI engine (scikit-learn)
==============================
1. ExpenseClassifier   TF-IDF (word + char n-grams) + Logistic Regression
                       -> Eligible / Blocked u/s 17(5) heads / RCM heads, with explanation
2. AnomalyDetector     Isolation Forest on engineered invoice features + forensic rules
                       (duplicates, round sums, threshold splitting, weekend bills)
3. benford()           First-digit Benford's law test (chi-square + MAD, Nigrini bands)
4. vendor_risk()       Transparent weighted risk score (0-100) with factor contributions
5. forecast_itc()      Linear trend + seasonal-naive blend, 3-month forecast with band
6. GSTMitra            Retrieval chatbot (TF-IDF cosine) over the GST knowledge base
"""
import math
from collections import Counter, defaultdict
from datetime import date

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import FeatureUnion, Pipeline

from common import d, kb, money, tax_of


# ---------------------------------------------------------------------------
# 1. Expense classifier
# ---------------------------------------------------------------------------
class ExpenseClassifier:
    def __init__(self):
        k = kb()
        self.labels = k["labels"]
        texts = [t for t, _ in k["corpus"]]
        y = [lbl for _, lbl in k["corpus"]]
        self.features = FeatureUnion([
            ("word", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
            ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, min_df=1)),
        ])
        self.model = Pipeline([("tfidf", self.features), ("clf", LogisticRegression(max_iter=3000, C=8.0))])
        self.model.fit(texts, y)
        self._texts, self._y = texts, y

    def cross_validate(self, folds=5):
        cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=7)
        pipe = Pipeline([("tfidf", FeatureUnion([
            ("word", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
            ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True))])),
            ("clf", LogisticRegression(max_iter=3000, C=8.0))])
        scores = cross_val_score(pipe, self._texts, self._y, cv=cv, scoring="accuracy")
        return {"folds": folds, "mean_accuracy": round(float(scores.mean()), 4), "std": round(float(scores.std()), 4),
                "scores": [round(float(s), 4) for s in scores], "samples": len(self._texts), "classes": len(set(self._y))}

    def explain(self, text, label, top=4):
        """Top contributing word features for the predicted class (linear model -> coef x tfidf)."""
        vec = self.model.named_steps["tfidf"].transformer_list[0][1]
        clf = self.model.named_steps["clf"]
        X = vec.transform([text])
        n_word = len(vec.vocabulary_)
        ci = list(clf.classes_).index(label)
        coefs = clf.coef_[ci][:n_word]
        inv = {i: w for w, i in vec.vocabulary_.items()}
        contrib = [(inv[j], float(X[0, j] * coefs[j])) for j in X.nonzero()[1]]
        return [w for w, c in sorted(contrib, key=lambda x: -x[1])[:top] if c > 0]

    def predict(self, texts, top=3):
        probs = self.model.predict_proba(texts)
        classes = list(self.model.named_steps["clf"].classes_)
        out = []
        for t, pr in zip(texts, probs):
            order = np.argsort(pr)[::-1][:top]
            best = classes[order[0]]
            out.append({
                "text": t, "label": best, "name": self.labels[best]["name"], "group": self.labels[best]["group"],
                "ref": self.labels[best]["ref"], "confidence": round(float(pr[order[0]]), 4),
                "alternatives": [{"label": classes[i], "name": self.labels[classes[i]]["name"], "p": round(float(pr[i]), 4)} for i in order[1:]],
                "because": self.explain(t, best),
            })
        return out


# ---------------------------------------------------------------------------
# 2. Anomaly detection
# ---------------------------------------------------------------------------
def _features(p, vstats):
    tv = money(p["taxable_value"])
    dt = d(p["invoice_date"])
    pay = d(p.get("payment_date"))
    mean, std = vstats.get(p["vendor_id"], (tv, 0))
    z = (tv - mean) / std if std > 0 else 0.0
    return [
        math.log10(tv + 1),
        z,
        1.0 if tv >= 10000 and tv % 10000 == 0 else 0.0,
        1.0 if dt and dt.weekday() == 6 else 0.0,
        float((pay - dt).days) if pay and dt else 200.0,
        1.0 if 47500 <= tv + tax_of(p) < 50000 else 0.0,
        float(p.get("rate", 0)),
        1.0 if dt and dt.day >= 28 else 0.0,
    ]


def detect_anomalies(purchases, contamination=0.04, seed=42):
    rows = [p for p in purchases if money(p["taxable_value"]) > 0]
    if len(rows) < 20:
        return []
    by_v = defaultdict(list)
    for p in rows:
        by_v[p["vendor_id"]].append(money(p["taxable_value"]))
    vstats = {v: (float(np.mean(x)), float(np.std(x))) for v, x in by_v.items()}
    X = np.array([_features(p, vstats) for p in rows])
    iso = IsolationForest(n_estimators=300, contamination=contamination, random_state=seed)
    iso.fit(X)
    scores = -iso.score_samples(X)  # higher = more anomalous
    lo, hi = float(scores.min()), float(scores.max())
    out = {}
    names = ["value", "vendor_z", "round", "sunday", "pay_days", "eway_split", "rate", "month_end"]
    pred = iso.predict(X)
    for p, x, s, pr in zip(rows, X, scores, pred):
        strong, support = [], []
        if abs(x[1]) >= 3:
            strong.append(f"Value is {x[1]:+.1f}σ from this vendor's usual bills")
        if x[5] and not str(p.get("hsn_sac", "")).startswith("99"):
            strong.append("Goods invoice just below ₹50,000 e-way bill threshold (possible splitting)")
        if x[2]:
            support.append("Round-sum invoice value")
        if x[3]:
            support.append("Invoice dated on a Sunday")
        reasons = strong + (support if (strong or pr == -1) else [])
        if pr == -1 or strong:
            out[p["id"]] = {"id": p["id"], "client_id": p["client_id"], "supplier_name": p["supplier_name"],
                            "invoice_no": p["invoice_no"], "taxable_value": money(p["taxable_value"]),
                            "score": round((s - lo) / (hi - lo + 1e-9), 3), "isolation_outlier": bool(pr == -1),
                            "reasons": reasons or ["Unusual combination of value, timing and payment pattern (Isolation Forest)"]}
    # Forensic rule: same vendor, same amount within 10 days (possible duplicate with new number)
    seen = defaultdict(list)
    for p in rows:
        seen[(p["vendor_id"], round(money(p["taxable_value"])))].append(p)
    for (_, _), group in seen.items():
        if len(group) > 1:
            group.sort(key=lambda r: r["invoice_date"])
            for a, b in zip(group, group[1:]):
                if (d(b["invoice_date"]) - d(a["invoice_date"])).days <= 10:
                    o = out.setdefault(b["id"], {"id": b["id"], "client_id": b["client_id"], "supplier_name": b["supplier_name"],
                                                 "invoice_no": b["invoice_no"], "taxable_value": money(b["taxable_value"]),
                                                 "score": 0.9, "isolation_outlier": False, "reasons": []})
                    o["reasons"].append(f"Same vendor and amount as {a['invoice_no']} within 10 days")
                    o["score"] = max(o["score"], 0.9)
    return sorted(out.values(), key=lambda r: -r["score"])


# ---------------------------------------------------------------------------
# 3. Benford's law
# ---------------------------------------------------------------------------
BENFORD = [math.log10(1 + 1 / dg) for dg in range(1, 10)]


def benford(values):
    firsts = [int(str(int(abs(v))).lstrip("0")[0]) for v in values if abs(v) >= 10]
    n = len(firsts)
    if n == 0:
        return None
    cnt = Counter(firsts)
    obs = [cnt.get(dg, 0) / n for dg in range(1, 10)]
    chi = sum(((cnt.get(dg, 0) - n * e) ** 2) / (n * e) for dg, e in zip(range(1, 10), BENFORD))
    mad = sum(abs(o - e) for o, e in zip(obs, BENFORD)) / 9
    # Nigrini first-digit MAD bands
    verdict = ("Close conformity" if mad < 0.006 else "Acceptable conformity" if mad < 0.012 else
               "Marginal conformity" if mad < 0.015 else "Nonconformity - investigate")
    return {"n": n, "observed": [round(o, 4) for o in obs], "expected": [round(e, 4) for e in BENFORD],
            "chi_square": round(chi, 3), "chi_critical_5pct": 15.507, "mad": round(mad, 4), "verdict": verdict}


# ---------------------------------------------------------------------------
# 4. Vendor risk (shared weights with the web app)
# ---------------------------------------------------------------------------
RISK_WEIGHTS = {"cancelled": 30, "gstr1_delay": 20, "gstr3b_delay": 20, "missing_2b": 15, "mismatch": 5, "new_reg": 5, "late_days": 5}


def vendor_risk(vendors, purchases, recon, as_on=None):
    as_on = as_on or date.fromisoformat(kb()["meta"]["law_as_on"])
    pv = defaultdict(list)
    for p in purchases:
        pv[p["vendor_id"]].append(p)
    rstat = {r["pr_id"]: r["status"] for r in recon if r["pr_id"]}
    out = []
    for v in vendors:
        inv = pv.get(v["id"], [])
        if not inv:
            continue
        exp = [p for p in inv if rstat.get(p["id"]) not in (None, "NOT_APPLICABLE")]
        miss = sum(1 for p in exp if rstat.get(p["id"]) == "MISSING_IN_2B")
        mism = sum(1 for p in exp if rstat.get(p["id"]) in ("MISMATCH_VALUE", "MISMATCH_DATE", "GSTIN_MISMATCH"))
        regd = d(v.get("reg_date"))
        f = {
            "cancelled": 1.0 if v["status"] != "Active" else 0.0,
            "gstr1_delay": max(0.0, 1 - float(v.get("gstr1_rate") or 1)) / 0.6,
            "gstr3b_delay": max(0.0, 1 - float(v.get("gstr3b_rate") or 1)) / 0.6,
            "missing_2b": miss / len(exp) if exp else 0.0,
            "mismatch": mism / len(exp) if exp else 0.0,
            "new_reg": 1.0 if regd and (as_on - regd).days < 365 else 0.0,
            "late_days": min(1.0, float(v.get("avg_delay") or 0) / 45),
        }
        if not v.get("gstin"):
            continue
        contrib = {k: round(RISK_WEIGHTS[k] * min(1.0, val), 2) for k, val in f.items()}
        score = round(sum(contrib.values()), 1)
        grade = "A" if score < 15 else "B" if score < 30 else "C" if score < 50 else "D"
        tax = round(sum(tax_of(p) for p in inv), 2)
        out.append({"vendor_id": v["id"], "client_id": v["client_id"], "name": v["name"], "gstin": v["gstin"], "status": v["status"],
                    "score": score, "grade": grade, "contributions": contrib, "invoices": len(inv), "itc_exposure": tax,
                    "missing_in_2b": miss, "action": {"A": "Routine", "B": "Monitor monthly", "C": "Follow up before claiming ITC",
                                                      "D": "Hold payment / insist on compliance"}[grade]})
    return sorted(out, key=lambda r: -r["score"])


# ---------------------------------------------------------------------------
# 5. Forecast
# ---------------------------------------------------------------------------
def forecast_itc(series, horizon=3):
    """series: list of (period, value) sorted. Linear trend blended with 3-month moving average."""
    if len(series) < 4:
        return None
    y = np.array([v for _, v in series], dtype=float)
    X = np.arange(len(y)).reshape(-1, 1)
    lr = LinearRegression().fit(X, y)
    fitted = lr.predict(X)
    resid = float(np.std(y - fitted))
    ma = float(np.mean(y[-3:]))
    last = series[-1][0]
    out = []
    y0, m0 = map(int, last.split("-"))
    for h in range(1, horizon + 1):
        m = m0 + h
        yy = y0 + (m - 1) // 12
        mm = (m - 1) % 12 + 1
        trend = float(lr.predict([[len(y) - 1 + h]])[0])
        val = max(0.0, 0.6 * trend + 0.4 * ma)
        out.append({"period": f"{yy}-{mm:02d}", "forecast": round(val, 2), "low": round(max(0, val - 1.64 * resid), 2),
                    "high": round(val + 1.64 * resid, 2)})
    r2 = float(lr.score(X, y))
    return {"history": [{"period": p, "value": round(v, 2)} for p, v in series], "forecast": out,
            "slope_per_month": round(float(lr.coef_[0]), 2), "r2": round(r2, 3), "resid_std": round(resid, 2)}


# ---------------------------------------------------------------------------
# 6. Chatbot
# ---------------------------------------------------------------------------
class GSTMitra:
    def __init__(self):
        k = kb()
        self.kb = k["chatbot_kb"]
        docs = [f"{x['q']} {x['q']} {x['a']}" for x in self.kb]
        self.vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english")
        self.M = self.vec.fit_transform(docs)

    def ask(self, question, top=3):
        sims = cosine_similarity(self.vec.transform([question]), self.M)[0]
        order = np.argsort(sims)[::-1][:top]
        best = order[0]
        if sims[best] < 0.08:
            return {"answer": "I could not find this in my ITC/RCM knowledge base. Try asking about Sec 16 conditions, "
                              "17(5) blocked credits, RCM services, Rule 37/42/43, GSTR-2B/IMS or set-off.",
                    "confidence": round(float(sims[best]), 3), "related": [self.kb[i]["q"] for i in order[:top]]}
        return {"answer": self.kb[best]["a"], "matched_question": self.kb[best]["q"], "confidence": round(float(sims[best]), 3),
                "related": [self.kb[i]["q"] for i in order[1:]]}


if __name__ == "__main__":
    clf = ExpenseClassifier()
    print(clf.cross_validate())
    for r in clf.predict(["Freight paid to Shree Roadlines for inward raw material",
                          "Diwali sweet boxes for dealers", "AWS invoice for September", "Cement for new factory shed"]):
        print(r["name"], r["confidence"], r["because"])
    print(GSTMitra().ask("can I pay reverse charge using credit ledger?")["answer"][:120])
