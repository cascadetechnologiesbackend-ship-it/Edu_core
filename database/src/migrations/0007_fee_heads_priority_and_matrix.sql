-- 0007_fee_heads_priority_and_matrix.sql
-- Add fields for code, priority, particulars, category, and eligibility flags to fee_heads
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "code" varchar(10);
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "priority" integer NOT NULL DEFAULT 99;
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "category" varchar(30) NOT NULL DEFAULT 'RECURRING';
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "discount_eligible" boolean NOT NULL DEFAULT true;
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "late_fine_eligible" boolean NOT NULL DEFAULT false;
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "is_refundable" boolean NOT NULL DEFAULT false;

-- Add partial unique index on fee_structures for atomic idempotent batch upserts
CREATE UNIQUE INDEX IF NOT EXISTS "fee_structures_unique_slot_idx" 
ON "fee_structures" ("school_id", "academic_year_id", "class_id", "fee_head_id", "term") 
WHERE "deleted_at" IS NULL;
