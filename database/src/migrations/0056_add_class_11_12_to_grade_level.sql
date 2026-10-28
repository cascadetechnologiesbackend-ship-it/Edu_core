-- Migration: 0056_add_class_11_12_to_grade_level.sql
-- Description: Add 'CLASS_11' and 'CLASS_12' to grade_level enum for senior secondary school onboarding and academics

ALTER TYPE "grade_level" ADD VALUE IF NOT EXISTS 'CLASS_11';
--> statement-breakpoint
ALTER TYPE "grade_level" ADD VALUE IF NOT EXISTS 'CLASS_12';
