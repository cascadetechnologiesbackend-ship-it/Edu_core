-- Migration: 0052_parent_feed_cards.sql
-- Description: Parent Feed Cards table with tenant RLS for event-driven parent PWA (Spec v1.0, AC-P1)

CREATE TABLE IF NOT EXISTS "parent_feed_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "card_type" text NOT NULL,
  "tier" text NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "title" jsonb NOT NULL,
  "summary" jsonb NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "activated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "dismissed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for parent feed cards
CREATE INDEX IF NOT EXISTS "parent_feed_cards_student_idx" ON "parent_feed_cards" ("student_id");
CREATE INDEX IF NOT EXISTS "parent_feed_cards_school_idx" ON "parent_feed_cards" ("school_id");
CREATE INDEX IF NOT EXISTS "parent_feed_cards_student_type_idx" ON "parent_feed_cards" ("student_id", "card_type");
CREATE INDEX IF NOT EXISTS "parent_feed_cards_expires_idx" ON "parent_feed_cards" ("expires_at");

-- Tenant Row Level Security (RLS) for parent_feed_cards
ALTER TABLE "parent_feed_cards" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "parent_feed_cards";
  CREATE POLICY "tenant_select_policy" ON "parent_feed_cards"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "parent_feed_cards";
  CREATE POLICY "tenant_insert_policy" ON "parent_feed_cards"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_update_policy" ON "parent_feed_cards";
  CREATE POLICY "tenant_update_policy" ON "parent_feed_cards"
    FOR UPDATE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_delete_policy" ON "parent_feed_cards";
  CREATE POLICY "tenant_delete_policy" ON "parent_feed_cards"
    FOR DELETE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;
