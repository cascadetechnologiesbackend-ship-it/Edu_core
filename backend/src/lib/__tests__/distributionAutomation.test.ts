import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  generateMarkDistributions,
} from "../distributionAutomation";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { withTenant } from "../tenant";
import { db } from "@/db";
import {
  exams,
  examTypes,
  examComponents,
  examClassScopes,
  examMarkDistributions,
  markEntries,
  classes,
  subjects,
  classSubjects,
  studentSubjectEnrollments,
  students,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S11 Layer 6: Mark Distribution Automation Engine", () => {
  let pool: Pool;
  const schoolA = ISOLATION_IDS.schoolA.id;
  const schoolB = ISOLATION_IDS.schoolB.id;
  let classAId: string;
  let distStudentId: string;
  const academicYearAId = ISOLATION_IDS.schoolA.academicYearId;

  let testExamId: string;
  let testMandatorySubjectId: string;
  let testElectiveSubjectId: string;
  let testEnrolledElectiveSubjectId: string;
  let mandatoryClassSubjectId: string;
  let unEnrolledClassSubjectId: string;
  let enrolledClassSubjectId: string;
  let compTheoryId: string;
  let compPracticalId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();

    const runId = Math.random().toString(36).substring(2, 7);

    await withTenant(schoolA, async (tx) => {
      // 0. Clean up any leftover CLASS_9 for School A
      const oldClasses = await tx
        .select()
        .from(classes)
        .where(
          and(
            eq(classes.schoolId, schoolA),
            eq(classes.gradeLevel, "CLASS_9"),
          ),
        );
      for (const oc of oldClasses) {
        const oldClassSubjects = await tx
          .select({ id: classSubjects.id })
          .from(classSubjects)
          .where(eq(classSubjects.classId, oc.id));
        const csIds = oldClassSubjects.map((cs) => cs.id);
        if (csIds.length > 0) {
          await tx
            .delete(studentSubjectEnrollments)
            .where(inArray(studentSubjectEnrollments.classSubjectId, csIds));
        }
        const oldStudents = await tx
          .select({ id: students.id })
          .from(students)
          .where(eq(students.currentClassId, oc.id));
        for (const os of oldStudents) {
          await tx
            .delete(studentSubjectEnrollments)
            .where(eq(studentSubjectEnrollments.studentId, os.id));
          await tx.delete(markEntries).where(eq(markEntries.studentId, os.id));
          await tx.delete(students).where(eq(students.id, os.id));
        }
        await tx.delete(classSubjects).where(eq(classSubjects.classId, oc.id));
        await tx.delete(examMarkDistributions).where(eq(examMarkDistributions.classId, oc.id));
        await tx.delete(examClassScopes).where(eq(examClassScopes.classId, oc.id));
        await tx.delete(classes).where(eq(classes.id, oc.id));
      }

      // Create an isolated class for this test suite
      const [testClass] = await tx
        .insert(classes)
        .values({
          schoolId: schoolA,
          academicYearId: academicYearAId,
          gradeLevel: "CLASS_9",
          displayName: `DistClass_${runId}`,
          sortOrder: 1,
        })
        .returning();
      classAId = testClass!.id;

      // Create an isolated student for this test suite
      const [distStudent] = await tx
        .insert(students)
        .values({
          schoolId: schoolA,
          academicYearId: academicYearAId,
          admissionNumber: `DIST_${runId}`,
          firstNameEncrypted: "enc_dist",
          lastNameEncrypted: "enc_student",
          dateOfBirth: new Date("2010-01-01"),
          gender: "MALE",
          category: "GENERAL",
          admissionDate: new Date("2026-04-01"),
          currentClassId: classAId,
          primaryParentUserId: null,
          isActive: false,
        })
        .returning();
      distStudentId = distStudent!.id;

      // 1. Create a test exam for School A
      const [exam] = await tx
        .insert(exams)
        .values({
          schoolId: schoolA,
          academicYearId: academicYearAId,
          examTypeId: ISOLATION_IDS.schoolA.examTypeId,
          name: `S11 Layer 6 Distribution Exam ${runId}`,
          startDate: new Date("2026-12-01"),
          endDate: new Date("2026-12-15"),
        })
        .returning();
      testExamId = exam!.id;

      // Attach exam class scope
      await tx.insert(examClassScopes).values({
        schoolId: schoolA,
        examId: testExamId,
        classId: classAId,
      });

      // 2. Create Mandatory Subject (max: 80, pass: 27)
      const [subMand] = await tx
        .insert(subjects)
        .values({
          schoolId: schoolA,
          name: `Mandatory Science ${runId}`,
          code: `MSCI_${runId}`,
          subjectType: "THEORY",
          maxMarks: 80,
          passingMarks: 27,
        })
        .returning();
      testMandatorySubjectId = subMand!.id;

      const [csMand] = await tx
        .insert(classSubjects)
        .values({
          schoolId: schoolA,
          classId: classAId,
          subjectId: testMandatorySubjectId,
          isElective: false,
        })
        .returning();
      mandatoryClassSubjectId = csMand!.id;

      // 3. Create Unenrolled Elective Subject (0 students enrolled)
      const [subUnenrolled] = await tx
        .insert(subjects)
        .values({
          schoolId: schoolA,
          name: `German Language ${runId}`,
          code: `GER_${runId}`,
          subjectType: "THEORY",
          maxMarks: 100,
          passingMarks: 33,
        })
        .returning();
      testElectiveSubjectId = subUnenrolled!.id;

      const [csUnenrolled] = await tx
        .insert(classSubjects)
        .values({
          schoolId: schoolA,
          classId: classAId,
          subjectId: testElectiveSubjectId,
          isElective: true,
        })
        .returning();
      unEnrolledClassSubjectId = csUnenrolled!.id;

      // 4. Create Enrolled Elective Subject (>= 1 student actively enrolled)
      const [subEnrolled] = await tx
        .insert(subjects)
        .values({
          schoolId: schoolA,
          name: `Computer Science ${runId}`,
          code: `CS_${runId}`,
          subjectType: "PRACTICAL",
          maxMarks: 100,
          passingMarks: 33,
        })
        .returning();
      testEnrolledElectiveSubjectId = subEnrolled!.id;

      const [csEnrolled] = await tx
        .insert(classSubjects)
        .values({
          schoolId: schoolA,
          classId: classAId,
          subjectId: testEnrolledElectiveSubjectId,
          isElective: true,
        })
        .returning();
      enrolledClassSubjectId = csEnrolled!.id;

      // Enroll student in enrolled elective
      await tx.insert(studentSubjectEnrollments).values({
        schoolId: schoolA,
        studentId: distStudentId,
        classSubjectId: enrolledClassSubjectId,
        isElectiveTaken: true,
        enrollmentStatus: "ACTIVE",
      });
    });
  });

  afterAll(async () => {
    // Cleanup created distributions and exam
    await withTenant(schoolA, async (tx) => {
      if (testExamId) {
        await tx
          .delete(examMarkDistributions)
          .where(eq(examMarkDistributions.examId, testExamId));
        await tx
          .delete(markEntries)
          .where(eq(markEntries.examId, testExamId));
        await tx
          .delete(examComponents)
          .where(eq(examComponents.examId, testExamId));
        await tx
          .delete(examClassScopes)
          .where(eq(examClassScopes.examId, testExamId));
        await tx.delete(exams).where(eq(exams.id, testExamId));
      }
      if (distStudentId) {
        await tx
          .delete(studentSubjectEnrollments)
          .where(eq(studentSubjectEnrollments.studentId, distStudentId));
        await tx
          .delete(students)
          .where(eq(students.id, distStudentId));
      }
      if (classAId) {
        const oldClassSubjects = await tx
          .select({ id: classSubjects.id })
          .from(classSubjects)
          .where(eq(classSubjects.classId, classAId));
        const csIds = oldClassSubjects.map((cs) => cs.id);
        if (csIds.length > 0) {
          await tx
            .delete(studentSubjectEnrollments)
            .where(inArray(studentSubjectEnrollments.classSubjectId, csIds));
        }
        await tx.delete(classSubjects).where(eq(classSubjects.classId, classAId));
        await tx.delete(examMarkDistributions).where(eq(examMarkDistributions.classId, classAId));
        await tx.delete(examClassScopes).where(eq(examClassScopes.classId, classAId));
        await tx.delete(classes).where(eq(classes.id, classAId));
      }
      if (testMandatorySubjectId) {
        await tx.delete(subjects).where(eq(subjects.id, testMandatorySubjectId));
      }
      if (testElectiveSubjectId) {
        await tx.delete(subjects).where(eq(subjects.id, testElectiveSubjectId));
      }
      if (testEnrolledElectiveSubjectId) {
        await tx.delete(subjects).where(eq(subjects.id, testEnrolledElectiveSubjectId));
      }
    });
    await pool.end();
  });

  it("6.1: Preview mode generates proposals without mutating the database", async () => {
    const preview = await generateMarkDistributions({
      schoolId: schoolA,
      examId: testExamId,
      previewOnly: true,
    });

    expect(preview.success).toBe(true);
    expect(preview.previewOnly).toBe(true);
    expect(preview.createdCount).toBeGreaterThanOrEqual(2); // Mandatory + Enrolled elective

    // Verify DB still has 0 rows for this exam
    let existing: any[] = [];
    await withTenant(schoolA, async (tx) => {
      existing = await tx
        .select()
        .from(examMarkDistributions)
        .where(eq(examMarkDistributions.examId, testExamId));
    });
    expect(existing.length).toBe(0);
  });

  it("6.2: Negative test: Excludes elective subjects with 0 enrolled students", async () => {
    const preview = await generateMarkDistributions({
      schoolId: schoolA,
      examId: testExamId,
      previewOnly: true,
    });

    // The unenrolled elective subject (German) must NOT be present in proposals
    const unenrolledProposal = preview.proposals.find(
      (p) => p.subjectId === testElectiveSubjectId,
    );
    expect(unenrolledProposal).toBeUndefined();

    // The enrolled elective subject (Computer Science) MUST be present
    const enrolledProposal = preview.proposals.find(
      (p) => p.subjectId === testEnrolledElectiveSubjectId,
    );
    expect(enrolledProposal).toBeDefined();
    expect(enrolledProposal?.isElective).toBe(true);
  });

  it("6.3: Inherits default maxMarks and passingMarks from subjects table", async () => {
    const preview = await generateMarkDistributions({
      schoolId: schoolA,
      examId: testExamId,
      previewOnly: true,
    });

    const mandProposal = preview.proposals.find(
      (p) => p.subjectId === testMandatorySubjectId,
    );
    expect(mandProposal).toBeDefined();
    expect(mandProposal?.maxMarks).toBe(80);
    expect(mandProposal?.passingMarks).toBe(27);
    expect(mandProposal?.action).toBe("CREATE");
  });

  it("6.4: Commits generated distributions and inserts them into exam_mark_distributions", async () => {
    const result = await generateMarkDistributions({
      schoolId: schoolA,
      examId: testExamId,
      previewOnly: false,
    });

    expect(result.success).toBe(true);
    expect(result.createdCount).toBeGreaterThanOrEqual(2);

    let dbRows: any[] = [];
    await withTenant(schoolA, async (tx) => {
      dbRows = await tx
        .select()
        .from(examMarkDistributions)
        .where(eq(examMarkDistributions.examId, testExamId));
    });

    expect(dbRows.length).toBe(result.createdCount);

    const mandDbRow = dbRows.find(
      (r) => r.subjectId === testMandatorySubjectId,
    );
    expect(mandDbRow).toBeDefined();
    expect(Number(mandDbRow?.maxMarks)).toBe(80);
    expect(Number(mandDbRow?.passingMarks)).toBe(27);
  });

  it("6.5: Ensure-semantics idempotency: Re-running generation preserves existing customized rows without alteration", async () => {
    // Customize the mandatory subject's max marks in DB to 95.00
    await withTenant(schoolA, async (tx) => {
      await tx
        .update(examMarkDistributions)
        .set({
          maxMarks: "95.00",
          passingMarks: "38.00",
        })
        .where(
          and(
            eq(examMarkDistributions.examId, testExamId),
            eq(examMarkDistributions.subjectId, testMandatorySubjectId),
          ),
        );
    });

    // Re-run generation with previewOnly = false
    const reRun = await generateMarkDistributions({
      schoolId: schoolA,
      examId: testExamId,
      previewOnly: false,
    });

    expect(reRun.success).toBe(true);
    expect(reRun.createdCount).toBe(0); // Nothing new created
    expect(reRun.preservedCount).toBeGreaterThanOrEqual(2); // Everything preserved

    // Verify DB still retains the custom 95.00 max marks
    let verifiedRow: any;
    await withTenant(schoolA, async (tx) => {
      [verifiedRow] = await tx
        .select()
        .from(examMarkDistributions)
        .where(
          and(
            eq(examMarkDistributions.examId, testExamId),
            eq(examMarkDistributions.subjectId, testMandatorySubjectId),
          ),
        );
    });

    expect(Number(verifiedRow?.maxMarks)).toBe(95);
    expect(Number(verifiedRow?.passingMarks)).toBe(38);
  });

  it("6.6: Immutability guard: Prohibits alteration or deletion when student mark entries already exist", async () => {
    // Insert a mark entry for the enrolled elective subject
    await withTenant(schoolA, async (tx) => {
      await tx.insert(markEntries).values({
        schoolId: schoolA,
        examId: testExamId,
        studentId: distStudentId,
        subjectId: testEnrolledElectiveSubjectId,
        maxMarks: "100.00",
        marksObtained: "88.00",
        enteredById: ISOLATION_IDS.schoolA.adminUserId,
      });
    });

    // Re-evaluate proposals
    const evalResult = await generateMarkDistributions({
      schoolId: schoolA,
      examId: testExamId,
      previewOnly: true,
    });

    expect(evalResult.success).toBe(true);
    expect(evalResult.protectedCount).toBeGreaterThanOrEqual(1);

    const protectedProposal = evalResult.proposals.find(
      (p) => p.subjectId === testEnrolledElectiveSubjectId,
    );
    expect(protectedProposal).toBeDefined();
    expect(protectedProposal?.action).toBe("PROTECTED_HAS_MARKS");
    expect(protectedProposal?.reason).toContain("immutable");
  });

  it("6.7: Expands across exam components with weighted distribution", async () => {
    // Create an exam with Theory (70%) and Practical (30%) components
    const runId2 = Math.random().toString(36).substring(2, 7);
    let compExamId: string = "";
    let c1Id: string = "";
    let c2Id: string = "";

    await withTenant(schoolA, async (tx) => {
      const [compExam] = await tx
        .insert(exams)
        .values({
          schoolId: schoolA,
          academicYearId: academicYearAId,
          examTypeId: ISOLATION_IDS.schoolA.examTypeId,
          name: `Component Exam ${runId2}`,
          startDate: new Date("2026-12-01"),
          endDate: new Date("2026-12-15"),
        })
        .returning();
      compExamId = compExam!.id;

      await tx.insert(examClassScopes).values({
        schoolId: schoolA,
        examId: compExamId,
        classId: classAId,
      });

      // Attach 2 components with distinct examTypes
      const [et2] = await tx
        .insert(examTypes)
        .values({
          schoolId: schoolA,
          name: `Practical Type ${runId2}`,
          code: `PRAC_${runId2}`,
          examType: "PRACTICAL",
        })
        .returning();

      const [c1] = await tx
        .insert(examComponents)
        .values({
          schoolId: schoolA,
          examId: compExamId,
          examTypeId: ISOLATION_IDS.schoolA.examTypeId,
          displayName: "Theory",
          sortOrder: 1,
          weightPercent: "70.00",
        })
        .returning();
      c1Id = c1!.id;

      const [c2] = await tx
        .insert(examComponents)
        .values({
          schoolId: schoolA,
          examId: compExamId,
          examTypeId: et2!.id,
          displayName: "Practical",
          sortOrder: 2,
          weightPercent: "30.00",
        })
        .returning();
      c2Id = c2!.id;
    });

    const compResult = await generateMarkDistributions({
      schoolId: schoolA,
      examId: compExamId,
      previewOnly: true,
    });

    expect(compResult.success).toBe(true);

    // Filter proposals for mandatory subject (maxMarks = 80)
    const mandTheory = compResult.proposals.find(
      (p) => p.subjectId === testMandatorySubjectId && p.componentId === c1Id,
    );
    const mandPractical = compResult.proposals.find(
      (p) => p.subjectId === testMandatorySubjectId && p.componentId === c2Id,
    );

    expect(mandTheory).toBeDefined();
    expect(mandTheory?.maxMarks).toBe(56); // 70% of 80
    expect(mandTheory?.passingMarks).toBe(18.48); // 33% of 56

    expect(mandPractical).toBeDefined();
    expect(mandPractical?.maxMarks).toBe(24); // 30% of 80
    expect(mandPractical?.passingMarks).toBe(7.92); // 33% of 24

    // Cleanup component exam
    await withTenant(schoolA, async (tx) => {
      await tx.delete(examComponents).where(eq(examComponents.examId, compExamId));
      await tx.delete(examClassScopes).where(eq(examClassScopes.examId, compExamId));
      await tx.delete(exams).where(eq(exams.id, compExamId));
    });
  });

  it("6.8: Tenant isolation probe: School A distribution generation never affects School B", async () => {
    // Attempt generation for School B using School A's exam ID
    const crossSchoolResult = await generateMarkDistributions({
      schoolId: schoolB,
      examId: testExamId, // Exam belongs to School A
      previewOnly: false,
    });

    expect(crossSchoolResult.success).toBe(false);
    expect(crossSchoolResult.createdCount).toBe(0);
    expect(crossSchoolResult.message).toContain("not found");
  });
});
