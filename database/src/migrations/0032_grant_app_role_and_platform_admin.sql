-- Migration 0032: Grant Application Role to Migration Owner & Add PLATFORM_ADMIN Read Arm
-- 1. Grant `schoolmitra_app` role to the CURRENT_USER (Render owner / migration runner)
--    so that `SET ROLE schoolmitra_app;` is legally permitted on application connections.
-- 2. Add an explicit read-only arm to the 13 RLS table policies:
--    `OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'`
--    in USING (excluded from WITH CHECK). This allows platform super admins to read
--    cross-tenant aggregates without allowing cross-tenant writes.

-- ─── 1. Grant Membership to Current Migration User ───────────────────────────
DO $$
BEGIN
  EXECUTE format('GRANT schoolmitra_app TO %I', CURRENT_USER);
END;
$$;

-- ─── 2. Update 13 RLS Policies with PLATFORM_ADMIN Read Arm ──────────────────

-- 1. users
DROP POLICY IF EXISTS tenant_isolation_policy ON "users";
CREATE POLICY tenant_isolation_policy ON "users"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR nullif(current_setting('app.current_role', true), '') = 'SYSTEM_AUTH'
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
  );
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

-- 2. students
DROP POLICY IF EXISTS tenant_isolation_policy ON "students";
CREATE POLICY tenant_isolation_policy ON "students"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "students" FORCE ROW LEVEL SECURITY;

-- 3. fee_invoices
DROP POLICY IF EXISTS tenant_isolation_policy ON "fee_invoices";
CREATE POLICY tenant_isolation_policy ON "fee_invoices"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "fee_invoices" FORCE ROW LEVEL SECURITY;

-- 4. fee_payments
DROP POLICY IF EXISTS tenant_isolation_policy ON "fee_payments";
CREATE POLICY tenant_isolation_policy ON "fee_payments"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "fee_payments" FORCE ROW LEVEL SECURITY;

-- 5. classes
DROP POLICY IF EXISTS tenant_isolation_policy ON "classes";
CREATE POLICY tenant_isolation_policy ON "classes"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "classes" FORCE ROW LEVEL SECURITY;

-- 6. student_attendance
DROP POLICY IF EXISTS tenant_isolation_policy ON "student_attendance";
CREATE POLICY tenant_isolation_policy ON "student_attendance"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "student_attendance" FORCE ROW LEVEL SECURITY;

-- 7. payment_gateway_logs
DROP POLICY IF EXISTS tenant_isolation_policy ON "payment_gateway_logs";
CREATE POLICY tenant_isolation_policy ON "payment_gateway_logs"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "payment_gateway_logs" FORCE ROW LEVEL SECURITY;

-- 8. account_ledger_transactions
DROP POLICY IF EXISTS tenant_isolation_policy ON "account_ledger_transactions";
CREATE POLICY tenant_isolation_policy ON "account_ledger_transactions"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "account_ledger_transactions" FORCE ROW LEVEL SECURITY;

-- 9. consent_records
DROP POLICY IF EXISTS tenant_isolation_policy ON "consent_records";
CREATE POLICY tenant_isolation_policy ON "consent_records"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "consent_records" FORCE ROW LEVEL SECURITY;

-- 10. rights_requests
DROP POLICY IF EXISTS tenant_isolation_policy ON "rights_requests";
CREATE POLICY tenant_isolation_policy ON "rights_requests"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "rights_requests" FORCE ROW LEVEL SECURITY;

-- 11. dpdp_grievances
DROP POLICY IF EXISTS tenant_isolation_policy ON "dpdp_grievances";
CREATE POLICY tenant_isolation_policy ON "dpdp_grievances"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "dpdp_grievances" FORCE ROW LEVEL SECURITY;

-- 12. data_breach_log
DROP POLICY IF EXISTS tenant_isolation_policy ON "data_breach_log";
CREATE POLICY tenant_isolation_policy ON "data_breach_log"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "data_breach_log" FORCE ROW LEVEL SECURITY;

-- 13. vendor_register
DROP POLICY IF EXISTS tenant_isolation_policy ON "vendor_register";
CREATE POLICY tenant_isolation_policy ON "vendor_register"
  FOR ALL
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );
ALTER TABLE "vendor_register" FORCE ROW LEVEL SECURITY;
