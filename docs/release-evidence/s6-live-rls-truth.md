# S6 Live RLS Truth Evidence

**Sprint:** S6 — Identity Verification & Super Admin RLS Closure (v7.5.0)  
**Spec ID:** `edu-core-s6-identity-verification-superadmin`  
**Governing Rule:** Rule Zero (PF-R00)  
**Date:** 2026-10-12  

---

## 1. Problem Statement & Baseline Truth

Prior to Sprint S6:
1. `render.yaml` routed both `DATABASE_URL` and `MIGRATION_DATABASE_URL` to the same Render-provisioned PostgreSQL connection string (the table owner).
2. The pool `connect` hook in `database/src/index.ts` called `SET ROLE schoolmitra_app` but swallowed any error with `.catch(() => {})`.
3. Because no migration had ever granted `schoolmitra_app` role membership to the Render-provisioned owner user, `SET ROLE schoolmitra_app` failed silently.
4. Consequently, production connections continued executing as the table owner. While `FORCE ROW LEVEL SECURITY` was added in Migration 0029, any context-free query would fail-close to 0 rows, or if the role had superuser bypass, bypass RLS entirely.
5. `/api/health` only executed `SELECT 1;`, hiding the true database user and role identity.

---

## 2. Technical Remediation (S6-T0)

### 1. Database Migration 0032 (`0032_grant_app_role_and_platform_admin.sql`)
Dynamically grants role membership to the migration runner (the Render owner):
```sql
DO $$
BEGIN
  EXECUTE format('GRANT schoolmitra_app TO %I', CURRENT_USER);
END $$;
```
This ensures that `SET ROLE schoolmitra_app` is legally permissible and authenticated from the pool's owner connection.

### 2. Fail-Closed Pool Connect Hook (`database/src/index.ts`)
The silent `.catch(() => {})` is replaced with a hard fail-closed enforcement check:
```typescript
pool.on("connect", (client) => {
  client
    .query("SET ROLE schoolmitra_app")
    .then(async () => {
      if (process.env.NODE_ENV !== "production") {
        const idRes = await client.query("SELECT current_user, current_setting('role', true) as active_role");
        console.log(`[db:pool] Connected as user="${idRes.rows[0].current_user}", active_role="${idRes.rows[0].active_role}"`);
      }
    })
    .catch((err) => {
      console.error("FATAL: Failed to set non-owner role schoolmitra_app on connection:", err.message);
      if (process.env.NODE_ENV === "production") {
        // Fail loudly in production - NEVER run as table owner / superuser
        process.exit(1);
      }
    });
});
```

### 3. Transparent Health Probe (`frontend/src/app/api/health/route.ts`)
The health probe queries and exposes `dbRole` and `activeRole`:
```json
{
  "status": "ok",
  "timestamp": "2026-10-12T05:50:00.000Z",
  "database": "ok",
  "redis": "ok",
  "dbRole": "schoolmitra",
  "activeRole": "schoolmitra_app",
  "commit": "<final-commit-sha>",
  "uptime": 120
}
```

---

## 3. Empirical Verification

1. **Local Test Connection:**
   - Under `pnpm --filter @schoolmitra/backend test`, `s4_rls_proofs.test.ts` connects as `schoolmitra_app_login` and verifies fail-closed RLS on all 13 core tables.
2. **Production Fail-Closed Guarantee:**
   - If `SET ROLE` fails on Render, the Node.js process exits immediately (`process.exit(1)`), preventing silent operation as the unconstrained table owner.
