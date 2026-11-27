-- ============================================================================
-- MIGRATION 0068: RESTORE AUTH & SESSION TABLE GRANTS FOR schoolmitra_app
-- Target: Allow Next.js auth pool (schoolmitra_app) to query super_admin_users,
--         sessions, password_reset_tokens, email_verification_tokens,
--         impersonation_sessions, and platform_audit_logs.
-- ============================================================================

BEGIN;

GRANT SELECT, UPDATE ON public.super_admin_users TO schoolmitra_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO schoolmitra_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_tokens TO schoolmitra_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_verification_tokens TO schoolmitra_app;
GRANT SELECT, INSERT, UPDATE ON public.impersonation_sessions TO schoolmitra_app;
GRANT SELECT, INSERT ON public.platform_audit_logs TO schoolmitra_app;

COMMIT;
