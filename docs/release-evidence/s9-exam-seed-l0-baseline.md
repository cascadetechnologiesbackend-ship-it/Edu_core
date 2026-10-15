# S9 Exam Blueprint Pre-Seeding — Layer 0 Pre-Flight & Baseline Verification

**Sprint**: `edu-core-s9-board-exam-blueprint-seeding@9.0.0`  
**Governing Rules**: `SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0`, `SCHOOL-ERP-UIUX-SPEC.md v2.0`, `RULES.md`, `Antigravity Rule Pack`  
**Baseline Git HEAD**: `fa4ccb3ecee882803e084b7ee1402518f7ccfb3b`  
**Execution Timestamp**: 2026-10-15T13:00:00+05:30  

---

## 1. S8 Dependency Checklist Verification

Sprint S9 strictly depends on the schema, permissions, and routes deployed in `edu-core-s8-examinations-module-rebuild@8.0.0`. All prerequisites verified below:

| Artifact / Requirement | Location | Status | Verification Detail |
|---|---|---|---|
| Migration 0035 | `database/src/migrations/0035_examinations_enum_and_alterations.sql` | **CONFIRMED** | Extends `class_group` with `CLASS_11_12`, partial unique indexes on `mark_entries` |
| Migration 0036 | `database/src/migrations/0036_examinations_new_tables.sql` | **CONFIRMED** | 15 examination tables provisioned including `exam_marks_locks` & `cocurricular_areas` |
| Migration Journal | `database/src/migrations/meta/_journal.json` | **CONFIRMED** | Verified `idx: 35` and `idx: 36` cleanly registered |
| `class_group` Enum | `database/src/schema/examinations.ts` | **CONFIRMED** | Includes `NURSERY_UKG`, `CLASS_1_5`, `CLASS_6_8`, `CLASS_9_10`, `CLASS_11_12` |
| `exam_types` Table | `database/src/schema/examinations.ts` | **CONFIRMED** | Defined with `schoolId`, `name`, `code`, `examType`, `weightagePercent`, `isActive` |
| `grade_rules` Table | `database/src/schema/examinations.ts` | **CONFIRMED** | Defined with `schoolId`, `classGroup`, `classId` (nullable override), `minPercent`, `maxPercent`, `grade`, `gradePoint` |
| `cocurricular_areas` Table | `database/src/schema/examinations.ts` | **CONFIRMED** | Defined with `schoolId`, `name`, `description`, `isActive`, unique `(school_id, name)` |
| `exam.setup.manage` Permission | `backend/src/lib/examPermissions.ts` | **CONFIRMED** | Present in `ALL_EXAM_PERMISSIONS` and mapped to `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL` |
| Exams Module Routes | `frontend/src/app/(admin)/exams` | **CONFIRMED** | Routes active: `dashboard`, `manage`, `new`, `schedule`, `admit-cards`, `marks`, `results`, `analytics` |

---

## 2. Next Migration Sequence

- Current latest journal index: `36` (`0036_examinations_new_tables`)
- Next assigned migration: **`0037_board_exam_blueprint.sql`** (`idx: 37`, timestamp `1793300000000`)
- Audit check `pnpm --filter @schoolmitra/database db:check-migrations`:
  ```
  Auditing 37 migration files in V:\Cascade\Edu_core\Edu_core\database\src\migrations...
  ✅ All migration sequence numbers are unique and synchronized with journal.
  ```

---

## 3. Baseline Verification Commands & Results

| Check | Command | Result | Notes |
|---|---|---|---|
| Workspace Typecheck | `pnpm type-check` | **PASS (0 errors)** | 6 of 6 packages cached / clean |
| Frontend Tests | `pnpm --filter @schoolmitra/frontend test` | **PASS (144/144)** | 20 test files passed, 0 failures |
| Exam Permissions Tests | `pnpm --filter @schoolmitra/backend test -- src/lib/__tests__/examPermissions.test.ts` | **PASS (9/9)** | Fail-closed role and route tests green |
| Unscoped Writes AST Audit | `node scripts/audit-unscoped-writes.mjs` | **PASS (0 findings)** | 52 action files scanned, zero unscoped mutations |

---

## 4. Layer 0 Exit Gate

Pre-flight verification passed in full. Ready to execute Layer 1 (Pure Blueprint Registry).
