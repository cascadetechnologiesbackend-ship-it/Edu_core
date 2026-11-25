-- Migration: 0058_parent_notification_preferences.sql
-- Description: Parent Notification Preferences table with tenant RLS (Spec v1.0, AC-P17)

CREATE TABLE IF NOT EXISTS "parent_notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "parent_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tier_opt_outs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "quiet_hours_start" text DEFAULT '21:30' NOT NULL,
  "quiet_hours_end" text DEFAULT '07:00' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for parent notification preferences
CREATE INDEX IF NOT EXISTS "parent_notif_prefs_user_idx" ON "parent_notification_preferences" ("parent_user_id");
CREATE INDEX IF NOT EXISTS "parent_notif_prefs_school_idx" ON "parent_notification_preferences" ("school_id");

-- Tenant Row Level Security (RLS) for parent_notification_preferences
ALTER TABLE "parent_notification_preferences" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "parent_notification_preferences";
  CREATE POLICY "tenant_select_policy" ON "parent_notification_preferences"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "parent_notification_preferences";
  CREATE POLICY "tenant_insert_policy" ON "parent_notification_preferences"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_update_policy" ON "parent_notification_preferences";
  CREATE POLICY "tenant_update_policy" ON "parent_notification_preferences"
    FOR UPDATE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_delete_policy" ON "parent_notification_preferences";
  CREATE POLICY "tenant_delete_policy" ON "parent_notification_preferences"
    FOR DELETE USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;
