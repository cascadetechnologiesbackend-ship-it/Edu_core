# Implementation Plan

## Overview

The 20 production-readiness requirements are largely implemented. This plan addresses the four
confirmed remaining code gaps (P0/P1) and adds verification tasks â€” unit tests, integration
tests, and CI checks â€” for the already-implemented requirements.

**Task ordering:** P0 gap â†’ P1 gaps â†’ verification of implemented items â†’ integration/E2E

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "label": "P0 Blocker — Hardcoded Secret Fix",
      "tasks": [1, 2, 3]
    },
    {
      "wave": 2,
      "label": "P1 Gaps — CI Pipeline, ESLint Rule, S3 Scoping",
      "tasks": [4, 5, 6, 7]
    },
    {
      "wave": 3,
      "label": "Unit Tests for Implemented Requirements",
      "tasks": [8, 9, 10, 11]
    },
    {
      "wave": 4,
      "label": "Verification and Audit",
      "tasks": [12, 13, 14, 15]
    },
    {
      "wave": 5,
      "label": "Final Checkpoint",
      "tasks": [16]
    }
  ]
}
```

`
Task 1 (GAP-001 exploration test)
  └─► Task 2 (GAP-001 preservation test)
        └─► Task 3 (GAP-001 fix + verify)
              └─► Task 8.1 (unit tests consolidation)

Task 4 (ci.yml completion)
  └─► Task 5 (deploy.yml creation)
        └─► Task 16 (final checkpoint)

Task 6.1 (ESLint plugin create)
  └─► Task 6.2 (wire into .eslintrc.json)
        └─► Task 6.3 (fix 3 unguarded files)
              └─► Task 15 (SA audit sign-off)

Task 7.1 (upload route fix)
  └─► Task 7.2 (storage.ts guard + helper)
        └─► Task 7.3 (s3-key-migration.md runbook)
              └─► Task 9 (S3 path tests)

Task 8.2 (Razorpay webhook tests) — no dependencies
Task 8.3 (fee engine tests) — no dependencies
Task 8.4 (health check tests) — no dependencies
Task 10 (TOTP tests) — no dependencies
Task 11 (impersonation tests) — no dependencies
Task 12 (migration integrity verify) — no dependencies
Task 13 (E2E storageState migration) — no dependencies
Task 14 (env validation verify) ── requires Task 3 complete

