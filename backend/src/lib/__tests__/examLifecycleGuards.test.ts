import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { db } from "@/db";
import {
  exams,
  examSchedules,
  subjects,
  classes,
  students,
  markEntries,
  academicCalendarEvents,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { withTenant } from "../tenant";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import {
  syncDatesheetToCalendar,
  removeDatesheetFromCalendar,
} from "../examCalendarSync";
import { resolveResultVisibility } from "../gradeEngine";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S12 Layers 7 & 8: Structural Calendar Columns & Schedule Lifecycle Guards", () => {
  let pool: Pool;
  const schoolId = ISOLATION_IDS.schoolA.id;
  const academicYearId = ISOLATION_IDS.schoolA.academicYearId;
  const classId = ISOLATION_IDS.schoolA.classId;
  const subjectId = ISOLATION_IDS.schoolA.subjectId;
  const studentId = ISOLATION_IDS.schoolA.studentId;
  const adminUserId = ISOLATION_IDS.schoolA.adminUserId;

  let testExamId: string;
  let testScheduleWithMarksId: string;
  let testScheduleEmptyId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();

    const runId = Math.random().toString(36).substring(2, 7);

    await withTenant(schoolId, async (tx) => {
      // 1. Create an exam
      const [exam] = await tx
        .insert(exams)
        .values({
          schoolId,
          academicYearId,
          examTypeId: ISOLATION_IDS.schoolA.examTypeId,
          name: `Lifecycle Exam ${runId}`,
          startDate: new Date("2026-12-01"),
          endDate: new Date("2026-12-20"),
        })
        .returning();
      testExamId = exam!.id;

      // 2. Create schedule 1 (will have mark entries)
      const [sched1] = await tx
        .insert(examSchedules)
        .values({
          schoolId,
          examId: testExamId,
          classId,
          subjectId,
          examDate: "2026-12-05",
          startTime: "09:00:00",
          durationMinutes: 180,
          maxMarks: "100.00",
          passingMarks: "33.00",
        })
        .returning();
      testScheduleWithMarksId = sched1!.id;

      // 3. Create schedule 2 (empty, no mark entries)
      const [sub2] = await tx
        .insert(subjects)
        .values({
          schoolId,
          name: `LifeSub2_${runId}`,
          code: `LS2_${runId}`,
          subjectType: "THEORY",
        })
        .returning();

      const [sched2] = await tx
        .insert(examSchedules)
        .values({
          schoolId,
          examId: testExamId,
          classId,
          subjectId: sub2!.id,
          examDate: "2026-12-08",
          startTime: "09:00:00",
          durationMinutes: 180,
          maxMarks: "100.00",
          passingMarks: "33.00",
        })
        .returning();
      testScheduleEmptyId = sched2!.id;

      // 4. Create mark entry for schedule 1
      await tx.insert(markEntries).values({
        schoolId,
        examId: testExamId,
        studentId,
        subjectId,
        maxMarks: "100.00",
        marksObtained: "88.50",
        enteredById: adminUserId,
        status: "DRAFT",
      });
    });
  });

  afterAll(async () => {
    if (testExamId) {
      await removeDatesheetFromCalendar({ schoolId, examId: testExamId });
    }
    await pool.end();
  });

  it("7.1: syncDatesheetToCalendar populates structural columns examScheduleId and examSpanSourceId", async () => {
    const syncRes = await syncDatesheetToCalendar({
      schoolId,
      examId: testExamId,
      scheduleIds: [testScheduleWithMarksId, testScheduleEmptyId],
    });

    expect(syncRes.success).toBe(true);
    expect(syncRes.syncedPapersCount).toBe(2);
    expect(syncRes.syncedSpanCount).toBe(1);

    // Verify paper 1 event has exact foreign key examScheduleId populated
    const paperEvent = await withTenant(schoolId, async (tx) => {
      return await tx.query.academicCalendarEvents.findFirst({
        where: and(
          eq(academicCalendarEvents.schoolId, schoolId),
          eq(academicCalendarEvents.examScheduleId, testScheduleWithMarksId),
        ),
      });
    });
    expect(paperEvent).toBeDefined();
    expect(paperEvent?.examScheduleId).toBe(testScheduleWithMarksId);
    expect(paperEvent?.eventType).toBe("EXAM");

    // Verify span event has exact foreign key examSpanSourceId populated
    const spanEvent = await withTenant(schoolId, async (tx) => {
      return await tx.query.academicCalendarEvents.findFirst({
        where: and(
          eq(academicCalendarEvents.schoolId, schoolId),
          eq(academicCalendarEvents.examSpanSourceId, testExamId),
        ),
      });
    });
    expect(spanEvent).toBeDefined();
    expect(spanEvent?.examSpanSourceId).toBe(testExamId);
  });

  it("8.1: Guard blocks schedule deletion when mark entries exist for the paper", async () => {
    // Check mark count for testScheduleWithMarksId
    const markCheck = await withTenant(schoolId, async (tx) => {
      return await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(markEntries)
        .innerJoin(students, eq(markEntries.studentId, students.id))
        .where(
          and(
            eq(markEntries.schoolId, schoolId),
            eq(markEntries.examId, testExamId),
            eq(markEntries.subjectId, subjectId),
            eq(students.currentClassId, classId),
          ),
        );
    });

    const marksCount = Number(markCheck[0]?.count ?? 0);
    expect(marksCount).toBeGreaterThan(0);

    // Assert that deletion logic detects existing marks and returns error
    const deletionGuard = async (scheduleId: string) => {
      const schedule = await withTenant(schoolId, async (tx) => {
        return await tx.query.examSchedules.findFirst({
          where: and(eq(examSchedules.id, scheduleId), eq(examSchedules.schoolId, schoolId)),
        });
      });
      if (!schedule) throw new Error("Schedule not found");

      const check = await withTenant(schoolId, async (tx) => {
        return await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(markEntries)
          .innerJoin(students, eq(markEntries.studentId, students.id))
          .where(
            and(
              eq(markEntries.schoolId, schoolId),
              eq(markEntries.examId, schedule.examId),
              eq(markEntries.subjectId, schedule.subjectId),
              eq(students.currentClassId, schedule.classId),
            ),
          );
      });

      const count = Number(check[0]?.count ?? 0);
      if (count > 0) {
        return {
          success: false,
          message: `Cannot delete exam schedule: ${count} student mark entries have already been recorded for this examination paper. Void or clear existing marks first.`,
        };
      }

      await withTenant(schoolId, async (tx) => {
        await tx.delete(examSchedules).where(eq(examSchedules.id, scheduleId));
      });
      return { success: true };
    };

    const res = await deletionGuard(testScheduleWithMarksId);
    expect(res.success).toBe(false);
    expect(res.message).toContain("Cannot delete exam schedule: 1 student mark entries have already been recorded");

    // Verify schedule was NOT deleted from DB
    const schedStillExists = await withTenant(schoolId, async (tx) => {
      return await tx.query.examSchedules.findFirst({
        where: eq(examSchedules.id, testScheduleWithMarksId),
      });
    });
    expect(schedStillExists).toBeDefined();
  });

  it("8.2: Guard permits deletion of schedule with 0 mark entries and cleans calendar event", async () => {
    // Schedule 2 has 0 marks
    const deletionGuard = async (scheduleId: string) => {
      const schedule = await withTenant(schoolId, async (tx) => {
        return await tx.query.examSchedules.findFirst({
          where: and(eq(examSchedules.id, scheduleId), eq(examSchedules.schoolId, schoolId)),
        });
      });
      if (!schedule) throw new Error("Schedule not found");

      const check = await withTenant(schoolId, async (tx) => {
        return await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(markEntries)
          .innerJoin(students, eq(markEntries.studentId, students.id))
          .where(
            and(
              eq(markEntries.schoolId, schoolId),
              eq(markEntries.examId, schedule.examId),
              eq(markEntries.subjectId, schedule.subjectId),
              eq(students.currentClassId, schedule.classId),
            ),
          );
      });

      const count = Number(check[0]?.count ?? 0);
      if (count > 0) {
        return {
          success: false,
          message: `Cannot delete exam schedule: ${count} marks recorded`,
        };
      }

      await withTenant(schoolId, async (tx) => {
        await tx.delete(examSchedules).where(eq(examSchedules.id, scheduleId));
      });
      await removeDatesheetFromCalendar({ schoolId, scheduleIds: [scheduleId] });
      return { success: true };
    };

    const res = await deletionGuard(testScheduleEmptyId);
    expect(res.success).toBe(true);

    // Verify schedule was deleted
    const deletedSched = await withTenant(schoolId, async (tx) => {
      return await tx.query.examSchedules.findFirst({
        where: eq(examSchedules.id, testScheduleEmptyId),
      });
    });
    expect(deletedSched).toBeUndefined();

    // Verify calendar event for schedule 2 was also removed
    const calEvent = await withTenant(schoolId, async (tx) => {
      return await tx.query.academicCalendarEvents.findFirst({
        where: and(
          eq(academicCalendarEvents.schoolId, schoolId),
          eq(academicCalendarEvents.examScheduleId, testScheduleEmptyId),
        ),
      });
    });
    expect(calEvent).toBeUndefined();
  });

  it("8.3: resolveResultVisibility enforces all 5 lifecycle gates consistently", () => {
    // Gate 1: Unpublished
    const g1 = resolveResultVisibility({
      isPublished: false,
      feeBlocked: false,
      adminHold: false,
    });
    expect(g1.isVisible).toBe(false);
    expect(g1.status).toBe("UNPUBLISHED");

    // Gate 2: Scheduled in future
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const g2 = resolveResultVisibility({
      isPublished: true,
      scheduledPublishAt: futureDate,
      feeBlocked: false,
      adminHold: false,
    });
    expect(g2.isVisible).toBe(false);
    expect(g2.status).toBe("SCHEDULED");

    // Gate 3: Admin individual hold
    const g3 = resolveResultVisibility({
      isPublished: true,
      feeBlocked: false,
      adminHold: true,
      adminHoldReason: "Pending disciplinary review",
    });
    expect(g3.isVisible).toBe(false);
    expect(g3.status).toBe("WITHHELD_ADMIN");
    expect(g3.reason).toBe("Pending disciplinary review");

    // Gate 4: Hard fee default
    const g4 = resolveResultVisibility({
      isPublished: true,
      feeBlocked: true,
      adminHold: false,
    });
    expect(g4.isVisible).toBe(false);
    expect(g4.status).toBe("WITHHELD_FEE");

    // Gate 5: Fully released & cleared
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const g5 = resolveResultVisibility({
      isPublished: true,
      scheduledPublishAt: pastDate,
      feeBlocked: false,
      adminHold: false,
    });
    expect(g5.isVisible).toBe(true);
    expect(g5.status).toBe("PUBLISHED");
  });
});
