DO $$ BEGIN
 CREATE TYPE "holiday_type_template" AS ENUM('NATIONAL', 'REGIONAL', 'FESTIVAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "school_type" AS ENUM('PRIMARY', 'SECONDARY', 'SENIOR_SECONDARY', 'INTEGRATED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "role_name" ADD VALUE 'DRIVER';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"user_id" uuid NOT NULL,
	"name_encrypted" text NOT NULL,
	"mobile_encrypted" text NOT NULL,
	"licence_encrypted" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "drivers_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_template_academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_month" integer NOT NULL,
	"end_month" integer NOT NULL,
	"terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_template_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"numeric_level" integer NOT NULL,
	"grade_level" "grade_level" NOT NULL,
	"streams" text[] DEFAULT '{}'::text[] NOT NULL,
	"default_sections" text[] DEFAULT '{"A"}'::text[] NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_template_fee_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"head_type" "fee_head_type" NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"frequency" "fee_term" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_template_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_fixed_annual" boolean DEFAULT true NOT NULL,
	"month" integer NOT NULL,
	"day" integer NOT NULL,
	"holiday_type" "holiday_type_template" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_template_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board" "board" NOT NULL,
	"school_type" "school_type" NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "gtp_board_type_unique" UNIQUE("board","school_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_template_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"role_name" "role_name" NOT NULL,
	"display_name" text NOT NULL,
	"default_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gtr_profile_role_unique" UNIQUE("profile_id","role_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_template_salary_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"grade_name" text NOT NULL,
	"basic_salary" integer NOT NULL,
	"hra_percent" integer DEFAULT 10 NOT NULL,
	"da_percent" integer DEFAULT 0 NOT NULL,
	"pf_percent" integer DEFAULT 12 NOT NULL,
	"other_allowances" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_template_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"class_template_id" uuid,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"subject_type" "subject_type" NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"weekly_periods" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "global_template_timetable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"period_number" integer NOT NULL,
	"period_type" "period_type" NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "impersonation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"super_admin_id" uuid NOT NULL,
	"target_school_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"scoped_token_hash" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"ip_address" text,
	CONSTRAINT "impersonation_sessions_scoped_token_hash_unique" UNIQUE("scoped_token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_announcement_reads" (
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "par_pk" UNIQUE("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"sent_by" uuid NOT NULL,
	"target_school_ids" uuid[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "driver_name_encrypted" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "driver_licence_encrypted" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "driver_mobile_encrypted" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD COLUMN "super_admin_email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD COLUMN "entity_id" text;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD COLUMN "before_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD COLUMN IF NOT EXISTS "after_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "school_type" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "provisioning_manifest" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "blood_group" "blood_group";--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "opt_in_transport" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "opt_in_hostel" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "consent_preferences" jsonb;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "opt_in_transport" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "opt_in_hostel" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "code" varchar(10);--> statement-breakpoint
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "priority" integer DEFAULT 99 NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "category" varchar(30) DEFAULT 'RECURRING' NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "discount_eligible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "late_fine_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_heads" ADD COLUMN IF NOT EXISTS "is_refundable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "designations" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "emergency_contact_encrypted" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "relieving_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "separation_type" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "separation_reason" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drivers_school_idx" ON "drivers" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drivers_vehicle_idx" ON "drivers" ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drivers_user_idx" ON "drivers" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gtay_profile_idx" ON "global_template_academic_years" ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gtc_profile_idx" ON "global_template_classes" ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gtc_sort_idx" ON "global_template_classes" ("profile_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gtfh_profile_idx" ON "global_template_fee_heads" ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gth_profile_idx" ON "global_template_holidays" ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gtp_board_idx" ON "global_template_profiles" ("board");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gtr_profile_idx" ON "global_template_roles" ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gtsg_profile_idx" ON "global_template_salary_grades" ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gts_profile_idx" ON "global_template_subjects" ("profile_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gts_class_template_idx" ON "global_template_subjects" ("class_template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gtt_profile_day_idx" ON "global_template_timetable" ("profile_id","day_of_week");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "is_super_admin_idx" ON "impersonation_sessions" ("super_admin_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "is_target_school_idx" ON "impersonation_sessions" ("target_school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "is_active_idx" ON "impersonation_sessions" ("super_admin_id","ended_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "is_token_idx" ON "impersonation_sessions" ("scoped_token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "par_user_idx" ON "platform_announcement_reads" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pa_created_at_idx" ON "platform_announcements" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pal_super_admin_idx" ON "platform_audit_logs" ("super_admin_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pal_target_school_idx" ON "platform_audit_logs" ("target_school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pal_entity_type_idx" ON "platform_audit_logs" ("entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pal_date_idx" ON "platform_audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schools_slug_idx" ON "schools" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schools_status_idx" ON "schools" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fee_structures_unique_slot_idx" ON "fee_structures" ("school_id","academic_year_id","class_id","fee_head_id","term");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "departments_school_idx" ON "departments" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "designations_school_idx" ON "designations" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "designations_dept_idx" ON "designations" ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_user_idx" ON "staff" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_dept_idx" ON "staff" ("department_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_desig_idx" ON "staff" ("designation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_active_idx" ON "staff" ("school_id","is_active");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drivers" ADD CONSTRAINT "drivers_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "global_template_academic_years" ADD CONSTRAINT "global_template_academic_years_profile_id_global_template_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "global_template_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "global_template_classes" ADD CONSTRAINT "global_template_classes_profile_id_global_template_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "global_template_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "global_template_fee_heads" ADD CONSTRAINT "global_template_fee_heads_profile_id_global_template_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "global_template_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "global_template_holidays" ADD CONSTRAINT "global_template_holidays_profile_id_global_template_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "global_template_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "global_template_profiles" ADD CONSTRAINT "global_template_profiles_created_by_super_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "super_admin_users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "global_template_roles" ADD CONSTRAINT "global_template_roles_profile_id_global_template_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "global_template_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "global_template_salary_grades" ADD CONSTRAINT "global_template_salary_grades_profile_id_global_template_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "global_template_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "global_template_subjects" ADD CONSTRAINT "global_template_subjects_profile_id_global_template_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "global_template_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "global_template_subjects" ADD CONSTRAINT "global_template_subjects_class_template_id_global_template_classes_id_fk" FOREIGN KEY ("class_template_id") REFERENCES "global_template_classes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "global_template_timetable" ADD CONSTRAINT "global_template_timetable_profile_id_global_template_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "global_template_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_super_admin_id_super_admin_users_id_fk" FOREIGN KEY ("super_admin_id") REFERENCES "super_admin_users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_school_id_schools_id_fk" FOREIGN KEY ("target_school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_announcement_reads" ADD CONSTRAINT "platform_announcement_reads_announcement_id_platform_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "platform_announcements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_announcement_reads" ADD CONSTRAINT "platform_announcement_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_announcements" ADD CONSTRAINT "platform_announcements_sent_by_super_admin_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "super_admin_users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "schools" ADD CONSTRAINT "schools_slug_unique" UNIQUE("slug");
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "designations" ADD CONSTRAINT "designations_school_name_unique" UNIQUE("school_id","name");
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN null;
END $$;