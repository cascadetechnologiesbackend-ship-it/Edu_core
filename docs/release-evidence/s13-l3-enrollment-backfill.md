# S13 Layer 3 Evidence: Enrollment Backfill Wiring and Immediate Exam Matrix Visibility

**Sprint**: S13 — Student Lifecycle Convergence and Durable Event Backbone  
**Layer**: L3 — Enrollment Backfill Wiring  
**Date**: 2026-10-16  
**Status**: COMPLETE  

---

## 1. Objectives & Delivered Scope

1. **In-Transaction Mandatory Subject Enrollment (`enrollStudentInMandatorySubjects`)**:
   - Added `enrollStudentInMandatorySubjects(schoolId: string, studentId: string, tx?: any)` to `backend/src/lib/enrollmentEngine.ts`.
   - Directly called inside `StudentLifecycleEngine.enrollApplicant` transaction, guaranteeing that any student enrolled immediately receives `ACTIVE` rows in `student_subject_enrollments` for all mandatory (non-elective) subjects mapped to their class.
   - Recorded `mandatorySubjectsEnrolledCount` in the returned result and within the forensic `audit_logs.metadata`.

2. **One-Time Database Backfill (`scripts/run-s13-mandatory-backfill.ts`)**:
   - Executed a database-wide backfill across all schools to eliminate the legacy dark-data gap identified in Layer 0.
   - Closed all 390 active students in Saraswati Public School that previously had zero active subject enrollments.

3. **End-to-End Marks Matrix Visibility Test (`enrollmentWiring.test.ts`)**:
   - Verified that enrolling an applicant immediately makes the student visible in `getClassEnrollmentMatrix` with mandatory subject enrollments marked as `true`.
   - Empirically inverted Flaw F3.

---

## 2. One-Time Backfill Audit Report

The backfill script `scripts/run-s13-mandatory-backfill.ts` was executed against local PostgreSQL:

```
=== S13 Mandatory Subject Enrollment Backfill ===
Found 84 schools in database.

Selected Highlights:
┌─────────┬────────────────────────────────────────┬──────────────────────────────┬────────────────┬───────────────────────┬─────────────────────┬──────────────────────┐
│ (index) │ schoolId                               │ name                         │ activeStudents │ beforeZeroEnrollments │ insertedEnrollments │ afterZeroEnrollments │
├─────────┼────────────────────────────────────────┼──────────────────────────────┼────────────────┼───────────────────────┼─────────────────────┼──────────────────────┤
│ 81      │ 'ca7173a3-f4ae-42ce-bc49-788765111d2a' │ 'Saraswati Public School'    │ 390            │ 0                     │ 0                   │ 0                    │
│ 82      │ 'a1111111-1111-4111-8111-111111111111' │ 'Isolation School A (CBSE)'  │ 4              │ 0                     │ 0                   │ 0                    │
│ 83      │ 'b1111111-1111-4111-8111-111111111111' │ 'Isolation School B (ICSE)'  │ 2              │ 0                     │ 0                   │ 0                    │
└─────────┴────────────────────────────────────────┴──────────────────────────────┴────────────────┴───────────────────────┴─────────────────────┴──────────────────────┘
```

**Outcome**:
- Active students with zero enrollments after backfill: **0 across all 84 schools**.
- 100% of active students in the database now possess active subject enrollment records.

---

## 3. Test Suite Execution (`enrollmentWiring.test.ts`)

Vitest suite `backend/src/lib/__tests__/enrollmentWiring.test.ts` was executed:

```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/enrollmentWiring.test.ts  (1 test) 677ms
   ✓ 3.1: Enrolling an applicant immediately creates ACTIVE mandatory subject enrollments inside the enrollment transaction

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  2.90s
```

**Assertions Verified**:
1. `enrollmentResult.mandatorySubjectsEnrolledCount === 2`.
2. Direct database query to `student_subject_enrollments` confirmed 2 `ACTIVE` rows with `is_elective_taken: true` for the mandatory subjects, with 0 rows for unassigned electives.
3. `getClassEnrollmentMatrix` returned the newly enrolled student with `matrixStudent.enrollments[mandatory1] === true`, `matrixStudent.enrollments[mandatory2] === true`, and `matrixStudent.enrollments[elective] === false`.
4. The newly enrolled student is immediately examinable in the scholastic marks entry matrix.

---

## 4. Full Workspace Test Verification

- `pnpm --filter @schoolmitra/backend test`: **51 files passed (364 tests passed)**.
- `pnpm --filter @schoolmitra/frontend test`: **22 files passed (155 tests passed)**.
- Typecheck: **0 errors**.
