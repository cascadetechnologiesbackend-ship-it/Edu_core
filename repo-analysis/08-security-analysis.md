# 08 — Security Analysis
## SchoolMitra ERP

---

## Summary

| Severity | Count |
|----------|-------|
| P0 — CRITICAL | 3 |
| P1 — HIGH | 6 |
| P2 — MEDIUM | 7 |
| P3 — LOW | 3 |

---

## P0 — CRITICAL

---

### SEC-001

```
ID: SEC-001
Title: Hardcoded Fallback Secrets for JWT and PII Encryption

Severity: P0 — CRITICAL
Category: Cryptographic Weakness / Secret Management
Stream: Authentication, Privacy

Status: VERIFIED

Location:
  File: backend/src/lib/auth/auth.config.ts — resolveAuthSecret()
  File: backend/src/lib/encryption.ts — resolveKey() / DEFAULT_DEV_KEY

Observed Behavior:
  When AUTH_SECRET (or NEXTAUTH_SECRET) is not set, auth.config.ts returns
  the hardcoded string "schoolmitra-erp-auth-secret-fallback-key-min-64-characters-long-key!!"
  When ENCRYPTION_KEY is not set, encryption.ts returns
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  Both functions only emit a console.warn in production — they do not abort.

Expected Behavior:
  Missing critical secrets must cause the application to fail at startup with
  a clear fatal error, not silently use hardcoded fallbacks.

Why It Matters:
  The JWT signing secret is publicly visible in this source repository.
  Any attacker with read access to this repo can forge JWT tokens for any user
  (including SUPER_ADMIN) without credentials. The encryption key is also
  publicly known, meaning all encrypted PII (names, contacts, medical data,
  bank accounts, Aadhaar last-4) can be decrypted by reading the source code.

Evidence:
  backend/src/lib/auth/auth.config.ts:
    return "schoolmitra-erp-auth-secret-fallback-key-min-64-characters-long-key!!";
  backend/src/lib/encryption.ts:
    const DEFAULT_DEV_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

Root Cause:
  Developer convenience — hardcoded fallbacks allow the application to run
  without configuration during development. The production guard is insufficient
  (warn-only, not fail-fast).

Impact:
  - Complete JWT forgery → any user account can be impersonated
  - All PII encrypted with the fallback key is decryptable
  - SUPER_ADMIN impersonation possible without credentials
  - DPDP Act 2023 data protection obligations are unmet

Risk Scenario:
  Developer pushes to Render.com without setting AUTH_SECRET. Application
  starts and appears functional. Attacker reads source code, crafts a valid
  JWT with role=SUPER_ADMIN, accesses all school tenants and student PII.

Recommended Action:
  1. Replace both resolveAuthSecret() and resolveKey() with fail-fast logic:
     if (!key && process.env.NODE_ENV === 'production') throw new Error("FATAL: AUTH_SECRET not configured")
  2. Add startup env validation (Zod schema or similar)
  3. Remove DEFAULT_DEV_KEY constant entirely; use .env.local for development

Prevention:
  Environment variable validation at application startup with explicit fatal errors.

Validation Method:
  Deploy without AUTH_SECRET set; verify application refuses to start.

Estimated Complexity: LOW
```

---

### SEC-002

