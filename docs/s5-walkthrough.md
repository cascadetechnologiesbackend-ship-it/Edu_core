# Walkthrough: S5 RLS Runtime Closure & Complete Application Isolation

**Sprint ID:** `edu-core-s5-rls-runtime-closure` (v7.4.0)  
**Parent Sprint:** `edu-core-s4-tenant-context-true-deploy` (v7.3.0, executed through `1480583`)  
**Governing Rulebooks:** `SCHOOL-ERP-PERFORMANCE-SPEC.md` v2.0, `RULES.md`, Antigravity Rule Pack  
**Rule Zero (`PF-R00`):** Every claim requires a committed proof at the exact HEAD it claims. A GO verdict citing a HEAD that is not deployed is invalid by definition.  
**Baseline HEAD:** `1480583`  
**Current Released HEAD:** `c2469eb` (Code) / `40771d6` (Docs Evidence)  
**Deployed Render Host:** `https://edu-core-um1o.onrender.com`  
**Target Repository:** `github.com/cascadetechnologiesbackend-ship-it/Edu_core` (Branch: `main`)  

---

## 1. Executive Summary & Problem Context

While Sprint S4 landed PostgreSQL RLS policies at the database layer and resolved the login lockout dilemma via Migration 0030, deep runtime audit revealed that the application layer did not actively participate in tenant scoping on execution paths:

1. **The Application Layer Non-Owner Role Gap:**
   - Database connections connected as the table owner/superuser, bypassing Row-Level Security checks.
   - Without a separate `LOGIN` role inheriting `schoolmitra_app` and a connection pool `SET ROLE` hook, queries bypassed RLS regardless of `FORCE ROW LEVEL SECURITY`.
2. **Missing Tenant Scoping on DB Writes & Procedures:**
   - Protected tRPC routes executed database queries without establishing `app.current_school_id`.
   - Server Actions (`changePassword.ts`, `onboard.ts`, `profile.ts`) and background BullMQ workers (`financeAutomation.ts`, `reportCard.ts`, `retention.ts`) executed mutations without transaction-local tenant context.
3. **CI Blind Spot & Ineffective Mock Tests:**
   - Previous tests in `s4_rls_proofs.test.ts` were string/regex matching unit mocks that verified SQL text rather than empirical database behavior.
   - CI ran backend tests as the container superuser before migrations were executed, hiding RLS enforcement failures.
4. **Security Vulnerability CVE-2025-29927:**
   - Next.js version was pinned to `14.2.3`, vulnerable to cache poisoning and middleware bypass (CVE-2025-29927).
5. **Hygiene & Production Blockers:**
   - The root `Dockerfile` attempted to copy nonexistent `packages/i18n/package.json`, breaking Docker smoke builds in CI.
   - `render.yaml` contained development flags (`SMS_PROVIDER=mock`, `ALLOW_MOCK_SMS_IN_PROD=true`) in production.
   - The attendance router allowed unbatched N+1 attendance marking and lacked role/tenant cross-checks.

---

## 2. Architecture & Design Decisions

```mermaid
graph TD
    subgraph Client & API Layer
        REQ[Client Request: Session JWT] --> TRPC[tRPC protectedProcedure]
        REQ --> SA[Server Actions]
        QUEUE[BullMQ Queue] --> WORKER[Background Workers]
    end

    subgraph Tenant Context Enforcement [S5-T2]
        TRPC -->|isAuthed Middleware| CTX{schoolId Present?}
        CTX -->|Yes| WT1[withTenant schoolId]
        CTX -->|No & SUPER_ADMIN| SA1[SET app.current_role = SUPER_ADMIN]
        SA -->|db.transaction| WT2[set_config app.current_school_id]
        WORKER -->|Worker Handler| WT3[withTenant job.data.schoolId]
    end

    subgraph Database Connection Pool [S5-T1]
        APP_CONN[DATABASE_URL: schoolmitra_app_login] --> POOL[pg.Pool]
        POOL -->|connect hook| SETROLE[SET ROLE schoolmitra_app]
        MIG_CONN[MIGRATION_DATABASE_URL: owner] --> MIGRATE[drizzle-kit / migrate.ts]
    end

    subgraph PostgreSQL 16 RLS Enforcement [S5-T3]
        WT1 & WT2 & WT3 --> DB_TX[(Postgres Transaction)]
        SETROLE --> DB_TX
        DB_TX --> RLS{FORCE RLS Policies}
        RLS -->|app.current_school_id matches| PERMIT[Allow SELECT / INSERT / UPDATE / DELETE]
        RLS -->|Unset or Mismatched| DENY[Deny: 0 Rows / WITH CHECK Violation]
    end
```

