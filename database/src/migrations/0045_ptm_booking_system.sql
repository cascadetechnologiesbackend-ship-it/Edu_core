-- Migration 0045: PTM Booking System & Slot Inventory (Workflow OP4 & AC-P17)
-- Domain: COMMUNICATION
-- Tables: ptm_events, ptm_slots, ptm_bookings

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ptm_slot_status') THEN
    CREATE TYPE "ptm_slot_status" AS ENUM ('FREE', 'BOOKED', 'BLOCKED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ptm_booking_status') THEN
    CREATE TYPE "ptm_booking_status" AS ENUM ('BOOKED', 'HELD', 'CANCELLED');
  END IF;
END $$;

-- 1. PTM Events Table (Parent-Teacher Meeting Event with Class & Teacher Scope, and Real Venue resolving RC-C2)
CREATE TABLE IF NOT EXISTS "ptm_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "class_id" uuid REFERENCES "classes"("id") ON DELETE SET NULL,
  "teacher_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "venue" text,
  "booking_opens_at" timestamp with time zone NOT NULL,
  "booking_closes_at" timestamp with time zone NOT NULL,
  "slot_minutes" integer DEFAULT 10 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. PTM Slots Inventory (10-minute slot units with optimistic lock version counter AC-P17)
CREATE TABLE IF NOT EXISTS "ptm_slots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "ptm_event_id" uuid NOT NULL REFERENCES "ptm_events"("id") ON DELETE CASCADE,
  "teacher_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "status" "ptm_slot_status" DEFAULT 'FREE' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. PTM Bookings Table
CREATE TABLE IF NOT EXISTS "ptm_bookings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  "ptm_event_id" uuid NOT NULL REFERENCES "ptm_events"("id") ON DELETE CASCADE,
  "slot_id" uuid NOT NULL REFERENCES "ptm_slots"("id") ON DELETE CASCADE,
  "parent_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
  "status" "ptm_booking_status" DEFAULT 'BOOKED' NOT NULL,
  "booked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "cancelled_at" timestamp with time zone,
  "teacher_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ptm_events_event_teacher_idx" ON "ptm_events" ("event_id", "teacher_user_id");
CREATE INDEX IF NOT EXISTS "ptm_events_school_opens_idx" ON "ptm_events" ("school_id", "booking_opens_at");

CREATE INDEX IF NOT EXISTS "ptm_slots_event_start_idx" ON "ptm_slots" ("ptm_event_id", "start_at");
CREATE INDEX IF NOT EXISTS "ptm_slots_teacher_start_idx" ON "ptm_slots" ("teacher_user_id", "start_at");

CREATE INDEX IF NOT EXISTS "ptm_bookings_parent_event_idx" ON "ptm_bookings" ("parent_user_id", "ptm_event_id");
CREATE INDEX IF NOT EXISTS "ptm_bookings_slot_idx" ON "ptm_bookings" ("slot_id");
CREATE INDEX IF NOT EXISTS "ptm_bookings_student_event_idx" ON "ptm_bookings" ("student_id", "ptm_event_id");

-- Partial Unique Constraints for Concurrency & Invariant Enforcement:
-- 1. One active booking per parent per PTM event
CREATE UNIQUE INDEX IF NOT EXISTS "ptm_bookings_parent_event_active_uidx" 
  ON "ptm_bookings" ("parent_user_id", "ptm_event_id") 
  WHERE "status" = 'BOOKED';

-- 2. One active booking per slot
CREATE UNIQUE INDEX IF NOT EXISTS "ptm_bookings_slot_active_uidx" 
  ON "ptm_bookings" ("slot_id") 
  WHERE "status" = 'BOOKED';

-- 3. One active booking per student per PTM event
CREATE UNIQUE INDEX IF NOT EXISTS "ptm_bookings_student_event_active_uidx" 
  ON "ptm_bookings" ("student_id", "ptm_event_id") 
  WHERE "status" = 'BOOKED';

-- Tenant Row Level Security (RLS)
ALTER TABLE "ptm_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ptm_slots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ptm_bookings" ENABLE ROW LEVEL SECURITY;

-- Policies for ptm_events
DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "ptm_events";
  CREATE POLICY "tenant_select_policy" ON "ptm_events"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "ptm_events";
  CREATE POLICY "tenant_insert_policy" ON "ptm_events"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_update_policy" ON "ptm_events";
  CREATE POLICY "tenant_update_policy" ON "ptm_events"
    FOR UPDATE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_delete_policy" ON "ptm_events";
  CREATE POLICY "tenant_delete_policy" ON "ptm_events"
    FOR DELETE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

-- Policies for ptm_slots
DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "ptm_slots";
  CREATE POLICY "tenant_select_policy" ON "ptm_slots"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "ptm_slots";
  CREATE POLICY "tenant_insert_policy" ON "ptm_slots"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_update_policy" ON "ptm_slots";
  CREATE POLICY "tenant_update_policy" ON "ptm_slots"
    FOR UPDATE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_delete_policy" ON "ptm_slots";
  CREATE POLICY "tenant_delete_policy" ON "ptm_slots"
    FOR DELETE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

-- Policies for ptm_bookings
DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "ptm_bookings";
  CREATE POLICY "tenant_select_policy" ON "ptm_bookings"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "ptm_bookings";
  CREATE POLICY "tenant_insert_policy" ON "ptm_bookings"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_update_policy" ON "ptm_bookings";
  CREATE POLICY "tenant_update_policy" ON "ptm_bookings"
    FOR UPDATE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_delete_policy" ON "ptm_bookings";
  CREATE POLICY "tenant_delete_policy" ON "ptm_bookings"
    FOR DELETE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;
