DO $$ BEGIN
 CREATE TYPE "assessment_status" AS ENUM('DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "assessment_type" AS ENUM('UNIT_TEST', 'MIDTERM', 'FINAL', 'QUIZ', 'PRACTICAL', 'PROJECT', 'FA', 'SA');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "calendar_event_type" AS ENUM('HOLIDAY', 'EVENT', 'EXAM', 'PTM', 'SPORTS', 'CULTURAL', 'WORKING_SATURDAY', 'VACATION');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "substitution_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "academic_calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"term_id" uuid,
	"title" text NOT NULL,
	"event_type" "calendar_event_type" NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"description" text,
	"is_working_day" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "academic_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "academic_terms_name_unique" UNIQUE("school_id","academic_year_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_subject_id" uuid NOT NULL,
	"section_id" uuid,
	"term_id" uuid,
	"title" text NOT NULL,
	"assessment_type" "assessment_type" NOT NULL,
	"date" text,
	"max_marks" integer DEFAULT 100 NOT NULL,
	"syllabus_coverage" text,
	"status" "assessment_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_teacher_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bell_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"period_number" integer NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"period_type" "period_type" DEFAULT 'REGULAR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "bell_schedule_school_period_unique" UNIQUE("school_id","period_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "section_subject_teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_subject_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "syllabus_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"ncert_reference" text,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "syllabus_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"estimated_periods" integer DEFAULT 1,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "syllabus_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_subject_id" uuid NOT NULL,
	"academic_term_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timetable_substitutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"date" text NOT NULL,
	"timetable_period_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"original_teacher_id" uuid NOT NULL,
	"substitute_teacher_id" uuid,
	"subject_id" uuid,
	"reason" text,
	"status" "substitution_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "substitutions_date_section_period_unique" UNIQUE("date","section_id","timetable_period_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_plans" ADD COLUMN "syllabus_topic_id" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_school_year_idx" ON "academic_calendar_events" ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_start_date_idx" ON "academic_calendar_events" ("start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_terms_school_year_idx" ON "academic_terms" ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessments_class_subject_idx" ON "assessments" ("class_subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessments_school_idx" ON "assessments" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessments_date_idx" ON "assessments" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bell_schedule_school_idx" ON "bell_schedule" ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sst_active_unique_idx" ON "section_subject_teachers" ("class_subject_id","section_id") WHERE "effective_to" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sst_class_subject_idx" ON "section_subject_teachers" ("class_subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sst_section_idx" ON "section_subject_teachers" ("section_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sst_teacher_idx" ON "section_subject_teachers" ("teacher_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sst_school_idx" ON "section_subject_teachers" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "syllabus_chapters_unit_idx" ON "syllabus_chapters" ("unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "syllabus_chapters_school_idx" ON "syllabus_chapters" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "syllabus_topics_chapter_idx" ON "syllabus_topics" ("chapter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "syllabus_topics_school_idx" ON "syllabus_topics" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "syllabus_units_class_subject_idx" ON "syllabus_units" ("class_subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "syllabus_units_school_idx" ON "syllabus_units" ("school_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "substitutions_school_date_idx" ON "timetable_substitutions" ("school_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "substitutions_original_teacher_idx" ON "timetable_substitutions" ("original_teacher_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lesson_plans_topic_idx" ON "lesson_plans" ("syllabus_topic_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_syllabus_topic_id_syllabus_topics_id_fk" FOREIGN KEY ("syllabus_topic_id") REFERENCES "syllabus_topics"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "academic_calendar_events" ADD CONSTRAINT "academic_calendar_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "academic_calendar_events" ADD CONSTRAINT "academic_calendar_events_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "academic_calendar_events" ADD CONSTRAINT "academic_calendar_events_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "academic_terms"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "academic_terms" ADD CONSTRAINT "academic_terms_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_class_subject_id_class_subjects_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_term_id_academic_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "academic_terms"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_teacher_id_users_id_fk" FOREIGN KEY ("created_by_teacher_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bell_schedule" ADD CONSTRAINT "bell_schedule_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_subject_teachers" ADD CONSTRAINT "section_subject_teachers_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_subject_teachers" ADD CONSTRAINT "section_subject_teachers_class_subject_id_class_subjects_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_subject_teachers" ADD CONSTRAINT "section_subject_teachers_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "section_subject_teachers" ADD CONSTRAINT "section_subject_teachers_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "syllabus_chapters" ADD CONSTRAINT "syllabus_chapters_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "syllabus_chapters" ADD CONSTRAINT "syllabus_chapters_unit_id_syllabus_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "syllabus_units"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_chapter_id_syllabus_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "syllabus_chapters"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "syllabus_units" ADD CONSTRAINT "syllabus_units_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "syllabus_units" ADD CONSTRAINT "syllabus_units_class_subject_id_class_subjects_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "syllabus_units" ADD CONSTRAINT "syllabus_units_academic_term_id_academic_terms_id_fk" FOREIGN KEY ("academic_term_id") REFERENCES "academic_terms"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_timetable_period_id_timetable_periods_id_fk" FOREIGN KEY ("timetable_period_id") REFERENCES "timetable_periods"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_original_teacher_id_users_id_fk" FOREIGN KEY ("original_teacher_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_substitute_teacher_id_users_id_fk" FOREIGN KEY ("substitute_teacher_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