### Key Architectural Choices:
1. **Separation of DDL and DML Identities:**
   - `MIGRATION_DATABASE_URL` connects as the table owner to execute schema migrations.
   - `DATABASE_URL` connects as `schoolmitra_app_login` (membership in `schoolmitra_app`), running `SET ROLE schoolmitra_app` on checkout. Application code has no table-owner or BYPASSRLS privileges.
2. **Deterministic Context Injection via tRPC Middleware:**
   - In `backend/src/server/trpc.ts`, the `isAuthed` middleware wraps all downstream procedure logic in `withTenant(schoolId)` within a transaction, making it impossible for a developer to forget tenant context on protected routes.
3. **Fail-Closed Verification on All Mutation Paths:**
   - Every server action and background worker wraps database mutations in transaction-scoped `set_config('app.current_school_id', schoolId, true)`.
4. **Empirical Behavioral Testing:**
   - Replaced all string/regex test assertions with real PostgreSQL queries run by `schoolmitra_app_login`.

---

## 3. Step-by-Step Task Breakdown

### S5-T0: Patch CVE-2025-29927 (Next.js Security Upgrade)
- Upgraded `next` and `eslint-config-next` across `frontend/package.json` and `backend/package.json` from `14.2.3` to `14.2.25`.
- Updated `pnpm-lock.yaml` and verified clean monorepo builds and linting.

