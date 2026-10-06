# 30 — Remediation Roadmap
## SchoolMitra ERP

Priority order: Risk reduction → Data safety → Security → Reliability → Operational capability

---

## Phase 0 — MUST FIX BEFORE ANY PRODUCTION DEPLOYMENT

These are production blockers. Do not deploy until all Phase 0 items are complete.

---

### TASK-001 — Remove Hardcoded Fallback Secrets

```
Task ID: TASK-001
Title: Fail-fast on missing AUTH_SECRET and ENCRYPTION_KEY

Problem:
  auth.config.ts and encryption.ts fall back to publicly-known hardcoded strings
  when AUTH_SECRET/ENCRYPTION_KEY env vars are absent. Any attacker with source
  code access can forge JWTs and decrypt all encrypted PII.

Root Cause: Developer convenience — hardcoded fallbacks for zero-config local dev.

Affected Areas:
  - backend/src/lib/auth/auth.config.ts
  - backend/src/lib/encryption.ts
  - All encrypted PII fields in database

Required Changes:
  1. Replace resolveAuthSecret() and resolveKey() with throw-on-missing logic:
     if (!secret && NODE_ENV === 'production') throw new Error("FATAL: AUTH_SECRET required")
  2. Add a startup env validation module (e.g., src/env.ts using Zod):
     AUTH_SECRET: z.string().min(32)
     ENCRYPTION_KEY: z.string().length(64)
     DATABASE_URL: z.string().url()
     REDIS_URL: z.string().url()
  3. Remove DEFAULT_DEV_KEY constant
  4. Update .env.local.example with all required variables

Deployment Changes: Set AUTH_SECRET and ENCRYPTION_KEY in Render.com env vars

Validation: Application refuses to start if AUTH_SECRET missing

Estimated Complexity: LOW
Dependencies: None
```

---

### TASK-002 — Remove TEST_AUTH_USER Authentication Bypass

```
Task ID: TASK-002
Title: Eliminate auth bypass environment variable

Problem:
  serverAuth.ts allows complete authentication bypass if TEST_AUTH_USER env var
  is set. A misconfigured production environment exposes full platform access.

Root Cause: Testing convenience — E2E tests inject pre-authenticated sessions.

Affected Areas:
  - backend/src/lib/serverAuth.ts — getCachedSession()
  - All E2E tests that use TEST_AUTH_USER injection

Required Changes:
  1. Remove the TEST_AUTH_USER block from serverAuth.ts entirely
  2. Implement E2E auth using Playwright storageState:
     - Create seeded test users in test DB
     - Use playwright.config.ts globalSetup to authenticate and save storageState
     - Use fixture pattern (auth.fixture.ts) to restore state
  3. Ensure test fixtures do not depend on process.env for session injection

Testing Changes: Rewrite E2E fixtures to use Playwright storageState pattern

Estimated Complexity: MEDIUM
Dependencies: TASK-001 (secrets must be configured for test auth to work)
```

---

### TASK-003 — Resolve Migration Sequence Number Conflicts

```
Task ID: TASK-003
Title: Fix duplicate migration sequence numbers and verify production schema

Problem:
  Three pairs of migration files share sequence numbers (0001, 0002, 0006).
  Running db:migrate may skip one file from each pair, leaving production schema
  missing critical migrations.

Root Cause: Manual migration files created with conflicting numbers.

Affected Areas:
  - database/src/migrations/
  - drizzle migration journal (meta/_journal.json)
  - Production database schema

Required Changes:
  1. Take a snapshot of current production database schema
  2. Identify which files from each conflict pair have been applied
  3. Rename unapplied conflicting files to unique high sequence numbers (0011, 0012, 0013)
  4. Re-generate the Drizzle migration journal to reflect actual applied state
  5. Test on a database clone: apply all migrations and compare schema
  6. Add CI check: fail if any two migration files share a sequence number prefix

Migration Strategy:
  - DO NOT simply delete conflicting files — they may contain applied changes
  - Audit the production DB schema column-by-column against schema TypeScript files
  - Use the drizzle-kit introspect command to compare

Estimated Complexity: MEDIUM
Dependencies: Production database access for schema audit
```

