-- Migration 0044: Student Leave Requests (Workflow OP3 & Phase P10)
-- Schema: student_leave_requests table, indexes, strict RLS policies, and app role permissions

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_leave_type') THEN
    CREATE TYPE "student_leave_type" AS ENUM ('CASUAL', 'SICK', 'EMERGENCY', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_leave_status') THEN
    CREATE TYPE "student_leave_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED_BY_PARENT');
  END IF;
END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_leave_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "requested_by_parent_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "leave_type" "student_leave_type" NOT NULL,
  "start_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone NOT NULL,
  "reason" text NOT NULL,
  "attachment_s3_key" text,
  "status" "student_leave_status" NOT NULL DEFAULT 'PENDING',
  "decided_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "decision_note" text,
  "decided_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_leave_requests_student_status_idx"
  ON "student_leave_requests" ("student_id", "status");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_leave_requests_school_status_created_idx"
  ON "student_leave_requests" ("school_id", "status", "created_at");

--> statement-breakpoint
-- Strict Tenant Isolation RLS Policies
DO $$
DECLARE
  tbl TEXT := 'student_leave_requests';
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
  EXECUTE format('DROP POLICY IF EXISTS tenant_select_policy ON %I;', tbl);
  EXECUTE format('DROP POLICY IF EXISTS tenant_insert_policy ON %I;', tbl);
  EXECUTE format('DROP POLICY IF EXISTS tenant_update_policy ON %I;', tbl);
  EXECUTE format('DROP POLICY IF EXISTS tenant_delete_policy ON %I;', tbl);

  -- SELECT: Strict tenant match OR global read for PLATFORM_ADMIN
  EXECUTE format('
    CREATE POLICY tenant_select_policy ON %I
      FOR SELECT
      USING (
        (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        OR nullif(current_setting(''app.current_role'', true), '''') = ''PLATFORM_ADMIN''
      );
  ', tbl);

  -- INSERT: Strict tenant match required
  EXECUTE format('
    CREATE POLICY tenant_insert_policy ON %I
      FOR INSERT
      WITH CHECK (
        (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
      );
  ', tbl);

  -- UPDATE: Strict tenant match required
  EXECUTE format('
    CREATE POLICY tenant_update_policy ON %I
      FOR UPDATE
      USING (
        (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
      )
      WITH CHECK (
        (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
      );
  ', tbl);

  -- DELETE: Strict tenant match required
  EXECUTE format('
    CREATE POLICY tenant_delete_policy ON %I
      FOR DELETE
      USING (
        (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
      );
  ', tbl);

  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
END $$;

--> statement-breakpoint
-- Grant access to application role if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "student_leave_requests" TO schoolmitra_app;
  END IF;
END $$;
