import { db } from "./src/db/index";
import { sql } from "drizzle-orm";

async function runMigrations() {
  console.log("Running manual migrations for exam module tables...");

  try {
    // Create enums first (ignore if already exists)
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE mark_entry_status AS ENUM ('DRAFT', 'SUBMITTED', 'LOCKED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE class_group AS ENUM ('NURSERY_UKG', 'CLASS_1_5', 'CLASS_6_8', 'CLASS_9_10');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE report_card_job_status AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log("✓ Enums created");

    // Add new columns to mark_entries if they don't exist
    await db.execute(sql`
      ALTER TABLE mark_entries 
        ADD COLUMN IF NOT EXISTS is_medical_exempt boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS practical_marks numeric(7,2),
        ADD COLUMN IF NOT EXISTS practical_max_marks numeric(7,2),
        ADD COLUMN IF NOT EXISTS is_practical_absent boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS grade_point numeric(4,2),
        ADD COLUMN IF NOT EXISTS status mark_entry_status NOT NULL DEFAULT 'DRAFT'
    `);

    // Add subject_id FK if column exists but without reference
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE mark_entries ALTER COLUMN subject_id TYPE uuid USING subject_id::uuid;
      EXCEPTION WHEN others THEN null;
      END $$;
    `);

    console.log("✓ mark_entries columns added");

    // Create exam_schedules table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS exam_schedules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
        exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
        class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
        exam_date date NOT NULL,
        start_time time NOT NULL,
        duration_minutes integer NOT NULL DEFAULT 180,
        room_number text,
        invigilator_id uuid REFERENCES users(id) ON DELETE RESTRICT,
        max_marks numeric(7,2) NOT NULL,
        passing_marks numeric(7,2) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exam_schedules_unique UNIQUE (exam_id, subject_id, class_id)
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS exam_schedules_exam_idx ON exam_schedules(exam_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS exam_schedules_class_idx ON exam_schedules(class_id)`);

    console.log("✓ exam_schedules created");

    // Create grade_rules table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS grade_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
        class_group class_group NOT NULL,
        min_percent numeric(5,2) NOT NULL,
        max_percent numeric(5,2) NOT NULL,
        grade text NOT NULL,
        grade_point numeric(4,2) NOT NULL,
        description text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS grade_rules_school_group_idx ON grade_rules(school_id, class_group)`);

    console.log("✓ grade_rules created");

    // Create report_card_jobs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS report_card_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
        exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
        class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
        total_students integer NOT NULL DEFAULT 0,
        processed_count integer NOT NULL DEFAULT 0,
        failed_count integer NOT NULL DEFAULT 0,
        status report_card_job_status NOT NULL DEFAULT 'QUEUED',
        triggered_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        error_log jsonb,
        started_at timestamptz,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS report_card_jobs_exam_class_idx ON report_card_jobs(exam_id, class_id)`);

    console.log("✓ report_card_jobs created");

    // Create medical_exemptions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS medical_exemptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
        student_id uuid NOT NULL,
        exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
        subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT,
        reason text NOT NULL,
        approved_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        approved_at timestamptz NOT NULL DEFAULT now(),
        document_s3_key text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS medical_exemptions_student_exam_idx ON medical_exemptions(student_id, exam_id)`);

    console.log("✓ medical_exemptions created");

    console.log("\n✅ All migrations completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
