-- P0: Grant table permissions & enable tenant-scoped RLS on Question Bank & Paper tables

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['schoolmitra_app', 'authenticated', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE question_bank, question_paper_blueprints, question_papers, question_paper_items TO %I', app_role);
    END IF;
  END LOOP;
END $$;

ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_paper_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_paper_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_question_bank ON question_bank;
CREATE POLICY tenant_isolation_question_bank ON question_bank
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid)
  WITH CHECK (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_question_paper_blueprints ON question_paper_blueprints;
CREATE POLICY tenant_isolation_question_paper_blueprints ON question_paper_blueprints
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid)
  WITH CHECK (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_question_papers ON question_papers;
CREATE POLICY tenant_isolation_question_papers ON question_papers
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid)
  WITH CHECK (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_question_paper_items ON question_paper_items;
CREATE POLICY tenant_isolation_question_paper_items ON question_paper_items
  USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid)
  WITH CHECK (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);
