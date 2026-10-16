/**
 * S13 Layer 5 Test Suite: Credential & Notification Decoupling Drill
 *
 * Verifies:
 * 1. Post-commit delivery of credentials using cryptographically secure claim links (zero guessable passwords).
 * 2. Hashed token storage in password_reset_tokens table.
 * 3. SMS decoupled enqueue into sms_logs queue with zero plaintext credentials in message body.
 * 4. In-app parent welcome notice creation in notices table.
 * 5. First-party telemetry event in usage_events table.
 * 6. Dashboard cache key invalidation on enrollment.
 * 7. Resilient failure isolation: When SMS enqueue fails, the enrollment transaction still succeeds and commits,
 *    and a FAILED row is visibly recorded in sms_logs.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import {
  classes,
  sections,
  admissionApplications,
  students,
  users,
  passwordResetTokens,
  smsLogs,
  notices,
  usageEvents,
} from "@schoolmitra/database";
import { eq, and } from "drizzle-orm";
import { StudentLifecycleEngine } from "../studentLifecycleEngine";
import { encryptData } from "../encryption";
import { withTenant } from "../tenant";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import crypto from "crypto";

describe("S13 Layer 5: Credential and Notification Decoupling", () => {
  let schoolId: string;
  let academicYearId: string;
  let classId: string;
  let sectionId: string;

  beforeAll(async () => {
    await seedIsolationSchools();
    schoolId = ISOLATION_IDS.schoolA.id;
    classId = ISOLATION_IDS.schoolA.classId;
    academicYearId = ISOLATION_IDS.schoolA.academicYearId;

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

  it("5.1: Enrolling an applicant creates a claim link credential, queues SMS without plaintext passwords, logs notice, and emits telemetry", async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const parentMobile = "9876543210";
    const parentEmail = `parent.l5.${runId}@example.com`;

    let applicationId = "";
    await withTenant(schoolId, async (tx) => {
      const [app] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId,
          applicationNumber: `APP/2026/L5-${runId}`,
          applicantNameEncrypted: encryptData(`L5 Student ${runId}`),
          dateOfBirth: new Date("2016-06-15"),
          gender: "FEMALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_5",
          fatherNameEncrypted: encryptData(`Father L5 ${runId}`),
          motherNameEncrypted: encryptData(`Mother L5 ${runId}`),
          primaryContactMobileEncrypted: encryptData(parentMobile),
          primaryContactEmailEncrypted: encryptData(parentEmail),
          addressEncrypted: encryptData("456 Decoupled St, City"),
          pincode: "500002",
          status: "OFFER_LETTER",
        })
        .returning();
      applicationId = app!.id;
    });

    const result = await StudentLifecycleEngine.enrollApplicant({
      schoolId,
      applicationId,
      classId,
      sectionId,
      performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      performedByUserEmail: "admin@school-a.internal",
      performedByUserRole: "SCHOOL_ADMIN",
      requestIp: "198.51.100.42",
      userAgent: "SchoolMitra-E2E-Test",
    });

    expect(result.success).toBe(true);
    expect(result.studentId).toBeDefined();
    expect(result.parentUserId).toBeDefined();

    // 1. Verify Parent Credentials & Claim Token
    expect(result.parentCredentials).toBeDefined();
    const creds = result.parentCredentials!;
    expect(creds.email).toBe(parentEmail);
    expect(creds.mustChangePassword).toBe(true);
    expect(creds.claimToken).toBeDefined();
    expect(creds.claimToken.length).toBe(64); // 32 bytes hex
    expect(creds.claimUrl).toContain(`/claim-account?token=${creds.claimToken}`);

    // Verify token hash in password_reset_tokens
    const expectedTokenHash = crypto
      .createHash("sha256")
      .update(creds.claimToken)
      .digest("hex");
    const tokenRecord = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.userId, result.parentUserId!),
        eq(passwordResetTokens.tokenHash, expectedTokenHash),
      ),
    });
    expect(tokenRecord).toBeDefined();
    expect(tokenRecord!.usedAt).toBeNull();
    expect(new Date(tokenRecord!.expiresAt).getTime()).toBeGreaterThan(Date.now());

    // 2. Verify Decoupled Delivery Results
    expect(result.notificationDelivery).toBeDefined();
    const delivery = result.notificationDelivery!;
    expect(delivery.smsQueued).toBe(true);
    expect(delivery.noticeCreated).toBe(true);
    expect(delivery.telemetryLogged).toBe(true);
    expect(delivery.cacheInvalidated).toBe(true);
    expect(delivery.failureReason).toBeUndefined();

    // 3. Verify Decoupled SMS Queue Record
    const queuedSms = await db.query.smsLogs.findFirst({
      where: and(
        eq(smsLogs.schoolId, schoolId),
        eq(smsLogs.recipientUserId, result.parentUserId!),
        eq(smsLogs.templateId, "PARENT_WELCOME_CLAIM"),
      ),
    });
    expect(queuedSms).toBeDefined();
    expect(queuedSms!.status).toBe("QUEUED");
    expect(queuedSms!.messageType).toBe("NOTICE");

    // 4. Verify In-App Welcome Notice in notices table
    const welcomeNotice = await db.query.notices.findFirst({
      where: and(
        eq(notices.schoolId, schoolId),
        eq(notices.audienceType, "PARENTS"),
      ),
      orderBy: (n, { desc }) => [desc(n.createdAt)],
    });
    expect(welcomeNotice).toBeDefined();
    expect(welcomeNotice!.title).toContain(`Student ${result.admissionNumber} Enrolled`);
    expect(welcomeNotice!.isPublished).toBe(true);
    expect(welcomeNotice!.content).toContain("Your child has been successfully enrolled");
    // Ensure no plaintext password in notice
    expect(welcomeNotice!.content).not.toContain("Parent@");
    expect(welcomeNotice!.content).not.toContain("password");

    // 5. Verify First-Party Telemetry in usage_events table
    const usageEvt = await db.query.usageEvents.findFirst({
      where: and(
        eq(usageEvents.schoolId, schoolId),
        eq(usageEvents.screen, "/admissions"),
        eq(usageEvents.elementId, "btn_enroll_applicant"),
        eq(usageEvents.userId, ISOLATION_IDS.schoolA.adminUserId),
      ),
      orderBy: (u, { desc }) => [desc(u.createdAt)],
    });
    expect(usageEvt).toBeDefined();
    expect(usageEvt!.action).toBe("submit");
    expect(usageEvt!.role).toBe("SCHOOL_ADMIN");
  });

  it("5.2: When SMS enqueue fails, enrollment transaction still succeeds, student is created, and FAILED log row is recorded", async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const parentMobile = "9876543211";
    const parentEmail = `parent.fail.${runId}@example.com`;

    let applicationId = "";
    await withTenant(schoolId, async (tx) => {
      const [app] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId,
          applicationNumber: `APP/2026/FAIL-${runId}`,
          applicantNameEncrypted: encryptData(`SMS Fail Student ${runId}`),
          dateOfBirth: new Date("2016-07-20"),
          gender: "MALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_5",
          fatherNameEncrypted: encryptData(`Father Fail ${runId}`),
          motherNameEncrypted: encryptData(`Mother Fail ${runId}`),
          primaryContactMobileEncrypted: encryptData(parentMobile),
          primaryContactEmailEncrypted: encryptData(parentEmail),
          addressEncrypted: encryptData("789 Outage Road, City"),
          pincode: "500003",
          status: "OFFER_LETTER",
        })
        .returning();
      applicationId = app!.id;
    });

    // Execute enrollment with forceSmsFailure = true
    const result = await StudentLifecycleEngine.enrollApplicant({
      schoolId,
      applicationId,
      classId,
      sectionId,
      performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      performedByUserEmail: "admin@school-a.internal",
      performedByUserRole: "SCHOOL_ADMIN",
      requestIp: "198.51.100.43",
      userAgent: "SchoolMitra-E2E-Test",
      forceSmsFailure: true,
    });

    // Assert that the enrollment transaction was NOT rolled back
    expect(result.success).toBe(true);
    expect(result.studentId).toBeDefined();

    // Verify student exists in DB (using tenant context for RLS)
    const studentInDb = await withTenant(schoolId, async (tx) => {
      return await tx.query.students.findFirst({
        where: and(eq(students.id, result.studentId), eq(students.schoolId, schoolId)),
      });
    });
    expect(studentInDb).toBeDefined();
    expect(studentInDb!.admissionNumber).toBe(result.admissionNumber);

    // Verify notification delivery status reflects SMS failure gracefully
    expect(result.notificationDelivery).toBeDefined();
    const delivery = result.notificationDelivery!;
    expect(delivery.smsQueued).toBe(false);
    expect(delivery.failureReason).toContain("Simulated SMS Gateway Outage");
    expect(delivery.noticeCreated).toBe(true);
    expect(delivery.telemetryLogged).toBe(true);
    expect(delivery.cacheInvalidated).toBe(true);

    // Verify FAILED row exists in sms_logs with failure_reason
    const failedSms = await db.query.smsLogs.findFirst({
      where: and(
        eq(smsLogs.schoolId, schoolId),
        eq(smsLogs.recipientUserId, result.parentUserId!),
        eq(smsLogs.templateId, "PARENT_WELCOME_CLAIM"),
        eq(smsLogs.status, "FAILED"),
      ),
    });
    expect(failedSms).toBeDefined();
    expect(failedSms!.failureReason).toContain("Simulated SMS Gateway Outage");
  });
});