---

## Phase 1 — MUST FIX BEFORE LAUNCH

---

### TASK-004 — Fix Broken Dockerfile

```
Task ID: TASK-004
Title: Correct Dockerfile paths for actual monorepo structure

Problem:
  Dockerfile references apps/web/ and @schoolmitra/web which do not exist.
  The actual paths are frontend/ and @schoolmitra/frontend.

Required Changes:
  1. Update all COPY and RUN commands to use correct paths
  2. Add COPY for all required packages (backend, database, validators, dpdp)
  3. Verify standalone output mode works with NEXT_OUTPUT_STANDALONE=true
  4. Test Docker build locally

Estimated Complexity: LOW
Dependencies: None
```

---

### TASK-005 — Authenticate Admission Endpoints

```
Task ID: TASK-005
Title: Require authentication for admission upload and submit procedures

Problem:
  getUploadUrl and submitApplication use publicProcedure — no auth required.
  Anonymous users can generate S3 upload URLs and write PII to any school.

Required Changes:
  1. Change getUploadUrl to protectedProcedure (authenticated user minimum)
     OR: Create a school-context procedure that derives schoolId from host
  2. Change submitApplication to derive schoolId from request host/slug context
     Remove schoolId from client-supplied input schema
  3. Add file type allowlist (PDF, JPEG, PNG) in getUploadUrl
  4. Add file size limit in getUploadUrl

API Changes: createAdmissionApplicationSchema must remove schoolId from client input

Testing Changes: Update E2E admission tests to use authenticated context

Estimated Complexity: LOW
Dependencies: TASK-002 (E2E auth refactor)
```

---

### TASK-006 — Add CI/CD Pipeline

```
Task ID: TASK-006
Title: Add automated quality gates before deployment

Problem:
  No CI pipeline exists — broken code, type errors, failing tests, and security
  regressions deploy to production without detection.

Required Changes:
  .github/workflows/ci.yml:
    - pnpm install --frozen-lockfile
    - pnpm type-check
    - pnpm lint
    - pnpm test
    - Docker build verification
    - pnpm audit (dependency vulnerabilities)

  .github/workflows/e2e.yml (on staging):
    - Deploy to staging
    - pnpm test:e2e
    - Smoke test production health endpoint

Estimated Complexity: MEDIUM
Dependencies: TASK-002 (E2E auth), TASK-004 (working Dockerfile)
```

---

### TASK-007 — Configure Database Backup Strategy

```
Task ID: TASK-007
Title: Enable and verify production database backups

Problem:
  No backup configuration in repository. Data loss risk unmitigated.

Required Changes:
  1. Enable Render.com PostgreSQL automated backups (daily minimum)
  2. Define RPO (target: 24 hours) and RTO (target: 4 hours)
  3. Document restore procedure in RUNBOOK.md
  4. Schedule quarterly restore test
  5. Configure backup retention (minimum 30 days)
  6. For DPDP compliance: confirm backup encryption

Estimated Complexity: LOW (infrastructure config)
Dependencies: None
```

---

### TASK-008 — Wrap Fee Assignment Engine in Transaction

```
Task ID: TASK-008
Title: Add database transaction to feeAssignmentEngine

Problem:
  autoAssignFeeStructuresToStudent() inserts fee_invoices in a loop without
  a transaction. Partial failure leaves inconsistent fee obligations.

Required Changes:
  backend/src/lib/feeAssignmentEngine.ts:
    - Wrap the invoice generation loop in db.transaction(async (tx) => { ... })
    - Pass tx to all queries inside the loop
    - Add error handling that logs and rethrows

Testing Changes: Add unit test for partial failure scenario

Estimated Complexity: LOW
Dependencies: None
```

---

### TASK-009 — Audit Server Actions for requireAuth() Coverage

```
Task ID: TASK-009
Title: Verify every Server Action has authentication guard

Problem:
  The vast majority of features use Server Actions not tRPC. tRPC middleware
  does not apply to Server Actions. Each Server Action must call requireAuth()
  explicitly — omission is silent.

Required Changes:
  1. Enumerate all Server Action files (search for "use server" directive)
  2. For each: verify requireAuth() is called before any DB query
  3. Add ESLint rule: flag "use server" files missing requireAuth import
  4. Fix any unguarded Server Actions found

Estimated Complexity: MEDIUM (scope depends on Server Action count)
Dependencies: None
```

