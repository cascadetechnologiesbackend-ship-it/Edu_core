# S13 Layer 4 Evidence: Truthful DPDP Consent Attribution, Purpose Limitation, and Opt-In Reconciliation

**Sprint**: S13 — Student Lifecycle Convergence and Durable Event Backbone  
**Layer**: L4 — DPDP Consent Truth  
**Date**: 2026-10-16  
**Status**: COMPLETE  

---

## 1. Objectives & Delivered Scope

1. **Truthful Consent Attribution (`admin_attestation`)**:
   - Replaced falsified `method: 'web_form'`, fake localhost IP (`127.0.0.1`), and generic user agent with truthful attribution in `StudentLifecycleEngine.enrollApplicant`:
     - `method`: `"admin_attestation"` (added to `consentMethodEnum` in migration 0042).
     - `parentUserId`: Recorded as `null` or the parent's actual provisioned userId (never the acting admin's userId).
     - `actingUserId`: Explicitly recorded in metadata/audit as the authenticated staff/admin executing the enrollment.
     - `ipAddress`: Derived from the real client request header (`x-forwarded-for`, `x-real-ip`) via `getClientRequestContext()`.
     - `userAgent`: Client's actual HTTP User-Agent.

2. **Purpose Limitation (Statutory Required Purposes Only)**:
   - Previously, six broad purposes (including marketing/communication, transport, health) were unilaterally pre-granted by the admin.
   - Now, **only mandatory statutory educational purposes** are pre-granted at admission:
     - `admission_data`
     - `academic_records`
   - All optional purposes (`transport`, `health_records`, `communication`, etc.) are **deferred** to the explicit parent opt-in flow on the parent portal (introduced in commit `0658e827`).

3. **Consent Middleware Reconciliation (`backend/src/server/middleware/consent.ts`)**:
   - Rewrote `assertConsent(studentId, purposeId, txOrDb?)` and `getConsentStatus(studentId, txOrDb?)` with a deterministic reconciliation rule:
     - Queries the most recent record for `(studentId, purposeId)` ordered by `grantedAt desc, createdAt desc`.
     - If an explicit record exists: `granted === true && !withdrawnAt` is required to pass; otherwise throws `ConsentRequiredError`.
     - If no record exists: optional purposes immediately fail-closed and throw `ConsentRequiredError`. Statutory purposes fallback to statutory attestation for legacy students.
     - Operates within tenant context or platform context (`withPlatformContext`) to satisfy PostgreSQL RLS policies without tenant leaks.

4. **Parent Opt-In & Withdrawal Flow Updates (`frontend/src/app/(parent)/portal/actions.ts`)**:
   - Replaced hardcoded `127.0.0.1` and `'Parent Portal'` strings with real client request context.
   - Implemented withdrawal invalidation: when a parent withdraws or declines consent (`granted: false`), all prior active records for that student and purpose are invalidated (`withdrawnAt = now, processingHaltedAt = now`).
   - The latest explicit parent decision (`web_form`) always supersedes any prior admin attestation.

---

## 2. Test Suite Execution (`dpdpConsentTruth.test.ts`)

Vitest suite `backend/src/lib/__tests__/dpdpConsentTruth.test.ts` covers the entire end-to-end consent lifecycle:

```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/dpdpConsentTruth.test.ts  (6 tests) 1124ms
   ✓ 4.1: Enrolling an applicant creates truthful consent records with method admin_attestation, real IP, and only statutory purposes
   ✓ 4.2: assertConsent passes for pre-granted statutory purposes (admission_data, academic_records)
   ✓ 4.3: assertConsent fails-closed (throws ConsentRequiredError) for deferred optional purposes (transport, health_records, communication)
   ✓ 4.4: Parent explicit opt-in via web_form grants an optional purpose, making assertConsent pass
   ✓ 4.5: Parent explicit withdrawal supersedes prior grants, making assertConsent fail-closed
   ✓ 4.6: tRPC requireConsent middleware enforces the exact same contract for statutory and optional purposes

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  3.48s
```

### Empirical Verifications:
1. **Attribution**:
   - `consentRecords` row for newly enrolled student contains:
     - `method: 'admin_attestation'`
     - `ipAddress: '203.0.113.195'` (test client IP, never 127.0.0.1)
     - `userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SchoolMitra-Test/1.0'`
     - `purposeId: 'admission_data'` and `'academic_records'` ONLY.
2. **Deferred Purposes**:
   - No rows exist for `transport`, `health_records`, or `communication` at enrollment.
   - `assertConsent(studentId, 'transport')` throws `ConsentRequiredError: DPDP Consent required for purpose: transport`.
3. **Parent Reconciliation**:
   - Parent portal `updateParentConsentAction` inserting a `granted: true` record enables `transport`.
   - Subsequent `granted: false` call invalidates active records and marks `withdrawnAt`, causing immediate fail-closed denial on future queries.

---

## 3. Full Monorepo Test Verification

- `pnpm --filter @schoolmitra/backend test`: **52 passed (370 tests passed)**.
- `pnpm --filter @schoolmitra/frontend test`: **22 passed (155 tests passed)**.
- `pnpm audit:lifecycle`: **0 violations**.
- Typecheck: **0 errors**.
