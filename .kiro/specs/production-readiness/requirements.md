# Requirements Document

## Introduction

SchoolMitra ERP is a multi-tenant school management SaaS platform for Indian schools (Nursery–Class 10) currently in a **NOT READY** state based on a full-stream production readiness audit (`repo-analysis/`). The audit identified 3 P0 blockers, 9 P1 issues, 10 P2 improvements, and 8 P3 post-launch items spanning security, database integrity, authorization, CI/CD, observability, and operations.

This document defines all requirements to bring the system to **PRODUCTION READY** status. It covers four priority phases, DPDP Act 2023 compliance, operational runbooks, and performance baselines.

### Background

The system handles student PII encrypted with AES-256-CBC, financial records, HR/payroll data, and must comply with India's Digital Personal Data Protection Act 2023. Three P0 security/integrity blockers currently prevent any production deployment: (1) hardcoded fallback secrets enabling JWT forgery, (2) a `TEST_AUTH_USER` env var that bypasses authentication entirely, (3) three pairs of migration files with duplicate sequence numbers causing schema drift.

### Scope

All work required to pass the 12 production readiness gates: Build · Type Validation · Tests · Security · Authorization · Data Integrity · Observability · Backup/Recovery · Deployment · Rollback · Performance · Operational Readiness.

### Out of Scope

New product features not in the codebase, UI redesign, platform migration, and changes to DPDP schema tables (additive only).

## Requirements

### Requirement 1: Fail-Fast on Missing Secrets

**User Story:** As the platform operator, I want the application to refuse to start in production when critical secrets are absent, so that a misconfigured deployment does not silently expose forged JWTs or decryptable PII.

#### Acceptance Criteria

1. Starting the application without `AUTH_SECRET` set in `NODE_ENV=production` causes an immediate fatal process exit with a message naming the missing variable
2. Starting without `ENCRYPTION_KEY` behaves identically
3. The hardcoded fallback string in `backend/src/lib/auth/auth.config.ts` is removed with no replacement fallback
4. The `DEFAULT_DEV_KEY` constant in `backend/src/lib/encryption.ts` is removed with no replacement fallback
5. A startup env validation module validates at minimum: `AUTH_SECRET` (min 32 chars), `ENCRYPTION_KEY` (exactly 64 hex chars), `DATABASE_URL`, `REDIS_URL`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
6. A `.env.local.example` file documents all required and optional env vars with descriptions and generation instructions
7. Development mode continues to work via `.env.local` with lenient validation when `NODE_ENV=development`; `NODE_ENV` strictly governs validation mode and the presence of a `.env.local` file never relaxes validation rules when `NODE_ENV=production`
8. CI verifies the application exits with code 1 when deployed without `AUTH_SECRET`

### Requirement 2: Remove TEST_AUTH_USER Authentication Bypass

**User Story:** As a security engineer, I want the `TEST_AUTH_USER` environment variable authentication bypass removed from all production code paths, so that no deployment configuration can accidentally expose full platform access without credentials.

#### Acceptance Criteria

1. The `TEST_AUTH_USER` block is removed from `backend/src/lib/serverAuth.ts` `getCachedSession()`
2. No equivalent env-variable-based authentication bypass exists anywhere in the codebase after this change
3. All E2E tests previously relying on `TEST_AUTH_USER` are rewritten to use Playwright `storageState`
4. `playwright.config.ts` uses `globalSetup` to authenticate each test role and save `storageState` files per role
5. E2E fixtures restore auth state from `storageState` files, not from environment variables
6. All 13 existing E2E test files pass using the new auth mechanism

### Requirement 3: Resolve Migration Sequence Number Conflicts

**User Story:** As a platform engineer, I want migration files to have unique sequence numbers and a verified migration journal, so that `db:migrate` on deployment produces the correct schema without silently skipping migrations.

#### Acceptance Criteria

1. No two migration files in `database/src/migrations/` share the same numeric sequence prefix
2. The Drizzle migration journal (`meta/_journal.json`) accurately reflects the applied state of every migration file
3. Running all migrations from scratch on a clean database produces a schema exactly matching the TypeScript schema definitions
4. The resolution is tested on both a fresh database and a clone of the production database before deployment
5. Detecting any two migration files that share a sequence prefix is sufficient to fail the CI check; the result is independent of any other pipeline state
6. Renamed migration files carry a comment explaining their provenance

### Requirement 4: Fix Broken Dockerfile

**User Story:** As a DevOps engineer, I want the Dockerfile to build successfully and produce a working containerized image, so that the containerized deployment path is available as an alternative to the Render.com direct deploy.

#### Acceptance Criteria

