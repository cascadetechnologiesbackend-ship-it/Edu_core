import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  getStudentSubjectEnrollments,
  getClassEnrollmentMatrix,
  assignStudentElectives,
  bulkAssignElectiveBySection,
  backfillMandatoryEnrollments,
} from "../enrollmentEngine";
import {
  resolveEffectiveSubjects,
  UNENROLLED_SENTINEL,
  type EffectiveSubjectInput,
} from "../gradeEngine";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { db } from "@/db";
import {
  classes,
  subjects,
  classSubjects,
  students,
  studentSubjectEnrollments,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S11 Layer 1: Student Subject & Elective Enrollment Engine", () => {
  let pool: Pool;
  let testClassId: string;
  let mandatoryClassSubjId: string;
  let electiveClassSubjId: string;
  let student1Id: string;
  let student2Id: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();

    const schoolId = ISOLATION_IDS.schoolA.id;
    const academicYearId = ISOLATION_IDS.schoolA.academicYearId;

    testClassId = ISOLATION_IDS.schoolA.classId;
    student1Id = ISOLATION_IDS.schoolA.studentId;

    const runId = Math.random().toString(36).substring(2, 7);

    // 1. Create mandatory and elective subjects
    const [subMandatory] = await db
      .insert(subjects)
      .values({
        schoolId,
        code: `ENG_MAND_${runId}`,
        name: "English Mandatory",
        subjectType: "THEORY",
        maxMarks: 100,
        passingMarks: 33,
      })
      .returning();

    const [subElective] = await db
      .insert(subjects)
      .values({
        schoolId,
        code: `COMP_ELEC_${runId}`,
        name: "Computer Science Elective",
        subjectType: "PRACTICAL",
        maxMarks: 100,
        passingMarks: 33,
      })
      .returning();

    // 3. Map subjects to class (one mandatory, one elective)
    const [csMand] = await db
      .insert(classSubjects)
      .values({
        schoolId,
        classId: testClassId,
        subjectId: subMandatory!.id,
        isElective: false,
      })
      .returning();
    mandatoryClassSubjId = csMand!.id;

    const [csElec] = await db
      .insert(classSubjects)
      .values({
        schoolId,
        classId: testClassId,
        subjectId: subElective!.id,
        isElective: true,
      })
      .returning();
    electiveClassSubjId = csElec!.id;

    // 4. Create two test students in this class
    const [st1] = await db
      .insert(students)
      .values({
        schoolId,
        academicYearId,
        admissionNumber: `TEST-ENR-${runId}-01`,
        firstNameEncrypted: "Aarav",
        lastNameEncrypted: "Verma",
        dateOfBirth: new Date("2010-01-01"),
        gender: "MALE",
        category: "GENERAL",
        admissionDate: new Date("2024-04-01"),
        currentClassId: testClassId,
        isActive: true,
      })
      .returning();
    student1Id = st1!.id;

    const [st2] = await db
      .insert(students)
      .values({
        schoolId,
        academicYearId,
        admissionNumber: `TEST-ENR-${runId}-02`,
        firstNameEncrypted: "Diya",
        lastNameEncrypted: "Sharma",
        dateOfBirth: new Date("2010-02-02"),
        gender: "FEMALE",
        category: "GENERAL",
        admissionDate: new Date("2024-04-01"),
        currentClassId: testClassId,
        isActive: true,
      })
      .returning();
    student2Id = st2!.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("1.1: backfillMandatoryEnrollments creates ACTIVE records for non-electives and leaves electives unassigned", async () => {
    const schoolId = ISOLATION_IDS.schoolA.id;
    const res = await backfillMandatoryEnrollments(schoolId);
    expect(res.insertedCount).toBeGreaterThanOrEqual(2);

    // Verify student 1 has mandatory subject enrolled
    const enr1 = await getStudentSubjectEnrollments(schoolId, student1Id);
    const mandEnr = enr1.find((e) => e.classSubjectId === mandatoryClassSubjId);
    expect(mandEnr).toBeDefined();
    expect(mandEnr?.isElectiveTaken).toBe(true);
    expect(mandEnr?.enrollmentStatus).toBe("ACTIVE");

    // Verify elective subject is NOT enrolled yet
    const elecEnr = enr1.find((e) => e.classSubjectId === electiveClassSubjId);
    expect(elecEnr).toBeUndefined();
  });

  it("1.2: assignStudentElectives enrolls student in elective with ACTIVE status", async () => {
    const schoolId = ISOLATION_IDS.schoolA.id;
    const ctx = {
      userId: ISOLATION_IDS.schoolA.adminUserId,
      email: ISOLATION_IDS.schoolA.adminEmail,
      role: "SCHOOL_ADMIN",
      schoolId,
    };

    // Enroll student 1 in elective
    const res = await assignStudentElectives(
      schoolId,
      student1Id,
      [{ classSubjectId: electiveClassSubjId, isElectiveTaken: true }],
      ctx,
    );
    expect(res.updatedCount).toBe(1);

    const enr1 = await getStudentSubjectEnrollments(schoolId, student1Id);
    const elecEnr = enr1.find((e) => e.classSubjectId === electiveClassSubjId);
    expect(elecEnr).toBeDefined();
    expect(elecEnr?.isElectiveTaken).toBe(true);
    expect(elecEnr?.enrollmentStatus).toBe("ACTIVE");

    // Student 2 remains unenrolled
    const enr2 = await getStudentSubjectEnrollments(schoolId, student2Id);
    const elecEnr2 = enr2.find((e) => e.classSubjectId === electiveClassSubjId);
    expect(elecEnr2).toBeUndefined();
  });

  it("1.3: resolveEffectiveSubjects renders enrolled elective with real marks and unenrolled with dash sentinel", () => {
    const subjectsForStudent1: EffectiveSubjectInput[] = [
      {
        subjectId: "sub-mand",
        subjectName: "English Mandatory",
        isElective: false,
        marksObtained: 85,
        maxMarks: 100,
        percent: 85,
        isPassed: true,
      },
      {
        subjectId: "sub-elec",
        subjectName: "Computer Science Elective",
        isElective: true,
        marksObtained: 95,
        maxMarks: 100,
        percent: 95,
        isPassed: true,
      },
    ];

    // Student 1: Enrolled in elective
    const res1 = resolveEffectiveSubjects(subjectsForStudent1, {
      enrolledSubjectIds: ["sub-mand", "sub-elec"],
    });
    expect(res1.countedSubjects.length).toBe(2);
    expect(res1.unenrolledSubjects.length).toBe(0);
    expect(res1.totalMarks).toBe(85 + 95);
    expect(res1.totalMaxMarks).toBe(200);
    expect(res1.percent).toBe(90);

    // Student 2: NOT enrolled in elective
    const res2 = resolveEffectiveSubjects(subjectsForStudent1, {
      enrolledSubjectIds: ["sub-mand"], // only mandatory
    });
    expect(res2.countedSubjects.length).toBe(1);
    expect(res2.countedSubjects[0]?.subjectId).toBe("sub-mand");
    expect(res2.unenrolledSubjects.length).toBe(1);
    expect(res2.unenrolledSubjects[0]?.subjectId).toBe("sub-elec");
    expect(res2.unenrolledSubjects[0]?.grade).toBe(UNENROLLED_SENTINEL); // "-"
    expect(res2.totalMarks).toBe(85);
    expect(res2.totalMaxMarks).toBe(100);
    expect(res2.percent).toBe(85); // NOT penalized by unassigned elective!
  });

  it("1.4: getClassEnrollmentMatrix returns full class roster with accurate elective state", async () => {
    const schoolId = ISOLATION_IDS.schoolA.id;
    const matrix = await getClassEnrollmentMatrix(schoolId, testClassId);

    expect(matrix.classId).toBe(testClassId);
    expect(matrix.subjects.length).toBeGreaterThanOrEqual(2);
    expect(matrix.subjects.some((s) => s.classSubjectId === mandatoryClassSubjId)).toBe(true);
    expect(matrix.subjects.some((s) => s.classSubjectId === electiveClassSubjId)).toBe(true);
    expect(matrix.students.length).toBeGreaterThanOrEqual(2);

    const s1Row = matrix.students.find((s) => s.studentId === student1Id);
    expect(s1Row).toBeDefined();
    expect(s1Row?.enrollments[mandatoryClassSubjId]).toBe(true);
    expect(s1Row?.enrollments[electiveClassSubjId]).toBe(true);

    const s2Row = matrix.students.find((s) => s.studentId === student2Id);
    expect(s2Row).toBeDefined();
    expect(s2Row?.enrollments[mandatoryClassSubjId]).toBe(true);
    expect(s2Row?.enrollments[electiveClassSubjId]).toBe(false); // Unassigned elective
  });

  it("1.5: Cross-tenant isolation probe: School A admin cannot mutate School B student enrollments", async () => {
    const schoolA = ISOLATION_IDS.schoolA.id;
    const schoolBStudentId = ISOLATION_IDS.schoolB.studentId;
    const ctxSchoolA = {
      userId: ISOLATION_IDS.schoolA.adminUserId,
      email: ISOLATION_IDS.schoolA.adminEmail,
      role: "SCHOOL_ADMIN",
      schoolId: schoolA,
    };

    // Attempt to assign elective to School B student from School A context
    await expect(
      assignStudentElectives(
        schoolA,
        schoolBStudentId,
        [{ classSubjectId: electiveClassSubjId, isElectiveTaken: true }],
        ctxSchoolA,
      ),
    ).rejects.toThrow("Student not found or access denied.");
  });

  it("1.6: Idempotent backfill preserves existing elective assignments on re-run", async () => {
    const schoolId = ISOLATION_IDS.schoolA.id;

    // Re-run backfill
    await backfillMandatoryEnrollments(schoolId);

    // Verify student 1 elective is still ACTIVE and not overwritten
    const enr1 = await getStudentSubjectEnrollments(schoolId, student1Id);
    const elecEnr = enr1.find((e) => e.classSubjectId === electiveClassSubjId);
    expect(elecEnr).toBeDefined();
    expect(elecEnr?.isElectiveTaken).toBe(true);
    expect(elecEnr?.enrollmentStatus).toBe("ACTIVE");
  });
});
