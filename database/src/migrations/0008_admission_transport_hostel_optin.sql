-- Add opt-in columns for transport and hostel to admission_applications and students tables
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "opt_in_transport" boolean NOT NULL DEFAULT false;
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "opt_in_hostel" boolean NOT NULL DEFAULT false;

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "opt_in_transport" boolean NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "opt_in_hostel" boolean NOT NULL DEFAULT false;
