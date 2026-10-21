-- Migration 0048: Bus Boarding Events & Stop Change Requests (Workflow OP9, OP5, AC-P14, AC-P19)
-- Domain: TRANSPORT
-- Tables: bus_boarding_events, stop_change_requests

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bus_boarding_direction') THEN
    CREATE TYPE "bus_boarding_direction" AS ENUM (
      'BOARDING',
      'ALIGHTING'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stop_change_request_status') THEN
    CREATE TYPE "stop_change_request_status" AS ENUM (
      'PENDING',
      'APPROVED',
      'REJECTED'
    );
  END IF;
END $$;

-- 1. Bus Boarding Events Table (Append-only, AC-P19)
CREATE TABLE IF NOT EXISTS "bus_boarding_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "route_id" uuid NOT NULL REFERENCES "routes"("id") ON DELETE CASCADE,
  "direction" "bus_boarding_direction" NOT NULL,
  "scanned_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "vehicle_id" uuid REFERENCES "vehicles"("id") ON DELETE SET NULL,
  "scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "gps_lat" numeric(10, 7),
  "gps_lng" numeric(10, 7),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for performance & query patterns
CREATE INDEX IF NOT EXISTS "bus_boarding_student_scanned_idx" ON "bus_boarding_events" ("student_id", "scanned_at" DESC);
CREATE INDEX IF NOT EXISTS "bus_boarding_route_scanned_idx" ON "bus_boarding_events" ("route_id", "scanned_at" DESC);
CREATE INDEX IF NOT EXISTS "bus_boarding_school_idx" ON "bus_boarding_events" ("school_id");

-- Tenant Row Level Security (RLS) for bus_boarding_events
ALTER TABLE "bus_boarding_events" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "bus_boarding_events";
  CREATE POLICY "tenant_select_policy" ON "bus_boarding_events"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "bus_boarding_events";
  CREATE POLICY "tenant_insert_policy" ON "bus_boarding_events"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

-- Notice: Append-only table has NO update policy, strictly enforcing AC-P19
DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_delete_policy" ON "bus_boarding_events";
  CREATE POLICY "tenant_delete_policy" ON "bus_boarding_events"
    FOR DELETE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

-- 2. Stop Change Requests Table (Workflow OP5)
CREATE TABLE IF NOT EXISTS "stop_change_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "parent_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "bus_pass_id" uuid NOT NULL REFERENCES "student_bus_passes"("id") ON DELETE CASCADE,
  "requested_stop_id" uuid NOT NULL REFERENCES "route_stops"("id") ON DELETE RESTRICT,
  "reason" text NOT NULL,
  "status" "stop_change_request_status" DEFAULT 'PENDING' NOT NULL,
  "effective_date" timestamp with time zone,
  "decided_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "decision_note" text,
  "decided_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for performance & approval queue
CREATE INDEX IF NOT EXISTS "stop_change_school_status_idx" ON "stop_change_requests" ("school_id", "status");
CREATE INDEX IF NOT EXISTS "stop_change_parent_idx" ON "stop_change_requests" ("parent_user_id");
CREATE INDEX IF NOT EXISTS "stop_change_student_idx" ON "stop_change_requests" ("student_id");

-- Tenant Row Level Security (RLS) for stop_change_requests
ALTER TABLE "stop_change_requests" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "stop_change_requests";
  CREATE POLICY "tenant_select_policy" ON "stop_change_requests"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "stop_change_requests";
  CREATE POLICY "tenant_insert_policy" ON "stop_change_requests"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_update_policy" ON "stop_change_requests";
  CREATE POLICY "tenant_update_policy" ON "stop_change_requests"
    FOR UPDATE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_delete_policy" ON "stop_change_requests";
  CREATE POLICY "tenant_delete_policy" ON "stop_change_requests"
    FOR DELETE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;
