# S6 Session Context & Platform Super Admin Evidence

**Sprint:** S6 — Identity Verification & Super Admin RLS Closure (v7.5.0)  
**Spec ID:** `edu-core-s6-identity-verification-superadmin`  
**Governing Rule:** Rule Zero (PF-R00)  
**Date:** 2026-10-12  

---

## 1. Problem Statement

Under strict fail-closed RLS (`FORCE ROW LEVEL SECURITY`), any query executed without a session/transaction GUC (`app.current_school_id` or `app.current_role`) returns 0 rows.

Two major blind spots existed in the codebase:
1. **NextAuth Session Path:**
   `jwt` and `session` callbacks in `backend/src/lib/auth/index.ts` and `getCachedSession()` in `serverAuth.ts` executed plain queries against the `users` table without tenant context. Under active RLS, these queries returned 0 rows, causing authenticated school users to be logged out immediately after authentication.
2. **Super Admin Cross-Tenant Blindness & Impersonation:**
   Platform super administrators (`SUPER_ADMIN`) need to inspect schools from the global dashboard, but had no tenant context, returning 0 rows across all 13 RLS tables. Furthermore, super admin impersonation cookies (`sm_impersonation`) were ignored by the tRPC `isAuthed` middleware, leaving impersonated sessions running without tenant context.

---

## 2. Technical Remediation (S6-T2)

### 1. NextAuth Callback & Session Caching Context
- In `backend/src/lib/auth/index.ts`:
  - `jwt` callback wraps user lookup in `withTenant(token.schoolId)` (or `withAuthContext()` if pre-tenant).
  - `session` callback wraps active status check in `withTenant(session.user.schoolId)`.
- In `backend/src/lib/serverAuth.ts`:
  - `getCachedSession()` verifies user active status and roles within `runInContext`:
  ```typescript
  const runInContext = verifiedSchoolId
    ? (cb: () => Promise<any>) => withTenant(verifiedSchoolId, cb)
    : withAuthContext;
  ```

### 2. Platform Admin Read Arm (Migration 0032)
Added an explicit read-only arm across all 13 RLS tables in their `USING` clauses:
```sql
OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
```
This is excluded from `WITH CHECK`, strictly preventing cross-tenant writes by platform admins unless operating inside an explicit `withTenant()` block.

### 3. tRPC Impersonation & Platform Context Handling
In `backend/src/server/trpc.ts`:
- Reads and verifies `sm_impersonation` cookie.
- If verified for `SUPER_ADMIN`, executes within `withTenant(impersonatedSchoolId)` as `SCHOOL_ADMIN`.
- If non-impersonated `SUPER_ADMIN`, executes within `withPlatformContext()` (`PLATFORM_ADMIN`).

---

## 3. Empirical Test Proofs

Added live Postgres integration tests in `backend/src/lib/__tests__/s4_rls_proofs.test.ts`:
1. **Test 7 (PLATFORM_ADMIN Read Cross-Tenant):** Proves a platform admin can read students from multiple distinct schools simultaneously.
2. **Test 8 (PLATFORM_ADMIN Write Denial):** Proves a platform admin is rejected with an RLS violation when attempting an unscoped insert or update.
3. **Test 9 (Super Admin Impersonation Tenant Isolation):** Proves an impersonated super admin session can mark attendance in the target school but is strictly denied in any other school.

All 9/9 tests passed against live PostgreSQL running under non-owner role `schoolmitra_app_login`.
