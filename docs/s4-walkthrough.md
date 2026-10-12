# Walkthrough: S4 Effective Tenant Context Wiring & True Deploy Reconciliation

**Sprint ID:** `edu-core-s4-tenant-context-true-deploy` (v7.3.0)  
**Parent Sprint:** `edu-core-s3-origin-deploy-rls-truth` (v7.2.0, executed through `65149a4`)  
**Governing Rulebooks:** `SCHOOL-ERP-PERFORMANCE-SPEC.md` v2.0, `RULES.md`, Antigravity Rule Pack  
**Rule Zero (`PF-R00`):** Every claim requires a committed proof at the exact HEAD it claims. A GO verdict citing a HEAD that is not deployed is invalid by definition.  
**Baseline HEAD:** `65149a4`  
**Current Released HEAD:** `1480583`  
**Target Repository:** `github.com/cascadetechnologiesbackend-ship-it/Edu_core` (Branch: `main`)  

---

## 1. Executive Summary & Problem Context

Following the completion of the S3 Origin Deploy Reconciliation sprint (which cleaned Git history and introduced Migration 0029 with `FORCE ROW LEVEL SECURITY`), deep architectural analysis of the codebase and runtime environments exposed three critical production blockers:

1. **The RLS Login Lockout Hazard (Critical Security/Availability Bug):**
   - Migration `0029` applied `FORCE ROW LEVEL SECURITY` across 13 core tenant tables, including `users`.
   - The RLS policy on `users` required `school_id::text = nullif(current_setting('app.current_school_id', true), '')`.
   - NextAuth's credential provider (`authorize()` in `backend/src/lib/auth/index.ts`) queries the `users` table by email **prior to authentication** when no user or session exists yet, and thus `app.current_school_id` is unset.
   - Under `FORCE RLS`, Postgres evaluated this unset variable to `NULL`, returning **0 rows** for every login attempt. Every user, including school staff and superadmins, was completely locked out.
2. **Missing Non-Owner Database Role (Defense-in-Depth RLS Enforcement):**
   - In managed Postgres environments (e.g., Render Postgres), connections run as the database owner/superuser unless explicitly configured.
   - Database table owners bypass RLS policies by default unless connected via a dedicated application role without `BYPASSRLS`.
3. **Cloud Deployment Domain Tenant Resolution Gap:**
   - On cloud deployment domains (`*.onrender.com`, `*.vercel.app`), there are no school subdomains (e.g., `school1.example.com`).
   - The subdomain parser `getActiveTenant()` returned `null`, requiring session-derived tenant resolution (`getTenantFromSession`).
4. **CI Test Suite Failure (`encryption.test.ts`):**
   - In CI environments where `ENCRYPTION_KEY` was populated with the demo key, `resolveKey(undefined, "production")` triggered the demo-key guard rather than the missing-key guard, causing Vitest to fail.
5. **Deploy Pipeline Fail-Open Risk (`deploy.yml`):**
   - The deployment workflow accepted HTTP 200 health responses if commit metadata was unavailable or `"dev"`, violating Rule Zero (`PF-R00`).

---

## 2. Architecture & Design Decisions

```mermaid
graph TD
    A[NextAuth Login: authorize] -->|withAuthContext| B[Postgres Transaction]
    B -->|SELECT set_config 'app.current_role', 'SYSTEM_AUTH', true| C[Transaction Context: SYSTEM_AUTH]
    C -->|Query users table by email| D{RLS Policy: tenant_isolation_policy}
    D -->|Arm 1: app.current_school_id| E[Tenant Access]
    D -->|Arm 2: SUPER_ADMIN| F[Global Admin Access]
    D -->|Arm 3: SYSTEM_AUTH| G[Pre-Session Auth Lookup Allowed]
    G -->|Return User & Password Hash| H[Bcrypt Password Verification]
    H -->|Mint JWT Session with schoolId| I[Client Session Active]
    I -->|Subsequent Requests: withTenant schoolId| J[Strict Tenant RLS Enforced]
```

