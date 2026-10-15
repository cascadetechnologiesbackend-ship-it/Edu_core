-- Migration 0040: Exam Wiring Integrity Closure & Calendar Structural Idempotency (Sprint S12 Layer 1 & Layer 7)
-- Closes the dead-wire and half-wire exam junctions identified in the S12 audit.
-- Backfills mark_entries.max_marks from distributions/schedules/subjects.
-- Adds structural foreign key columns and partial unique indexes to academic_calendar_events.

-- 1. Structural columns on academic_calendar_events for calendar sync idempotency
ALTER TABLE "academic_calendar_events"
  ADD COLUMN IF NOT EXISTS "exam_schedule_id" uuid REFERENCES "exam_schedules"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "exam_span_source_id" uuid REFERENCES "exams"("id") ON DELETE CASCADE;

--> statement-breakpoint
-- 2. Partial unique indexes on academic_calendar_events
CREATE UNIQUE INDEX IF NOT EXISTS "ace_exam_schedule_uidx"
  ON "academic_calendar_events" ("school_id", "exam_schedule_id")
  WHERE "exam_schedule_id" IS NOT NULL;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ace_exam_span_uidx"
  ON "academic_calendar_events" ("school_id", "exam_span_source_id")
  WHERE "exam_span_source_id" IS NOT NULL;

--> statement-breakpoint
-- 3. Backfill calendar event foreign keys from legacy description tags
UPDATE "academic_calendar_events"
SET "exam_schedule_id" = substring("description" from '\[examScheduleId:([a-f0-9\-]+)\]')::uuid
WHERE "description" LIKE '%[examScheduleId:%' AND "exam_schedule_id" IS NULL;

--> statement-breakpoint
UPDATE "academic_calendar_events"
SET "exam_span_source_id" = substring("description" from '\[examSpanId:([a-f0-9\-]+)\]')::uuid
WHERE "description" LIKE '%[examSpanId:%' AND "exam_span_source_id" IS NULL;

--> statement-breakpoint
-- 4. Backfill mark_entries.max_marks using the distribution -> schedule -> subject default chain
UPDATE "mark_entries" me
SET "max_marks" = COALESCE(
  -- Component distribution
  (SELECT emd."max_marks" FROM "exam_mark_distributions" emd 
   WHERE emd."exam_id" = me."exam_id" 
     AND emd."subject_id" = me."subject_id" 
     AND emd."component_id" = me."component_id" 
   LIMIT 1),
  -- Overall distribution
  (SELECT emd."max_marks" FROM "exam_mark_distributions" emd 
   WHERE emd."exam_id" = me."exam_id" 
     AND emd."subject_id" = me."subject_id" 
     AND emd."component_id" IS NULL 
   LIMIT 1),
  -- Exam schedule
  (SELECT es."max_marks"::numeric FROM "exam_schedules" es 
   WHERE es."exam_id" = me."exam_id" 
     AND es."subject_id" = me."subject_id" 
   LIMIT 1),
  -- Subject default
  (SELECT s."max_marks"::numeric FROM "subjects" s 
   WHERE s."id" = me."subject_id" 
   LIMIT 1),
  100.00
);
