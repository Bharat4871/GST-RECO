"""
GSTiQ - Flask REST API + web server
===================================
    python backend/app.py            -> http://127.0.0.1:5000  (web app + API)

The web app works fully offline on its own; when it is served by this server
(or pointed at it in Settings) it also gets the Python AI engine (scikit-learn),
SQL database and Excel MIS exports.

Endpoints (JSON):
  GET  /api/health                     status, versions, model accuracy
  GET  /api/seed                       demo dataset
  POST /api/analyse   {data, client_id, period}      full pipeline (recon, ITC, RCM, 3B, AI)
  POST /api/reconcile {purchases, gstr2b, vendors, settings}
  POST /api/ai/classify   {texts: [...]}
  POST /api/ai/anomalies  {purchases: [...]}
  POST /api/ai/vendor-risk {vendors, purchases, gstr2b}
  POST /api/ai/forecast   {series: [[period, value], ...]}
  POST /api/chat          {q}
  POST /api/gstin/validate {gstin}
  POST /api/rcm/determine {entry_id, answers, value, inter_state}
  POST /api/setoff        {liability, credit, rcm, taxable_value}
  POST /api/report/excel  {data, client_id, period}  -> .xlsx download
  GET  /api/db/query?n=1..14            run analytical SQL from database/queries.sql
"""
import os
import sys
import traceback
from datetime import date

from flask import Flask, Response, jsonify, request, send_from_directory

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ai_engine  # noqa: E402
import database  # noqa: E402
import gstin_utils  # noqa: E402
import pipeline  # noqa: E402
import rcm_engine  # noqa: E402
import recon_engine  # noqa: E402
import report_generator  # noqa: E402
import returns_engine  # noqa: E402
from common import ROOT, kb, load_seed  # noqa: E402

APP_DIR = os.path.join(ROOT, "app")
app = Flask(__name__, static_folder=None)
_CV = {}


@app.after_request
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


@app.errorhandler(Exception)
def on_error(e):
    traceback.print_exc()
    return jsonify({"ok": False, "error": str(e)}), 400


def body():
    return request.get_json(force=True, silent=True) or {}


