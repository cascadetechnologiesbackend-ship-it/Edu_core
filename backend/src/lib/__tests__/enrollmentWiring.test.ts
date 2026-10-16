/**
 * S13 Layer 3 Test Suite: Enrollment Backfill & Marks Matrix Wiring Drill
 *
 * Verifies:
 * 1. Automatic In-Transaction Enrollment: Enrolling an applicant creates ACTIVE student_subject_enrollments
 *    for all mandatory class subjects inside the enrollment transaction.
 * 2. Immediate Matrix Visibility: Immediately after enrollment, the new student is present in
 *    getClassEnrollmentMatrix with enrollments: { [classSubjectId]: true } for all mandatory subjects.
 * 3. Inversion of F3: A new student is never left with zero enrollments or invisible to scholastic evaluation.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import {
  schools,
  academicYears,
  classes,
  sections,
  subjects,
  classSubjects,
  admissionApplications,
  studentSubjectEnrollments,
} from "@schoolmitra/database";
import { eq, and } from "drizzle-orm";
import { StudentLifecycleEngine } from "../studentLifecycleEngine";
import {
  getClassEnrollmentMatrix,
  getStudentSubjectEnrollments,
} from "../enrollmentEngine";
import { encryptData } from "../encryption";
import { withTenant } from "../tenant";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";

describe("S13 Layer 3: Enrollment Backfill & Marks Entry Matrix Wiring Drill", () => {
  let schoolId: string;
  let academicYearId: string;
  let classId: string;
  let sectionId: string;
  let mandatorySubject1Id: string;
  let mandatorySubject2Id: string;
  let electiveSubjectId: string;
  let classSubjectMandatory1: string;
  let classSubjectMandatory2: string;
  let classSubjectElective: string;

  beforeAll(async () => {
    const runId = Math.random().toString(36).substring(2, 7);

    const [school] = await db
      .insert(schools)
      .values({
        name: `Enrollment Wiring School ${runId}`,
        slug: `ew-${runId}`,
        udiseCode: `UD${Math.floor(100000000 + Math.random() * 900000000)}`,
        board: "CBSE",
        address: "123 Testway",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110001",
        phone: "9876543210",
        email: `school_${runId}@example.com`,
        principalName: "Principal Test",
        establishedYear: 2010,
      })
      .returning();
    schoolId = school!.id;

    const [ay] = await db
      .insert(academicYears)
      .values({
        schoolId,
        label: `2026-2027 EW ${runId}`,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isActive: true,
      })
      .returning();
    academicYearId = ay!.id;

    await withTenant(schoolId, async (tx) => {
      // 1. Create a dedicated class and section
      const [cls] = await tx
        .insert(classes)
        .values({
          schoolId,
          academicYearId,
          displayName: `L3 Class ${runId}`,
          gradeLevel: "CLASS_8",
          sortOrder: 8,
          isActive: true,
        })
        .returning();
      classId = cls!.id;

      const [sec] = await tx
        .insert(sections)
        .values({
          schoolId,
          classId,
          name: "A",
          capacity: 40,
          isActive: true,
        })
        .returning();
      sectionId = sec!.id;

      // 2. Create 2 mandatory subjects and 1 elective subject
      const [sub1] = await tx
        .insert(subjects)
        .values({
          schoolId,
          code: `L3_MATH_${runId}`,
          name: "Mathematics",
          subjectType: "THEORY",
        })
        .returning();
      mandatorySubject1Id = sub1!.id;

      const [sub2] = await tx
        .insert(subjects)
        .values({
          schoolId,
          code: `L3_ENG_${runId}`,
          name: "English",
          subjectType: "THEORY",
        })
        .returning();
      mandatorySubject2Id = sub2!.id;

      const [sub3] = await tx
        .insert(subjects)
        .values({
          schoolId,
          code: `L3_ART_${runId}`,
          name: "Fine Arts",
          subjectType: "PRACTICAL",
        })
        .returning();
      electiveSubjectId = sub3!.id;

      // 3. Map class subjects
      const [cs1] = await tx
        .insert(classSubjects)
        .values({
          schoolId,
          classId,
          subjectId: mandatorySubject1Id,
          isElective: false, // Mandatory
          periodsPerWeek: 4,
        })
        .returning();
      classSubjectMandatory1 = cs1!.id;

      const [cs2] = await tx
        .insert(classSubjects)
        .values({
          schoolId,
          classId,
          subjectId: mandatorySubject2Id,
          isElective: false, // Mandatory
          periodsPerWeek: 3,
        })
        .returning();
      classSubjectMandatory2 = cs2!.id;

      const [cs3] = await tx
        .insert(classSubjects)
        .values({
          schoolId,
          classId,
          subjectId: electiveSubjectId,
          isElective: true, // Elective
          periodsPerWeek: 2,
        })
        .returning();
      classSubjectElective = cs3!.id;
    });
  });

  it("3.1: Enrolling an applicant immediately creates ACTIVE mandatory subject enrollments inside the enrollment transaction", async () => {
    const runId = Math.random().toString(36).substring(2, 7);

    // 1. Create admission application in OFFER_LETTER state
    let applicationId: string = "";
    await withTenant(schoolId, async (tx) => {
      const [app] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId,
          applicationNumber: `APP/2026/L3_${runId}`,
          applicantNameEncrypted: encryptData(`Kavya ${runId}`),
          dateOfBirth: new Date("2012-08-20"),
          gender: "FEMALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_8",
          fatherNameEncrypted: encryptData(`Father ${runId}`),
          motherNameEncrypted: encryptData(`Mother ${runId}`),
          primaryContactMobileEncrypted: encryptData("9876543210"),
          primaryContactEmailEncrypted: encryptData(`kavya_${runId}@example.com`),
          addressEncrypted: encryptData("789 Green Valley, Delhi"),
          pincode: "110001",
          status: "OFFER_LETTER",
        })
        .returning();
      applicationId = app!.id;
    });

    // 2. Enroll applicant through StudentLifecycleEngine
    const enrollmentResult = await StudentLifecycleEngine.enrollApplicant({
      schoolId,
      applicationId,
      classId,
      sectionId,
      performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      performedByUserEmail: "admin.a@isolation.internal",
      performedByUserRole: "SCHOOL_ADMIN",
    });

    expect(enrollmentResult.success).toBe(true);
    expect(enrollmentResult.studentId).toBeTruthy();
    // Must have enrolled in at least the 2 mandatory subjects
    expect(enrollmentResult.mandatorySubjectsEnrolledCount).toBe(2);

    // 3. Query student_subject_enrollments directly
    const enrollments = await withTenant(schoolId, async (tx) => {
      return await tx.query.studentSubjectEnrollments.findMany({
        where: eq(studentSubjectEnrollments.studentId, enrollmentResult.studentId),
      });
    });

    expect(enrollments.length).toBe(2);
    const enrolledClassSubjectIds = enrollments.map((e) => e.classSubjectId);
    expect(enrolledClassSubjectIds).toContain(classSubjectMandatory1);
    expect(enrolledClassSubjectIds).toContain(classSubjectMandatory2);
    expect(enrolledClassSubjectIds).not.toContain(classSubjectElective); // Elective unassigned by default

    for (const e of enrollments) {
      expect(e.enrollmentStatus).toBe("ACTIVE");
      expect(e.isElectiveTaken).toBe(true);
    }

    // 4. Query getStudentSubjectEnrollments helper
    const studentEnrs = await getStudentSubjectEnrollments(schoolId, enrollmentResult.studentId);
    expect(studentEnrs.length).toBe(2);

    // 5. Query getClassEnrollmentMatrix (The Marks Entry & Enrollment Matrix surface)
    const matrix = await getClassEnrollmentMatrix(schoolId, classId);
    const matrixStudent = matrix.students.find((s) => s.studentId === enrollmentResult.studentId);

    expect(matrixStudent).toBeTruthy();
    expect(matrixStudent!.admissionNumber).toBe(enrollmentResult.admissionNumber);
    expect(matrixStudent!.enrollments[classSubjectMandatory1]).toBe(true);
    expect(matrixStudent!.enrollments[classSubjectMandatory2]).toBe(true);
    expect(matrixStudent!.enrollments[classSubjectElective]).toBe(false); // Elective false until chosen
  });
});
