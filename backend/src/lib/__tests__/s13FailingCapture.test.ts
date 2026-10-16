import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { getStudentSubjectEnrollments } from "../enrollmentEngine";
import {
  students,
  consentRecords,
  studentSubjectEnrollments,
  admissionApplications,
  sections,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { withTenant } from "../tenant";
import { generateAdmissionNumber } from "../sequenceGenerator";
import { StudentLifecycleEngine } from "../studentLifecycleEngine";
import { encryptData } from "../encryption";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S13 Layer 9: Inverted Flaw Verification (F2, F3, F4 Permanently Resolved)", () => {
  let pool: Pool;
  const schoolId = ISOLATION_IDS.schoolA.id;
  const academicYearId = ISOLATION_IDS.schoolA.academicYearId;
  const classId = ISOLATION_IDS.schoolA.classId;
  let sectionId = "";

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();

    await withTenant(schoolId, async (tx) => {
      let sec = await tx.query.sections.findFirst({
        where: and(eq(sections.schoolId, schoolId), eq(sections.classId, classId)),
      });
      if (!sec) {
        const [newSec] = await tx
          .insert(sections)
          .values({
            schoolId,
            classId,
            name: "A",
            capacity: 40,
            isActive: true,
          })
          .returning();
        sec = newSec!;
      }
      sectionId = sec.id;
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("F2 Inverted: Sequence-based numbering guarantees zero collisions across sequential allocations", async () => {
    const generated = new Set<string>();
    const TOTAL_ALLOCATIONS = 30;

    for (let i = 0; i < TOTAL_ALLOCATIONS; i++) {
      const num = await generateAdmissionNumber(schoolId, { year: 2026 });
      expect(generated.has(num)).toBe(false);
      generated.add(num);
      expect(num).toMatch(/^ADM-2026-\d{4}$/);
    }

    expect(generated.size).toBe(TOTAL_ALLOCATIONS);
  });

  it("F3 Inverted: Student enrolled via StudentLifecycleEngine immediately has mandatory student_subject_enrollments", async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const mobile = "98" + Math.floor(10000000 + Math.random() * 90000000).toString();

    // 1. Create Application
    let applicationId = "";
    await withTenant(schoolId, async (tx) => {
      const [app] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId,
          applicationNumber: `APP/2026/F3-${runId}`,
          applicantNameEncrypted: encryptData(`EnrolledStu ${runId}`),
          dateOfBirth: new Date("2016-04-10"),
          gender: "MALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_5",
          fatherNameEncrypted: encryptData("Father F3"),
          motherNameEncrypted: encryptData("Mother F3"),
          primaryContactMobileEncrypted: encryptData(mobile),
          primaryContactEmailEncrypted: encryptData(`parent.f3.${runId}@example.com`),
          addressEncrypted: encryptData("F3 Street"),
          pincode: "500001",
          status: "OFFER_LETTER",
        })
        .returning();
      applicationId = app!.id;
    });

    // 2. Enroll via StudentLifecycleEngine
    const result = await StudentLifecycleEngine.enrollApplicant({
      schoolId,
      applicationId,
      classId,
      sectionId,
      performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      performedByUserEmail: "admin@school-a.internal",
      performedByUserRole: "SCHOOL_ADMIN",
      requestIp: "198.51.100.42",
      userAgent: "S13InversionTestAgent",
    });

    expect(result.success).toBe(true);
    expect(result.mandatorySubjectsEnrolledCount).toBeGreaterThan(0);

    // 3. Verify student_subject_enrollments in DB
    const enrollments = await withTenant(schoolId, async (tx) => {
      return await tx.query.studentSubjectEnrollments.findMany({
        where: and(
          eq(studentSubjectEnrollments.schoolId, schoolId),
          eq(studentSubjectEnrollments.studentId, result.studentId),
          eq(studentSubjectEnrollments.enrollmentStatus, "ACTIVE"),
        ),
      });
    });

    expect(enrollments.length).toBe(result.mandatorySubjectsEnrolledCount);
    expect(enrollments.length).toBeGreaterThanOrEqual(1);

    // 4. Verify enrollmentEngine query function sees the enrollments
    const subjectEnrollments = await getStudentSubjectEnrollments(schoolId, result.studentId);
    expect(subjectEnrollments.length).toBe(enrollments.length);
  });

  it("F4 Inverted: Consent creation records truthful admin_attestation, real request IP, and statutory-only purposes", async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const mobile = "98" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const truthfulIp = "198.51.100.77";

    // 1. Create Application
    let applicationId = "";
    await withTenant(schoolId, async (tx) => {
      const [app] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId,
          applicationNumber: `APP/2026/F4-${runId}`,
          applicantNameEncrypted: encryptData(`ConsentStu ${runId}`),
          dateOfBirth: new Date("2016-07-20"),
          gender: "FEMALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_5",
          fatherNameEncrypted: encryptData("Father F4"),
          motherNameEncrypted: encryptData("Mother F4"),
          primaryContactMobileEncrypted: encryptData(mobile),
          primaryContactEmailEncrypted: encryptData(`parent.f4.${runId}@example.com`),
          addressEncrypted: encryptData("F4 Street"),
          pincode: "500001",
          status: "OFFER_LETTER",
        })
        .returning();
      applicationId = app!.id;
    });

    // 2. Enroll via StudentLifecycleEngine
    const result = await StudentLifecycleEngine.enrollApplicant({
      schoolId,
      applicationId,
      classId,
      sectionId,
      performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      performedByUserEmail: "admin@school-a.internal",
      performedByUserRole: "SCHOOL_ADMIN",
      requestIp: truthfulIp,
      userAgent: "S13ConsentTruthAgent",
    });

    expect(result.success).toBe(true);

    // 3. Verify consent records
    const records = await withTenant(schoolId, async (tx) => {
      return await tx.query.consentRecords.findMany({
        where: and(
          eq(consentRecords.schoolId, schoolId),
          eq(consentRecords.studentId, result.studentId),
        ),
      });
    });

    // Must have granted consent for statutory required purposes only
    expect(records.length).toBe(2);
    const purposes = records.map((r) => r.purposeId);
    expect(purposes).toContain("admission_data");
    expect(purposes).toContain("academic_records");
    expect(purposes).not.toContain("transport_tracking");
    expect(purposes).not.toContain("medical_records");

    for (const rec of records) {
      expect(rec.method).toBe("admin_attestation");
      expect(rec.ipAddress).toBe(truthfulIp);
      expect(rec.ipAddress).not.toBe("127.0.0.1");
      expect(rec.parentUserId).toBe(ISOLATION_IDS.schoolA.adminUserId);
    }
  });
});
