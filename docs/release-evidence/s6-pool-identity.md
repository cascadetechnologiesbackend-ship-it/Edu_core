# S6 Pool Identity & Credential Hygiene Evidence

**Sprint:** S6 — Identity Verification & Super Admin RLS Closure (v7.5.0)  
**Spec ID:** `edu-core-s6-identity-verification-superadmin`  
**Governing Rule:** Rule Zero (PF-R00)  
**Date:** 2026-10-12  

---

## 1. Threat & Vulnerability Addressed

In Sprint S5, Migration 0031 created the role `schoolmitra_app_login` with a hardcoded password `'schoolmitra_app_secure'`. If applied to a production database (via automated Render pre-deploy migrations), this exposed a publicly-known login credential on an external database port.

Furthermore, the application pool identity was fail-open because failed `SET ROLE` calls were swallowed silently.

---

## 2. Hardening Measures Implemented (S6-T1)

### 1. Dynamic Password Sourcing in Migration 0031
Modified `database/src/migrations/0031_non_owner_login_role.sql` and `database/src/migrate.ts`:
- In production, `migrate.ts` requires `APP_DB_PASSWORD` in the environment and executes `SELECT set_config('app.app_db_password', :pass, false)` prior to running migrations.
- The migration checks `current_setting('app.app_db_password', true)`. If unset in production, it fails immediately. In development / CI environments only, it safely falls back to the local test secret.

### 2. Standalone Credential Rotation Tool (`scripts/rotate-app-role-password.mjs`)
Implemented a dedicated, self-contained rotation tool that safely executes `ALTER ROLE schoolmitra_app_login PASSWORD ...` with proper SQL literal escaping:

```
> node scripts/rotate-app-role-password.mjs
Rotating password for role "schoolmitra_app_login"...
✅ Successfully rotated password for role "schoolmitra_app_login" in 52ms.
Verification: Authenticated connection test as "schoolmitra_app_login" succeeded!
```

### 3. Fail-Closed Pool Connect Hook
In `database/src/index.ts`:
- On every pool connection checkout, `SET ROLE schoolmitra_app` is executed.
- In production (`process.env.NODE_ENV === "production"`), any failure throws and triggers `process.exit(1)`.
- Connections can never silently run with elevated privileges or bypass RLS.

---

## 3. Configuration & Runbook Updates
- Updated `.env.example` documenting `APP_DB_PASSWORD` and its security requirements.
- Documented secret rotation procedure for operational runbooks using `scripts/rotate-app-role-password.mjs`.