---

### TASK-010 — Enable Production Structured Logging

```
Task ID: TASK-010
Title: Enable pino structured logging in production

Problem:
  tRPC timing logs are suppressed in production. No structured request logging.
  Production incidents cannot be diagnosed.

Required Changes:
  1. Remove NODE_ENV === 'development' guard from tRPC timingMiddleware
  2. Add correlation request ID to every log entry
  3. Ensure no PII fields are logged (verify log schema)
  4. Add log levels: info for requests, warn for auth failures, error for exceptions
  5. Configure pino to output JSON in production (not pino-pretty)

Estimated Complexity: MEDIUM
Dependencies: None
```

---

### TASK-011 — Scope SUPER_ADMIN Role Bypass

```
Task ID: TASK-011
Title: Apply role checks to impersonated SUPER_ADMIN sessions

Problem:
  SUPER_ADMIN bypasses all withRole() checks even when impersonating.
  A compromised SUPER_ADMIN token gives unrestricted platform access.

Required Changes:
  1. When impersonating (effectiveRole = "SCHOOL_ADMIN"), apply full role checks
  2. SUPER_ADMIN in non-impersonation context: restrict to platform-level routes only
  3. Add audit event on every cross-tenant SUPER_ADMIN action

Estimated Complexity: MEDIUM
Dependencies: None
```

---

### TASK-012 — Add TOTP Enforcement for SUPER_ADMIN

```
Task ID: TASK-012
Title: Enforce TOTP/2FA for Super Admin accounts

Problem:
  TOTP schema and otplib dependency exist but TOTP is not enforced in authorize().
  SUPER_ADMIN accounts have platform-wide access without MFA.

Required Changes:
  1. After password verification for superAdminUsers, check totpEnabled
  2. If totpEnabled: return partial credential (no schoolId, no role) → require second factor
  3. Implement TOTP verification UI step (code input after password)
  4. On successful TOTP: mint full session
  5. For regular users: make TOTP optional (school admin can enforce per school)

Estimated Complexity: HIGH
Dependencies: None
```

---

## Phase 2 — SHOULD FIX BEFORE LAUNCH

| Task | Description | Complexity |
|------|-------------|-----------|
| TASK-013 | Add startup environment variable validation (Zod schema) | LOW |
| TASK-014 | Move school cache from in-memory Map to Redis | LOW |
| TASK-015 | Use dedicated IMPERSONATION_SECRET (separate from AUTH_SECRET) | LOW |
| TASK-016 | Verify and scope S3 file paths to include schoolId prefix | MEDIUM |
| TASK-017 | Verify Razorpay webhook signature verification | LOW (verify) |
| TASK-018 | Upgrade xlsx to ExcelJS or patched version | MEDIUM |
| TASK-019 — Add missing FK constraints on fee_invoices.studentId | LOW | |
| TASK-020 | Add down migrations for critical schema changes | HIGH |
| TASK-021 | Fix fileSizeBytes column type (text → bigint) | LOW |
| TASK-022 | Enable reactStrictMode in next.config.mjs | MEDIUM |

---

## Phase 3 — POST-LAUNCH

| Task | Description | Complexity |
|------|-------------|-----------|
| TASK-023 | Create operational runbook (deployment, rotation, incident response) | MEDIUM |
| TASK-024 | Implement role-change JWT refresh mechanism (< 5 min propagation) | MEDIUM |
| TASK-025 | PostgreSQL Row Level Security as defense-in-depth | HIGH |
| TASK-026 | Add application performance monitoring (APM) | MEDIUM |
| TASK-027 | Add /api/health detailed health check (DB, Redis, S3) | LOW |
| TASK-028 | Add horizontal scaling support (Redis session store) | HIGH |
| TASK-029 | Implement sequential invoice number generator | LOW |
| TASK-030 | Implement password complexity requirements | LOW |
