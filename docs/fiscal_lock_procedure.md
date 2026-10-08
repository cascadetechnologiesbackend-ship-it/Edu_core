# Operational Procedure: Super Admin Fiscal Year Lock (ACC-06)

**Audience**: Super Administrators, Financial Controllers, Chief Operations Officers  
**System**: SchoolMitra ERP Financial Core  
**Invariant**: Once an Academic Year is flagged `isLocked: true`, financial write operations targeting that fiscal period are rejected across all API endpoints with HTTP 403 Forbidden.

---

## 1. Overview & Policy

Academic Year Fiscal Lock enforces immutable financial periods at the end of each academic or financial cycle. 

When a fiscal year is locked:
1. **Fee Invoicing & Collections**: Counter collections, online payments, fee concessions, and fine waivers cannot be recorded for dates within the locked period.
2. **Double-Entry Journal & Vouchers**: General Journal Vouchers, Contra transfers, Income vouchers, and Expense vouchers within the period are rejected.
3. **Student Advances & Refunds**: No advance fee deposits or refund payouts can be applied to locked periods.
4. **Bank Reconciliation**: Bank reconciliation adjustments cannot modify past balances.

---

## 2. Pre-Lock Verification Checklist

Before locking an Academic Year, the Super Admin must complete the following mandatory checks:

| Step | Action | Verification Criteria |
| :--- | :--- | :--- |
| **1. Unsettled Gateway Logs** | Check `/school/online-payments` | Zero pending or unmatched gateway logs for the academic year. |
| **2. Day Book Equilibrium** | Check `/school/transactions` | Verify total debits equal total credits for the period. |
| **3. Bank Reconciliation** | Check `/school/accounts/bank-reconciliation` | All statements reconciled with zero unadjusted lines. |
| **4. Unallocated Advances** | Check `/school/accounting/dashboard` | Verify all eligible student fee advances have been allocated or carried forward. |
| **5. Audit Execution** | Run Data Readiness Audit | Execute `runGoLiveDataReadinessAudit(schoolId)` and verify `isReadyForGoLive === true`. |

---

## 3. Step-by-Step Locking Procedure

1. **Navigate to Academic Years Control Panel**:
   - Log in as **SUPER_ADMIN**.
   - Navigate to **Settings > Academic Years** (`/school/settings/academic-years`).

2. **Select Target Academic Year**:
   - Locate the fiscal period to close (e.g., `AY 2025-2026`).
   - Confirm start date and end date boundaries.

3. **Trigger Fiscal Lock**:
   - Click **Lock Academic Year**.
   - Review confirmation modal:
     > *"Locking this academic year will make all fee collections, voucher postings, and ledger mutations permanent and read-only."*
   - Type the confirmation phrase `LOCK AY 2025-2026`.
   - Submit.

4. **Verify System Response**:
   - The UI displays the locked badge: `Locked (Immutable)`.
   - The backend records an audit log entry in `platform_audit_logs` with action `LOCK_ACADEMIC_YEAR`.

---

## 4. Emergency Unlocking Protocol

Unlocking a previously locked year is strictly restricted to emergency rectification of audited discrepancies and requires multi-party sign-off.

### Rules for Emergency Unlock:
1. **Authorization**: Requires approval from School Trustee and Principal.
2. **Window**: The temporary unlock window is active for a maximum of 4 hours.
3. **Audit Trail**: Every modification performed during the unlock window is flagged with `EMERGENCY_POST_LOCK_MUTATION` in `fee_audit_logs`.
4. **Re-Lock**: Super Admin must immediately re-lock the period upon completion.

---

## 5. Technical Enforcement Reference

- **Middleware & Route Guard**: `assertAcademicYearNotLocked(schoolId, date, db)` in `chartOfAccountsEngine.ts`.
- **Database Table**: `academic_years` column `is_locked boolean NOT NULL DEFAULT false`.
- **Audit Table**: `fee_audit_logs` records all attempts and lock status changes.
