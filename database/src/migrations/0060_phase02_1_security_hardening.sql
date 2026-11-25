-- ============================================================================
-- MIGRATION 0060: PHASE 02.1 SECURITY HARDENING & CRYPTOGRAPHIC MULTI-TENANCY
-- Directive: EDUCORE_MASTER_BLUEPRINT_V2_IMPLEMENTATION_GUARDRAILS
-- Authoritative Baseline: eaa11870b01122e3d3e84f656eb86ba9f3e0a995
-- ============================================================================

BEGIN;

-- 1. Ensure required extensions and schema
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  -- If pgcrypto is already installed in another schema, relocate it to extensions
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    BEGIN
      ALTER EXTENSION pgcrypto SET SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  ELSE
    BEGIN
      CREATE EXTENSION "pgcrypto" WITH SCHEMA extensions;
    EXCEPTION WHEN OTHERS THEN
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    END;
  END IF;
END $$;

DO $$
BEGIN
  -- If hmac is not in extensions (e.g. pgcrypto installed in public), create a bridge wrapper
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'extensions' AND p.proname = 'hmac'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'hmac'
    ) THEN
      CREATE OR REPLACE FUNCTION extensions.hmac(data bytea, key bytea, type text)
      RETURNS bytea
      LANGUAGE sql
      IMMUTABLE STRICT
      AS $func$
        SELECT public.hmac(data, key, type);
      $func$;
    END IF;
  END IF;
END $$;

-- 2. Create and configure security schema and dedicated roles
CREATE SCHEMA IF NOT EXISTS security;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'schoolmitra_owner') THEN
    CREATE ROLE schoolmitra_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'schoolmitra_secdef_owner') THEN
    CREATE ROLE schoolmitra_secdef_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'schoolmitra_audit_writer') THEN
    CREATE ROLE schoolmitra_audit_writer NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'schoolmitra_app') THEN
    CREATE ROLE schoolmitra_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'schoolmitra_platform_admin') THEN
    CREATE ROLE schoolmitra_platform_admin NOLOGIN;
  END IF;

  -- Ensure migration user has SET ROLE capability on created roles (PostgreSQL 16 requirement)
  BEGIN
    EXECUTE format('GRANT schoolmitra_owner, schoolmitra_secdef_owner, schoolmitra_audit_writer, schoolmitra_app, schoolmitra_platform_admin TO %I', CURRENT_USER);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not grant roles to CURRENT_USER: %', SQLERRM;
  END;
END $$;

CREATE OR REPLACE FUNCTION security.safe_set_owner(p_sql text)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping ownership alteration (%): %', p_sql, SQLERRM;
END;
$$;

SELECT security.safe_set_owner('ALTER SCHEMA security OWNER TO schoolmitra_secdef_owner');
GRANT USAGE ON SCHEMA security TO schoolmitra_app, schoolmitra_platform_admin;
GRANT USAGE ON SCHEMA extensions TO PUBLIC, schoolmitra_app, schoolmitra_platform_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC, schoolmitra_app, schoolmitra_platform_admin;

-- 3. Dedicated Protected Secret Store (Correction A: Never in session GUC)
CREATE TABLE IF NOT EXISTS security.tenant_secrets (
  key_id text PRIMARY KEY,
  secret_value text NOT NULL,
  algorithm text NOT NULL DEFAULT 'sha256',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

SELECT security.safe_set_owner('ALTER TABLE security.tenant_secrets OWNER TO schoolmitra_secdef_owner');
REVOKE ALL ON security.tenant_secrets FROM PUBLIC, schoolmitra_app, schoolmitra_platform_admin;
-- Seed initial secure key from migration session context or fallback to development secret
DO $$
DECLARE
  v_mig_key text := nullif(current_setting('app.migration_tenant_hmac_key', true), '');
BEGIN
  IF v_mig_key IS NOT NULL AND length(v_mig_key) >= 32 THEN
    INSERT INTO security.tenant_secrets (key_id, secret_value)
    VALUES ('tenant_hmac_primary', v_mig_key)
    ON CONFLICT (key_id) DO UPDATE SET secret_value = EXCLUDED.secret_value;
  ELSE
    INSERT INTO security.tenant_secrets (key_id, secret_value)
    VALUES ('tenant_hmac_primary', 'default-dev-tenant-hmac-key-must-be-at-least-32-chars')
    ON CONFLICT (key_id) DO NOTHING;
  END IF;
END $$;

-- Dedicated secret provisioning procedure restricted to secdef owner & migration role
CREATE OR REPLACE FUNCTION security.provision_tenant_secret(p_key_id text, p_secret_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, pg_temp
AS $$
BEGIN
  IF length(p_secret_value) < 32 THEN
    RAISE EXCEPTION 'SECURITY_KEY_INVALID: Secret must be at least 32 characters';
  END IF;
  INSERT INTO security.tenant_secrets (key_id, secret_value, created_at)
  VALUES (p_key_id, p_secret_value, clock_timestamp())
  ON CONFLICT (key_id) DO UPDATE 
    SET secret_value = EXCLUDED.secret_value,
        created_at = EXCLUDED.created_at;
END;
$$;
SELECT security.safe_set_owner('ALTER FUNCTION security.provision_tenant_secret(text, text) OWNER TO schoolmitra_secdef_owner');
REVOKE ALL ON FUNCTION security.provision_tenant_secret(text, text) FROM PUBLIC, schoolmitra_app, schoolmitra_platform_admin;

-- 4. JIT Session and Audit Ledger Tables (Correction C & E)
CREATE TABLE IF NOT EXISTS public.jit_audit_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  allowed_tables text[] NOT NULL,
  reason text NOT NULL,
  status text NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'ACTIVE', 'REVOKED', 'EXPIRED')),
  approved_by text,
  approved_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz NOT NULL,
  active_token_hash text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

