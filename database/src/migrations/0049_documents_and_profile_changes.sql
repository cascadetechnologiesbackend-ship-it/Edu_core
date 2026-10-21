-- Migration: 0049_documents_and_profile_changes.sql
-- Description: Workflow tables for Student Document Requests (OP6) and Profile Change Requests (OP10) with tenant RLS

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE "student_document_request_status" AS ENUM (
    'REQUESTED',
    'SUBMITTED',
    'VERIFIED',
    'REJECTED',
    'EXPIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "profile_change_request_status" AS ENUM (
    'PENDING',
    'APPLIED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Student Document Requests Table (Workflow OP6, AC-P24)
CREATE TABLE IF NOT EXISTS "student_document_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "document_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "requested_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "due_at" timestamp with time zone,
  "status" "student_document_request_status" DEFAULT 'REQUESTED' NOT NULL,
  "submitted_s3_key" text,
  "original_filename" text,
  "mime_type" text,
  "file_size_bytes" bigint,
  "verification_note" text,
  "verified_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "verified_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for document requests
CREATE INDEX IF NOT EXISTS "doc_req_student_status_idx" ON "student_document_requests" ("student_id", "status");
CREATE INDEX IF NOT EXISTS "doc_req_school_status_due_idx" ON "student_document_requests" ("school_id", "status", "due_at");
CREATE INDEX IF NOT EXISTS "doc_req_expires_idx" ON "student_document_requests" ("expires_at");

-- Tenant Row Level Security (RLS) for student_document_requests
ALTER TABLE "student_document_requests" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "student_document_requests";
  CREATE POLICY "tenant_select_policy" ON "student_document_requests"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "student_document_requests";
  CREATE POLICY "tenant_insert_policy" ON "student_document_requests"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_update_policy" ON "student_document_requests";
  CREATE POLICY "tenant_update_policy" ON "student_document_requests"
    FOR UPDATE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_delete_policy" ON "student_document_requests";
  CREATE POLICY "tenant_delete_policy" ON "student_document_requests"
    FOR DELETE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

-- 3. Profile Change Requests Table (Workflow OP10)
CREATE TABLE IF NOT EXISTS "profile_change_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "parent_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "field" text NOT NULL,
  "old_value_encrypted" text,
  "new_value_encrypted" text NOT NULL,
  "status" "profile_change_request_status" DEFAULT 'PENDING' NOT NULL,
  "verified_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "verification_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_at" timestamp with time zone
);

-- Indexes for profile change requests
CREATE INDEX IF NOT EXISTS "profile_change_student_status_idx" ON "profile_change_requests" ("student_id", "status");
CREATE INDEX IF NOT EXISTS "profile_change_school_status_idx" ON "profile_change_requests" ("school_id", "status");
CREATE INDEX IF NOT EXISTS "profile_change_parent_idx" ON "profile_change_requests" ("parent_user_id");

-- Tenant Row Level Security (RLS) for profile_change_requests
ALTER TABLE "profile_change_requests" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "profile_change_requests";
  CREATE POLICY "tenant_select_policy" ON "profile_change_requests"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "profile_change_requests";
  CREATE POLICY "tenant_insert_policy" ON "profile_change_requests"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_update_policy" ON "profile_change_requests";
  CREATE POLICY "tenant_update_policy" ON "profile_change_requests"
    FOR UPDATE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_delete_policy" ON "profile_change_requests";
  CREATE POLICY "tenant_delete_policy" ON "profile_change_requests"
    FOR DELETE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;
