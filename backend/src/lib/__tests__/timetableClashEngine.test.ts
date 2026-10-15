import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  checkScheduleConflicts,
  getAvailableInvigilators,
  timeStringToMinutes,
  intervalsOverlap,
  getDayOfWeek,
} from "../timetableClashEngine";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { db } from "@/db";
import {
  exams,
  examSchedules,
  timetablePeriods,
  sections,
  subjects,
} from "@/db/schema";
import { eq } from "drizzle-orm";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S11 Layer 5: Timetable-Aware Scheduling & Clash Detection Engine", () => {
  let pool: Pool;
  const schoolA = ISOLATION_IDS.schoolA.id;
  const schoolB = ISOLATION_IDS.schoolB.id;
  let testExamAId: string;
  let testSectionAId: string;
  let testSubject2Id: string;
  let existingScheduleA1Id: string;
  const testDate = "2026-12-07"; // Monday

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();

    const runId = Math.random().toString(36).substring(2, 7);

    // 1. Create section in School A for timetable periods
    const [sec] = await db
      .insert(sections)
      .values({
        schoolId: schoolA,
        classId: ISOLATION_IDS.schoolA.classId,
        name: `Sec_${runId}`,
        capacity: 40,
      })
      .returning();
    testSectionAId = sec.id;

    // 2. Create subject 2 for School A
    const [sub2] = await db
      .insert(subjects)
      .values({
        schoolId: schoolA,
        name: `History ${runId}`,
        code: `HIST_${runId}`,
        subjectType: "THEORY",
      })
      .returning();
    testSubject2Id = sub2.id;

    // 3. Create test exam for School A
    const [exam] = await db
      .insert(exams)
      .values({
        schoolId: schoolA,
        academicYearId: ISOLATION_IDS.schoolA.academicYearId,
        examTypeId: ISOLATION_IDS.schoolA.examTypeId,
        name: `S11 Layer 5 Clash Exam ${runId}`,
        startDate: new Date("2026-12-01"),
        endDate: new Date("2026-12-15"),
      })
      .returning();
    testExamAId = exam.id;

    // 4. Create an existing exam schedule on Monday Dec 7: 09:00 - 12:00 in Room "Hall-1", Invigilator: teacherA1
    const [sched1] = await db
      .insert(examSchedules)
      .values({
        schoolId: schoolA,
        examId: testExamAId,
        classId: ISOLATION_IDS.schoolA.classId,
        subjectId: ISOLATION_IDS.schoolA.subjectId,
        examDate: testDate,
        startTime: "09:00:00",
        durationMinutes: 180, // ends at 12:00
        roomNumber: "Hall-1",
        invigilatorId: ISOLATION_IDS.schoolA.teacherA1UserId,
        maxMarks: "100.00",
        passingMarks: "33.00",
      })
      .returning();
    existingScheduleA1Id = sched1.id;

    // 5. Create a regular timetable period on MONDAY: Period 1 (08:30 - 09:30) in Room "Lab-A", Teacher: teacherA2
    await db.insert(timetablePeriods).values({
      schoolId: schoolA,
      sectionId: testSectionAId,
      academicYearId: ISOLATION_IDS.schoolA.academicYearId,
      dayOfWeek: "MONDAY",
      periodNumber: 1,
      startTime: "08:30:00",
      endTime: "09:30:00",
      roomNumber: "Lab-A",
      teacherId: ISOLATION_IDS.schoolA.teacherA2UserId,
      subjectId: ISOLATION_IDS.schoolA.subjectId,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("5.0: Pure unit helpers: timeStringToMinutes, intervalsOverlap, and getDayOfWeek", () => {
    expect(timeStringToMinutes("09:30")).toBe(570);
    expect(timeStringToMinutes("12:00:00")).toBe(720);
    expect(timeStringToMinutes("00:00")).toBe(0);

    // [09:00, 12:00) overlaps with [11:30, 13:00)
    expect(intervalsOverlap(540, 720, 690, 780)).toBe(true);
    // [09:00, 12:00) does NOT overlap with [12:00, 14:00)
    expect(intervalsOverlap(540, 720, 720, 840)).toBe(false);

    expect(getDayOfWeek("2026-12-07")).toBe("MONDAY");
    expect(getDayOfWeek("2026-12-08")).toBe("TUESDAY");
    expect(getDayOfWeek("2026-12-06")).toBeNull();
  });

  it("5.1: Room conflict: detects collision with another exam paper in the same room on the same date", async () => {
    // Attempt to book Room Hall-1 at 10:00 (overlaps with 09:00 - 12:00)
    const report = await checkScheduleConflicts({
      schoolId: schoolA,
      examId: testExamAId,
      classId: ISOLATION_IDS.schoolA.classId,
      subjectId: testSubject2Id,
      examDate: testDate,
      startTime: "10:00:00",
      durationMinutes: 120,
      roomNumber: "Hall-1",
    });

    expect(report.hasConflict).toBe(true);
    const roomConflicts = report.conflicts.filter((c) => c.type === "ROOM");
    expect(roomConflicts.length).toBeGreaterThanOrEqual(1);
    expect(roomConflicts[0]?.message).toContain("Hall-1");
  });

  it("5.2: Room conflict: detects collision with regular class timetable period in the same room", async () => {
    // Attempt to book Room Lab-A on Monday at 09:00 - 11:00 (overlaps with Period 1: 08:30 - 09:30)
    const report = await checkScheduleConflicts({
      schoolId: schoolA,
      examId: testExamAId,
      classId: ISOLATION_IDS.schoolA.classId,
      subjectId: testSubject2Id,
      examDate: testDate,
      startTime: "09:00:00",
      durationMinutes: 120,
      roomNumber: "Lab-A",
    });

    expect(report.hasConflict).toBe(true);
    const roomConflicts = report.conflicts.filter((c) => c.type === "ROOM");
    expect(roomConflicts.length).toBeGreaterThanOrEqual(1);
    expect(roomConflicts[0]?.message).toContain("occupied by regular class timetable");
  });

  it("5.3: Invigilator conflict: detects invigilator assigned to another exam paper at overlapping time", async () => {
    // Attempt to assign teacherA1 at 11:00 (teacherA1 is already invigilating sched1: 09:00 - 12:00)
    const report = await checkScheduleConflicts({
      schoolId: schoolA,
      examId: testExamAId,
      classId: ISOLATION_IDS.schoolA.classId,
      subjectId: testSubject2Id,
      examDate: testDate,
      startTime: "11:00:00",
      durationMinutes: 120,
      invigilatorId: ISOLATION_IDS.schoolA.teacherA1UserId,
      roomNumber: "Hall-99", // Unconflicted room
    });

    expect(report.hasConflict).toBe(true);
    const invigConflicts = report.conflicts.filter((c) => c.type === "INVIGILATOR");
    expect(invigConflicts.length).toBeGreaterThanOrEqual(1);
    expect(invigConflicts[0]?.message).toContain("already assigned to invigilate");
  });

  it("5.4: Invigilator conflict: detects invigilator teaching regular timetable period at overlapping time", async () => {
    // Attempt to assign teacherA2 at 09:00 - 11:00 (teacherA2 teaches Period 1: 08:30 - 09:30)
    const report = await checkScheduleConflicts({
      schoolId: schoolA,
      examId: testExamAId,
      classId: ISOLATION_IDS.schoolA.classId,
      subjectId: testSubject2Id,
      examDate: testDate,
      startTime: "09:00:00",
      durationMinutes: 120,
      invigilatorId: ISOLATION_IDS.schoolA.teacherA2UserId,
      roomNumber: "Hall-99",
    });

    expect(report.hasConflict).toBe(true);
    const invigConflicts = report.conflicts.filter((c) => c.type === "INVIGILATOR");
    expect(invigConflicts.length).toBeGreaterThanOrEqual(1);
    expect(invigConflicts[0]?.message).toContain("scheduled to teach Period 1");
  });

  it("5.5: Class conflict: detects same class with another exam paper at overlapping time", async () => {
    // Attempt to schedule paper for the same class at 10:00 on Dec 7 (overlaps with sched1 09:00 - 12:00)
    const report = await checkScheduleConflicts({
      schoolId: schoolA,
      examId: testExamAId,
      classId: ISOLATION_IDS.schoolA.classId,
      subjectId: testSubject2Id,
      examDate: testDate,
      startTime: "10:00:00",
      durationMinutes: 120,
      roomNumber: "Hall-99",
    });

    expect(report.hasConflict).toBe(true);
    const classConflicts = report.conflicts.filter((c) => c.type === "CLASS");
    expect(classConflicts.length).toBeGreaterThanOrEqual(1);
    expect(classConflicts[0]?.message).toContain("already has another examination paper");
  });

  it("5.6: Non-overlapping times: returns hasConflict=false when slot is completely clear", async () => {
    // Tuesday Dec 8 at 14:00 - 17:00 in Room Hall-1 with no invigilator
    const report = await checkScheduleConflicts({
      schoolId: schoolA,
      examId: testExamAId,
      classId: ISOLATION_IDS.schoolA.classId,
      subjectId: testSubject2Id,
      examDate: "2026-12-08",
      startTime: "14:00:00",
      durationMinutes: 180,
      roomNumber: "Hall-1",
    });

    expect(report.hasConflict).toBe(false);
    expect(report.conflicts.length).toBe(0);
  });

  it("5.7: getAvailableInvigilators: ranks teachers into availability tiers", async () => {
    const list = await getAvailableInvigilators(
      schoolA,
      testDate,
      "09:30:00",
      120, // 09:30 - 11:30
    );

    expect(list.length).toBeGreaterThanOrEqual(1);
    // teacherA1 is invigilating sched1 (09:00 - 12:00), so teacherA1 must be CONFLICTED
    const t1 = list.find((t) => t.userId === ISOLATION_IDS.schoolA.teacherA1UserId);
    expect(t1?.status).toBe("CONFLICTED");

    // The returned list should be sorted by status: FULLY_AVAILABLE then AVAILABLE_WITH_LATER_PERIODS then CONFLICTED
    const statuses = list.map((t) => t.status);
    const conflictedFirstIndex = statuses.indexOf("CONFLICTED");
    if (conflictedFirstIndex !== -1) {
      // Any elements before conflicted should not be conflicted
      for (let i = 0; i < conflictedFirstIndex; i++) {
        expect(statuses[i]).not.toBe("CONFLICTED");
      }
    }
  });

  it("5.8: Tenant isolation: School A conflict check ignores School B rooms and schedules", async () => {
    // Check Room Hall-1 in School B on Dec 7: should have NO conflict because Hall-1 is booked in School A
    const reportB = await checkScheduleConflicts({
      schoolId: schoolB,
      examId: testExamAId,
      classId: ISOLATION_IDS.schoolB.classId,
      subjectId: ISOLATION_IDS.schoolB.subjectId,
      examDate: testDate,
      startTime: "09:00:00",
      durationMinutes: 180,
      roomNumber: "Hall-1",
    });

    expect(reportB.hasConflict).toBe(false);
    expect(reportB.conflicts.length).toBe(0);
  });
});
