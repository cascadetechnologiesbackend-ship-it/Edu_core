# S13 Layer 5 Evidence: Credential and Notification Decoupling

**Sprint**: S13 — Student Lifecycle Convergence and Durable Event Backbone  
**Layer**: L5 — Credential and Notification Decoupling  
**Date**: 2026-10-16  
**Status**: COMPLETE  

---

## 1. Objectives & Delivered Scope

1. **Decoupled Notification Delivery (`deliverPostCommitNotifications`)**:
   - Eliminated any awaiting of SMS, third-party carrier network calls, or notifications from inside `db.transaction`.
   - All network calls and asynchronous dispatches execute **after the database transaction has committed** via `StudentLifecycleEngine.deliverPostCommitNotifications`.
   - Any failure or timeout in notification dispatch **never rolls back the committed enrollment transaction**.

2. **One-Time Account Activation & Claim Links (Zero Plaintext Passwords)**:
   - Eliminated the guessable password generation flaw (`Parent@` + last 4 digits of parent mobile).
   - Parent accounts are provisioned with:
     - `mustChangePassword: true`
     - Cryptographically secure 32-byte hex claim token (`crypto.randomBytes(32).toString('hex')`)
     - Hashed token stored in `password_reset_tokens` (`sha256(claimToken)`, expires in 7 days)
     - Secure random initial hash (never guessable from phone or email)
     - `claimUrl`: `${appBaseUrl}/claim-account?token=${claimToken}`
   - The queued SMS message and in-app notice contain **zero plaintext passwords or secrets**.

3. **Decoupled Queue Ingestion (`sms_logs`)**:
   - Decoupled enqueue into `sms_logs` table (`templateId: 'PARENT_WELCOME_CLAIM'`, `status: 'QUEUED'`).
   - Resilient failure recording: If the SMS enqueue path fails (e.g. gateway outage or simulated error), a `FAILED` record is visibly recorded in `sms_logs` with `failureReason`, alerting administrators without blocking admission.

4. **In-App Parent Welcome Notice (`notices`)**:
   - Automatically writes an in-app welcome notice to `notices` table scoped to `audienceType: 'PARENTS'`.
   - Filtered to the provisioned parent user and enrolled student.
   - Welcomes parent, confirms admission number and target class/section, and directs them to the fee schedule and academic portal.

5. **First-Party Telemetry & Cache Invalidation**:
   - Writes first-party UX telemetry event to `usage_events` (`screen: '/admissions'`, `elementId: 'btn_enroll_applicant'`, `action: 'submit'`).
   - Invalidates tenant dashboard cache counters via `invalidateDashboardCache(schoolId)` across both Memory L1 and Redis L2, ensuring live student count metrics reflect the new admission immediately.

---

## 2. Test Suite Execution (`credentialDelivery.test.ts`)

Vitest suite `backend/src/lib/__tests__/credentialDelivery.test.ts` was executed:

```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/credentialDelivery.test.ts  (2 tests) 1852ms
   ✓ 5.1: Enrolling an applicant creates a claim link credential, queues SMS without plaintext passwords, logs notice, and emits telemetry
   ✓ 5.2: When SMS enqueue fails, enrollment transaction still succeeds, student is created, and FAILED log row is recorded

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  5.36s
```

### Empirical Verifications:
1. **Zero Plaintext Password**:
   - `result.parentCredentials.claimUrl` contains `/claim-account?token=...`.
   - `password_reset_tokens` has matching SHA-256 hash.
   - `sms_logs` row has status `QUEUED` with zero plaintext passwords.
   - `notices` content contains enrollment details without passwords.
2. **Resilient Failure Isolation**:
   - When `forceSmsFailure: true` is simulated (504 Gateway Timeout):
     - `result.success === true`
     - Student profile is committed and verified in database (`students` table)
     - `sms_logs` contains row with `status: 'FAILED'` and `failureReason: 'Simulated SMS Gateway Outage (504 Gateway Timeout)'`
     - Welcome notice and telemetry still commit successfully.

---

## 3. Full Monorepo Test Verification

- `pnpm --filter @schoolmitra/backend test`: **53 passed (372 tests passed)**.
- `pnpm audit:lifecycle`: **0 violations**.
- Typecheck: **0 errors**.