```
ID: SEC-002
Title: TEST_AUTH_USER Environment Variable Bypasses Entire Authentication Stack

Severity: P0 — CRITICAL
Category: Authentication Bypass
Stream: Authentication

Status: VERIFIED

Location:
  File: backend/src/lib/serverAuth.ts — getCachedSession()
  Lines: ~25-32

Observed Behavior:
  If process.env.TEST_AUTH_USER is set to a JSON string, getCachedSession()
  returns that parsed object as the session without calling NextAuth auth().
  requireAuth() treats this as a fully authenticated session.

Expected Behavior:
  Authentication bypass mechanisms must be unconditionally absent in production
  builds or fully isolated to test environments via test framework injection,
  never via environment variables readable from the production process.

Why It Matters:
  Any actor with the ability to set environment variables on the production
  server can impersonate any user, including SUPER_ADMIN, accessing all tenant
  data and PII without leaving auth credentials in the database.

Evidence:
  backend/src/lib/serverAuth.ts:
    if (process.env.NODE_ENV !== 'production' && process.env.TEST_AUTH_USER) {
      try { session = JSON.parse(process.env.TEST_AUTH_USER); } catch { ... }
    }
  Note: The guard checks NODE_ENV !== 'production', but the condition is
  process.env.NODE_ENV. On Render.com, NODE_ENV is set in the build command
  but could be misconfigured or overridden in a misconfigured deployment.

Root Cause:
  Testing convenience — E2E tests inject a pre-authenticated session via
  environment variable. This approach is architectural — test auth should
  use test doubles or Playwright storageState, not process env.

Impact:
  Complete authentication bypass. All data in the system accessible.

Risk Scenario:
  Render.com environment variables are misconfigured; TEST_AUTH_USER is
  accidentally set in the production environment. All requests bypass auth.

Recommended Action:
  1. Remove TEST_AUTH_USER from serverAuth.ts entirely.
  2. Implement E2E auth using Playwright storageState + seeded test users.
  3. If testing bypass is truly needed, implement as a test middleware that
     is excluded from production builds via build-time flag, not runtime env.

Estimated Complexity: MEDIUM
```

---

### SEC-003

```
ID: SEC-003
Title: Migration Sequence Number Conflicts — Schema Drift Risk

Severity: P0 — CRITICAL
Category: Data Integrity / Deployment
Stream: Database, Migrations

Status: VERIFIED

Location:
  Directory: database/src/migrations/
  Files: 0001_lame_shooting_star.sql AND 0001_perf_indexes.sql
         0002_auth_tokens.sql AND 0002_cuddly_colossus.sql
         0006_admission_blood_group.sql AND 0006_huge_ultimates.sql

Observed Behavior:
  Three pairs of migration files share the same sequence number prefix.
  Drizzle Kit's migration runner uses file names to determine migration order
  and tracks executed migrations by name in the drizzle migration journal.

Expected Behavior:
  Each migration file must have a unique sequence number. Duplicate numbers
  cause the migration runner to execute one and skip or error on the other,
  resulting in missing schema changes.

Why It Matters:
  The database schema in production may be missing critical migrations.
  Application code that depends on columns/tables added in the skipped
  migration will produce runtime errors or silently corrupt data.

Evidence:
  Directory listing shows:
  0001_lame_shooting_star.sql, 0001_perf_indexes.sql (both present)
  0002_auth_tokens.sql, 0002_cuddly_colossus.sql (both present)
  0006_admission_blood_group.sql, 0006_huge_ultimates.sql (both present)

Root Cause:
  Migration files created out-of-band (manually written, not via drizzle-kit generate)
  were given numbers that conflicted with generated files.

Impact:
  - Production schema may be missing performance indexes (0001_perf_indexes)
  - Production schema may be missing auth token tables (0002_auth_tokens)
  - Production schema may be missing blood group enum or fee head fields (0006_*)
  - drizzle migration journal state becomes inconsistent

Risk Scenario:
  Render.com runs `db:migrate` on deploy. One of each duplicate pair has
  already been applied. The migration runner records the first alphabetically,
  skips the second. Features depending on skipped migration columns fail silently.

Recommended Action:
  1. Audit the current production database schema against expected schema
  2. Rename conflicting files to unique sequential numbers (0011, 0012, 0013)
  3. Re-generate the Drizzle migration journal (drizzle/meta/_journal.json)
  4. Test migration run on a database clone before production deployment
  5. Implement migration validation in CI that fails on duplicate sequence numbers

Estimated Complexity: MEDIUM (requires careful production DB audit)
```

---

## P1 — HIGH

---

### SEC-004

