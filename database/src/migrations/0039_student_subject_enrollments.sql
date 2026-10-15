-- Migration 0039: Student Subject Enrollment Foundation, Exam Attendance Sync, and Result SMS Settings (Sprint S11 Layer 1)
-- Closes the student elective enrollment data gap, wires student_attendance with EXAM source category, and adds result notification settings.

-- 1. Create enrollment_status_enum safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status_enum') THEN
    CREATE TYPE "enrollment_status_enum" AS ENUM ('ACTIVE', 'DROPPED', 'COMPLETED');
  END IF;
END $$;

--> statement-breakpoint
-- 2. Create student_subject_enrollments table
CREATE TABLE IF NOT EXISTS "student_subject_enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
  "class_subject_id" uuid NOT NULL REFERENCES "class_subjects"("id") ON DELETE RESTRICT,
  "is_elective_taken" boolean NOT NULL DEFAULT true,
  "enrollment_status" "enrollment_status_enum" NOT NULL DEFAULT 'ACTIVE',
  "enrolled_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "student_subject_enrollments_unique" UNIQUE ("student_id", "class_subject_id")
);

--> statement-breakpoint
-- 3. Indexes for student_subject_enrollments
CREATE INDEX IF NOT EXISTS "student_subject_enrollments_school_student_idx"
  ON "student_subject_enrollments" ("school_id", "student_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_subject_enrollments_class_subject_idx"
  ON "student_subject_enrollments" ("class_subject_id");

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_subject_enrollments_active_idx"
  ON "student_subject_enrollments" ("student_id", "class_subject_id")
  WHERE "enrollment_status" = 'ACTIVE';

--> statement-breakpoint
-- 4. Additive columns and indexes on student_attendance for EXAM category sync
ALTER TABLE "student_attendance"
  ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'ROUTINE',
  ADD COLUMN IF NOT EXISTS "exam_schedule_id" uuid REFERENCES "exam_schedules"("id") ON DELETE SET NULL;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_attendance_exam_schedule_unique"
  ON "student_attendance" ("student_id", "exam_schedule_id")
  WHERE "exam_schedule_id" IS NOT NULL;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_attendance_exam_schedule_idx"
  ON "student_attendance" ("school_id", "exam_schedule_id")
  WHERE "exam_schedule_id" IS NOT NULL;

--> statement-breakpoint
-- 5. Additive column on result_settings for SMS fallback toggle per school
ALTER TABLE "result_settings"
  ADD COLUMN IF NOT EXISTS "sms_notifications_enabled" boolean NOT NULL DEFAULT false;

--> statement-breakpoint
-- 6. Idempotent backfill: populate student_subject_enrollments with ACTIVE rows for all mandatory (non-elective) subjects
INSERT INTO "student_subject_enrollments" (
  "id",
  "school_id",
  "student_id",
  "class_subject_id",
  "is_elective_taken",
  "enrollment_status",
  "enrolled_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  s.school_id,
  s.id AS student_id,
  cs.id AS class_subject_id,
  true,
  'ACTIVE'::enrollment_status_enum,
  now(),
  now()
FROM "students" s
JOIN "class_subjects" cs ON cs.class_id = s.current_class_id AND cs.school_id = s.school_id
WHERE s.deleted_at IS NULL
  AND s.is_active = true
  AND s.current_class_id IS NOT NULL
  AND cs.is_elective = false
ON CONFLICT ("student_id", "class_subject_id") DO NOTHING;
