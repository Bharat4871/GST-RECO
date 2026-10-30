"""Builds and executes notebooks/AI_ITC_RCM_Analysis.ipynb  (python notebooks/build_notebook.py)"""
import os

import nbformat as nbf
from nbclient import NotebookClient

HERE = os.path.dirname(os.path.abspath(__file__))
nb = nbf.v4.new_notebook()
md, code = nbf.v4.new_markdown_cell, nbf.v4.new_code_cell
nb.cells = [
    md("""# AI & GST: Input Tax Credit and Reverse Charge - model notebook
**ICAI Advanced IT project · GSTiQ**

This notebook documents the machine-learning side of the project on the dummy data of five CA-office clients:

1. Dataset overview and the rule engine's ITC classification
2. Expense classifier (TF-IDF + Logistic Regression) - eligible vs blocked u/s 17(5) vs reverse charge
3. Invoice anomaly detection (Isolation Forest + forensic rules)
4. Benford's law test on invoice values
5. Vendor risk scoring
6. ITC forecasting
7. GST Mitra retrieval chatbot

All code lives in `backend/`; the notebook only calls it, so results here are identical to the web app and the API."""),
    code("""import sys, os, json
sys.path.insert(0, os.path.abspath(os.path.join('..', 'backend')))
import pandas as pd, numpy as np, matplotlib.pyplot as plt
from common import load_seed, kb, tax_of
import recon_engine, itc_engine, rcm_engine, ai_engine
pd.set_option('display.width', 160); pd.set_option('display.max_columns', 20)
plt.rcParams.update({'figure.dpi': 110, 'axes.spines.top': False, 'axes.spines.right': False, 'font.size': 9})
data = load_seed()
P = pd.DataFrame(data['purchases']); B = pd.DataFrame(data['gstr2b']); Cl = pd.DataFrame(data['clients'])
P['gst'] = P[['igst','cgst','sgst','cess']].sum(axis=1)
print(f"{len(Cl)} clients, {len(data['vendors'])} vendors, {len(P)} purchase invoices, {len(B)} GSTR-2B records")"""),
    md("## 1. Dataset and rule-engine result"),
    code("""summary = P.groupby('client_id').agg(bills=('id','count'), taxable=('taxable_value','sum'), gst=('gst','sum'), rcm_bills=('reverse_charge', lambda s: (s=='Y').sum()))
summary.index = summary.index.map(Cl.set_index('id')['name'])
summary.round(0)"""),
    code("""rec = recon_engine.reconcile(data['purchases'], data['gstr2b'], data['vendors'])
ev = pd.DataFrame(itc_engine.evaluate_all(data, recon_results=rec))
status = ev.groupby('status_label').agg(bills=('id','count'), gst=('tax','sum')).sort_values('gst', ascending=False)
status['share_%'] = (status.gst / status.gst.sum() * 100).round(1)
status.round(0)"""),
    code("""fig, ax = plt.subplots(figsize=(7, 3.2))
status.gst.sort_values().plot.barh(ax=ax, color='#1d4d9c')
ax.set_xlabel('GST (₹)'); ax.set_title('Where input GST stands - all clients')
plt.tight_layout(); plt.show()"""),
    md("""## 2. Expense classifier
Ledger narrations are short and inconsistent ("Lorry frt", "freight paid to Sai Roadlines"). A TF-IDF representation of word n-grams and character n-grams feeds a multinomial Logistic Regression. Five-fold stratified cross-validation estimates accuracy on unseen sentences."""),
    code("""clf = ai_engine.ExpenseClassifier()
cv = clf.cross_validate(5); cv"""),
    code("""from sklearn.model_selection import cross_val_predict, StratifiedKFold
from sklearn.metrics import confusion_matrix, classification_report
X = [t for t, _ in kb()['corpus']]; y = [l for _, l in kb()['corpus']]
groups = {l: kb()['labels'][l]['group'] for l in set(y)}
pred = cross_val_predict(clf.model, X, y, cv=StratifiedKFold(5, shuffle=True, random_state=7))
yg, pg = [groups[a] for a in y], [groups[b] for b in pred]
print(classification_report(yg, pg, digits=3))
cm = confusion_matrix(yg, pg, labels=['eligible','blocked','rcm'])
fig, ax = plt.subplots(figsize=(3.6, 3.2)); ax.imshow(cm, cmap='Blues')
for i in range(3):
    for j in range(3): ax.text(j, i, cm[i, j], ha='center', va='center', color='white' if cm[i, j] > cm.max()/2 else 'black')
ax.set_xticks(range(3), ['eligible','blocked','rcm']); ax.set_yticks(range(3), ['eligible','blocked','rcm'])
ax.set_xlabel('predicted'); ax.set_ylabel('actual'); ax.set_title('Grouped confusion matrix (CV)'); plt.tight_layout(); plt.show()"""),
    code("""tests = ['Lorry freight paid for inward cotton bales', 'Diwali sweet boxes for dealers', 'AWS invoice for September',
         'Cement for new factory shed', 'Sitting fees to independent director', 'Printer cartridges for accounts']
pd.DataFrame([{'text': r['text'], 'prediction': r['name'], 'confidence': r['confidence'], 'because': ', '.join(r['because'])} for r in clf.predict(tests)])"""),
    code("""preds = clf.predict(list(P.description))
P['ai_group'] = [p['group'] for p in preds]
P['rule_blocked'] = ev.set_index('id').loc[P.id, 'rule_category'].str.startswith('BLK').values
agree = ((P.ai_group == 'blocked') == P.rule_blocked).mean()
print(f'AI vs rule engine agreement on blocked/not-blocked: {agree:.1%} of {len(P)} real register lines')"""),
    md("""## 3. Anomaly detection
Isolation Forest isolates observations with random splits; unusual bills are isolated in fewer splits. Features: log value, deviation from the vendor's mean, round-sum flag, Sunday date, days to payment, proximity to the ₹50,000 e-way bill threshold, rate and month-end. Forensic rules add near-duplicates (same vendor and amount within 10 days)."""),
    code("""an = pd.DataFrame(ai_engine.detect_anomalies(data['purchases']))
print(len(an), 'bills flagged')
an[['client_id','supplier_name','invoice_no','taxable_value','score','reasons']].head(12)"""),
    md("## 4. Benford's law"),
    code("""bf = ai_engine.benford(P.taxable_value.tolist())
fig, ax = plt.subplots(figsize=(6, 3))
ax.bar(range(1, 10), bf['observed'], color='#1d4d9c', label='observed')
ax.plot(range(1, 10), bf['expected'], 'o-', color='#a96c12', label="Benford")
ax.set_xticks(range(1, 10)); ax.set_ylabel('share'); ax.legend(); ax.set_title(f"First digits of {bf['n']} invoice values - {bf['verdict']}")
plt.tight_layout(); plt.show()
{k: bf[k] for k in ('chi_square', 'chi_critical_5pct', 'mad', 'verdict')}"""),
    md("## 5. Vendor risk scoring"),
    code("""vr = pd.DataFrame(ai_engine.vendor_risk(data['vendors'], data['purchases'], rec))
print(vr.grade.value_counts().sort_index().to_dict())
vr[['client_id','name','status','score','grade','missing_in_2b','itc_exposure','action']].head(10)"""),
    md("## 6. ITC forecast (TechNova Software Solutions)"),
    code("""c5 = P[(P.client_id=='C5') & (P.itc_claimed=='Y') & (P.claim_period>='2026-01')].groupby('claim_period').gst.sum()
fc = ai_engine.forecast_itc(list(c5.items()))
h = pd.DataFrame(fc['history']); f = pd.DataFrame(fc['forecast'])
fig, ax = plt.subplots(figsize=(7, 3))
ax.plot(h.period, h.value, 'o-', color='#1d4d9c', label='actual')
ax.plot(f.period, f.forecast, 'o--', color='#a96c12', label='forecast')
ax.fill_between(f.period, f.low, f.high, color='#a96c12', alpha=.15)
ax.set_title(f"ITC claimed per month (trend {fc['slope_per_month']:+,.0f} ₹/month, R² {fc['r2']})"); ax.legend(); plt.xticks(rotation=45); plt.tight_layout(); plt.show()
f"""),
    md("## 7. GST Mitra chatbot"),
    code("""bot = ai_engine.GSTMitra()
for q in ['Can I pay reverse charge from the credit ledger?', 'Is ITC available on a car?', 'What is the time limit to claim ITC?']:
    r = bot.ask(q); print(f"Q: {q}\\nA: {r['answer']}\\n   (matched '{r.get('matched_question')}', score {r['confidence']})\\n")"""),
    md("""## Conclusion
* The deterministic rule engine remains the authority for statutory decisions (Sections 16-17, Rules 36(4), 37, 37A, 42, 43).
* The AI layer adds value where data is unstructured or patterns matter: reading narrations, flagging unusual bills, ranking suppliers and forecasting cash.
* Classifier disagreements with the rule engine are surfaced for human review rather than auto-applied - the same "human in the loop" stance the GST department takes with BIFA/ADVAIT leads."""),
]
nb.metadata["kernelspec"] = {"name": "python3", "display_name": "Python 3", "language": "python"}
path = os.path.join(HERE, "AI_ITC_RCM_Analysis.ipynb")
NotebookClient(nb, timeout=300, kernel_name="python3", resources={"metadata": {"path": HERE}}).execute()
nbf.write(nb, path)
print("Executed and saved", path)