```
ID: SEC-004
Title: Admission Document Upload URL Endpoint is Publicly Accessible

Severity: P1 — HIGH
Category: Authorization / Broken Object Level Authorization
Stream: Authorization, API, File Storage

Status: VERIFIED

Location:
  File: backend/src/server/routers/admissions.ts
  Procedure: admissionsRouter.getUploadUrl (publicProcedure)

Observed Behavior:
  getUploadUrl accepts fileName and mimeType from any caller (authenticated or not)
  and returns an S3 pre-signed upload URL for the schoolmitra-docs bucket.

Expected Behavior:
  Upload URL generation should require at minimum an authenticated session,
  and ideally a school-scoped context with CSRF protection.

Why It Matters:
  Anonymous actors can generate pre-signed S3 URLs to the production document
  bucket without any credentials. This can be used to flood storage, upload
  malicious files, or probe bucket configuration.

Evidence:
  admissions.ts: getUploadUrl: publicProcedure.input(...).mutation(async ({ input }) => {
    const key = `admissions/${crypto.randomUUID()}-${input.fileName}`;
    const url = await generateUploadUrl(key, ...);
    return { uploadUrl: url, key };
  })

Recommended Action:
  Change publicProcedure to protectedProcedure (or a school-scoped procedure).
  Add file type allowlist validation (PDF, JPEG, PNG only).
  Add file size metadata validation.

Estimated Complexity: LOW
```

---

### SEC-005

```
ID: SEC-005
Title: Admission Submit Endpoint Writes PII to Any School Without Authentication

Severity: P1 — HIGH
Category: Authorization / Mass Assignment / Broken Tenancy
Stream: Authorization, Multi-tenancy

Status: VERIFIED

Location:
  File: backend/src/server/routers/admissions.ts
  Procedure: admissionsRouter.submitApplication (publicProcedure)

Observed Behavior:
  submitApplication accepts a schoolId from the client payload and inserts
  an admission application record for that school without verifying the caller
  has any relationship to or permission for that school.

Expected Behavior:
  The schoolId must be resolved from the URL/subdomain context (trusted server-side)
  not from client-supplied input. The endpoint requires authentication.

Why It Matters:
  An attacker can enumerate school IDs (UUIDs but guessable via OSINT or prior
  access) and submit bogus admission applications with encrypted PII to any school
  in the platform, polluting their admissions pipeline.

Evidence:
  submitApplication: publicProcedure.input(createAdmissionApplicationSchema).mutation(...)
  The createAdmissionApplicationSchema includes schoolId as a client-supplied field.

Recommended Action:
  1. Resolve schoolId from the authenticated request context (subdomain/slug)
  2. Change to protectedProcedure or a school-context procedure
  3. Validate schoolId against the request origin

Estimated Complexity: LOW
```

---

### SEC-006

```
ID: SEC-006
Title: SUPER_ADMIN Role Bypasses All withRole() Checks

Severity: P1 — HIGH
Category: Authorization Design
Stream: Authorization

Status: VERIFIED

Location:
  File: backend/src/lib/serverAuth.ts — requireAuth()
  Logic: if (role !== 'SUPER_ADMIN') { check allowedRoles }

Observed Behavior:
  requireAuth() skips role enforcement for SUPER_ADMIN — a SUPER_ADMIN
  passes any allowedRoles check unconditionally.
  Similarly the tRPC withRole() middleware: the pattern at line
  "if (!userRole || !allowedRoles.includes(userRole))" does not explicitly
  check SUPER_ADMIN bypass but the serverAuth version does.

Expected Behavior:
  SUPER_ADMIN impersonating a school should adopt the effective role from the
  impersonation context and be subject to appropriate role checks, or the
  bypass must be explicitly scoped and documented.

Why It Matters:
  If a SUPER_ADMIN session token is compromised or an impersonation is
  mis-configured, the attacker operates with unrestricted access to every
  school endpoint regardless of the intended role scope.

Evidence:
  serverAuth.ts:
    if (allowedRoles && allowedRoles.length > 0 &&
        !allowedRoles.includes(effectiveRole) &&
        role !== 'SUPER_ADMIN') { throw FORBIDDEN }
  The condition `role !== 'SUPER_ADMIN'` grants full bypass.

Recommended Action:
  When SUPER_ADMIN is impersonating a school, apply the impersonated
  effectiveRole to all role checks. Document the bypass explicitly.
  Consider adding an audit event for every cross-tenant action by SUPER_ADMIN.

Estimated Complexity: MEDIUM
```

