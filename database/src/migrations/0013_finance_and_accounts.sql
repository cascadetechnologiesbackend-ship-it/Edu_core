-- Migration: 0013_finance_and_accounts.sql
-- Description: Finance & Fees and Accounts modules (Layer 1, Layer 2, Layer 3)

CREATE TABLE IF NOT EXISTS "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"ifsc_code" varchar(20),
	"branch_name" text,
	"opening_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"current_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "bank_accounts_school_acc_unique" UNIQUE("school_id", "account_number")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bank_accounts_school_idx" ON "bank_accounts" ("school_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "income_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"name" text NOT NULL,
	"code" varchar(20),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "income_heads_school_name_unique" UNIQUE("school_id", "name")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "income_heads_school_idx" ON "income_heads" ("school_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "expense_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"name" text NOT NULL,
	"code" varchar(20),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "expense_heads_school_name_unique" UNIQUE("school_id", "name")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_heads_school_idx" ON "expense_heads" ("school_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "income_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"voucher_number" text NOT NULL,
	"income_head_id" uuid NOT NULL REFERENCES "income_heads"("id") ON DELETE restrict,
	"bank_account_id" uuid REFERENCES "bank_accounts"("id") ON DELETE set null,
	"amount" numeric(14, 2) NOT NULL,
	"payment_mode" text DEFAULT 'CASH' NOT NULL,
	"payment_source" text,
	"transaction_reference" text,
	"receipt_attachment_s3_key" text,
	"entry_date" timestamp with time zone DEFAULT now() NOT NULL,
	"remarks" text,
	"created_by_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "income_vouchers_num_unique" UNIQUE("school_id", "voucher_number")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "income_vouchers_school_idx" ON "income_vouchers" ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "income_vouchers_date_idx" ON "income_vouchers" ("entry_date");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "expense_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"voucher_number" text NOT NULL,
	"expense_head_id" uuid NOT NULL REFERENCES "expense_heads"("id") ON DELETE restrict,
	"bank_account_id" uuid REFERENCES "bank_accounts"("id") ON DELETE set null,
	"vendor_name" text,
	"amount" numeric(14, 2) NOT NULL,
	"payment_mode" text DEFAULT 'CASH' NOT NULL,
	"transaction_reference" text,
	"invoice_attachment_s3_key" text,
	"entry_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'APPROVED' NOT NULL,
	"approved_by_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"approved_at" timestamp with time zone,
	"remarks" text,
	"created_by_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_vouchers_num_unique" UNIQUE("school_id", "voucher_number")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_vouchers_school_idx" ON "expense_vouchers" ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_vouchers_date_idx" ON "expense_vouchers" ("entry_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expense_vouchers_status_idx" ON "expense_vouchers" ("status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "account_ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"transaction_number" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"bank_account_id" uuid REFERENCES "bank_accounts"("id") ON DELETE set null,
	"transaction_type" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"balance_after" numeric(14, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_tx_school_idx" ON "account_ledger_transactions" ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_tx_date_idx" ON "account_ledger_transactions" ("transaction_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_tx_bank_acc_idx" ON "account_ledger_transactions" ("bank_account_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fee_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE restrict,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_groups_school_idx" ON "fee_groups" ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_groups_year_idx" ON "fee_groups" ("academic_year_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fee_group_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fee_group_id" uuid NOT NULL REFERENCES "fee_groups"("id") ON DELETE cascade,
	"fee_head_id" uuid NOT NULL REFERENCES "fee_heads"("id") ON DELETE restrict,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_group_heads_group_idx" ON "fee_group_heads" ("fee_group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_group_heads_head_idx" ON "fee_group_heads" ("fee_head_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fee_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"name" text NOT NULL,
	"code" varchar(20),
	"discount_type" text DEFAULT 'PERCENTAGE' NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"applies_to_fee_head_id" uuid REFERENCES "fee_heads"("id") ON DELETE set null,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fee_discounts_code_unique" UNIQUE("school_id", "code")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_discounts_school_idx" ON "fee_discounts" ("school_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fee_challans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"challan_number" text NOT NULL,
	"student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE restrict,
	"fee_invoice_id" uuid NOT NULL REFERENCES "fee_invoices"("id") ON DELETE restrict,
	"amount" numeric(12, 2) NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'GENERATED' NOT NULL,
	"cleared_at" timestamp with time zone,
	"reference_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_challans_number_unique" UNIQUE("school_id", "challan_number")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_challans_school_idx" ON "fee_challans" ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_challans_student_idx" ON "fee_challans" ("student_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fee_due_slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"batch_number" text NOT NULL,
	"class_id" uuid REFERENCES "classes"("id") ON DELETE set null,
	"academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE restrict,
	"slip_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'GENERATED' NOT NULL,
	"generated_by_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_due_slips_batch_unique" UNIQUE("school_id", "batch_number")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_due_slips_school_idx" ON "fee_due_slips" ("school_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fee_carry_forwards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"from_academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE restrict,
	"to_academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE restrict,
	"student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE restrict,
	"previous_due_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"carried_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'APPLIED' NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_by_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_carry_forwards_school_idx" ON "fee_carry_forwards" ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_carry_forwards_student_idx" ON "fee_carry_forwards" ("student_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fee_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE restrict,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"previous_data" text,
	"new_data" text,
	"reason" text NOT NULL,
	"performed_by_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_audit_logs_school_idx" ON "fee_audit_logs" ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_audit_logs_entity_idx" ON "fee_audit_logs" ("entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_audit_logs_date_idx" ON "fee_audit_logs" ("created_at");