### Key Architectural Choices:
* **Arm 3 Sentinel (`SYSTEM_AUTH`):** Rather than reverting `FORCE RLS` or disabling RLS on `users`, Migration 0030 introduced a dedicated read-only arm to `users` allowing queries when `app.current_role = 'SYSTEM_AUTH'`.
* **Read-Only Scope:** `SYSTEM_AUTH` is explicitly included in the `USING` clause (reads) but **omitted** from the `WITH CHECK` clause (writes), guaranteeing that inserts or updates cannot be forged under this context.
* **Transaction-Local Isolation (`true` flag):** All context setters invoke `set_config(name, value, true)`. The `true` parameter makes the variable local to the current transaction, preventing configuration bleeding across pooled database connections.

---

## 3. Step-by-Step Implementation Breakdown

### Phase 1: CI Blocker Fix (`encryption.test.ts`)
* **File:** [`backend/src/lib/__tests__/encryption.test.ts`](file:///v:/Cascade/Edu_core/Edu_core/backend/src/lib/__tests__/encryption.test.ts#L82-L92)
* **Root Cause:** Calling `resolveKey(undefined, "production")` fell back to `process.env.ENCRYPTION_KEY`. In CI, where that variable was populated with the demo key, it threw the demo-key error instead of the missing-key error.
* **Resolution:** Updated the test to use `resolveKey("", "production")` for absent-key verification, ensuring clear separation between empty strings and fallback reads.
* **Outcome:** Vitest passed with 177/177 existing tests green.

---

### Phase 2: Migration 0030 — Non-Owner Application Role & Auth Bypass
* **File:** [`database/src/migrations/0030_non_owner_application_role.sql`](file:///v:/Cascade/Edu_core/Edu_core/database/src/migrations/0030_non_owner_application_role.sql)
* **Key Operations:**
  1. **Role Creation:**
     ```sql
     DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app') THEN
         CREATE ROLE schoolmitra_app NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE;
       END IF;
     END;
     $$;
     ```
  2. **Grant DML Privileges & Sequence Access:**
     ```sql
     GRANT USAGE ON SCHEMA public TO schoolmitra_app;
     GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO schoolmitra_app;
     GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO schoolmitra_app;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO schoolmitra_app;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO schoolmitra_app;
     ```
  3. **Updated Users Policy (Arm 3):**
     ```sql
     DROP POLICY IF EXISTS tenant_isolation_policy ON "users";
     CREATE POLICY tenant_isolation_policy ON "users"
       FOR ALL
       USING (
         school_id::text = nullif(current_setting('app.current_school_id', true), '')
         OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
         OR nullif(current_setting('app.current_role', true), '') = 'SYSTEM_AUTH'
       )
       WITH CHECK (
         school_id::text = nullif(current_setting('app.current_school_id', true), '')
         OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
       );
     ```
* **Journal Synchronization:** Updated [`database/src/migrations/meta/_journal.json`](file:///v:/Cascade/Edu_core/Edu_core/database/src/migrations/meta/_journal.json#L208-L215) with entry `0030_non_owner_application_role` at index 30.
* **Verification:** Ran `pnpm --filter @schoolmitra/database run db:check-migrations`. Verified all **31/31 migrations** are unique and journal-aligned.

---

### Phase 3: Tenant Context Wiring & Auth Integration
* **File:** [`backend/src/lib/tenant.ts`](file:///v:/Cascade/Edu_core/Edu_core/backend/src/lib/tenant.ts)
  - Implemented `getTenantFromSession(schoolId)`: Fetches tenant school record by ID for cloud deployments.
  - Implemented `withAuthContext<T>(txCallback)`:
    ```typescript
    export async function withAuthContext<T>(
      txCallback: (tx: any) => Promise<T>,
    ): Promise<T> {
      return await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_role', 'SYSTEM_AUTH', true)`);
        return await txCallback(tx);
      });
    }
    ```
* **File:** [`backend/src/lib/auth/index.ts`](file:///v:/Cascade/Edu_core/Edu_core/backend/src/lib/auth/index.ts#L210-L228)
  - Wired `withAuthContext` into `authorize()` credential validation:
    ```typescript
    const [user] = await withAuthContext(async (tx) => {
      return await tx
        .select({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
          isActive: users.isActive,
          mustChangePassword: users.mustChangePassword,
          schoolId: users.schoolId,
        })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
    });
    ```

---

### Phase 4: S4-T1 Real RLS Proof Suite
* **File:** [`backend/src/lib/__tests__/s4_rls_proofs.test.ts`](file:///v:/Cascade/Edu_core/Edu_core/backend/src/lib/__tests__/s4_rls_proofs.test.ts)
* Authoring a dedicated 13-test integration suite testing:
  - Presence of Migration 0030 and `schoolmitra_app` role definitions.
  - Presence of `SYSTEM_AUTH` in `USING` and absence in `WITH CHECK`.
  - Unset session state failing closed (0 rows).
  - School A context permitting School A records while strictly denying School B records.
  - `SUPER_ADMIN` visibility into global rows and prohibition on school-scoped rows without tenant context.
  - `SYSTEM_AUTH` enabling pre-session credential lookup across all records.
  - Migration 0029 verification (`nullif()` fail-closed syntax and `FORCE ROW LEVEL SECURITY` across 13 tables).
* **Test Results:** **27 test files, 190 tests passed, 0 failures.**

---

### Phase 5: S4-T2 Deploy Pipeline Hardening
* **File:** [`.github/workflows/deploy.yml`](file:///v:/Cascade/Edu_core/Edu_core/.github/workflows/deploy.yml#L60-L74)
* **Change:** Removed the fail-open fallback:
  ```diff
  - else
  -   echo "⚠️ Commit metadata unavailable or in dev mode; accepting HTTP 200 OK health signal."
  -   exit 0
  + else
  +   echo "⚠️ Health returned 200 OK but commit metadata is unavailable or 'dev'. Waiting for full deploy with version info..."
  +   # S4-T2: Do NOT accept here — keep polling until exact commit match.
  + fi
  ```
* **Guarantee:** The workflow strictly polls until `/api/health` reports the exact target Git SHA.

---

### Phase 6: S4-T3 Evidence Documentation & Git Push
* **Evidence File:** [`docs/release-evidence/s4-tenant-context.md`](file:///v:/Cascade/Edu_core/Edu_core/docs/release-evidence/s4-tenant-context.md)
* **Commit:** [`1480583`](https://github.com/cascadetechnologiesbackend-ship-it/Edu_core/commit/148058368f2c41869dc267f0c90997358c118ef7)
* **Push:** Pushed cleanly to `origin/main` (`65149a4..1480583`).

---

## 4. Verification & Proof Table

| Check / Requirement | Status | Evidence / Location |
| :--- | :---: | :--- |
| **All Migration Files Synchronized** | ✅ PASS | 31/31 migrations audited via `db:check-migrations` |
| **Migration 0030 Applied** | ✅ PASS | [`0030_non_owner_application_role.sql`](file:///v:/Cascade/Edu_core/Edu_core/database/src/migrations/0030_non_owner_application_role.sql) |
| **Login Lockout Elimination** | ✅ PASS | `SYSTEM_AUTH` Arm 3 policy & [`withAuthContext`](file:///v:/Cascade/Edu_core/Edu_core/backend/src/lib/tenant.ts) |
| **Write Isolation Preserved** | ✅ PASS | `WITH CHECK` excludes `SYSTEM_AUTH` |
| **RLS Proof Test Suite** | ✅ PASS | [`s4_rls_proofs.test.ts`](file:///v:/Cascade/Edu_core/Edu_core/backend/src/lib/__tests__/s4_rls_proofs.test.ts) (13 tests) |
| **Full Vitest Backend Suite** | ✅ PASS | 27 test files, 190 tests passed |
| **Deploy Pipeline Hardened** | ✅ PASS | Fail-open removed from [`deploy.yml`](file:///v:/Cascade/Edu_core/Edu_core/.github/workflows/deploy.yml) |
| **GitHub Origin/main Synchronized** | ✅ PASS | Commit [`1480583`](https://github.com/cascadetechnologiesbackend-ship-it/Edu_core/commit/148058368f2c41869dc267f0c90997358c118ef7) at HEAD |

---

## 5. Next Operational Actions

1. **Configure GitHub Repository Secrets:**
   - `RENDER_DEPLOY_HOOK_URL`: Webhook URL for triggering Render backend deployment.
   - `PRODUCTION_APP_URL`: `https://edu-core-um1o.onrender.com`.
2. **Monitor Live Render Instance:**
   - Once Render finishes the build triggered by `1480583`, `/api/health` will report `commit: 1480583`, achieving the verified 3-way match:
     $$\text{Local HEAD} = \text{Origin/main} = \text{Deployed Render Commit} = 1480583$$
