-- Migration 0031: Application Login Role for Non-Owner Connections
-- Creates role `schoolmitra_app_login` with LOGIN privilege and membership in `schoolmitra_app`.
-- The application connection string (DATABASE_URL) connects as this role, ensuring
-- all runtime DML queries operate without table-owner or BYPASSRLS privileges.
-- DDL migrations continue to run via MIGRATION_DATABASE_URL using the table owner role.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app_login'
  ) THEN
    -- In production, the password should be rotated and injected via environment.
    -- Default password provided for standard local / CI setups.
    CREATE ROLE schoolmitra_app_login WITH LOGIN PASSWORD 'schoolmitra_app_secure' IN ROLE schoolmitra_app;
  ELSE
    -- Ensure role is granted membership in schoolmitra_app
    GRANT schoolmitra_app TO schoolmitra_app_login;
  END IF;
END;
$$;
