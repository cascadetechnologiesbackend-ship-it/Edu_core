-- ============================================================================
-- MIGRATION 0069: RESTORE SCHOOL PROVISIONING GRANTS FOR schoolmitra_app
-- Target: Allow /onboard and Super Admin provisioning flows (running on
--         schoolmitra_app pool) to INSERT and UPDATE public.schools.
-- ============================================================================

BEGIN;

GRANT SELECT, INSERT, UPDATE ON public.schools TO schoolmitra_app;

COMMIT;