1. `docker build` completes successfully from the repository root
2. The built image starts and serves requests on port 3000
3. All COPY and RUN commands reference `frontend/` and `@schoolmitra/frontend` (not `apps/web`)
4. All workspace packages (backend, database, validators, dpdp) are included in the build context
5. `NEXT_OUTPUT_STANDALONE=true` produces a working standalone image

### Requirement 5: Authenticate Admission Endpoints

**User Story:** As a security engineer, I want admission form endpoints to require authentication and derive school context from the server, so that anonymous users cannot generate S3 upload URLs or write PII records to arbitrary school tenants.

#### Acceptance Criteria

1. `admissions.getUploadUrl` requires an authenticated session (minimum `protectedProcedure`)
2. `admissions.submitApplication` derives `schoolId` from server-side context (subdomain/slug resolution), NOT from client input
3. `schoolId` is removed from `createAdmissionApplicationSchema` in `@schoolmitra/validators`
4. `getUploadUrl` accepts only PDF, JPEG, PNG, WEBP file types and enforces a 10 MB maximum
5. An anonymous request to either endpoint returns HTTP 401
6. A cross-tenant submission attempt returns HTTP 403

### Requirement 6: CI/CD Pipeline

**User Story:** As a DevOps engineer, I want an automated CI/CD pipeline that validates code quality and security before deployment, so that broken code, type errors, and security regressions cannot reach production.

#### Acceptance Criteria

1. A `.github/workflows/ci.yml` workflow runs on every pull request: install (frozen lockfile), type-check, lint, unit tests, Docker build, dependency audit
2. A failed CI job blocks PR merge
3. A `.github/workflows/deploy.yml` workflow triggers on merge to `main`: migration validation, Render.com deploy, post-deploy health check
4. The migration CI check validates no duplicate sequence numbers before deployment
5. E2E tests are available as a manually triggered or scheduled workflow against staging
6. All CI pipeline steps complete in under 10 minutes (excluding E2E)

### Requirement 7: Database Backup Strategy

**User Story:** As the platform operator, I want daily automated database backups with a documented restore procedure, so that a production incident does not cause permanent data loss.

#### Acceptance Criteria

1. PostgreSQL automated backups run at minimum daily frequency
2. Backup retention is minimum 30 days and backups are encrypted at rest
3. RPO target is 24 hours and RTO target is 4 hours — both documented
4. A restore procedure is documented in `docs/runbooks/database-restore.md`
5. A restore test has been performed and documented with date and outcome
6. The backup provider is added to the DPDP vendor register with data categories

### Requirement 8: Fee Assignment Transaction Safety

**User Story:** As an accountant, I want fee invoice generation to be atomic, so that a process failure mid-generation does not leave a student with a partial or inconsistent set of fee obligations.

#### Acceptance Criteria

1. `autoAssignFeeStructuresToStudent()` wraps all invoice insert operations in a single Drizzle `db.transaction()`
2. A partial failure during invoice generation results in zero invoices created (all-or-nothing)
3. `recalculateStudentInvoices()` wraps all update operations in a transaction
4. Unit tests cover the happy path, partial failure scenario, and idempotency

### Requirement 9: Server Action Authorization Audit

**User Story:** As a security engineer, I want every Server Action to be verified for authentication guards, so that the absence of tRPC middleware on Server Actions does not leave data endpoints unprotected.

#### Acceptance Criteria

1. All files containing `"use server"` are enumerated and the full list documented
2. Every Server Action accessing the database calls `requireAuth()` before the first DB query
3. An ESLint rule flags `"use server"` files importing from `@/db` without importing `requireAuth`
4. The ESLint rule runs in CI and blocks merges on violation
5. Intentionally public Server Actions carry a `// PUBLIC: <reason>` comment; the ESLint rule also verifies this comment is present when `requireAuth` is absent, so the annotation is enforced by tooling and not merely a convention
6. All Server Actions found unguarded are fixed before this requirement closes

### Requirement 10: Production Structured Logging

**User Story:** As a site reliability engineer, I want structured JSON logs emitted in production for all tRPC requests, so that production incidents can be diagnosed from log output without having to redeploy with debug logging enabled.

#### Acceptance Criteria

1. tRPC request logs are emitted in production (the `NODE_ENV === 'development'` guard is removed)
2. Production log output is newline-delimited JSON (not pino-pretty)
3. Every log entry includes `timestamp`, `level`, `requestId` (UUID per request), `path`, `durationMs`
4. Auth failure events are logged at `warn` level without email or password values
5. Uncaught server errors are logged at `error` level with sanitized stack traces containing no PII values
6. No PII field values appear in any log entry

### Requirement 11: SUPER_ADMIN Role Bypass Scoping

