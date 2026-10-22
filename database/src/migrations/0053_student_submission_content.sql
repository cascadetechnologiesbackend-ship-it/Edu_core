-- Migration: 0053_student_submission_content.sql
-- Description: Add student_content column to assignment_submissions table (Student PWA Phase S4, AC-6)

ALTER TABLE "assignment_submissions" ADD COLUMN IF NOT EXISTS "student_content" text;
