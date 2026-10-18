-- Migration 0043: Plaintext non-PII state, district, pincode columns and professional_tax_state normalization
-- Phase 10: Form Primitives, Staff Onboarding, Admissions & Tax Migration (docs/uiux-spec.json)

-- 1. Add non-PII location columns to admission_applications
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE "admission_applications" ADD COLUMN IF NOT EXISTS "district" text;

-- 2. Add non-PII location columns to students
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "district" text;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "pincode" text;

-- 3. Add non-PII location columns to staff
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "district" text;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "pincode" text;

-- 4. Normalize legacy professional_tax_state in salary_templates to canonical 2-letter codes
UPDATE "salary_templates"
SET "professional_tax_state" = 'DL'
WHERE UPPER(TRIM("professional_tax_state")) IN ('DL', 'DELHI', 'NEW DELHI');

UPDATE "salary_templates"
SET "professional_tax_state" = 'KA'
WHERE UPPER(TRIM("professional_tax_state")) IN ('KA', 'KARNATAKA');

UPDATE "salary_templates"
SET "professional_tax_state" = 'MH'
WHERE UPPER(TRIM("professional_tax_state")) IN ('MH', 'MAHARASHTRA');

UPDATE "salary_templates"
SET "professional_tax_state" = 'TN'
WHERE UPPER(TRIM("professional_tax_state")) IN ('TN', 'TAMIL NADU', 'TAMILNADU');

UPDATE "salary_templates"
SET "professional_tax_state" = 'TG'
WHERE UPPER(TRIM("professional_tax_state")) IN ('TG', 'TS', 'TELANGANA');

UPDATE "salary_templates"
SET "professional_tax_state" = 'WB'
WHERE UPPER(TRIM("professional_tax_state")) IN ('WB', 'WEST BENGAL');

UPDATE "salary_templates"
SET "professional_tax_state" = 'UP'
WHERE UPPER(TRIM("professional_tax_state")) IN ('UP', 'UTTAR PRADESH');

UPDATE "salary_templates"
SET "professional_tax_state" = 'GJ'
WHERE UPPER(TRIM("professional_tax_state")) IN ('GJ', 'GUJARAT');

UPDATE "salary_templates"
SET "professional_tax_state" = 'RJ'
WHERE UPPER(TRIM("professional_tax_state")) IN ('RJ', 'RAJASTHAN');

UPDATE "salary_templates"
SET "professional_tax_state" = 'KL'
WHERE UPPER(TRIM("professional_tax_state")) IN ('KL', 'KERALA');

UPDATE "salary_templates"
SET "professional_tax_state" = 'AP'
WHERE UPPER(TRIM("professional_tax_state")) IN ('AP', 'ANDHRA PRADESH');

UPDATE "salary_templates"
SET "professional_tax_state" = 'MP'
WHERE UPPER(TRIM("professional_tax_state")) IN ('MP', 'MADHYA PRADESH');

UPDATE "salary_templates"
SET "professional_tax_state" = 'PB'
WHERE UPPER(TRIM("professional_tax_state")) IN ('PB', 'PUNJAB');

UPDATE "salary_templates"
SET "professional_tax_state" = 'HR'
WHERE UPPER(TRIM("professional_tax_state")) IN ('HR', 'HARYANA');

UPDATE "salary_templates"
SET "professional_tax_state" = 'OR'
WHERE UPPER(TRIM("professional_tax_state")) IN ('OR', 'OD', 'ODISHA', 'ORISSA');

UPDATE "salary_templates"
SET "professional_tax_state" = 'BR'
WHERE UPPER(TRIM("professional_tax_state")) IN ('BR', 'BIHAR');

UPDATE "salary_templates"
SET "professional_tax_state" = 'AS'
WHERE UPPER(TRIM("professional_tax_state")) IN ('AS', 'ASSAM');

UPDATE "salary_templates"
SET "professional_tax_state" = 'JH'
WHERE UPPER(TRIM("professional_tax_state")) IN ('JH', 'JHARKHAND');

UPDATE "salary_templates"
SET "professional_tax_state" = 'CG'
WHERE UPPER(TRIM("professional_tax_state")) IN ('CG', 'CHHATTISGARH');

UPDATE "salary_templates"
SET "professional_tax_state" = 'UK'
WHERE UPPER(TRIM("professional_tax_state")) IN ('UK', 'UT', 'UTTARAKHAND');

UPDATE "salary_templates"
SET "professional_tax_state" = 'HP'
WHERE UPPER(TRIM("professional_tax_state")) IN ('HP', 'HIMACHAL PRADESH');

UPDATE "salary_templates"
SET "professional_tax_state" = 'GA'
WHERE UPPER(TRIM("professional_tax_state")) IN ('GA', 'GOA');

-- Null unmatched legacy values for clean admin re-pick (AC16)
UPDATE "salary_templates"
SET "professional_tax_state" = NULL
WHERE "professional_tax_state" IS NOT NULL
  AND LENGTH(TRIM("professional_tax_state")) != 2;
