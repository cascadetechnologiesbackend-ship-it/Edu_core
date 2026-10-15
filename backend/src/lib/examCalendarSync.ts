import { db } from "@/db";
import {
  academicCalendarEvents,
  examSchedules,
  exams,
} from "@/db/schema";
import { eq, and, inArray, like } from "drizzle-orm";

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
 * S11 Layer 4: Academic Calendar & Events Sync.
 * Idempotent: checks for existing calendar rows by schedule ID tag or exam span tag.
 */
export async function syncDatesheetToCalendar(input: {
  schoolId: string;
  examId?: string;
  scheduleIds?: string[];
  triggeredById?: string;
}): Promise<SyncCalendarResult> {
  try {
    const { schoolId, examId, scheduleIds } = input;

    // Fetch schedules
    let scheduleRows: any[] = [];
    if (scheduleIds && scheduleIds.length > 0) {
      scheduleRows = await db.query.examSchedules.findMany({
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
      scheduleRows = await db.query.examSchedules.findMany({
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

      // Check if existing calendar event exists for this schedule
      const existing = await db.query.academicCalendarEvents.findFirst({
        where: and(
          eq(academicCalendarEvents.schoolId, schoolId),
          like(academicCalendarEvents.description, `%${scheduleTag}%`),
        ),
      });

      if (existing) {
        await db
          .update(academicCalendarEvents)
          .set({
            title,
            startDate: examDateStr,
            endDate: examDateStr,
            description,
            isWorkingDay: true,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(academicCalendarEvents.id, existing.id));
      } else {
        await db.insert(academicCalendarEvents).values({
          schoolId,
          academicYearId,
          title,
          eventType: "EXAM",
          startDate: examDateStr,
          endDate: examDateStr,
          description,
          isWorkingDay: true,
          isActive: true,
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

      const existingSpan = await db.query.academicCalendarEvents.findFirst({
        where: and(
          eq(academicCalendarEvents.schoolId, schoolId),
          like(academicCalendarEvents.description, `%${examSpanTag}%`),
        ),
      });

      if (existingSpan) {
        await db
          .update(academicCalendarEvents)
          .set({
            title: spanTitle,
            startDate: examStartDateStr,
            endDate: examEndDateStr,
            description: spanDesc,
            isWorkingDay: true,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(academicCalendarEvents.id, existingSpan.id));
      } else {
        await db.insert(academicCalendarEvents).values({
          schoolId,
          academicYearId,
          title: spanTitle,
          eventType: "EXAM",
          startDate: examStartDateStr,
          endDate: examEndDateStr,
          description: spanDesc,
          isWorkingDay: true,
          isActive: true,
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
}

/**
 * Removes calendar rows when an exam or datesheet is unpublished or deleted.
 */
export async function removeDatesheetFromCalendar(input: {
  schoolId: string;
  examId?: string;
  scheduleIds?: string[];
}): Promise<RemoveCalendarResult> {
  try {
    const { schoolId, examId, scheduleIds } = input;
    let removedCount = 0;

    if (scheduleIds && scheduleIds.length > 0) {
      for (const scheduleId of scheduleIds) {
        const scheduleTag = `[examScheduleId:${scheduleId}]`;
        const res = await db
          .delete(academicCalendarEvents)
          .where(
            and(
              eq(academicCalendarEvents.schoolId, schoolId),
              like(academicCalendarEvents.description, `%${scheduleTag}%`),
            ),
          )
          .returning();
        removedCount += res.length;
      }
    } else if (examId) {
      const examTag = `[examId:${examId}]`;
      const res = await db
        .delete(academicCalendarEvents)
        .where(
          and(
            eq(academicCalendarEvents.schoolId, schoolId),
            like(academicCalendarEvents.description, `%${examTag}%`),
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
}
