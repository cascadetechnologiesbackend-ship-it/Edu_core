# 00 — Executive Summary
## SchoolMitra ERP — Production Readiness Analysis

**Analysis Date:** October 6, 2026  
**Repository:** `v:\Cascade\Edu_core\Edu_core`  
**Analyst Role:** Full multidisciplinary engineering review (Architecture, Backend, Frontend, DB, Security, SRE, QA, Privacy)

---

## What Is This System?

SchoolMitra ERP is a multi-tenant, cloud-deployed school management platform targeting Indian K-10 schools (Nursery through Class 10). It manages every operational domain of a school: student admissions, academics, fees, HR/payroll, attendance, examinations, transport, library, and DPDP Act 2023 privacy compliance. It supports 11 user roles and is designed as a SaaS platform where a super-admin provisions school tenants.

---

## Architecture

- **Type:** Multi-tenant monolith on Next.js 14 App Router (server components + server actions + tRPC)  
- **Monorepo:** pnpm + Turborepo with packages: `frontend`, `backend`, `database`, `validators`, `dpdp`, `domain-events`, `i18n`  
- **Database:** PostgreSQL via Drizzle ORM (17 schema domains, migrations in `/database/src/migrations`)  
- **Auth:** NextAuth v5 beta (JWT), bcrypt, Redis account lockout (in-memory fallback), TOTP schema present  
- **Async:** BullMQ + Redis for report-card generation and data retention workers  
- **Storage:** AWS S3 / MinIO (dev) for student documents, photos, payslips, receipts  
- **Payments:** Razorpay gateway  
- **Deployment:** Render.com starter plan (single web service)  
- **Compliance:** DPDP Act 2023 — full schema including consent records, rights requests, data breach log, vendor register, retention policies

---

## Core Capabilities

| Domain | Status |
|--------|--------|
| Multi-tenant school provisioning | PARTIAL |
| Student admissions workflow | PARTIAL |
| Student information management | PARTIAL |
| Academic management (classes, subjects, timetables, syllabus) | PARTIAL |
| Fee structure & collection | PARTIAL |
| HR / payroll (Indian statutory: PF, ESI, PT) | PARTIAL |
| Attendance (student + staff) | PARTIAL |
| Examinations & report cards | PARTIAL |
| Library management | UNKNOWN |
| Transport management | UNKNOWN |
| DPDP Act 2023 compliance | PARTIAL |
| Super-admin platform management | PARTIAL |
| Parent/Student portals | PARTIAL |

---

## What Is Implemented Well

1. **Database schema design** — 17 schema domains are well-structured, tenant-scoped (schoolId on every table), with appropriate indexes, soft-deletes, and constraint coverage.  
2. **PII encryption** — AES-256-CBC field-level encryption for names, contacts, medical data, bank details with HMAC search hashes is consistently applied.  
3. **DPDP compliance infrastructure** — Comprehensive schema for consent records, rights requests, breach notification, vendor register, and immutable audit triggers. This is ahead of most ERP platforms in this space.  
4. **Pure business logic engines** — `gradeEngine.ts`, `payrollEngine.ts`, `feeAssignmentEngine.ts` are pure functions without DB coupling — testable and correct.  
5. **Account lockout** — Redis-backed sliding window lockout with in-memory fallback.  
6. **Audit log immutability** — PostgreSQL trigger (`0009_core_module_hardening.sql`) enforces append-only on `audit_logs` and `platform_audit_logs`.  
7. **Security headers** — HSTS, X-Frame-Options, CSP, Permissions-Policy configured in `next.config.mjs`.  
8. **RBAC role hierarchy** — 11 roles with tRPC middleware enforcement via `withRole()`.

---

## What Is Incomplete

1. tRPC router contains only 3 routers (admissions, students, attendance). The remaining 10+ feature domains appear to use Server Actions — authorization coverage in those actions is UNVERIFIED.  
2. TOTP/2FA schema exists but enforcement flow is UNKNOWN — not visible in the auth `authorize()` callback.  
3. Dockerfile references incorrect paths (`apps/web` vs `frontend`) — BROKEN.  
4. CI/CD pipeline is absent — no GitHub Actions, no test/lint gates on deployment.  
5. No startup environment variable validation — missing `AUTH_SECRET` or `ENCRYPTION_KEY` silently falls back to hardcoded values.  
6. No backup/restore configuration present in the repository.

---

## What Is Dangerous

1. **P0 — Hardcoded fallback secrets**: `auth.config.ts` and `encryption.ts` fall back to publicly-known hardcoded strings when `AUTH_SECRET`/`ENCRYPTION_KEY` env vars are absent. In production, this renders all JWTs forgeable and all encrypted PII decryptable by anyone who reads this source code.  
2. **P0 — Migration numbering conflict**: Files `0001_lame_shooting_star.sql` and `0001_perf_indexes.sql`, `0002_auth_tokens.sql` and `0002_cuddly_colossus.sql`, `0006_admission_blood_group.sql` and `0006_huge_ultimates.sql` share identical sequence numbers. Drizzle Kit will fail or skip migrations unpredictably — schema drift in production is a data integrity risk.  
3. **P0 — TEST_AUTH_USER auth bypass**: `serverAuth.ts` allows full authentication bypass via an environment variable. If set in production (accidental or malicious), any request can impersonate any user.  
4. **P1 — Public admission upload URL endpoint**: `getUploadUrl` uses `publicProcedure` — anonymous users can generate S3 pre-signed upload URLs to the school documents bucket.  
5. **P1 — Public admission submit writes PII to any school**: `submitApplication` uses `publicProcedure` and accepts `schoolId` from client — no ownership or session check.

