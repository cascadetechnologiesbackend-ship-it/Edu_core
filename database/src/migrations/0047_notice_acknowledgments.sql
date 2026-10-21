-- Migration 0047: Notice Acknowledgments System (Workflow OP7, AC-P14, AC-P20, surface_p8)
-- Domain: COMMUNICATION
-- Table: notice_acknowledgments, notices (alter: requires_acknowledgment)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notice_ack_source') THEN
    CREATE TYPE "notice_ack_source" AS ENUM (
      'FEED',
      'PORTAL'
    );
  END IF;
END $$;

-- 1. Alter notices table to add requires_acknowledgment flag
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notices' AND column_name = 'requires_acknowledgment'
  ) THEN
    ALTER TABLE "notices" ADD COLUMN "requires_acknowledgment" boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- 2. Notice Acknowledgments Table
CREATE TABLE IF NOT EXISTS "notice_acknowledgments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "notice_id" uuid NOT NULL REFERENCES "notices"("id") ON DELETE CASCADE,
  "parent_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source" "notice_ack_source" DEFAULT 'FEED' NOT NULL
);

-- Unique constraint: one acknowledgment per parent user per notice (sibling households acknowledge once OP7)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notice_ack_notice_parent_unique'
  ) THEN
    ALTER TABLE "notice_acknowledgments" 
    ADD CONSTRAINT "notice_ack_notice_parent_unique" UNIQUE ("notice_id", "parent_user_id");
  END IF;
END $$;

-- Indexes for performance & percentage aggregations
CREATE INDEX IF NOT EXISTS "notice_ack_notice_idx" ON "notice_acknowledgments" ("notice_id");
CREATE INDEX IF NOT EXISTS "notice_ack_school_idx" ON "notice_acknowledgments" ("school_id");
CREATE INDEX IF NOT EXISTS "notice_ack_parent_user_idx" ON "notice_acknowledgments" ("parent_user_id");

-- Tenant Row Level Security (RLS)
ALTER TABLE "notice_acknowledgments" ENABLE ROW LEVEL SECURITY;

-- Policies for notice_acknowledgments
DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "notice_acknowledgments";
  CREATE POLICY "tenant_select_policy" ON "notice_acknowledgments"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "notice_acknowledgments";
  CREATE POLICY "tenant_insert_policy" ON "notice_acknowledgments"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_update_policy" ON "notice_acknowledgments";
  CREATE POLICY "tenant_update_policy" ON "notice_acknowledgments"
    FOR UPDATE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_delete_policy" ON "notice_acknowledgments";
  CREATE POLICY "tenant_delete_policy" ON "notice_acknowledgments"
    FOR DELETE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;
