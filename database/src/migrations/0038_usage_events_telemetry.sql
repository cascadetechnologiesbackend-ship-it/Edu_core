-- Migration 0038: First-Party Telemetry & Interaction Analytics (Sprint S10 Layer 4)
-- Creates usage_events table for element-level heat map analytics.
-- Invariants:
-- 1. Strictly zero student PII: captures screen route, element id, element label, action, actor role, user id.
-- 2. Fully tenant-isolated with foreign key cascade to schools.
-- 3. High-efficiency indexing for screen analytics and 90-day retention purging.

CREATE TABLE IF NOT EXISTS "usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "screen" text NOT NULL,
  "element_id" text NOT NULL,
  "element_label" text NOT NULL,
  "action" text NOT NULL,
  "role" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_events_school_screen_created_idx" 
  ON "usage_events" ("school_id", "screen", "created_at");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_events_created_at_idx" 
  ON "usage_events" ("created_at");
