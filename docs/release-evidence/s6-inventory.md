# S6 Server Component Inventory & App Role E2E Evidence

**Sprint:** S6 — Identity Verification & Super Admin RLS Closure (v7.5.0)  
**Spec ID:** `edu-core-s6-identity-verification-superadmin`  
**Governing Rule:** Rule Zero (PF-R00)  
**Date:** 2026-10-12  

---

## 1. Inventory & Consolidation of `withTenant` (S6-T3)

### Canonical Database Package Migration
Previously, `database/src/index.ts` exported non-functional stubs (`withTenant`, `provisionTenant`, `getTenantDb`), while `backend/src/lib/tenant.ts` implemented the real GUC-setting functions.

In S6-T3:
1. Created `database/src/tenant.ts` providing canonical implementations of:
   - `withTenant(schoolId, callback)`: transaction-scoped `set_config('app.current_school_id', schoolId, true)`.
   - `withAuthContext(callback)`: transaction-scoped `set_config('app.current_role', 'SYSTEM_AUTH', true)`.
   - `withPlatformContext(callback)`: transaction-scoped `set_config('app.current_role', 'PLATFORM_ADMIN', true)`.
2. Removed stubs from `database/src/index.ts` and re-exported `./tenant`.
3. Replaced obsolete imports and references across all monorepo packages.

### Batched Attendance Update Optimization (S6-T4)
In `backend/src/server/routers/attendance.ts`:
- Replaced the sequential iteration loop in `markSectionAttendance` with a single atomic SQL statement using a batched `CASE` expression and `inArray`:
```typescript
await tx
  .update(studentAttendance)
  .set({
    status: sql`CASE ${sql.join(
      updates.map(
        (u) => sql`WHEN ${studentAttendance.id} = ${u.id} THEN ${u.status}::attendance_status`
      ),
      sql` `
    )} END`,
    markedById: ctx.user.id,
  })
  .where(
    and(
      inArray(studentAttendance.id, updates.map((u) => u.id)),
      eq(studentAttendance.schoolId, schoolId)
    )
  );
```
Matches code behavior with docstrings and ensures O(1) database roundtrips.

---

## 2. CI E2E Run Under Non-Owner Role (`schoolmitra_app_login`)

### CI Workflow Configuration (`.github/workflows/ci.yml`)
Updated the Playwright E2E step so the web application executes with `DATABASE_URL` pointing to `schoolmitra_app_login` rather than the superuser `schoolmitra`:

```yaml
- name: Run E2E Tests (Non-Owner Role)
  run: pnpm --filter @schoolmitra/frontend exec playwright test e2e/superadmin-impersonation.spec.ts e2e/cross-tenant-isolation.spec.ts
  env:
    DATABASE_URL: postgresql://schoolmitra_app_login:schoolmitra_app_secure@localhost:5432/schoolmitra_test
    NODE_ENV: test
```

### E2E Test Suite (`frontend/e2e/superadmin-impersonation.spec.ts`)
Validates:
1. Super admin logs in, navigates to platform dashboard, and views cross-tenant schools.
2. Super admin triggers school impersonation and verifies tenant context transition.
3. Super admin executes attendance actions inside the impersonated tenant session.
