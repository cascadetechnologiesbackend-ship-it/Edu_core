-- Migration 0034: Fix RLS Policies for Pooled Connection Role (S7-T1)
-- Allows standard connection-pooled queries to access tenant data when app.current_school_id
-- is either unset (using application-level WHERE school_id) or set (enforcing strict tenant isolation).

DO $$ 
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'classes',
    'students',
    'student_attendance',
    'fee_invoices',
    'fee_payments',
    'payment_gateway_logs',
    'account_ledger_transactions',
    'consent_records',
    'rights_requests',
    'dpdp_grievances',
    'data_breach_log',
    'vendor_register'
  ];
BEGIN
  -- 1. users
  DROP POLICY IF EXISTS tenant_select_policy ON "users";
  DROP POLICY IF EXISTS tenant_insert_policy ON "users";
  DROP POLICY IF EXISTS tenant_update_policy ON "users";
  DROP POLICY IF EXISTS tenant_delete_policy ON "users";

  CREATE POLICY tenant_select_policy ON "users"
    FOR SELECT
    USING (
      current_setting('app.current_school_id', true) IS NULL
      OR current_setting('app.current_school_id', true) = ''
      OR (school_id)::text = current_setting('app.current_school_id', true)
      OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
      OR nullif(current_setting('app.current_role', true), '') = 'SYSTEM_AUTH'
      OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
    );

  CREATE POLICY tenant_insert_policy ON "users"
    FOR INSERT
    WITH CHECK (
      current_setting('app.current_school_id', true) IS NULL
      OR current_setting('app.current_school_id', true) = ''
      OR (school_id)::text = current_setting('app.current_school_id', true)
      OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    );

  CREATE POLICY tenant_update_policy ON "users"
    FOR UPDATE
    USING (
      current_setting('app.current_school_id', true) IS NULL
      OR current_setting('app.current_school_id', true) = ''
      OR (school_id)::text = current_setting('app.current_school_id', true)
      OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    )
    WITH CHECK (
      current_setting('app.current_school_id', true) IS NULL
      OR current_setting('app.current_school_id', true) = ''
      OR (school_id)::text = current_setting('app.current_school_id', true)
      OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    );

  CREATE POLICY tenant_delete_policy ON "users"
    FOR DELETE
    USING (
      current_setting('app.current_school_id', true) IS NULL
      OR current_setting('app.current_school_id', true) = ''
      OR (school_id)::text = current_setting('app.current_school_id', true)
      OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    );

  -- 2. Remaining 12 tenant tables
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_select_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_insert_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_update_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_delete_policy ON %I;', tbl);

    EXECUTE format('
      CREATE POLICY tenant_select_policy ON %I
        FOR SELECT
        USING (
          current_setting(''app.current_school_id'', true) IS NULL
          OR current_setting(''app.current_school_id'', true) = ''''
          OR (school_id)::text = current_setting(''app.current_school_id'', true)
          OR nullif(current_setting(''app.current_role'', true), '''') = ''PLATFORM_ADMIN''
        );
    ', tbl);

    EXECUTE format('
      CREATE POLICY tenant_insert_policy ON %I
        FOR INSERT
        WITH CHECK (
          current_setting(''app.current_school_id'', true) IS NULL
          OR current_setting(''app.current_school_id'', true) = ''''
          OR (school_id)::text = current_setting(''app.current_school_id'', true)
        );
    ', tbl);

    EXECUTE format('
      CREATE POLICY tenant_update_policy ON %I
        FOR UPDATE
        USING (
          current_setting(''app.current_school_id'', true) IS NULL
          OR current_setting(''app.current_school_id'', true) = ''''
          OR (school_id)::text = current_setting(''app.current_school_id'', true)
        )
        WITH CHECK (
          current_setting(''app.current_school_id'', true) IS NULL
          OR current_setting(''app.current_school_id'', true) = ''''
          OR (school_id)::text = current_setting(''app.current_school_id'', true)
        );
    ', tbl);

    EXECUTE format('
      CREATE POLICY tenant_delete_policy ON %I
        FOR DELETE
        USING (
          current_setting(''app.current_school_id'', true) IS NULL
          OR current_setting(''app.current_school_id'', true) = ''''
          OR (school_id)::text = current_setting(''app.current_school_id'', true)
        );
    ', tbl);
  END LOOP;
END $$;
