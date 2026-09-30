DO $$ BEGIN
 CREATE TYPE "audit_action" AS ENUM('READ', 'WRITE', 'DELETE', 'EXPORT', 'CONSENT_GRANT', 'CONSENT_WITHDRAW', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "board" AS ENUM('CBSE', 'ICSE', 'STATE_BOARD', 'IGCSE', 'IB');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "role_name" AS ENUM('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'PARENT', 'STUDENT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "breach_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "breach_status" AS ENUM('DETECTED', 'CONTAINED', 'ASSESSED', 'BOARD_NOTIFIED', 'PARENTS_NOTIFIED', 'CLOSED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "consent_method" AS ENUM('web_form', 'app', 'physical_scan');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "rights_request_status" AS ENUM('SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'ESCALATED_TO_DPO');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "rights_request_type" AS ENUM('ACCESS', 'CORRECTION', 'ERASURE', 'GRIEVANCE', 'NOMINATION');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "admission_doc_type" AS ENUM('BIRTH_CERTIFICATE', 'AADHAAR_PHOTO_MASKED', 'PREVIOUS_TC', 'VACCINATION_RECORD', 'PASSPORT_PHOTO', 'CASTE_CERTIFICATE', 'INCOME_CERTIFICATE', 'DISABILITY_CERTIFICATE', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "admission_status" AS ENUM('APPLIED', 'SCREENING', 'ENTRANCE_TEST', 'INTERVIEW', 'OFFER_LETTER', 'ENROLLED', 'REJECTED', 'WAITLISTED', 'WITHDRAWN');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "blood_group" AS ENUM('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "category" AS ENUM('GENERAL', 'SC', 'ST', 'OBC', 'EWS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "family_relation" AS ENUM('FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'GRANDPARENT');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "gender" AS ENUM('MALE', 'FEMALE', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "grade_level" AS ENUM('NURSERY', 'LKG', 'UKG', 'CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4', 'CLASS_5', 'CLASS_6', 'CLASS_7', 'CLASS_8', 'CLASS_9', 'CLASS_10');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "assignment_status" AS ENUM('DRAFT', 'PUBLISHED', 'CLOSED', 'GRADED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "day_of_week" AS ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "period_type" AS ENUM('REGULAR', 'ASSEMBLY', 'BREAK', 'LUNCH', 'LAB', 'PT', 'LIBRARY', 'FREE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "subject_type" AS ENUM('THEORY', 'PRACTICAL', 'CO_SCHOLASTIC', 'LANGUAGE', 'ACTIVITY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "attendance_status" AS ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'HOLIDAY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "exam_type_enum" AS ENUM('UNIT_TEST', 'HALF_YEARLY', 'ANNUAL', 'PRACTICAL', 'INTERNAL_ASSESSMENT', 'PRE_BOARD', 'ACTIVITY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "concession_type" AS ENUM('STAFF_WARD', 'SIBLING', 'RTE_FREE', 'MERIT_SCHOLARSHIP', 'CUSTOM', 'MANAGEMENT_QUOTA');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "fee_head_type" AS ENUM('TUITION', 'TRANSPORT', 'LIBRARY', 'LAB', 'SPORTS', 'HOSTEL', 'ACTIVITY', 'ADMISSION', 'EXAM', 'MISCELLANEOUS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "fee_invoice_status" AS ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "fee_term" AS ENUM('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'ONE_TIME');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "late_fee_type" AS ENUM('FLAT', 'PERCENTAGE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "payment_method" AS ENUM('CASH', 'CHEQUE', 'ONLINE', 'DD', 'NEFT', 'RTGS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "contract_type" AS ENUM('PERMANENT', 'PROBATION', 'CONTRACTUAL', 'PART_TIME', 'GUEST_FACULTY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "leave_status" AS ENUM('PENDING', 'HOD_APPROVED', 'HR_APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "leave_type_hr" AS ENUM('CL', 'EL', 'ML', 'SL', 'LWP', 'MATERNITY', 'PATERNITY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "notice_audience_type" AS ENUM('ALL', 'PARENTS', 'TEACHERS', 'STUDENTS', 'STAFF', 'CLASS', 'SECTION');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "room_type" AS ENUM('AC_SINGLE', 'AC_DOUBLE', 'AC_DORMITORY', 'NON_AC_SINGLE', 'NON_AC_DOUBLE', 'NON_AC_DORMITORY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"label" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "academic_years_school_label_unique" UNIQUE("school_id","label")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_email" text NOT NULL,
	"user_role" text NOT NULL,
	"school_id" uuid NOT NULL,
	"action" "audit_action" NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text,
	"purpose_id" text,
	"ip_address" text NOT NULL,
	"user_agent" text NOT NULL,
	"metadata" jsonb,
	"legal_hold" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_unique" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"name" "role_name" NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"board" "board" NOT NULL,
	"udise_code" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"principal_name" text NOT NULL,
	"logo_s3_key" text,
	"established_year" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"feature_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subscription_tier" text DEFAULT 'STANDARD' NOT NULL,
	"subscription_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "schools_udise_unique" UNIQUE("udise_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"refresh_token" text,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sessions_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_unique" UNIQUE("user_id","role_id","school_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid,
	"email" text NOT NULL,
	"mobile_encrypted" text,
	"password_hash" text,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"is_mobile_verified" boolean DEFAULT false NOT NULL,
	"password_changed_at" timestamp with time zone,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"prefers_dark_mode" boolean DEFAULT false NOT NULL,
	"language_preference" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consent_purposes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose_id" text NOT NULL,
	"school_id" uuid,
	"label_en" text NOT NULL,
	"label_hi" text NOT NULL,
	"description_en" text NOT NULL,
	"description_hi" text NOT NULL,
	"mandatory" boolean DEFAULT false NOT NULL,
	"legal_basis" text NOT NULL,
	"retention_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_purposes_school_purpose_unique" UNIQUE("school_id","purpose_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"parent_user_id" uuid NOT NULL,
	"purpose_id" text NOT NULL,
	"privacy_notice_version" text NOT NULL,
	"granted" boolean NOT NULL,
	"method" "consent_method" NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"otp_verified" boolean DEFAULT false NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"withdrawal_reason" text,
	"processing_halted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_breach_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"incident_reference" text NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"reported_by_user_id" uuid NOT NULL,
	"severity" "breach_severity" NOT NULL,
	"status" "breach_status" DEFAULT 'DETECTED' NOT NULL,
	"description" text NOT NULL,
	"affected_records_count" integer DEFAULT 0 NOT NULL,
	"affected_data_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"containment_actions" text,
	"board_notification_deadline" timestamp with time zone NOT NULL,
	"board_notified_at" timestamp with time zone,
	"parents_notified_at" timestamp with time zone,
	"affected_parent_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_breach_log_ref_unique" UNIQUE("incident_reference")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"table_name" text NOT NULL,
	"purpose_id" text NOT NULL,
	"retention_days" integer NOT NULL,
	"description" text NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"records_deleted_last_run" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dpdp_grievances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" text NOT NULL,
	"school_id" uuid NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"status" "rights_request_status" DEFAULT 'SUBMITTED' NOT NULL,
	"resolution_details" text,
	"resolved_at" timestamp with time zone,
	"due_at" timestamp with time zone NOT NULL,
	"escalated_to_dpo_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dpdp_grievances_ticket_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "privacy_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"version" text NOT NULL,
	"title_en" text NOT NULL,
	"title_hi" text NOT NULL,
	"content_en" text NOT NULL,
	"content_hi" text NOT NULL,
	"published_at" timestamp with time zone,
	"is_active" boolean DEFAULT false NOT NULL,
	"changed_purpose_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_notices_school_version_unique" UNIQUE("school_id","version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rights_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_number" text NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"request_type" "rights_request_type" NOT NULL,
	"description" text NOT NULL,
	"status" "rights_request_status" DEFAULT 'SUBMITTED' NOT NULL,
	"nominee_details_encrypted" text,
	"response_details" text,
	"responded_at" timestamp with time zone,
	"responded_by_user_id" uuid,
	"due_at" timestamp with time zone NOT NULL,
	"escalated_to_dpo_at" timestamp with time zone,
	"data_export_s3_key" text,
	"data_export_ready_at" timestamp with time zone,
	"data_export_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rights_requests_ticket_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_register" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"vendor_name" text NOT NULL,
	"vendor_type" text NOT NULL,
	"data_shared" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"purpose_of_sharing" text NOT NULL,
	"dpa_status" text DEFAULT 'PENDING' NOT NULL,
	"dpa_signed_at" timestamp with time zone,
	"dpa_expires_at" timestamp with time zone,
	"data_retention_by_vendor" text,
	"sub_processors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contact_email" text,
	"privacy_policy_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admission_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_number" text NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"applicant_name_encrypted" text NOT NULL,
	"date_of_birth" timestamp with time zone NOT NULL,
	"gender" "gender" NOT NULL,
	"category" "category" NOT NULL,
	"grade_applied_for" "grade_level" NOT NULL,
	"previous_school" text,
	"father_name_encrypted" text NOT NULL,
	"mother_name_encrypted" text NOT NULL,
	"guardian_name_encrypted" text,
	"primary_contact_mobile_encrypted" text NOT NULL,
	"primary_contact_email_encrypted" text NOT NULL,
	"address_encrypted" text NOT NULL,
	"pincode" text NOT NULL,
	"status" "admission_status" DEFAULT 'APPLIED' NOT NULL,
	"current_workflow_step" integer DEFAULT 1 NOT NULL,
	"assigned_to_user_id" uuid,
	"is_rte_applicant" boolean DEFAULT false NOT NULL,
	"has_sibling_in_school" boolean DEFAULT false NOT NULL,
	"sibling_student_id" uuid,
	"is_staff_ward" boolean DEFAULT false NOT NULL,
	"rejection_reason" text,
	"rejected_at" timestamp with time zone,
	"enrolled_student_id" uuid,
	"enrolled_at" timestamp with time zone,
	"consent_recorded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "admission_applications_number_unique" UNIQUE("school_id","application_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admission_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"document_type" "admission_doc_type" NOT NULL,
	"s3_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admission_workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"step_number" integer NOT NULL,
	"step_name" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"completed_by_id" uuid,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admission_workflow_unique" UNIQUE("application_id","step_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"grade_applied_for" "grade_level" NOT NULL,
	"rank" integer NOT NULL,
	"category" "category" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"offered_at" timestamp with time zone,
	"offer_expires_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alumni" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"graduation_year" text NOT NULL,
	"contact_email_encrypted" text,
	"contact_mobile_encrypted" text,
	"current_institution" text,
	"notes" text,
	"consent_given" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "alumni_student_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_class_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"roll_number" text,
	"promotion_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_class_history_unique" UNIQUE("student_id","academic_year_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"s3_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size_bytes" text NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_family_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"relation" "family_relation" NOT NULL,
	"name_encrypted" text NOT NULL,
	"mobile_encrypted" text,
	"email_encrypted" text,
	"occupation_encrypted" text,
	"aadhaar_last4" text,
	"user_id" uuid,
	"is_emergency_contact" boolean DEFAULT false NOT NULL,
	"is_primary_contact" boolean DEFAULT false NOT NULL,
	"has_consent_authority" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_medical_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"allergies_encrypted" text,
	"disabilities_encrypted" text,
	"current_medications_encrypted" text,
	"medical_conditions_encrypted" text,
	"doctor_name_encrypted" text,
	"doctor_contact_encrypted" text,
	"emergency_notes_encrypted" text,
	"last_updated_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "student_medical_records_student_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"admission_number" text NOT NULL,
	"first_name_encrypted" text NOT NULL,
	"middle_name_encrypted" text,
	"last_name_encrypted" text NOT NULL,
	"first_name_search_hash" text,
	"last_name_search_hash" text,
	"date_of_birth" timestamp with time zone NOT NULL,
	"gender" "gender" NOT NULL,
	"blood_group" "blood_group",
	"category" "category" NOT NULL,
	"mother_tongue" text,
	"religion" text,
	"nationality" text DEFAULT 'Indian' NOT NULL,
	"aadhaar_last4" text,
	"apaar_id" text,
	"photo_s3_key" text,
	"current_class_id" uuid,
	"current_section_id" uuid,
	"roll_number" text,
	"admission_date" timestamp with time zone NOT NULL,
	"admission_application_id" uuid,
	"previous_school" text,
	"rte_applicant" boolean DEFAULT false NOT NULL,
	"user_id" uuid,
	"primary_parent_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"leaving_date" timestamp with time zone,
	"leaving_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "students_admission_number_unique" UNIQUE("school_id","admission_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assignment_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"attachment_s3_key" text,
	"remarks" text,
	"marks_awarded" integer,
	"graded_by_teacher_id" uuid,
	"graded_at" timestamp with time zone,
	"plagiarism_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_submissions_unique" UNIQUE("assignment_id","student_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_subject_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"created_by_teacher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"max_marks" integer,
	"due_date" timestamp with time zone NOT NULL,
	"attachment_s3_key" text,
	"status" "assignment_status" DEFAULT 'DRAFT' NOT NULL,
	"plagiarism_check_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "class_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"assigned_teacher_id" uuid,
	"periods_per_week" integer DEFAULT 5 NOT NULL,
	"is_elective" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_subjects_unique" UNIQUE("class_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"grade_level" "grade_level" NOT NULL,
	"display_name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "classes_school_year_grade_unique" UNIQUE("school_id","academic_year_id","grade_level")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_subject_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"chapter_name" text NOT NULL,
	"ncert_reference" text,
	"objectives" text,
	"planned_date" timestamp with time zone,
	"completed_date" timestamp with time zone,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"teaching_methods" text,
	"resources" text,
	"homework" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 40 NOT NULL,
	"class_teacher_id" uuid,
	"room_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sections_class_section_unique" UNIQUE("class_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_hindi" text,
	"subject_type" "subject_type" NOT NULL,
	"max_marks" integer DEFAULT 100 NOT NULL,
	"passing_marks" integer DEFAULT 33 NOT NULL,
	"board_mapping" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "subjects_school_code_unique" UNIQUE("school_id","code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timetable_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"period_number" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"period_type" "period_type" DEFAULT 'REGULAR' NOT NULL,
	"subject_id" uuid,
	"teacher_id" uuid,
	"room_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "timetable_periods_unique" UNIQUE("section_id","day_of_week","period_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_attendance_id" uuid NOT NULL,
	"parent_user_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"sent_at" timestamp with time zone,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"attendance_date" timestamp with time zone NOT NULL,
	"clock_in" timestamp with time zone,
	"clock_out" timestamp with time zone,
	"status" "attendance_status" NOT NULL,
	"biometric_verified" boolean DEFAULT false NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_attendance_unique" UNIQUE("staff_id","attendance_date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"attendance_date" timestamp with time zone NOT NULL,
	"period_id" uuid,
	"status" "attendance_status" NOT NULL,
	"marked_by_id" uuid NOT NULL,
	"remarks" text,
	"sms_notification_sent" boolean DEFAULT false NOT NULL,
	"sms_notification_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_attendance_unique" UNIQUE("student_id","attendance_date","period_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"certificate_type" text NOT NULL,
	"certificate_number" text NOT NULL,
	"issued_date" timestamp with time zone NOT NULL,
	"issued_by_id" uuid NOT NULL,
	"pdf_s3_key" text,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_number_unique" UNIQUE("school_id","certificate_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exam_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"exam_type" "exam_type_enum" NOT NULL,
	"weightage_percent" numeric(5, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"exam_type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"locked_by_id" uuid,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mark_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"marks_obtained" numeric(7, 2),
	"max_marks" numeric(7, 2) NOT NULL,
	"is_absent" boolean DEFAULT false NOT NULL,
	"grade" text,
	"remarks" text,
	"entered_by_id" uuid NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mark_entries_unique" UNIQUE("exam_id","student_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"grade_data" jsonb NOT NULL,
	"overall_grade" text,
	"rank" integer,
	"attendance_percent" numeric(5, 2),
	"teacher_remarks" text,
	"principal_remarks" text,
	"pdf_s3_key" text,
	"generated_at" timestamp with time zone,
	"generated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_cards_student_exam_unique" UNIQUE("student_id","exam_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fee_concessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"concession_type" "concession_type" NOT NULL,
	"concession_name" text NOT NULL,
	"applies_to" text DEFAULT 'ALL' NOT NULL,
	"discount_percentage" numeric(5, 2),
	"discount_amount" numeric(10, 2),
	"approved_by_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fee_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"head_type" "fee_head_type" NOT NULL,
	"is_taxable" boolean DEFAULT false NOT NULL,
	"gst_percentage" numeric(5, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fee_heads_school_name_unique" UNIQUE("school_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fee_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" text NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"fee_structure_id" uuid,
	"gross_amount" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"late_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"balance_amount" numeric(12, 2) NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" "fee_invoice_status" DEFAULT 'PENDING' NOT NULL,
	"term" "fee_term" NOT NULL,
	"reminder_sent_d7" boolean DEFAULT false NOT NULL,
	"reminder_sent_d15" boolean DEFAULT false NOT NULL,
	"reminder_sent_d30" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "fee_invoices_number_unique" UNIQUE("school_id","invoice_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fee_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_number" text NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"fee_invoice_id" uuid NOT NULL,
	"amount_paid" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"transaction_reference" text,
	"payment_date" timestamp with time zone NOT NULL,
	"collected_by_id" uuid,
	"remarks" text,
	"receipt_s3_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_payments_receipt_unique" UNIQUE("school_id","receipt_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fee_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"fee_payment_id" uuid NOT NULL,
	"refund_amount" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fee_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"fee_head_id" uuid NOT NULL,
	"term" "fee_term" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"late_fee_type" "late_fee_type",
	"late_fee_amount" numeric(10, 2),
	"late_fee_start_after_days" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_gateway_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"fee_invoice_id" uuid,
	"gateway" text DEFAULT 'RAZORPAY' NOT NULL,
	"gateway_order_id" text,
	"gateway_payment_id" text,
	"gateway_signature" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text NOT NULL,
	"webhook_payload" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"hod_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_school_name_unique" UNIQUE("school_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "designations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_teaching" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"total_days" numeric(5, 1) NOT NULL,
	"reason" text NOT NULL,
	"attachment_s3_key" text,
	"status" "leave_status" DEFAULT 'PENDING' NOT NULL,
	"hod_approved_by_id" uuid,
	"hod_approved_at" timestamp with time zone,
	"hr_approved_by_id" uuid,
	"hr_approved_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"code" "leave_type_hr" NOT NULL,
	"name" text NOT NULL,
	"max_days_per_year" integer NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"is_carry_forward" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"month" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"processed_by_id" uuid,
	"approved_by_id" uuid,
	"processed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"total_gross" numeric(14, 2),
	"total_net_pay" numeric(14, 2),
	"total_deductions" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_runs_school_month_unique" UNIQUE("school_id","month")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payslips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"payroll_run_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"month" text NOT NULL,
	"working_days" integer NOT NULL,
	"present_days" integer NOT NULL,
	"basic_salary" numeric(12, 2) NOT NULL,
	"da" numeric(12, 2) DEFAULT '0' NOT NULL,
	"hra" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_allowances" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gross_salary" numeric(12, 2) NOT NULL,
	"pf_employee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"pf_employer" numeric(10, 2) DEFAULT '0' NOT NULL,
	"esi" numeric(10, 2) DEFAULT '0' NOT NULL,
	"professional_tax" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tds" numeric(10, 2) DEFAULT '0' NOT NULL,
	"loan_deduction" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(12, 2) NOT NULL,
	"net_pay" numeric(12, 2) NOT NULL,
	"pdf_s3_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payslips_run_staff_unique" UNIQUE("payroll_run_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"basic_salary" numeric(12, 2) NOT NULL,
	"da_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"hra_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"other_allowances" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pf_employee_percent" numeric(5, 2) DEFAULT '12' NOT NULL,
	"pf_employer_percent" numeric(5, 2) DEFAULT '12' NOT NULL,
	"esi_applicable" boolean DEFAULT false NOT NULL,
	"professional_tax_state" text DEFAULT 'DL',
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid,
	"employee_code" text NOT NULL,
	"department_id" uuid NOT NULL,
	"designation_id" uuid NOT NULL,
	"contract_type" "contract_type" NOT NULL,
	"joining_date" timestamp with time zone NOT NULL,
	"confirmation_date" timestamp with time zone,
	"first_name_encrypted" text NOT NULL,
	"last_name_encrypted" text NOT NULL,
	"date_of_birth_encrypted" text NOT NULL,
	"gender_encrypted" text NOT NULL,
	"mobile_encrypted" text NOT NULL,
	"email_encrypted" text NOT NULL,
	"address_encrypted" text,
	"aadhaar_last4" text,
	"pan_encrypted" text,
	"bank_account_encrypted" text,
	"bank_ifsc_encrypted" text,
	"bank_name_encrypted" text,
	"qualification" text,
	"experience" text,
	"photo_s3_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "staff_school_code_unique" UNIQUE("school_id","employee_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "book_copies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"barcode_number" text NOT NULL,
	"condition" text DEFAULT 'GOOD' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "book_copies_barcode_unique" UNIQUE("school_id","barcode_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "book_fines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"book_issue_id" uuid NOT NULL,
	"overdue_days" integer NOT NULL,
	"fine_amount" numeric(8, 2) NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "book_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"book_copy_id" uuid NOT NULL,
	"library_member_id" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"returned_at" timestamp with time zone,
	"renewal_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ISSUED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"isbn" text,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"publisher" text,
	"edition" text,
	"subject" text,
	"category" text,
	"rack_location" text,
	"total_copies" integer DEFAULT 1 NOT NULL,
	"available_copies" integer DEFAULT 1 NOT NULL,
	"is_e_resource" boolean DEFAULT false NOT NULL,
	"e_resource_url" text,
	"cover_image_s3_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"member_type" text NOT NULL,
	"member_ref_id" uuid NOT NULL,
	"member_card_number" text NOT NULL,
	"max_books_allowed" integer DEFAULT 2 NOT NULL,
	"loan_period_days" integer DEFAULT 14 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gps_pings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"speed" numeric(6, 2),
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "route_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"stop_name" text NOT NULL,
	"stop_order" integer NOT NULL,
	"gps_latitude" numeric(10, 7),
	"gps_longitude" numeric(10, 7),
	"estimated_arrival_time" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "route_stops_unique" UNIQUE("route_id","stop_order")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"route_name" text NOT NULL,
	"route_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_bus_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"route_stop_id" uuid NOT NULL,
	"pass_number" text NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone NOT NULL,
	"qr_code_data" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_bus_passes_unique" UNIQUE("school_id","pass_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"bus_number" text NOT NULL,
	"registration_number" text NOT NULL,
	"capacity" integer NOT NULL,
	"make" text,
	"model" text,
	"year_of_manufacture" integer,
	"driver_name_encrypted" text NOT NULL,
	"driver_licence_encrypted" text NOT NULL,
	"driver_mobile_encrypted" text NOT NULL,
	"conductor_name_encrypted" text,
	"conductor_mobile_encrypted" text,
	"fitness_cert_expiry_date" timestamp with time zone,
	"insurance_expiry_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vehicles_school_bus_unique" UNIQUE("school_id","bus_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"subject" text NOT NULL,
	"template_name" text,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"message_id" text,
	"sent_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"event_type" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"audience_type" "notice_audience_type" NOT NULL,
	"audience_filter" jsonb,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"attachment_s3_key" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parent_teacher_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"is_moderated" boolean DEFAULT false NOT NULL,
	"moderated_by_id" uuid,
	"parent_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"fcm_message_id" text,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"template_id" text,
	"message_type" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"gateway_message_id" text,
	"sent_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"assigned_to_type" text NOT NULL,
	"assigned_to_id" uuid,
	"room_number" text,
	"assigned_by_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"returned_at" timestamp with time zone,
	"condition" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"asset_code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"purchase_date" timestamp with time zone,
	"purchase_price" numeric(12, 2),
	"current_value" numeric(12, 2),
	"location" text,
	"condition" text DEFAULT 'GOOD' NOT NULL,
	"qr_code_data" text,
	"warranty_expiry_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"minimum_stock_level" integer DEFAULT 10 NOT NULL,
	"reorder_point" integer DEFAULT 20 NOT NULL,
	"unit_price" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"po_number" text NOT NULL,
	"vendor_name" text NOT NULL,
	"order_date" timestamp with time zone NOT NULL,
	"total_amount" numeric(12, 2),
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"approved_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2),
	"purchase_order_id" uuid,
	"reason" text,
	"performed_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"bed_number" integer NOT NULL,
	"check_in_date" timestamp with time zone NOT NULL,
	"check_out_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hostel_allocations_room_bed_unique" UNIQUE("room_id","bed_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"block" text NOT NULL,
	"floor" integer NOT NULL,
	"room_number" text NOT NULL,
	"room_type" "room_type" NOT NULL,
	"capacity" integer NOT NULL,
	"current_occupancy" integer DEFAULT 0 NOT NULL,
	"monthly_fee" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hostel_rooms_unique" UNIQUE("school_id","block","room_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visitor_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"visitor_name_encrypted" text NOT NULL,
	"visitor_mobile_encrypted" text,
	"visitor_id_type" text,
	"visitor_id_last4" text,
	"purpose" text NOT NULL,
	"student_id" uuid,
	"staff_id" uuid,
	"check_in_time" timestamp with time zone NOT NULL,
	"check_out_time" timestamp with time zone,
	"photo_s3_key" text,
	"logged_by_user_id" uuid NOT NULL,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_years_school_idx" ON "academic_years" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_school_idx" ON "audit_logs" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "audit_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_table_idx" ON "audit_logs" ("table_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_date_idx" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_role_idx" ON "role_permissions" ("role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_school_idx" ON "roles" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schools_email_idx" ON "schools" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expiry_idx" ON "sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_user_idx" ON "user_roles" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_school_idx" ON "user_roles" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_school_idx" ON "users" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_purposes_purpose_id_idx" ON "consent_purposes" ("purpose_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_records_student_purpose_idx" ON "consent_records" ("student_id","purpose_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_records_school_idx" ON "consent_records" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_records_parent_idx" ON "consent_records" ("parent_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_breach_log_school_idx" ON "data_breach_log" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_breach_log_detected_idx" ON "data_breach_log" ("detected_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_retention_policies_school_idx" ON "data_retention_policies" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_retention_policies_table_idx" ON "data_retention_policies" ("table_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpdp_grievances_school_idx" ON "dpdp_grievances" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dpdp_grievances_due_idx" ON "dpdp_grievances" ("due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "privacy_notices_school_idx" ON "privacy_notices" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rights_requests_school_idx" ON "rights_requests" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rights_requests_student_idx" ON "rights_requests" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rights_requests_status_idx" ON "rights_requests" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rights_requests_due_idx" ON "rights_requests" ("due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_register_school_idx" ON "vendor_register" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admission_applications_school_year_idx" ON "admission_applications" ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admission_applications_status_idx" ON "admission_applications" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admission_applications_grade_idx" ON "admission_applications" ("grade_applied_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admission_documents_application_idx" ON "admission_documents" ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admission_documents_school_idx" ON "admission_documents" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admission_workflow_steps_application_idx" ON "admission_workflow_steps" ("application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_grade_rank_idx" ON "waitlist" ("school_id","academic_year_id","grade_applied_for","rank");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alumni_school_idx" ON "alumni" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_class_history_student_idx" ON "student_class_history" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_class_history_school_year_idx" ON "student_class_history" ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_documents_student_idx" ON "student_documents" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_documents_school_idx" ON "student_documents" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_family_members_student_idx" ON "student_family_members" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_family_members_school_idx" ON "student_family_members" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_medical_records_school_idx" ON "student_medical_records" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_school_year_idx" ON "students" ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_school_idx" ON "students" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_class_idx" ON "students" ("current_class_id","current_section_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_search_idx" ON "students" ("first_name_search_hash","last_name_search_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignment_submissions_assignment_idx" ON "assignment_submissions" ("assignment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignment_submissions_school_idx" ON "assignment_submissions" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_section_idx" ON "assignments" ("section_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_school_idx" ON "assignments" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assignments_due_date_idx" ON "assignments" ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "class_subjects_class_idx" ON "class_subjects" ("class_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "classes_school_year_idx" ON "classes" ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_plans_class_subject_idx" ON "lesson_plans" ("class_subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_plans_school_idx" ON "lesson_plans" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sections_class_idx" ON "sections" ("class_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sections_school_idx" ON "sections" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subjects_school_idx" ON "subjects" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timetable_periods_teacher_day_idx" ON "timetable_periods" ("teacher_id","day_of_week");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timetable_periods_school_year_idx" ON "timetable_periods" ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_attendance_school_date_idx" ON "staff_attendance" ("school_id","attendance_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_attendance_school_date_idx" ON "student_attendance" ("school_id","attendance_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_attendance_student_idx" ON "student_attendance" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificates_student_idx" ON "certificates" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exams_school_year_idx" ON "exams" ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mark_entries_exam_idx" ON "mark_entries" ("exam_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mark_entries_student_idx" ON "mark_entries" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_cards_school_year_idx" ON "report_cards" ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_concessions_student_idx" ON "fee_concessions" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_concessions_school_year_idx" ON "fee_concessions" ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_heads_school_idx" ON "fee_heads" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_invoices_student_idx" ON "fee_invoices" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_invoices_school_year_idx" ON "fee_invoices" ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_invoices_status_idx" ON "fee_invoices" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_invoices_due_date_idx" ON "fee_invoices" ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_payments_invoice_idx" ON "fee_payments" ("fee_invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_payments_student_idx" ON "fee_payments" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_payments_date_idx" ON "fee_payments" ("payment_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_refunds_payment_idx" ON "fee_refunds" ("fee_payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_refunds_school_idx" ON "fee_refunds" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_structures_school_year_class_idx" ON "fee_structures" ("school_id","academic_year_id","class_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_gateway_logs_school_idx" ON "payment_gateway_logs" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_gateway_logs_order_idx" ON "payment_gateway_logs" ("gateway_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_staff_idx" ON "leave_requests" ("staff_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_school_idx" ON "leave_requests" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payslips_staff_idx" ON "payslips" ("staff_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_school_idx" ON "staff" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "book_issues_school_idx" ON "book_issues" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "book_issues_member_idx" ON "book_issues" ("library_member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "books_school_idx" ON "books" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "books_isbn_idx" ON "books" ("isbn");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gps_pings_vehicle_time_idx" ON "gps_pings" ("vehicle_id","recorded_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routes_school_idx" ON "routes" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_bus_passes_student_idx" ON "student_bus_passes" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_school_idx" ON "vehicles" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_school_date_idx" ON "events" ("school_id","start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notices_school_idx" ON "notices" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notices_published_idx" ON "notices" ("published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parent_teacher_messages_sender_idx" ON "parent_teacher_messages" ("sender_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parent_teacher_messages_recipient_idx" ON "parent_teacher_messages" ("recipient_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parent_teacher_messages_school_idx" ON "parent_teacher_messages" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sms_logs_school_idx" ON "sms_logs" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_school_idx" ON "assets" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_items_school_idx" ON "inventory_items" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_item_idx" ON "stock_movements" ("inventory_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_school_idx" ON "stock_movements" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_allocations_student_idx" ON "hostel_allocations" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_rooms_school_idx" ON "hostel_rooms" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_logs_school_date_idx" ON "visitor_logs" ("school_id","check_in_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_logs_student_idx" ON "visitor_logs" ("student_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consent_purposes" ADD CONSTRAINT "consent_purposes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_breach_log" ADD CONSTRAINT "data_breach_log_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dpdp_grievances" ADD CONSTRAINT "dpdp_grievances_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "privacy_notices" ADD CONSTRAINT "privacy_notices_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rights_requests" ADD CONSTRAINT "rights_requests_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_register" ADD CONSTRAINT "vendor_register_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_application_id_admission_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "admission_applications"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admission_workflow_steps" ADD CONSTRAINT "admission_workflow_steps_application_id_admission_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "admission_applications"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admission_workflow_steps" ADD CONSTRAINT "admission_workflow_steps_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_application_id_admission_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "admission_applications"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alumni" ADD CONSTRAINT "alumni_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alumni" ADD CONSTRAINT "alumni_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_documents" ADD CONSTRAINT "student_documents_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_family_members" ADD CONSTRAINT "student_family_members_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_family_members" ADD CONSTRAINT "student_family_members_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_medical_records" ADD CONSTRAINT "student_medical_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_medical_records" ADD CONSTRAINT "student_medical_records_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "students" ADD CONSTRAINT "students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "students" ADD CONSTRAINT "students_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assignments" ADD CONSTRAINT "assignments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_subject_id_class_subjects_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assignments" ADD CONSTRAINT "assignments_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_teacher_id_users_id_fk" FOREIGN KEY ("created_by_teacher_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_assigned_teacher_id_users_id_fk" FOREIGN KEY ("assigned_teacher_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "classes" ADD CONSTRAINT "classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_class_subject_id_class_subjects_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sections" ADD CONSTRAINT "sections_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sections" ADD CONSTRAINT "sections_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sections" ADD CONSTRAINT "sections_class_teacher_id_users_id_fk" FOREIGN KEY ("class_teacher_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subjects" ADD CONSTRAINT "subjects_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_periods" ADD CONSTRAINT "timetable_periods_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendance_notifications" ADD CONSTRAINT "attendance_notifications_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendance_notifications" ADD CONSTRAINT "attendance_notifications_student_attendance_id_student_attendance_id_fk" FOREIGN KEY ("student_attendance_id") REFERENCES "student_attendance"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_attendance" ADD CONSTRAINT "staff_attendance_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "certificates" ADD CONSTRAINT "certificates_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_id_users_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exam_types" ADD CONSTRAINT "exam_types_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exams" ADD CONSTRAINT "exams_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exams" ADD CONSTRAINT "exams_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exams" ADD CONSTRAINT "exams_exam_type_id_exam_types_id_fk" FOREIGN KEY ("exam_type_id") REFERENCES "exam_types"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exams" ADD CONSTRAINT "exams_locked_by_id_users_id_fk" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mark_entries" ADD CONSTRAINT "mark_entries_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mark_entries" ADD CONSTRAINT "mark_entries_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mark_entries" ADD CONSTRAINT "mark_entries_entered_by_id_users_id_fk" FOREIGN KEY ("entered_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_generated_by_id_users_id_fk" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_concessions" ADD CONSTRAINT "fee_concessions_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_heads" ADD CONSTRAINT "fee_heads_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_fee_structure_id_fee_structures_id_fk" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_fee_invoice_id_fee_invoices_id_fk" FOREIGN KEY ("fee_invoice_id") REFERENCES "fee_invoices"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_collected_by_id_users_id_fk" FOREIGN KEY ("collected_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_fee_payment_id_fee_payments_id_fk" FOREIGN KEY ("fee_payment_id") REFERENCES "fee_payments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_refunds" ADD CONSTRAINT "fee_refunds_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_fee_head_id_fee_heads_id_fk" FOREIGN KEY ("fee_head_id") REFERENCES "fee_heads"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_gateway_logs" ADD CONSTRAINT "payment_gateway_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_gateway_logs" ADD CONSTRAINT "payment_gateway_logs_fee_invoice_id_fee_invoices_id_fk" FOREIGN KEY ("fee_invoice_id") REFERENCES "fee_invoices"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "departments" ADD CONSTRAINT "departments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "departments" ADD CONSTRAINT "departments_hod_user_id_users_id_fk" FOREIGN KEY ("hod_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "designations" ADD CONSTRAINT "designations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "designations" ADD CONSTRAINT "designations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_hod_approved_by_id_users_id_fk" FOREIGN KEY ("hod_approved_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_hr_approved_by_id_users_id_fk" FOREIGN KEY ("hr_approved_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_processed_by_id_users_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payslips" ADD CONSTRAINT "payslips_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payslips" ADD CONSTRAINT "payslips_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_components" ADD CONSTRAINT "salary_components_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff" ADD CONSTRAINT "staff_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff" ADD CONSTRAINT "staff_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff" ADD CONSTRAINT "staff_designation_id_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_copies" ADD CONSTRAINT "book_copies_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_copies" ADD CONSTRAINT "book_copies_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_fines" ADD CONSTRAINT "book_fines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_fines" ADD CONSTRAINT "book_fines_book_issue_id_book_issues_id_fk" FOREIGN KEY ("book_issue_id") REFERENCES "book_issues"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_issues" ADD CONSTRAINT "book_issues_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_issues" ADD CONSTRAINT "book_issues_book_copy_id_book_copies_id_fk" FOREIGN KEY ("book_copy_id") REFERENCES "book_copies"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "book_issues" ADD CONSTRAINT "book_issues_library_member_id_library_members_id_fk" FOREIGN KEY ("library_member_id") REFERENCES "library_members"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "books" ADD CONSTRAINT "books_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_members" ADD CONSTRAINT "library_members_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gps_pings" ADD CONSTRAINT "gps_pings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routes" ADD CONSTRAINT "routes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routes" ADD CONSTRAINT "routes_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_bus_passes" ADD CONSTRAINT "student_bus_passes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_bus_passes" ADD CONSTRAINT "student_bus_passes_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_bus_passes" ADD CONSTRAINT "student_bus_passes_route_stop_id_route_stops_id_fk" FOREIGN KEY ("route_stop_id") REFERENCES "route_stops"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notices" ADD CONSTRAINT "notices_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parent_teacher_messages" ADD CONSTRAINT "parent_teacher_messages_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parent_teacher_messages" ADD CONSTRAINT "parent_teacher_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parent_teacher_messages" ADD CONSTRAINT "parent_teacher_messages_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parent_teacher_messages" ADD CONSTRAINT "parent_teacher_messages_moderated_by_id_users_id_fk" FOREIGN KEY ("moderated_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_notification_logs" ADD CONSTRAINT "push_notification_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_room_id_hostel_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "hostel_rooms"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visitor_logs" ADD CONSTRAINT "visitor_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visitor_logs" ADD CONSTRAINT "visitor_logs_logged_by_user_id_users_id_fk" FOREIGN KEY ("logged_by_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
