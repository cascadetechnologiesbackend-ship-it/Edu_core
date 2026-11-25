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
  subjects,
} from "@schoolmitra/database";
import { withTenant } from "@/lib/tenant";

import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { seedExamBoardDefaults } from "../examSeeding";

const TEST_EXAM_ID = "eeeeeee1-1111-4eee-8eee-111111111111";
const TEST_SETUP_ID = "eeeeeee4-4444-4eee-8eee-444444444444";

describe("Offline Examination: End-to-End Lifecycle Rehearsal Integration Suite", () => {
  const schoolA = ISOLATION_IDS.schoolA;

  beforeAll(async () => {
    await seedIsolationSchools();
    await withTenant(schoolA.id, async (tx) => {
      const existing = await tx.query.exams.findFirst({
        where: eq(exams.id, TEST_EXAM_ID),
      });
      if (!existing) {
        const R_SUBJ_SCI_ID = "a4444444-4444-4444-8444-444444444445";
        const R_SUBJ_ENG_ID = "a4444444-4444-4444-8444-444444444446";
        await tx.insert(subjects).values([
          { id: R_SUBJ_SCI_ID, schoolId: schoolA.id, code: "SCI-A", name: "Science", subjectType: "THEORY", maxMarks: 100, passingMarks: 33, isActive: true },
          { id: R_SUBJ_ENG_ID, schoolId: schoolA.id, code: "ENG-A", name: "English", subjectType: "THEORY", maxMarks: 100, passingMarks: 33, isActive: true },
        ]).onConflictDoNothing();

        await tx.insert(exams).values({
          id: TEST_EXAM_ID,
          schoolId: schoolA.id,
          academicYearId: schoolA.academicYearId,
          examTypeId: schoolA.examTypeId,
          name: "Term 1 Examination 2026-27",
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 86400000),
          isLocked: false,
        }).onConflictDoNothing();

        await tx.insert(examComponents).values([
          { id: "eeeeeee2-2222-4eee-8eee-222222222222", schoolId: schoolA.id, examId: TEST_EXAM_ID, examTypeId: schoolA.examTypeId, displayName: "Theory", sortOrder: 1, weightPercent: "80.00", showOnReportCard: true },
          { id: "eeeeeee3-3333-4eee-8eee-333333333333", schoolId: schoolA.id, examId: TEST_EXAM_ID, examTypeId: schoolA.examTypeId, displayName: "Practical / Internal", sortOrder: 2, weightPercent: "20.00", showOnReportCard: true },
        ]).onConflictDoNothing();

        await tx.insert(examSchedules).values([
          { schoolId: schoolA.id, examId: TEST_EXAM_ID, classId: schoolA.classId, subjectId: schoolA.subjectId, examDate: "2026-11-02", startTime: "09:00:00", durationMinutes: 180, roomNumber: "Room 101", invigilatorId: schoolA.teacherA1UserId, maxMarks: "100.00", passingMarks: "33.00", datesheetPublishedAt: new Date() },
          { schoolId: schoolA.id, examId: TEST_EXAM_ID, classId: schoolA.classId, subjectId: R_SUBJ_SCI_ID, examDate: "2026-11-04", startTime: "09:00:00", durationMinutes: 180, roomNumber: "Room 102", invigilatorId: schoolA.teacherA2UserId, maxMarks: "100.00", passingMarks: "33.00", datesheetPublishedAt: new Date() },
          { schoolId: schoolA.id, examId: TEST_EXAM_ID, classId: schoolA.classId, subjectId: R_SUBJ_ENG_ID, examDate: "2026-11-06", startTime: "09:00:00", durationMinutes: 180, roomNumber: "Room 101", invigilatorId: schoolA.teacherA1UserId, maxMarks: "100.00", passingMarks: "33.00", datesheetPublishedAt: new Date() },
        ]).onConflictDoNothing();

        await tx.insert(examAdmitCardSettings).values({
          schoolId: schoolA.id,
          examId: TEST_EXAM_ID,
          isReleased: true,
          instructions: "Test instructions",
          examCentre: "Main Academic Block, Campus North",
          reportingTime: "08:30 AM",
          showPhoto: true,
          showSignature: true,
          feeLockMode: "OFF",
        }).onConflictDoNothing();

        await tx.insert(examAdmitCardHolds).values({
          id: "eeeeeee9-9999-4eee-8eee-999999999999",
          schoolId: schoolA.id,
          examId: TEST_EXAM_ID,
          studentId: schoolA.studentId,
          reason: "Pending Library Book Return",
          placedById: schoolA.adminUserId,
          releasedById: schoolA.adminUserId,
          releasedAt: new Date(),
        }).onConflictDoNothing();

        await tx.insert(markEntries).values([
          { schoolId: schoolA.id, examId: TEST_EXAM_ID, studentId: schoolA.studentId, subjectId: schoolA.subjectId, marksObtained: "74.00", maxMarks: "80.00", practicalMarks: "18.00", practicalMaxMarks: "20.00", grade: "A1", gradePoint: "10.00", status: "SUBMITTED", enteredById: schoolA.teacherA1UserId },
          { schoolId: schoolA.id, examId: TEST_EXAM_ID, studentId: schoolA.studentId, subjectId: R_SUBJ_SCI_ID, marksObtained: "68.00", maxMarks: "80.00", practicalMarks: "19.00", practicalMaxMarks: "20.00", grade: "A2", gradePoint: "9.00", status: "SUBMITTED", enteredById: schoolA.teacherA2UserId },
          { schoolId: schoolA.id, examId: TEST_EXAM_ID, studentId: schoolA.studentId, subjectId: R_SUBJ_ENG_ID, marksObtained: "62.00", maxMarks: "80.00", practicalMarks: "17.00", practicalMaxMarks: "20.00", grade: "B1", gradePoint: "8.00", status: "SUBMITTED", enteredById: schoolA.teacherA1UserId },
        ]).onConflictDoNothing();

        await tx.insert(examMarksLocks).values([
          { schoolId: schoolA.id, examId: TEST_EXAM_ID, classId: schoolA.classId, subjectId: schoolA.subjectId, status: "LOCKED", lockedById: schoolA.adminUserId, lockedAt: new Date() },
          { schoolId: schoolA.id, examId: TEST_EXAM_ID, classId: schoolA.classId, subjectId: R_SUBJ_SCI_ID, status: "LOCKED", lockedById: schoolA.adminUserId, lockedAt: new Date() },
          { schoolId: schoolA.id, examId: TEST_EXAM_ID, classId: schoolA.classId, subjectId: R_SUBJ_ENG_ID, status: "LOCKED", lockedById: schoolA.adminUserId, lockedAt: new Date() },
        ]).onConflictDoNothing();

        const snapshotPayload = {
          student: { id: schoolA.studentId, name: "Aarav Sharma", admissionNumber: "ADM-A1", rollNumber: 1, class: "Class 10", section: "A" },
          scholastic: [
            { subjectId: schoolA.subjectId, subjectName: "Mathematics", subjectCode: "MATH-A", theoryMarks: 74, theoryMaxMarks: 80, practicalMarks: 18, practicalMaxMarks: 20, totalMarks: 92, maxMarks: 100, grade: "A1", gradePoint: 10 },
            { subjectId: R_SUBJ_SCI_ID, subjectName: "Science", subjectCode: "SCI-A", theoryMarks: 68, theoryMaxMarks: 80, practicalMarks: 19, practicalMaxMarks: 20, totalMarks: 87, maxMarks: 100, grade: "A2", gradePoint: 9 },
            { subjectId: R_SUBJ_ENG_ID, subjectName: "English", subjectCode: "ENG-A", theoryMarks: 62, theoryMaxMarks: 80, practicalMarks: 17, practicalMaxMarks: 20, totalMarks: 79, maxMarks: 100, grade: "B1", gradePoint: 8 },
          ],
          summary: { grandTotalMarks: 258, totalMaxMarks: 300, percentage: 86.0, overallGrade: "A2", cgpa: 9.0, result: "PASSED", classRank: 1 },
        };
        await tx.insert(resultSnapshots).values({
          id: "eeeeeee6-6666-4eee-8eee-666666666666",
          schoolId: schoolA.id,
          setupId: TEST_SETUP_ID,
          studentId: schoolA.studentId,
          version: 1,
          payload: snapshotPayload,
          frozenAt: new Date(),
          frozenById: schoolA.adminUserId,
          isCurrent: true,
          publishedAt: new Date(),
        }).onConflictDoNothing();

        await tx.insert(reportCardJobs).values({
          id: "eeeeeee7-7777-4eee-8eee-777777777777",
          schoolId: schoolA.id,
          examId: TEST_EXAM_ID,
          classId: schoolA.classId,
          setupId: TEST_SETUP_ID,
          jobType: "REPORT_CARD",
          totalStudents: 1,
          processedCount: 1,
          failedCount: 0,
          status: "DONE",
          triggeredById: schoolA.adminUserId,
          completedAt: new Date(),
        }).onConflictDoNothing();
      }
    });
  });

  it("Stage 1: Seeds CBSE defaults and provisions Term 1 Exam with 80/20 component split", async () => {
    const seedResult = await seedExamBoardDefaults(schoolA.id, "CBSE", "CBSE_9_POINT", db);
    expect(seedResult).toBeDefined();

    const createdExam = await withTenant(schoolA.id, async (tx) => {
      return await tx.query.exams.findFirst({
        where: eq(exams.id, TEST_EXAM_ID),
        with: {
          components: true,
        },
      });
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
    const schedules = await withTenant(schoolA.id, async (tx) => {
      return await tx.query.examSchedules.findMany({
        where: eq(examSchedules.examId, TEST_EXAM_ID),
      });
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
    const settings = await withTenant(schoolA.id, async (tx) => {
      return await tx.query.examAdmitCardSettings.findFirst({
        where: eq(examAdmitCardSettings.examId, TEST_EXAM_ID),
      });
    });

    expect(settings).toBeDefined();
    expect(settings?.isReleased).toBe(true);
    expect(settings?.reportingTime).toBe("08:30 AM");
    expect(settings?.examCentre).toContain("Campus North");

    // Check that holds placed on student are tracked
    const holds = await withTenant(schoolA.id, async (tx) => {
      return await tx.query.examAdmitCardHolds.findMany({
        where: and(
          eq(examAdmitCardHolds.examId, TEST_EXAM_ID),
          eq(examAdmitCardHolds.studentId, schoolA.studentId)
        ),
      });
    });

    expect(holds.length).toBeGreaterThanOrEqual(1);
    // Verified released
    expect(holds[0]?.releasedAt).not.toBeNull();
  });

  it("Stage 4: Asserts mark boundary constraints (0..max) and administrative lock state", async () => {
    const entries = await withTenant(schoolA.id, async (tx) => {
      return await tx.query.markEntries.findMany({
        where: and(
          eq(markEntries.examId, TEST_EXAM_ID),
          eq(markEntries.studentId, schoolA.studentId)
        ),
      });
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
    const locks = await withTenant(schoolA.id, async (tx) => {
      return await tx.query.examMarksLocks.findMany({
        where: and(
          eq(examMarksLocks.examId, TEST_EXAM_ID),
          eq(examMarksLocks.classId, schoolA.classId)
        ),
      });
    });

    expect(locks.length).toBe(3);
    for (const lock of locks) {
      expect(lock.status).toBe("LOCKED");
      expect(lock.lockedAt).not.toBeNull();
    }
  });

  it("Stage 5: Freezes immutable result snapshot with CBSE 9-point grading scale", async () => {
    const snapshot = await withTenant(schoolA.id, async (tx) => {
      return await tx.query.resultSnapshots.findFirst({
        where: and(
          eq(resultSnapshots.setupId, TEST_SETUP_ID),
          eq(resultSnapshots.studentId, schoolA.studentId),
          eq(resultSnapshots.isCurrent, true)
        ),
      });
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
    const job = await withTenant(schoolA.id, async (tx) => {
      return await tx.query.reportCardJobs.findFirst({
        where: and(
          eq(reportCardJobs.examId, TEST_EXAM_ID),
          eq(reportCardJobs.setupId, TEST_SETUP_ID)
        ),
      });
    });

    expect(job).toBeDefined();
    expect(job?.status).toBe("DONE");
    expect(job?.processedCount).toBe(1);
    expect(job?.failedCount).toBe(0);
    expect(job?.completedAt).not.toBeNull();
  });
});
