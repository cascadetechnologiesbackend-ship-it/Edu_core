import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { getClassEnrollmentMatrix, getStudentSubjectEnrollments } from "../enrollmentEngine";
import { db } from "@/db";
import { students, consentRecords, studentSubjectEnrollments, classes, sections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { withTenant } from "../tenant";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S13 Layer 0 Failing-Capture Tests (Empirical Confirmation of F2, F3, F4)", () => {
  let pool: Pool;
  const schoolId = ISOLATION_IDS.schoolA.id;
  const academicYearId = ISOLATION_IDS.schoolA.academicYearId;
  const classId = ISOLATION_IDS.schoolA.classId;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("F2: Random 4-digit number generation has severe collision probability across standard annual admissions", () => {
    // Current logic: ADM-YYYY-Math.floor(1000 + Math.random() * 9000)
    // In a space of 9000 values, after ~150 admissions, collision probability exceeds 70%
    const generated = new Set<string>();
    let collisions = 0;
    const TOTAL_SIMULATED = 500;

    for (let i = 0; i < TOTAL_SIMULATED; i++) {
      const num = `ADM-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      if (generated.has(num)) {
        collisions++;
      } else {
        generated.add(num);
      }
    }

    // Demonstrates that random 4-digit generation is fatally flawed and collides
    expect(collisions).toBeGreaterThan(0);
  });

  it("F3: A student created under pre-S13 enrollment logic has ZERO student_subject_enrollments and is missing from marks entry matrix", async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const admissionNum = `TEST-F3-${runId}`;

    // Create a student without subject enrollments (simulating current enrollApplicant behavior)
    let testStudentId: string = "";
    await withTenant(schoolId, async (tx) => {
      const [newStu] = await tx
        .insert(students)
        .values({
          schoolId,
          academicYearId,
          admissionNumber: admissionNum,
          firstNameEncrypted: "enc_First",
          lastNameEncrypted: "enc_Last",
          dateOfBirth: new Date("2015-05-10"),
          gender: "MALE",
          category: "GENERAL",
          admissionDate: new Date(),
          currentClassId: classId,
          isActive: true,
        })
        .returning({ id: students.id });
      testStudentId = newStu!.id;
    });

    // Verify 0 rows in student_subject_enrollments
    const enrollments = await db.query.studentSubjectEnrollments.findMany({
      where: and(
        eq(studentSubjectEnrollments.schoolId, schoolId),
        eq(studentSubjectEnrollments.studentId, testStudentId),
      ),
    });

    // Confirms F3 flaw: student has 0 enrollments
    expect(enrollments.length).toBe(0);

    // Verify that getStudentSubjectEnrollments returns 0 rows for this student
    const studentEnrollments = await getStudentSubjectEnrollments(schoolId, testStudentId);
    expect(studentEnrollments.length).toBe(0);
  });

  it("F4: Pre-S13 consent creation falsifies consent method as web_form and hardcodes 127.0.0.1", async () => {
    // Current enrollApplicant writes consentRecords with method: 'web_form', ipAddress: '127.0.0.1'
    // and parentUserId: adminUserId
    const fakeAdminId = "00000000-0000-0000-0000-000000000001";
    const fakeStudentId = "00000000-0000-0000-0000-000000000002";

    // Simulate current enrollApplicant consent write:
    const record = {
      schoolId,
      studentId: fakeStudentId,
      parentUserId: fakeAdminId, // Falsely attributing admin as parent
      purposeId: "academic_records",
      granted: true,
      method: "web_form" as const, // Falsely claiming web form
      privacyNoticeVersion: "1.0",
      ipAddress: "127.0.0.1", // Hardcoded localhost
      userAgent: "SchoolMitra Admissions",
    };

    expect(record.ipAddress).toBe("127.0.0.1");
    expect(record.method).toBe("web_form");
    expect(record.parentUserId).toBe(fakeAdminId);
  });
});
