# S7 Production Credential Closure & Hardening (S7-T1)

**Spec ID:** `edu-core-s7-policy-split-credential-closure`  
**Governing Rulebook:** Rule Zero (PF-R00)  
**Task:** S7-T1: Production Credential Closure & Migration Hardening  
**Timestamp:** 2026-10-12  
**Status:** **VERIFIED & SECURED**

---

## 1. Executive Summary & Problem Addressed

During Sprint S6, Migration 0031 created the database role `schoolmitra_app_login` with `LOGIN` privileges and membership in `schoolmitra_app`. Because `APP_DB_PASSWORD` was not set in Render's environment, Migration 0031 defaulted to the public repository default password `schoolmitra_app_secure`.

While the application pool on Render connects using the table owner role (`schoolmitra`) and executes `SET ROLE schoolmitra_app` per-connection (confirmed via `/api/health` reporting `dbRole: schoolmitra_app` and `activeRole: schoolmitra_app`), the existence of `schoolmitra_app_login` with a known password and `LOGIN` capability represented an exposed attack surface.

Sprint S7 closes this credential surface via **Option A**:
1. In production, `schoolmitra_app_login` is explicitly set to `NOLOGIN`. Since the production application pool connects via table owner credentials and executes `SET ROLE`, the standalone login role is unneeded in production.
2. `database/src/migrate.ts` has been hardened to fail fast (`throw new Error`) if `NODE_ENV === "production"` and `APP_DB_PASSWORD` is absent when creating the role. Fresh production environments can never inherit a default password.
3. On every production migration run, `migrate.ts` enforces `ALTER ROLE schoolmitra_app_login NOLOGIN;`.
4. A dedicated verification script `scripts/verify-production-credential.mjs` was created and executed to prove `rolcanlogin = false` and that authentication attempts using the default password are strictly rejected.

---

## 2. Hardening Details

### A. `database/src/migrate.ts` Hardening
```typescript
// S6-T1 / S7-T1: Production credential closure and APP_DB_PASSWORD enforcement
const appDbPassword = process.env["APP_DB_PASSWORD"];
const isProduction = process.env["NODE_ENV"] === "production";

if (isProduction) {
  const roleCheck = await pool.query(`
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app_login') AS exists;
  `);
  const roleExists = Boolean(roleCheck.rows[0]?.exists);

  if (!roleExists && !appDbPassword) {
    throw new Error(
      "[Migrate FATAL] Production environment requires APP_DB_PASSWORD to create schoolmitra_app_login role. Cannot use committed default credentials in production."
    );
  }
}

if (appDbPassword) {
  await pool.query(`SELECT set_config('app.app_db_password', $1, false)`, [appDbPassword]);
  console.log("[Migrate] Injected APP_DB_PASSWORD into migration session context.");
}

await migrate(db, { migrationsFolder });
console.log("Migration completed");

// S7-T1: In production, enforce NOLOGIN on schoolmitra_app_login to close the credential surface.
// The application connection pool connects as the owner role and sets session role to schoolmitra_app.
if (isProduction) {
  const roleExists = (await pool.query(
    `SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app_login') AS exists;`
  )).rows[0]?.exists;
  if (roleExists) {
    await pool.query(`ALTER ROLE schoolmitra_app_login NOLOGIN;`);
    console.log("[Migrate] S7-T1: Hardened production - altered role schoolmitra_app_login to NOLOGIN.");
  }
}
```

---

## 3. Empirical Verification Output (CRED_PROOF)

The verification script `scripts/verify-production-credential.mjs` was executed:

```
================================================================================
 S7-T1: Production Credential Closure Verification (CRED_PROOF)
================================================================================
Timestamp: 2026-10-12T14:57:31.990Z

[1] pg_roles state query result:
┌─────────┬─────────────────────────┬─────────────┬──────────┬────────────┐
│ (index) │ rolname                 │ rolcanlogin │ rolsuper │ rolinherit │
├─────────┼─────────────────────────┼─────────────┼──────────┼────────────┤
│ 0       │ 'schoolmitra_app'       │ false       │ false    │ false      │
│ 1       │ 'schoolmitra_app_login' │ false       │ false    │ true       │
└─────────┴─────────────────────────┴─────────────┴──────────┴────────────┘

[2] Probing connection with committed default credentials (schoolmitra_app_login:schoolmitra_app_secure)...
✅ Default password connection REJECTED as expected.
   Rejection reason: role "schoolmitra_app_login" is not permitted to log in

[3] Verification Summary JSON:
{
  "timestamp": "2026-10-12T14:57:32.050Z",
  "schoolmitra_app": {
    "exists": true,
    "rolcanlogin": false
  },
  "schoolmitra_app_login": {
    "exists": true,
    "rolcanlogin": false,
    "defaultPasswordRejected": true,
    "rejectionReason": "role \"schoolmitra_app_login\" is not permitted to log in"
  },
  "credentialClosureStatus": "PASSED_SECURE"
}

✅ S7-T1 Credential Closure Verification: PASSED
```

### Invariants Satisfied:
1. `pg_roles.rolcanlogin` for `schoolmitra_app_login` is `false`.
2. Connection using the former default password (`schoolmitra_app_secure`) fails immediately at the Postgres protocol handshake.
3. No plaintext passwords or credentials are logged or committed (PF-R00 / S3-T0 Secret Guard maintained).
4. CI execution retains `schoolmitra_app_login` loginability for local GitHub Runner integration tests, while production builds (`NODE_ENV === "production"`) strictly seal the role.

---

## 4. Conclusion
Production credential attack surface for `schoolmitra_app_login` is closed and verified.
