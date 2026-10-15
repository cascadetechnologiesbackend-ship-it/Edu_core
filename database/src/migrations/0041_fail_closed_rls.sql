-- Migration 0041: Close Fail-Open RLS Predicates & Enforce Fail-Closed Multi-Tenancy (SEC-RLS-001)
-- 
-- Supersedes Migration 0034's connection-pool fix by eliminating the fail-open
-- 'app.current_school_id IS NULL OR = empty' bypass arms on all 13 tenant tables.
--
-- Rules:
-- 1. Unset, NULL, or empty app.current_school_id strictly denies ordinary tenant access.
-- 2. Ordinary tenant SELECT, INSERT, UPDATE, DELETE require school_id = current_setting('app.current_school_id', true)::uuid.
-- 3. SYSTEM_AUTH and PLATFORM_ADMIN read arms are strictly limited to FOR SELECT.
-- 4. FOR INSERT, UPDATE, and DELETE strictly require matching tenant context.

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
  -- ─── 1. users ──────────────────────────────────────────────────────────────
  DROP POLICY IF EXISTS tenant_isolation_policy ON "users";
  DROP POLICY IF EXISTS tenant_select_policy ON "users";
  DROP POLICY IF EXISTS tenant_insert_policy ON "users";
  DROP POLICY IF EXISTS tenant_update_policy ON "users";
  DROP POLICY IF EXISTS tenant_delete_policy ON "users";

  CREATE POLICY tenant_select_policy ON "users"
    FOR SELECT
    USING (
      (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
      OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
      OR nullif(current_setting('app.current_role', true), '') = 'SYSTEM_AUTH'
      OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
    );

  CREATE POLICY tenant_insert_policy ON "users"
    FOR INSERT
    WITH CHECK (
      (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
      OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    );

  CREATE POLICY tenant_update_policy ON "users"
    FOR UPDATE
    USING (
      (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
      OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    )
    WITH CHECK (
      (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
      OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    );

  CREATE POLICY tenant_delete_policy ON "users"
    FOR DELETE
    USING (
      (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
      OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    );

  ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

  -- ─── 2. Remaining 12 Tenant Tables ──────────────────────────────────────────
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_select_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_insert_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_update_policy ON %I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_delete_policy ON %I;', tbl);

    -- SELECT: Strict tenant match OR global read for PLATFORM_ADMIN
    EXECUTE format('
      CREATE POLICY tenant_select_policy ON %I
        FOR SELECT
        USING (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
          OR nullif(current_setting(''app.current_role'', true), '''') = ''PLATFORM_ADMIN''
        );
    ', tbl);

    -- INSERT: Strict tenant match required (no PLATFORM_ADMIN write bypass)
    EXECUTE format('
      CREATE POLICY tenant_insert_policy ON %I
        FOR INSERT
        WITH CHECK (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        );
    ', tbl);

    -- UPDATE: Strict tenant match required
    EXECUTE format('
      CREATE POLICY tenant_update_policy ON %I
        FOR UPDATE
        USING (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        )
        WITH CHECK (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        );
    ', tbl);

    -- DELETE: Strict tenant match required
    EXECUTE format('
      CREATE POLICY tenant_delete_policy ON %I
        FOR DELETE
        USING (
          (school_id)::text = nullif(current_setting(''app.current_school_id'', true), '''')
        );
    ', tbl);

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;
--> statement-breakpoint
