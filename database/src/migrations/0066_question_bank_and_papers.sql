-- Phase D: Question Bank, Blueprints & Question Papers (NCERT/PARAKH-aligned)

DO $$ BEGIN
  CREATE TYPE question_type_enum AS ENUM (
    'MCQ', 'MSQ', 'TRUE_FALSE', 'FILL_BLANK', 'MATCH',
    'VSA', 'SA', 'LA', 'CASE_BASED', 'SOURCE_BASED',
    'DIAGRAM', 'NUMERICAL', 'PRACTICAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_difficulty_enum AS ENUM ('EASY', 'MEDIUM', 'HARD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cognitive_level_enum AS ENUM (
    'REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_review_status_enum AS ENUM (
    'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_paper_set_code_enum AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_paper_status_enum AS ENUM (
    'DRAFT', 'MODERATED', 'APPROVED', 'LOCKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  board text,
  academic_year_id uuid REFERENCES academic_years(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  syllabus_chapter_id uuid REFERENCES syllabus_chapters(id) ON DELETE SET NULL,
  syllabus_topic_id uuid REFERENCES syllabus_topics(id) ON DELETE SET NULL,
  learning_outcome text,
  question_type question_type_enum NOT NULL DEFAULT 'MCQ',
  question_text text NOT NULL,
  options_json jsonb,
  correct_answer text,
  marking_scheme text,
  explanation text,
  max_marks numeric(6,2) NOT NULL DEFAULT 1,
  difficulty question_difficulty_enum NOT NULL DEFAULT 'MEDIUM',
  cognitive_level cognitive_level_enum NOT NULL DEFAULT 'UNDERSTAND',
  competency_tag text,
  language text NOT NULL DEFAULT 'en',
  created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  review_status question_review_status_enum NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qb_school_class_subject
  ON question_bank (school_id, class_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_qb_school_chapter
  ON question_bank (school_id, syllabus_chapter_id);
CREATE INDEX IF NOT EXISTS idx_qb_school_status
  ON question_bank (school_id, review_status);

CREATE TABLE IF NOT EXISTS question_paper_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  exam_id uuid REFERENCES exams(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  name text NOT NULL,
  total_marks integer NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 180,
  sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  competency_distribution_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  difficulty_distribution_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  chapter_weightage_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qpb_school_class_subject
  ON question_paper_blueprints (school_id, class_id, subject_id);

CREATE TABLE IF NOT EXISTS question_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  exam_id uuid REFERENCES exams(id) ON DELETE SET NULL,
  blueprint_id uuid REFERENCES question_paper_blueprints(id) ON DELETE SET NULL,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  title text NOT NULL,
  set_code question_paper_set_code_enum NOT NULL DEFAULT 'A',
  total_marks integer NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 180,
  status question_paper_status_enum NOT NULL DEFAULT 'DRAFT',
  version integer NOT NULL DEFAULT 1,
  created_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qp_school_class_subject
  ON question_papers (school_id, class_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_qp_school_status
  ON question_papers (school_id, status);

CREATE TABLE IF NOT EXISTS question_paper_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  question_paper_id uuid NOT NULL REFERENCES question_papers(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES question_bank(id) ON DELETE RESTRICT,
  section_label text NOT NULL DEFAULT 'Section A',
  order_index integer NOT NULL DEFAULT 1,
  marks numeric(6,2) NOT NULL,
  is_optional boolean NOT NULL DEFAULT false,
  CONSTRAINT uq_qpi_paper_question UNIQUE (question_paper_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_qpi_paper_order
  ON question_paper_items (question_paper_id, order_index);