**User Story:** As a security engineer, I want the SUPER_ADMIN role bypass in `withRole()` to be properly scoped, so that impersonated sessions are subject to role checks and a compromised SUPER_ADMIN token does not give unrestricted platform access.

#### Acceptance Criteria

1. When SUPER_ADMIN is impersonating a school (`sm_impersonation` cookie active), `requireAuth()` applies full role checks against `effectiveRole`
2. A SUPER_ADMIN attempting a route explicitly classified as a school-tenant route (under `(admin)/`, `(principal)/`, `(teacher)/`, `(accountant)/`, `(hr-manager)/`, `(librarian)/`, `(transport-manager)/`, `(parent)/`, `(student)/`, `(driver)/` route groups) without an active impersonation cookie receives HTTP 403
3. Every cross-tenant action by SUPER_ADMIN creates an `audit_logs` entry

### Requirement 12: TOTP Enforcement for SUPER_ADMIN

**User Story:** As the platform security officer, I want TOTP enforced for all SUPER_ADMIN accounts, so that the platform operator credentials require a second factor and a leaked password alone is insufficient for access.

#### Acceptance Criteria

1. The `authorize()` callback checks `totpEnabled` for `superAdminUsers` after password verification
2. If `totpEnabled = true`, the callback returns a partial credential with `requiresTOTP: true` instead of a full session
3. The login UI renders a TOTP code input step when `requiresTOTP = true`
4. A valid TOTP code completes authentication; an invalid code increments the same lockout counter used for password failures, and once the lockout threshold (5 attempts) is reached further TOTP attempts are blocked for the lockout duration (15 minutes)
5. A TOTP setup flow exists (QR code generation, encrypted secret storage)
6. New SUPER_ADMIN accounts require TOTP setup on first login

### Requirement 13: Razorpay Webhook Signature Verification

**User Story:** As a security engineer, I want Razorpay webhook requests to be cryptographically verified, so that an attacker cannot forge a payment confirmation and mark a student's invoice as paid without actual payment.

#### Acceptance Criteria

1. The webhook handler verifies `x-razorpay-signature` via `crypto.timingSafeEqual` HMAC-SHA256
2. Failed verification returns HTTP 400 and logs a security event
3. Missing `RAZORPAY_SECRET` causes the handler to return HTTP 503 with a logged error
4. Payment status updates to `fee_invoices` only occur after successful signature verification
5. A unit test verifies that a forged webhook is rejected

### Requirement 14: BullMQ Worker Tenant Scoping

**User Story:** As a security engineer, I want BullMQ workers to scope all database operations to a specific school tenant, so that a background job cannot read or write data across school boundaries.

#### Acceptance Criteria

1. `reportCard.ts` worker scopes every DB query to `job.data.schoolId`
2. `retention.ts` worker scopes every operation to a specific `schoolId`
3. S3 operations in workers use paths prefixed with `schools/{schoolId}/`
4. If a worker detects it is about to read or write data for a `schoolId` that does not match `job.data.schoolId`, the job is immediately aborted, marked as FAILED in BullMQ, and an error is logged with severity ERROR; a unit test verifies this abort behavior
5. Workers log `schoolId` and `jobId` at the start of every job

### Requirement 15: S3 File Path School Scoping

**User Story:** As a security engineer, I want all S3 file paths to include a school-scoped prefix, so that a user from one school cannot access another school's documents by guessing S3 keys.

#### Acceptance Criteria

1. All S3 keys for school-specific files include `schools/{schoolId}/` as a prefix
2. Presigned URL generation validates that the `schoolId` in the path matches the authenticated user's `schoolId`
3. Existing legacy files without the school-scoped prefix remain accessible via presigned URLs (grandfathered) until explicitly migrated; a migration plan documenting the timeline and procedure for moving legacy files is created before this requirement closes

### Requirement 16: Detailed Health Check Endpoint

**User Story:** As a site reliability engineer, I want a `/api/health` endpoint that checks all critical dependencies, so that deployment tooling and monitoring can detect system health without parsing application logs.

#### Acceptance Criteria

1. `GET /api/health` returns `{ status, database, redis, version, uptime, timestamp }`
2. Database unreachable → `database: "error"`, HTTP 503
3. When Redis is unreachable, the response is HTTP 200 with `{ status: "degraded", redis: "degraded", database: "ok" }` to signal that the in-memory fallback is active but the system is operating in a degraded state
4. Response time is under 500 ms
5. The endpoint is configured as the Render.com health check URL

### Requirement 17: Phase 2 Pre-Launch Improvements

**User Story:** As a platform engineer, I want P2 improvements applied before launch to reduce operational risk, so that the system enters production in the strongest achievable state within the launch timeline.

#### Acceptance Criteria

