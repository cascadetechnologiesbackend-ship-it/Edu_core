# Stage S2-F Evidence: Data Lifecycle Correctness & Retention Safety

**Sprint**: S2 Security & Release Integrity Hardening Sprint (`edu-core-security-release-integrity-hardening-s2`)  
**Stage**: S2-F (Data Lifecycle Correctness)  
**Date**: 2026-10-11  
**Status**: VERIFIED  

---

## 1. Executive Summary

Stage S2-F remediates critical data lifecycle and retention integrity defects across recurring billing and data retention automation:
1. **Cron Invoice Generation Scope Leakage (F1)**: `/api/cron/generate-invoices` previously queried a global active academic year without school tenant isolation and duplicated fee assignment rules. The route was refactored to iterate per-school tenant, resolve each school's distinct active academic year, and delegate fee calculation to canonical `autoAssignFeeStructuresToStudent`.
2. **Data Retention Deletion of Active Students (F2 - Defect Remediation)**: `backend/src/workers/retention.ts` previously soft-deleted active students purely because their `createdAt` timestamp was older than `retentionCutoff`. Active students enrolled in senior classes (e.g., enrolled 3+ years ago) were erroneously deleted. The worker was refactored to strictly key on student exit lifecycle (`leavingDate < retentionCutoff` or `isActive = false`).
3. **Hard-Purge Foreign Key Safety & Financial Audit Trail Preservation (F2)**: Deleting students with existing `fee_invoices` or `fee_payments` triggered Postgres foreign key restriction violations (`23503`) and destroyed statutory accounting records. The worker now checks for linked accounting records and performs PII anonymization (`[ANONYMIZED]`, search hashes cleared, Aadhaar/photo removed) while preserving the database row for ledger integrity.
4. **Dry-Run Preview Capability**: Programmatic `{ dryRun: true }` and CLI `--dry-run` support was implemented, returning detailed preview lists of records that would be soft-deleted or hard-purged without executing mutations.

---

## 2. Before vs. After Architectural Analysis

### F1: Cron Invoice Generation (`frontend/src/app/api/cron/generate-invoices/route.ts`)

| Dimension | Before (Defective) | After (Hardened) |
| :--- | :--- | :--- |
| **Tenant Scope** | Queried single `academicYears.isActive` globally | Iterates per registered `school` entity |
| **Academic Year Resolution** | Global un-scoped findFirst query | Filtered by `academicYears.schoolId = school.id AND isActive = true` |
| **Fee Calculation Engine** | Ad-hoc inline invoice generation duplicating rules | Delegates to `autoAssignFeeStructuresToStudent(student.id)` in `feeAssignmentEngine.ts` |
| **Concurrency Guard** | No locking or duplicate check | Backed by `feeAssignmentEngine` idempotency guards |

### F2: Retention Worker (`backend/src/workers/retention.ts`)

| Dimension | Before (Defective) | After (Hardened) |
| :--- | :--- | :--- |
| **Soft-Delete Criterion** | `isActive = true AND createdAt < cutoff` (DELETED ACTIVE STUDENTS!) | `or(and(isNotNull(leavingDate), lt(leavingDate, cutoff)), and(eq(isActive, false), lt(updatedAt, cutoff)))` |
| **Active Students Protection** | Active students older than retention period were purged | Active students (`isActive = true, leavingDate = null`) are strictly excluded |
| **Hard Purge with Accounting Records** | Unconditional `db.delete(students)` resulting in FK constraint crash `23503` | Verifies `feeInvoices` & `feePayments`. If accounting records exist: anonymizes PII and preserves FK row |
| **PII Redaction on Anonymization** | N/A (row was blindly deleted) | Overwrites `firstNameEncrypted`, `lastNameEncrypted` with `[ANONYMIZED]`, clears hashes, Aadhaar, photo |
| **Dry Run Mode** | None; executed direct writes | `{ dryRun: true }` / `--dry-run` generates `wouldSoftDelete` and `wouldHardPurge` manifest |

---

## 3. Empirical Test Proofs

### Test Suite: `backend/src/workers/__tests__/retentionLifecycle.test.ts`

```text
✓ src/workers/__tests__/retentionLifecycle.test.ts (5 tests) 17ms
  ✓ does NOT soft-delete active students enrolled 3 years ago without exit date
  ✓ soft-deletes alumni / exited students whose exit date is older than retention window
  ✓ anonymizes student PII without deleting the row when student has linked fee invoices or payments
  ✓ hard purges student record completely when no fee invoices or payments exist
  ✓ dry-run mode returns would-be-affected preview lists without making database mutations
```

### Full Monorepo Test Summary

```text
Backend Suite:  25 test files passed (171 tests passed)
Frontend Suite: 19 test files passed (137 tests passed)
Total Tests:    308 tests passing (100% green, 0 skipped, 0 failing)
Type-Check:     6/6 workspace packages passed tsc --noEmit
Migrations:     29/29 synchronized and unique
```

---

## 4. Verification Verdict

Stage S2-F satisfies all requirements specified in sprint protocol:
- [x] Cron invoice generation isolated per-school and delegated to canonical engine.
- [x] Soft-delete keys strictly on student exit lifecycle, never `createdAt` age of active students.
- [x] Hard purge honors accounting referential integrity by anonymizing PII when fee invoices/payments exist.
- [x] Legal hold honored across soft-delete and hard-purge stages.
- [x] Dry-run preview mode implemented and verified.
- [x] 100% CI green, type-check clean, all tests passing.
