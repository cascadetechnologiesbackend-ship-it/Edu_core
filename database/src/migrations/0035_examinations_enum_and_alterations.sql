-- Migration 0035: Examinations Enum Extension & Additive Alterations (S8 Layer 1)

-- 1. Extend class_group enum with CLASS_11_12 safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'class_group' AND pg_enum.enumlabel = 'CLASS_11_12'
  ) THEN
    ALTER TYPE class_group ADD VALUE 'CLASS_11_12';
  END IF;
END $$;

-- 2. Additive columns on exam_schedules (datesheet publish gate)
ALTER TABLE "exam_schedules"
  ADD COLUMN IF NOT EXISTS "datesheet_published_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "datesheet_published_by_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "exam_schedules_datesheet_pub_idx"
  ON "exam_schedules" ("school_id", "datesheet_published_at");

-- 3. Additive columns and constraint modernization on mark_entries
ALTER TABLE "mark_entries"
  ADD COLUMN IF NOT EXISTS "component_id" uuid;

-- Amendment 1: Drop old single-tuple unique constraint and replace with two partial unique indexes
-- to eliminate the Postgres NULL uniqueness hole while preserving all legacy data.
ALTER TABLE "mark_entries"
  DROP CONSTRAINT IF EXISTS "mark_entries_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "mark_entries_legacy_unique_idx"
  ON "mark_entries" ("exam_id", "student_id", "subject_id")
  WHERE "component_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "mark_entries_component_unique_idx"
  ON "mark_entries" ("exam_id", "student_id", "subject_id", "component_id")
  WHERE "component_id" IS NOT NULL;

-- 4. Additive columns on report_card_jobs for universal worker tracking
ALTER TABLE "report_card_jobs"
  ADD COLUMN IF NOT EXISTS "job_type" text NOT NULL DEFAULT 'REPORT_CARD',
  ADD COLUMN IF NOT EXISTS "setup_id" uuid;

CREATE INDEX IF NOT EXISTS "report_card_jobs_setup_idx"
  ON "report_card_jobs" ("setup_id");

-- 5. Additive columns on grade_rules for per-class scale overrides
ALTER TABLE "grade_rules"
  ADD COLUMN IF NOT EXISTS "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "grade_rules_school_class_idx"
  ON "grade_rules" ("school_id", "class_id");
