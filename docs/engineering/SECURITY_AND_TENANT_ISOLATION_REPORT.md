# Security and Tenant Isolation Report

**Branch**: `engineering/enterprise-excellence-10-10`  
**Audit Date**: November 26, 2026

---

## 1. Tenant Context & Cryptographic HMAC Gate

- **Implementation**: `backend/src/lib/tenant.ts`
- **Mechanism**: Enforces tenant context propagation (`app.current_school_id`) and cryptographic HMAC verification for tenant-scoped operations.
- **Test Evidence**: `backend/src/lib/__tests__/tenantHmacSecurity.test.ts` — **6/6 tests passed** via `pnpm --filter @schoolmitra/backend exec vitest run`.

---

## 2. Row-Level Security (RLS) Coverage

- **Baseline**: Prior migrations (`0000`–`0063`, including `0060` least-privilege matrix) established RLS across core tenant tables.
- **Remediation (`0064`)**: `database/src/migrations/0064_strict_tenant_hmac_and_rls.sql` closes the RLS gap on newly added tables:
  - `import_export_jobs`
  - `class_teacher_assignments`
  - `id_card_templates`
  - `admission_form_templates`
- **Policy Pattern**: Each table has `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and a `FOR ALL` policy checking `school_id = current_setting('app.current_school_id', true)::uuid` in both `USING` and `WITH CHECK`.
- **Role Grants**: Explicit `SELECT, INSERT, UPDATE, DELETE` granted to `schoolmitra_app` when the role exists.

---

## 3. Verification Status

| Control | Status | Notes |
| :--- | :--- | :--- |
| Tenant HMAC unit tests | **Verified** | 6/6 tests pass in `tenantHmacSecurity.test.ts`. |
| Migration `0064` RLS SQL | **Verified** | Inspected in `database/src/migrations/0064_strict_tenant_hmac_and_rls.sql`. |
| Live DB RLS enforcement | **Blocked** | Requires live PostgreSQL/Neon connection credentials. |
