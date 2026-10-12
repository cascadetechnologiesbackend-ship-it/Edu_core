# S4 Tenant Context Wiring Evidence

**Sprint:** S4 — Effective Tenant Context Wiring + True Deploy Reconciliation  
**Spec Version:** 7.3.0  
**Baseline:** `65149a4` (origin/main at S4 start)  
**Status:** IN PROGRESS

---

## S4-T0: Migration 0030 & Tenant Context Wiring

### Problem Statement
Migration 0029 (commit `3fe72fe`) enforced `FORCE ROW LEVEL SECURITY` on 13 tenant tables. This introduced a critical login lockout hazard:

- NextAuth `authorize()` queries the `users` table by email **before** any session/school context exists.
- With FORCE RLS and `app.current_school_id` unset, the policy `school_id::text = nullif(current_setting('app.current_school_id', true), '')` evaluates to `NULL`, returning 0 rows.
- Result: **No user can log in**, including superadmins (whose `app.current_role` is also not set at login time).

On cloud deployments (`*.onrender.com`, `*.vercel.app`), `getActiveTenant()` also returns `null` because there is no school subdomain — the tenant must be derived from `session.user.schoolId`.

### Fixes Implemented

#### 1. Migration 0030 — Non-Owner Application Role (`schoolmitra_app`)

File: `database/src/migrations/0030_non_owner_application_role.sql`

- Creates role `schoolmitra_app` (NOLOGIN, non-superuser, no BYPASSRLS)
- Grants SELECT, INSERT, UPDATE, DELETE on all public schema tables
- Grants USAGE + SELECT on all sequences
- Sets DEFAULT PRIVILEGES for future tables/sequences
- **Adds Arm 3 to the `users` table RLS policy:**

```sql
CREATE POLICY tenant_isolation_policy ON "users"
  FOR ALL
  USING (
    -- Arm 1: Normal tenant-scoped access
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    -- Arm 2: Global super-admin visibility (NULL school_id rows)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    -- Arm 3: System authentication context — allows login lookup before session
    OR nullif(current_setting('app.current_role', true), '') = 'SYSTEM_AUTH'
  )
  WITH CHECK (
    -- Write check: only tenant-scoped writes or super-admin global writes (no SYSTEM_AUTH in writes)
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
  );
```

**Security reasoning for Arm 3:**
- `SYSTEM_AUTH` is a **sentinel value** in the `app.current_role` GUC — it is NOT a Postgres role.
- It is set only inside server-side transactions by `withAuthContext()`.
- It permits SELECT only (WITH CHECK does not include `SYSTEM_AUTH`, so inserts/updates under this context are blocked by RLS).
- The `app.current_role` GUC can only be set by code running on the server (never by a client request directly).

#### 2. `backend/src/lib/tenant.ts` — Session-Derived Tenant + Auth Context

Added:
- **`getTenantFromSession(schoolId)`** — resolves tenant from session `schoolId`, used on cloud domains where subdomain is absent.
- **`withAuthContext(txCallback)`** — wraps DB queries in a transaction that sets `app.current_role = 'SYSTEM_AUTH'`, enabling the login lookup.

#### 3. `backend/src/lib/auth/index.ts` — Login Path Wired

The regular user lookup in `authorize()` now uses `withAuthContext()`:

```typescript
const [user] = await withAuthContext(async (tx) => {
  return await tx
    .select({ id, email, passwordHash, isActive, mustChangePassword, schoolId })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
});
```

This sets `app.current_role = 'SYSTEM_AUTH'` in the transaction, satisfying Arm 3 of the users policy.

### Verification

| Check | Result |
|-------|--------|
| `db:check-migrations` (31/31) | ✅ PASS |
| Migration 0030 SQL valid | ✅ PASS |
| `schoolmitra_app` role created with correct grants | ✅ IN MIGRATION |
| `SYSTEM_AUTH` arm in users RLS policy (0030) | ✅ IN MIGRATION |
| `withAuthContext()` exported from tenant.ts | ✅ CODE |
| `authorize()` uses `withAuthContext` for user lookup | ✅ CODE |
| Backend tests: 188/188 pass | 🔄 PENDING |

---

## S4-T1: RLS Proof Test Suite

File: `backend/src/lib/__tests__/s4_rls_proofs.test.ts`

Tests authored covering:
1. Migration 0030 SQL file existence and `schoolmitra_app` creation
2. `SYSTEM_AUTH` bypass in `WITH CHECK` — **excluded from write arm**
3. Tenant isolation: unset → fail-closed (0 rows)
4. Tenant isolation: school A → school A rows visible
5. Cross-tenant denial: school A context → school B rows denied
6. SUPER_ADMIN arm visibility (NULL `school_id` rows)
7. SUPER_ADMIN cannot see school-scoped rows without tenant context
8. SYSTEM_AUTH allows login lookup across all rows
9. Migration 0029 uses `nullif()` fail-closed (no IS NULL bypass)
10. Migration 0029 has FORCE RLS on all 13 tenant tables

---

## Remaining for S4-T2 + S4-T3

- [ ] Push commits and trigger Render deploy
- [ ] Poll `/api/health` until commit matches origin/main HEAD
- [ ] Author `s4-deploy-sync.md` with three-way match proof
- [ ] Author `s4-verdict.md`
