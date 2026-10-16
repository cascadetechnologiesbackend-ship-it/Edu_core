-- Migration 0042: Student Lifecycle Convergence & Durable Event Backbone (Sprint S13)
-- 1. Counter table for monotonic atomic sequence numbering (school_counters)
-- 2. Unique index guards on admission and application numbers
-- 3. Additive enum value 'admin_attestation' for DPDP consent method
-- 4. Additive search hash columns on student_family_members for zero-decryption sibling detection
-- 5. Durable outbox domain_events table with RLS and permissions

-- 1. school_counters table
CREATE TABLE IF NOT EXISTS "school_counters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "counter_key" text NOT NULL,
  "last_value" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "school_counters_school_key_unique" UNIQUE ("school_id", "counter_key")
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "school_counters_school_key_idx"
  ON "school_counters" ("school_id", "counter_key");

--> statement-breakpoint
-- 2. Unique index guards
CREATE UNIQUE INDEX IF NOT EXISTS "students_admission_number_unique"
  ON "students" ("school_id", "admission_number");

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admission_applications_number_unique"
  ON "admission_applications" ("school_id", "application_number");

--> statement-breakpoint
-- 3. Additive consent_method enum value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'consent_method' AND e.enumlabel = 'admin_attestation'
  ) THEN
    ALTER TYPE "consent_method" ADD VALUE 'admin_attestation';
  END IF;
END $$;

--> statement-breakpoint
-- 4. Additive search hash columns and indexes on student_family_members
ALTER TABLE "student_family_members"
  ADD COLUMN IF NOT EXISTS "mobile_search_hash" text,
  ADD COLUMN IF NOT EXISTS "email_search_hash" text;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_family_members_mobile_hash_idx"
  ON "student_family_members" ("school_id", "mobile_search_hash");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_family_members_email_hash_idx"
  ON "student_family_members" ("school_id", "email_search_hash");

--> statement-breakpoint
-- 5. domain_events outbox table
CREATE TABLE IF NOT EXISTS "domain_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_type" text NOT NULL,
  "aggregate_id" text NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "payload" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "retry_count" integer NOT NULL DEFAULT 0,
  "error" text,
  "occurred_on" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_events_school_status_idx"
  ON "domain_events" ("school_id", "status");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_events_status_created_idx"
  ON "domain_events" ("status", "created_at");

--> statement-breakpoint
-- 6. RLS Policies on school_counters and domain_events
DO $$
DECLARE
  tbl TEXT;
  new_tables TEXT[] := ARRAY['school_counters', 'domain_events'];
BEGIN
  FOREACH tbl IN ARRAY new_tables LOOP
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
  END LOOP;
END $$;

--> statement-breakpoint
-- 7. Grant access to application role if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "school_counters", "domain_events" TO schoolmitra_app;
  END IF;
END $$;
