-- Migration: 0016_accounting_expansion_part_c.sql
-- Description: Phase 7 Accounting expansion: Chart of Accounts, Double-Entry retrofit, Gateway Fee split, Fiscal Year Lock, and Per-Day late fines

-- 1. Account Classification Enum
DO $$ BEGIN
  CREATE TYPE "account_classification_type" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Chart of Accounts Table
CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "code" varchar(50) NOT NULL,
  "name" text NOT NULL,
  "type" "account_classification_type" NOT NULL,
  "parent_code" varchar(50),
  "is_active" boolean DEFAULT true NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "chart_of_accounts_school_code_unique" ON "chart_of_accounts" ("school_id", "code");
CREATE INDEX IF NOT EXISTS "chart_of_accounts_school_type_idx" ON "chart_of_accounts" ("school_id", "type");

-- 3. Retrofit account_ledger_transactions for Double-Entry (DECIDE-12 Option A)
ALTER TABLE "account_ledger_transactions" ADD COLUMN IF NOT EXISTS "debit_account_id" uuid REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL;
ALTER TABLE "account_ledger_transactions" ADD COLUMN IF NOT EXISTS "credit_account_id" uuid REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "ledger_tx_debit_acc_idx" ON "account_ledger_transactions" ("debit_account_id");
CREATE INDEX IF NOT EXISTS "ledger_tx_credit_acc_idx" ON "account_ledger_transactions" ("credit_account_id");

-- 4. Gateway Processing Fee Split (ACC-05)
ALTER TABLE "payment_gateway_logs" ADD COLUMN IF NOT EXISTS "fee_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL;

-- 5. Fiscal Year Lock on academic_years (ACC-06)
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "is_locked" boolean DEFAULT false NOT NULL;
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "locked_at" timestamp with time zone;
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "locked_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "academic_years" ADD COLUMN IF NOT EXISTS "lock_reason" text;

-- 6. Per-day late fine on fee_structures (ACC-08)
ALTER TYPE "late_fee_type" ADD VALUE IF NOT EXISTS 'PER_DAY';

ALTER TABLE "fee_structures" ADD COLUMN IF NOT EXISTS "daily_late_fee_amount" numeric(10, 2);
ALTER TABLE "fee_structures" ADD COLUMN IF NOT EXISTS "late_fee_cap" numeric(10, 2);
