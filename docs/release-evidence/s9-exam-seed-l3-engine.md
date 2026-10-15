# S9 Exam Blueprint Pre-Seeding — Layer 3 Seeding Engine Evidence

**Sprint**: `edu-core-s9-board-exam-blueprint-seeding@9.0.0`  
**Layer**: Layer 3 — Seeding Engine & Onboarding Transaction Wiring  
**Engine File**: `backend/src/lib/examSeeding.ts`  
**Action File**: `frontend/src/app/actions/onboard.ts`  
**Test File**: `backend/src/lib/__tests__/examSeeding.test.ts`  
**Execution Timestamp**: 2026-10-15T13:12:00+05:30  

---

## 1. Seeding Engine Pattern & Invariants

The seeding engine in `backend/src/lib/examSeeding.ts` adheres strictly to the canonical `ensureSchoolChartOfAccounts` precedent:
- **Transaction-aware**: Accepts an optional executor (`client = executor || db`), enabling atomic participation inside `db.transaction(async (tx) => ...)`.
- **Find-First-Then-Insert**: Queries for existence on unique natural keys before inserting:
  - `exam_types`: Keyed on `(school_id, code)`
  - `grade_rules`: Keyed on `(school_id, class_group, grade)` with **Amendment 3** guard: `isNull(gradeRules.classId)` ensuring group seeds never collide with per-class override rows.
  - `cocurricular_areas`: Keyed on `(school_id, name)`
- **User Edit Invariance**: NEVER updates or deletes existing rows. Re-running seeding on an edited row preserves the admin's changes and increments `skipped`.
- **Class Group Scoping**: Derives `activeClassGroups` from the classes actually provisioned; a pre-primary-only school receives zero Grade 1–12 rows.

---

## 2. Onboarding Transaction Wiring

In `frontend/src/app/actions/onboard.ts`:
- Destructures `gradingScale` and `loadExamDefaults` (default `true`) from `ComprehensiveOnboardPayload`.
- Validates `board` against allowable `SchoolBoard` enums and `gradingScale` against `GradingScale` enums.
- Invokes `seedExamBoardDefaults` directly within the existing `registerSchoolTenant` transaction under `set_config('app.current_school_id', newSchool.id, true)`.
- If exam seeding encounters any unhandled error, the entire onboarding transaction rolls back atomically.
- Extends the return payload with `examSeedResult` and summary messaging.

### Action Diff Summary (`frontend/src/app/actions/onboard.ts`)
```diff
+ import { seedExamBoardDefaults } from "@/lib/examSeeding";
+ import { deriveClassGroupsFromClasses, SchoolBoard, GradingScale } from "@/lib/examBoardBlueprints";
...
+   gradingScale?: "CBSE_9_POINT" | "PERCENTAGE" | "GPA";
+   loadExamDefaults?: boolean;
...
+   const validBoards: readonly SchoolBoard[] = ["CBSE", "ICSE", "STATE_BOARD", "IGCSE", "IB"];
+   const resolvedBoard: SchoolBoard = validBoards.includes(board as any) ? (board as SchoolBoard) : "CBSE";
+   const validScales: readonly GradingScale[] = ["CBSE_9_POINT", "PERCENTAGE", "GPA"];
+   const resolvedScale: GradingScale | undefined = gradingScale && validScales.includes(gradingScale as any) ? gradingScale : undefined;
...
+   // 3.5. Seed Examination Board Blueprint Defaults (Sprint S9)
+   let examSeedResult = { insertedExamTypes: 0, insertedGradeRules: 0, insertedCocurricular: 0, skipped: 0 };
+   if (loadExamDefaults !== false) {
+     const activeClassGroups = deriveClassGroupsFromClasses(sortedClasses);
+     examSeedResult = await seedExamBoardDefaults(
+       newSchool.id,
+       resolvedBoard,
+       resolvedScale,
+       tx,
+       { activeClassGroups },
+     );
+   }
...
+   const examMsg = loadExamDefaults !== false
+     ? `, and ${examSeedResult.insertedExamTypes} exam types (${examSeedResult.insertedGradeRules} grade rules)`
+     : "";
+   return {
+     success: true,
+     message: `School '${schoolName}' onboarded successfully! ...${examMsg} provisioned under tenant ${udiseCode}.`,
+     schoolId: newSchool.id,
+     adminEmail,
+     examSeedResult,
+   };
```

---

## 3. Integration & Idempotency Test Output

Executed `pnpm --filter @schoolmitra/backend test -- src/lib/__tests__/examSeeding.test.ts`:
```
 RUN  v1.6.1 V:/Cascade/Edu_core/Edu_core/backend

 ✓ src/lib/__tests__/examSeeding.test.ts  (6 tests) 21ms
   ✓ 1. Full K-12 CBSE Seeding (1)
     ✓ seeds all 7 exam types, 4 cocurricular areas, and grade rules across all 5 class categories
   ✓ 2. Class Category Filtering (Pre-Primary Only School) (1)
     ✓ seeds grade rules ONLY for NURSERY_UKG when school operates only pre-primary classes
   ✓ 3. State Board Enums Seeding (1)
     ✓ seeds QUARTERLY, FORMATIVE, and SUMMATIVE exam types for STATE_BOARD
   ✓ 4. GradingScale Override Precedence (1)
     ✓ provisions division scale for CBSE secondary when admin explicitly selected PERCENTAGE
   ✓ 5. Amendment 3: NULL Guard for Class-Specific Overrides (1)
     ✓ ensures blueprint group-level seeding filters on classId IS NULL so per-class overrides are never collided with
   ✓ 6. Idempotency & User Edit Invariance (1)
     ✓ re-running seeding on already-seeded school skips existing rows without duplicating
```

---

## 4. AST Unscoped Writes Audit

Executed `node scripts/audit-unscoped-writes.mjs`:
```
Auditing 52 server action files...

--- Scan Completed: 0 findings found ---
[]
```

---

## 5. Layer 3 Exit Gate

Seeding engine complete, wired into onboarding transaction, and 100% verified. Ready for Layer 4 (Onboarding Wizard UI).
