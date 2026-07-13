-- PostgreSQL initialisation script
-- Run once on first container start

-- Enable pgcrypto for AES-256 encryption (DPDP Act 2023 Section 8(5))
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable uuid-ossp for gen_random_uuid() fallback
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Append-only trigger for audit_logs (enforced at DB level)
-- Created here as raw SQL (exception to Drizzle-only rule for migration files)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only. UPDATE and DELETE are not permitted. (DPDP Act 2023 Section 8(5))';
END;
$$ LANGUAGE plpgsql;