### S5-T1: Wire Non-Owner Role End-to-End
1. **Migration 0031 ([`0031_non_owner_login_role.sql`](file:///v:/Cascade/Edu_core/Edu_core/database/src/migrations/0031_non_owner_login_role.sql)):**
   - Created `schoolmitra_app_login` with `LOGIN PASSWORD 'schoolmitra_app_secure' IN ROLE schoolmitra_app`.
   - Registered in `meta/_journal.json` (32 total migrations).
2. **Pool Connect Hook ([`database/src/index.ts`](file:///v:/Cascade/Edu_core/Edu_core/database/src/index.ts#L33-L45)):**
   - Added hook on `pool.on("connect")` running `SET ROLE schoolmitra_app;`.
   - Added guard `skipSetRole` to keep table owner identity for migration and seed commands (`db:migrate`, `db:seed`).
3. **Migration Runner ([`database/src/migrate.ts`](file:///v:/Cascade/Edu_core/Edu_core/database/src/migrate.ts#L11-L15)):**
   - Prioritized `MIGRATION_DATABASE_URL ?? DATABASE_URL`.
4. **Deployment & Environment Documentation:**
   - Updated [render.yaml](file:///v:/Cascade/Edu_core/Edu_core/render.yaml) and [.env.example](file:///v:/Cascade/Edu_core/Edu_core/.env.example) documenting the separation of `MIGRATION_DATABASE_URL` and `DATABASE_URL`.

### S5-T2: Set Tenant Context on Every DB Path
1. **tRPC Middleware ([`backend/src/server/trpc.ts`](file:///v:/Cascade/Edu_core/Edu_core/backend/src/server/trpc.ts#L134-L176)):**
   - In `isAuthed`, for users with `schoolId`, runs `withTenant(schoolId)` passing transaction client `tx` as `ctx.db`.
   - For `SUPER_ADMIN` with `schoolId === null`, sets `app.current_role = 'SUPER_ADMIN'`.
2. **Server Actions ([`frontend/src/app/actions/`](file:///v:/Cascade/Edu_core/Edu_core/frontend/src/app/actions/)):**
   - `changePassword.ts`: Wrapped password updates in `db.transaction()` setting `app.current_school_id` or `app.current_role = 'SYSTEM_AUTH'`.
   - `onboard.ts`: School provisioning wrapped in transaction setting `app.current_school_id`.
   - `profile.ts`: Self-profile updates wrapped in transaction setting `app.current_school_id`.
3. **Background Workers ([`backend/src/workers/`](file:///v:/Cascade/Edu_core/Edu_core/backend/src/workers/)):**
   - `financeAutomation.ts`: Job handlers wrapped in `withTenant(schoolId)`.
   - `reportCard.ts`: Batch report card processing wrapped in `withTenant(schoolId)`.
   - `retention.ts`: Data retention and DPDP consent withdrawal wrapped in `withTenant(schoolId)`.

### S5-T3: Fix CI Blind Spot & Empirical Tests
1. **Live Postgres Integration Suite ([`s4_rls_proofs.test.ts`](file:///v:/Cascade/Edu_core/Edu_core/backend/src/lib/__tests__/s4_rls_proofs.test.ts)):**
   - Built a live suite connecting as `schoolmitra_app_login:schoolmitra_app_secure`.
   - Proved 6 core invariants:
     1. Unset tenant context returns 0 rows (fail-closed under `FORCE RLS`).
     2. School A context returns School A records, but strictly denies School B records.
     3. `SYSTEM_AUTH` role allows pre-session user lookup.
     4. `SYSTEM_AUTH` role strictly fails on writes under `WITH CHECK`.
     5. Teacher marking attendance within `withTenant(schoolA)` succeeds.
     6. Marking attendance without tenant context throws PostgreSQL RLS violation.
2. **CI Pipeline Hardening ([`.github/workflows/ci.yml`](file:///v:/Cascade/Edu_core/Edu_core/.github/workflows/ci.yml#L102-L113)):**
   - Added migration step before unit/integration tests running under owner credentials.
   - Configured `DATABASE_URL: postgresql://schoolmitra_app_login:schoolmitra_app_secure@localhost:5432/schoolmitra_test` for backend test run.

### S5-T4: Hygiene Blockers Resolved
1. **Dockerfile ([`Dockerfile`](file:///v:/Cascade/Edu_core/Edu_core/Dockerfile)):**
   - Removed nonexistent `packages/i18n/package.json` copies.
2. **Production SMS Configuration ([`render.yaml`](file:///v:/Cascade/Edu_core/Edu_core/render.yaml)):**
   - Removed `SMS_PROVIDER: mock` and `ALLOW_MOCK_SMS_IN_PROD: "true"`.
3. **Attendance Router Optimization ([`backend/src/server/routers/attendance.ts`](file:///v:/Cascade/Edu_core/Edu_core/backend/src/server/routers/attendance.ts)):**
   - `getSectionStudents`: Strictly restricted to `TEACHER`, `PRINCIPAL`, `SCHOOL_ADMIN`, `SUPER_ADMIN` and verified `section.schoolId === session.schoolId`.
   - `markSectionAttendance`: Converted row-by-row queries into a single batch upsert in a single transaction, paired with a single aggregated DPDP audit log insert.

---

## 4. Verification Evidence & Quality Gates

### 1. Backend Test Suite Output
```
 RUN  v1.6.1 backend

 ✓ src/lib/__tests__/s4_rls_proofs.test.ts  (6 tests) 363ms
 ✓ src/lib/__tests__/sms.test.ts  (9 tests) 1249ms
 ✓ src/lib/__tests__/encryption.test.ts  (10 tests) 15ms
 ✓ src/lib/__tests__/gradeEngine.test.ts  (20 tests) 16ms
 ✓ src/lib/__tests__/payrollEngine.test.ts  (13 tests) 12ms
 ✓ src/lib/__tests__/financeQueryBudget.test.ts  (11 tests) 17ms
 ✓ src/lib/__tests__/profileCompleteness.test.ts  (7 tests) 32ms
 ✓ src/lib/__tests__/advanceFeesEngine.test.ts  (7 tests) 26ms
 ✓ src/lib/__tests__/parentFinanceReadiness.test.ts  (10 tests) 36ms
 ✓ src/lib/__tests__/feeAssignmentEngine.test.ts  (4 tests) 17ms
 ✓ src/lib/__tests__/serverAuth.test.ts  (6 tests) 30ms
 ✓ src/workers/__tests__/retentionLifecycle.test.ts  (5 tests) 39ms
 ...

 Test Files  27 passed (27)
      Tests  183 passed (183)
```

### 2. Frontend Test Suite Output
```
 Test Files  19 passed (19)
      Tests  137 passed (137)
```

### 3. Monorepo Type Check & Linting
- `turbo run type-check`: 6 packages successful, 0 errors.
- `next lint`: 0 errors.
- `db:check-migrations`: 32/32 migration sequence synchronized with journal.

---

## 5. Live Production Probe & 3-Way SHA Match (`PF-R00`)

### Verification Matrix
- **Local HEAD:** [`40771d6`](https://github.com/cascadetechnologiesbackend-ship-it/Edu_core/commit/40771d6) / [`c2469eb`](https://github.com/cascadetechnologiesbackend-ship-it/Edu_core/commit/c2469eb)
- **Origin/Main:** [`40771d6`](https://github.com/cascadetechnologiesbackend-ship-it/Edu_core/commit/40771d6) / [`c2469eb`](https://github.com/cascadetechnologiesbackend-ship-it/Edu_core/commit/c2469eb)
- **Deployed Render Host:** `https://edu-core-um1o.onrender.com`

### Production `/api/health` Probe Result
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "version": "0.1.0",
  "commit": "c2469eb4d51cd6dedd8a58da876e0b6d233168fa",
  "uptime": 8,
  "timestamp": "2026-10-12T05:20:53.044Z",
  "durationMs": 68
}
```

The live environment reflects commit `c2469eb`, with database and redis reporting `ok` and execution duration well within latency budgets. Full evidence is committed to [`docs/release-evidence/s5-rls-runtime.md`](file:///v:/Cascade/Edu_core/Edu_core/docs/release-evidence/s5-rls-runtime.md).
