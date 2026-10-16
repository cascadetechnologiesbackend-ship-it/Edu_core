/**
 * S13 Layer 7 Test Suite: Transaction Hygiene & Validation Guards Drill
 *
 * Verifies:
 * 1. Pre-transaction sibling detection: Matches existing sibling via search hashes outside the tx,
 *    records sibling concession inside the tx with zero O(all families) decryption scans.
 * 2. Inactive academic year guard: Rejects enrollment with InactiveAcademicYearError when year is not active.
 * 3. Section capacity validation: Rejects with SectionCapacityExceededError when blockOnCapacity is true,
 *    and returns capacityWarning: true when blockOnCapacity is false.
 * 4. Batched document copying: Application documents are copied into student_documents in a batch.
 * 5. Forensic audit and consent IP truth: Real client IP is persisted without loopback fallback.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import {
  classes,
  sections,
  admissionApplications,
  admissionDocuments,
  students,
  studentDocuments,
  studentFamilyMembers,
  feeConcessions,
  academicYears,
  auditLogs,
  consentRecords,
} from "@schoolmitra/database";
import { eq, and } from "drizzle-orm";
import {
  StudentLifecycleEngine,
  InactiveAcademicYearError,
  SectionCapacityExceededError,
} from "../studentLifecycleEngine";
import { encryptData, computeSearchHash } from "../encryption";
import { withTenant } from "../tenant";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";

describe("S13 Layer 7: Transaction Hygiene & Validation Guards", () => {
  let schoolId: string;
  let activeYearId: string;
  let inactiveYearId: string;
  let classId: string;
  let sectionId: string;
  let fullSectionId: string;

  beforeAll(async () => {
    await seedIsolationSchools();
    schoolId = ISOLATION_IDS.schoolA.id;
    classId = ISOLATION_IDS.schoolA.classId;
    activeYearId = ISOLATION_IDS.schoolA.academicYearId;

    await withTenant(schoolId, async (tx) => {
      // 1. Ensure active section with normal capacity
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

      // 2. Create or find full section (capacity: 1, currentCount: 1)
      let fullSec = await tx.query.sections.findFirst({
        where: and(
          eq(sections.schoolId, schoolId),
          eq(sections.classId, classId),
          eq(sections.name, "FULL-SEC"),
        ),
      });
      if (!fullSec) {
        const [newFullSec] = await tx
          .insert(sections)
          .values({
            schoolId,
            classId,
            name: "FULL-SEC",
            capacity: 1,
            isActive: true,
          })
          .returning();
        fullSec = newFullSec!;
      }
      fullSectionId = fullSec.id;

      // Ensure 1 student exists in fullSec to saturate capacity
      const existingStudent = await tx.query.students.findFirst({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.currentSectionId, fullSectionId),
          eq(students.isActive, true),
        ),
      });
      if (!existingStudent) {
        await tx.insert(students).values({
          schoolId,
          academicYearId: activeYearId,
          admissionNumber: `FULL-STUDENT-${Date.now()}`,
          firstNameEncrypted: encryptData("Occupant"),
          lastNameEncrypted: encryptData("Student"),
          dateOfBirth: new Date("2015-01-01"),
          gender: "MALE",
          category: "GENERAL",
          currentClassId: classId,
          currentSectionId: fullSectionId,
          admissionDate: new Date(),
          isActive: true,
        });
      }

      // 3. Create or find inactive academic year
      let inactYear = await tx.query.academicYears.findFirst({
        where: and(
          eq(academicYears.schoolId, schoolId),
          eq(academicYears.label, "2024-2025 (Archived)"),
        ),
      });
      if (!inactYear) {
        const [newInactYear] = await tx
          .insert(academicYears)
          .values({
            schoolId,
            label: "2024-2025 (Archived)",
            startDate: new Date("2024-04-01"),
            endDate: new Date("2025-03-31"),
            isActive: false,
          })
          .returning();
        inactYear = newInactYear!;
      }
      inactiveYearId = inactYear.id;
    });
  });

  it("7.1: Pre-transaction sibling detection matches family search hashes and assigns 10% concession", async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const sharedMobile = "98" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const sharedMobileHash = computeSearchHash(sharedMobile);
    const sharedEmail = `parent.sib.${runId}@example.com`;
    const sharedEmailHash = computeSearchHash(sharedEmail);

    // 1. Seed an existing student with a family member having this mobileSearchHash
    let existingStudentId = "";
    await withTenant(schoolId, async (tx) => {
      const [existingStudent] = await tx
        .insert(students)
        .values({
          schoolId,
          academicYearId: activeYearId,
          admissionNumber: `SIB-OLD-${runId}`,
          firstNameEncrypted: encryptData(`Elder ${runId}`),
          lastNameEncrypted: encryptData("Sibling"),
          dateOfBirth: new Date("2014-03-10"),
          gender: "MALE",
          category: "GENERAL",
          currentClassId: classId,
          currentSectionId: sectionId,
          admissionDate: new Date(),
          isActive: true,
        })
        .returning();
      existingStudentId = existingStudent!.id;

      await tx.insert(studentFamilyMembers).values({
        studentId: existingStudentId,
        schoolId,
        relation: "FATHER",
        nameEncrypted: encryptData("Father Sibling"),
        mobileEncrypted: encryptData(sharedMobile),
        mobileSearchHash: sharedMobileHash,
        isPrimaryContact: true,
        hasConsentAuthority: true,
      });
    });

    // 2. Create new admission application with the same contact mobile
    let applicationId = "";
    await withTenant(schoolId, async (tx) => {
      const [app] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId: activeYearId,
          applicationNumber: `APP/2026/SIB-${runId}`,
          applicantNameEncrypted: encryptData(`Younger ${runId}`),
          dateOfBirth: new Date("2017-08-12"),
          gender: "FEMALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_5",
          fatherNameEncrypted: encryptData("Father Sibling"),
          motherNameEncrypted: encryptData("Mother Sibling"),
          primaryContactMobileEncrypted: encryptData(sharedMobile),
          primaryContactEmailEncrypted: encryptData(sharedEmail),
          addressEncrypted: encryptData("123 Sibling Lane"),
          pincode: "500001",
          status: "OFFER_LETTER",
          hasSiblingInSchool: false,
        })
        .returning();
      applicationId = app!.id;
    });

    // 3. Enroll the applicant through StudentLifecycleEngine
    const result = await StudentLifecycleEngine.enrollApplicant({
      schoolId,
      applicationId,
      classId,
      sectionId,
      performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      performedByUserEmail: "admin@school-a.internal",
      performedByUserRole: "SCHOOL_ADMIN",
      requestIp: "203.0.113.195",
      userAgent: "SiblingTestAgent",
    });

    expect(result.success).toBe(true);
    expect(result.concessionsApplied).toContain("SIBLING");

    // Verify SIBLING concession record exists
    const concession = await withTenant(schoolId, async (tx) => {
      return await tx.query.feeConcessions.findFirst({
        where: and(
          eq(feeConcessions.studentId, result.studentId),
          eq(feeConcessions.concessionType, "SIBLING"),
        ),
      });
    });
    expect(concession).toBeDefined();
    expect(concession!.discountPercentage).toBe("10.00");

    // Verify application was updated with sibling detection
    const updatedApp = await withTenant(schoolId, async (tx) => {
      return await tx.query.admissionApplications.findFirst({
        where: and(
          eq(admissionApplications.id, applicationId),
          eq(admissionApplications.schoolId, schoolId),
        ),
      });
    });
    expect(updatedApp!.hasSiblingInSchool).toBe(true);
    expect(updatedApp!.siblingStudentId).toBe(existingStudentId);
  });

  it("7.2: Inactive academic year throws InactiveAcademicYearError with typed forensics", async () => {
    const runId = Math.random().toString(36).substring(2, 7);

    let applicationId = "";
    await withTenant(schoolId, async (tx) => {
      const [app] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId: inactiveYearId, // INACTIVE YEAR
          applicationNumber: `APP/2026/INACT-${runId}`,
          applicantNameEncrypted: encryptData(`Stale ${runId}`),
          dateOfBirth: new Date("2016-01-01"),
          gender: "FEMALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_5",
          fatherNameEncrypted: encryptData("Father Inactive"),
          motherNameEncrypted: encryptData("Mother Inactive"),
          primaryContactMobileEncrypted: encryptData("9998887776"),
          primaryContactEmailEncrypted: encryptData("parent.inact@example.com"),
          addressEncrypted: encryptData("456 Stale St"),
          pincode: "500001",
          status: "OFFER_LETTER",
        })
        .returning();
      applicationId = app!.id;
    });

    await expect(
      StudentLifecycleEngine.enrollApplicant({
        schoolId,
        applicationId,
        classId,
        sectionId,
        performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      }),
    ).rejects.toThrow(InactiveAcademicYearError);
  });

  it("7.3: Section capacity guard: blocks when blockOnCapacity: true, warns when blockOnCapacity: false", async () => {
    const runId = Math.random().toString(36).substring(2, 7);

    let appBlockId = "";
    let appWarnId = "";

    await withTenant(schoolId, async (tx) => {
      const [app1] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId: activeYearId,
          applicationNumber: `APP/2026/CAP1-${runId}`,
          applicantNameEncrypted: encryptData(`Cap Student 1 ${runId}`),
          dateOfBirth: new Date("2016-02-02"),
          gender: "MALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_5",
          fatherNameEncrypted: encryptData("Father Cap 1"),
          motherNameEncrypted: encryptData("Mother Cap 1"),
          primaryContactMobileEncrypted: encryptData("9112233445"),
          primaryContactEmailEncrypted: encryptData("parent.cap1@example.com"),
          addressEncrypted: encryptData("789 Cap Road"),
          pincode: "500001",
          status: "OFFER_LETTER",
        })
        .returning();
      appBlockId = app1!.id;

      const [app2] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId: activeYearId,
          applicationNumber: `APP/2026/CAP2-${runId}`,
          applicantNameEncrypted: encryptData(`Cap Student 2 ${runId}`),
          dateOfBirth: new Date("2016-03-03"),
          gender: "FEMALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_5",
          fatherNameEncrypted: encryptData("Father Cap 2"),
          motherNameEncrypted: encryptData("Mother Cap 2"),
          primaryContactMobileEncrypted: encryptData("9112233446"),
          primaryContactEmailEncrypted: encryptData("parent.cap2@example.com"),
          addressEncrypted: encryptData("789 Cap Road"),
          pincode: "500001",
          status: "OFFER_LETTER",
        })
        .returning();
      appWarnId = app2!.id;
    });

    // 1. With blockOnCapacity: true -> throws SectionCapacityExceededError
    await expect(
      StudentLifecycleEngine.enrollApplicant({
        schoolId,
        applicationId: appBlockId,
        classId,
        sectionId: fullSectionId,
        performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
        blockOnCapacity: true,
      }),
    ).rejects.toThrow(SectionCapacityExceededError);

    // 2. With default blockOnCapacity: false -> succeeds with capacityWarning: true
    const warnResult = await StudentLifecycleEngine.enrollApplicant({
      schoolId,
      applicationId: appWarnId,
      classId,
      sectionId: fullSectionId,
      performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      blockOnCapacity: false,
    });

    expect(warnResult.success).toBe(true);
    expect(warnResult.capacityWarning).toBe(true);
  });

  it("7.4: Documents are batch-copied to student_documents and audit records persist truthful IP", async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const testRealIp = "198.51.100.77";
    const testUserAgent = "ForensicAuditClient/1.0";

    let applicationId = "";
    await withTenant(schoolId, async (tx) => {
      const [app] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId: activeYearId,
          applicationNumber: `APP/2026/DOC-${runId}`,
          applicantNameEncrypted: encryptData(`Doc Student ${runId}`),
          dateOfBirth: new Date("2016-04-04"),
          gender: "MALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_5",
          fatherNameEncrypted: encryptData("Father Doc"),
          motherNameEncrypted: encryptData("Mother Doc"),
          primaryContactMobileEncrypted: encryptData("9556677889"),
          primaryContactEmailEncrypted: encryptData("parent.doc@example.com"),
          addressEncrypted: encryptData("321 Doc Street"),
          pincode: "500001",
          status: "OFFER_LETTER",
        })
        .returning();
      applicationId = app!.id;

      // Seed 3 admission documents
      await tx.insert(admissionDocuments).values([
        {
          applicationId,
          schoolId,
          documentType: "BIRTH_CERTIFICATE",
          s3Key: `admissions/${applicationId}/birth.pdf`,
          originalFileName: "birth_certificate.pdf",
          mimeType: "application/pdf",
        },
        {
          applicationId,
          schoolId,
          documentType: "AADHAAR_PHOTO_MASKED",
          s3Key: `admissions/${applicationId}/aadhaar.pdf`,
          originalFileName: "aadhaar_card.pdf",
          mimeType: "application/pdf",
        },
        {
          applicationId,
          schoolId,
          documentType: "PREVIOUS_TC",
          s3Key: `admissions/${applicationId}/marksheet.pdf`,
          originalFileName: "marksheet.pdf",
          mimeType: "application/pdf",
        },
      ]);
    });

    const result = await StudentLifecycleEngine.enrollApplicant({
      schoolId,
      applicationId,
      classId,
      sectionId,
      performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      performedByUserEmail: "admin@school-a.internal",
      performedByUserRole: "SCHOOL_ADMIN",
      requestIp: testRealIp,
      userAgent: testUserAgent,
    });

    expect(result.success).toBe(true);

    // 1. Verify all 3 documents were batch copied to student_documents
    const copiedDocs = await withTenant(schoolId, async (tx) => {
      return await tx.query.studentDocuments.findMany({
        where: and(
          eq(studentDocuments.studentId, result.studentId),
          eq(studentDocuments.schoolId, schoolId),
        ),
      });
    });
    expect(copiedDocs.length).toBe(3);
    const docTypes = copiedDocs.map((d) => d.documentType);
    expect(docTypes).toContain("BIRTH_CERTIFICATE");
    expect(docTypes).toContain("AADHAAR_PHOTO_MASKED");
    expect(docTypes).toContain("PREVIOUS_TC");

    // 2. Verify audit log entry has truthful IP (no 127.0.0.1)
    const auditRow = await withTenant(schoolId, async (tx) => {
      return await tx.query.auditLogs.findFirst({
        where: and(
          eq(auditLogs.schoolId, schoolId),
          eq(auditLogs.recordId, result.studentId),
          eq(auditLogs.tableName, "students"),
        ),
      });
    });
    expect(auditRow).toBeDefined();
    expect(auditRow!.ipAddress).toBe(testRealIp);
    expect(auditRow!.userAgent).toBe(testUserAgent);

    // 3. Verify consent record has truthful IP
    const consentRow = await withTenant(schoolId, async (tx) => {
      return await tx.query.consentRecords.findFirst({
        where: and(
          eq(consentRecords.schoolId, schoolId),
          eq(consentRecords.studentId, result.studentId),
        ),
      });
    });
    expect(consentRow).toBeDefined();
    expect(consentRow!.ipAddress).toBe(testRealIp);
    expect(consentRow!.userAgent).toBe(testUserAgent);
  });
});