---

### SEC-007

```
ID: SEC-007
Title: Dockerfile References Incorrect Paths — Build is Broken

Severity: P1 — HIGH (blocks production deployment)
Category: Deployment / Infrastructure
Stream: CI/CD, Deployment

Status: VERIFIED

Location:
  File: frontend/Dockerfile

Observed Behavior:
  Dockerfile COPY commands reference `apps/web/` and package `@schoolmitra/web`:
    COPY apps/web/package.json ./apps/web/
    RUN pnpm --filter @schoolmitra/web build
  The actual application lives at `frontend/` and is named `@schoolmitra/frontend`.

Expected Behavior:
  Dockerfile should reference `frontend/` and `@schoolmitra/frontend`.

Why It Matters:
  Docker builds will fail. The containerized deployment path is completely broken.

Evidence:
  Dockerfile line 9: COPY apps/web/package.json ./apps/web/
  frontend/package.json: "name": "@schoolmitra/frontend"

Recommended Action:
  Update Dockerfile to use correct paths:
    COPY frontend/package.json ./frontend/
    RUN pnpm --filter @schoolmitra/frontend build

Estimated Complexity: LOW
```

---

### SEC-008

```
ID: SEC-008
Title: No CI/CD Pipeline — Broken Code or Misconfigured Secrets Deploy Silently

Severity: P1 — HIGH
Category: DevSecOps / Process
Stream: CI/CD

Status: MISSING

Location:
  Repository root — no .github/workflows/, no .gitlab-ci.yml, no CI config found.
  render.yaml — build command runs migrations + build, no test/lint/type-check step.

Observed Behavior:
  Any push to the deployment branch triggers a build+deploy via Render.com
  with no automated test execution, type checking, or security scanning.

Expected Behavior:
  A production pipeline should: lint → type-check → unit tests → security scan
  → build → deploy → smoke test.

Why It Matters:
  P0 security regressions (like removing the TEST_AUTH_USER guard accidentally)
  would be deployed to production without detection.

Recommended Action:
  Add GitHub Actions (or equivalent) with:
  - pnpm lint
  - pnpm type-check
  - pnpm test
  - pnpm test:e2e (on staging)
  - Dependency vulnerability scan (npm audit / Snyk)
  - Dockerfile build verification

Estimated Complexity: MEDIUM
```

---

### SEC-009

```
ID: SEC-009
Title: No Backup Strategy Present in Repository

Severity: P1 — HIGH
Category: Recovery / Data Risk
Stream: Recovery, Operations

Status: MISSING

Location:
  Repository-wide — no backup configuration, no restore procedure found.
  render.yaml — no database backup configuration.

Observed Behavior:
  No evidence of scheduled database backups, point-in-time recovery
  configuration, or backup testing procedure.

Expected Behavior:
  Production database must have daily (minimum) automated backups with
  defined RPO/RTO and tested restore procedure.

Why It Matters:
  A migration failure, data corruption, or infrastructure incident could cause
  permanent data loss of student records, financial data, and audit logs.

Recommended Action:
  1. Enable Render.com PostgreSQL automated backups
  2. Define and document RPO/RTO targets
  3. Create restore runbook
  4. Schedule quarterly restore tests

Estimated Complexity: LOW (infrastructure config)
```

---

## P2 — MEDIUM

---

### SEC-010

