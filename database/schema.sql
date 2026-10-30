-- =====================================================================
-- GSTiQ - ITC & RCM Compliance Suite : SQLite database schema
-- Normalised design for a CA office handling multiple GST clients.
-- =====================================================================
PRAGMA foreign_keys = ON;

DROP VIEW IF EXISTS v_itc_summary;
DROP VIEW IF EXISTS v_vendor_followup;
DROP VIEW IF EXISTS v_rcm_liability;
DROP VIEW IF EXISTS v_deadline_alerts;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS itc_evaluation;
DROP TABLE IF EXISTS recon_result;
DROP TABLE IF EXISTS sales_summary;
DROP TABLE IF EXISTS gstr2b;
DROP TABLE IF EXISTS purchase;
DROP TABLE IF EXISTS vendor;
DROP TABLE IF EXISTS client;
DROP TABLE IF EXISTS state;

CREATE TABLE state (
    code        TEXT PRIMARY KEY,                 -- '24'
    name        TEXT NOT NULL
);

CREATE TABLE client (
    id            TEXT PRIMARY KEY,               -- 'C1'
    name          TEXT NOT NULL,
    gstin         TEXT NOT NULL UNIQUE CHECK (length(gstin) = 15),
    pan           TEXT NOT NULL CHECK (length(pan) = 10),
    state         TEXT NOT NULL REFERENCES state(code),
    city          TEXT,
    constitution  TEXT,
    business      TEXT,
    nature        TEXT,
    turnover_cr   REAL,
    filing        TEXT CHECK (filing IN ('Monthly','QRMP')),
    partner       TEXT,
    email         TEXT,
    has_exempt    INTEGER DEFAULT 0
);

CREATE TABLE vendor (
    id            TEXT PRIMARY KEY,               -- 'V001'
    client_id     TEXT NOT NULL REFERENCES client(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    gstin         TEXT,                           -- blank for unregistered / foreign
    state         TEXT,
    type          TEXT CHECK (type IN ('Regular','Composition','Unregistered','SEZ','Foreign','Government','ISD')),
    kind          TEXT,
    status        TEXT DEFAULT 'Active',
    reg_date      TEXT,
    cancel_date   TEXT,
    gstr1_rate    REAL,                           -- share of GSTR-1 filed on time
    gstr3b_rate   REAL,
    avg_delay     INTEGER,
    einvoice      INTEGER,
    email         TEXT,
    phone         TEXT,
    country       TEXT
);

CREATE TABLE purchase (
    id               TEXT PRIMARY KEY,            -- 'PI-C1-0001'
    client_id        TEXT NOT NULL REFERENCES client(id) ON DELETE CASCADE,
    vendor_id        TEXT REFERENCES vendor(id),
    supplier_gstin   TEXT,
    supplier_name    TEXT NOT NULL,
    supplier_type    TEXT,
    supplier_state   TEXT,
    invoice_no       TEXT NOT NULL,
    invoice_date     TEXT NOT NULL,               -- ISO yyyy-mm-dd
    receipt_date     TEXT,
    hsn_sac          TEXT,
    description      TEXT,
    expense_head     TEXT,
    category         TEXT CHECK (category IN ('Inputs','Input Services','Capital Goods')),
    pos              TEXT,
    taxable_value    REAL NOT NULL CHECK (taxable_value >= 0),
    rate             REAL,
    igst             REAL DEFAULT 0,
    cgst             REAL DEFAULT 0,
    sgst             REAL DEFAULT 0,
    cess             REAL DEFAULT 0,
    invoice_value    REAL,
    reverse_charge   TEXT CHECK (reverse_charge IN ('Y','N')),
    rcm_type         TEXT,
    rcm_paid_date    TEXT,
    self_invoice_no  TEXT,
    itc_claimed      TEXT CHECK (itc_claimed IN ('Y','N')),
    claim_period     TEXT,                        -- 'yyyy-mm'
    payment_date     TEXT,
    amount_paid      REAL,
    usage            TEXT,
    irn              TEXT,
    remarks          TEXT
);
CREATE INDEX ix_purchase_client_date ON purchase(client_id, invoice_date);
CREATE INDEX ix_purchase_gstin_inv   ON purchase(supplier_gstin, invoice_no);

CREATE TABLE gstr2b (
    id                 TEXT PRIMARY KEY,
    client_id          TEXT NOT NULL REFERENCES client(id) ON DELETE CASCADE,
    return_period      TEXT NOT NULL,
    supplier_gstin     TEXT NOT NULL,
    supplier_name      TEXT,
    invoice_no         TEXT NOT NULL,
    invoice_date       TEXT,
    invoice_type       TEXT,
    pos                TEXT,
    taxable_value      REAL,
    rate               REAL,
    igst               REAL, cgst REAL, sgst REAL, cess REAL,
    invoice_value      REAL,
    reverse_charge     TEXT,
    itc_available      TEXT CHECK (itc_available IN ('Y','N')),
    reason             TEXT,
    gstr1_filing_date  TEXT,
    supplier_3b_filed  TEXT,
    ims_action         TEXT CHECK (ims_action IN ('Accepted','Rejected','Pending','No Action')),
    source             TEXT,
    irn                TEXT
);
CREATE INDEX ix_2b_client_period ON gstr2b(client_id, return_period);

CREATE TABLE sales_summary (
    client_id      TEXT NOT NULL REFERENCES client(id) ON DELETE CASCADE,
    period         TEXT NOT NULL,
    taxable_intra  REAL, taxable_inter REAL, zero_rated REAL, exempt REAL, nil_rated REAL, non_gst REAL,
    output_rate    REAL, out_igst REAL, out_cgst REAL, out_sgst REAL,
    PRIMARY KEY (client_id, period)
);

-- Results written back by the Python engines
CREATE TABLE recon_result (
    pr_id TEXT, b2b_id TEXT, client_id TEXT, status TEXT, label TEXT, confidence REAL, note TEXT,
    supplier_gstin TEXT, supplier_name TEXT, invoice_no TEXT, invoice_date TEXT,
    books_taxable REAL, books_tax REAL, b2b_taxable REAL, b2b_tax REAL, tax_diff REAL,
    return_period TEXT, ims_action TEXT, itc_available TEXT, supplier_3b_filed TEXT
);

CREATE TABLE itc_evaluation (
    id TEXT PRIMARY KEY REFERENCES purchase(id) ON DELETE CASCADE,
    client_id TEXT, status TEXT, status_label TEXT, tax REAL, eligible_itc REAL, blocked_itc REAL,
    at_risk_itc REAL, deferred_itc REAL, lapsed_itc REAL, wrongly_claimed REAL, rule_category TEXT,
    blocked_ref TEXT, recon_status TEXT, period TEXT, flags_json TEXT
);

CREATE TABLE audit_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts        TEXT DEFAULT (datetime('now','localtime')),
    actor     TEXT,
    action    TEXT,
    detail    TEXT
);

