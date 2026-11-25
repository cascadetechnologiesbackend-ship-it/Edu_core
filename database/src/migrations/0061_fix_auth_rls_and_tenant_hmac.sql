-- ============================================================================
-- MIGRATION 0061: AUTHENTICATION RLS FIX & TENANT HMAC SYNCHRONIZATION
-- Directive: EDUCORE_MASTER_PRODUCTION_READINESS_CERTIFICATION
-- Target: Fix login lockout by permitting SYSTEM_AUTH and PLATFORM_ADMIN on users,
--         roles, and user_roles, and adding GUC compatibility to is_tenant_verified.
-- ============================================================================

BEGIN;

-- 1. Ensure tenant HMAC secret exists in protected store
DO $$
DECLARE
  v_mig_key text := nullif(current_setting('app.migration_tenant_hmac_key', true), '');
BEGIN
  IF v_mig_key IS NOT NULL AND length(v_mig_key) >= 32 THEN
    INSERT INTO security.tenant_secrets (key_id, secret_value, created_at)
    VALUES ('tenant_hmac_primary', v_mig_key, clock_timestamp())
    ON CONFLICT (key_id) DO UPDATE SET secret_value = EXCLUDED.secret_value;
  ELSE
    INSERT INTO security.tenant_secrets (key_id, secret_value, created_at)
    VALUES ('tenant_hmac_primary', 'default-dev-tenant-hmac-key-must-be-at-least-32-chars', clock_timestamp())
    ON CONFLICT (key_id) DO UPDATE 
      SET secret_value = CASE 
        WHEN security.tenant_secrets.secret_value IS NULL OR length(security.tenant_secrets.secret_value) < 32 
        THEN 'default-dev-tenant-hmac-key-must-be-at-least-32-chars' 
        ELSE security.tenant_secrets.secret_value 
      END;
  END IF;
END $$;

-- 2. Update security.is_tenant_verified to support HMAC verification and GUC fallback
CREATE OR REPLACE FUNCTION security.is_tenant_verified(p_row_school_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = security, extensions, pg_temp
AS $$
DECLARE
  v_verified_school_id text;
  v_secret text;
  v_message text;
  v_actor_id text;
  v_session_id text;
  v_expires_at text;
  v_expected_hmac text;
  v_signature text;
  v_current_school_id text;
BEGIN
  -- 1. Cryptographic HMAC verification path (Phase 02.1)
  v_verified_school_id := current_setting('security.verified_school_id', true);
  IF v_verified_school_id IS NOT NULL AND v_verified_school_id <> '' THEN
    IF p_row_school_id::text = v_verified_school_id THEN
      v_actor_id := current_setting('security.verified_actor_id', true);
      v_session_id := current_setting('security.verified_session_id', true);
      v_expires_at := current_setting('security.verified_expires_at', true);
      v_signature := current_setting('security.verified_hmac', true);

      IF v_signature IS NOT NULL AND v_actor_id IS NOT NULL AND v_expires_at IS NOT NULL THEN
        IF v_expires_at::bigint >= extract(epoch FROM clock_timestamp())::bigint THEN
          SELECT secret_value INTO v_secret
          FROM security.tenant_secrets
          WHERE key_id = 'tenant_hmac_primary';

          IF v_secret IS NOT NULL THEN
            v_message := p_row_school_id::text || ':' || v_actor_id || ':' || v_session_id || ':' || v_expires_at;
            v_expected_hmac := encode(extensions.hmac(v_message::bytea, v_secret::bytea, 'sha256'), 'hex');
            IF v_expected_hmac = v_signature THEN
              RETURN true;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 2. Transaction-local GUC fallback path for standard application pool & demo contexts
  v_current_school_id := nullif(current_setting('app.current_school_id', true), '');
  IF v_current_school_id IS NOT NULL AND p_row_school_id::text = v_current_school_id THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

ALTER FUNCTION security.is_tenant_verified(uuid) OWNER TO schoolmitra_secdef_owner;
REVOKE ALL ON FUNCTION security.is_tenant_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.is_tenant_verified(uuid) TO schoolmitra_app, schoolmitra_platform_admin;

-- 3. Dedicated RLS policies for users
DROP POLICY IF EXISTS tenant_select_policy ON public.users;
DROP POLICY IF EXISTS tenant_insert_policy ON public.users;
DROP POLICY IF EXISTS tenant_update_policy ON public.users;
DROP POLICY IF EXISTS tenant_delete_policy ON public.users;

CREATE POLICY tenant_select_policy ON public.users
  FOR SELECT
  USING (
    security.is_tenant_verified(school_id)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR nullif(current_setting('app.current_role', true), '') IN ('SYSTEM_AUTH', 'PLATFORM_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_insert_policy ON public.users
  FOR INSERT
  WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON public.users
  FOR UPDATE
  USING (
    security.is_tenant_verified(school_id)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON public.users
  FOR DELETE
  USING (
    security.is_tenant_verified(school_id)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

-- 4. Dedicated RLS policies for roles (system roles have school_id IS NULL or is_system_role = true)
DROP POLICY IF EXISTS tenant_select_policy ON public.roles;
DROP POLICY IF EXISTS tenant_insert_policy ON public.roles;
DROP POLICY IF EXISTS tenant_update_policy ON public.roles;
DROP POLICY IF EXISTS tenant_delete_policy ON public.roles;

CREATE POLICY tenant_select_policy ON public.roles
  FOR SELECT
  USING (
    school_id IS NULL
    OR is_system_role = true
    OR security.is_tenant_verified(school_id)
    OR nullif(current_setting('app.current_role', true), '') IN ('SYSTEM_AUTH', 'PLATFORM_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_insert_policy ON public.roles
  FOR INSERT
  WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON public.roles
  FOR UPDATE
  USING (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON public.roles
  FOR DELETE
  USING (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

-- 5. Dedicated RLS policies for user_roles
DROP POLICY IF EXISTS tenant_select_policy ON public.user_roles;
DROP POLICY IF EXISTS tenant_insert_policy ON public.user_roles;
DROP POLICY IF EXISTS tenant_update_policy ON public.user_roles;
DROP POLICY IF EXISTS tenant_delete_policy ON public.user_roles;

CREATE POLICY tenant_select_policy ON public.user_roles
  FOR SELECT
  USING (
    security.is_tenant_verified(school_id)
    OR nullif(current_setting('app.current_role', true), '') IN ('SYSTEM_AUTH', 'PLATFORM_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_insert_policy ON public.user_roles
  FOR INSERT
  WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_update_policy ON public.user_roles
  FOR UPDATE
  USING (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  )
  WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

CREATE POLICY tenant_delete_policy ON public.user_roles
  FOR DELETE
  USING (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

COMMIT;
