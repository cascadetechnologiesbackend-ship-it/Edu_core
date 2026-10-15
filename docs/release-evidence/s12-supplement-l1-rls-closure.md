# Sprint S12.1 Layer 1: Fail-Closed RLS & Tenant Context Closure Evidence

- **Specification**: `edu-core-s12-supplemental-security-and-release-closure` (v12.1.0)
- **Defect Closed**: `SEC-RLS-001` (P0: Migration 0034 fail-open RLS predicates permitted access when tenant context was NULL or empty)
- **Migration**: `database/src/migrations/0041_fail_closed_rls.sql` (Journal index: 41, when: 1793700000000)
- **Date**: 2026-10-15
- **Status**: CLOSED & VERIFIED (PASS)

---

## 1. Inventory of Tenant Tables & RLS Status

All 13 tenant-scoped tables have `ROW LEVEL SECURITY` enabled and `FORCE ROW LEVEL SECURITY` active. Application connections execute under non-owner role `schoolmitra_app` enforced by connection pool hook `SET ROLE schoolmitra_app`.

| Table Name | RLS Enabled | Force RLS | Select Policy | Insert Policy | Update Policy | Delete Policy |
| :--- | :---: | :---: | :--- | :--- | :--- | :--- |
| `users` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `classes` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `students` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `student_attendance` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `fee_invoices` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `fee_payments` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `payment_gateway_logs`| YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `account_ledger_transactions` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `consent_records` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `rights_requests` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `dpdp_grievances` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `data_breach_log` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |
| `vendor_register` | YES | YES | `tenant_select_policy` | `tenant_insert_policy` | `tenant_update_policy` | `tenant_delete_policy` |

---

## 2. Root Cause & Policy Remediation (Migration 0041)

### Root Cause
Migration 0034 contained an overly broad fallback:
```sql
nullif(current_setting('app.current_school_id', true), '') IS NULL
```
which caused un-scoped application queries or queries with missing context to evaluate to `TRUE`, exposing tenant data to unauthorized cross-tenant queries.

### Additive Remediation (Migration 0041)
Migration `0041_fail_closed_rls.sql` drops and replaces policies on `users` and all 12 operational tables with split command-level policies:

1. **FOR SELECT**:
   ```sql
   (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
   OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
   ```
   *(For `users`, `SYSTEM_AUTH` and `SUPER_ADMIN` with NULL school_id are also permitted for pre-session NextAuth email lookup).*

2. **FOR INSERT, UPDATE, DELETE**:
   ```sql
   (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
   ```
   Requires explicit, active tenant context matching `school_id`. No bypasses exist for un-scoped or cross-tenant writes.

---

## 3. Empirical Test Results

### Suite 1: Live PostgreSQL RLS Runtime Closure (Non-Owner Role `schoolmitra_app`)
- **File**: `backend/src/lib/__tests__/s4_rls_proofs.test.ts`
- **Tests**: 15 passed, 0 failed
- **Execution Date**: 2026-10-15
- **Verified Assertions**:
  1. `SET ROLE schoolmitra_app` is active on non-owner connection.
  2. School A context returns only School A users.
  3. School A context returns zero rows for School B users.
  4. Query without tenant context returns 0 rows (fail-closed).
  5. Empty string tenant context returns 0 rows (fail-closed).
  6. Non-UUID malformed tenant context returns 0 rows (fail-closed).
  7. Cross-tenant INSERT into School B from School A context throws RLS violation error code `42501`.
  8. Cross-tenant UPDATE of School B user from School A context updates 0 rows.
  9. Cross-tenant DELETE of School B user from School A context deletes 0 rows.
  10. Attempt to alter `school_id` from School A to School B fails with RLS check violation `42501`.
  11. `SYSTEM_AUTH` role allows targeted pre-auth user SELECT for NextAuth.
  12. `SYSTEM_AUTH` role cannot execute INSERT without matching school context.
  13. `PLATFORM_ADMIN` role allows cross-school SELECT for platform health audit.
  14. `PLATFORM_ADMIN` cannot execute INSERT across tenant boundaries without matching `school_id`.
  15. Transaction-local `set_config('..., true)` does not leak across pooled connections.

### Suite 2: Examination Data Isolation Truth Table
- **File**: `backend/src/lib/__tests__/examDataIsolation.test.ts`
- **Tests**: 12 passed, 0 failed
- **Execution Date**: 2026-10-15
- **Verified Assertions**:
  - `verifyExamOwnership` rejects cross-tenant exam IDs and logs audit violation.
  - `verifySetupOwnership` rejects cross-tenant setup IDs and logs audit violation.
  - `verifyClassOwnership` and `verifyStudentOwnership` query within transaction context and fail-closed with `TENANT_ACCESS_DENIED`.
  - `verifyScheduleOwnership` rejects cross-tenant schedule IDs.

---

## 4. Verification Checksum
- `pnpm --filter @schoolmitra/database run db:check-migrations` -> PASS (42 migrations synchronized)
- `pnpm type-check` -> PASS (6/6 packages clean)
- Baseline Flaw Status: `SEC-RLS-001` -> **CLOSED**
