-- Migration: 0055_school_provisions.sql
-- Description: School digital twin configuration provisioning guard table and indexes (Sprint S20)

CREATE TABLE IF NOT EXISTS "school_provisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"blueprint_version" text DEFAULT '1.0.0' NOT NULL,
	"provisioned_by" uuid NOT NULL,
	"provisioned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'COMPLETED' NOT NULL,
	"entity_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	CONSTRAINT "sp_school_unique" UNIQUE("school_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "school_provisions" ADD CONSTRAINT "school_provisions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "school_provisions" ADD CONSTRAINT "school_provisions_profile_id_global_template_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "global_template_profiles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "school_provisions" ADD CONSTRAINT "school_provisions_provisioned_by_super_admin_users_id_fk" FOREIGN KEY ("provisioned_by") REFERENCES "super_admin_users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sp_school_idx" ON "school_provisions" ("school_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sp_profile_idx" ON "school_provisions" ("profile_id");
