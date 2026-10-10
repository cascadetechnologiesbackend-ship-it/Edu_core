# Reliability Drill 1: Production Database Backup & Restore Truth (Phase P5)
**Task ID:** P5-T1 (Drill 1)  
**Governing Specification:** `edu-core-production-readiness-verification-p4-p5` v7.0.5  
**Timestamp:** 2026-10-10T21:25:00+05:30  
**Target Engine:** PostgreSQL 16 (Docker stack: `schoolmitra_postgres`)  
**Status:** **VERIFIED (PASS)**

---

## 1. Executive Summary

Drill 1 proves end-to-end disaster recovery: performing a full binary custom-format dump (`pg_dump -F c`) of the production database (`schoolmitra_erp`), restoring into a fresh scratch database (`schoolmitra_restore_test`), and auditing data parity, financial ledger balances, and cryptographic PII recoverability.

---

## 2. Execution Log & Metrics

### A. Binary Export (`pg_dump`)
- **Command:** `docker exec schoolmitra_postgres pg_dump -U postgres -d schoolmitra_erp -F c -f /tmp/backup.dump`
- **Elapsed Duration:** **628 ms**
- **Artifact Size:** **506 KB** (518,891 bytes)
- **Exit Code:** `0`

### B. Isolated Restoration (`pg_restore`)
- **Target Scratch Database:** `schoolmitra_restore_test`
- **Command:** `docker exec schoolmitra_postgres pg_restore -U postgres -d schoolmitra_restore_test --clean --if-exists /tmp/backup.dump`
- **Elapsed Duration:** **5,038 ms**
- **Exit Code:** `0`

---

## 3. Post-Restore Data Parity Audit

Verification queries executed across source and restored databases:

```sql
SELECT 'schools' as tbl, count(*) FROM schools UNION ALL
SELECT 'users', count(*) FROM users UNION ALL
SELECT 'students', count(*) FROM students UNION ALL
SELECT 'classes', count(*) FROM classes UNION ALL
SELECT 'sections', count(*) FROM sections UNION ALL
SELECT 'fee_structures', count(*) FROM fee_structures UNION ALL
SELECT 'account_ledger_transactions', count(*) FROM account_ledger_transactions UNION ALL
SELECT 'user_push_subscriptions', count(*) FROM user_push_subscriptions;
```

**Results Comparison:**

| Table | Source (`schoolmitra_erp`) | Restored (`schoolmitra_restore_test`) | Parity Status |
| :--- | :--- | :--- | :--- |
| `schools` | 3 | 3 | **MATCH (100%)** |
| `users` | 11 | 11 | **MATCH (100%)** |
| `students` | 50 | 50 | **MATCH (100%)** |
| `classes` | 10 | 10 | **MATCH (100%)** |
| `sections` | 20 | 20 | **MATCH (100%)** |
| `fee_structures` | 5 | 5 | **MATCH (100%)** |
| `account_ledger_transactions` | 10 | 10 | **MATCH (100%)** |
| `user_push_subscriptions` | 0 | 0 | **MATCH (100%)** |

---

## 4. Financial Ledger Parity & Trial Balance Audit

### A. Cashbook Flow Direction Audit
`transaction_type` reflects cash flow direction (single-entry cashbook legacy column from Migration 0013):
```sql
SELECT transaction_type, sum(amount::numeric) as total
FROM account_ledger_transactions
GROUP BY transaction_type
ORDER BY transaction_type;
```

**Cashbook Flow Results:**
- **Source Database:**
  - `DEBIT` (Cash Outflows / Reversals / Refunds): **₹10,005,000.00**
  - `CREDIT` (Cash Inflows / Fee Receipts): **₹10,037,500.00**
- **Restored Database:**
  - `DEBIT` (Outflows): **₹10,005,000.00**
  - `CREDIT` (Inflows): **₹10,037,500.00**
- **Discrepancy:** **₹0.00 (Zero Drift between Source and Restored DB)**
- **Net Vault Cash:** **+₹32,500.00**

### B. Double-Entry General Ledger Trial Balance Audit (DECIDE-12 Option A)
Per Migration 0016, double-entry is maintained via `debit_account_id` and `credit_account_id`:
```sql
WITH debits AS (
  SELECT debit_account_id AS account_id, sum(amount::numeric) AS total_debit
  FROM account_ledger_transactions WHERE debit_account_id IS NOT NULL GROUP BY debit_account_id
),
credits AS (
  SELECT credit_account_id AS account_id, sum(amount::numeric) AS total_credit
  FROM account_ledger_transactions WHERE credit_account_id IS NOT NULL GROUP BY credit_account_id
)
SELECT 
  coa.code, coa.name,
  COALESCE(d.total_debit, 0) AS total_debit,
  COALESCE(c.total_credit, 0) AS total_credit,
  COALESCE(d.total_debit, 0) - COALESCE(c.total_credit, 0) AS net_balance
FROM chart_of_accounts coa
LEFT JOIN debits d ON coa.id = d.account_id
LEFT JOIN credits c ON coa.id = c.account_id
WHERE d.total_debit IS NOT NULL OR c.total_credit IS NOT NULL
ORDER BY coa.code;
```

- **Cash-in-Hand (`1000`)**: Debit ₹10,037,500.00 | Credit ₹10,005,000.00 | Net: +₹32,500.00
- **Student Receivable (`1200`)**: Debit ₹10,005,000.00 | Credit ₹10,037,500.00 | Net: -₹32,500.00
- **Total Debits**: **₹20,042,500.00** | **Total Credits**: **₹20,042,500.00**
- **Trial Balance Drift**: **₹0.00 (Exact Double-Entry Match)**
- Reference: `docs/release-evidence/p6-ledger-reconciliation.md` (closes OPEN-15).

---

## 5. Cryptographic PII Decryption Audit

Sample student record `stu-001` retrieved from restored database `schoolmitra_restore_test`:
- Stored encrypted payload: AES-256-GCM ciphertext format `enc:v2:k1:...`
- Tested via `decryptField` in `@schoolmitra/backend`:
  - `aadhaarNumber`: Successfully decrypted to original 12-digit format.
  - `parentPhone`: Successfully decrypted to original 10-digit format.
- Encryption key integrity and ciphertext IVs preserved with zero corruption.

---

## 6. Drill Verdict

- **Export Time:** 628 ms
- **Restore Time:** 5,038 ms
- **Row Parity:** 100% across all 8 tested tables.
- **Financial Balance:** 100% matched to the cent.
- **PII Decryption:** Verified functional.
- **Drill 1 Verdict:** **PASS**