-- ---------------------------------------------------------------------
-- Views used by reports
-- ---------------------------------------------------------------------
CREATE VIEW v_itc_summary AS
SELECT c.id AS client_id, c.name AS client_name,
       COUNT(e.id)                       AS invoices,
       ROUND(SUM(e.tax), 2)              AS total_gst,
       ROUND(SUM(e.eligible_itc), 2)     AS eligible_itc,
       ROUND(SUM(e.blocked_itc), 2)      AS blocked_itc,
       ROUND(SUM(e.at_risk_itc), 2)      AS at_risk_itc,
       ROUND(SUM(e.lapsed_itc), 2)       AS lapsed_itc,
       ROUND(SUM(e.wrongly_claimed), 2)  AS wrongly_claimed
FROM client c LEFT JOIN itc_evaluation e ON e.client_id = c.id
GROUP BY c.id;

CREATE VIEW v_vendor_followup AS
SELECT r.client_id, r.supplier_gstin, r.supplier_name,
       COUNT(*)               AS invoices_missing,
       ROUND(SUM(r.books_tax), 2) AS itc_blocked,
       MIN(r.invoice_date)    AS oldest_invoice
FROM recon_result r
WHERE r.status = 'MISSING_IN_2B'
GROUP BY r.client_id, r.supplier_gstin, r.supplier_name;

CREATE VIEW v_rcm_liability AS
SELECT client_id, rcm_type, COUNT(*) AS bills,
       ROUND(SUM(taxable_value), 2) AS taxable,
       ROUND(SUM(igst + cgst + sgst), 2) AS rcm_tax,
       SUM(CASE WHEN rcm_paid_date IS NULL OR rcm_paid_date = '' THEN 1 ELSE 0 END) AS unpaid_bills
FROM purchase WHERE reverse_charge = 'Y'
GROUP BY client_id, rcm_type;

CREATE VIEW v_deadline_alerts AS
SELECT p.client_id, p.id, p.supplier_name, p.invoice_no, p.invoice_date,
       ROUND(p.igst + p.cgst + p.sgst + p.cess, 2) AS gst,
       CASE WHEN CAST(substr(p.invoice_date,6,2) AS INTEGER) >= 4
            THEN (CAST(substr(p.invoice_date,1,4) AS INTEGER) + 1) || '-11-30'
            ELSE substr(p.invoice_date,1,4) || '-11-30' END AS sec16_4_deadline
FROM purchase p
WHERE p.itc_claimed = 'N' AND (p.igst + p.cgst + p.sgst) > 0;
