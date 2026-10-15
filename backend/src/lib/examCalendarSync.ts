import { db } from "@/db";
import {
  academicCalendarEvents,
  examSchedules,
  exams,
} from "@/db/schema";
import { eq, and, inArray, like, or } from "drizzle-orm";
import { withTenant } from "./tenant";

export interface SyncCalendarResult {
  success: boolean;
  syncedPapersCount: number;
  syncedSpanCount: number;
  error?: string | undefined;
}

export interface RemoveCalendarResult {
  success: boolean;
  removedCount: number;
  error?: string | undefined;
}

/**
 * Syncs exam datesheet papers and full exam span into academic_calendar_events.
 * S11 Layer 4 & S12 Layer 7: Structural Calendar Columns & Tenant Guard.
 * Idempotent: checks for existing calendar rows by examScheduleId or examSpanSourceId.
 */
export async function syncDatesheetToCalendar(input: {
  schoolId: string;
  examId?: string;
  scheduleIds?: string[];
  triggeredById?: string;
}): Promise<SyncCalendarResult> {
  const { schoolId, examId, scheduleIds } = input;
  return await withTenant(schoolId, async (scopedDb) => {
    try {
      // Fetch schedules
      let scheduleRows: any[] = [];
      if (scheduleIds && scheduleIds.length > 0) {
        scheduleRows = await scopedDb.query.examSchedules.findMany({
          where: and(
            eq(examSchedules.schoolId, schoolId),
            inArray(examSchedules.id, scheduleIds),
          ),
          with: {
            exam: true,
            class: true,
            subject: true,
          },
        });
      } else if (examId) {
        scheduleRows = await scopedDb.query.examSchedules.findMany({
          where: and(
            eq(examSchedules.schoolId, schoolId),
            eq(examSchedules.examId, examId),
          ),
          with: {
            exam: true,
            class: true,
            subject: true,
          },
        });
      }

      if (scheduleRows.length === 0) {
        return { success: true, syncedPapersCount: 0, syncedSpanCount: 0 };
      }

      const targetExam = scheduleRows[0]?.exam;
      const academicYearId = targetExam?.academicYearId;
      if (!academicYearId) {
        return {
          success: false,
          syncedPapersCount: 0,
          syncedSpanCount: 0,
          error: "Academic year not found for exam",
        };
      }

      let syncedPapersCount = 0;

      // 1. Sync each schedule paper
      for (const row of scheduleRows) {
        const scheduleTag = `[examScheduleId:${row.id}]`;
        const examTag = `[examId:${row.examId}]`;
        const subjectName = row.subject?.name || "Examination Paper";
        const classDisplayName =
          row.class?.displayName || `Class ${row.class?.gradeLevel || ""}`;
        const title = `${subjectName} (${classDisplayName})`;
        const examDateStr =
          typeof row.examDate === "string"
            ? row.examDate
            : (row.examDate as Date).toISOString().slice(0, 10);
        const description = `Exam: ${row.exam?.name || "Exam"} | Time: ${row.startTime} | Duration: ${row.durationMinutes}m | ${scheduleTag} ${examTag}`;

        // Check if existing calendar event exists by structural column or legacy tag
        const existing = await scopedDb.query.academicCalendarEvents.findFirst({
          where: and(
            eq(academicCalendarEvents.schoolId, schoolId),
            or(
              eq(academicCalendarEvents.examScheduleId, row.id),
              like(academicCalendarEvents.description, `%${scheduleTag}%`),
            ),
          ),
        });

        if (existing) {
          await scopedDb
            .update(academicCalendarEvents)
            .set({
              title,
              startDate: examDateStr,
              endDate: examDateStr,
              description,
              isWorkingDay: true,
              isActive: true,
              examScheduleId: row.id,
              updatedAt: new Date(),
            })
            .where(eq(academicCalendarEvents.id, existing.id));
        } else {
          await scopedDb.insert(academicCalendarEvents).values({
            schoolId,
            academicYearId,
            title,
            eventType: "EXAM",
            startDate: examDateStr,
            endDate: examDateStr,
            description,
            isWorkingDay: true,
            isActive: true,
            examScheduleId: row.id,
          });
        }
        syncedPapersCount++;
      }

      // 2. Sync whole exam span for general calendar visibility
      let syncedSpanCount = 0;
      if (targetExam) {
        const examSpanTag = `[examSpanId:${targetExam.id}]`;
        const examStartDateStr =
          targetExam.startDate instanceof Date
            ? targetExam.startDate.toISOString().slice(0, 10)
            : String(targetExam.startDate).slice(0, 10);
        const examEndDateStr =
          targetExam.endDate instanceof Date
            ? targetExam.endDate.toISOString().slice(0, 10)
            : String(targetExam.endDate).slice(0, 10);
        const spanTitle = `Examination: ${targetExam.name}`;
        const spanDesc = `Full Examination Span: ${targetExam.name} | [examId:${targetExam.id}] ${examSpanTag}`;

        const existingSpan = await scopedDb.query.academicCalendarEvents.findFirst({
          where: and(
            eq(academicCalendarEvents.schoolId, schoolId),
            or(
              eq(academicCalendarEvents.examSpanSourceId, targetExam.id),
              like(academicCalendarEvents.description, `%${examSpanTag}%`),
            ),
          ),
        });

        if (existingSpan) {
          await scopedDb
            .update(academicCalendarEvents)
            .set({
              title: spanTitle,
              startDate: examStartDateStr,
              endDate: examEndDateStr,
              description: spanDesc,
              isWorkingDay: true,
              isActive: true,
              examSpanSourceId: targetExam.id,
              updatedAt: new Date(),
            })
            .where(eq(academicCalendarEvents.id, existingSpan.id));
        } else {
          await scopedDb.insert(academicCalendarEvents).values({
            schoolId,
            academicYearId,
            title: spanTitle,
            eventType: "EXAM",
            startDate: examStartDateStr,
            endDate: examEndDateStr,
            description: spanDesc,
            isWorkingDay: true,
            isActive: true,
            examSpanSourceId: targetExam.id,
          });
        }
        syncedSpanCount = 1;
      }

      return {
        success: true,
        syncedPapersCount,
        syncedSpanCount,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sync datesheet to calendar";
      console.error("[ExamCalendarSync] syncDatesheetToCalendar error:", message);
      return {
        success: false,
        syncedPapersCount: 0,
        syncedSpanCount: 0,
        error: message,
      };
    }
  });
}

/**
 * Removes calendar rows when an exam or datesheet is unpublished or deleted.
 */
export async function removeDatesheetFromCalendar(input: {
  schoolId: string;
  examId?: string;
  scheduleIds?: string[];
}): Promise<RemoveCalendarResult> {
  const { schoolId, examId, scheduleIds } = input;
  return await withTenant(schoolId, async (scopedDb) => {
    try {
      let removedCount = 0;

      if (scheduleIds && scheduleIds.length > 0) {
        for (const scheduleId of scheduleIds) {
          const scheduleTag = `[examScheduleId:${scheduleId}]`;
          const res = await scopedDb
            .delete(academicCalendarEvents)
            .where(
              and(
                eq(academicCalendarEvents.schoolId, schoolId),
                or(
                  eq(academicCalendarEvents.examScheduleId, scheduleId),
                  like(academicCalendarEvents.description, `%${scheduleTag}%`),
                ),
              ),
            )
            .returning();
          removedCount += res.length;
        }
      } else if (examId) {
        const examTag = `[examId:${examId}]`;
        const res = await scopedDb
          .delete(academicCalendarEvents)
          .where(
            and(
              eq(academicCalendarEvents.schoolId, schoolId),
              or(
                eq(academicCalendarEvents.examSpanSourceId, examId),
                like(academicCalendarEvents.description, `%${examTag}%`),
              ),
            ),
          )
          .returning();
        removedCount += res.length;
      }

      return { success: true, removedCount };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to remove datesheet from calendar";
      console.error(
        "[ExamCalendarSync] removeDatesheetFromCalendar error:",
        message,
      );
      return { success: false, removedCount: 0, error: message };
    }
  });
}
