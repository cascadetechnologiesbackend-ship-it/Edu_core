-- Migration 0033: Split RLS Policies by SQL Command (S7-T0)
-- 1. Eliminate monolithic FOR ALL policies on all 13 tenant tables.
-- 2. Define per-command policies (FOR SELECT, FOR INSERT, FOR UPDATE, FOR DELETE).
-- 3. The PLATFORM_ADMIN and SYSTEM_AUTH read arms are placed exclusively in FOR SELECT.
-- 4. FOR INSERT, FOR UPDATE, and FOR DELETE strictly enforce tenant isolation (school_id match).
--    This structurally guarantees that read arms cannot authorize any INSERT, UPDATE, or DELETE.

-- ─── 1. users ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "users";
DROP POLICY IF EXISTS tenant_select_policy ON "users";
DROP POLICY IF EXISTS tenant_insert_policy ON "users";
DROP POLICY IF EXISTS tenant_update_policy ON "users";
DROP POLICY IF EXISTS tenant_delete_policy ON "users";

CREATE POLICY tenant_select_policy ON "users"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR nullif(current_setting('app.current_role', true), '') = 'SYSTEM_AUTH'
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "users"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
  );

CREATE POLICY tenant_update_policy ON "users"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
  );

CREATE POLICY tenant_delete_policy ON "users"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
  );

ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

-- ─── 2. students ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "students";
DROP POLICY IF EXISTS tenant_select_policy ON "students";
DROP POLICY IF EXISTS tenant_insert_policy ON "students";
DROP POLICY IF EXISTS tenant_update_policy ON "students";
DROP POLICY IF EXISTS tenant_delete_policy ON "students";

CREATE POLICY tenant_select_policy ON "students"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "students"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "students"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "students"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "students" FORCE ROW LEVEL SECURITY;

-- ─── 3. fee_invoices ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "fee_invoices";
DROP POLICY IF EXISTS tenant_select_policy ON "fee_invoices";
DROP POLICY IF EXISTS tenant_insert_policy ON "fee_invoices";
DROP POLICY IF EXISTS tenant_update_policy ON "fee_invoices";
DROP POLICY IF EXISTS tenant_delete_policy ON "fee_invoices";

CREATE POLICY tenant_select_policy ON "fee_invoices"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "fee_invoices"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "fee_invoices"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "fee_invoices"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "fee_invoices" FORCE ROW LEVEL SECURITY;

-- ─── 4. fee_payments ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "fee_payments";
DROP POLICY IF EXISTS tenant_select_policy ON "fee_payments";
DROP POLICY IF EXISTS tenant_insert_policy ON "fee_payments";
DROP POLICY IF EXISTS tenant_update_policy ON "fee_payments";
DROP POLICY IF EXISTS tenant_delete_policy ON "fee_payments";

CREATE POLICY tenant_select_policy ON "fee_payments"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "fee_payments"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "fee_payments"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "fee_payments"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "fee_payments" FORCE ROW LEVEL SECURITY;

-- ─── 5. classes ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "classes";
DROP POLICY IF EXISTS tenant_select_policy ON "classes";
DROP POLICY IF EXISTS tenant_insert_policy ON "classes";
DROP POLICY IF EXISTS tenant_update_policy ON "classes";
DROP POLICY IF EXISTS tenant_delete_policy ON "classes";

CREATE POLICY tenant_select_policy ON "classes"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "classes"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "classes"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "classes"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "classes" FORCE ROW LEVEL SECURITY;

-- ─── 6. student_attendance ───────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "student_attendance";
DROP POLICY IF EXISTS tenant_select_policy ON "student_attendance";
DROP POLICY IF EXISTS tenant_insert_policy ON "student_attendance";
DROP POLICY IF EXISTS tenant_update_policy ON "student_attendance";
DROP POLICY IF EXISTS tenant_delete_policy ON "student_attendance";

CREATE POLICY tenant_select_policy ON "student_attendance"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "student_attendance"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "student_attendance"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "student_attendance"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "student_attendance" FORCE ROW LEVEL SECURITY;

-- ─── 7. payment_gateway_logs ─────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "payment_gateway_logs";
DROP POLICY IF EXISTS tenant_select_policy ON "payment_gateway_logs";
DROP POLICY IF EXISTS tenant_insert_policy ON "payment_gateway_logs";
DROP POLICY IF EXISTS tenant_update_policy ON "payment_gateway_logs";
DROP POLICY IF EXISTS tenant_delete_policy ON "payment_gateway_logs";

