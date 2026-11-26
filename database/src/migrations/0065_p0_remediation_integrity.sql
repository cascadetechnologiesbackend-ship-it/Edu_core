-- ============================================================
-- Migration 0065: P0 Remediation — Finance Soft-Void, Partial Student Search,
-- Bank Reconciliation Persistence & Academic Assignment Integrity
-- Additive & idempotent. Safe on clean install and production upgrade.
-- ============================================================

-- 1. Fee Payments: Immutable Soft-Void / Cancellation Trail
ALTER TABLE "fee_payments"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancelled_by_id" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

-- Recreate txn_ref unique index so voided payments do not block re-entry of valid refs
DROP INDEX IF EXISTS "fee_payments_txn_ref_unique_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "fee_payments_txn_ref_unique_idx"
  ON "fee_payments" ("school_id", "transaction_reference")
  WHERE "transaction_reference" IS NOT NULL AND "is_cancelled" = false;

CREATE INDEX IF NOT EXISTS "fee_payments_active_idx"
  ON "fee_payments" ("school_id", "is_cancelled", "payment_date");

-- 2. Students: Privacy-Preserving Partial Name Search (Normalized 3+ Char Prefix HMACs) & Roll No Index
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "name_prefix_hashes" TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS "students_name_prefix_hashes_gin_idx"
  ON "students" USING GIN ("name_prefix_hashes");

CREATE INDEX IF NOT EXISTS "students_school_roll_number_idx"
  ON "students" ("school_id", "roll_number");

-- 3. Bank Reconciliation Persistence on Ledger Transactions
ALTER TABLE "account_ledger_transactions"
  ADD COLUMN IF NOT EXISTS "bank_reconciliation_status" TEXT NOT NULL DEFAULT 'UNRECONCILED',
  ADD COLUMN IF NOT EXISTS "bank_reconciled_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "bank_reconciled_by_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "bank_statement_ref" TEXT;

CREATE INDEX IF NOT EXISTS "ledger_tx_brs_status_idx"
  ON "account_ledger_transactions" ("school_id", "bank_account_id", "bank_reconciliation_status");

-- 4. Academics: Configurable Multi-Section / Deputy Class Teachers & Co-Teachers
ALTER TABLE "class_teacher_assignments"
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'PRIMARY';

-- Convert single-teacher-per-year unique index to non-unique lookup index (multi-section controlled by school config)
DROP INDEX IF EXISTS "cta_single_teacher_year_idx";
CREATE INDEX IF NOT EXISTS "cta_single_teacher_year_idx"
  ON "class_teacher_assignments" ("school_id", "academic_year_id", "teacher_id");

-- Ensure each section still has at most ONE active PRIMARY class teacher per academic year
DROP INDEX IF EXISTS "cta_single_section_year_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "cta_single_section_year_idx"
  ON "class_teacher_assignments" ("school_id", "academic_year_id", "section_id")
  WHERE "is_active" = true AND "role" = 'PRIMARY';

-- Unblock co-teachers / lab assistants in section_subject_teachers while preventing duplicate teacher+subject rows
DROP INDEX IF EXISTS "sst_active_unique_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "sst_active_member_unique_idx"
  ON "section_subject_teachers" ("school_id", "section_id", "class_subject_id", "teacher_id")
  WHERE "is_active" = true;

-- 5. Safe Foreign Key Additions (NOT VALID so historical rows never block migration execution)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_attendance_student_id_fk') THEN
    ALTER TABLE "student_attendance"
      ADD CONSTRAINT "student_attendance_student_id_fk"
      FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_attendance_marked_by_id_fk') THEN
    ALTER TABLE "student_attendance"
      ADD CONSTRAINT "student_attendance_marked_by_id_fk"
      FOREIGN KEY ("marked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mark_entries_student_id_fk') THEN
    ALTER TABLE "mark_entries"
      ADD CONSTRAINT "mark_entries_student_id_fk"
      FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

-- ============================================================
-- Rollback Strategy (Manual Down Reference):
--   DROP INDEX IF EXISTS "sst_active_member_unique_idx";
--   DROP INDEX IF EXISTS "ledger_tx_brs_status_idx";
--   DROP INDEX IF EXISTS "students_school_roll_number_idx";
--   DROP INDEX IF EXISTS "students_name_prefix_hashes_gin_idx";
--   DROP INDEX IF EXISTS "fee_payments_active_idx";
--   ALTER TABLE "account_ledger_transactions" DROP COLUMN IF EXISTS "bank_statement_ref", DROP COLUMN IF EXISTS "bank_reconciled_by_id", DROP COLUMN IF EXISTS "bank_reconciled_at", DROP COLUMN IF EXISTS "bank_reconciliation_status";
--   ALTER TABLE "students" DROP COLUMN IF EXISTS "name_prefix_hashes";
--   ALTER TABLE "fee_payments" DROP COLUMN IF EXISTS "cancellation_reason", DROP COLUMN IF EXISTS "cancelled_by_id", DROP COLUMN IF EXISTS "cancelled_at", DROP COLUMN IF EXISTS "is_cancelled", DROP COLUMN IF EXISTS "status";
--   ALTER TABLE "class_teacher_assignments" DROP COLUMN IF EXISTS "role";
-- ============================================================

