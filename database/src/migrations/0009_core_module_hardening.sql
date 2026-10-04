-- ─── 0009_core_module_hardening.sql ─────────────────────────────────────────────
-- DPDP Act 2023 Section 8(5) Immutability Enforcement & Multi-Tenant Constraint Fixes

-- 1. Append-Only Immutability Triggers
CREATE OR REPLACE FUNCTION enforce_append_only_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable append-only records pursuant to DPDP Act 2023 Section 8(5). Modifications and deletions are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION enforce_append_only_audit_logs();

DROP TRIGGER IF EXISTS trg_platform_audit_logs_append_only ON platform_audit_logs;
CREATE TRIGGER trg_platform_audit_logs_append_only
BEFORE UPDATE OR DELETE ON platform_audit_logs
FOR EACH ROW EXECUTE FUNCTION enforce_append_only_audit_logs();

-- 2. Multi-Tenant Unique Constraint on users (school_id, email)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_school_email_unique'
    ) THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_school_email_unique" UNIQUE ("school_id", "email");
    END IF;
END $$;

-- 3. Composite Performance Indexes for High-Throughput Audit Lookups
CREATE INDEX IF NOT EXISTS "audit_logs_school_date_idx" ON "audit_logs" ("school_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "pal_target_school_date_idx" ON "platform_audit_logs" ("target_school_id", "created_at" DESC);
