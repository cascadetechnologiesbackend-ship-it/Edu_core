import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import {
  sections,
  admissionApplications,
  consentRecords,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { StudentLifecycleEngine } from "../studentLifecycleEngine";
import {
  assertConsent,
  requireConsent,
  getConsentStatus,
} from "../../server/middleware/consent";
import { ConsentRequiredError } from "@schoolmitra/dpdp";
import { TRPCError } from "@trpc/server";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { withTenant } from "../tenant";
import { encryptData } from "../encryption";

describe("S13 Layer 4: DPDP Consent Truth, Purpose Limitation & Reconciliation", () => {
  const runId = Math.random().toString(36).substring(2, 7);
  let schoolId: string;
  let academicYearId: string;
  let classId: string;
  let sectionId: string;
  let adminUserId: string;
  let parentUserId: string;
  let applicationId: string;
  let enrolledStudentId: string;

  beforeAll(async () => {
    await seedIsolationSchools();
    schoolId = ISOLATION_IDS.schoolA.id;
    academicYearId = ISOLATION_IDS.schoolA.academicYearId;
    classId = ISOLATION_IDS.schoolA.classId;
    adminUserId = ISOLATION_IDS.schoolA.adminUserId;

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

      // Create an approved application for testing
      const [app] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId,
          applicationNumber: `APP/2026/DPDP-${runId}`,
          applicantNameEncrypted: encryptData(`DPDP Student ${runId}`),
          dateOfBirth: new Date("2016-04-12"),
          gender: "MALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_5",
          fatherNameEncrypted: encryptData(`Father ${runId}`),
          motherNameEncrypted: encryptData(`Mother ${runId}`),
          primaryContactMobileEncrypted: encryptData("9876543210"),
          primaryContactEmailEncrypted: encryptData(`parent.dpdp.${runId}@example.com`),
          addressEncrypted: encryptData("123 Test Lane, City"),
          pincode: "500001",
          status: "OFFER_LETTER",
        })
        .returning();
      applicationId = app!.id;
    });
  });

  it("Task 1: Truthful consent records created upon enrollment with admin_attestation, real IP, and statutory-only purposes", async () => {
    const clientIp = "198.51.100.77";
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SchoolMitraAdmin/13.0";

    const enrollmentResult = await StudentLifecycleEngine.enrollApplicant({
      schoolId,
      applicationId,
      classId,
      sectionId,
      performedByUserId: adminUserId,
      clientIp,
      userAgent,
    });

    expect(enrollmentResult.success).toBe(true);
    enrolledStudentId = enrollmentResult.studentId!;
    parentUserId = enrollmentResult.parentUserId!;

    // Query all consent records created for this student with tenant isolation
    const records = await withTenant(schoolId, async (tx) => {
      return await tx.query.consentRecords.findMany({
        where: eq(consentRecords.studentId, enrolledStudentId),
      });
    });

    // Verify statutory-only pre-grant scope (admission_data and academic_records)
    const purposeIds = records.map((r) => r.purposeId).sort();
    expect(purposeIds).toEqual(["academic_records", "admission_data"]);

    // Verify attribution truth: admin_attestation, acting admin recorded, real IP
    for (const record of records) {
      expect(record.method).toBe("admin_attestation");
      expect(record.parentUserId).toBe(adminUserId);
      expect(record.ipAddress).toBe(clientIp);
      expect(record.userAgent).toBe(userAgent);
      expect(record.granted).toBe(true);
      expect(record.withdrawnAt).toBeNull();
    }

    // Verify optional purposes (transport, health_records, communication) were NOT created
    expect(purposeIds).not.toContain("transport");
    expect(purposeIds).not.toContain("health_records");
    expect(purposeIds).not.toContain("communication");
  });

  it("Task 2A: assertConsent passes for statutory pre-granted purposes", async () => {
    await withTenant(schoolId, async (tx) => {
      await expect(
        assertConsent(enrolledStudentId, "admission_data", tx),
      ).resolves.not.toThrow();

      await expect(
        assertConsent(enrolledStudentId, "academic_records", tx),
      ).resolves.not.toThrow();
    });
  });

  it("Task 2B: assertConsent fails-closed and throws ConsentRequiredError for deferred optional purposes", async () => {
    await withTenant(schoolId, async (tx) => {
      await expect(
        assertConsent(enrolledStudentId, "transport", tx),
      ).rejects.toThrow(ConsentRequiredError);

      await expect(
        assertConsent(enrolledStudentId, "health_records", tx),
      ).rejects.toThrow(ConsentRequiredError);

      await expect(
        assertConsent(enrolledStudentId, "communication", tx),
      ).rejects.toThrow(ConsentRequiredError);
    });
  });

  it("Task 2C: Reconciliation rule: Parent explicit opt-in grants optional purpose", async () => {
    const parentIp = "203.0.113.88";
    const parentUa = "ParentMobileApp/2.4 (Android 14)";
    const grantTime = new Date();

    await withTenant(schoolId, async (tx) => {
      // Parent explicitly grants transport via portal web_form / app opt-in
      await tx.insert(consentRecords).values({
        schoolId,
        studentId: enrolledStudentId,
        parentUserId,
        purposeId: "transport",
        privacyNoticeVersion: "1.0",
        granted: true,
        method: "web_form",
        ipAddress: parentIp,
        userAgent: parentUa,
        otpVerified: true,
        grantedAt: grantTime,
        createdAt: grantTime,
      });

      // assertConsent for transport must now PASS immediately
      await expect(
        assertConsent(enrolledStudentId, "transport", tx),
      ).resolves.not.toThrow();

      // getConsentStatus reports transport as true
      const status = await getConsentStatus(enrolledStudentId, tx);
      expect(status.transport).toBe(true);
      expect(status.admission_data).toBe(true);
      expect(status.academic_records).toBe(true);
      expect(status.health_records).toBe(false); // Still deferred
    });
  });

  it("Task 2D: Reconciliation rule: Parent explicit withdrawal supersedes prior grant", async () => {
    const parentIp = "203.0.113.88";
    const parentUa = "ParentMobileApp/2.4 (Android 14)";
    const withdrawTime = new Date(Date.now() + 1000);

    await withTenant(schoolId, async (tx) => {
      // Parent explicitly withdraws transport
      await tx.insert(consentRecords).values({
        schoolId,
        studentId: enrolledStudentId,
        parentUserId,
        purposeId: "transport",
        privacyNoticeVersion: "1.0",
        granted: false,
        method: "web_form",
        ipAddress: parentIp,
        userAgent: parentUa,
        otpVerified: true,
        grantedAt: withdrawTime,
        withdrawnAt: withdrawTime,
        withdrawalReason: "Switched to private van pool",
        processingHaltedAt: withdrawTime,
        createdAt: withdrawTime,
      });

      // assertConsent for transport must now FAIL-CLOSED
      await expect(
        assertConsent(enrolledStudentId, "transport", tx),
      ).rejects.toThrow(ConsentRequiredError);

      // getConsentStatus reports transport as false
      const status = await getConsentStatus(enrolledStudentId, tx);
      expect(status.transport).toBe(false);
    });
  });

  it("Task 2E: requireConsent tRPC middleware enforces the exact same contract", async () => {
    const middlewareAcademic = requireConsent("academic_records");
    const middlewareTransport = requireConsent("transport");

    let nextCalled = false;
    const nextFn = async () => {
      nextCalled = true;
      return "SUCCESS";
    };

    await withTenant(schoolId, async () => {
      // Calling requireConsent for academic_records succeeds
      await middlewareAcademic({
        ctx: { session: { user: { id: adminUserId } } },
        next: nextFn,
        rawInput: { studentId: enrolledStudentId },
      });
      expect(nextCalled).toBe(true);

      // Calling requireConsent for transport (currently withdrawn) throws TRPCError FORBIDDEN
      await expect(
        middlewareTransport({
          ctx: { session: { user: { id: adminUserId } } },
          next: nextFn,
          rawInput: { studentId: enrolledStudentId },
        }),
      ).rejects.toThrow(TRPCError);
    });
  });
});
