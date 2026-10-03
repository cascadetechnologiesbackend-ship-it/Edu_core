-- Add blood_group and consent_preferences to admission_applications
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "blood_group" "blood_group";
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "consent_preferences" jsonb;
