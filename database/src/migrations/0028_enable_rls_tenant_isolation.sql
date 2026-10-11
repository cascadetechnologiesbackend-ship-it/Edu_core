-- Migration 0028: Enable Row Level Security (RLS) Tenant Isolation Policies
-- Evaluates current_setting('app.current_school_id', true) to enforce multi-tenant isolation at the database layer.

-- 1. students
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'students' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "students"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 2. fee_invoices
ALTER TABLE "fee_invoices" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fee_invoices' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "fee_invoices"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 3. fee_payments
ALTER TABLE "fee_payments" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fee_payments' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "fee_payments"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 4. users (permits global superadmin users with NULL school_id)
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "users"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id IS NULL
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id IS NULL
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 5. classes
ALTER TABLE "classes" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'classes' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "classes"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 6. student_attendance
ALTER TABLE "student_attendance" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_attendance' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "student_attendance"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 7. payment_gateway_logs
ALTER TABLE "payment_gateway_logs" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_gateway_logs' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "payment_gateway_logs"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 8. account_ledger_transactions
ALTER TABLE "account_ledger_transactions" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_ledger_transactions' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "account_ledger_transactions"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 9. consent_records (DPDP)
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consent_records' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "consent_records"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 10. rights_requests (DPDP)
ALTER TABLE "rights_requests" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rights_requests' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "rights_requests"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 11. dpdp_grievances (DPDP)
ALTER TABLE "dpdp_grievances" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dpdp_grievances' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "dpdp_grievances"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 12. data_breach_log (DPDP)
ALTER TABLE "data_breach_log" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_breach_log' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "data_breach_log"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;

-- 13. vendor_register (DPDP)
ALTER TABLE "vendor_register" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vendor_register' AND policyname = 'tenant_isolation_policy') THEN
    CREATE POLICY tenant_isolation_policy ON "vendor_register"
      FOR ALL
      USING (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      )
      WITH CHECK (
        current_setting('app.current_school_id', true) IS NULL
        OR current_setting('app.current_school_id', true) = ''
        OR school_id::text = current_setting('app.current_school_id', true)
      );
  END IF;
END $$;