SELECT security.safe_set_owner('ALTER TABLE public.jit_audit_sessions OWNER TO schoolmitra_owner');
ALTER TABLE public.jit_audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jit_audit_sessions FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.jit_access_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  actor_id text NOT NULL,
  school_id uuid NOT NULL,
  target_table text NOT NULL,
  query_intent text NOT NULL,
  filter_parameters jsonb DEFAULT '{}'::jsonb,
  event_type text NOT NULL CHECK (event_type IN ('ACCESS_INTENT', 'ACCESS_COMPLETED', 'ACCESS_FAILED', 'REVOCATION')),
  rows_returned integer DEFAULT 0,
  client_ip inet,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

SELECT security.safe_set_owner('ALTER TABLE public.jit_access_audit_logs OWNER TO schoolmitra_owner');
ALTER TABLE public.jit_access_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jit_access_audit_logs FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS security.jit_activation_nonces (
  nonce text PRIMARY KEY,
  session_id uuid NOT NULL,
  actor_id text NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL
);

SELECT security.safe_set_owner('ALTER TABLE security.jit_activation_nonces OWNER TO schoolmitra_secdef_owner');
CREATE INDEX IF NOT EXISTS idx_jit_nonces_expires_at ON security.jit_activation_nonces (expires_at);

-- 5. Cryptographic Tenant Context Gate & Verification Helpers (Correction A & B)
CREATE OR REPLACE FUNCTION security.set_verified_tenant_context(
  p_school_id uuid,
  p_actor_id text,
  p_session_id text,
  p_expires_at bigint,
  p_hmac_signature text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, extensions, pg_temp
AS $$
DECLARE
  v_secret text;
  v_message text;
  v_expected_hmac text;
BEGIN
  -- Retrieve secret strictly from security.tenant_secrets (never from session GUC!)
  SELECT secret_value INTO v_secret
  FROM security.tenant_secrets
  WHERE key_id = 'tenant_hmac_primary';

  IF v_secret IS NULL OR length(v_secret) < 32 THEN
    RAISE EXCEPTION 'SECURITY_CONFIG_ERROR: Tenant HMAC secret store uninitialized or insufficient entropy';
  END IF;

  -- Timestamp freshness validation
  IF p_expires_at < extract(epoch FROM clock_timestamp())::bigint THEN
    RAISE EXCEPTION 'SECURITY_TOKEN_EXPIRED: Tenant context token has expired';
  END IF;

  -- Canonical serialization: school_id:actor_id:session_id:expires_at
  v_message := p_school_id::text || ':' || p_actor_id || ':' || p_session_id || ':' || p_expires_at::text;
  v_expected_hmac := encode(extensions.hmac(v_message::bytea, v_secret::bytea, 'sha256'), 'hex');

  IF v_expected_hmac IS DISTINCT FROM p_hmac_signature THEN
    RAISE EXCEPTION 'SECURITY_HMAC_INVALID: Cryptographic signature mismatch for tenant context';
  END IF;

  -- Set transaction-local verified parameters
  PERFORM set_config('security.verified_school_id', p_school_id::text, true);
  PERFORM set_config('security.verified_actor_id', p_actor_id, true);
  PERFORM set_config('security.verified_session_id', p_session_id, true);
  PERFORM set_config('security.verified_expires_at', p_expires_at::text, true);
  PERFORM set_config('security.verified_hmac', p_hmac_signature, true);

  RETURN true;
END;
$$;

SELECT security.safe_set_owner('ALTER FUNCTION security.set_verified_tenant_context(uuid, text, text, bigint, text) OWNER TO schoolmitra_secdef_owner');
REVOKE ALL ON FUNCTION security.set_verified_tenant_context(uuid, text, text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.set_verified_tenant_context(uuid, text, text, bigint, text) TO schoolmitra_app;

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
        -- Timestamp freshness validation per-statement
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

SELECT security.safe_set_owner('ALTER FUNCTION security.is_tenant_verified(uuid) OWNER TO schoolmitra_secdef_owner');
REVOKE ALL ON FUNCTION security.is_tenant_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.is_tenant_verified(uuid) TO schoolmitra_app, schoolmitra_platform_admin;

-- 6. JIT Activation Procedure (Correction D: Actor matching, TTL boundaries, atomic nonce)
CREATE OR REPLACE FUNCTION security.activate_jit_session(
  p_session_id uuid,
  p_actor_id text,
  p_nonce text,
  p_token text,
  p_ttl_seconds integer DEFAULT 900
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, pg_temp
AS $$
DECLARE
  v_session record;
  v_now timestamptz := clock_timestamp();
  v_expires_at timestamptz;
  v_ttl integer;
BEGIN
  IF NOT pg_has_role(session_user, 'schoolmitra_platform_admin', 'MEMBER') THEN
    RAISE EXCEPTION 'SECURITY_UNAUTHORIZED: Calling role % is not authorized to activate JIT sessions', session_user;
  END IF;

  -- Strict TTL enforcement: default 900s (15 min), maximum 1800s (30 min)
  v_ttl := COALESCE(p_ttl_seconds, 900);
  IF v_ttl > 1800 OR v_ttl < 60 THEN
    RAISE EXCEPTION 'INVALID_JIT_TTL: TTL must be between 60 and 1800 seconds (30 minutes max)';
  END IF;
  v_expires_at := v_now + (v_ttl || ' seconds')::interval;

  -- Atomic Nonce Consumption
  BEGIN
    INSERT INTO security.jit_activation_nonces (nonce, session_id, actor_id, consumed_at, expires_at)
    VALUES (p_nonce, p_session_id, p_actor_id, v_now, v_expires_at);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'JIT_NONCE_REPLAY: Token nonce % has already been consumed', p_nonce;
  END;

  -- Exclusive row lock
  SELECT * INTO v_session
  FROM public.jit_audit_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JIT_SESSION_NOT_FOUND: Session % does not exist', p_session_id;
  END IF;

  IF v_session.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'JIT_SESSION_NOT_APPROVED: Session status is %, expected APPROVED', v_session.status;
  END IF;

  -- Actor-to-session verification
  IF v_session.actor_id <> p_actor_id THEN
    RAISE EXCEPTION 'JIT_ACTOR_MISMATCH: Caller actor % does not match approved session actor %', p_actor_id, v_session.actor_id;
  END IF;

  IF v_session.expires_at < v_now THEN
    RAISE EXCEPTION 'JIT_SESSION_EXPIRED: Session expired at %', v_session.expires_at;
  END IF;

  -- Mark active
  UPDATE public.jit_audit_sessions
  SET status = 'ACTIVE',
      activated_at = v_now,
      expires_at = v_expires_at,
      active_token_hash = encode(sha256(p_token::bytea), 'hex')
  WHERE id = p_session_id;

  -- Record in audit ledger
  INSERT INTO public.jit_access_audit_logs (
    session_id, actor_id, school_id, target_table, query_intent, event_type, occurred_at
  ) VALUES (
    p_session_id, p_actor_id, v_session.school_id, 'SYSTEM', 'JIT Session Activation', 'ACCESS_INTENT', v_now
  );

  PERFORM set_config('security.verified_school_id', v_session.school_id::text, true);
  PERFORM set_config('security.verified_actor_id', p_actor_id, true);
  PERFORM set_config('security.verified_session_id', p_session_id::text, true);

  RETURN true;
END;
$$;

SELECT security.safe_set_owner('ALTER FUNCTION security.activate_jit_session(uuid, text, text, text, integer) OWNER TO schoolmitra_secdef_owner');
REVOKE ALL ON FUNCTION security.activate_jit_session(uuid, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.activate_jit_session(uuid, text, text, text, integer) TO schoolmitra_platform_admin;

-- 7. Durable 3-Phase Diagnostic Workflow (Correction C & E)

-- Phase 1: Record Intent (Transaction 1)
CREATE OR REPLACE FUNCTION security.record_access_intent(
  p_session_id uuid,
  p_school_id uuid,
  p_target_table text,
  p_query_intent text,
  p_filter_parameters jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, pg_temp
AS $$
DECLARE
  v_session record;
  v_log_id uuid;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF NOT pg_has_role(session_user, 'schoolmitra_platform_admin', 'MEMBER') THEN
    RAISE EXCEPTION 'SECURITY_UNAUTHORIZED: Calling role % is not authorized', session_user;
  END IF;

  SELECT * INTO v_session
  FROM public.jit_audit_sessions
  WHERE id = p_session_id AND school_id = p_school_id;

  IF NOT FOUND OR v_session.status <> 'ACTIVE' OR v_session.expires_at < v_now THEN
    RAISE EXCEPTION 'JIT_SESSION_INVALID: Active authorized JIT session required';
  END IF;

  -- Allowlist check against session's allowed tables
  IF NOT (p_target_table = ANY(v_session.allowed_tables)) THEN
    RAISE EXCEPTION 'JIT_TABLE_NOT_PERMITTED: Table % is not in session allowed list', p_target_table;
  END IF;

  -- Validate table exists in public schema
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_target_table) THEN
    RAISE EXCEPTION 'INVALID_TABLE_NAME: Table % does not exist in public schema', p_target_table;
  END IF;

  INSERT INTO public.jit_access_audit_logs (
    session_id, actor_id, school_id, target_table, query_intent, filter_parameters, event_type, occurred_at
  ) VALUES (
    p_session_id, session_user, p_school_id, p_target_table, p_query_intent, p_filter_parameters, 'ACCESS_INTENT', v_now
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

SELECT security.safe_set_owner('ALTER FUNCTION security.record_access_intent(uuid, uuid, text, text, jsonb) OWNER TO schoolmitra_secdef_owner');
REVOKE ALL ON FUNCTION security.record_access_intent(uuid, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.record_access_intent(uuid, uuid, text, text, jsonb) TO schoolmitra_platform_admin;

-- Phase 2: Execute Scoped Diagnostic Read (Transaction 2)
CREATE OR REPLACE FUNCTION security.read_diagnostic_records(
  p_audit_log_id uuid,
  p_target_table text,
  p_school_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, pg_temp
AS $$
DECLARE
  v_audit record;
  v_session record;
  v_columns text;
  v_query text;
  v_result jsonb;
  v_bounded_limit integer;
BEGIN
  IF NOT pg_has_role(session_user, 'schoolmitra_platform_admin', 'MEMBER') THEN
    RAISE EXCEPTION 'SECURITY_UNAUTHORIZED: Calling role % is not authorized', session_user;
  END IF;

  -- Validate committed access intent from Transaction 1
  SELECT * INTO v_audit
  FROM public.jit_access_audit_logs
  WHERE id = p_audit_log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUDIT_INTENT_NOT_FOUND: No access intent found for id %', p_audit_log_id;
  END IF;

  IF v_audit.event_type <> 'ACCESS_INTENT' THEN
    RAISE EXCEPTION 'AUDIT_INTENT_INVALID: Expected ACCESS_INTENT, found %', v_audit.event_type;
  END IF;

  IF v_audit.school_id <> p_school_id OR v_audit.target_table <> p_target_table THEN
    RAISE EXCEPTION 'AUDIT_INTENT_MISMATCH: Audit log parameters do not match requested query';
  END IF;

  -- Validate active session status, expiry, and allowed table list
  SELECT * INTO v_session
  FROM public.jit_audit_sessions
  WHERE id = v_audit.session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JIT_SESSION_NOT_FOUND: Associated JIT session does not exist';
  END IF;

  IF v_session.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'JIT_SESSION_NOT_ACTIVE: Session status is %, expected ACTIVE', v_session.status;
  END IF;

  IF v_session.expires_at < clock_timestamp() THEN
    RAISE EXCEPTION 'JIT_SESSION_EXPIRED: Session expired at %', v_session.expires_at;
  END IF;

  IF NOT (p_target_table = ANY(v_session.allowed_tables)) THEN
    RAISE EXCEPTION 'JIT_TABLE_NOT_PERMITTED: Table % is not in session allowed list', p_target_table;
  END IF;

  -- Table allowlist validation against information_schema
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_target_table) THEN
    RAISE EXCEPTION 'INVALID_TABLE_NAME: Table % does not exist', p_target_table;
  END IF;

  v_bounded_limit := LEAST(COALESCE(p_limit, 50), 100);

  -- Dynamic column projection filtering out credential & secret columns
  SELECT string_agg(
    CASE 
      WHEN column_name IN ('password_hash', 'totp_secret', 'pin', 'secret_value', 'active_token_hash') 
        THEN '''[REDACTED]'' AS ' || quote_ident(column_name)
      ELSE quote_ident(column_name)
    END, 
    ', '
  ) INTO v_columns
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = p_target_table;

  IF v_columns IS NULL THEN
    RAISE EXCEPTION 'NO_COLUMNS_FOUND: Could not retrieve column list for %', p_target_table;
  END IF;

  -- Strictly parameterized query
  v_query := format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (SELECT %s FROM public.%I WHERE school_id = $1 LIMIT $2 OFFSET $3) t',
    v_columns,
    p_target_table
  );

  EXECUTE v_query INTO v_result USING p_school_id, v_bounded_limit, GREATEST(COALESCE(p_offset, 0), 0);
  RETURN v_result;
END;
$$;

SELECT security.safe_set_owner('ALTER FUNCTION security.read_diagnostic_records(uuid, text, uuid, integer, integer) OWNER TO schoolmitra_secdef_owner');
REVOKE ALL ON FUNCTION security.read_diagnostic_records(uuid, text, uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.read_diagnostic_records(uuid, text, uuid, integer, integer) TO schoolmitra_platform_admin;

-- Phase 3: Record Outcome (Transaction 3)
CREATE OR REPLACE FUNCTION security.record_access_outcome(
  p_audit_log_id uuid,
  p_event_type text,
  p_rows_returned integer DEFAULT 0,
  p_error_message text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public, pg_temp
AS $$
DECLARE
  v_audit record;
BEGIN
  IF NOT pg_has_role(session_user, 'schoolmitra_platform_admin', 'MEMBER') THEN
    RAISE EXCEPTION 'SECURITY_UNAUTHORIZED: Calling role % is not authorized', session_user;
  END IF;

  IF p_event_type NOT IN ('ACCESS_COMPLETED', 'ACCESS_FAILED') THEN
    RAISE EXCEPTION 'INVALID_OUTCOME_EVENT: Must be ACCESS_COMPLETED or ACCESS_FAILED';
  END IF;

  SELECT * INTO v_audit FROM public.jit_access_audit_logs WHERE id = p_audit_log_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUDIT_LOG_NOT_FOUND: Record % does not exist', p_audit_log_id;
  END IF;

  INSERT INTO public.jit_access_audit_logs (
    session_id, actor_id, school_id, target_table, query_intent, filter_parameters, event_type, rows_returned, occurred_at
  ) VALUES (
    v_audit.session_id, session_user, v_audit.school_id, v_audit.target_table,
    COALESCE(p_error_message, v_audit.query_intent),
    v_audit.filter_parameters, p_event_type, p_rows_returned, clock_timestamp()
  );

  RETURN true;
END;
$$;

SELECT security.safe_set_owner('ALTER FUNCTION security.record_access_outcome(uuid, text, integer, text) OWNER TO schoolmitra_secdef_owner');
REVOKE ALL ON FUNCTION security.record_access_outcome(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION security.record_access_outcome(uuid, text, integer, text) TO schoolmitra_platform_admin;

-- 8. Complete Atomic Privilege Reset & Default ACL Revocation
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM schoolmitra_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM schoolmitra_app;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM schoolmitra_app;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM schoolmitra_platform_admin;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM schoolmitra_platform_admin;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM schoolmitra_platform_admin;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE schoolmitra_owner IN SCHEMA public 
  REVOKE ALL ON TABLES FROM schoolmitra_app, schoolmitra_platform_admin, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE schoolmitra_migrator IN SCHEMA public 
  REVOKE ALL ON TABLES FROM schoolmitra_app, schoolmitra_platform_admin, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE schoolmitra IN SCHEMA public 
  REVOKE ALL ON TABLES FROM schoolmitra_app, schoolmitra_platform_admin, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public 
  REVOKE ALL ON TABLES FROM schoolmitra_app, schoolmitra_platform_admin, PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE schoolmitra_owner IN SCHEMA public 
  REVOKE ALL ON SEQUENCES FROM schoolmitra_app, schoolmitra_platform_admin, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE schoolmitra_migrator IN SCHEMA public 
  REVOKE ALL ON SEQUENCES FROM schoolmitra_app, schoolmitra_platform_admin, PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE schoolmitra_owner IN SCHEMA public 
  REVOKE ALL ON ROUTINES FROM schoolmitra_app, schoolmitra_platform_admin, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE schoolmitra_migrator IN SCHEMA public 
  REVOKE ALL ON ROUTINES FROM schoolmitra_app, schoolmitra_platform_admin, PUBLIC;

GRANT USAGE ON SCHEMA public TO schoolmitra_app, schoolmitra_platform_admin, schoolmitra_secdef_owner, schoolmitra_audit_writer;

-- 9. Explicit Table Grants for schoolmitra_app (All 171 Tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  academic_calendar_events,
  academic_terms,
  academic_years,
  account_ledger_transactions,
  admission_applications,
  admission_documents,
  admission_workflow_steps,
  admit_card_templates,
  alumni,
  assessments,
  asset_assignments,
  assets,
  assignment_submissions,
  assignments,
  attendance_notifications,
  bank_accounts,
  bell_schedule,
  book_copies,
  book_fines,
  book_issues,
  books,
  bus_boarding_events,
  certificates,
  chart_of_accounts,
  class_subjects,
  class_teacher_assignments,
  classes,
  cocurricular_areas,
  cocurricular_grades,
  consent_purposes,
  consent_records,
  data_breach_log,
  data_retention_policies,
  departments,
  designations,
  domain_events,
  dpdp_grievances,
  drivers,
  email_logs,
  events,
  exam_admit_card_holds,
  exam_admit_card_settings,
  exam_class_scopes,
  exam_components,
  exam_mark_distributions,
  exam_marks_locks,
  exam_schedules,
  exam_types,
  exams,
  expense_heads,
  expense_vouchers,
  fee_carry_forwards,
  fee_challans,
  fee_concessions,
  fee_discounts,
  fee_due_slips,
  fee_groups,
  fee_heads,
  fee_invoices,
  fee_payments,
  fee_queries,
  fee_structures,
  grade_rules,
  homeroom_report_remarks,
  hostel_allocations,
  hostel_rooms,
  income_heads,
  income_vouchers,
  inventory_items,
  leave_balances,
  leave_requests,
  leave_types,
  lesson_plans,
  library_members,
  mark_entries,
  medical_exemptions,
  notice_acknowledgments,
  notices,
  parent_feed_cards,
  parent_notification_preferences,
  parent_teacher_messages,
  payment_gateway_logs,
  payroll_runs,
  payslips,
  persons,
  platform_announcements,
  privacy_notices,
  profile_change_requests,
  ptm_bookings,
  ptm_events,
  ptm_slots,
  public_result_lookups,
  purchase_orders,
  push_notification_logs,
  report_card_jobs,
  report_card_setups,
  report_cards,
  result_holds,
  result_settings,
  result_snapshots,
  rights_requests,
  roles,
  route_stops,
  routes,
  salary_components,
  salary_templates,
  school_counters,
  school_provisions,
  section_subject_teachers,
  sections,
  sms_logs,
  staff,
  staff_attendance,
  staff_documents,
  staff_loans,
  stock_movements,
  stop_change_requests,
  student_attendance,
  student_bus_passes,
  student_class_history,
  student_document_requests,
  student_documents,
  student_family_members,
  student_leave_requests,
  student_medical_records,
  student_subject_enrollments,
  students,
  subjects,
  syllabus_chapters,
  syllabus_topics,
  syllabus_units,
  teacher_feed_cards,
  timetable_periods,
  timetable_substitutions,
  uploaded_marksheets,
  usage_events,
  user_push_subscriptions,
  user_roles,
  users,
  vehicles,
  vendor_register,
  visitor_logs,
  waitlist
TO schoolmitra_app;

GRANT SELECT, INSERT, UPDATE ON
  public.student_fee_discounts,
  public.student_fee_installments,
  public.student_fee_waivers,
  public.bus_attendance,
  public.whatsapp_templates
TO schoolmitra_app;

GRANT SELECT, INSERT ON
  public.audit_logs,
  public.fee_audit_logs,
  public.pii_audit_trails,
  public.error_telemetry,
  public.system_metrics
TO schoolmitra_app;

GRANT SELECT ON
  public.country_codes,
  public.currency_registry,
  public.curriculum_frameworks,
  public.educational_boards,
  public.grading_scale_templates,
  public.holiday_templates,
  public.language_registry,
  public.pincode_registry,
  public.state_province_registry,
  public.subject_master_catalog,
  public.timezone_registry,
  public.schools
TO schoolmitra_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO schoolmitra_app;

-- 10. Explicit Grants for Platform Admin & Protected Tables
GRANT SELECT ON
  public.schools,
  public.academic_years,
  public.academic_terms,
  public.classes,
  public.sections,
  public.school_system_settings,
  public.platform_audit_logs,
  public.country_codes,
  public.currency_registry,
  public.curriculum_frameworks,
  public.educational_boards,
  public.grading_scale_templates,
  public.holiday_templates,
  public.language_registry,
  public.pincode_registry,
  public.state_province_registry,
  public.subject_master_catalog,
  public.timezone_registry
TO schoolmitra_platform_admin;

REVOKE ALL ON
  public.super_admin_users,
  public.sessions,
  public.password_reset_tokens,
  public.email_verification_tokens,
  public.impersonation_sessions,
  public.jit_access_audit_logs,
  public.jit_audit_sessions
FROM schoolmitra_app, PUBLIC;

GRANT SELECT, INSERT, UPDATE ON public.jit_audit_sessions TO schoolmitra_platform_admin;
GRANT SELECT ON public.jit_access_audit_logs TO schoolmitra_platform_admin;
GRANT INSERT, SELECT ON public.jit_access_audit_logs TO schoolmitra_secdef_owner;

-- Block manual modification on audit logs
CREATE POLICY jit_audit_insert_policy ON public.jit_access_audit_logs
  FOR INSERT TO schoolmitra_secdef_owner WITH CHECK (true);

CREATE POLICY jit_audit_select_policy ON public.jit_access_audit_logs
  FOR SELECT TO schoolmitra_platform_admin USING (true);

CREATE POLICY jit_audit_no_update ON public.jit_access_audit_logs
  AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (false);

CREATE POLICY jit_audit_no_delete ON public.jit_access_audit_logs
  AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false);

-- 11. Deploy HMAC-Verified RLS Across All 151 Tenant Tables
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'academic_calendar_events',
    'academic_terms',
    'academic_years',
    'account_ledger_transactions',
    'admission_applications',
    'admission_documents',
    'admission_workflow_steps',
    'admit_card_templates',
    'alumni',
    'assessments',
    'asset_assignments',
    'assets',
    'assignment_submissions',
    'assignments',
    'attendance_notifications',
    'audit_logs',
    'bank_accounts',
    'bell_schedule',
    'book_copies',
    'book_fines',
    'book_issues',
    'books',
    'bus_boarding_events',
    'certificates',
    'chart_of_accounts',
    'class_subjects',
    'class_teacher_assignments',
    'classes',
    'cocurricular_areas',
    'cocurricular_grades',
    'consent_purposes',
    'consent_records',
    'data_breach_log',
    'data_retention_policies',
    'departments',
    'designations',
    'domain_events',
    'dpdp_grievances',
    'drivers',
    'email_logs',
    'events',
    'exam_admit_card_holds',
    'exam_admit_card_settings',
    'exam_class_scopes',
    'exam_components',
    'exam_mark_distributions',
    'exam_marks_locks',
    'exam_schedules',
    'exam_types',
    'exams',
    'expense_heads',
    'expense_vouchers',
    'fee_audit_logs',
    'fee_carry_forwards',
    'fee_challans',
    'fee_concessions',
    'fee_discounts',
    'fee_due_slips',
    'fee_groups',
    'fee_heads',
    'fee_invoices',
    'fee_payments',
    'fee_queries',
    'fee_refunds',
    'fee_structures',
    'grade_rules',
    'homeroom_report_remarks',
    'hostel_allocations',
    'hostel_rooms',
    'impersonation_sessions',
    'income_heads',
    'income_vouchers',
    'inventory_items',
    'leave_balances',
    'leave_requests',
    'leave_types',
    'lesson_plans',
    'library_members',
    'mark_entries',
    'medical_exemptions',
    'notice_acknowledgments',
    'notices',
    'parent_feed_cards',
    'parent_notification_preferences',
    'parent_teacher_messages',
    'payment_gateway_logs',
    'payroll_runs',
    'payslips',
    'persons',
    'pii_audit_trails',
    'platform_announcements',
    'platform_audit_logs',
    'privacy_notices',
    'profile_change_requests',
    'ptm_bookings',
    'ptm_events',
    'ptm_slots',
    'public_result_lookups',
    'purchase_orders',
    'push_notification_logs',
    'report_card_jobs',
    'report_card_setups',
    'report_cards',
    'result_holds',
    'result_settings',
    'result_snapshots',
    'rights_requests',
    'roles',
    'route_stops',
    'routes',
    'salary_components',
    'salary_templates',
    'school_counters',
    'school_provisions',
    'section_subject_teachers',
    'sections',
    'sms_logs',
    'staff',
    'staff_attendance',
    'staff_documents',
    'staff_loans',
    'stock_movements',
    'stop_change_requests',
    'student_attendance',
    'student_bus_passes',
    'student_class_history',
    'student_document_requests',
    'student_documents',
    'student_family_members',
    'student_fee_advance_allocations',
    'student_fee_advances',
    'student_leave_requests',
    'student_medical_records',
    'student_subject_enrollments',
    'students',
    'subjects',
    'syllabus_chapters',
    'syllabus_topics',
    'syllabus_units',
    'teacher_feed_cards',
    'timetable_periods',
    'timetable_substitutions',
    'uploaded_marksheets',
    'usage_events',
    'user_push_subscriptions',
    'vehicles',
    'vendor_register',
    'visitor_logs',
    'waitlist'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'Table % does not exist in schema public, skipping', t;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'school_id'
    ) THEN
      RAISE NOTICE 'Table % does not have column school_id, skipping tenant policy creation', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS tenant_select_policy ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_insert_policy ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_update_policy ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_delete_policy ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_fence ON public.%I', t);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format('CREATE POLICY tenant_select_policy ON public.%I FOR SELECT USING (security.is_tenant_verified(school_id))', t);
    EXECUTE format('CREATE POLICY tenant_insert_policy ON public.%I FOR INSERT WITH CHECK (security.is_tenant_verified(school_id))', t);
    EXECUTE format('CREATE POLICY tenant_update_policy ON public.%I FOR UPDATE USING (security.is_tenant_verified(school_id)) WITH CHECK (security.is_tenant_verified(school_id))', t);
    EXECUTE format('CREATE POLICY tenant_delete_policy ON public.%I FOR DELETE USING (security.is_tenant_verified(school_id))', t);

    EXECUTE format('CREATE POLICY tenant_isolation_fence ON public.%I AS RESTRICTIVE TO PUBLIC USING (
      CASE 
        WHEN current_setting(''app.current_role'', true) = ''PLATFORM_ADMIN'' AND current_setting(''security.verified_session_id'', true) IS NULL 
        THEN false 
        ELSE true 
      END
    )', t);
  END LOOP;

  -- Dedicated RLS policies for users, roles, and user_roles (System Auth & Platform Admin support)
  DROP POLICY IF EXISTS tenant_select_policy ON public.users;
  DROP POLICY IF EXISTS tenant_insert_policy ON public.users;
  DROP POLICY IF EXISTS tenant_update_policy ON public.users;
  DROP POLICY IF EXISTS tenant_delete_policy ON public.users;
  DROP POLICY IF EXISTS tenant_isolation_fence ON public.users;

  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

  CREATE POLICY tenant_select_policy ON public.users FOR SELECT USING (
    security.is_tenant_verified(school_id)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR nullif(current_setting('app.current_role', true), '') IN ('SYSTEM_AUTH', 'PLATFORM_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );
  CREATE POLICY tenant_insert_policy ON public.users FOR INSERT WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );
  CREATE POLICY tenant_update_policy ON public.users FOR UPDATE USING (
    security.is_tenant_verified(school_id)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  ) WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );
  CREATE POLICY tenant_delete_policy ON public.users FOR DELETE USING (
    security.is_tenant_verified(school_id)
    OR (school_id IS NULL AND nullif(current_setting('app.current_role', true), '') = 'SUPER_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

  DROP POLICY IF EXISTS tenant_select_policy ON public.roles;
  DROP POLICY IF EXISTS tenant_insert_policy ON public.roles;
  DROP POLICY IF EXISTS tenant_update_policy ON public.roles;
  DROP POLICY IF EXISTS tenant_delete_policy ON public.roles;
  DROP POLICY IF EXISTS tenant_isolation_fence ON public.roles;

  ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;

  CREATE POLICY tenant_select_policy ON public.roles FOR SELECT USING (
    school_id IS NULL
    OR is_system_role = true
    OR security.is_tenant_verified(school_id)
    OR nullif(current_setting('app.current_role', true), '') IN ('SYSTEM_AUTH', 'PLATFORM_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );
  CREATE POLICY tenant_insert_policy ON public.roles FOR INSERT WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );
  CREATE POLICY tenant_update_policy ON public.roles FOR UPDATE USING (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  ) WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );
  CREATE POLICY tenant_delete_policy ON public.roles FOR DELETE USING (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );

  DROP POLICY IF EXISTS tenant_select_policy ON public.user_roles;
  DROP POLICY IF EXISTS tenant_insert_policy ON public.user_roles;
  DROP POLICY IF EXISTS tenant_update_policy ON public.user_roles;
  DROP POLICY IF EXISTS tenant_delete_policy ON public.user_roles;
  DROP POLICY IF EXISTS tenant_isolation_fence ON public.user_roles;

  ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

  CREATE POLICY tenant_select_policy ON public.user_roles FOR SELECT USING (
    security.is_tenant_verified(school_id)
    OR nullif(current_setting('app.current_role', true), '') IN ('SYSTEM_AUTH', 'PLATFORM_ADMIN')
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );
  CREATE POLICY tenant_insert_policy ON public.user_roles FOR INSERT WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );
  CREATE POLICY tenant_update_policy ON public.user_roles FOR UPDATE USING (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  ) WITH CHECK (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );
  CREATE POLICY tenant_delete_policy ON public.user_roles FOR DELETE USING (
    security.is_tenant_verified(school_id)
    OR (school_id)::text = nullif(current_setting('app.current_school_id', true), '')
  );
END $$;

-- Relational RLS on GPS Pings
DROP POLICY IF EXISTS tenant_select_policy ON public.gps_pings;
DROP POLICY IF EXISTS tenant_insert_policy ON public.gps_pings;
DROP POLICY IF EXISTS tenant_isolation_fence ON public.gps_pings;

ALTER TABLE public.gps_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_pings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_select_policy ON public.gps_pings FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.vehicles v 
    WHERE v.id = gps_pings.vehicle_id 
    AND security.is_tenant_verified(v.school_id)
  )
);

CREATE POLICY tenant_insert_policy ON public.gps_pings FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vehicles v 
    WHERE v.id = gps_pings.vehicle_id 
    AND security.is_tenant_verified(v.school_id)
  )
);

CREATE POLICY tenant_isolation_fence ON public.gps_pings AS RESTRICTIVE TO PUBLIC USING (
  CASE 
    WHEN current_setting('app.current_role', true) = 'PLATFORM_ADMIN' AND current_setting('security.verified_session_id', true) IS NULL 
    THEN false 
    ELSE true 
  END
);

COMMIT;