```
ID: SEC-010
Title: In-Process School Cache Not Shared Across Server Instances

Severity: P2 — MEDIUM
Category: Multi-tenancy / Cache Isolation
Stream: Multi-tenancy, Caching

Status: INFERRED

Location:
  File: backend/src/lib/serverAuth.ts — schoolCache Map

Observed Behavior:
  requireSchool() uses an in-memory Map with 60-second TTL to cache school records.
  On multi-instance deployments (or serverless restarts), each instance has
  its own independent cache.

Why It Matters:
  If a school is suspended (isActive = false), the suspension may not take
  effect for up to 60 seconds per instance. In serverless/multi-instance
  deployments, some instances may serve the school indefinitely if the
  in-memory cache is never explicitly invalidated.

Recommended Action:
  Move school cache to Redis (already available in the stack) with
  schoolId-keyed invalidation on school status changes.

Estimated Complexity: LOW
```

---

### SEC-011

```
ID: SEC-011
Title: xlsx Dependency Has Known Security Vulnerabilities

Severity: P2 — MEDIUM
Category: Supply Chain
Stream: Dependencies

Status: VERIFIED

Location:
  frontend/package.json: "xlsx": "^0.18.5"

Observed Behavior:
  SheetJS Community Edition (xlsx) version 0.18.5 has reported vulnerabilities
  including prototype pollution and ReDoS issues.

Recommended Action:
  Evaluate migration to xlsx ^0.20.x or to ExcelJS (actively maintained, MIT).

Estimated Complexity: MEDIUM
```

---

### SEC-012

```
ID: SEC-012
Title: TOTP/2FA Schema Exists But Enforcement Is Unverified

Severity: P2 — MEDIUM (P1 if SUPER_ADMIN does not use MFA)
Category: Authentication
Stream: Authentication

Status: UNKNOWN

Location:
  database/src/schema/core.ts — users.totpSecret, users.totpEnabled
  database/src/schema/core.ts — superAdminUsers.totpSecret, superAdminUsers.totpEnabled
  backend/src/lib/auth/index.ts — authorize() callback does not check totpEnabled

Observed Behavior:
  The database schema supports TOTP with otplib. The authorize() function
  does not verify TOTP even when totpEnabled = true.

Impact:
  If TOTP enforcement is truly absent, SUPER_ADMIN accounts have no MFA
  protection despite holding platform-wide access privileges.

Recommended Action:
  Implement TOTP verification in the authorize() callback after password
  verification. Return a partial credential that requires a second-factor
  verification step.

Estimated Complexity: HIGH
```

---

### SEC-013

```
ID: SEC-013
Title: Razorpay Webhook Signature Verification Not Confirmed

Severity: P2 — MEDIUM
Category: Webhook Security
Stream: Integrations, API

Status: UNKNOWN

Location:
  frontend/src/middleware.ts — /api/webhooks/* bypasses auth
  Webhook implementation files: NOT REVIEWED (not found in file tree scan)

Why It Matters:
  Webhook endpoints that bypass JWT auth must perform cryptographic signature
  verification using the Razorpay secret. Without this, any actor can forge
  payment confirmation events and mark invoices as paid.

Recommended Action:
  Locate webhook handler and verify: crypto.timingSafeEqual comparison of
  razorpay_signature header using RAZORPAY_SECRET.

Estimated Complexity: LOW (verify) / MEDIUM (implement if missing)
```

---

### SEC-014

```
ID: SEC-014
Title: Fee Assignment Engine Lacks Database Transaction

Severity: P2 — MEDIUM (P1 for financial data integrity)
Category: Data Integrity / Transactions
Stream: Backend, Database

Status: VERIFIED

Location:
  File: backend/src/lib/feeAssignmentEngine.ts — autoAssignFeeStructuresToStudent()

Observed Behavior:
  The function loops over fee structures and inserts fee_invoices records one
  by one. There is no wrapping database transaction. If the process fails
  mid-loop, some invoices are created and others are not.

Why It Matters:
  Partial invoice creation leaves a student with inconsistent fee obligations
  (some fees assigned, others missing). Financial reporting will be incorrect.

Recommended Action:
  Wrap the entire loop in a Drizzle transaction:
  await db.transaction(async (tx) => { ... all inserts ... })

Estimated Complexity: LOW
```

