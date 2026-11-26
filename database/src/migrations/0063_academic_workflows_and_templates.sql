-- ============================================================
-- Migration 0063: Academic Workflows & Document Templates
-- Additive only. Never modifies existing tables.
-- Note: class_teacher_assignments is already created in 0054_dual_role_teacher_assignments.sql.
-- ============================================================

-- 1. ID Card Templates
CREATE TABLE IF NOT EXISTS "id_card_templates" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id"       UUID NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "target_type"     TEXT NOT NULL CHECK ("target_type" IN ('STUDENT', 'STAFF')),
  "name"            TEXT NOT NULL,
  "layout_config"   JSONB NOT NULL DEFAULT '{}',
  "is_default"      BOOLEAN NOT NULL DEFAULT false,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_ict_school" ON "id_card_templates" ("school_id");

-- 2. Admission Form Templates
CREATE TABLE IF NOT EXISTS "admission_form_templates" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id"        UUID NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "name"             TEXT NOT NULL,
  "sections_config"  JSONB NOT NULL DEFAULT '{}',
  "declaration_text" TEXT,
  "is_default"       BOOLEAN NOT NULL DEFAULT false,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_aft_school" ON "admission_form_templates" ("school_id");

-- ── Row-Level Security (fail-closed, matches 0059) ────────────────────────────
ALTER TABLE "id_card_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "id_card_templates" FORCE ROW LEVEL SECURITY;
ALTER TABLE "admission_form_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admission_form_templates" FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['id_card_templates', 'admission_form_templates'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = t || '_tenant_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I USING (school_id = current_setting(''app.current_school_id'', true)::uuid)',
        t || '_tenant_isolation', t
      );
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO schoolmitra_app', t);
    END IF;
  END LOOP;
END $$;
