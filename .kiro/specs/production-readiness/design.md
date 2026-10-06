# Design Document: SchoolMitra ERP Production Readiness

## Overview

This design document captures the technical architecture for all 20 production-readiness
requirements and provides concrete implementation plans for the six confirmed remaining gaps.
The system is a Next.js 14 monorepo (`frontend` + `backend` packages) backed by PostgreSQL
(Drizzle ORM), Redis (BullMQ + rate-limiting + caching), and S3-compatible object storage.
Multi-tenancy is row-level: every tenant query carries `schoolId`.

**Implementation status summary:**

| Category | Status |
|---|---|
| P0 Blockers (REQ 1-3) | ✅ Implemented — 1 remaining gap (GAP-001) |
| Phase 1 Pre-Launch (REQ 4-16) | ✅ Mostly implemented — 3 remaining gaps (GAP-002/003/004) |
| Phase 2 Improvements (REQ 17) | ✅ Implemented |
| DPDP Compliance (REQ 18) | ✅ Implemented |
| Operations (REQ 19-20) | ✅ Implemented |
| Worker Scoping (REQ 14) | ✅ Implemented — 1 remaining gap (GAP-005, now resolved by analysis) |
| S3 Path Scoping (REQ 15) | ⚠️ Partial — 1 remaining gap (GAP-006) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Next.js Frontend (App Router)                                           │
│  ┌────────────┐  ┌────────────────┐  ┌─────────────────────────────┐    │
│  │ Route Groups│  │ API Routes     │  │ Server Actions              │    │
│  │ (auth-gated│  │ /api/health    │  │ "use server" + requireAuth() │    │
│  │  middleware)│  │ /api/webhooks  │  │ Checked by ESLint rule      │    │
│  └────────────┘  │ /api/auth/...  │  └─────────────────────────────┘    │
│                  └────────────────┘                                      │
├──────────────────────────────────────────────────────────────────────────┤
│  Backend tRPC Layer (Next.js API Routes /api/trpc)                       │
│  timingMiddleware → rateLimitMiddleware → isAuthed → withRole()          │
│  Structured JSON logging (pino) on every request                         │
├────────────────────────┬─────────────────────────────────────────────────┤
│  Auth Layer            │  Tenant / Cache Layer                           │
│  NextAuth v5 (JWT)     │  schoolCache.ts  L1 (memory 60s)               │
│  TOTP (otplib)         │               → L2 (Redis 300s)               │
│  Impersonation HMAC    │               → DB fallback (10s, isStale)     │
│  Refresh tokens (DB)   │  pub/sub invalidation (channel:school:*)       │
├────────────────────────┴─────────────────────────────────────────────────┤
│  Data Layer                                                               │
│  PostgreSQL via Drizzle ORM   Redis via ioredis (BullMQ + rate limit)   │
│  AES-256-CBC PII encryption   S3 (schools/{schoolId}/… prefix)          │
│  db.transaction() for atomic fee/payment mutations                       │
├──────────────────────────────────────────────────────────────────────────┤
│  Background Workers (BullMQ)                                             │
│  retention.ts    — schoolId-scoped soft-delete + hard-purge              │
│  reportCard.ts   — schoolId-scoped PDF generation + DPDP consent check  │
│  dpdpEscalation.ts — rights-request escalation + breach alerts          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Deployment topology

- **Render.com**: frontend Next.js process + backend workers (via `START_WORKERS=true`)
- **Neon / Supabase**: managed PostgreSQL (automated daily backups, 30-day retention)
- **Upstash / Railway Redis**: single-region Redis
- **AWS S3 / Cloudflare R2**: object storage with `schools/{schoolId}/` prefix requirement
- **CI/CD**: GitHub Actions (`ci.yml` + `deploy.yml`)

---

## Components and Interfaces

### 1. Secret Management & Env Validation (REQ-1)