All tasks ─► Task 16 (final checkpoint)
`

## Tasks
â†’ final checkpoint.

---

- [x] 1. Fix hardcoded fallback secret in refresh token route (GAP-001 · P0)
  - **Property 1: Bug Condition** - Hardcoded JWT Secret Fallback in Production
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface the concrete case where `getJwtSecret()` returns a known plaintext fallback
    instead of throwing in production
  - **Scoped PBT Approach**: The bug is deterministic — scope property to the exact trigger:
    `NODE_ENV=production`, `AUTH_SECRET` absent, `NEXTAUTH_SECRET` absent
  - Write a unit test for `getJwtSecret()` in `frontend/src/app/api/auth/refresh/route.ts`:
    - Set `process.env.NODE_ENV = "production"`, `NEXT_PHASE` unset
    - Delete `process.env.AUTH_SECRET` and `process.env.NEXTAUTH_SECRET`
    - Assert the function throws with message matching `"FATAL:"`
    - Currently: function returns the hardcoded `Uint8Array` instead of throwing
  - Run test on UNFIXED code — **EXPECTED OUTCOME: Test FAILS** (confirms the bug exists)
  - Document counterexample: `getJwtSecret()` returns
    `"schoolmitra-erp-auth-secret-fallback-key-min-64-characters-long-key!!"` instead of throwing
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.3_

- [x] 2. Write preservation test for refresh route (before implementing fix)
  - **Property 2: Preservation** - Refresh Route Happy Path Behavior
  - **IMPORTANT**: Follow observation-first methodology — observe behavior on UNFIXED code first
  - Observe: `getJwtSecret()` returns a `Uint8Array` when `AUTH_SECRET` is set to a valid string
  - Observe: `getJwtSecret()` returns a dev-fallback `Uint8Array` in `NODE_ENV=development`
    with no secrets set (expected non-production behavior)
  - Write property-based test: for all non-empty `AUTH_SECRET` values, `getJwtSecret()` returns
    a `Uint8Array` encoding of that secret (from Preservation Requirements)
  - Write additional test: `NODE_ENV=development` + no secrets → returns a `Uint8Array`
    (dev-only fallback is acceptable)
  - Verify both tests PASS on UNFIXED code
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 1.7_

- [x] 3. Implement GAP-001: throw-in-production for missing AUTH_SECRET

  - [x] 3.1 Replace warn-and-fallback with throw in `frontend/src/app/api/auth/refresh/route.ts`
    - Open `getJwtSecret()` (lines 8–20)
    - Replace the `console.warn` + hardcoded fallback block with:
      ```typescript
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
      ```
    - _Bug_Condition: `!secret && NODE_ENV === "production" && NEXT_PHASE !== "phase-production-build"`_
    - _Expected_Behavior: function throws `Error("FATAL: AUTH_SECRET...")` instead of returning hardcoded bytes_
    - _Preservation: when `AUTH_SECRET` is set, `getJwtSecret()` encodes and returns it unchanged_
    - _Requirements: 1.1, 1.3, 1.7_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - getJwtSecret throws in production without secrets
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 asserts the function throws; this now confirms the fix
    - Run the unit test from step 1 against the fixed code
    - **EXPECTED OUTCOME: Test PASSES** (confirms GAP-001 is resolved)
    - _Requirements: 1.1, 1.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Refresh Route Happy Path Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run both preservation tests (valid secret → Uint8Array; dev mode → fallback Uint8Array)
    - **EXPECTED OUTCOME: Tests PASS** (confirms no regressions in the happy path)

- [x] 4. Implement GAP-002 Part A: Complete CI pipeline in `ci.yml`
  - Add service containers (`postgres:16`, `redis:7`) to the `validate` job in `.github/workflows/ci.yml`
  - Add Lint step after the existing type-check step:
    ```yaml
    - name: Lint
      run: |
        pnpm --filter @schoolmitra/frontend run lint
        pnpm --filter @schoolmitra/backend run lint
    ```
  - Add Unit Tests step with test environment variables:
    ```yaml
    - name: Unit Tests
      run: pnpm --filter @schoolmitra/backend run test --run
      env:
        NODE_ENV: test
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/schoolmitra_test
        REDIS_URL: redis://localhost:6379
        AUTH_SECRET: test-auth-secret-at-least-32-characters-long
        ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    ```
  - Add Docker Build Verification step:
    ```yaml
    - name: Docker Build Verification
      run: docker build -t schoolmitra-test:${{ github.sha }} .
    ```
  - Add Security Audit step:
    ```yaml
    - name: Security Audit
      run: pnpm audit --audit-level=high
      continue-on-error: false
    ```
  - Verify the `timeout-minutes: 10` budget is still met after additions
  - _Requirements: 6.1, 6.2, 6.6_

- [x] 5. Implement GAP-002 Part B: Create `deploy.yml` workflow
  - Create `.github/workflows/deploy.yml` triggered on `push` to `main`
  - Steps: checkout → Node 20 + pnpm 9 → `pnpm install --frozen-lockfile` →
    `db:check-migrations` → Render.com deploy API call → health-check polling loop (12 × 10s)
  - Health check loop exits 0 on first HTTP 200 from `/api/health`, exits 1 after 12 retries
  - Add `timeout-minutes: 15` to prevent hung deploys from blocking main
  - Document the three required GitHub secrets in a comment at the top of the file:
    `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `RENDER_SERVICE_HOSTNAME`
  - Add these secrets in GitHub repository Settings → Secrets and Variables → Actions
  - _Requirements: 6.3, 6.4_

- [x] 6. Implement GAP-003: ESLint rule enforcing requireAuth() on Server Actions

  - [x] 6.1 Create `packages/eslint-plugin-schoolmitra` package
    - Create `packages/eslint-plugin-schoolmitra/package.json`:
      ```json
      {
        "name": "eslint-plugin-schoolmitra",
        "version": "1.0.0",
        "main": "index.js",
        "private": true
      }
      ```
    - Create `packages/eslint-plugin-schoolmitra/rules/no-unguarded-server-action.js`
      with the rule logic that detects files where all four conditions are true:
      `"use server"` directive present + `@/db` import present + no `requireAuth` import
      from `serverAuth` + no `// PUBLIC: <reason>` file-level comment
    - Report at `{ line: 1, column: 0 }` with actionable message
    - Create `packages/eslint-plugin-schoolmitra/index.js` registering the rule as
      `schoolmitra/no-unguarded-server-action`
    - _Requirements: 9.3, 9.4_

  - [x] 6.2 Wire the ESLint plugin into `frontend/.eslintrc.json`
    - Add `"plugins": ["schoolmitra"]` and `"schoolmitra/no-unguarded-server-action": "error"`
    - Add `"eslint-plugin-schoolmitra": "workspace:*"` to `frontend/package.json` devDependencies
    - Run `pnpm --filter @schoolmitra/frontend run lint` locally to confirm the rule loads
    - _Requirements: 9.3, 9.4_

  - [x] 6.3 Fix the three unguarded Server Action files
    - **`frontend/src/app/platform/schools/new/actions.ts`**: Replace `await auth()` + inline
      role check with `await requireAuth(["SUPER_ADMIN"] as const)` from `@/lib/serverAuth`.
      Remove the `import { auth }` line; add `import { requireAuth } from "@/lib/serverAuth"`.
    - **`frontend/src/app/(admin)/dpdp/actions.ts`** — `updateVendorDpaStatus` function:
      Replace `const session = await auth(); if (!session?.user?.id) ...` with
      `const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const)`.
      Remove the now-unused `import { auth }` import from the file.
    - **`backend/src/lib/auth/actions.ts`**: Add `// PUBLIC: NextAuth sign-out — no DB access`
      at the top of the file (below `"use server"`). This file has no DB import so the rule
      will not fire on it, but the annotation is good hygiene per REQ-9.5.
    - Re-run lint to confirm zero violations after all three fixes
    - _Requirements: 9.2, 9.5, 9.6_