---

## What Blocks Production

| Blocker | Severity | Description |
|---------|----------|-------------|
| Hardcoded fallback secrets | P0 | `AUTH_SECRET` and `ENCRYPTION_KEY` fall back to known defaults |
| TEST_AUTH_USER bypass | P0 | Complete auth bypass via env variable |
| Migration sequence conflicts | P0 | Duplicate migration numbers cause schema drift |
| Broken Dockerfile | P1 | Wrong paths (`apps/web` vs `frontend`) — Docker build fails |
| No CI/CD gates | P1 | No tests run before deployment |
| No env var validation at startup | P1 | App starts with broken/insecure config silently |
| Public admission endpoints | P1 | Unauthenticated S3 upload + PII write |
| No backup strategy | P1 | Data loss scenario unmitigated |
| Fee engine missing transactions | P1 | Partial invoice creation on failure |

---

## Largest Architectural Risk

The split between tRPC (3 routers with middleware-enforced auth/rate-limiting) and Next.js Server Actions (used for the majority of features) creates an unverified authorization surface. The Server Actions must each call `requireAuth()` explicitly — if any action omits this, it is silently unprotected. This cannot be verified without auditing every Server Action file, which was not possible in this review.

---

## Largest Security Risk

Hardcoded fallback secrets. If `AUTH_SECRET` is not configured on Render.com, the application signs JWTs with a publicly-known key visible in this repository. Any attacker with the source code can forge session tokens for any user, including SUPER_ADMIN, achieving full platform compromise.

---

## Largest Data Risk

Migration sequence number conflicts. Running `db:migrate` with duplicate-numbered files may execute migrations out of order or skip them entirely, causing the live schema to diverge from the ORM schema. This can produce silent data corruption that is difficult to detect and hard to reverse.

---

## Largest Operational Risk

No CI/CD pipeline and no startup environment validation. Broken code or misconfigured production secrets can be deployed silently and may not be detected until user-facing failures occur.

---

## Largest Scalability Risk

The Render.com starter plan uses a single compute instance. It will spin down after inactivity (cold starts). The in-process school cache (`schoolCache` Map) is not shared across instances. BullMQ workers run in the same process as the web server. Under load, there is no horizontal scaling path defined.

---

## What Is Missing From the Specification

1. Formal requirements document — requirements are inferred from code.  
2. API contract documentation for Server Actions.  
3. Production environment setup guide.  
4. Operational runbooks (migration procedure, secret rotation, incident response).  
5. Backup and restore procedure.  
6. DPDP Data Protection Officer contact and escalation path.

---

## What Should Be Fixed First

1. Remove or fail-fast on missing `AUTH_SECRET` and `ENCRYPTION_KEY` in production.  
2. Remove `TEST_AUTH_USER` auth bypass entirely or gate it behind `NODE_ENV !== 'production'` with explicit test framework injection.  
3. Resolve migration numbering conflicts before next deployment.  
4. Fix the Dockerfile.  
5. Audit all Server Actions for `requireAuth()` coverage.  
6. Add env var validation at application startup (Zod schema or equivalent).

---

## Overall Readiness

```
NOT READY
```

**Justification:** Three P0 production blockers exist simultaneously (hardcoded secrets, auth bypass, migration conflicts), a broken Dockerfile, no CI/CD, and no backup strategy. The system has sophisticated features and strong compliance design, but these foundational gaps mean it cannot be safely deployed to production in its current state.

---

## Production Readiness Scorecard

| Dimension | Status | Confidence | Critical Findings |
|-----------|--------|-----------|-------------------|
| Requirements | PARTIAL | LOW | 0 |
| Architecture | PARTIAL | HIGH | 1 (tRPC/SA split) |
| Frontend | PARTIAL | MEDIUM | 2 |
| Backend | PARTIAL | MEDIUM | 3 |
| Database | PARTIAL | HIGH | 1 (migration conflicts) |
| Security | BROKEN | HIGH | 5 (P0×2, P1×3) |
| Authentication | PARTIAL | HIGH | 2 |
| Authorization | PARTIAL | MEDIUM | 2 |
| Multi-tenancy | PARTIAL | MEDIUM | 1 |
| API | PARTIAL | MEDIUM | 2 |
| Performance | UNKNOWN | LOW | 0 |
| Scalability | PARTIAL | LOW | 1 |
| Testing | PARTIAL | MEDIUM | 1 (no CI gate) |
| Migrations | BROKEN | HIGH | 1 (P0) |
| Integrations | PARTIAL | LOW | 1 |
| Observability | MISSING | MEDIUM | 1 |
| Infrastructure | PARTIAL | MEDIUM | 2 |
| CI/CD | MISSING | HIGH | 1 |
| Deployment | BROKEN | HIGH | 1 (Dockerfile) |
| Recovery | MISSING | HIGH | 1 (no backup) |
| Privacy | PARTIAL | HIGH | 0 |
| UX | UNKNOWN | LOW | 0 |
| Accessibility | UNKNOWN | LOW | 0 |
| Documentation | MISSING | HIGH | 1 |
| Operations | MISSING | HIGH | 1 |
