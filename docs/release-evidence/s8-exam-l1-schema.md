# Layer 1 Evidence: Data Foundation, Migrations & Schema

**Date**: 2026-10-14  
**Sprint**: S8 Offline Examinations Module Rebuild  
**Baseline HEAD**: `69db79fb1b0272c8a80e849b58636934760e2eaf`  
**Status**: PASSED (Verified across DB & Type Check)

---

## 1. Migration Journal Fix & Idempotency Audit

- **Journal Repair**: Migration `0034_fix_rls_pool_user_permissions.sql` was unjournaled in `database/src/migrations/meta/_journal.json` at HEAD. It was retroactively registered as entry `34` with timestamp `1792910000000` (between 0033 at `1792900000000` and 0035 at `1793000000000`).
- **Migration 0035**: `0035_examinations_enum_and_alterations.sql`
  - Extended `class_group` enum with `'CLASS_11_12'`.
  - Added `datesheet_published_at`, `datesheet_published_by_id` to `exam_schedules`.
  - Added `component_id` (UUID nullable) to `mark_entries`.
  - **Amendment 1 Implemented**: Dropped `mark_entries_unique`. Replaced with two partial unique indexes:
    - `mark_entries_legacy_unique_idx`: `(exam_id, student_id, subject_id) WHERE component_id IS NULL`
    - `mark_entries_component_unique_idx`: `(exam_id, student_id, subject_id, component_id) WHERE component_id IS NOT NULL`
  - Added `job_type`, `setup_id` to `report_card_jobs`.
  - Added `class_id` to `grade_rules`.
- **Migration 0036**: `0036_examinations_new_tables.sql`
  - Created 15 new tables with UUID v4 primary keys, multi-tenant `school_id` foreign keys, indices, and audit timestamps:
    1. `exam_components`
    2. `exam_class_scopes`
    3. `exam_mark_distributions`
    4. `exam_marks_locks`
    5. `exam_admit_card_settings`
    6. `admit_card_templates`
    7. `exam_admit_card_holds`
    8. `cocurricular_areas`
    9. `cocurricular_grades`
    10. `report_card_setups`
    11. `result_settings`
    12. `result_snapshots`
    13. `result_holds`
    14. `uploaded_marksheets`
    15. `public_result_lookups`
  - Created immutability trigger function `enforce_result_snapshot_immutability()` and trigger `trg_enforce_result_snapshot_immutability` preventing UPDATE/DELETE on `result_snapshots`.

---

## 2. Check Migrations Output

```text
> @schoolmitra/database@0.1.0 db:check-migrations V:\Cascade\Edu_core\Edu_core\database
> pnpm exec tsx src/check-migrations.ts

Auditing 37 migration files in V:\Cascade\Edu_core\Edu_core\database\src\migrations...
✅ All migration sequence numbers are unique and synchronized with journal.
```

---

## 3. Migration Execution & Double-Run Idempotency

### Run 1:
```text
> @schoolmitra/database@0.1.0 db:migrate V:\Cascade\Edu_core\Edu_core\database
> pnpm exec tsx src/migrate.ts

Migration started
Using migrations folder: V:\Cascade\Edu_core\Edu_core\database\src\migrations
[Migrate] Found 27 existing migration records in DB.
Migration completed
Checking and seeding default super admin if required...
✅ Super Admin password updated successfully!
```

### Run 2 (Idempotency Proof):
```text
> @schoolmitra/database@0.1.0 db:migrate V:\Cascade\Edu_core\Edu_core\database
> pnpm exec tsx src/migrate.ts

Migration started
Using migrations folder: V:\Cascade\Edu_core\Edu_core\database\src\migrations
[Migrate] Found 30 existing migration records in DB.
Migration completed
Checking and seeding default super admin if required...
✅ Super Admin password updated successfully!
```

---

## 4. PostgreSQL Verification (Tables, Indexes & Triggers)

```text
Checking 15 tables:
  exam_components: OK
  exam_class_scopes: OK
  exam_mark_distributions: OK
  exam_marks_locks: OK
  exam_admit_card_settings: OK
  admit_card_templates: OK
  exam_admit_card_holds: OK
  cocurricular_areas: OK
  cocurricular_grades: OK
  report_card_setups: OK
  result_settings: OK
  result_snapshots: OK
  result_holds: OK
  uploaded_marksheets: OK
  public_result_lookups: OK

mark_entries indexes:
  - mark_entries_pkey
  - mark_entries_exam_idx
  - mark_entries_student_idx
  - mark_entries_legacy_unique_idx (PARTIAL: WHERE component_id IS NULL)
  - mark_entries_component_unique_idx (PARTIAL: WHERE component_id IS NOT NULL)

result_snapshots triggers:
  - trg_enforce_result_snapshot_immutability
```

---

## 5. Type-Check Results

```text
> turbo run type-check
Tasks:    6 successful, 6 total
Cached:    5 cached, 6 total
Time:      56.784s
```

All 6 packages (`@schoolmitra/validators`, `@schoolmitra/domain-events`, `@schoolmitra/dpdp`, `@schoolmitra/database`, `@schoolmitra/backend`, `@schoolmitra/frontend`) compile cleanly with zero TypeScript errors.