- [x] 7. Implement GAP-006: School-scope the generic upload route

  - [x] 7.1 Replace caller-controlled `prefix` with session-derived school prefix in `frontend/src/app/api/upload/route.ts`
    - Change the destructured request body from `{ filename, contentType, prefix = "uploads" }`
      to `{ filename, contentType, subPath = "uploads" }`
    - After `await requireAuth(...)`, extract `schoolId` from the returned context:
      ```typescript
      const ctx = await requireAuth([...roles]);
      const schoolPrefix = ctx.schoolId
        ? `schools/${ctx.schoolId}/${subPath}`
        : `platform/${subPath}`;
      const key = `${schoolPrefix}/${uniqueSuffix}-${sanitizedName}`;
      ```
    - Remove the old `const key = \`${prefix}/...\`` line
    - `subPath` controls the resource subfolder (e.g. `"student-documents"`, `"payslips"`)
      but can never escape the school-scoped prefix
    - _Requirements: 15.1, 15.2_

  - [x] 7.2 Add path-traversal guard and `validateSchoolScopedKey` to `backend/src/lib/storage.ts`
    - At the top of `getPresignedUploadUrl()`, add:
      ```typescript
      if (key.includes("..") || key.startsWith("/")) {
        throw new Error("Invalid S3 key: path traversal detected");
      }
      ```
    - Export a new validation helper:
      ```typescript
      export function validateSchoolScopedKey(key: string, schoolId: string): boolean {
        return key.startsWith(`schools/${schoolId}/`);
      }
      ```
    - _Requirements: 15.1, 15.2_

  - [x] 7.3 Create `docs/runbooks/s3-key-migration.md`
    - Document the current state: legacy files uploaded before the school-scoping fix have paths
      like `uploads/{timestamp}-{filename}` without a `schools/{schoolId}/` prefix
    - Document that legacy files remain accessible via presigned GET URLs (grandfathered)
    - Provide a migration script outline:
      1. Query `student_documents`, `staff_documents`, and any other tables storing S3 keys
      2. For each row with a key not starting with `schools/{schoolId}/`, copy the S3 object
         to the scoped key using `aws s3 cp`
      3. Update the DB row's key column to the new scoped key
      4. Delete the old unscoped S3 object
    - Specify timeline: migration to be run before the first production traffic cutover
    - _Requirements: 15.3_

