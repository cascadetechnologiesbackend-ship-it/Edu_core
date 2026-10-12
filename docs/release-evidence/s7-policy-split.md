# S7 RLS Policy Command Split & Write-Arm Closure (S7-T0)

**Spec ID:** `edu-core-s7-policy-split-credential-closure`  
**Governing Rulebook:** Rule Zero (PF-R00)  
**Task:** S7-T0: Migration 0033 — Split RLS Policies by SQL Command  
**Timestamp:** 2026-10-12  
**Status:** **VERIFIED & SECURED**

---

## 1. Executive Summary & Problem Addressed

In Sprint S6, monolithic `FOR ALL` policies were maintained on the 13 tenant tables with:
```sql
USING (
  school_id::text = nullif(current_setting('app.current_school_id', true), '')
  OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
)
WITH CHECK (
  school_id::text = nullif(current_setting('app.current_school_id', true), '')
)
```
While `WITH CHECK` restricted `INSERT` and the new state of `UPDATE`, PostgreSQL evaluates **only** the `USING` expression for `DELETE` statements (since no new row is created). Consequently, a platform-context session (`app.current_role = 'PLATFORM_ADMIN'`) could execute `DELETE` against any school's rows across all 13 tables, and a `SYSTEM_AUTH` session could `DELETE` any row from the `users` table.

Sprint S7 Migration 0033 completely dismantles the monolithic `FOR ALL` policies across all 13 tables, replacing them with distinct per-command policies:
- `FOR SELECT`: Grants read access to the matching `school_id`, plus authorized read arms (`PLATFORM_ADMIN` across all 13 tables; `SUPER_ADMIN` and `SYSTEM_AUTH` on `users`).
- `FOR INSERT`: Strictly requires `school_id` match in `WITH CHECK` (plus `school_id IS NULL AND SUPER_ADMIN` on `users`).
- `FOR UPDATE`: Strictly requires `school_id` match in both `USING` and `WITH CHECK` (plus `school_id IS NULL AND SUPER_ADMIN` on `users`). Neither `PLATFORM_ADMIN` nor `SYSTEM_AUTH` is present.
- `FOR DELETE`: Strictly requires `school_id` match in `USING` (plus `school_id IS NULL AND SUPER_ADMIN` on `users`). Neither `PLATFORM_ADMIN` nor `SYSTEM_AUTH` is present.

This architectural restructuring guarantees at the PostgreSQL database engine level that read arms are structurally incapable of authorizing any `INSERT`, `UPDATE`, or `DELETE`.

---

## 2. Migration 0033 Specification

**File:** `database/src/migrations/0033_s7_split_rls_policies_by_command.sql`  
**Monotonic Index:** 33  
**Journal Registration:** Confirmed via `pnpm db:check-migrations` (34/34 migration files synchronized).

### Policy Matrix Across All 13 Tenant Tables:

| Table | SELECT Arms | INSERT Arms | UPDATE Arms | DELETE Arms |
|---|---|---|---|---|
| `users` | `school_id`, `SUPER_ADMIN`, `SYSTEM_AUTH`, `PLATFORM_ADMIN` | `school_id`, `SUPER_ADMIN` (NULL school) | `school_id`, `SUPER_ADMIN` (NULL school) | `school_id`, `SUPER_ADMIN` (NULL school) |
| `students` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |
| `fee_invoices` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |
| `fee_payments` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |
| `classes` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |
| `student_attendance` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |
| `payment_gateway_logs` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |
| `account_ledger_transactions` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |
| `consent_records` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |
| `rights_requests` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |
| `dpdp_grievances` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |
| `data_breach_log` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |
| `vendor_register` | `school_id`, `PLATFORM_ADMIN` | `school_id` | `school_id` | `school_id` |

---

## 3. Live PostgreSQL Verification Suite (DELETE_PROOF)

The test suite in `backend/src/lib/__tests__/s4_rls_proofs.test.ts` executes live against PostgreSQL using the non-owner role `schoolmitra_app`. All 15 empirical behavioral tests pass cleanly:

```
> @schoolmitra/backend@0.1.0 test V:\Cascade\Edu_core\Edu_core\backend
> vitest run "src/lib/__tests__/s4_rls_proofs.test.ts"

 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/s4_rls_proofs.test.ts  (15 tests) 310ms
   ✓ Live Postgres RLS Runtime Closure (Non-Owner Role)
     ✓ 1. Unset tenant context returns 0 student rows (fail-closed under FORCE RLS)
     ✓ 2. School A context returns School A students, strictly denies School B students
     ✓ 3. SYSTEM_AUTH role allows reading users by email before session exists
     ✓ 4. SYSTEM_AUTH role strictly fails on writes under WITH CHECK
     ✓ 5. withTenant(schoolA) allows marking attendance for School A
     ✓ 6. Marking attendance without tenant context fails with Postgres RLS error
     ✓ 7. PLATFORM_ADMIN role reads across tenant boundaries (super admin platform view)
     ✓ 8. PLATFORM_ADMIN role strictly denies writes outside withTenant context
     ✓ 9. super admin impersonating School A succeeds with attendance mark in School A
     ✓ 10. S7-T0: PLATFORM_ADMIN role can SELECT cross-tenant rows but strictly affects 0 rows on DELETE
     ✓ 11. S7-T0: PLATFORM_ADMIN role strictly affects 0 rows on UPDATE of tenant rows
     ✓ 12. S7-T0: SYSTEM_AUTH role can read users but strictly affects 0 rows on DELETE
     ✓ 13. S7-T0: SYSTEM_AUTH role strictly affects 0 rows on UPDATE of users
     ✓ 14. S7-T0: withTenant(schoolA) successfully executes UPDATE and DELETE on School A rows
     ✓ 15. S7-T0: withTenant(schoolA) strictly affects 0 rows on UPDATE and DELETE of School B rows

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Duration  1.19s
```

### Key Empirical Invariants Verified:
1. **Cross-Tenant DELETE Denial (Test 10):** Under `PLATFORM_ADMIN` context with no school ID, attempting `DELETE FROM students WHERE id = $studentAId` returned `deleteRes.rowCount === 0`. Subsequent verification query confirmed the record remained intact.
2. **Cross-Tenant UPDATE Denial (Test 11):** Under `PLATFORM_ADMIN` context, attempting `UPDATE students SET category = 'OBC'` returned `updateRes.rowCount === 0`.
3. **SYSTEM_AUTH Users DELETE Denial (Test 12):** Under `SYSTEM_AUTH` context, `SELECT` successfully retrieved the user, but `DELETE FROM users WHERE id = $userId` returned `deleteRes.rowCount === 0`.
4. **Tenant-Scoped Write Legality (Test 14):** A legitimate session inside `withTenant(schoolAId)` executed both `UPDATE` and `DELETE` on School A records with `rowCount === 1`.
5. **Foreign-Tenant Isolation (Test 15):** Inside `withTenant(schoolAId)`, attempting `UPDATE` or `DELETE` on School B records returned `rowCount === 0`.

---

## 4. Conclusion
The write and delete authorization gap in Migration 0032 is closed. Read arms are completely isolated to `FOR SELECT` policies. All DML operations enforce strict single-tenant boundaries at the database engine level.
