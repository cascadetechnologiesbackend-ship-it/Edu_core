-- Migration 0024: Finance Module Low-Latency Performance Indexes
-- Governing Spec: SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0 (PF-R80, PF-R84, PF-R87)
-- Evidenced by EXPLAIN (ANALYZE, BUFFERS) eliminating Seq Scans and in-memory Sorts on fee_payments and fee_invoices

-- 1. Composite tenant-leading index for fee invoices by Academic Year and Status (Hub Band 1 & 2)
CREATE INDEX IF NOT EXISTS idx_fee_invoices_school_ay_status
  ON fee_invoices (school_id, academic_year_id, status);

-- 2. Composite tenant-leading index for fee invoices by Due Date and Status (Dues Work List)
CREATE INDEX IF NOT EXISTS idx_fee_invoices_school_due_status
  ON fee_invoices (school_id, due_date ASC, status);

-- 3. Composite tenant-leading index for fee payments reverse chronological order (Day Book & Hub Recent Payments)
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_date
  ON fee_payments (school_id, payment_date DESC);

-- 4. Composite tenant-leading index for fee payments by payment method (Day Book Filtered by Method)
CREATE INDEX IF NOT EXISTS idx_fee_payments_school_method
  ON fee_payments (school_id, payment_method, payment_date DESC);

-- 5. Composite tenant-leading index for general ledger transactions by bank account and date (BRS Preview & Accounts Hub)
CREATE INDEX IF NOT EXISTS idx_ledger_school_bank_date
  ON account_ledger_transactions (school_id, bank_account_id, transaction_date DESC);
