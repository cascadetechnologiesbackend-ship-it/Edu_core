-- Migration 0046: Fee Queries System (Workflow OP2, AC-P18, surface_p8)
-- Domain: FINANCE_FEES
-- Table: fee_queries

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fee_query_category') THEN
    CREATE TYPE "fee_query_category" AS ENUM (
      'BREAKDOWN',
      'LATE_FEE',
      'WAIVER_REQUEST',
      'DOUBLE_PAYMENT',
      'OTHER'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fee_query_status') THEN
    CREATE TYPE "fee_query_status" AS ENUM (
      'OPEN',
      'ANSWERED',
      'RESOLVED',
      'ESCALATED'
    );
  END IF;
END $$;

-- 1. Fee Queries Table
CREATE TABLE IF NOT EXISTS "fee_queries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "invoice_id" uuid NOT NULL REFERENCES "fee_invoices"("id") ON DELETE CASCADE,
  "parent_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "category" "fee_query_category" NOT NULL,
  "message" text NOT NULL,
  "status" "fee_query_status" DEFAULT 'OPEN' NOT NULL,
  "answered_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "answer" text,
  "answered_at" timestamp with time zone,
  "escalated_at" timestamp with time zone,
  "escalated_to_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "fee_queries_invoice_idx" ON "fee_queries" ("invoice_id");
CREATE INDEX IF NOT EXISTS "fee_queries_school_status_created_idx" ON "fee_queries" ("school_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "fee_queries_parent_idx" ON "fee_queries" ("parent_user_id");
CREATE INDEX IF NOT EXISTS "fee_queries_student_idx" ON "fee_queries" ("student_id");

-- Tenant Row Level Security (RLS)
ALTER TABLE "fee_queries" ENABLE ROW LEVEL SECURITY;

-- Policies for fee_queries
DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "fee_queries";
  CREATE POLICY "tenant_select_policy" ON "fee_queries"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "fee_queries";
  CREATE POLICY "tenant_insert_policy" ON "fee_queries"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_update_policy" ON "fee_queries";
  CREATE POLICY "tenant_update_policy" ON "fee_queries"
    FOR UPDATE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_delete_policy" ON "fee_queries";
  CREATE POLICY "tenant_delete_policy" ON "fee_queries"
    FOR DELETE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;
