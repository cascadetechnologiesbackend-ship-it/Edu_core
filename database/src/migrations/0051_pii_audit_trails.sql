-- Migration: 0051_pii_audit_trails.sql
-- Description: PII audit trail table for DPDP Act 2023 content-scanning enforcement.
--   Append-only. Stores decision hashes, never raw or masked PII text.
--   RLS tenant-scoped by school_id following the pattern from 0050_teacher_feed_cards.sql

CREATE TABLE IF NOT EXISTS "pii_audit_trails" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE RESTRICT,
  -- Which table triggered the scan (e.g. 'notices', 'parent_teacher_messages')
  "source_table" text NOT NULL,
  -- UUID of the record that was scanned (nullable: event may precede insert)
  "source_id" uuid,
  -- Human-readable surface identifier (e.g. 'admin.notice.compose', 'teacher.message.send')
  "surface" text NOT NULL,
  -- JSON array of detected PII type strings (e.g. ["AADHAAR","MOBILE"])
  "detected_types" jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Risk classification: CRITICAL | HIGH | MEDIUM | LOW
  "risk_level" text NOT NULL,
  -- Number of individual PII matches in the content
  "match_count" integer NOT NULL,
  -- Enforcement outcome: BLOCKED | MASKED | CONFIRMED_SEND | LOGGED_ONLY
  "decision" text NOT NULL,
  -- Redaction mode applied when decision = MASKED: MASK_PARTIAL | REDACT_FULL
  "redaction_mode" text,
  -- Actor who authored the content (from session, never from client input)
  "actor_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  -- SHA-256 hash of the original raw input for incident forensics
  -- NEVER store the raw text, masked text, or any PII-containing content here
  "content_hash" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
  -- NO updated_at — this table is append-only (BR7)
  -- NO deleted_at — rows must never be deleted (DPDP forensic audit requirement)
);

-- Indexes
CREATE INDEX IF NOT EXISTS "pii_audit_trails_school_idx" ON "pii_audit_trails" ("school_id");
CREATE INDEX IF NOT EXISTS "pii_audit_trails_actor_idx" ON "pii_audit_trails" ("actor_user_id");
CREATE INDEX IF NOT EXISTS "pii_audit_trails_surface_idx" ON "pii_audit_trails" ("surface");
CREATE INDEX IF NOT EXISTS "pii_audit_trails_risk_idx" ON "pii_audit_trails" ("risk_level");
CREATE INDEX IF NOT EXISTS "pii_audit_trails_decision_idx" ON "pii_audit_trails" ("decision");
CREATE INDEX IF NOT EXISTS "pii_audit_trails_created_idx" ON "pii_audit_trails" ("created_at");
-- Compound index for DPDP dashboard queries (tenant + date range, newest first)
CREATE INDEX IF NOT EXISTS "pii_audit_trails_school_created_idx" ON "pii_audit_trails" ("school_id", "created_at" DESC);

-- Tenant Row Level Security (RLS) — follows pattern from migration 0050
ALTER TABLE "pii_audit_trails" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_select_policy" ON "pii_audit_trails";
  CREATE POLICY "tenant_select_policy" ON "pii_audit_trails"
    FOR SELECT USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_insert_policy" ON "pii_audit_trails";
  CREATE POLICY "tenant_insert_policy" ON "pii_audit_trails"
    FOR INSERT WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
END $$;

-- NO UPDATE policy (append-only — BR7)
-- NO DELETE policy (append-only — DPDP forensic requirement)
