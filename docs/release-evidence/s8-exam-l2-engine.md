# Layer 2 Evidence: Grade Engine v2 & Exam Permissions Registry

**Date**: 2026-10-14  
**Sprint**: S8 Offline Examinations Module Rebuild  
**Commit**: Pending Layer 2  
**Status**: PASSED (All 49 unit tests passed, type-check clean)

---

## 1. Grade Engine v2 Pure Functions

File: `backend/src/lib/gradeEngine.ts`

1. **`ClassGroup` Widening**:
   - Extended with `"CLASS_11_12"` alongside `"NURSERY_UKG" | "CLASS_1_5" | "CLASS_6_8" | "CLASS_9_10"`.
2. **`calculateComponentMarks`**:
   - Computes theory, practical, viva, project components.
   - Respects individual component passing thresholds and overall subject passing mark.
   - Handles `isAbsent` and `isExempt` sentinels safely without crashing.
3. **`resolveEffectiveSubjects`**:
   - Supports CBSE-style "Best of 5" calculations: keeps all core/mandatory subjects, dynamically ranks electives, and computes aggregate on top performers.
4. **`calculateDivision`**:
   - First Division (`>= 60%`), Second Division (`>= 50%`), Third Division (`>= 33%`), and Fail (`< 33%` or `!isPassed`).
5. **`aggregateWeightedSetup`**:
   - Blends multiple terms according to `report_card_setups.termsConfig` weights (e.g., Term 1 40% + Term 2 60%).
   - Normalizes across exams and maps to CBSE grade rules.
6. **`buildResultSnapshotPayload`**:
   - Produces the immutable JSON payload stored in `result_snapshots.snapshotData`.
   - Automatically assigns `resultStatus`: `"PASSED"`, `"COMPARTMENT"` (exactly 1 failed subject), or `"FAILED"` (2+ failed subjects).
7. **`rankSnapshots`**:
   - Competition ranking (1, 2, 2, 4): passed students ranked before failed students, with tied scores sharing ranks.
8. **`checkFeeDefaulter`**:
   - Implements `feeLockModeEnum`: `"OFF"`, `"SOFT_WARNING"`, `"HARD_LOCK"`.
   - Supports manual override flag `hasManualOverride` to bypass fee blocks.
9. **`resolveResultVisibility`**:
   - 4-gate release evaluation:
     - Gate 1: `isPublished` boolean.
     - Gate 2: `scheduledPublishAt` future timestamp.
     - Gate 3: Admin individual hold (`result_holds`).
     - Gate 4: Fee defaulter hard lock.

---

## 2. Exam Permissions Registry & Amendment 2 Boundary

File: `backend/src/lib/examPermissions.ts`

- 11 Granular Permissions:
  1. `exam.dashboard.view`
  2. `exam.setup.manage`
  3. `exam.schedule.manage`
  4. `exam.admit_card.manage`
  5. `exam.admit_card.view`
  6. `exam.marks.entry`
  7. `exam.marks.lock`
  8. `exam.marks.unlock`
  9. `exam.result.publish`
  10. `exam.result.view`
  11. `exam.analytics.view`
- **Strict Role Allocations**:
  - `SUPER_ADMIN`: All 11 permissions.
  - `SCHOOL_ADMIN`: All 11 permissions.
  - `PRINCIPAL`: All 11 permissions (including `exam.result.publish`).
  - **TEACHER (Amendment 2)**: ONLY `exam.marks.entry`. Completely excluded from `/exams/*` routes. Teachers grade exclusively through `/teacher/grading`.
  - `ACCOUNTANT`: `exam.admit_card.manage`, `exam.admit_card.view`.
  - `STUDENT`: `exam.admit_card.view`, `exam.result.view`.
  - `PARENT`: `exam.admit_card.view`, `exam.result.view`.
- **Route Guard Matrix Update** (`frontend/src/lib/routeGuards.ts`):
  - Removed `"/exams"` from `ROLE_MODULE_ACCESS_MATRIX.TEACHER`.
  - `/teacher/grading` remains accessible to `TEACHER`.

---

## 3. Test Verification Output

### Vitest Unit Tests:
```text
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/gradeEngine.test.ts  (40 tests) 37ms
 ✓ src/lib/__tests__/examPermissions.test.ts  (9 tests) 8ms

 Test Files  2 passed (2)
      Tests  49 passed (49)
   Start at  23:54:59
   Duration  1.01s
```

### Type-Check:
```text
> turbo run type-check
Tasks:    6 successful, 6 total
Cached:    4 cached, 6 total
Time:      16.896s
```
All packages compile cleanly with zero TypeScript errors.
