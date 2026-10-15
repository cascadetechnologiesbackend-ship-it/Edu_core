import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  generateMarkDistributions,
} from "../distributionAutomation";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
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
import { eq, and } from "drizzle-orm";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S11 Layer 6: Mark Distribution Automation Engine", () => {
  let pool: Pool;
  const schoolA = ISOLATION_IDS.schoolA.id;
  const schoolB = ISOLATION_IDS.schoolB.id;
  const classAId = ISOLATION_IDS.schoolA.classId;
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

    // 1. Create a test exam for School A
    const [exam] = await db
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
    await db.insert(examClassScopes).values({
      schoolId: schoolA,
      examId: testExamId,
      classId: classAId,
    });

    // 2. Create Mandatory Subject (max: 80, pass: 27)
    const [subMand] = await db
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

    const [csMand] = await db
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
    const [subUnenrolled] = await db
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

    const [csUnenrolled] = await db
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
    const [subEnrolled] = await db
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

    const [csEnrolled] = await db
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
    await db.insert(studentSubjectEnrollments).values({
      schoolId: schoolA,
      studentId: ISOLATION_IDS.schoolA.studentId,
      classSubjectId: enrolledClassSubjectId,
      isElectiveTaken: true,
      enrollmentStatus: "ACTIVE",
    });
  });

  afterAll(async () => {
    // Cleanup created distributions and exam
    if (testExamId) {
      await db
        .delete(examMarkDistributions)
        .where(eq(examMarkDistributions.examId, testExamId));
      await db
        .delete(markEntries)
        .where(eq(markEntries.examId, testExamId));
      await db
        .delete(examComponents)
        .where(eq(examComponents.examId, testExamId));
      await db
        .delete(examClassScopes)
        .where(eq(examClassScopes.examId, testExamId));
      await db.delete(exams).where(eq(exams.id, testExamId));
    }
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
    const existing = await db
      .select()
      .from(examMarkDistributions)
      .where(eq(examMarkDistributions.examId, testExamId));
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

    const dbRows = await db
      .select()
      .from(examMarkDistributions)
      .where(eq(examMarkDistributions.examId, testExamId));

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
    await db
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
    const [verifiedRow] = await db
      .select()
      .from(examMarkDistributions)
      .where(
        and(
          eq(examMarkDistributions.examId, testExamId),
          eq(examMarkDistributions.subjectId, testMandatorySubjectId),
        ),
      );

    expect(Number(verifiedRow?.maxMarks)).toBe(95);
    expect(Number(verifiedRow?.passingMarks)).toBe(38);
  });

  it("6.6: Immutability guard: Prohibits alteration or deletion when student mark entries already exist", async () => {
    // Insert a mark entry for the enrolled elective subject
    await db.insert(markEntries).values({
      schoolId: schoolA,
      examId: testExamId,
      studentId: ISOLATION_IDS.schoolA.studentId,
      subjectId: testEnrolledElectiveSubjectId,
      maxMarks: "100.00",
      marksObtained: "88.00",
      enteredById: ISOLATION_IDS.schoolA.adminUserId,
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
    const [compExam] = await db
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
    const compExamId = compExam!.id;

    await db.insert(examClassScopes).values({
      schoolId: schoolA,
      examId: compExamId,
      classId: classAId,
    });

    // Attach 2 components with distinct examTypes
    const [et2] = await db
      .insert(examTypes)
      .values({
        schoolId: schoolA,
        name: `Practical Type ${runId2}`,
        code: `PRAC_${runId2}`,
        examType: "PRACTICAL",
      })
      .returning();

    const [c1] = await db
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

    const [c2] = await db
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

    const compResult = await generateMarkDistributions({
      schoolId: schoolA,
      examId: compExamId,
      previewOnly: true,
    });

    expect(compResult.success).toBe(true);

    // Filter proposals for mandatory subject (maxMarks = 80)
    const mandTheory = compResult.proposals.find(
      (p) => p.subjectId === testMandatorySubjectId && p.componentId === c1!.id,
    );
    const mandPractical = compResult.proposals.find(
      (p) => p.subjectId === testMandatorySubjectId && p.componentId === c2!.id,
    );

    expect(mandTheory).toBeDefined();
    expect(mandTheory?.maxMarks).toBe(56); // 70% of 80
    expect(mandTheory?.passingMarks).toBe(18.48); // 33% of 56

    expect(mandPractical).toBeDefined();
    expect(mandPractical?.maxMarks).toBe(24); // 30% of 80
    expect(mandPractical?.passingMarks).toBe(7.92); // 33% of 24

    // Cleanup component exam
    await db.delete(examComponents).where(eq(examComponents.examId, compExamId));
    await db.delete(examClassScopes).where(eq(examClassScopes.examId, compExamId));
    await db.delete(exams).where(eq(exams.id, compExamId));
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
