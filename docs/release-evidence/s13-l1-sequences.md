# S13 Layer 1 Evidence: Number Sequences and Uniqueness Integrity

**Sprint**: S13 — Student Lifecycle Convergence and Durable Event Backbone  
**Layer**: L1 — Number Sequences and Uniqueness  
**Date**: 2026-10-16  
**Status**: COMPLETE  

---

## 1. Objectives & Delivered Scope

1. **Database Schema & Monotonic Counter Table (Migration 0042)**:
   - Created `school_counters` table keyed by `(school_id, counter_key)` with `last_value bigint not null default 0`, `updated_at`, and `created_at`.
   - Implemented strict Row-Level Security (`SEC-RLS-001`) with fail-closed tenant isolation (`school_id = current_setting('app.current_school_id', true)`).
   - Created unique partial indexes:
     - `students_school_admission_num_uq` on `students(school_id, admission_number)` WHERE `deleted_at IS NULL`.
     - `admission_apps_school_app_num_uq` on `admission_applications(school_id, application_number)`.

2. **Atomic Monotonic Sequence Generator (`backend/src/lib/sequenceGenerator.ts`)**:
   - `getNextSequenceValue(schoolId, counterKey, tx?)`: Atomic SQL `INSERT ... ON CONFLICT (school_id, counter_key) DO UPDATE SET last_value = school_counters.last_value + 1 RETURNING last_value`. Automatically sets `app.current_school_id` RLS context on the active transaction.
   - `generateAdmissionNumber(schoolId, options?)`: Formats monotonic sequence to `ADM-YYYY-NNNN` (e.g. `ADM-2026-0001`). Includes collision retry loop.
   - `generateApplicationNumber(schoolId, options?)`: Formats monotonic sequence to `APP/YYYY/NNNN` (e.g. `APP/2026/0001`). Includes collision retry loop.

3. **Entry-Point Integration**:
   - `backend/src/server/routers/admissions.ts` (`submitApplication`): Replaced `Math.random()` 4-digit generation with `generateApplicationNumber(schoolId, { year, tx })`.
   - `frontend/src/app/(admin)/admissions/[id]/actions.ts` (`enrollApplicant`): Replaced `Math.random()` 4-digit generation with `generateAdmissionNumber(schoolId, { year, tx })`.

---

## 2. Duplicate Audit on Baseline Database

A database query was executed against the live Postgres instance prior to applying the unique constraints:

```sql
-- Admission Number Duplicate Sweep
SELECT school_id, admission_number, COUNT(*) as cnt
FROM students
WHERE deleted_at IS NULL AND admission_number IS NOT NULL
GROUP BY school_id, admission_number
HAVING COUNT(*) > 1;

-- Application Number Duplicate Sweep
SELECT school_id, application_number, COUNT(*) as cnt
FROM admission_applications
WHERE application_number IS NOT NULL
GROUP BY school_id, application_number
HAVING COUNT(*) > 1;
```

**Results**:
- Existing duplicate admission numbers: **0**
- Existing duplicate application numbers: **0**
- Existing rows safely indexed with zero constraint violations.

---

## 3. Migration Journal & DDL Verification

Migration `0042_s13_lifecycle_backbone.sql` applied successfully and verified against journal:
```
> pnpm exec tsx src/check-migrations.ts
Auditing 43 migration files in database/src/migrations...
✅ All migration sequence numbers are unique and synchronized with journal.
```

---

## 4. Test Suite Execution (`sequenceGenerator.test.ts`)

Vitest suite `backend/src/lib/__tests__/sequenceGenerator.test.ts` was executed:

```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/sequenceGenerator.test.ts  (5 tests) 2856ms
   ✓ 1.1: getNextSequenceValue returns strictly incrementing values within a school
   ✓ 1.2: Tenant Isolation: Counters for school A and school B are completely independent
   ✓ 1.3: generateAdmissionNumber produces zero-padded ADM-YYYY-NNNN format and is strictly monotonic
   ✓ 1.4: generateApplicationNumber produces zero-padded APP/YYYY/NNNN format
   ✓ 1.5: Inversion of F2: 200 sequential calls produce 200 unique numbers with zero collisions

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  4.23s
```

All 5 tests passed, empirically proving that 200 sequential calls produce 200 unique numbers with zero collisions, inverting Flaw F2.

---

## 5. Typecheck & Full Monorepo Status

- `pnpm --filter @schoolmitra/backend type-check`: **0 errors** (Clean).
- `pnpm --filter @schoolmitra/backend test`: **49 files passed (357 tests passed)**.
- `pnpm --filter @schoolmitra/frontend test`: **22 files passed (155 tests passed)**.
