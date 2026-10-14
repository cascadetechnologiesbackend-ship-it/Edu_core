-- Migration 0036: Examinations New Tables, Triggers & Constraints (S8 Layer 1)

-- 1. Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fee_lock_mode') THEN
    CREATE TYPE fee_lock_mode AS ENUM ('OFF', 'SOFT', 'HARD');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marks_lock_status') THEN
    CREATE TYPE marks_lock_status AS ENUM ('SUBMITTED', 'LOCKED');
  END IF;
END $$;

-- 2. Table: exam_components
CREATE TABLE IF NOT EXISTS "exam_components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "exam_id" uuid NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "exam_type_id" uuid NOT NULL REFERENCES "exam_types"("id") ON DELETE RESTRICT,
  "display_name" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "weight_percent" numeric(5, 2),
  "show_on_report_card" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "exam_components_exam_type_unique" UNIQUE ("exam_id", "exam_type_id")
);

CREATE INDEX IF NOT EXISTS "exam_components_exam_idx" ON "exam_components" ("exam_id");
CREATE INDEX IF NOT EXISTS "exam_components_school_idx" ON "exam_components" ("school_id");

-- 3. Table: exam_class_scopes
CREATE TABLE IF NOT EXISTS "exam_class_scopes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "exam_id" uuid NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "exam_class_scopes_unique" UNIQUE ("exam_id", "class_id")
);

CREATE INDEX IF NOT EXISTS "exam_class_scopes_exam_idx" ON "exam_class_scopes" ("exam_id");
CREATE INDEX IF NOT EXISTS "exam_class_scopes_school_idx" ON "exam_class_scopes" ("school_id");

-- 4. Table: exam_mark_distributions
CREATE TABLE IF NOT EXISTS "exam_mark_distributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "exam_id" uuid NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE RESTRICT,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE RESTRICT,
  "component_id" uuid REFERENCES "exam_components"("id") ON DELETE RESTRICT,
  "max_marks" numeric(7, 2) NOT NULL,
  "passing_marks" numeric(7, 2) NOT NULL,
  "display_max_marks" numeric(7, 2),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Partial unique indexes to close NULL component_id hole
CREATE UNIQUE INDEX IF NOT EXISTS "exam_mark_dist_legacy_unique_idx"
  ON "exam_mark_distributions" ("exam_id", "class_id", "subject_id")
  WHERE "component_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "exam_mark_dist_comp_unique_idx"
  ON "exam_mark_distributions" ("exam_id", "class_id", "subject_id", "component_id")
  WHERE "component_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "exam_mark_dist_exam_class_idx" ON "exam_mark_distributions" ("exam_id", "class_id");
CREATE INDEX IF NOT EXISTS "exam_mark_dist_school_idx" ON "exam_mark_distributions" ("school_id");

-- Foreign key on mark_entries.component_id -> exam_components.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mark_entries_component_id_fk'
  ) THEN
    ALTER TABLE "mark_entries"
      ADD CONSTRAINT "mark_entries_component_id_fk"
      FOREIGN KEY ("component_id") REFERENCES "exam_components"("id") ON DELETE RESTRICT;
  END IF;
END $$;

-- 5. Table: exam_marks_locks (2-step workflow state)
CREATE TABLE IF NOT EXISTS "exam_marks_locks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "exam_id" uuid NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "class_id" uuid NOT NULL REFERENCES "classes"("id") ON DELETE RESTRICT,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE RESTRICT,
  "status" marks_lock_status NOT NULL,
  "submitted_by_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "submitted_at" timestamp with time zone,
  "locked_by_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "locked_at" timestamp with time zone,
  "unlock_reason" text,
  "unlocked_by_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "unlocked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "exam_marks_locks_unique" UNIQUE ("exam_id", "class_id", "subject_id")
);

CREATE INDEX IF NOT EXISTS "exam_marks_locks_exam_idx" ON "exam_marks_locks" ("exam_id");
CREATE INDEX IF NOT EXISTS "exam_marks_locks_school_idx" ON "exam_marks_locks" ("school_id");

-- 6. Table: exam_admit_card_settings
CREATE TABLE IF NOT EXISTS "exam_admit_card_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "exam_id" uuid NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "is_released" boolean NOT NULL DEFAULT false,
  "available_from" timestamp with time zone,
  "available_until" timestamp with time zone,
  "instructions" text,
  "exam_centre" text,
  "reporting_time" text,
  "show_photo" boolean NOT NULL DEFAULT true,
  "show_signature" boolean NOT NULL DEFAULT true,
  "signatories" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "fee_lock_mode" fee_lock_mode NOT NULL DEFAULT 'OFF',
  "fee_lock_threshold_amount" numeric(12, 2) NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "exam_admit_card_settings_exam_unique" UNIQUE ("exam_id")
);

CREATE INDEX IF NOT EXISTS "exam_admit_card_settings_school_idx" ON "exam_admit_card_settings" ("school_id");

-- 7. Table: admit_card_templates
CREATE TABLE IF NOT EXISTS "admit_card_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "layout" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "admit_card_templates_school_idx" ON "admit_card_templates" ("school_id");

-- 8. Table: exam_admit_card_holds
CREATE TABLE IF NOT EXISTS "exam_admit_card_holds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "exam_id" uuid NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
  "reason" text NOT NULL,
  "placed_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "placed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "released_by_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "released_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "exam_admit_card_holds_unique" UNIQUE ("exam_id", "student_id")
);

