-- Migration: 0022_school_profile_fields.sql
-- Adds online branding, identity, and social presence fields to schools table

ALTER TABLE schools ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS motto text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS about text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS social_handles jsonb DEFAULT '{}'::jsonb;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS theme_colors jsonb DEFAULT '{"light": "#4f46e5", "dark": "#6366f1"}'::jsonb;
