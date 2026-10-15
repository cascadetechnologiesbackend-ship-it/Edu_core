import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { syncExamAttendance } from "../examAttendanceSync";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { db } from "@/db";
import {
  studentAttendance,
  examSchedules,
  exams,
  classes,
  subjects,
  sections,
  students,
  auditLogs,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S11 Layer 2: Exam Attendance Synchronization & Reconciliation", () => {
  let pool: Pool;
  const schoolId = ISOLATION_IDS.schoolA.id;
  const academicYearId = ISOLATION_IDS.schoolA.academicYearId;
  const classId = ISOLATION_IDS.schoolA.classId;
  let testExamId: string;
  let testSubjectId: string;
  let testScheduleId: string;
  let testSectionId: string;
  let student1Id: string;
  let student2Id: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();

    const runId = Math.random().toString(36).substring(2, 7);

    // 0. Create a section for this class
    const [sec] = await db
      .insert(sections)
      .values({
        schoolId,
        classId,
        name: `Sec_${runId}`,
        displayName: `10-${runId}`,
      })
      .returning();
    testSectionId = sec.id;

    // 1. Create a test exam
    const [exam] = await db
      .insert(exams)
      .values({
        schoolId,
        academicYearId,
        examTypeId: ISOLATION_IDS.schoolA.examTypeId,
        name: `S11 Layer 2 Exam ${runId}`,
        startDate: new Date("2026-11-01"),
        endDate: new Date("2026-11-15"),
      })
      .returning();
    testExamId = exam.id;

    // 2. Create a test subject
    const [subj] = await db
      .insert(subjects)
      .values({
        schoolId,
        code: `SCI_ATT_${runId}`,
        name: "Science Attendance",
        subjectType: "THEORY",
        maxMarks: 100,
        passingMarks: 33,
      })
      .returning();
    testSubjectId = subj.id;

    // 3. Create exam schedule
    const [schedule] = await db
      .insert(examSchedules)
      .values({
        schoolId,
        examId: testExamId,
        classId,
        subjectId: testSubjectId,
        examDate: "2026-11-05",
        startTime: "09:00:00",
        durationMinutes: 180,
        maxMarks: "100.00",
        passingMarks: "33.00",
      })
      .returning();
    testScheduleId = schedule.id;

    // 4. Create two test students in this class and section
    const [st1] = await db
      .insert(students)
      .values({
        schoolId,
        academicYearId,
        admissionNumber: `ATT-ST1-${runId}`,
        firstNameEncrypted: "Rohan",
        lastNameEncrypted: "Mehta",
        dateOfBirth: new Date("2010-03-03"),
        gender: "MALE",
        category: "GENERAL",
        admissionDate: new Date("2024-04-01"),
        currentClassId: classId,
        currentSectionId: testSectionId,
        isActive: true,
      })
      .returning();
    student1Id = st1.id;

    const [st2] = await db
      .insert(students)
      .values({
        schoolId,
        academicYearId,
        admissionNumber: `ATT-ST2-${runId}`,
        firstNameEncrypted: "Ananya",
        lastNameEncrypted: "Iyer",
        dateOfBirth: new Date("2010-04-04"),
        gender: "FEMALE",
        category: "GENERAL",
        admissionDate: new Date("2024-04-01"),
        currentClassId: classId,
        currentSectionId: testSectionId,
        isActive: true,
      })
      .returning();
    student2Id = st2.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("2.1: Absences marked during marks entry sync into student_attendance with source='EXAM' and examScheduleId", async () => {
    const res = await syncExamAttendance({
      schoolId,
      examId: testExamId,
      classId,
      subjectId: testSubjectId,
      sectionId: testSectionId,
      markedById: ISOLATION_IDS.schoolA.adminUserId,
      userEmail: "admin@school-a.edu",
      userRole: "SCHOOL_ADMIN",
      entries: [
        {
          studentId: student1Id,
          isAbsent: true,
          isMedicalExempt: false,
          remarks: "Fever on exam morning",
        },
      ],
    });

    expect(res.syncedAbsencesCount).toBe(1);

    const records = await db.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.schoolId, schoolId),
        eq(studentAttendance.studentId, student1Id),
        eq(studentAttendance.examScheduleId, testScheduleId),
      ),
    });

    expect(records.length).toBe(1);
    expect(records[0]?.source).toBe("EXAM");
    expect(records[0]?.status).toBe("ABSENT");
    expect(records[0]?.remarks).toContain("Fever on exam morning");
  });

  it("2.2: Zero double-records — re-saving marks entry does not create duplicate attendance records", async () => {
    // Re-save with same absence
    const res = await syncExamAttendance({
      schoolId,
      examId: testExamId,
      classId,
      subjectId: testSubjectId,
      sectionId: testSectionId,
      markedById: ISOLATION_IDS.schoolA.adminUserId,
      userEmail: "admin@school-a.edu",
      userRole: "SCHOOL_ADMIN",
      entries: [
        {
          studentId: student1Id,
          isAbsent: true,
          isMedicalExempt: false,
          remarks: "Confirmed absent by invigilator",
        },
      ],
    });

    expect(res.syncedAbsencesCount).toBe(1);

    // Verify still exactly 1 record for this student and schedule (idempotency & partial unique index)
    const records = await db.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.schoolId, schoolId),
        eq(studentAttendance.studentId, student1Id),
        eq(studentAttendance.examScheduleId, testScheduleId),
      ),
    });

    expect(records.length).toBe(1);
    expect(records[0]?.remarks).toContain("Confirmed absent by invigilator");
  });

  it("2.3: Unlocking marks & correcting from ABSENT to PRESENT reconciles attendance to PRESENT and writes audit_logs", async () => {
    // Teacher/Admin unlocks marks and corrects student 1 to present with obtained marks
    const res = await syncExamAttendance({
      schoolId,
      examId: testExamId,
      classId,
      subjectId: testSubjectId,
      sectionId: testSectionId,
      markedById: ISOLATION_IDS.schoolA.adminUserId,
      userEmail: "admin@school-a.edu",
      userRole: "SCHOOL_ADMIN",
      entries: [
        {
          studentId: student1Id,
          isAbsent: false,
          marksObtained: 78,
          remarks: "Present in supplementary room",
        },
      ],
    });

    expect(res.reconciledCount).toBe(1);

    // Verify record was NOT deleted, but updated to PRESENT
    const records = await db.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.schoolId, schoolId),
        eq(studentAttendance.studentId, student1Id),
        eq(studentAttendance.examScheduleId, testScheduleId),
      ),
    });

    expect(records.length).toBe(1);
    expect(records[0]?.status).toBe("PRESENT");
    expect(records[0]?.remarks).toContain("EXAM_RECONCILED: Corrected to PRESENT");

    // Verify immutable audit log exists for this correction
    const logs = await db.query.auditLogs.findMany({
      where: and(
        eq(auditLogs.schoolId, schoolId),
        eq(auditLogs.tableName, "student_attendance"),
        eq(auditLogs.recordId, records[0]?.id),
      ),
    });

    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0]?.purposeId).toBe("exam_attendance_correction");
  });

  it("2.4: Medical exemption creates status='LEAVE' with medical exemption remarks", async () => {
    const res = await syncExamAttendance({
      schoolId,
      examId: testExamId,
      classId,
      subjectId: testSubjectId,
      sectionId: testSectionId,
      markedById: ISOLATION_IDS.schoolA.adminUserId,
      userEmail: "admin@school-a.edu",
      userRole: "SCHOOL_ADMIN",
      entries: [
        {
          studentId: student2Id,
          isAbsent: true,
          isMedicalExempt: true,
          remarks: "Hospitalized - certificate submitted",
        },
      ],
    });

    expect(res.syncedAbsencesCount).toBe(1);

    const records = await db.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.schoolId, schoolId),
        eq(studentAttendance.studentId, student2Id),
        eq(studentAttendance.examScheduleId, testScheduleId),
      ),
    });

    expect(records.length).toBe(1);
    expect(records[0]?.status).toBe("LEAVE");
    expect(records[0]?.remarks).toContain("EXAM_ABSENT_MEDICAL");
  });

  it("2.5: Cross-tenant isolation — School A attendance sync cannot query or touch School B student records", async () => {
    const schoolBStudentId = ISOLATION_IDS.schoolB.studentId;

    // School A attempts to sync attendance for School B student
    const res = await syncExamAttendance({
      schoolId,
      examId: testExamId,
      classId,
      subjectId: testSubjectId,
      sectionId: testSectionId,
      markedById: ISOLATION_IDS.schoolA.adminUserId,
      userEmail: "admin@school-a.edu",
      userRole: "SCHOOL_ADMIN",
      entries: [
        {
          studentId: schoolBStudentId,
          isAbsent: true,
          isMedicalExempt: false,
          remarks: "Cross-tenant intrusion attempt",
        },
      ],
    });

    // Student B not found in School A roster -> 0 records synced
    expect(res.syncedAbsencesCount).toBe(0);

    // Verify School B attendance table remains pristine
    const schoolBRecords = await db.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.schoolId, ISOLATION_IDS.schoolB.id),
        eq(studentAttendance.studentId, schoolBStudentId),
      ),
    });

    expect(schoolBRecords.length).toBe(0);
  });
});
