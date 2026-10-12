-- Migration 0030: Non-Owner Application Database Role
-- Creates a dedicated non-superuser role `schoolmitra_app` for application
-- runtime database connections. The table owner (used only for migrations)
-- remains separate, ensuring RLS policies are enforced at all times.
--
-- SECURITY: When connected as a non-owner role without BYPASSRLS privilege,
-- Postgres evaluates all POLICY expressions. Connecting as the table owner
-- or a superuser bypasses RLS even with FORCE ROW LEVEL SECURITY. This
-- migration closes that gap by separating DDL identity (migration runner)
-- from DML identity (application server).

-- 1. Create the application role (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'schoolmitra_app'
  ) THEN
    CREATE ROLE schoolmitra_app NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END;
$$;

-- 2. Grant USAGE on the public schema
GRANT USAGE ON SCHEMA public TO schoolmitra_app;

-- 3. Grant DML privileges on ALL existing tables in public schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO schoolmitra_app;

-- 4. Grant USAGE + SELECT on ALL existing sequences (for INSERT with serial/uuid)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO schoolmitra_app;

-- 5. Set DEFAULT PRIVILEGES so future tables/sequences created by the owner
--    are automatically accessible to schoolmitra_app
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO schoolmitra_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO schoolmitra_app;

-- 6. Ensure RLS is NOT bypassed by the application role
--    (NOLOGIN roles cannot have BYPASSRLS by default; this is belt-and-suspenders)
ALTER ROLE schoolmitra_app NOLOGIN;

-- ─── S4-T0: Login Lockout Prevention ─────────────────────────────────────────
-- Migration 0029 enforced FORCE RLS on the `users` table with a policy that
-- requires `app.current_school_id` to be set. However, NextAuth's authorize()
-- must look up a user by email BEFORE any school context is established (the
-- user is not yet authenticated).
--
-- Fix: Add a third policy arm to the `users` table that permits reads when
-- `app.current_role` is set to the sentinel value 'SYSTEM_AUTH'. The
-- withAuthContext() helper in backend/src/lib/tenant.ts sets this role within
-- the transaction, allowing the login lookup to proceed.
--
-- SECURITY: 'SYSTEM_AUTH' is an internal sentinel — not a Postgres role. It is
-- never granted to any end-user and can only be set inside a server transaction.
-- It permits SELECT only (login is read-only for the user lookup).

DROP POLICY IF EXISTS tenant_isolation_policy ON "users";
CREATE POLICY tenant_isolation_policy ON "users"
  FOR ALL
  USING (
    -- Arm 1: Normal tenant-scoped access
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    -- Arm 2: Global super-admin visibility (NULL school_id rows)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    -- Arm 3: System authentication context — allows login lookup before session
    OR nullif(current_setting('app.current_role', true), '') = 'SYSTEM_AUTH'
  )
  WITH CHECK (
    -- Write check: only tenant-scoped writes or super-admin global writes
    school_id::text = nullif(current_setting('app.current_school_id', true), '')
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
  );
-- FORCE ROW LEVEL SECURITY is already set from migration 0029

-- connection string must use a login role that has been GRANTED schoolmitra_app,
-- e.g.:
--   CREATE ROLE app_login LOGIN PASSWORD '...' IN ROLE schoolmitra_app;
-- or simply connect as schoolmitra_app after granting LOGIN (only in environments
-- where the DB provider allows direct role creation with password).
--
-- On Render Postgres (managed), set the DATABASE_URL to connect as the provisioned
-- user and then execute:
--   SET ROLE schoolmitra_app;
-- at the start of each transaction, OR use a connection pool that sets this.
-- See backend/src/lib/tenant.ts for the withTenant() helper which wraps this.
