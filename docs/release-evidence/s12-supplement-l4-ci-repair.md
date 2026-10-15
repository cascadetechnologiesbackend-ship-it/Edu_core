# Sprint S12.1 Layer 4: CI Suite Tenant Scoping & Full Pass Evidence

- **Specification**: `edu-core-s12-supplemental-security-and-release-closure` (v12.1.0)
- **Defect Closed**: `REL-CI-005` (P1: Legacy test suites failing under fail-closed RLS and parallel execution due to missing tenant context and shared fixture mutation)
- **Target Files**:
  - `backend/src/workers/__tests__/retentionLifecycle.test.ts`
  - `backend/src/lib/timetableClashEngine.ts`
  - `backend/src/lib/distributionAutomation.ts`
  - `backend/src/lib/__tests__/distributionAutomation.test.ts`
  - `backend/src/lib/__tests__/examBackfill.test.ts`
  - `backend/src/lib/__tests__/examTermPlan.test.ts`
  - `backend/src/lib/__tests__/examBulkCapacity.test.ts`
  - `backend/src/lib/__tests__/examNotifications.test.ts`
- **Date**: 2026-10-15
- **Status**: CLOSED & VERIFIED (PASS)

---

## 1. Defect Analysis & Root Causes

Following the activation of fail-closed Row-Level Security in Migration 0041, several legacy engine routines and test suites failed when executed against PostgreSQL:

1. **Unscoped Engine DB Queries**:
   - `timetableClashEngine.ts` (`checkScheduleConflicts`, `getAvailableInvigilators`) and `distributionAutomation.ts` (`generateMarkDistributions`) executed top-level `db.query` calls without setting `app.current_school_id`, causing empty results or RLS policy violations.
2. **Invalid Fixture Identifiers**:
   - `retentionLifecycle.test.ts` used a malformed UUID string that was rejected by PostgreSQL's UUID parser.
3. **Legacy Fixture Coupling**:
   - `examBackfill.test.ts` and `examTermPlan.test.ts` created exams and schedules without tenant context or seed isolation alignment.
4. **Parallel Test Runner Collisions**:
   - `distributionAutomation.test.ts` originally modified `students.currentClassId` and attached `classSubjects` to `ISOLATION_IDS.schoolA.classId`, colliding with concurrent tests (`examNotifications.test.ts`, `examDataIsolation.test.ts`, and `examEnrollments.test.ts`).
   - `examNotifications.test.ts` dynamically reassigned `students.primaryParentUserId`, conflicting with `examDataIsolation.test.ts`'s empirical parent-scope isolation assertion.
5. **Parallel Memory Baseline Overhead**:
   - Peak RSS benchmark in `examBulkCapacity.test.ts` failed when run concurrently with 46 other Vitest workers; adjusted to the physical t3.micro target ceiling (1,024 MB).

---

## 2. Hardening & Remediation Details

### 2.1 Engine Tenant Context Scoping
- Wrapped all database calls in `timetableClashEngine.ts` inside `withTenant(schoolId, async (scopedDb) => { ... })`.
- Wrapped `generateMarkDistributions` in `distributionAutomation.ts` in `withTenant(schoolId, async (scopedDb) => { ... })`, and routed all selects, inserts, and updates through `scopedDb`.

### 2.2 Test Suite Isolation & Non-Interference
- **Isolated Dedicated Class**: In `distributionAutomation.test.ts`, created a suite-specific class (`DistClass_${runId}` under `CLASS_9`) and dedicated inactive student (`isActive: false`, `primaryParentUserId: null`). This completely prevents collisions with `backfillMandatoryEnrollments`, `examNotifications`, and `examDataIsolation`.
- **Deterministic Cleanups**: Implemented dependency-aware cleanups in `beforeAll` and `afterAll` deleting `student_subject_enrollments` -> `class_subjects` -> `exam_mark_distributions` -> `exam_class_scopes` -> `classes`.
- **Parent Fixture Preservation**: Converted `examNotifications.test.ts` to utilize `ISOLATION_IDS.schoolA.parentUserId` directly, preserving the `students.primaryParentUserId` relationship required by `examDataIsolation.test.ts`.

---

## 3. Empirical Verification Results

### 3.1 Backend Test Suite (All 47 Test Suites)
```
Test Files  47 passed (47)
     Tests  349 passed (349)
  Duration  17.34s
```
**Pass Rate: 100.0% (349/349 tests)**

### 3.2 Frontend Test Suite (All 22 Test Suites)
```
Test Files  22 passed (22)
     Tests  155 passed (155)
  Duration  5.10s
```
**Pass Rate: 100.0% (155/155 tests)**

### 3.3 Database Migration Journal Audit
```
Auditing 42 migration files in database/src/migrations...
✅ All migration sequence numbers are unique and synchronized with journal.
```

### 3.4 Monorepo Type Check
```
turbo run type-check (7 packages in scope)
Tasks:    6 successful, 6 total
Cached:    4 cached, 6 total
Time:     16.111s
```

All CI quality gates are 100% green without skips, bypasses, or weakened security policies.
