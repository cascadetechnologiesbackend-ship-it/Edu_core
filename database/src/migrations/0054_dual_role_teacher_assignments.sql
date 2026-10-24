-- Migration 0054: Dual-Role Teacher Assignments & Invariants (S16)
-- Creates class_teacher_assignments (1-to-1 per academic year)
-- Extends section_subject_teachers (academic_year_id, is_primary, periods_per_week)
-- Creates homeroom_report_remarks (holistic report card sign-offs)
-- Enables Row-Level Security on assignment tables

-- 1. Create class_teacher_assignments table
CREATE TABLE IF NOT EXISTS class_teacher_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    section_id uuid NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
    teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_active boolean NOT NULL DEFAULT true,
    effective_from text NOT NULL DEFAULT CURRENT_DATE::text,
    effective_to text,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Invariant A: One teacher cannot be active Class Teacher for more than 1 Section in the same Academic Year
CREATE UNIQUE INDEX IF NOT EXISTS cta_single_teacher_year_idx
ON class_teacher_assignments (school_id, academic_year_id, teacher_id)
WHERE is_active = true;

-- Invariant B: One section cannot have more than 1 active Class Teacher in the same Academic Year
CREATE UNIQUE INDEX IF NOT EXISTS cta_single_section_year_idx
ON class_teacher_assignments (school_id, academic_year_id, section_id)
WHERE is_active = true;

-- Lookup indexes
CREATE INDEX IF NOT EXISTS cta_school_teacher_idx ON class_teacher_assignments (school_id, teacher_id);
CREATE INDEX IF NOT EXISTS cta_school_section_idx ON class_teacher_assignments (school_id, section_id);
CREATE INDEX IF NOT EXISTS cta_school_year_idx ON class_teacher_assignments (school_id, academic_year_id);

-- 2. Extend section_subject_teachers
ALTER TABLE section_subject_teachers ADD COLUMN IF NOT EXISTS academic_year_id uuid REFERENCES academic_years(id) ON DELETE RESTRICT;
ALTER TABLE section_subject_teachers ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true;
ALTER TABLE section_subject_teachers ADD COLUMN IF NOT EXISTS periods_per_week integer NOT NULL DEFAULT 5;

-- Backfill academic_year_id from class_subjects -> classes
UPDATE section_subject_teachers sst
SET academic_year_id = c.academic_year_id
FROM class_subjects cs
JOIN classes c ON c.id = cs.class_id
WHERE sst.class_subject_id = cs.id
  AND sst.academic_year_id IS NULL;

-- Corrected partial unique index on section_subject_teachers (filtering on is_active = true)
CREATE UNIQUE INDEX IF NOT EXISTS sst_active_primary_unique_idx
ON section_subject_teachers (school_id, academic_year_id, section_id, class_subject_id)
WHERE is_active = true AND is_primary = true;

-- 3. Create homeroom_report_remarks table
CREATE TABLE IF NOT EXISTS homeroom_report_remarks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    academic_year_id uuid NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    academic_term_id uuid NOT NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
    remarks text NOT NULL,
    conduct_grade varchar(10),
    signed_off_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    signed_off_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT uq_homeroom_report_remarks_student_term UNIQUE (school_id, student_id, academic_term_id)
);

CREATE INDEX IF NOT EXISTS hrr_student_term_idx ON homeroom_report_remarks (school_id, student_id, academic_term_id);
CREATE INDEX IF NOT EXISTS hrr_signed_off_idx ON homeroom_report_remarks (school_id, signed_off_by_id);

-- 4. Backfill class_teacher_assignments from existing active sections.class_teacher_id
INSERT INTO class_teacher_assignments (school_id, academic_year_id, section_id, teacher_id, is_active, effective_from)
SELECT s.school_id, c.academic_year_id, s.id, s.class_teacher_id, true, CURRENT_DATE::text
FROM sections s
JOIN classes c ON c.id = s.class_id
WHERE s.class_teacher_id IS NOT NULL 
  AND s.is_active = true
  AND c.academic_year_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Row-Level Security (RLS) enforcement
ALTER TABLE class_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_subject_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeroom_report_remarks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'class_teacher_assignments' AND policyname = 'tenant_isolation_class_teacher_assignments'
  ) THEN
    CREATE POLICY tenant_isolation_class_teacher_assignments ON class_teacher_assignments
    FOR ALL
    USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    )
    WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'section_subject_teachers' AND policyname = 'tenant_isolation_section_subject_teachers'
  ) THEN
    CREATE POLICY tenant_isolation_section_subject_teachers ON section_subject_teachers
    FOR ALL
    USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    )
    WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'homeroom_report_remarks' AND policyname = 'tenant_isolation_homeroom_report_remarks'
  ) THEN
    CREATE POLICY tenant_isolation_homeroom_report_remarks ON homeroom_report_remarks
    FOR ALL
    USING (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    )
    WITH CHECK (
      school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    );
  END IF;
END $$;

