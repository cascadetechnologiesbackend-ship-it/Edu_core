-- Migration 0037: Board Examination Blueprint Extension (Sprint S9 Layer 2)
-- 
-- 1. Extend exam_type_enum with QUARTERLY, FORMATIVE, SUMMATIVE
-- Note on transaction-safety: ALTER TYPE ... ADD VALUE cannot be executed inside a single-statement
-- DML transaction that immediately queries the new value. The enum values are registered here and
-- referenced in subsequent application/seeding layers.
ALTER TYPE "exam_type_enum" ADD VALUE IF NOT EXISTS 'QUARTERLY';
ALTER TYPE "exam_type_enum" ADD VALUE IF NOT EXISTS 'FORMATIVE';
ALTER TYPE "exam_type_enum" ADD VALUE IF NOT EXISTS 'SUMMATIVE';

--> statement-breakpoint
-- 2. Add applicable_class_groups column to exam_types for wizard preselection and filtering
ALTER TABLE "exam_types"
  ADD COLUMN IF NOT EXISTS "applicable_class_groups" jsonb;