CREATE POLICY tenant_select_policy ON "payment_gateway_logs"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "payment_gateway_logs"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "payment_gateway_logs"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "payment_gateway_logs"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "payment_gateway_logs" FORCE ROW LEVEL SECURITY;

-- ─── 8. account_ledger_transactions ──────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "account_ledger_transactions";
DROP POLICY IF EXISTS tenant_select_policy ON "account_ledger_transactions";
DROP POLICY IF EXISTS tenant_insert_policy ON "account_ledger_transactions";
DROP POLICY IF EXISTS tenant_update_policy ON "account_ledger_transactions";
DROP POLICY IF EXISTS tenant_delete_policy ON "account_ledger_transactions";

CREATE POLICY tenant_select_policy ON "account_ledger_transactions"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "account_ledger_transactions"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "account_ledger_transactions"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "account_ledger_transactions"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "account_ledger_transactions" FORCE ROW LEVEL SECURITY;

-- ─── 9. consent_records ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "consent_records";
DROP POLICY IF EXISTS tenant_select_policy ON "consent_records";
DROP POLICY IF EXISTS tenant_insert_policy ON "consent_records";
DROP POLICY IF EXISTS tenant_update_policy ON "consent_records";
DROP POLICY IF EXISTS tenant_delete_policy ON "consent_records";

CREATE POLICY tenant_select_policy ON "consent_records"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "consent_records"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "consent_records"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "consent_records"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "consent_records" FORCE ROW LEVEL SECURITY;

-- ─── 10. rights_requests ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "rights_requests";
DROP POLICY IF EXISTS tenant_select_policy ON "rights_requests";
DROP POLICY IF EXISTS tenant_insert_policy ON "rights_requests";
DROP POLICY IF EXISTS tenant_update_policy ON "rights_requests";
DROP POLICY IF EXISTS tenant_delete_policy ON "rights_requests";

CREATE POLICY tenant_select_policy ON "rights_requests"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "rights_requests"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "rights_requests"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "rights_requests"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "rights_requests" FORCE ROW LEVEL SECURITY;

-- ─── 11. dpdp_grievances ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "dpdp_grievances";
DROP POLICY IF EXISTS tenant_select_policy ON "dpdp_grievances";
DROP POLICY IF EXISTS tenant_insert_policy ON "dpdp_grievances";
DROP POLICY IF EXISTS tenant_update_policy ON "dpdp_grievances";
DROP POLICY IF EXISTS tenant_delete_policy ON "dpdp_grievances";

CREATE POLICY tenant_select_policy ON "dpdp_grievances"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "dpdp_grievances"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "dpdp_grievances"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "dpdp_grievances"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "dpdp_grievances" FORCE ROW LEVEL SECURITY;

-- ─── 12. data_breach_log ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "data_breach_log";
DROP POLICY IF EXISTS tenant_select_policy ON "data_breach_log";
DROP POLICY IF EXISTS tenant_insert_policy ON "data_breach_log";
DROP POLICY IF EXISTS tenant_update_policy ON "data_breach_log";
DROP POLICY IF EXISTS tenant_delete_policy ON "data_breach_log";

CREATE POLICY tenant_select_policy ON "data_breach_log"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "data_breach_log"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "data_breach_log"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "data_breach_log"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "data_breach_log" FORCE ROW LEVEL SECURITY;

-- ─── 13. vendor_register ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS tenant_isolation_policy ON "vendor_register";
DROP POLICY IF EXISTS tenant_select_policy ON "vendor_register";
DROP POLICY IF EXISTS tenant_insert_policy ON "vendor_register";
DROP POLICY IF EXISTS tenant_update_policy ON "vendor_register";
DROP POLICY IF EXISTS tenant_delete_policy ON "vendor_register";

CREATE POLICY tenant_select_policy ON "vendor_register"
  FOR SELECT
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR nullif(current_setting('app.current_role', true), '') = 'PLATFORM_ADMIN'
  );

CREATE POLICY tenant_insert_policy ON "vendor_register"
  FOR INSERT
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON "vendor_register"
  FOR UPDATE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON "vendor_register"
  FOR DELETE
  USING (
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
  );

ALTER TABLE "vendor_register" FORCE ROW LEVEL SECURITY;