- [x] 8. Write unit tests for GAP-001 (refresh route) and core security paths

  - [x] 8.1 Unit tests for `getJwtSecret()` (already covered by tasks 1–3, consolidate here)
    - Confirm test file at `frontend/src/app/api/auth/refresh/__tests__/route.test.ts`
    - Ensure tests cover: throws in production without secrets; returns Uint8Array with valid
      secret; returns dev fallback in development
    - Run `pnpm --filter @schoolmitra/frontend run test --run` to verify all pass

  - [x] 8.2 Unit tests for Razorpay webhook (`frontend/src/app/api/webhooks/razorpay/route.ts`)
    - Create `frontend/src/app/api/webhooks/razorpay/__tests__/route.test.ts`
    - Test: missing signature header → HTTP 400
    - Test: absent `RAZORPAY_WEBHOOK_SECRET` env var → HTTP 503
    - Test: `RAZORPAY_WEBHOOK_SECRET="change-me"` → HTTP 503
    - Test: forged signature (valid body, wrong HMAC) → HTTP 400
    - Test: valid `payment.captured` event → idempotency guard prevents double credit
      (seed a `PAID` log, call POST twice, assert `feePayments` count = 1)
    - _Requirements: 13.1, 13.2, 13.3, 13.5_

  - [x] 8.3 Unit tests for fee assignment engine (`backend/src/lib/feeAssignmentEngine.ts`)
    - Create `backend/src/lib/__tests__/feeAssignmentEngine.test.ts`
    - Test happy path: student with 2 applicable fee structures → 2 invoices created, all inside
      a single transaction
    - Test partial failure: mock the second `insert` to throw → assert zero invoices committed
      (transaction rollback)
    - Test idempotency: calling `autoAssignFeeStructuresToStudent()` twice for the same student
      produces the same invoice count (duplicate check gate)
    - Test transport opt-out: student with `optInTransport = false` → no TRANSPORT head invoice
    - _Requirements: 8.1, 8.2, 8.4_

  - [x] 8.4 Unit tests for health check endpoint (`frontend/src/app/api/health/route.ts`)
    - Create `frontend/src/app/api/health/__tests__/route.test.ts`
    - Test: DB connection fails → HTTP 503, `{ status: "error", database: "error" }`
    - Test: Redis `ping` throws → HTTP 200, `{ status: "degraded", redis: "degraded", database: "ok" }`
    - Test: all healthy → HTTP 200, `{ status: "ok", database: "ok", redis: "ok" }`
    - Test: response time < 500 ms (use `Date.now()` delta around the GET call)
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 9. Write unit tests for S3 path scoping (GAP-006)
  - Create `frontend/src/app/api/upload/__tests__/route.test.ts`
  - Test: authenticated POST with `schoolId = "school-123"` → returned key starts with
    `schools/school-123/`
  - Test: request body providing an arbitrary `prefix` value → prefix is IGNORED, key still
    starts with `schools/{sessionSchoolId}/`
  - Test: SUPER_ADMIN with no `schoolId` → key starts with `platform/`
  - Test: unauthenticated POST → `requireAuth` throws → HTTP 500 (auth error propagated)
  - Test `validateSchoolScopedKey()` in `storage.ts`:
    - `"schools/abc/file.pdf"` with schoolId `"abc"` → `true`
    - `"schools/other/file.pdf"` with schoolId `"abc"` → `false`
    - `"../etc/passwd"` → path traversal guard in `getPresignedUploadUrl` throws
  - _Requirements: 15.1, 15.2_

- [x] 10. Verify TOTP enforcement and account lockout (REQ-12)
  - Create `backend/src/lib/auth/__tests__/authorize.test.ts`
  - Test: `totpEnabled = true`, no `totpCode` provided → throws `"TOTP_REQUIRED"`
  - Test: `totpEnabled = true`, wrong `totpCode` → `recordFailedAttempt()` called, throws
    `"INVALID_TOTP"`
  - Test: `totpEnabled = true`, correct `totpCode` → `clearLockout()` called, returns user object
  - Test: 5 consecutive wrong TOTP codes → `isAccountLocked()` returns true on 6th attempt,
    throws lockout error
  - Test: `totpEnabled = false` → TOTP check is skipped entirely, proceeds to session creation
  - _Requirements: 12.1, 12.2, 12.4_

- [x] 11. Verify SUPER_ADMIN impersonation role scoping (REQ-11)
  - Create `backend/src/lib/__tests__/serverAuth.test.ts`
  - Test: SUPER_ADMIN session without `sm_impersonation` cookie + `allowedRoles = ["SCHOOL_ADMIN"]`
    → NOT forbidden (platform bypass for non-impersonating SUPER_ADMIN)
  - Test: SUPER_ADMIN session with valid `sm_impersonation` cookie, `effectiveRole = "SCHOOL_ADMIN"`,
    `allowedRoles = ["SCHOOL_ADMIN"]` → allowed, returns `schoolId` from impersonation token
  - Test: SUPER_ADMIN session with valid `sm_impersonation` cookie, `effectiveRole = "SCHOOL_ADMIN"`,
    `allowedRoles = ["PRINCIPAL"]` → throws `"FORBIDDEN: requires roles [PRINCIPAL]"`
  - Test: `sm_impersonation` cookie with wrong `superAdminId` → token rejected, `schoolId`
    stays `null`
  - _Requirements: 11.1, 11.2_

- [x] 12. Verify migration sequence integrity (REQ-3)
  - Run `pnpm --filter @schoolmitra/database run db:check-migrations` locally and confirm exit 0
  - Verify the three renamed files have the correct prefixes: `0010_`, `0011_`, `0012_`
  - Verify `meta/_journal.json` lists all migration entries in numeric order with no gaps
  - Verify the CI step in `ci.yml` (`Verify Migration Sequence & Journal`) is present and
    positioned before `Type-Check Monorepo`
  - _Requirements: 3.1, 3.2, 3.5_

