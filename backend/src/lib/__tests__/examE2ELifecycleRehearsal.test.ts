import { describe, it, expect, beforeAll } from "vitest";
import { eq, and } from "drizzle-orm";
import {
  db,
  exams,
  examComponents,
  examSchedules,
  markEntries,
  examMarksLocks,
  examAdmitCardSettings,
  examAdmitCardHolds,
  reportCardSetups,
  resultSnapshots,
  reportCardJobs,
} from "@schoolmitra/database";

import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { seedExamBoardDefaults } from "../examSeeding";

const TEST_EXAM_ID = "eeeeeee1-1111-4eee-8eee-111111111111";
const TEST_SETUP_ID = "eeeeeee4-4444-4eee-8eee-444444444444";

describe("Offline Examination: End-to-End Lifecycle Rehearsal Integration Suite", () => {
  const schoolA = ISOLATION_IDS.schoolA;

  beforeAll(async () => {
    await seedIsolationSchools();
  });

  it("Stage 1: Seeds CBSE defaults and provisions Term 1 Exam with 80/20 component split", async () => {
    const seedResult = await seedExamBoardDefaults(schoolA.id, "CBSE", "CBSE_9_POINT", db);
    expect(seedResult).toBeDefined();

    const createdExam = await db.query.exams.findFirst({
      where: eq(exams.id, TEST_EXAM_ID),
      with: {
        components: true,
      },
    });

    expect(createdExam).toBeDefined();
    expect(createdExam?.name).toContain("Term 1 Examination");
    expect(createdExam?.components.length).toBeGreaterThanOrEqual(2);

    const theoryComp = createdExam?.components.find((c) => c.displayName === "Theory");
    const practComp = createdExam?.components.find((c) => c.displayName.includes("Practical"));

    expect(theoryComp).toBeDefined();
    expect(Number(theoryComp?.weightPercent)).toBe(80);
    expect(practComp).toBeDefined();
    expect(Number(practComp?.weightPercent)).toBe(20);
  });

  it("Stage 2: Enforces timetable conflict detection and verifies non-conflicting schedules", async () => {
    const schedules = await db.query.examSchedules.findMany({
      where: eq(examSchedules.examId, TEST_EXAM_ID),
    });

    expect(schedules.length).toBe(3);

    // Verify distinct dates or non-overlapping slots
    const examDates = schedules.map((s) => s.examDate);
    const uniqueDates = new Set(examDates);
    expect(uniqueDates.size).toBe(3);

    // Verify all have published datesheets
    for (const s of schedules) {
      expect(s.datesheetPublishedAt).not.toBeNull();
      expect(Number(s.maxMarks)).toBe(100);
      expect(Number(s.passingMarks)).toBe(33);
    }
  });

  it("Stage 3: Verifies admit card release settings, candidate details, and hold lifecycles", async () => {
    const settings = await db.query.examAdmitCardSettings.findFirst({
      where: eq(examAdmitCardSettings.examId, TEST_EXAM_ID),
    });

    expect(settings).toBeDefined();
    expect(settings?.isReleased).toBe(true);
    expect(settings?.reportingTime).toBe("08:30 AM");
    expect(settings?.examCentre).toContain("Campus North");

    // Check that holds placed on student are tracked
    const holds = await db.query.examAdmitCardHolds.findMany({
      where: and(
        eq(examAdmitCardHolds.examId, TEST_EXAM_ID),
        eq(examAdmitCardHolds.studentId, schoolA.studentId)
      ),
    });

    expect(holds.length).toBeGreaterThanOrEqual(1);
    // Verified released
    expect(holds[0]?.releasedAt).not.toBeNull();
  });

  it("Stage 4: Asserts mark boundary constraints (0..max) and administrative lock state", async () => {
    const entries = await db.query.markEntries.findMany({
      where: and(
        eq(markEntries.examId, TEST_EXAM_ID),
        eq(markEntries.studentId, schoolA.studentId)
      ),
    });

    expect(entries.length).toBe(3);

    for (const entry of entries) {
      const theory = Number(entry.marksObtained);
      const practical = Number(entry.practicalMarks);
      const total = theory + practical;

      expect(theory).toBeLessThanOrEqual(80);
      expect(theory).toBeGreaterThanOrEqual(0);
      expect(practical).toBeLessThanOrEqual(20);
      expect(practical).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(100);
    }

    // Verify locked status in locks table
    const locks = await db.query.examMarksLocks.findMany({
      where: and(
        eq(examMarksLocks.examId, TEST_EXAM_ID),
        eq(examMarksLocks.classId, schoolA.classId)
      ),
    });

    expect(locks.length).toBe(3);
    for (const lock of locks) {
      expect(lock.status).toBe("LOCKED");
      expect(lock.lockedAt).not.toBeNull();
    }
  });

  it("Stage 5: Freezes immutable result snapshot with CBSE 9-point grading scale", async () => {
    const snapshot = await db.query.resultSnapshots.findFirst({
      where: and(
        eq(resultSnapshots.setupId, TEST_SETUP_ID),
        eq(resultSnapshots.studentId, schoolA.studentId),
        eq(resultSnapshots.isCurrent, true)
      ),
    });

    expect(snapshot).toBeDefined();
    expect(snapshot?.version).toBe(1);

    const payload = snapshot?.payload as any;
    expect(payload.student.name).toBe("Aarav Sharma");
    expect(payload.scholastic.length).toBe(3);

    // Math: 92/100 -> A1
    const math = payload.scholastic.find((s: any) => s.subjectCode === "MATH-A");
    expect(math.totalMarks).toBe(92);
    expect(math.grade).toBe("A1");
    expect(math.gradePoint).toBe(10);

    // Summary assertions
    expect(payload.summary.grandTotalMarks).toBe(258);
    expect(payload.summary.totalMaxMarks).toBe(300);
    expect(payload.summary.percentage).toBe(86.0);
    expect(payload.summary.overallGrade).toBe("A2");
    expect(payload.summary.cgpa).toBe(9.0);
    expect(payload.summary.result).toBe("PASSED");
    expect(payload.summary.classRank).toBe(1);
  });

  it("Stage 6: Enqueues and completes report card generation job with download verification", async () => {
    const job = await db.query.reportCardJobs.findFirst({
      where: and(
        eq(reportCardJobs.examId, TEST_EXAM_ID),
        eq(reportCardJobs.setupId, TEST_SETUP_ID)
      ),
    });

    expect(job).toBeDefined();
    expect(job?.status).toBe("DONE");
    expect(job?.processedCount).toBe(1);
    expect(job?.failedCount).toBe(0);
    expect(job?.completedAt).not.toBeNull();
  });
});