CREATE INDEX IF NOT EXISTS "exam_admit_card_holds_school_idx" ON "exam_admit_card_holds" ("school_id");

-- 9. Table: cocurricular_areas
CREATE TABLE IF NOT EXISTS "cocurricular_areas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "cocurricular_areas_school_name_unique" UNIQUE ("school_id", "name")
);

-- 10. Table: cocurricular_grades
CREATE TABLE IF NOT EXISTS "cocurricular_grades" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "exam_id" uuid NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
  "area_id" uuid NOT NULL REFERENCES "cocurricular_areas"("id") ON DELETE RESTRICT,
  "grade" text NOT NULL,
  "remark" text,
  "graded_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "cocurricular_grades_unique" UNIQUE ("exam_id", "student_id", "area_id")
);

CREATE INDEX IF NOT EXISTS "cocurricular_grades_exam_student_idx" ON "cocurricular_grades" ("exam_id", "student_id");

-- 11. Table: report_card_setups
CREATE TABLE IF NOT EXISTS "report_card_setups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "exam_weightages" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "layout" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "report_card_setups_school_idx" ON "report_card_setups" ("school_id", "academic_year_id");

-- 12. Table: result_settings
CREATE TABLE IF NOT EXISTS "result_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "setup_id" uuid NOT NULL REFERENCES "report_card_setups"("id") ON DELETE CASCADE,
  "withhold_all" boolean NOT NULL DEFAULT false,
  "release_at" timestamp with time zone,
  "fee_lock_mode" fee_lock_mode NOT NULL DEFAULT 'OFF',
  "fee_lock_threshold_amount" numeric(12, 2) NOT NULL DEFAULT 0,
  "public_lookup_enabled" boolean NOT NULL DEFAULT false,
  "public_toppers_enabled" boolean NOT NULL DEFAULT false,
  "last_recomputed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "result_settings_setup_unique" UNIQUE ("setup_id")
);

CREATE INDEX IF NOT EXISTS "result_settings_school_idx" ON "result_settings" ("school_id");

-- 13. Table: result_snapshots
CREATE TABLE IF NOT EXISTS "result_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "setup_id" uuid NOT NULL REFERENCES "report_card_setups"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
  "version" integer NOT NULL DEFAULT 1,
  "payload" jsonb NOT NULL,
  "frozen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "frozen_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "published_at" timestamp with time zone,
  "is_current" boolean NOT NULL DEFAULT true,
  "superseded_by_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "result_snapshots_unique" UNIQUE ("setup_id", "student_id", "version")
);

CREATE INDEX IF NOT EXISTS "result_snapshots_lookup_idx" ON "result_snapshots" ("setup_id", "student_id", "is_current");
CREATE INDEX IF NOT EXISTS "result_snapshots_school_idx" ON "result_snapshots" ("school_id");

-- Immutable Trigger for result_snapshots payload
CREATE OR REPLACE FUNCTION enforce_result_snapshot_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.payload IS DISTINCT FROM NEW.payload) OR
     (OLD.id IS DISTINCT FROM NEW.id) OR
     (OLD.school_id IS DISTINCT FROM NEW.school_id) OR
     (OLD.setup_id IS DISTINCT FROM NEW.setup_id) OR
     (OLD.student_id IS DISTINCT FROM NEW.student_id) OR
     (OLD.version IS DISTINCT FROM NEW.version) OR
     (OLD.frozen_at IS DISTINCT FROM NEW.frozen_at) OR
     (OLD.frozen_by_id IS DISTINCT FROM NEW.frozen_by_id) THEN
    RAISE EXCEPTION 'CANNOT_MUTATE_FROZEN_RESULT_SNAPSHOT: result snapshot records are immutable. Create a revised result version instead.';
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_result_snapshot_immutability ON "result_snapshots";
CREATE TRIGGER trg_enforce_result_snapshot_immutability
  BEFORE UPDATE ON "result_snapshots"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_result_snapshot_immutability();

-- 14. Table: result_holds
CREATE TABLE IF NOT EXISTS "result_holds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "setup_id" uuid NOT NULL REFERENCES "report_card_setups"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
  "reason" text NOT NULL,
  "placed_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "placed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "result_holds_unique" UNIQUE ("setup_id", "student_id")
);

CREATE INDEX IF NOT EXISTS "result_holds_school_idx" ON "result_holds" ("school_id");

-- 15. Table: uploaded_marksheets
CREATE TABLE IF NOT EXISTS "uploaded_marksheets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "setup_id" uuid NOT NULL REFERENCES "report_card_setups"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
  "s3_key" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size_bytes" bigint NOT NULL,
  "uploaded_by_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "uploaded_marksheets_unique" UNIQUE ("setup_id", "student_id")
);

CREATE INDEX IF NOT EXISTS "uploaded_marksheets_school_idx" ON "uploaded_marksheets" ("school_id");

-- 16. Table: public_result_lookups (Audit trail with zero student PII)
CREATE TABLE IF NOT EXISTS "public_result_lookups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "setup_id" uuid REFERENCES "report_card_setups"("id") ON DELETE SET NULL,
  "attempted_at" timestamp with time zone NOT NULL DEFAULT now(),
  "ip_address" text NOT NULL,
  "success" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "public_result_lookups_school_idx" ON "public_result_lookups" ("school_id", "attempted_at");
CREATE INDEX IF NOT EXISTS "public_result_lookups_ip_idx" ON "public_result_lookups" ("ip_address", "attempted_at");
