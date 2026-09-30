DO $$ BEGIN
 CREATE TYPE "person_type" AS ENUM('STUDENT', 'STAFF', 'PARENT', 'DRIVER', 'VENDOR', 'ALUMNI', 'VISITOR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"primary_type" "person_type" NOT NULL,
	"first_name_encrypted" text NOT NULL,
	"middle_name_encrypted" text,
	"last_name_encrypted" text NOT NULL,
	"first_name_search_hash" text,
	"last_name_search_hash" text,
	"gender" text NOT NULL,
	"date_of_birth" timestamp with time zone,
	"primary_email_encrypted" text,
	"primary_mobile_encrypted" text,
	"aadhaar_last4" text,
	"photo_s3_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "persons_school_idx" ON "persons" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "persons_search_hash_idx" ON "persons" ("first_name_search_hash","last_name_search_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "persons_type_idx" ON "persons" ("school_id","primary_type");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "persons" ADD CONSTRAINT "persons_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
