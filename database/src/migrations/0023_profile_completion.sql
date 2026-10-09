-- Migration: 0023_profile_completion.sql
-- Completes identity chain by linking canonical persons table with users table,
-- making school_id nullable on persons to support platform superadmins,
-- and backfilling existing users from domain entities.

ALTER TABLE persons ALTER COLUMN school_id DROP NOT NULL;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS persons_user_idx ON persons(user_id);
CREATE INDEX IF NOT EXISTS persons_school_user_idx ON persons(school_id, user_id);

-- Backfill step 1: Staff users with existing staff record
INSERT INTO persons (
  school_id,
  user_id,
  primary_type,
  first_name_encrypted,
  last_name_encrypted,
  gender,
  primary_email_encrypted,
  primary_mobile_encrypted,
  photo_s3_key
)
SELECT
  s.school_id,
  s.user_id,
  'STAFF'::person_type,
  s.first_name_encrypted,
  s.last_name_encrypted,
  COALESCE(s.gender_encrypted, 'OTHER'),
  u.email,
  u.mobile_encrypted,
  s.photo_s3_key
FROM staff s
JOIN users u ON u.id = s.user_id
WHERE s.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM persons p WHERE p.user_id = s.user_id
  );

-- Backfill step 2: Student users
INSERT INTO persons (
  school_id,
  user_id,
  primary_type,
  first_name_encrypted,
  last_name_encrypted,
  gender,
  date_of_birth,
  photo_s3_key
)
SELECT
  st.school_id,
  st.user_id,
  'STUDENT'::person_type,
  st.first_name_encrypted,
  st.last_name_encrypted,
  COALESCE(st.gender::text, 'OTHER'),
  st.date_of_birth,
  st.photo_s3_key
FROM students st
JOIN users u ON u.id = st.user_id
WHERE st.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM persons p WHERE p.user_id = st.user_id
  );

-- Backfill step 3: Driver users
INSERT INTO persons (
  school_id,
  user_id,
  primary_type,
  first_name_encrypted,
  last_name_encrypted,
  gender,
  primary_mobile_encrypted
)
SELECT
  d.school_id,
  d.user_id,
  'DRIVER'::person_type,
  COALESCE(d.name_encrypted, 'ENCRYPTED_DRIVER'),
  COALESCE(d.name_encrypted, 'ENCRYPTED_DRIVER'),
  'OTHER',
  d.mobile_encrypted
FROM drivers d
JOIN users u ON u.id = d.user_id
WHERE d.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM persons p WHERE p.user_id = d.user_id
  );

-- Backfill step 4: Remaining users (Admins, Parents, SuperAdmins)
INSERT INTO persons (
  school_id,
  user_id,
  primary_type,
  first_name_encrypted,
  last_name_encrypted,
  gender,
  primary_email_encrypted,
  primary_mobile_encrypted
)
SELECT
  u.school_id,
  u.id,
  'STAFF'::person_type,
  'ENCRYPTED_USER',
  'ENCRYPTED_USER',
  'OTHER',
  u.email,
  u.mobile_encrypted
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM persons p WHERE p.user_id = u.id
);
