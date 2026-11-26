-- Migration: 0064_strict_tenant_hmac_and_rls.sql
-- Phase A (P0 Critical Trust & Security):
-- Enforce ENABLE + FORCE ROW LEVEL SECURITY and strict WITH CHECK policies
-- on import_export_jobs, class_teacher_assignments, id_card_templates, and admission_form_templates.

-- 1. import_export_jobs
ALTER TABLE import_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_export_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS import_export_jobs_tenant_isolation ON import_export_jobs;
CREATE POLICY import_export_jobs_tenant_isolation ON import_export_jobs
  FOR ALL
  USING (school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (school_id = current_setting('app.current_school_id', true)::uuid);

-- 2. class_teacher_assignments
ALTER TABLE class_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teacher_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_teacher_assignments_tenant_isolation ON class_teacher_assignments;
CREATE POLICY class_teacher_assignments_tenant_isolation ON class_teacher_assignments
  FOR ALL
  USING (school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (school_id = current_setting('app.current_school_id', true)::uuid);

-- 3. id_card_templates
ALTER TABLE id_card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_card_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS id_card_templates_tenant_isolation ON id_card_templates;
CREATE POLICY id_card_templates_tenant_isolation ON id_card_templates
  FOR ALL
  USING (school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (school_id = current_setting('app.current_school_id', true)::uuid);

-- 4. admission_form_templates
ALTER TABLE admission_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_form_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admission_form_templates_tenant_isolation ON admission_form_templates;
CREATE POLICY admission_form_templates_tenant_isolation ON admission_form_templates
  FOR ALL
  USING (school_id = current_setting('app.current_school_id', true)::uuid)
  WITH CHECK (school_id = current_setting('app.current_school_id', true)::uuid);

-- 5. Grant CRUD privileges to schoolmitra_app role if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
      import_export_jobs,
      class_teacher_assignments,
      id_card_templates,
      admission_form_templates
    TO schoolmitra_app;
  END IF;
END $$;
