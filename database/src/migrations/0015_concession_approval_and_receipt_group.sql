-- Migration: 0015_concession_approval_and_receipt_group.sql
-- Description: Add student_id, academic_year_id, approved_by_id, approved_at to fee_concessions, and receipt_group_id + idempotency_key to fee_payments with indexes

-- Explicit column additions to fee_concessions (idempotent IF NOT EXISTS)
ALTER TABLE "fee_concessions" ADD COLUMN IF NOT EXISTS "student_id" uuid REFERENCES "students"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "fee_concessions" ADD COLUMN IF NOT EXISTS "academic_year_id" uuid REFERENCES "academic_years"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "fee_concessions" ADD COLUMN IF NOT EXISTS "approved_by_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "fee_concessions" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint

-- Guard: existing policy rows must NOT become null-student assignments.
-- Ensure student_id is nullable so school-wide policy templates remain distinct from student assignments
ALTER TABLE "fee_concessions" ALTER COLUMN "student_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "fee_concessions" ALTER COLUMN "academic_year_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "fee_concessions" ALTER COLUMN "approved_by_id" DROP NOT NULL;
--> statement-breakpoint

-- Multi-invoice receipt grouping and idempotency
ALTER TABLE "fee_payments" ADD COLUMN IF NOT EXISTS "receipt_group_id" text;
--> statement-breakpoint
ALTER TABLE "fee_payments" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fee_payments_receipt_group_idx" ON "fee_payments" ("school_id", "receipt_group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_payments_idempotency_idx" ON "fee_payments" ("school_id", "collected_by_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_concessions_student_guard_idx" ON "fee_concessions" ("school_id", "student_id") WHERE "student_id" IS NOT NULL;