# ------------------------------------------------------------------ static web app
@app.route("/")
def index():
    return send_from_directory(APP_DIR, "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(APP_DIR, path)


# ------------------------------------------------------------------ API
@app.route("/api/health")
def health():
    if not _CV:
        _CV.update(pipeline.classifier().cross_validate())
    import sklearn
    return jsonify({"ok": True, "engine": "GSTiQ Python engine", "kb_version": kb()["meta"]["version"],
                    "law_as_on": kb()["meta"]["law_as_on"], "python": sys.version.split()[0], "sklearn": sklearn.__version__,
                    "classifier_cv": _CV})


@app.route("/api/seed")
def seed():
    return jsonify(load_seed())


@app.route("/api/analyse", methods=["POST", "OPTIONS"])
def analyse():
    if request.method == "OPTIONS":
        return "", 204
    b = body()
    data = b.get("data") or load_seed()
    res = pipeline.run(data, b.get("client_id") or data["clients"][0]["id"], b.get("period"),
                       date.fromisoformat(b["as_on"]) if b.get("as_on") else None)
    return jsonify({"ok": True, **res})


@app.route("/api/reconcile", methods=["POST", "OPTIONS"])
def reconcile():
    if request.method == "OPTIONS":
        return "", 204
    b = body()
    res = recon_engine.reconcile(b.get("purchases", []), b.get("gstr2b", []), b.get("vendors", []), b.get("settings"))
    return jsonify({"ok": True, "results": res, "summary": recon_engine.summary(res)})


@app.route("/api/ai/classify", methods=["POST", "OPTIONS"])
def classify():
    if request.method == "OPTIONS":
        return "", 204
    texts = body().get("texts", [])[:2000]
    return jsonify({"ok": True, "model": "TF-IDF (word+char) + Logistic Regression", "predictions": pipeline.classifier().predict(texts)})


@app.route("/api/ai/anomalies", methods=["POST", "OPTIONS"])
def anomalies():
    if request.method == "OPTIONS":
        return "", 204
    p = body().get("purchases", [])
    return jsonify({"ok": True, "model": "Isolation Forest (300 trees) + forensic rules", "anomalies": ai_engine.detect_anomalies(p),
                    "benford": ai_engine.benford([float(x["taxable_value"]) for x in p])})


@app.route("/api/ai/vendor-risk", methods=["POST", "OPTIONS"])
def vendor_risk():
    if request.method == "OPTIONS":
        return "", 204
    b = body()
    rec = recon_engine.reconcile(b.get("purchases", []), b.get("gstr2b", []), b.get("vendors", []))
    return jsonify({"ok": True, "vendors": ai_engine.vendor_risk(b.get("vendors", []), b.get("purchases", []), rec)})


@app.route("/api/ai/forecast", methods=["POST", "OPTIONS"])
def forecast():
    if request.method == "OPTIONS":
        return "", 204
    s = [tuple(x) for x in body().get("series", [])]
    return jsonify({"ok": True, "model": "Linear trend (scikit-learn) blended with 3-month moving average", **(ai_engine.forecast_itc(s) or {})})


@app.route("/api/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return "", 204
    return jsonify({"ok": True, **pipeline.mitra().ask(body().get("q", ""))})


@app.route("/api/gstin/validate", methods=["POST", "OPTIONS"])
def gstin():
    if request.method == "OPTIONS":
        return "", 204
    return jsonify({"ok": True, **gstin_utils.validate(body().get("gstin", ""), kb()["states"])})


@app.route("/api/rcm/determine", methods=["POST", "OPTIONS"])
def rcm_determine():
    if request.method == "OPTIONS":
        return "", 204
    b = body()
    r = rcm_engine.determine(b["entry_id"], b.get("answers", {}), b.get("value", 0), b.get("inter_state", False))
    r.pop("entry", None)
    return jsonify({"ok": True, **r})


@app.route("/api/setoff", methods=["POST", "OPTIONS"])
def setoff():
    if request.method == "OPTIONS":
        return "", 204
    b = body()
    return jsonify({"ok": True, **returns_engine.setoff(b.get("liability", {}), b.get("credit", {}), b.get("rcm"), b.get("taxable_value", 0))})


@app.route("/api/report/excel", methods=["POST", "GET", "OPTIONS"])
def excel():
    if request.method == "OPTIONS":
        return "", 204
    b = body() if request.method == "POST" else {}
    data = b.get("data") or load_seed()
    cid = b.get("client_id") or request.args.get("client") or data["clients"][0]["id"]
    res = pipeline.run(data, cid, b.get("period") or request.args.get("period"))
    wb = report_generator.build_workbook(res["client"], res["evaluations"], res["recon"], res["rcm"], res["gstr3b"],
                                         res["vendor_risk"], [p for p in data["purchases"] if p["client_id"] == cid],
                                         data.get("as_on"), data.get("firm"))
    fname = f"GSTiQ_MIS_{res['client']['name'].split()[0]}_{res['period']}.xlsx"
    return Response(report_generator.to_bytes(wb),
                    mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f"attachment; filename={fname}"})


@app.route("/api/db/query")
def db_query():
    if not os.path.exists(database.DB_PATH):
        database.build()
    con = database.connect()
    res = database.run_queries(con)
    n = request.args.get("n")
    if n:
        res = [res[int(n) - 1]]
    return jsonify({"ok": True, "queries": res})


if __name__ == "__main__":
    if not os.path.exists(database.DB_PATH):
        database.build()
    port = int(os.environ.get("PORT", "5000"))
    print("\n  GSTiQ is running ->  http://127.0.0.1:%d\n" % port)
    app.run(host="127.0.0.1", port=port, debug=False)
