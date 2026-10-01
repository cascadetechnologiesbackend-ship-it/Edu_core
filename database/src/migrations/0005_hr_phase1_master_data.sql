-- ─── HR Phase 1 Migration: Master Data & Staff Lifecycle ──────────────────────
CREATE INDEX IF NOT EXISTS "departments_school_idx" ON "departments" ("school_id");
--> statement-breakpoint
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "designations" ADD CONSTRAINT "designations_school_name_unique" UNIQUE("school_id","name");
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "designations_school_idx" ON "designations" ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "designations_dept_idx" ON "designations" ("department_id");
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "emergency_contact_encrypted" text;
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "relieving_date" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "separation_type" text;
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "separation_reason" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_user_idx" ON "staff" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_dept_idx" ON "staff" ("department_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_desig_idx" ON "staff" ("designation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_active_idx" ON "staff" ("school_id","is_active");
