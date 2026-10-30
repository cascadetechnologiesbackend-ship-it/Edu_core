-- Migration: 0057_timetable_manual_override.sql
-- Description: Add is_manual_override column to timetable_periods to preserve manual adjustments during automated generation (Sprint S21, F10)

ALTER TABLE "timetable_periods" ADD COLUMN IF NOT EXISTS "is_manual_override" boolean DEFAULT false NOT NULL;
