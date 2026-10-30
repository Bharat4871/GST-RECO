-- =====================================================================
-- GSTiQ - Analytical SQL queries for the CA office (SQLite 3.25+)
-- Run all:  python backend/database.py --queries
-- =====================================================================

-- Q1. Client-wise ITC position (uses view)
SELECT * FROM v_itc_summary ORDER BY eligible_itc DESC;

-- Q2. Month-wise ITC as per books vs GSTR-2B (per client) - CTE + full comparison
WITH books AS (
  SELECT client_id, substr(invoice_date,1,7) AS period,
         ROUND(SUM(igst+cgst+sgst+cess),2) AS books_itc
  FROM purchase WHERE reverse_charge='N' GROUP BY 1,2),
twob AS (
  SELECT client_id, return_period AS period,
         ROUND(SUM(igst+cgst+sgst+cess),2) AS gstr2b_itc
  FROM gstr2b WHERE ims_action IN ('Accepted','No Action') AND itc_available='Y' GROUP BY 1,2)
SELECT b.client_id, b.period, b.books_itc, IFNULL(t.gstr2b_itc,0) AS gstr2b_itc,
       ROUND(b.books_itc - IFNULL(t.gstr2b_itc,0),2) AS difference
FROM books b LEFT JOIN twob t ON t.client_id=b.client_id AND t.period=b.period
ORDER BY b.client_id, b.period;

-- Q3. Reconciliation status summary
SELECT client_id, label, COUNT(*) AS records, ROUND(SUM(books_tax),2) AS books_tax, ROUND(SUM(b2b_tax),2) AS b2b_tax
FROM recon_result GROUP BY client_id, label ORDER BY client_id, records DESC;

-- Q4. Top 10 vendors whose invoices are missing in GSTR-2B (follow-up list)
SELECT client_id, supplier_name, supplier_gstin, invoices_missing, itc_blocked, oldest_invoice
FROM v_vendor_followup ORDER BY itc_blocked DESC LIMIT 10;

-- Q5. Blocked credits u/s 17(5) by head (window function for share %)
SELECT client_id, blocked_ref, ROUND(SUM(blocked_itc),2) AS blocked,
       ROUND(100.0 * SUM(blocked_itc) / SUM(SUM(blocked_itc)) OVER (PARTITION BY client_id), 1) AS pct_of_client
FROM itc_evaluation WHERE status='BLOCKED'
GROUP BY client_id, blocked_ref ORDER BY client_id, blocked DESC;

-- Q6. RCM liability by type and unpaid bills
SELECT * FROM v_rcm_liability ORDER BY client_id, rcm_tax DESC;

-- Q7. Rule 37 - invoices unpaid beyond 180 days (as on 29-10-2026)
SELECT client_id, id, supplier_name, invoice_no, invoice_date,
       CAST(julianday('2026-10-29') - julianday(invoice_date) AS INTEGER) AS days_unpaid,
       ROUND(igst+cgst+sgst+cess,2) AS itc_to_reverse
FROM purchase
WHERE reverse_charge='N' AND (payment_date IS NULL OR payment_date='')
  AND julianday('2026-10-29') - julianday(invoice_date) > 180
ORDER BY days_unpaid DESC;

-- Q8. Section 16(4) deadline alerts - unclaimed ITC with days left
SELECT client_id, id, supplier_name, invoice_no, invoice_date, gst, sec16_4_deadline,
       CAST(julianday(sec16_4_deadline) - julianday('2026-10-29') AS INTEGER) AS days_left
FROM v_deadline_alerts ORDER BY days_left;

-- Q9. Running (cumulative) ITC claimed per client per month - window SUM
SELECT client_id, claim_period,
       ROUND(SUM(igst+cgst+sgst+cess),2) AS itc_claimed,
       ROUND(SUM(SUM(igst+cgst+sgst+cess)) OVER (PARTITION BY client_id ORDER BY claim_period),2) AS cumulative
FROM purchase WHERE itc_claimed='Y' GROUP BY client_id, claim_period ORDER BY client_id, claim_period;

-- Q10. Vendor concentration - top vendor share of ITC per client (RANK)
SELECT * FROM (
  SELECT client_id, supplier_name, ROUND(SUM(igst+cgst+sgst),2) AS itc,
         RANK() OVER (PARTITION BY client_id ORDER BY SUM(igst+cgst+sgst) DESC) AS rnk
  FROM purchase GROUP BY client_id, supplier_name) WHERE rnk <= 3;

-- Q11. Possible duplicate bookings (same GSTIN + invoice no.)
SELECT client_id, supplier_gstin, invoice_no, COUNT(*) AS times_booked, GROUP_CONCAT(id) AS entries
FROM purchase WHERE supplier_gstin <> ''
GROUP BY client_id, supplier_gstin, UPPER(REPLACE(REPLACE(invoice_no,'/',''),'-',''))
HAVING COUNT(*) > 1;

-- Q12. IMS action pending / rejected in GSTR-2B
SELECT client_id, return_period, ims_action, COUNT(*) AS docs, ROUND(SUM(igst+cgst+sgst),2) AS tax
FROM gstr2b WHERE ims_action IN ('Pending','Rejected') GROUP BY 1,2,3 ORDER BY 1,2;

-- Q13. Exempt-turnover ratio per month for Rule 42 (E/F)
SELECT client_id, period, exempt,
       taxable_intra + taxable_inter + zero_rated + exempt + nil_rated + non_gst AS total_turnover,
       ROUND(1.0 * exempt / (taxable_intra + taxable_inter + zero_rated + exempt + nil_rated + non_gst), 4) AS e_by_f
FROM sales_summary ORDER BY client_id, period;

-- Q14. Vendors with cancelled registration but invoices after cancellation
SELECT v.client_id, v.name, v.gstin, v.cancel_date, COUNT(p.id) AS bills_after_cancel,
       ROUND(SUM(p.igst+p.cgst+p.sgst),2) AS itc_at_stake
FROM vendor v JOIN purchase p ON p.vendor_id = v.id AND p.invoice_date > v.cancel_date
WHERE v.status = 'Cancelled' GROUP BY v.id;
