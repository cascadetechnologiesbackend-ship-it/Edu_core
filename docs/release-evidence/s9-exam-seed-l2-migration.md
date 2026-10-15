# S9 Exam Blueprint Pre-Seeding — Layer 2 Migration 0037 Evidence

**Sprint**: `edu-core-s9-board-exam-blueprint-seeding@9.0.0`  
**Layer**: Layer 2 — Migration 0037 Board Examination Blueprint Schema  
**Migration File**: `database/src/migrations/0037_board_exam_blueprint.sql`  
**Journal File**: `database/src/migrations/meta/_journal.json` (Entry `idx: 37`, timestamp `1793300000000`)  
**Schema File**: `database/src/schema/examinations.ts`  
**Execution Timestamp**: 2026-10-15T13:07:00+05:30  

---

## 1. Migration Specification & SQL Contents

Migration 0037 executes two additive, idempotent operations:
1. Extends `exam_type_enum` with `QUARTERLY`, `FORMATIVE`, and `SUMMATIVE` via `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.
2. Adds `applicable_class_groups jsonb` to table `exam_types` via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

### SQL Source (`database/src/migrations/0037_board_exam_blueprint.sql`)
```sql
-- Migration 0037: Board Examination Blueprint Extension (Sprint S9 Layer 2)
-- 
-- 1. Extend exam_type_enum with QUARTERLY, FORMATIVE, SUMMATIVE
ALTER TYPE "exam_type_enum" ADD VALUE IF NOT EXISTS 'QUARTERLY';
ALTER TYPE "exam_type_enum" ADD VALUE IF NOT EXISTS 'FORMATIVE';
ALTER TYPE "exam_type_enum" ADD VALUE IF NOT EXISTS 'SUMMATIVE';

--> statement-breakpoint
-- 2. Add applicable_class_groups column to exam_types for wizard preselection and filtering
ALTER TABLE "exam_types"
  ADD COLUMN IF NOT EXISTS "applicable_class_groups" jsonb;
```

---

## 2. Journal Synchronization Verification

Executed `pnpm --filter @schoolmitra/database db:check-migrations`:
```
Auditing 38 migration files in V:\Cascade\Edu_core\Edu_core\database\src\migrations...
✅ All migration sequence numbers are unique and synchronized with journal.
```

---

## 3. Database Execution & Idempotency Proof (Run Twice)

### Run 1 (Application of 0037)
```
> @schoolmitra/database@0.1.0 db:migrate V:\Cascade\Edu_core\Edu_core\database
> pnpm exec tsx src/migrate.ts

Migration started
Using migrations folder: V:\Cascade\Edu_core\Edu_core\database\src\migrations
[Migrate] Found 30 existing migration records in DB.
Migration completed
Checking and seeding default super admin if required...
✅ Super Admin password updated successfully!
```

### Run 2 (Idempotency Verification)
```
> @schoolmitra/database@0.1.0 db:migrate V:\Cascade\Edu_core\Edu_core\database
> pnpm exec tsx src/migrate.ts

Migration started
Using migrations folder: V:\Cascade\Edu_core\Edu_core\database\src\migrations
[Migrate] Found 31 existing migration records in DB.
Migration completed
Checking and seeding default super admin if required...
✅ Super Admin password updated successfully!
```

---

## 4. Live Postgres Verification

Querying the system catalogs directly from PostgreSQL:
- **`exam_type_enum` values in DB**:
  `['UNIT_TEST', 'HALF_YEARLY', 'ANNUAL', 'PRACTICAL', 'INTERNAL_ASSESSMENT', 'PRE_BOARD', 'ACTIVITY', 'QUARTERLY', 'FORMATIVE', 'SUMMATIVE']`
- **`applicable_class_groups` column in `exam_types`**:
  `[ { column_name: 'applicable_class_groups', data_type: 'jsonb' } ]`

---

## 5. Layer 2 Exit Gate

Migration 0037 applied cleanly, journal synchronized, schema updated, and verified idempotent. Ready for Layer 3 (Seeding Engine & Onboarding Wiring).
