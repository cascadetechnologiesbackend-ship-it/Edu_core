# S13 Layer 2 Evidence: Student Lifecycle Engine Extraction and Admission State Machine

**Sprint**: S13 — Student Lifecycle Convergence and Durable Event Backbone  
**Layer**: L2 — Lifecycle Engine Extraction & State Machine  
**Date**: 2026-10-16  
**Status**: COMPLETE  

---

## 1. Objectives & Delivered Scope

1. **Extraction of Canonical Student Lifecycle Engine (`backend/src/lib/studentLifecycleEngine.ts`)**:
   - Single authoritative engine executing the complete, atomic, 12-junction enrollment pipeline:
     1. Tenant scope verification and idempotency check.
     2. Admissions state machine validation (`assertValidAdmissionTransition`).
     3. Active class, section, and academic year verification.
     4. Section capacity check (records capacity warning on overflow per Decision D4).
     5. Monotonic sequence admission number generation (`generateAdmissionNumber`).
     6. Canonical Person record provisioning for student.
     7. Student profile record creation.
     8. Student class history initialization (`promotionStatus: "ENROLLED"`).
     9. Parent user provisioning (cryptographically random password, `mustChangePassword: true`, canonical person, `PARENT` role).
     10. Student family member records with indexed mobile & email search hashes.
     11. Admission document copy to student documents.
     12. Truthful DPDP consent attestation (`method: "admin_attestation"`, required-only purposes: `admission_data`, `academic_records`).
     13. Multi-factor sibling detection and fee concessions (RTE 100%, Sibling 10%, Staff Ward 50%).
     14. Automatic fee structure assignment and initial invoice generation (`autoAssignFeeStructuresToStudent`).
     15. Mandatory subject enrollments inside transaction (`enrollStudentInMandatorySubjects`).
     16. Application status transition to `ENROLLED` and workflow step completion.
     17. Forensic audit logging with real client IP (never `127.0.0.1`).
     18. Durable domain event outbox row (`domain_events` table).

2. **Admissions State Machine Guard (`packages/validators/src/admissionsStateMachine.ts`)**:
   - Defined strict legal transition map across `APPLIED`, `SCREENING`, `ENTRANCE_TEST`, `INTERVIEW`, `OFFER_LETTER`, `ENROLLED`, `REJECTED`, `WAITLISTED`, `WITHDRAWN`.
   - Enforced typed errors:
     - `InvalidAdmissionStateTransitionError`: Forbids illegal transitions (e.g. `REJECTED -> ENROLLED`, `ENROLLED -> APPLIED`, same-status transitions).
     - `UnknownAdmissionStatusError`: Rejects arbitrary or typo strings (e.g. `"ENROLELD"`).

3. **Ghost Service Elimination (Decision D1)**:
   - Deleted `backend/src/server/services/AdmissionsDomainService.ts` completely from the repository.

4. **Admissions Server Action Refactoring**:
   - `frontend/src/app/(admin)/admissions/[id]/actions.ts`:
     - `enrollApplicant`: Refactored to thin server-action wrapper delegating to `StudentLifecycleEngine.enrollApplicant`.
     - `updateApplicationStatus`: Validates all status transitions using `validateAdmissionTransition`.
     - `requestContext.ts`: Extracts real client IP and User-Agent from headers (never loopback).

5. **Static CI Guard (`scripts/audit-lifecycle-hygiene.mjs`)**:
   - Scans backend and frontend production code.
   - Enforces that direct `.insert(students)` is strictly prohibited outside `backend/src/lib/studentLifecycleEngine.ts`.
   - Enforces zero references to `AdmissionsDomainService`.

---

## 2. Test Suite Execution (`studentLifecycleEngine.test.ts`)

Vitest suite `backend/src/lib/__tests__/studentLifecycleEngine.test.ts` was executed against live Postgres:

```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/studentLifecycleEngine.test.ts  (6 tests) 1190ms
   ✓ 2.1: Admissions State Machine Enforcement > allows legal forward transitions
   ✓ 2.1: Admissions State Machine Enforcement > rejects illegal transitions with InvalidAdmissionStateTransitionError (Inversion of F7)
   ✓ 2.1: Admissions State Machine Enforcement > rejects unknown or misspelled status strings with UnknownAdmissionStatusError
   ✓ 2.2: Unified Lifecycle Engine - 12-Junction Completeness > executes all 12 junctions atomically for a valid application
   ✓ 2.2: Unified Lifecycle Engine - 12-Junction Completeness > 2.3: Idempotent re-enrollment returns existing student without duplicating records
   ✓ 2.2: Unified Lifecycle Engine - 12-Junction Completeness > 2.4: Tenant isolation: School B cannot enroll School A application

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  3.35s
```

All 6 tests passed, proving state machine enforcement, 12-junction transactional completeness, idempotency, and tenant isolation.

---

## 3. CI Static Hygiene Guard Output

```
> node scripts/audit-lifecycle-hygiene.mjs
Running S13 Lifecycle Hygiene Static Analysis...
✅ S13 Lifecycle Hygiene Guard PASSED: student creation is strictly engine-scoped, zero ghost references.
```

---

## 4. Full Workspace Test & Typecheck Verification

- `pnpm --filter @schoolmitra/validators type-check`: **0 errors**.
- `pnpm --filter @schoolmitra/backend type-check`: **0 errors**.
- `pnpm --filter @schoolmitra/backend test`: **50 files passed (363 tests passed)**.
- `pnpm --filter @schoolmitra/frontend test`: **22 files passed (155 tests passed)**.
- Root script `"audit:lifecycle"` added to `package.json`.