**What was built:**  
`backend/src/env.ts` exports a Zod-validated `env` object. If validation fails in production
(`NODE_ENV=production` and `NEXT_PHASE !== 'phase-production-build'`), `process.exit(1)` fires
before any server code loads. Individual modules (`auth.config.ts`, `encryption.ts`,
`impersonation.ts`) also throw synchronously if their secrets are absent in production.

**Key decisions:**
- Build-time phase is explicitly excluded (`NEXT_PHASE !== 'phase-production-build'`) to allow
  Docker image builds without live secrets.
- `IMPERSONATION_SECRET` is separate from `AUTH_SECRET` (REQ-17.3), validated as `optional()`
  at the env module level but enforced at runtime in `impersonation.ts`.
- `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` are checked as a group in
  production — all three must be present.

**Remaining gap → GAP-001** (see [Gap Designs](#gap-designs)).

---

### 2. Authentication & Session (REQ-2, REQ-12)

**What was built:**  
`backend/src/lib/auth/index.ts` (NextAuth v5 CredentialsProvider):

- `TEST_AUTH_USER` bypass fully removed. ✅
- Password verified with `bcrypt.compare`.
- TOTP flow for `SUPER_ADMIN`:
  - If `totpEnabled = true` and no `totpCode` provided → throws `"TOTP_REQUIRED"`.
  - If TOTP code wrong → `recordFailedAttempt()` (same lockout counter as password) → throws `"INVALID_TOTP"`.
  - TOTP secret stored encrypted (`encryptData()`), decrypted before `authenticator.check()`.
- Account lockout: 5 failed attempts → 15-minute block (checked via Redis in `accountLockout.ts`).
- Refresh token: HttpOnly cookie `schoolmitra_refresh`, rotated on every use, path-scoped to
  `/api/auth/refresh`, 7-day TTL, DB-stored sessions.

**Auth middleware:**  
`auth.config.ts` `authorized()` callback enforces:
- Static assets, `/_next`, `/api/auth`, webhooks, health → always pass.
- Public routes (`/`, `/onboard`, `/api/onboard`) → always pass.
- `mustChangePassword` → redirect to `/force-password-change`.
- Everything else → must be logged in.

**Interfaces:**
```typescript
// auth/index.ts returns on successful login:
{ id, email, name, schoolId, role, mustChangePassword? }

// TOTP partial state:
throw new Error("TOTP_REQUIRED")  // login UI shows TOTP step
throw new Error("INVALID_TOTP")   // increments lockout counter
```

---

### 3. Session & Role Enforcement (REQ-11)

**What was built:**  
`backend/src/lib/serverAuth.ts` `requireAuth()`:

1. Reads session via `getCachedSession()` (React `cache()`-wrapped, deduplicated per request).
2. For `SUPER_ADMIN` without a `schoolId` in the token, checks `sm_impersonation` cookie
   (HMAC-SHA256 signed, `IMPERSONATION_SECRET`). If valid, sets `schoolId = impData.schoolId`
   and `effectiveRole = "SCHOOL_ADMIN"`.
3. `allowedRoles` enforcement applies against `effectiveRole`, not the raw `role` — so an
   impersonating SUPER_ADMIN is subject to the same role gate as a regular school admin.
4. Non-impersonating SUPER_ADMIN is still a platform bypass (intentional for platform-level
   actions like provisioning schools).

`backend/src/server/trpc.ts` `withRole()` mirrors the same impersonation-aware logic for
tRPC procedures.

**`requireSchool()` guards:**
- Throws if `schoolId` is null (platform-SUPER_ADMIN without impersonation).
- Checks `school.isActive` (suspended schools blocked).
- Checks `subscriptionExpiresAt` (expired subscriptions blocked with clear message).
- Uses `getCachedSchool()` (L1 + L2 + DB fallback).

---

### 4. School Cache (REQ-17.2)

**What was built:**  
`backend/src/lib/schoolCache.ts` implements a three-layer cache:

```
Request → L1 memoryCache (1 min TTL) → L2 Redis (5 min TTL) → PostgreSQL DB
```

- Redis Pub/Sub channel `channel:school:invalidate` propagates invalidations across
  multiple Node processes (Render horizontal scaling).
- `invalidateSchoolCache(schoolId?)` is exported and called by settings mutations.
- When Redis is unavailable: DB fallback with `isStale: true` flag + reduced 10s TTL.

---

### 5. tRPC Structured Logging (REQ-10)

**What was built:**  
`backend/src/server/trpc.ts` `timingMiddleware` runs on every tRPC procedure (both public and
protected, via `publicProcedure` and `protectedProcedure` definitions). It:

- Emits `trpcLogger.info({requestId, path, durationMs, timestamp, schoolId, role})` on success.
- Emits `trpcLogger.error({requestId, path, durationMs, errorCode, errorMessage})` on failure.
- `requestId` defaults to `crypto.randomUUID()` or reads `x-request-id` header.
- **No `NODE_ENV` guard exists** — logging fires in all environments. ✅ REQ-10 is satisfied.
- `schoolId` and `role` are logged; no PII field values are included.

The `trpcLogger` uses pino. In production, pino outputs NDJSON. In development, pino-pretty
is applied via transport config.

---

### 6. Razorpay Webhook (REQ-13)

**What was built:**  
`frontend/src/app/api/webhooks/razorpay/route.ts`:

- Reads raw body before parsing (required for signature verification).
- Returns `503` if `RAZORPAY_WEBHOOK_SECRET` is absent or equals `"change-me"`.
- Verifies `x-razorpay-signature` via `crypto.timingSafeEqual` HMAC-SHA256.
- Idempotency guards: checks `log.status === "PAID"` and existing `feePayments` record before
  any writes.
- All writes (`paymentGatewayLogs`, `feePayments`, `feeInvoices`) inside a single
  `db.transaction()`.

---

### 7. Fee Assignment Engine (REQ-8)

**What was built:**  
`backend/src/lib/feeAssignmentEngine.ts`:

- `autoAssignFeeStructuresToStudent()` uses the `executeLogic(tx)` pattern — accepts an
  optional external transaction or starts its own `db.transaction()`.
- `recalculateStudentInvoices()` same pattern — atomic update of all pending invoices.
- `autoAssignFeeStructuresForClass()` wraps `autoAssignFeeStructuresToStudent()` calls within
  a single outer transaction, so a failure mid-class rolls back the entire batch.
- Transport and hostel opt-in checks prevent invoice creation for opted-out students.
- Idempotency: skips `feeStructureId` if an invoice already exists.

---

### 8. BullMQ Workers (REQ-14)

**What was built:**

**`retention.ts`:**
- All queries scoped by `schoolId` from `job.data`.
- Respects `legalHold = false` before soft-delete and hard-purge.
- Updates `lastRunAt` and `recordsDeletedLastRun` after each policy run.
- Logs every operation to `auditLogs` with `userId = system` sentinel.

**`reportCard.ts`:**
- `job.data` carries `{ studentId, examId, schoolId, jobId }`.
- Student fetch: `and(eq(students.id, studentId), eq(students.schoolId, schoolId))` — cross-tenant
  mismatch throws `"Security Tenant Violation"`, BullMQ marks job FAILED.
- Exam fetch: same double-column WHERE guard.
- Grade rules fetch scoped to `schoolId`.
- Report card upsert includes `schoolId` column.
- DPDP consent checked via `assertConsent(studentId, "academic_records")` before any read.
- Worker logs `schoolId` and `job.id` at start of every job. ✅ REQ-14 fully satisfied.

---

### 9. DPDP Compliance (REQ-18)

**What was built:**

| Sub-requirement | Implementation |
|---|---|
| 18.1 Consent before PII storage | `assertConsent()` in workers; admission flow creates consent record before PII insert |
| 18.2 Retention worker | `executeRetentionPolicy()` in `retention.ts` — soft-delete, hard-purge (30-day grace), `legalHold`, audit log |
| 18.3 Privacy notice re-consent | `publishPrivacyNoticeAction` triggers re-consent for affected purposes |
| 18.4 Rights request escalation | `runRightsRequestEscalationJob()` — auto-escalates SUBMITTED/IN_PROGRESS within 5 days; emails all active school admins |
| 18.5 Breach alerts | `triggerBreachEmergencyAlert()` — HIGH/CRITICAL severity triggers immediate email; `boardNotificationDeadline` surfaced in DPDP dashboard for all severities |
| 18.6 Backup encryption | Documented in vendor register + runbook |

---

### 10. Health Check (REQ-16)

**What was built:**  
`frontend/src/app/api/health/route.ts`:

```
GET /api/health → { status, database, redis, version, uptime, timestamp, durationMs }
```

- DB failure → `{ status: "error", database: "error" }` + HTTP 503.
- Redis failure → `{ status: "degraded", redis: "degraded", database: "ok" }` + HTTP 200.
- Both OK → `{ status: "ok" }` + HTTP 200.
- `uptime` is seconds since process start (module-level `const startTime`).
- Configured as Render.com health check path.

---

### 11. Admission Endpoints (REQ-5)

**What was built:**  
`backend/src/server/routers/admissions.ts`:

- `getUploadUrl` uses `protectedProcedure` — anonymous → HTTP 401 from tRPC.
- S3 key: `schools/${userSchoolId}/admissions/${uuid}-${filename}` — school-scoped.
- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
- Max file size: 10 MB enforced via Zod schema.
- `submitApplication` cross-tenant check: if `input.schoolId` differs from
  `ctx.session.user.schoolId` → `TRPCError({ code: "FORBIDDEN" })`.
- PII encrypted at insert via `encryptData()`.

---

### 12. Migration Integrity (REQ-3)

**What was built:**
- Migration files renamed to eliminate duplicate sequence prefixes:
  - `0010_perf_indexes.sql`, `0011_auth_tokens.sql`, `0012_admission_blood_group.sql`
- Drizzle journal (`meta/_journal.json`) updated to match.
- CI check `pnpm --filter @schoolmitra/database run db:check-migrations` runs before
  type-check in `ci.yml` and blocks on failure.

---

### 13. CI Pipeline (REQ-6) — Partial

**What was built:**  
`.github/workflows/ci.yml` covers: install (frozen lockfile), migration check, type-check for all four packages.

**What is missing → GAP-002** (see [Gap Designs](#gap-designs)).

---

### 14. Server Action Authorization Audit (REQ-9)

**Current state:**

All confirmed `"use server"` files across the codebase call either `requireAuth()` (canonical
guard) or `checkAuth()` (academics module wrapper that delegates to `auth()` from NextAuth with
schoolId validation). Two files use `await auth()` directly with an inline role check
(`platform/schools/new/actions.ts` — SUPER_ADMIN only, and two functions in `dpdp/actions.ts`).
These are acceptable given the explicit role checks, but lack the `// PUBLIC: <reason>` annotation
standard.

**ESLint rule:** Not yet implemented. **→ GAP-003** (see [Gap Designs](#gap-designs)).

---

## Data Models

No new tables are introduced by the remaining gaps. The following existing tables are referenced
by gap implementations:

### Existing: `users`, `superAdminUsers`
Used by auth flows. No schema changes required.

### Existing: `rightsRequests`, `dpdpGrievances`, `dataBreachLog`
Used by DPDP escalation and alert jobs. Schema already includes `dueAt`, `escalatedToDpoAt`,
`boardNotificationDeadline`.

### Env var additions (GAP-001, GAP-002)
No schema change — env validation only. `.env.local.example` documents all vars.

---

## Gap Designs

### GAP-001 — Hardcoded Secret in `refresh/route.ts` (P0)

**File:** `frontend/src/app/api/auth/refresh/route.ts`

**Problem:** `getJwtSecret()` logs a warning and returns a hardcoded fallback string in production
when `AUTH_SECRET` is absent. This defeats the fail-fast guarantee of REQ-1 for the token refresh
path. A misconfigured deployment would silently issue forged refresh JWTs.

**Fix:** Replace the warn-and-fallback pattern with the same throw-in-production pattern used
everywhere else:

```typescript
// BEFORE (lines 12-20 in refresh/route.ts):
function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      console.warn(
        "⚠️ Warning: Neither AUTH_SECRET nor NEXTAUTH_SECRET is set. Using fallback secret.",
      );
    }
    return new TextEncoder().encode(
      "schoolmitra-erp-auth-secret-fallback-key-min-64-characters-long-key!!",
    );
  }
  return new TextEncoder().encode(secret);
}

// AFTER:
function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.NEXT_PHASE !== "phase-production-build"
    ) {
      throw new Error(
        "FATAL: AUTH_SECRET (or NEXTAUTH_SECRET) is required for refresh token signing in production.",
      );
    }
    // Development only — never reaches production
    return new TextEncoder().encode(
      "dev-local-only-refresh-secret-do-not-use-in-production-64chars!!!",
    );
  }
  return new TextEncoder().encode(secret);
}
```

**Testing:** Unit test that `getJwtSecret()` throws when `NODE_ENV=production` and both secret
env vars are absent. Existing integration tests cover the happy path.

---

### GAP-002 — Incomplete CI Pipeline + Missing `deploy.yml` (P1)

**File:** `.github/workflows/ci.yml` (extend), `.github/workflows/deploy.yml` (create)

**Problem:** The current `ci.yml` is missing lint, unit tests, Docker build verification, and
`pnpm audit`. No `deploy.yml` for automated deployment exists.

**Fix A — Extend `ci.yml`:**

Add the following steps after the existing type-check step:

```yaml
      - name: Lint
        run: |
          pnpm --filter @schoolmitra/frontend run lint
          pnpm --filter @schoolmitra/backend run lint

      - name: Unit Tests
        run: pnpm --filter @schoolmitra/backend run test --run
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/schoolmitra_test
          REDIS_URL: redis://localhost:6379
          AUTH_SECRET: test-auth-secret-at-least-32-characters-long
          ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

      - name: Docker Build Verification
        run: docker build -t schoolmitra-test:${{ github.sha }} .

      - name: Security Audit
        run: pnpm audit --audit-level=high
        continue-on-error: false
```

The unit test step requires Redis and Postgres services:

```yaml
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: schoolmitra_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: --health-cmd "redis-cli ping" --health-interval 10s --health-timeout 5s --health-retries 5
```

**Fix B — Create `deploy.yml`:**

```yaml
name: Deploy Pipeline

on:
  push:
    branches: [main]

jobs:
  deploy:
    name: Validate & Deploy
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js + pnpm
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: pnpm/action-setup@v3
        with:
          version: 9.0.0

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Verify Migration Sequence
        run: pnpm --filter @schoolmitra/database run db:check-migrations

      - name: Deploy to Render.com
        run: |
          curl -s -X POST \
            "https://api.render.com/v1/services/${{ secrets.RENDER_SERVICE_ID }}/deploys" \
            -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"clearCache": false}'

      - name: Wait for Deploy + Health Check
        run: |
          sleep 30
          for i in {1..12}; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
              "https://${{ secrets.RENDER_SERVICE_HOSTNAME }}/api/health")
            if [ "$STATUS" = "200" ]; then
              echo "Health check passed (HTTP $STATUS)"
              exit 0
            fi
            echo "Attempt $i: HTTP $STATUS, retrying in 10s..."
            sleep 10
          done
          echo "Health check failed after 2 minutes"
          exit 1

      - name: Notify on Failure
        if: failure()
        run: |
          echo "::error::Deployment failed. Check Render.com dashboard."
```

**Secrets required:** `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `RENDER_SERVICE_HOSTNAME` — added
in GitHub repository settings.

---

### GAP-003 — Server Action Authorization ESLint Rule (REQ-9)

**Files to create:**
- `packages/eslint-plugin-schoolmitra/index.js`
- `packages/eslint-plugin-schoolmitra/rules/no-unguarded-server-action.js`
- `frontend/.eslintrc.json` (extend)

**Problem:** No tooling enforces that every `"use server"` file that imports from `@/db` also
calls `requireAuth` (or carries a `// PUBLIC: <reason>` comment). Two functions in `dpdp/actions.ts`
use `await auth()` directly without `requireAuth()` and without the annotation — this could be
exploited or silently lose the school-scoping guarantees.

**Rule logic:**

```javascript
// packages/eslint-plugin-schoolmitra/rules/no-unguarded-server-action.js
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Require "use server" files that import from @/db to call requireAuth() or carry // PUBLIC: comment',
    },
    schema: [],
  },
  create(context) {
    let hasUseServer = false;
    let hasDbImport = false;
    let hasRequireAuth = false;
    let hasPublicComment = false;

    return {
      Program(node) {
        // Check for // PUBLIC: comment at file level
        const sourceCode = context.getSourceCode();
        const comments = sourceCode.getAllComments();
        hasPublicComment = comments.some((c) =>
          c.value.trim().startsWith("PUBLIC:"),
        );
      },
      ExpressionStatement(node) {
        if (
          node.expression.type === "Literal" &&
          node.expression.value === "use server"
        ) {
          hasUseServer = true;
        }
      },
      ImportDeclaration(node) {
        if (node.source.value.startsWith("@/db")) {
          hasDbImport = true;
        }
        if (node.source.value.includes("serverAuth")) {
          // Check imported names include requireAuth
          node.specifiers.forEach((spec) => {
            if (spec.imported?.name === "requireAuth") {
              hasRequireAuth = true;
            }
          });
        }
      },
      "Program:exit"() {
        if (hasUseServer && hasDbImport && !hasRequireAuth && !hasPublicComment) {
          context.report({
            loc: { line: 1, column: 0 },
            message:
              '"use server" file imports from @/db but does not import requireAuth() from @/lib/serverAuth. ' +
              "Add requireAuth() or annotate with // PUBLIC: <reason> if intentionally public.",
          });
        }
      },
    };
  },
};
```

**Register in `frontend/.eslintrc.json`:**

```json
{
  "extends": "next/core-web-vitals",
  "plugins": ["schoolmitra"],
  "rules": {
    "react/no-unescaped-entities": "off",
    "react-hooks/exhaustive-deps": "warn",
    "@next/next/no-img-element": "warn",
    "schoolmitra/no-unguarded-server-action": "error"
  }
}
```

**Action items before closing REQ-9:**

The following files need annotation or migration to `requireAuth()`:

| File | Current guard | Action |
|---|---|---|
| `platform/schools/new/actions.ts` | `await auth()` + role check | Migrate to `requireAuth(["SUPER_ADMIN"])` |
| `dpdp/actions.ts` (2 functions: `publishPrivacyNotice`, `markBreachParentsNotified`) | `await auth()` inline | Migrate to `requireAuth()` |
| `backend/src/lib/auth/actions.ts` | No DB access — `signOut()` only | Add `// PUBLIC: NextAuth sign-out — no DB access` |

---

### GAP-004 — tRPC Production Logging (REQ-10)

**Status: Resolved by analysis.**  
After reading `backend/src/server/trpc.ts`, the `timingMiddleware` has **no** `NODE_ENV` guard.
It fires unconditionally on all tRPC procedures. REQ-10 is fully satisfied. No code change
needed for this gap.

---

### GAP-005 — reportCard.ts Worker Tenant Scoping (REQ-14)

**Status: Resolved by analysis.**  
After reading `backend/src/workers/reportCard.ts`, the worker:
- Fetches student with `and(eq(students.id, studentId), eq(students.schoolId, schoolId))`.
- Fetches exam with `and(eq(exams.id, examId), eq(exams.schoolId, schoolId))`.
- Throws `"Security Tenant Violation / Not Found"` on mismatch → BullMQ marks FAILED.
- Logs `schoolId` at job start.

REQ-14 is fully satisfied. No code change needed.

---

### GAP-006 — S3 Path Scoping for Generic Upload Route (REQ-15)

**File:** `frontend/src/app/api/upload/route.ts`

**Problem:** The generic `/api/upload` POST endpoint accepts a `prefix` parameter from the
request body and generates S3 keys as `{prefix}/{timestamp}-{filename}`. The caller controls
the prefix, meaning a cross-tenant upload is possible if the caller supplies a different school's
prefix. The underlying `getPresignedUploadUrl()` in `storage.ts` also accepts any key without
path validation.

**Fix — `/api/upload/route.ts` POST handler:**

Replace the caller-controlled `prefix` with a server-derived school-scoped prefix:

```typescript
// BEFORE:
const { filename, contentType, prefix = "uploads" } = await req.json();
const key = `${prefix}/${uniqueSuffix}-${sanitizedName}`;

// AFTER:
const { filename, contentType, subPath = "uploads" } = await req.json();

// Derive school prefix from authenticated session — never from caller
const ctx = await requireAuth();
const schoolPrefix = ctx.schoolId
  ? `schools/${ctx.schoolId}/${subPath}`
  : `platform/${subPath}`; // SUPER_ADMIN platform uploads (not school-tenant)

const key = `${schoolPrefix}/${uniqueSuffix}-${sanitizedName}`;
```

The `requireAuth()` import is already present in the file. The `subPath` parameter controls the
resource type (e.g. `"student-documents"`, `"payslips"`, `"staff-documents"`) but cannot escape
the school-scoped prefix.

**Fix — `backend/src/lib/storage.ts` `getPresignedUploadUrl()`:**

Add a validation guard to prevent path traversal on the S3 key:

```typescript
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
) {
  // Reject path traversal attempts
  if (key.includes("..") || key.startsWith("/")) {
    throw new Error("Invalid S3 key: path traversal detected");
  }

  // ... existing implementation
}
```

**Fix — presigned URL validation (REQ-15.2):**

For the tRPC `admissions.getUploadUrl` and any other presigned URL generators that return keys
to the browser, add a server-side validation before returning a presigned GET URL:

```typescript
// Validation helper — add to storage.ts
export function validateSchoolScopedKey(key: string, schoolId: string): boolean {
  return key.startsWith(`schools/${schoolId}/`);
}
```

This should be called wherever a presigned URL for an existing key is generated (e.g. document
viewer). Presigned upload URLs are already protected because the key is server-generated.

**Legacy files:** Existing files without the `schools/{schoolId}/` prefix remain accessible via
presigned GET URLs (grandfathered). A migration script to move legacy objects and update DB
references is documented in `docs/runbooks/s3-key-migration.md` — this runbook is a deliverable
for closing REQ-15.3.

---

## Error Handling

### Auth Errors
- `requireAuth()` throws `"UNAUTHORIZED"` → caller returns `{ success: false, message }` or HTTP 401.
- `requireAuth()` throws `"FORBIDDEN: requires roles [...]"` → HTTP 403.
- `requireSchool()` throws when school suspended or subscription expired → user-facing message
  surfaced by `safeRequireAuth()`.

### tRPC Errors
- `ZodError` → flattened in `errorFormatter`, HTTP 400.
- `TRPCError({ code: "UNAUTHORIZED" })` → HTTP 401.
- `TRPCError({ code: "FORBIDDEN" })` → HTTP 403.
- `TRPCError({ code: "TOO_MANY_REQUESTS" })` → HTTP 429.
- Unhandled throws → logged at `error` level with sanitized stack (no PII values), HTTP 500.

### Webhook Errors
- Missing signature → HTTP 400.
- Missing secret → HTTP 503 + `console.error`.
- Invalid signature → HTTP 400 (timing-safe, indistinguishable from missing).
- DB transaction failure → exception propagates, HTTP 500 returned to Razorpay (triggers retry).

### Worker Errors
- Tenant violation (wrong `schoolId`) → throws, BullMQ marks FAILED, `failedCount++`.
- DB error → job fails, BullMQ retries up to 3x with exponential backoff (5s base).
- Consent not found → `assertConsent()` throws, job fails.

### Secret Absence
- Production startup without required secrets → `process.exit(1)` (env.ts) or synchronous
  `throw new Error("FATAL: ...")` (individual modules).
- Build time (`NEXT_PHASE=phase-production-build`) → skips runtime validation to allow Docker
  image builds without live secrets.

---

## Testing Strategy

### P0 Gap Tests (GAP-001)

**File:** `frontend/src/app/api/auth/refresh/__tests__/route.test.ts`

```typescript
describe("getJwtSecret", () => {
  it("throws in production when AUTH_SECRET is absent", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(() => getJwtSecret()).toThrow("FATAL:");
    process.env.NODE_ENV = original;
  });

  it("returns dev fallback in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_SECRET;
    expect(getJwtSecret()).toBeInstanceOf(Uint8Array);
  });
});
```

### CI Pipeline Tests (GAP-002)

- Lint: validated by CI run on every PR.
- Unit tests: Vitest with `--run` flag (single-pass, no watch).
- Docker build: `docker build` exit code must be 0.
- Audit: `pnpm audit --audit-level=high` — zero high/critical vulnerabilities.

### Server Action Audit Tests (GAP-003)

- ESLint rule verified by running `pnpm --filter @schoolmitra/frontend run lint` in CI.
- Manual audit table (documented in `docs/server-action-audit.md`) lists all `"use server"` files,
  their guard type, and confirmation status.

### Razorpay Webhook Tests

```typescript
describe("Razorpay webhook", () => {
  it("rejects forged signature", async () => {
    const res = await POST(buildRequest({ signature: "forged" }));
    expect(res.status).toBe(400);
  });
  it("returns 503 when RAZORPAY_WEBHOOK_SECRET is absent", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const res = await POST(buildRequest({ signature: "any" }));
    expect(res.status).toBe(503);
  });
  it("is idempotent on duplicate payment event", async () => {
    // Seed paid log, call POST twice, assert feePayments count === 1
  });
});
```

### Fee Engine Tests

```typescript
describe("autoAssignFeeStructuresToStudent", () => {
  it("rolls back all invoices on partial failure");
  it("skips transport invoice when student.optInTransport = false");
  it("is idempotent: calling twice creates same number of invoices");
});
```

### Health Check Tests

```typescript
describe("GET /api/health", () => {
  it("returns 503 when DB unreachable");
  it("returns 200 degraded when Redis unreachable");
  it("returns 200 ok when all dependencies healthy");
  it("responds in under 500ms");
});
```

### S3 Path Scoping Tests (GAP-006)

```typescript
describe("upload route", () => {
  it("prefixes key with schools/{schoolId}/", async () => {
    const session = mockSession({ schoolId: "school-123" });
    const key = await extractKeyFromUploadRequest(session, "payslips", "doc.pdf");
    expect(key.startsWith("schools/school-123/payslips/")).toBe(true);
  });
  it("rejects caller-controlled schoolId prefix", async () => {
    // Verify prefix cannot be overridden from request body
  });
});

describe("validateSchoolScopedKey", () => {
  it("rejects keys not starting with schools/{schoolId}/");
  it("rejects path traversal in key");
});
```

### TOTP Tests

```typescript
describe("TOTP enforcement", () => {
  it("throws TOTP_REQUIRED when totpEnabled and no code provided");
  it("throws INVALID_TOTP and increments lockout on wrong code");
  it("clears lockout and returns session on valid TOTP");
  it("blocks after 5 failed TOTP attempts for 15 minutes");
});
```
