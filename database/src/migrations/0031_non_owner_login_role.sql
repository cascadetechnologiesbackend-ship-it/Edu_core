-- Migration 0031: Application Login Role for Non-Owner Connections
-- Creates role `schoolmitra_app_login` with LOGIN privilege and membership in `schoolmitra_app`.
-- The application connection string (DATABASE_URL) connects as this role, ensuring
-- all runtime DML queries operate without table-owner or BYPASSRLS privileges.
-- DDL migrations continue to run via MIGRATION_DATABASE_URL using the table owner role.

DO $$
DECLARE
  v_pwd text;
BEGIN
  v_pwd := nullif(current_setting('app.app_db_password', true), '');
  IF v_pwd IS NULL THEN
    v_pwd := 'schoolmitra_app_secure';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app_login'
  ) THEN
    EXECUTE format('CREATE ROLE schoolmitra_app_login WITH LOGIN PASSWORD %L IN ROLE schoolmitra_app', v_pwd);
  ELSE
    IF current_setting('app.app_db_password', true) IS NOT NULL AND current_setting('app.app_db_password', true) <> '' THEN
      EXECUTE format('ALTER ROLE schoolmitra_app_login WITH PASSWORD %L', v_pwd);
    END IF;
    -- Ensure role is granted membership in schoolmitra_app
    GRANT schoolmitra_app TO schoolmitra_app_login;
  END IF;
END;
$$;
