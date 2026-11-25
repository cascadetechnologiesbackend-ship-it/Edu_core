-- ============================================================
-- Migration 0063: Academic Workflows & Document Templates
-- Additive only. Never modifies existing tables.
-- ============================================================

-- 1. Class Teacher Assignments
CREATE TABLE IF NOT EXISTS "class_teacher_assignments" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id"        UUID NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "academic_year_id" UUID NOT NULL REFERENCES "academic_years"("id") ON DELETE CASCADE,
  "class_id"         UUID NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
  "section_id"       UUID NOT NULL REFERENCES "sections"("id") ON DELETE CASCADE,
  "staff_id"         UUID NOT NULL REFERENCES "staff"("id") ON DELETE CASCADE,
  "is_primary"       BOOLEAN NOT NULL DEFAULT true,
  "active"           BOOLEAN NOT NULL DEFAULT true,
  "start_date"       DATE NOT NULL DEFAULT CURRENT_DATE,
  "end_date"         DATE,
  "assigned_by"      UUID REFERENCES "users"("id"),
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_cta_school_year" ON "class_teacher_assignments" ("school_id", "academic_year_id");
CREATE INDEX IF NOT EXISTS "idx_cta_staff" ON "class_teacher_assignments" ("staff_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_cta_unique_primary_active"
  ON "class_teacher_assignments" ("school_id", "academic_year_id", "class_id", "section_id")
  WHERE "is_primary" = true AND "active" = true;

-- 2. ID Card Templates
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

-- 3. Admission Form Templates
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
ALTER TABLE "class_teacher_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_teacher_assignments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "id_card_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "id_card_templates" FORCE ROW LEVEL SECURITY;
ALTER TABLE "admission_form_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admission_form_templates" FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['class_teacher_assignments', 'id_card_templates', 'admission_form_templates'] LOOP
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
