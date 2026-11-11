import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env["DATABASE_URL"] ??
    "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp",
});

async function main() {
  console.log("Applying schema updates...");
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TYPE role_name ADD VALUE IF NOT EXISTS 'DRIVER';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END $$;
    `);
    console.log("✓ DRIVER added to role_name enum");

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log("✓ must_change_password added to users table");

    await client.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
        vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        name_encrypted TEXT NOT NULL,
        mobile_encrypted TEXT NOT NULL,
        licence_encrypted TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT drivers_user_unique UNIQUE (user_id)
      );

      CREATE INDEX IF NOT EXISTS drivers_school_idx ON drivers(school_id);
      CREATE INDEX IF NOT EXISTS drivers_vehicle_idx ON drivers(vehicle_id);
      CREATE INDEX IF NOT EXISTS drivers_user_idx ON drivers(user_id);

      ALTER TABLE vehicles ALTER COLUMN driver_name_encrypted DROP NOT NULL;
      ALTER TABLE vehicles ALTER COLUMN driver_licence_encrypted DROP NOT NULL;
      ALTER TABLE vehicles ALTER COLUMN driver_mobile_encrypted DROP NOT NULL;
    `);
    console.log("✓ drivers table created/verified and vehicles driver columns made optional");
    // ─── Superadmin Platform updates ──────────────────────────────────────────
    await client.query(`
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS slug TEXT;
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_type TEXT;
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS provisioning_manifest JSONB;

      -- Backfill slug if null
      UPDATE schools 
      SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
      WHERE slug IS NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS schools_slug_unique ON schools(slug);
      CREATE INDEX IF NOT EXISTS schools_status_idx ON schools(status);
    `);
    console.log("✓ schools table superadmin columns added and indexed");

    // Enums for superadmin templates
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'school_type') THEN
          CREATE TYPE school_type AS ENUM ('PRIMARY', 'SECONDARY', 'SENIOR_SECONDARY', 'INTEGRATED');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'holiday_type_template') THEN
          CREATE TYPE holiday_type_template AS ENUM ('NATIONAL', 'REGIONAL', 'FESTIVAL');
        END IF;
      END $$;
    `);
    console.log("✓ school_type & holiday_type_template enums ensured");

    // Superadmin tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS global_template_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        board board NOT NULL,
        school_type school_type NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT gtp_board_type_unique UNIQUE (board, school_type)
      );
      CREATE INDEX IF NOT EXISTS gtp_board_idx ON global_template_profiles(board);

      CREATE TABLE IF NOT EXISTS global_template_academic_years (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES global_template_profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        start_month INTEGER NOT NULL,
        end_month INTEGER NOT NULL,
        terms JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS gtay_profile_idx ON global_template_academic_years(profile_id);

      CREATE TABLE IF NOT EXISTS global_template_classes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES global_template_profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        numeric_level INTEGER NOT NULL,
        grade_level grade_level NOT NULL,
        streams TEXT[] DEFAULT '{}',
        default_sections TEXT[] NOT NULL DEFAULT '{"A"}',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS gtc_profile_idx ON global_template_classes(profile_id);

      CREATE TABLE IF NOT EXISTS global_template_subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES global_template_profiles(id) ON DELETE CASCADE,
        class_template_id UUID REFERENCES global_template_classes(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        subject_type subject_type NOT NULL DEFAULT 'THEORY',
        is_optional BOOLEAN NOT NULL DEFAULT false,
        weekly_periods INTEGER NOT NULL DEFAULT 5,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS gts_profile_idx ON global_template_subjects(profile_id);

      CREATE TABLE IF NOT EXISTS global_template_timetable (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES global_template_profiles(id) ON DELETE CASCADE,
        day_of_week day_of_week NOT NULL,
        period_number INTEGER NOT NULL,
        period_type period_type NOT NULL DEFAULT 'REGULAR',
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS gtt_profile_idx ON global_template_timetable(profile_id);

      CREATE TABLE IF NOT EXISTS global_template_fee_heads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES global_template_profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        head_type fee_head_type NOT NULL,
        is_mandatory BOOLEAN NOT NULL DEFAULT true,
        frequency fee_term NOT NULL DEFAULT 'MONTHLY',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS gtfh_profile_idx ON global_template_fee_heads(profile_id);

      CREATE TABLE IF NOT EXISTS global_template_salary_grades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES global_template_profiles(id) ON DELETE CASCADE,
        grade_name TEXT NOT NULL,
        basic_salary INTEGER NOT NULL,
        hra_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
        da_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
        pf_percent NUMERIC(5,2) NOT NULL DEFAULT 12.00,
        other_allowances JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS gtsg_profile_idx ON global_template_salary_grades(profile_id);

      CREATE TABLE IF NOT EXISTS global_template_holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES global_template_profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        is_fixed_annual BOOLEAN NOT NULL DEFAULT true,
        month INTEGER NOT NULL,
        day INTEGER NOT NULL,
        holiday_type holiday_type_template NOT NULL DEFAULT 'NATIONAL',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS gth_profile_idx ON global_template_holidays(profile_id);

      CREATE TABLE IF NOT EXISTS global_template_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES global_template_profiles(id) ON DELETE CASCADE,
        role_name role_name NOT NULL,
        display_name TEXT NOT NULL,
        default_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS gtr_profile_idx ON global_template_roles(profile_id);

      CREATE TABLE IF NOT EXISTS platform_announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        sent_by UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE RESTRICT,
        target_school_ids UUID[] DEFAULT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS platform_announcement_reads (
        announcement_id UUID NOT NULL REFERENCES platform_announcements(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (announcement_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS impersonation_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        super_admin_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE CASCADE,
        target_school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scoped_token_hash TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        ip_address TEXT
      );
      CREATE INDEX IF NOT EXISTS is_super_admin_idx ON impersonation_sessions(super_admin_id);
      CREATE INDEX IF NOT EXISTS is_school_idx ON impersonation_sessions(target_school_id);
    `);
    console.log("✓ all global_template_* and platform operational tables created");
  } finally {
    client.release();
    await pool.end();
  }
  console.log("Schema update completed successfully.");
}

main().catch((err) => {
  console.error("Schema update failed:", err);
  process.exit(1);
});
