import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  syncDatesheetToCalendar,
  removeDatesheetFromCalendar,
} from "../examCalendarSync";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { db } from "@/db";
import {
  academicCalendarEvents,
  exams,
  examSchedules,
  subjects,
} from "@/db/schema";
import { eq, and, like } from "drizzle-orm";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S11 Layer 4: Academic Calendar & Events Synchronization", () => {
  let pool: Pool;
  const schoolA = ISOLATION_IDS.schoolA.id;
  const schoolB = ISOLATION_IDS.schoolB.id;
  let testExamAId: string;
  let testScheduleA1Id: string;
  let testScheduleA2Id: string;
  let testExamBId: string;
  let testScheduleBId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();

    const runId = Math.random().toString(36).substring(2, 7);

    // 1. Create Exam for School A
    const [examA] = await db
      .insert(exams)
      .values({
        schoolId: schoolA,
        academicYearId: ISOLATION_IDS.schoolA.academicYearId,
        examTypeId: ISOLATION_IDS.schoolA.examTypeId,
        name: `S11 Layer 4 Exam A ${runId}`,
        startDate: new Date("2026-12-01"),
        endDate: new Date("2026-12-15"),
      })
      .returning();
    testExamAId = examA.id;

    // 2. Create 2 schedules for Exam A
    const [schedA1] = await db
      .insert(examSchedules)
      .values({
        schoolId: schoolA,
        examId: testExamAId,
        classId: ISOLATION_IDS.schoolA.classId,
        subjectId: ISOLATION_IDS.schoolA.subjectId,
        examDate: "2026-12-03",
        startTime: "09:30:00",
        durationMinutes: 180,
        maxMarks: "100.00",
        passingMarks: "33.00",
      })
      .returning();
    testScheduleA1Id = schedA1.id;

    const [sub2] = await db
      .insert(subjects)
      .values({
        schoolId: schoolA,
        name: `Science ${runId}`,
        code: `SCI_${runId}`,
        subjectType: "THEORY",
      })
      .returning();

    const [schedA2] = await db
      .insert(examSchedules)
      .values({
        schoolId: schoolA,
        examId: testExamAId,
        classId: ISOLATION_IDS.schoolA.classId,
        subjectId: sub2.id,
        examDate: "2026-12-05",
        startTime: "09:30:00",
        durationMinutes: 180,
        maxMarks: "100.00",
        passingMarks: "33.00",
      })
      .returning();
    testScheduleA2Id = schedA2.id;

    // 3. Create Exam and schedule for School B
    const [examB] = await db
      .insert(exams)
      .values({
        schoolId: schoolB,
        academicYearId: ISOLATION_IDS.schoolB.academicYearId,
        examTypeId: ISOLATION_IDS.schoolB.examTypeId,
        name: `S11 Layer 4 Exam B ${runId}`,
        startDate: new Date("2026-12-01"),
        endDate: new Date("2026-12-15"),
      })
      .returning();
    testExamBId = examB.id;

    const [schedB] = await db
      .insert(examSchedules)
      .values({
        schoolId: schoolB,
        examId: testExamBId,
        classId: ISOLATION_IDS.schoolB.classId,
        subjectId: ISOLATION_IDS.schoolB.subjectId,
        examDate: "2026-12-04",
        startTime: "10:00:00",
        durationMinutes: 120,
        maxMarks: "80.00",
        passingMarks: "26.00",
      })
      .returning();
    testScheduleBId = schedB.id;
  });

  afterAll(async () => {
    // Cleanup calendar rows for tests
    if (testExamAId) {
      await removeDatesheetFromCalendar({ schoolId: schoolA, examId: testExamAId });
    }
    if (testExamBId) {
      await removeDatesheetFromCalendar({ schoolId: schoolB, examId: testExamBId });
    }
    await pool.end();
  });

  it("4.1: syncDatesheetToCalendar creates calendar event rows for each schedule paper with eventType='EXAM' and isWorkingDay=true", async () => {
    const res = await syncDatesheetToCalendar({
      schoolId: schoolA,
      scheduleIds: [testScheduleA1Id, testScheduleA2Id],
    });

    expect(res.success).toBe(true);
    expect(res.syncedPapersCount).toBe(2);
    expect(res.syncedSpanCount).toBe(1);

    // Verify rows in academicCalendarEvents for paper 1
    const p1Event = await db.query.academicCalendarEvents.findFirst({
      where: and(
        eq(academicCalendarEvents.schoolId, schoolA),
        like(academicCalendarEvents.description, `%[examScheduleId:${testScheduleA1Id}]%`),
      ),
    });

    expect(p1Event).toBeDefined();
    expect(p1Event?.eventType).toBe("EXAM");
    expect(p1Event?.isWorkingDay).toBe(true);
    expect(p1Event?.startDate).toBe("2026-12-03");
    expect(p1Event?.endDate).toBe("2026-12-03");
    expect(p1Event?.title).toContain("("); // e.g. Subject Name (Class DisplayName)
  });

  it("4.2: syncDatesheetToCalendar creates a whole-exam span row in academic_calendar_events", async () => {
    const spanEvent = await db.query.academicCalendarEvents.findFirst({
      where: and(
        eq(academicCalendarEvents.schoolId, schoolA),
        like(academicCalendarEvents.description, `%[examSpanId:${testExamAId}]%`),
      ),
    });

    expect(spanEvent).toBeDefined();
    expect(spanEvent?.eventType).toBe("EXAM");
    expect(spanEvent?.isWorkingDay).toBe(true);
    expect(spanEvent?.startDate).toBe("2026-12-01");
    expect(spanEvent?.endDate).toBe("2026-12-15");
    expect(spanEvent?.title).toContain("Examination:");
  });

  it("4.3: Idempotency: re-running syncDatesheetToCalendar updates existing rows without duplicating", async () => {
    // Count before
    const beforeCount = await db.query.academicCalendarEvents.findMany({
      where: and(
        eq(academicCalendarEvents.schoolId, schoolA),
        like(academicCalendarEvents.description, `%[examId:${testExamAId}]%`),
      ),
    });
    expect(beforeCount.length).toBe(3); // 2 papers + 1 span

    // Re-run sync
    const res = await syncDatesheetToCalendar({
      schoolId: schoolA,
      scheduleIds: [testScheduleA1Id, testScheduleA2Id],
    });
    expect(res.success).toBe(true);

    // Count after: exactly 3 rows
    const afterCount = await db.query.academicCalendarEvents.findMany({
      where: and(
        eq(academicCalendarEvents.schoolId, schoolA),
        like(academicCalendarEvents.description, `%[examId:${testExamAId}]%`),
      ),
    });
    expect(afterCount.length).toBe(3);
  });

  it("4.4: removeDatesheetFromCalendar with scheduleIds removes only specified schedule paper rows", async () => {
    const res = await removeDatesheetFromCalendar({
      schoolId: schoolA,
      scheduleIds: [testScheduleA1Id],
    });

    expect(res.success).toBe(true);
    expect(res.removedCount).toBe(1);

    // Paper 1 event should be gone
    const p1Event = await db.query.academicCalendarEvents.findFirst({
      where: and(
        eq(academicCalendarEvents.schoolId, schoolA),
        like(academicCalendarEvents.description, `%[examScheduleId:${testScheduleA1Id}]%`),
      ),
    });
    expect(p1Event).toBeUndefined();

    // Paper 2 event should remain
    const p2Event = await db.query.academicCalendarEvents.findFirst({
      where: and(
        eq(academicCalendarEvents.schoolId, schoolA),
        like(academicCalendarEvents.description, `%[examScheduleId:${testScheduleA2Id}]%`),
      ),
    });
    expect(p2Event).toBeDefined();
  });

  it("4.5: removeDatesheetFromCalendar with examId removes all schedule paper events and span event", async () => {
    const res = await removeDatesheetFromCalendar({
      schoolId: schoolA,
      examId: testExamAId,
    });

    expect(res.success).toBe(true);

    const remaining = await db.query.academicCalendarEvents.findMany({
      where: and(
        eq(academicCalendarEvents.schoolId, schoolA),
        like(academicCalendarEvents.description, `%[examId:${testExamAId}]%`),
      ),
    });
    expect(remaining.length).toBe(0);
  });

  it("4.6: Multi-tenant isolation: School A calendar sync cannot touch or see School B calendar rows", async () => {
    // Sync School B schedule
    const resB = await syncDatesheetToCalendar({
      schoolId: schoolB,
      scheduleIds: [testScheduleBId],
    });
    expect(resB.success).toBe(true);

    // Attempt to remove School B schedule using School A context
    const resCross = await removeDatesheetFromCalendar({
      schoolId: schoolA,
      scheduleIds: [testScheduleBId],
    });
    expect(resCross.removedCount).toBe(0);

    // Verify School B's event is untouched
    const bEvent = await db.query.academicCalendarEvents.findFirst({
      where: and(
        eq(academicCalendarEvents.schoolId, schoolB),
        like(academicCalendarEvents.description, `%[examScheduleId:${testScheduleBId}]%`),
      ),
    });
    expect(bEvent).toBeDefined();
  });
});
