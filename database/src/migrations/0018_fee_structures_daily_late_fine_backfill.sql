-- Migration: 0018_fee_structures_daily_late_fine_backfill.sql
-- Description: Ensure daily_late_fee_amount and late_fee_cap columns exist on fee_structures with backfill-safe defaults and index

ALTER TABLE "fee_structures" ADD COLUMN IF NOT EXISTS "daily_late_fee_amount" numeric(10, 2);
--> statement-breakpoint
ALTER TABLE "fee_structures" ADD COLUMN IF NOT EXISTS "late_fee_cap" numeric(10, 2);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_structures_late_fee_type_idx" ON "fee_structures" ("school_id", "late_fee_type");