---

### SEC-015

```
ID: SEC-015
Title: reactStrictMode Disabled — Masks React Bug Detection

Severity: P2 (development quality risk)
Category: Code Quality
Stream: Frontend

Status: VERIFIED

Location:
  frontend/next.config.mjs: reactStrictMode: false

Observed Behavior:
  React Strict Mode is intentionally disabled to prevent double-rendering in dev.

Why It Matters:
  Strict Mode detects side effects in rendering, deprecated API usage, and
  concurrent mode issues. Disabling it prevents early detection of bugs that
  will manifest in production.

Recommended Action:
  Enable reactStrictMode: true. Optimize DB queries to handle the double-render
  by using React cache() or proper memoization patterns.

Estimated Complexity: MEDIUM (may require fixing side effects exposed)
```

---

### SEC-016

```
ID: SEC-016
Title: Impersonation Token Uses Same Secret as JWT Session

Severity: P2 — MEDIUM
Category: Cryptographic Design
Stream: Authentication, Multi-tenancy

Status: VERIFIED

Location:
  File: backend/src/lib/impersonation.ts — getSecret()

Observed Behavior:
  getSecret() returns AUTH_SECRET — the same secret used by NextAuth for JWTs.

Why It Matters:
  If AUTH_SECRET is rotated (e.g., after a security incident), all JWT sessions
  AND all impersonation tokens are simultaneously invalidated. Using a separate
  secret for impersonation tokens would allow independent rotation.

Recommended Action:
  Add a dedicated IMPERSONATION_SECRET environment variable.

Estimated Complexity: LOW
```

---

## P3 — LOW

---

### SEC-017

```
ID: SEC-017
Title: Invoice Numbers Use Math.random() — Collision Risk at Scale

Severity: P3 — LOW
Category: Data Integrity
Stream: Backend

Status: VERIFIED

Location:
  File: backend/src/lib/feeAssignmentEngine.ts — autoAssignFeeStructuresToStudent()
  Code: crypto.randomBytes(4).toString("hex").toUpperCase()

Observed Behavior:
  Invoice numbers are generated as INV-{YEAR}-{4-byte-hex}. A 4-byte space gives
  ~4 billion possible values but collisions become probable at tens of thousands
  of invoices. The unique constraint on (schoolId, invoiceNumber) will catch
  duplicates but does not retry on collision.

Recommended Action:
  Use a sequential counter (database sequence) instead of random bytes.

Estimated Complexity: LOW
```

---

### SEC-018

```
ID: SEC-018
Title: Production Logs Suppressed — No Structured Production Logging

Severity: P3 — LOW (P2 for observability)
Category: Observability
Stream: Observability

Status: VERIFIED

Location:
  File: backend/src/server/trpc.ts — timingMiddleware
  Code: if (process.env['NODE_ENV'] === 'development') { trpcLogger.info(...) }

Observed Behavior:
  tRPC request timing logs are suppressed in production. Production has no
  structured request logging.

Recommended Action:
  Enable pino structured logging in production for all tRPC requests
  (sanitized — no PII). Add request ID correlation.

Estimated Complexity: MEDIUM
```

---

### SEC-019

```
ID: SEC-019
Title: No Startup Environment Validation

Severity: P3 (consequence upgrades to P0 via SEC-001)
Category: Configuration
Stream: Deployment, Configuration

Status: MISSING

Location:
  Repository-wide — no application startup validation file found.

Observed Behavior:
  The application starts and serves requests regardless of whether critical
  environment variables are configured.

Recommended Action:
  Add a startup validation module (e.g., env.ts using Zod) that throws a
  fatal error listing all missing required variables.

Estimated Complexity: LOW
```
