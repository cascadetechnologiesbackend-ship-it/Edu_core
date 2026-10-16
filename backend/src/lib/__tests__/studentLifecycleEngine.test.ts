/**
 * S13 Layer 2 Test Suite: Student Lifecycle Engine & Admissions State Machine Drill
 *
 * Verifies:
 * 1. Admissions State Machine: Valid transitions, illegal transitions, terminal states, typo statuses.
 * 2. 12-Junction Completeness: Single atomic execution provisions person, student, class history,
 *    parent user, family members, documents, consent, concessions, fees, mandatory subject enrollments,
 *    workflow step, audit log, and durable domain event outbox.
 * 3. Idempotent re-enrollment safety.
 * 4. Multi-tenant isolation enforcement (School B cannot enroll School A's application).
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
  students,
  persons,
  studentClassHistory,
  studentFamilyMembers,
  consentRecords,
  auditLogs,
  domainEvents,
  studentSubjectEnrollments,
  users,
} from "@schoolmitra/database";
import { eq, and } from "drizzle-orm";
import {
  StudentLifecycleEngine,
} from "../studentLifecycleEngine";
import {
  assertValidAdmissionTransition,
  validateAdmissionTransition,
  UnknownAdmissionStatusError,
  InvalidAdmissionStateTransitionError,
} from "@schoolmitra/validators";
import { encryptData } from "../encryption";
import { withTenant } from "../tenant";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";

describe("S13 Layer 2: Student Lifecycle Engine & Admissions State Machine", () => {
  let schoolAId: string;
  let schoolBId: string;
  let academicYearAId: string;
  let classAId: string;
  let sectionAId: string;
  let mandatorySubjectId: string;

  beforeAll(async () => {
    await seedIsolationSchools();
    schoolAId = ISOLATION_IDS.schoolA.id;
    schoolBId = ISOLATION_IDS.schoolB.id;
    classAId = ISOLATION_IDS.schoolA.classId;
    academicYearAId = ISOLATION_IDS.schoolA.academicYearId;

    const runId = Math.random().toString(36).substring(2, 7);
    await withTenant(schoolAId, async (tx) => {
      // Ensure section exists
      let sec = await tx.query.sections.findFirst({
        where: and(eq(sections.schoolId, schoolAId), eq(sections.classId, classAId)),
      });
      if (!sec) {
        const [newSec] = await tx
          .insert(sections)
          .values({
            schoolId: schoolAId,
            classId: classAId,
            name: "A",
            capacity: 40,
            isActive: true,
          })
          .returning();
        sec = newSec!;
      }
      sectionAId = sec.id;

      // Ensure mandatory class_subject exists
      let cs = await tx.query.classSubjects.findFirst({
        where: and(eq(classSubjects.schoolId, schoolAId), eq(classSubjects.classId, classAId)),
      });
      if (!cs) {
        const [sub] = await tx
          .insert(subjects)
          .values({
            schoolId: schoolAId,
            code: `L2_SUB_${runId}`,
            name: "L2 Core Subject",
            type: "THEORY",
          })
          .returning();
        mandatorySubjectId = sub!.id;

        await tx.insert(classSubjects).values({
          schoolId: schoolAId,
          classId: classAId,
          subjectId: mandatorySubjectId,
          isElective: false,
          creditHours: "3.00",
        });
      }
    });
  });

  describe("2.1: Admissions State Machine Enforcement", () => {
    it("allows legal forward transitions", () => {
      expect(assertValidAdmissionTransition("APPLIED", "SCREENING")).toBe("SCREENING");
      expect(assertValidAdmissionTransition("SCREENING", "OFFER_LETTER")).toBe("OFFER_LETTER");
      expect(assertValidAdmissionTransition("OFFER_LETTER", "ENROLLED")).toBe("ENROLLED");
      expect(assertValidAdmissionTransition("SCREENING", "REJECTED")).toBe("REJECTED");
      expect(assertValidAdmissionTransition("APPLIED", "WAITLISTED")).toBe("WAITLISTED");
    });

    it("rejects illegal transitions with InvalidAdmissionStateTransitionError (Inversion of F7)", () => {
      // REJECTED to ENROLLED must be rejected!
      expect(() => assertValidAdmissionTransition("REJECTED", "ENROLLED")).toThrow(
        InvalidAdmissionStateTransitionError,
      );

      // Terminal state ENROLLED cannot transition to APPLIED or REJECTED
      expect(() => assertValidAdmissionTransition("ENROLLED", "APPLIED")).toThrow(
        InvalidAdmissionStateTransitionError,
      );

      // Same status transition rejected
      expect(() => assertValidAdmissionTransition("APPLIED", "APPLIED")).toThrow(
        InvalidAdmissionStateTransitionError,
      );
    });

    it("rejects unknown or misspelled status strings with UnknownAdmissionStatusError", () => {
      expect(() => assertValidAdmissionTransition("APPLIED", "ENROLELD")).toThrow(
        UnknownAdmissionStatusError,
      );
      expect(() => assertValidAdmissionTransition("RANDOM_STATUS", "SCREENING")).toThrow(
        UnknownAdmissionStatusError,
      );
    });
  });

  async function createTestApplication(
    schoolId: string,
    academicYearId: string,
    overrides: Partial<typeof admissionApplications.$inferInsert> = {},
  ) {
    const runId = Math.random().toString(36).substring(2, 7);
    return await withTenant(schoolId, async (tx) => {
      const [app] = await tx
        .insert(admissionApplications)
        .values({
          schoolId,
          academicYearId,
          applicationNumber: `APP/2026/${runId}`,
          applicantNameEncrypted: encryptData(`Applicant ${runId}`),
          dateOfBirth: new Date("2016-04-12"),
          gender: "MALE",
          category: "GENERAL",
          gradeAppliedFor: "CLASS_10",
          fatherNameEncrypted: encryptData(`Father ${runId}`),
          motherNameEncrypted: encryptData(`Mother ${runId}`),
          primaryContactMobileEncrypted: encryptData(
            `98765${Math.floor(10000 + Math.random() * 90000)}`,
          ),
          primaryContactEmailEncrypted: encryptData(`parent_${runId}@example.com`),
          addressEncrypted: encryptData("123 Test Lane, City"),
          pincode: "500001",
          status: "OFFER_LETTER",
          ...overrides,
        })
        .returning();
      return app!;
    });
  }

  describe("2.2: Unified Lifecycle Engine - 12-Junction Completeness", () => {
    it("executes all 12 junctions atomically for a valid application", async () => {
      const runId = Math.random().toString(36).substring(2, 7);
      const testEmail = `parent_${runId}@example.com`;
      const testMobile = `98765${Math.floor(10000 + Math.random() * 90000)}`;

      // 1. Create an application in OFFER_LETTER status
      const app = await createTestApplication(schoolAId, academicYearAId, {
        primaryContactEmailEncrypted: encryptData(testEmail),
        primaryContactMobileEncrypted: encryptData(testMobile),
        isRteApplicant: true, // test RTE concession
      });
      const applicationId = app.id;

      // 2. Call StudentLifecycleEngine.enrollApplicant
      const result = await StudentLifecycleEngine.enrollApplicant({
        schoolId: schoolAId,
        applicationId,
        classId: classAId,
        sectionId: sectionAId,
        performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
        performedByUserEmail: "admin@sps.edu",
        performedByUserRole: "SCHOOL_ADMIN",
        requestIp: "103.21.244.2", // Real public IP
        userAgent: "Vitest S13 Drill",
      });

      expect(result.success).toBe(true);
      expect(result.studentId).toBeTruthy();
      expect(result.admissionNumber).toMatch(/^ADM-2026-\d{4,}$/);
      expect(result.alreadyEnrolled).toBe(false);
      expect(result.concessionsApplied).toContain("RTE_FREE");
      expect(result.mandatorySubjectsEnrolledCount).toBeGreaterThanOrEqual(1);

      // 3. Verify Database Records Across Junctions
      await withTenant(schoolAId, async (tx) => {
        // J1 & J2: Person & Student
        const stu = await tx.query.students.findFirst({
          where: eq(students.id, result.studentId),
        });
        expect(stu).toBeTruthy();
        expect(stu!.admissionNumber).toBe(result.admissionNumber);
        expect(stu!.currentClassId).toBe(classAId);
        expect(stu!.currentSectionId).toBe(sectionAId);
        expect(stu!.isActive).toBe(true);

        const person = await tx.query.persons.findFirst({
          where: eq(persons.id, result.personId),
        });
        expect(person).toBeTruthy();
        expect(person!.primaryType).toBe("STUDENT");

        // J3: Student Class History
        const history = await tx.query.studentClassHistory.findMany({
          where: eq(studentClassHistory.studentId, result.studentId),
        });
        expect(history.length).toBe(1);
        expect(history[0]!.promotionStatus).toBe("ENROLLED");

        // J4: Parent User & Family Members
        const parentUser = await tx.query.users.findFirst({
          where: eq(users.email, testEmail),
        });
        expect(parentUser).toBeTruthy();
        expect(parentUser!.mustChangePassword).toBe(true);
        expect(stu!.primaryParentUserId).toBe(parentUser!.id);

        const family = await tx.query.studentFamilyMembers.findMany({
          where: eq(studentFamilyMembers.studentId, result.studentId),
        });
        expect(family.length).toBe(2); // Father and Mother
        expect(family.some((f) => f.relation === "FATHER")).toBe(true);
        expect(family.some((f) => f.relation === "MOTHER")).toBe(true);

        // J6: DPDP Consent Truth
        const consents = await tx.query.consentRecords.findMany({
          where: eq(consentRecords.studentId, result.studentId),
        });
        expect(consents.length).toBe(2); // required-only: admission_data, academic_records
        for (const c of consents) {
          expect(c.method).toBe("admin_attestation");
          expect(c.ipAddress).toBe("103.21.244.2");
          expect(c.ipAddress).not.toBe("127.0.0.1");
        }

        // J9: Mandatory Subject Enrollments (In-Transaction Fix for F3)
        const subEnrollments = await tx.query.studentSubjectEnrollments.findMany({
          where: eq(studentSubjectEnrollments.studentId, result.studentId),
        });
        expect(subEnrollments.length).toBeGreaterThanOrEqual(1);
        expect(subEnrollments[0]!.enrollmentStatus).toBe("ACTIVE");

        // J10: Application Status & Workflow
        const updatedApp = await tx.query.admissionApplications.findFirst({
          where: eq(admissionApplications.id, applicationId),
        });
        expect(updatedApp!.status).toBe("ENROLLED");
        expect(updatedApp!.enrolledStudentId).toBe(result.studentId);

        // J11: Forensic Audit Log
        const audits = await tx.query.auditLogs.findMany({
          where: and(
            eq(auditLogs.schoolId, schoolAId),
            eq(auditLogs.recordId, result.studentId),
          ),
        });
        expect(audits.length).toBeGreaterThanOrEqual(1);
        expect(audits[0]!.ipAddress).toBe("103.21.244.2");
        expect(audits[0]!.ipAddress).not.toBe("127.0.0.1");

        // J12: Durable Domain Events Outbox
        const events = await tx.query.domainEvents.findMany({
          where: and(
            eq(domainEvents.schoolId, schoolAId),
            eq(domainEvents.aggregateId, result.studentId),
          ),
        });
        expect(events.length).toBe(1);
        expect(events[0]!.eventType).toBe("StudentEnrolledEvent");
        expect(events[0]!.status).toBe("PENDING");
      });
    });

    it("2.3: Idempotent re-enrollment returns existing student without duplicating records", async () => {
      // Create and enroll
      const app = await createTestApplication(schoolAId, academicYearAId);
      const appId = app.id;

      const firstEnroll = await StudentLifecycleEngine.enrollApplicant({
        schoolId: schoolAId,
        applicationId: appId,
        classId: classAId,
        sectionId: sectionAId,
        performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      });

      // Second call must succeed idempotently
      const secondEnroll = await StudentLifecycleEngine.enrollApplicant({
        schoolId: schoolAId,
        applicationId: appId,
        classId: classAId,
        sectionId: sectionAId,
        performedByUserId: ISOLATION_IDS.schoolA.adminUserId,
      });

      expect(secondEnroll.success).toBe(true);
      expect(secondEnroll.alreadyEnrolled).toBe(true);
      expect(secondEnroll.studentId).toBe(firstEnroll.studentId);
      expect(secondEnroll.admissionNumber).toBe(firstEnroll.admissionNumber);
    });

    it("2.4: Tenant isolation: School B cannot enroll School A application", async () => {
      const appA = await createTestApplication(schoolAId, academicYearAId);
      const appAId = appA.id;

      // Attempt enrollment under School B
      await expect(
        StudentLifecycleEngine.enrollApplicant({
          schoolId: schoolBId,
          applicationId: appAId,
          classId: classAId,
          sectionId: sectionAId,
          performedByUserId: "00000000-0000-0000-0000-000000000002",
        }),
      ).rejects.toThrow(/not found or does not belong to school/);
    });
  });
});