1. Startup env validation module lists all missing required vars at once on startup failure
2. `requireSchool()` uses Redis-backed cache with pub/sub invalidation; when Redis is unavailable, the system falls back to direct DB queries with a reduced TTL (10 seconds) or attaches a staleness flag to the cached value to signal that invalidation signals may have been missed
3. `impersonation.ts` uses `IMPERSONATION_SECRET` env var separate from `AUTH_SECRET`
4. `xlsx` package upgraded to non-vulnerable version or replaced with `exceljs`
5. FK constraints added for `fee_invoices.studentId`, `fee_payments.studentId`, `feeConcessions.studentId`
6. `reactStrictMode: true` in `next.config.mjs`; all double-render side effects resolved
7. `requireSchool()` checks `subscriptionExpiresAt`; expired subscriptions return a clear error message
8. Email provider credentials documented; email flows tested end-to-end; failures logged
9. `student_documents.fileSizeBytes` column type changed from `text` to `bigint`
10. Subdomain routing mechanism documented; wildcard DNS requirements specified

### Requirement 18: DPDP Act 2023 Compliance Enforcement

**User Story:** As the DPDP compliance officer, I want all DPDP Act 2023 obligations to be operationally enforced, so that the platform meets its legal obligations under Indian data protection law.

#### Acceptance Criteria

1. No student PII is stored until a consent record is created for the relevant purpose
2. The retention worker runs on schedule, deletes/anonymizes records beyond `retentionDays`, excludes legal-hold records, and updates `lastRunAt` after each run
3. Publishing a new privacy notice version triggers re-consent requests for affected purposes
4. A scheduled job alerts school admins on rights requests approaching `dueAt` (within 5 days); overdue requests auto-escalate to `ESCALATED_TO_DPO`
5. Creating any `data_breach_log` record with severity HIGH or CRITICAL triggers an immediate admin alert; `boardNotificationDeadline` is surfaced in the DPDP dashboard for breach records of all severity levels (LOW, MEDIUM, HIGH, CRITICAL) so no deadline is silently missed
6. Database backups are confirmed encrypted at rest; backup provider is in vendor register

### Requirement 19: Operational Runbooks

**User Story:** As an operations engineer, I want documented runbooks for every critical operational procedure, so that any engineer on call can operate the system during an incident without tribal knowledge.

#### Acceptance Criteria

1. `docs/runbooks/deployment.md` covers: pre-deployment checklist, deployment steps, verification, rollback criteria and steps
2. `docs/runbooks/database-restore.md` covers: restore from backup, verification, RPO/RTO targets
3. `docs/runbooks/secret-rotation.md` covers: AUTH_SECRET rotation (session invalidation), ENCRYPTION_KEY rotation (PII re-encryption window), Razorpay and Redis rotation
4. `docs/runbooks/incident-response.md` covers: severity levels, diagnosis steps (Render logs, DB, Redis), communication templates, post-incident review
5. `docs/runbooks/dpdp-breach-response.md` covers: 72-hour notification checklist, roles, communication templates for Data Protection Board and affected parents

### Requirement 20: Performance Baseline

**User Story:** As a product manager, I want performance baselines established before launch, so that we have objective data on system performance and can identify bottlenecks before users experience them in production.

#### Acceptance Criteria

1. p50/p95/p99 response times are measured and documented for: login, dashboard, student list (1000 students), fee invoice generation (100 students), report card PDF, attendance marking, payroll calculation (50 staff)
2. All N+1 query risks from the audit are reviewed; the fee assignment loop is batched; the top 10 query plans are reviewed with `EXPLAIN ANALYZE`
3. Cold start behavior is documented; Render.com plan upgraded if cold starts exceed 10 seconds

## Glossary

| Term | Definition |
|------|-----------|
| P0 | Production blocker — must be resolved before any deployment |
| P1 | High priority — must be resolved before launch |
| P2 | Medium priority — should be resolved before launch |
| P3 | Low priority — post-launch with documented mitigation |
| Server Action | Next.js `"use server"` function — auth is NOT auto-enforced by tRPC middleware |
| requireAuth() | `backend/src/lib/serverAuth.ts` — the auth guard every Server Action must call |
| DPDP | Digital Personal Data Protection Act 2023 (India) |
| RPO | Recovery Point Objective — maximum acceptable data loss window |
| RTO | Recovery Time Objective — maximum acceptable recovery time |
| TOTP | Time-based One-Time Password (RFC 6238) — used for 2FA |
| tRPC | End-to-end typesafe API layer — middleware applies only to registered tRPC procedures |
| BullMQ | Redis-backed job queue used for async background workers |
| PII | Personally Identifiable Information |
| RLS | PostgreSQL Row Level Security |