- [x] 13. Verify E2E auth uses storageState (REQ-2 remaining gap)
  - **Current state:** `frontend/e2e/fixtures/auth.fixture.ts` performs live login for every
    test via `page.fill()` + `page.click()` — no `storageState` caching, no `globalSetup`
  - Migrate fixtures to the storageState pattern:
    - Add `globalSetup: "./e2e/global-setup.ts"` to `playwright.config.ts`
    - Create `frontend/e2e/global-setup.ts` that authenticates each test role
      (admin, parent, teacher) and saves state to `.auth/{role}.json` via
      `context.storageState({ path: '.auth/admin.json' })`
    - Update `auth.fixture.ts` to restore from storage state:
      ```typescript
      adminPage: async ({ browser }, use) => {
        const context = await browser.newContext({
          storageState: ".auth/admin.json",
        });
        const page = await context.newPage();
        await use(page);
        await context.close();
      }
      ```
    - Add `.auth/` to `.gitignore`
  - Run all 13 E2E spec files to confirm they pass using the new auth mechanism
  - _Requirements: 2.3, 2.4, 2.5, 2.6_

- [x] 14. Verify env validation and `.env.local.example` (REQ-1)
  - Run `NODE_ENV=production AUTH_SECRET="" node -e "require('./backend/src/env')"` and confirm
    process exits with code 1 and names the missing variable
  - Verify `backend/src/env.ts` validates at minimum: `AUTH_SECRET` (min 32 chars),
    `ENCRYPTION_KEY` (64 hex chars), `DATABASE_URL`, `REDIS_URL`, `S3_BUCKET`,
    `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - Verify `.env.local.example` at workspace root documents every required var with description
    and generation instruction (e.g. `openssl rand -hex 32` for `AUTH_SECRET`)
  - Verify `NODE_ENV=development` with a `.env.local` file containing valid values → application
    starts without exit
  - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7_

- [x] 15. Verify Server Action authorization audit (REQ-9 final sign-off)
  - Run `pnpm --filter @schoolmitra/frontend run lint` after completing task 6 and confirm
    zero `schoolmitra/no-unguarded-server-action` violations
  - Create `docs/server-action-audit.md` listing every `"use server"` file, its guard type
    (`requireAuth()` / `requireAuth()` via wrapper / `// PUBLIC:` annotation), and confirmation
    status — use `node audit-server-actions.js` (already present at workspace root) to enumerate
  - Confirm `platform/schools/new/actions.ts` now uses `requireAuth(["SUPER_ADMIN"])`
  - Confirm `dpdp/actions.ts` `updateVendorDpaStatus` now uses `requireAuth()`
  - Confirm `backend/src/lib/auth/actions.ts` has `// PUBLIC:` annotation
  - _Requirements: 9.1, 9.2, 9.5, 9.6_

- [x] 16. Final checkpoint — all tests pass and CI is green
  - Run `pnpm --filter @schoolmitra/backend run test --run` — confirm all unit tests pass
  - Run `pnpm --filter @schoolmitra/frontend run lint` — confirm zero lint errors
  - Run `pnpm --filter @schoolmitra/database run db:check-migrations` — confirm exit 0
  - Push a branch and open a PR — confirm the updated `ci.yml` passes all jobs (lint, type-check,
    unit tests, Docker build, security audit) within the 10-minute budget
  - Merge to `main` — confirm `deploy.yml` triggers, deploys to Render, and the post-deploy
    health check returns HTTP 200
  - Ensure all tasks above are marked complete, ask the user if any questions arise
## Notes

- All "verify" tasks for already-implemented requirements do not require new implementation — they confirm the existing code meets acceptance criteria by running tests and inspecting files.
- Tasks 1–3 follow the bug-condition/preservation test methodology: write a failing test first (task 1), a passing preservation test second (task 2), then implement the fix (task 3), then re-run both to confirm.
- GAP-004 (tRPC production logging) and GAP-005 (reportCard worker tenant scoping) were resolved during analysis — both are confirmed fully implemented. No tasks needed.
- The four remaining gaps (GAP-001, GAP-002, GAP-003, GAP-006) were confirmed by reading the actual files, not from the claimed implementation document.
- RENDER_API_KEY, RENDER_SERVICE_ID, and RENDER_SERVICE_HOSTNAME must be added to GitHub repo secrets before task 5 can be verified end-to-end.
- The .auth/ directory (Playwright storageState files) must be added to .gitignore — these contain session tokens and must never be committed.

