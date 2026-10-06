# SchoolMitra ERP — Production Readiness Checklist

This document tracks the resolution status of all requirements defined in [requirements.md](file:///V:/Cascade/Edu_core/Edu_core/.kiro/specs/production-readiness/requirements.md).

---

## Phase 0: Production Blockers (P0)

- [x] **REQ-1: Session Invalidation on Logout & Credential Revocation** `[STATUS: COMPLETED]`
  - [x] 1.1 `sessions` table tracks `userId`, `schoolId`, `tokenHash`, `revokedAt`, `expiresAt`.
  - [x] 1.2 Sign out revokes current session token.
  - [x] 1.3 Password change revokes all active sessions for `userId`.
  - [x] 1.4 `auth()` / session validation queries session revocation status.
  - [x] 1.5 Rate limiter clears lockout counter on successful auth.

- [x] **REQ-2: AES-256 Symmetric Encryption for Student PII** `[STATUS: COMPLETED]`
  - [x] 2.1 AES-256-GCM encryption helper (`encryptData`, `decryptData`) implemented in [crypto.ts](file:///V:/Cascade/Edu_core/Edu_core/backend/src/lib/crypto.ts).
  - [x] 2.2 Aadhaar numbers stored encrypted (`aadhaarEncrypted`), never plaintext.
  - [x] 2.3 Parent contact details (`emergencyContactPhone`, `mobileEncrypted`, `emailEncrypted`) stored encrypted.
  - [x] 2.4 PII revealed only on explicit user action with DPDP purpose tracking.
  - [x] 2.5 Encryption keys loaded strictly from `ENCRYPTION_KEY` environment variable.

- [x] **REQ-3: Mandatory School-Level Tenant Scoping on All Queries** `[STATUS: COMPLETED]`
  - [x] 3.1 Every SELECT, UPDATE, DELETE query explicitly scopes by `schoolId` (enforced via `withTenant` / `withSchool`).
  - [x] 3.2 Automated verification script audits all Drizzle queries for missing `schoolId`.
  - [x] 3.3 tRPC context injects verified `schoolId` from session token.
  - [x] 3.4 Multi-tenant isolation verified with zero cross-tenant leakages.

- [x] **REQ-4: Verification Gate on Student Enrollment Transition** `[STATUS: COMPLETED]`
  - [x] 4.1 Automated check that all mandatory admission documents are submitted and verified before ENROLLED status transition.
  - [x] 4.2 Application state machine strictly prohibits direct transition from APPLIED to ENROLLED without document verification.
  - [x] 4.3 Explicit override capability with reason audit log for emergency admissions.

- [x] **REQ-5: PostgreSQL Database Migrations in Version Control** `[STATUS: COMPLETED]`
  - [x] 5.1 All schema definitions managed via Drizzle migrations in `database/src/migrations`.
  - [x] 5.2 CI migration check script verifies zero uncommitted schema drift (`pnpm run db:check-migrations`).
  - [x] 5.3 Foreign key constraints and column types verified across all core modules.

- [x] **REQ-6: Secure Document Storage Migration to S3/MinIO** `[STATUS: COMPLETED]`
  - [x] 6.1 Direct database binary/base64 document storage eliminated; migrated to S3 bucket keys.
  - [x] 6.2 Pre-signed download URLs generated with strict TTL (max 15 mins) and tenant verification.
  - [x] 6.3 Secure upload flow validates file type MIME signatures and size limits.

---

## Phase 1: High Priority (P1)

- [x] **REQ-7: Refresh Token Rotation & Session Hardening** `[STATUS: COMPLETED]`
  - [x] 7.1 Single-use refresh token rotation mechanism with cryptographically secure tokens.
  - [x] 7.2 Detection of reuse immediately revokes all descendant tokens in the family.
  - [x] 7.3 Refresh tokens bound to client IP address and User-Agent hash.
  - [x] 7.4 Session cookies set with `HttpOnly`, `SameSite=Lax`, `Secure`.

- [x] **REQ-8: Cross-Tenant Object Access Prevention (IDOR)** `[STATUS: COMPLETED]`
  - [x] 8.1 Every entity fetched by ID validates ownership (`entity.schoolId === session.schoolId`).
  - [x] 8.2 IDs in public/shared URLs use cryptographically random UUIDs.
  - [x] 8.3 Unauthorized IDOR attempts log a security alert to `audit_logs`.

- [x] **REQ-9: Server Action Authorization Audit** `[STATUS: COMPLETED]`
  - [x] 9.1 Every `"use server"` action calls `requireAuth()` or `safeRequireAuth()` at entry.
  - [x] 9.2 Public actions without authentication explicitly commented `// PUBLIC:` and rate-limited.
  - [x] 9.3 Automated audit script verified 0 unprotected server actions across frontend and backend.

- [x] **REQ-10: Structured Logging & PII Sanitization** `[STATUS: COMPLETED]`
  - [x] 10.1 Centralized Pino logger instance with ISO-8601 timestamps and trace correlation IDs.
  - [x] 10.2 Automated redaction for Aadhaar, credit cards, bank accounts, passwords, and tokens.
  - [x] 10.3 Log levels (`trace`, `debug`, `info`, `warn`, `error`) configurable via `LOG_LEVEL`.
  - [x] 10.4 Zero plaintext PII values appear in application stdout logs.

- [x] **REQ-11: SUPER_ADMIN Role Bypass Scoping** `[STATUS: COMPLETED]`
  - [x] 11.1 Scoped SUPER_ADMIN role bypass: when impersonating a school (`sm_impersonation` cookie), role checks evaluate strictly against `effectiveRole` (e.g. `SCHOOL_ADMIN`).
  - [x] 11.2 Direct access to school-specific routes without impersonation rejected with HTTP 403.
  - [x] 11.3 Every cross-tenant action and impersonation lifecycle event logged to `platform_audit_logs`.

- [x] **REQ-12: TOTP Enforcement for SUPER_ADMIN** `[STATUS: COMPLETED]`
  - [x] 12.1 Credentials provider verifies `totpEnabled` for Super Admin users.
  - [x] 12.2 Multi-factor authentication flow with 6-digit TOTP code verification (`otplib`).
  - [x] 12.3 Account lockout (5 failed attempts, 15 min cooldown) applies across passwords and TOTP codes.
  - [x] 12.4 Setup flow with QR code generation (`qrcode`) and encrypted secret storage.

- [x] **REQ-13: Razorpay Webhook Signature Verification** `[STATUS: COMPLETED]`
  - [x] 13.1 Webhook handler verifies `x-razorpay-signature` using HMAC-SHA256 (`crypto.timingSafeEqual`).
  - [x] 13.2 Forged or invalid signatures reject with HTTP 400 and security audit log.
  - [x] 13.3 Missing webhook secret returns HTTP 503 error.
  - [x] 13.4 Idempotency guard prevents duplicate invoice crediting.

- [x] **REQ-14: BullMQ Worker Tenant Scoping** `[STATUS: COMPLETED]`
  - [x] 14.1 Worker operations in [reportCard.ts](file:///V:/Cascade/Edu_core/Edu_core/backend/src/workers/reportCard.ts) and [retention.ts](file:///V:/Cascade/Edu_core/Edu_core/backend/src/workers/retention.ts) scoped to `job.data.schoolId`.
  - [x] 14.2 Strict tenant verification raises errors and immediately aborts if entities do not belong to `job.data.schoolId`.
  - [x] 14.3 Workers log `schoolId` and `jobId` at start of every job.

- [x] **REQ-15: S3 File Path School Scoping** `[STATUS: COMPLETED]`
  - [x] 15.1 S3 upload keys prefixed with `schools/{schoolId}/`.
  - [x] 15.2 Presigned URL generator validates `schoolId` path component matches user's active tenant.
  - [x] 15.3 Legacy files grandfathered with non-blocking access and migration plan documented.

- [x] **REQ-16: Detailed Health Check Endpoint** `[STATUS: COMPLETED]`
  - [x] 16.1 `/api/health` returns `{ status, database, redis, version, uptime, timestamp, durationMs }`.
  - [x] 16.2 Database failure returns HTTP 503.
  - [x] 16.3 Redis failure returns HTTP 200 with `{ status: "degraded", redis: "degraded", database: "ok" }`.
  - [x] 16.4 Average execution duration tracked under 50ms (well within 500ms SLA).

---

## Phase 2: Pre-Launch Hardening (P2) — Requirement 17

- [x] **17.1 Startup Env Validation**: Aggregate all missing variables into single startup error message ([backend/src/env.ts](file:///V:/Cascade/Edu_core/Edu_core/backend/src/env.ts)).
- [x] **17.2 requireSchool Caching**: Implemented Redis-backed cache with pub/sub invalidation channel and 10s DB fallback ([backend/src/lib/schoolCache.ts](file:///V:/Cascade/Edu_core/Edu_core/backend/src/lib/schoolCache.ts)).
- [x] **17.3 Impersonation Secret**: Separated `IMPERSONATION_SECRET` from `AUTH_SECRET` ([backend/src/lib/impersonation.ts](file:///V:/Cascade/Edu_core/Edu_core/backend/src/lib/impersonation.ts)).
- [x] **17.4 xlsx Security**: Removed `xlsx` dependency and migrated spreadsheet export routines to `exceljs` ([frontend/src/app/(admin)/fees/reports/ExportButton.tsx](file:///V:/Cascade/Edu_core/Edu_core/frontend/src/app/(admin)/fees/reports/ExportButton.tsx)).
- [x] **17.5 FK Constraints**: Added foreign keys for `fee_invoices.studentId`, `fee_payments.studentId`, `feeConcessions.studentId` ([database/src/schema/fees.ts](file:///V:/Cascade/Edu_core/Edu_core/database/src/schema/fees.ts)).
- [x] **17.6 React Strict Mode**: Enabled `reactStrictMode: true` in [next.config.mjs](file:///V:/Cascade/Edu_core/Edu_core/frontend/next.config.mjs).
- [x] **17.7 Subscription Expiry Check**: Added `subscriptionExpiresAt` check to `requireSchool()` in [serverAuth.ts](file:///V:/Cascade/Edu_core/Edu_core/backend/src/lib/serverAuth.ts).
- [x] **17.8 Email Provider Credentials**: Documented SMTP credentials in [.env.local.example](file:///V:/Cascade/Edu_core/Edu_core/.env.local.example) and added robust delivery/error logging to [email.ts](file:///V:/Cascade/Edu_core/Edu_core/backend/src/lib/email.ts).
- [x] **17.9 BigInt File Sizes**: Altered `student_documents.fileSizeBytes` column from `text` to `bigint` with `{ mode: "number" }` ([database/src/schema/students.ts](file:///V:/Cascade/Edu_core/Edu_core/database/src/schema/students.ts)).
- [x] **17.10 Subdomain Routing Spec**: Documented multi-tenant wildcard DNS and domain resolution architecture ([docs/architecture/subdomain-routing.md](file:///V:/Cascade/Edu_core/Edu_core/docs/architecture/subdomain-routing.md)).

---

## DPDP Act Compliance, Runbooks & Performance Baselines

- [x] **REQ-18: DPDP Act 2023 Compliance Enforcement** `[STATUS: COMPLETED]`
  - [x] 18.1 Require purpose consent record before student PII insertion (enforced in `AdmissionsDomainService.ts` and `consent.ts` middleware).
  - [x] 18.2 Retention worker scheduled execution in `backend/src/workers/retention.ts`, respecting legal holds and updating `lastRunAt`.
  - [x] 18.3 Re-consent trigger on new privacy notice versions implemented in `publishPrivacyNoticeAction` in `dpdp/actions.ts`.
  - [x] 18.4 Escalation job for rights requests approaching `dueAt` auto-escalates to `ESCALATED_TO_DPO` at 5 days ([backend/src/lib/dpdpEscalation.ts](file:///V:/Cascade/Edu_core/Edu_core/backend/src/lib/dpdpEscalation.ts)).
  - [x] 18.5 Real-time admin alerts for `data_breach_log` severity HIGH/CRITICAL and live 72-hour `boardNotificationDeadline` countdown in DPDP Centre.
  - [x] 18.6 DPDP vendor register verification and encrypted database backups.

- [x] **REQ-19: Operational Runbooks** `[STATUS: COMPLETED]`
  - [x] 19.1 `docs/runbooks/deployment.md`: Pre-deploy checklist, deploy steps, health check, rollback procedure.
  - [x] 19.2 `docs/runbooks/database-restore.md`: Full restore steps, verification, RPO/RTO.
  - [x] 19.3 `docs/runbooks/secret-rotation.md`: `AUTH_SECRET`, `ENCRYPTION_KEY` re-encryption, Razorpay & Redis rotation.
  - [x] 19.4 `docs/runbooks/incident-response.md`: Severity definitions, diagnostic steps, comms templates.
  - [x] 19.5 `docs/runbooks/dpdp-breach-response.md`: 72-hour board notification checklist, templates for authorities & parents.

- [x] **REQ-20: Performance Baselines & Query Tuning** `[STATUS: COMPLETED]`
  - [x] 20.1 Established and benchmarked p50/p95/p99 for top routes (login, student list 1000, fee generation, report card PDF, health check) in [performance-baselines.md](file:///V:/Cascade/Edu_core/Edu_core/docs/architecture/performance-baselines.md).
  - [x] 20.2 Batched fee assignment loop in `cron/generate-invoices/route.ts` and `students/[id]/fees/actions.ts`; reviewed top 10 query execution plans with `EXPLAIN ANALYZE`.
  - [x] 20.3 Benchmarked cold start latency (2.8s on Render Standard tier) and documented sizing.
