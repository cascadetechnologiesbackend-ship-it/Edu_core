# Runtime PostgreSQL RLS & System Catalog Verification Report

**Directive ID:** `EDUCORE_ENGINEERING_EXCELLENCE_PHASE02_CONTINUATION`  
**Evaluation Date:** 2026-11-25  
**Database Role Under Test:** `schoolmitra_app` (Non-Superuser, Non-Owner, `rolbypassrls = false`)  
**Maturity Status:** **PARTIAL** (Verified runtime isolation on Migration 0041 tables; Migration 0059 covering 136 gap tables validated in local/CI test mode only, awaiting scheduled staging rollout)  

---

## 1. System Catalog Verification (`pg_class` & `pg_namespace`)

Query executed against PostgreSQL system catalogs:
```sql
SELECT 
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) as policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
```

### Key Findings from System Catalogs:
1. **Application Connection Privileges:**
   - Role: `schoolmitra_app`
   - `rolsuper`: `false` (Not a superuser)
   - `rolbypassrls`: `false` (Strictly bound by Row-Level Security policies)
2. **Current Database Catalog Status:**
   - Core tables seeded in Migration `0041_fail_closed_rls.sql` (`students`, `attendance_records`, `student_documents`, etc.) enforce `relrowsecurity = true` and `relforcerowsecurity = true`.
   - The 136 gap tables identified in `RLS_GAP_ANALYSIS.md` are defined in migration `0059_complete_fail_closed_rls.sql`.
   - **Maturity Classification:** Because Migration 0059 is staged for local/CI test verification only and has **not** been applied to production (per constraint 1.6), RLS completeness across the entire 171-table surface is classified as **PARTIAL**.

---

## 2. Runtime Cross-Tenant Isolation Test Evidence

Automated test suite: `backend/src/lib/__tests__/runtimeRlsCatalogIsolation.test.ts` (9/9 passed).

| Test Invariant | Execution Operation | Observed Result | Verdict |
| :--- | :--- | :--- | :---: |
| **SELECT Isolation** | School A queries `students` WHERE id IN (`studentA`, `studentB`) | Exactly 1 row returned (`studentA`). Zero rows of School B returned. | **PASS** |
| **INSERT Defense** | School A attempts to INSERT record with `school_id = schoolBId` | Rejected with `violates row-level security policy for table "students"` (WITH CHECK violation). | **PASS** |
| **UPDATE Defense** | School A executes UPDATE on School B record | `rowCount: 0`. Row remains unaltered in School B context. | **PASS** |
| **DELETE Defense** | School A executes DELETE on School B record | `rowCount: 0`. Row remains intact in School B context. | **PASS** |
| **Fail-Closed Context** | Query executed without setting `app.current_school_id` | `SELECT count(*)` returns `0`. Fails closed. | **PASS** |
| **Platform Scope** | Platform context (`app.current_role = 'PLATFORM_ADMIN'`) | Reads permitted across schools for audit; direct writes rejected without `withTenant`. | **PASS** |

---

## 3. Table-Level Platform Access Policy Matrix

In response to CTO requirement 3.10, the blanket granting of `PLATFORM_ADMIN` SELECT permissions across all tables was audited. The table below defines the ratified platform access boundaries:

| Category | Representative Tables | Permitted Platform Operations | Security / Privacy Justification |
| :--- | :--- | :---: | :--- |
| **System & Tenant Config** | `schools`, `academic_years`, `roles`, `app_blueprints` | **READ / WRITE** | Necessary for multi-tenant provisioning, tenant lifecycle management, and subscription gating. |
| **Operational Metadata** | `system_metrics`, `audit_logs`, `queue_jobs` | **READ / WRITE (APPEND)** | Necessary for operational monitoring, audit trails, and queue administration. |
| **Academic Structures** | `classes`, `sections`, `subjects`, `exam_types` | **READ ONLY** | Allowed for platform support and cross-school analytics without write permissions. |
| **DPDP Sensitive PII** | `students`, `staff`, `student_documents`, `consent_records` | **RESTRICTED READ (AUDIT-LOGGED)** | Unrestricted global querying violates DPDP purpose limitation. Reads must require an active audit session ticket and log to `audit_logs`. |
| **Financial Ledgers** | `fee_invoices`, `fee_payments`, `salary_runs`, `bank_accounts` | **RESTRICTED READ (NO DIRECT WRITE)** | SchoolMitra charter principle: *Money and children are sacred*. Platform admins cannot alter or execute financial ledger writes. |

---

## 4. Rollout Strategy for Migration 0059

1. **Local & CI Integration:** Migration 0059 validated with `db:check-migrations` and Vitest suites.
2. **Staging Verification:** Apply 0059 on staging database replica; verify zero regression on background worker jobs.
3. **Production Maintenance Window:** Execute under table owner with pre-flight connection verification for `schoolmitra_app`.
