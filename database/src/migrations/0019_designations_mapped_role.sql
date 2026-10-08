-- Migration: 0019_designations_mapped_role.sql
-- Description: Add mapped_role to designations for authoritative role assignment at onboarding

ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "mapped_role" text;
--> statement-breakpoint
-- Backfill from known designation names (idempotent)
UPDATE "designations" SET "mapped_role" = 'TEACHER' WHERE "is_teaching" = true AND "mapped_role" IS NULL;
--> statement-breakpoint
UPDATE "designations" SET "mapped_role" = 'ACCOUNTANT' WHERE ("name" ILIKE '%chief accountant%' OR "name" ILIKE '%bursar%' OR "name" ILIKE '%account%') AND "is_teaching" = false AND "mapped_role" IS NULL;
--> statement-breakpoint
UPDATE "designations" SET "mapped_role" = 'HR_MANAGER' WHERE ("name" ILIKE '%hr manager%' OR "name" ILIKE '%hr executive%' OR "name" ILIKE '%human resource%') AND "is_teaching" = false AND "mapped_role" IS NULL;
--> statement-breakpoint
UPDATE "designations" SET "mapped_role" = 'LIBRARIAN' WHERE "name" ILIKE '%librarian%' AND "is_teaching" = false AND "mapped_role" IS NULL;
--> statement-breakpoint
UPDATE "designations" SET "mapped_role" = 'PRINCIPAL' WHERE "name" ILIKE '%principal%' AND "is_teaching" = false AND "mapped_role" IS NULL;
--> statement-breakpoint
UPDATE "designations" SET "mapped_role" = 'TRANSPORT_MANAGER' WHERE "name" ILIKE '%transport%' AND "is_teaching" = false AND "mapped_role" IS NULL;
--> statement-breakpoint
UPDATE "designations" SET "mapped_role" = 'SCHOOL_ADMIN' WHERE ("name" ILIKE '%system administrator%' OR "name" ILIKE '%it support%' OR "name" ILIKE '%admin%') AND "is_teaching" = false AND "mapped_role" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "designations_mapped_role_idx" ON "designations" ("school_id", "mapped_role");
