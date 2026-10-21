/**
 * S13 Canonical Student Lifecycle Engine
 *
 * Single authoritative pipeline for student admission-to-enrollment lifecycle transitions.
 * Guarantees transactional completeness across all 12 institutional junctions:
 * 1.  Idempotency & Tenant Scope Verification
 * 2.  State Machine Transition Guard (Illegal transitions like REJECTED -> ENROLLED rejected)
 * 3.  Active Class, Section & Academic Year Verification
 * 4.  Section Capacity Guard (warns and records capacity overflow)
 * 5.  Atomic Monotonic Admission Number Generation (Migration 0042)
 * 6.  Canonical Person Record Provisioning (Student)
 * 7.  Student Master Profile Creation
 * 8.  Initial Class History Record (promotionStatus: 'ENROLLED')
 * 9.  Parent User Account & Canonical Person Provisioning (Decoupled credentials)
 * 10. Student Family Member Records with Search Hashes
 * 11. Document Linkage / Duplication (admission_documents -> student_documents)
 * 12. Truthful DPDP Consent Attestation (method: 'admin_attestation', required-only purposes)
 * 13. Sibling Detection & Concession Assignment (RTE 100%, Sibling 10%, Staff Ward 50%)
 * 14. Fee Structure Auto-Assignment & Initial Invoice Generation
 * 15. Mandatory Subject Enrollments (In-Transaction; Immediate Exam & Marks Matrix Visibility)
 * 16. Application Status & Workflow Step Completion
 * 17. Forensic Audit Logging (Real client IP, never 127.0.0.1)
 * 18. Durable Domain Events Outbox Record (Migration 0042 domain_events)
 */

import { db } from "@/db";
import {
  persons,
  students,
  studentClassHistory,
  studentFamilyMembers,
  studentDocuments,
  admissionApplications,
  admissionDocuments,
  admissionWorkflowSteps,
  consentRecords,
  feeConcessions,
  classes,
  sections,
  academicYears,
  auditLogs,
  users,
  roles,
  userRoles,
  domainEvents,
  smsLogs,
  notices,
  usageEvents,
  passwordResetTokens,
} from "@schoolmitra/database";
import { eq, and, ne, sql, count } from "drizzle-orm";
import { assertValidAdmissionTransition } from "@schoolmitra/validators";
import { generateAdmissionNumber } from "./sequenceGenerator";
import { autoAssignFeeStructuresToStudent } from "./feeAssignmentEngine";
import { enrollStudentInMandatorySubjects } from "./enrollmentEngine";
import { invalidateDashboardCache } from "./dashboardCache";
import {
  encryptData,
  decryptData,
  computeSearchHash,
} from "./encryption";
import { withTenant } from "./tenant";
import { generateRoleTempPassword } from "./tempPassword";
import { provisionOrLinkParent } from "./parentLinkage";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export class InactiveAcademicYearError extends Error {
  public readonly code = "INACTIVE_ACADEMIC_YEAR";
  constructor(
    public readonly academicYearId: string,
    public readonly schoolId: string,
  ) {
    super(
      `Application references academic year '${academicYearId}' which is not currently active for school '${schoolId}'`,
    );
    this.name = "InactiveAcademicYearError";
  }
}

export class SectionCapacityExceededError extends Error {
  public readonly code = "SECTION_CAPACITY_EXCEEDED";
  constructor(
    public readonly sectionId: string,
    public readonly capacity: number,
    public readonly currentCount: number,
  ) {
    super(
      `Target section '${sectionId}' is at capacity (${currentCount}/${capacity})`,
    );
    this.name = "SectionCapacityExceededError";
  }
}

export interface StudentEnrollmentInput {
  schoolId: string;
  applicationId: string;
  classId: string;
  sectionId: string;
  performedByUserId: string;
  performedByUserEmail?: string | undefined;
  performedByUserRole?: string | undefined;
  requestIp?: string | undefined;
  clientIp?: string | undefined;
  userAgent?: string | undefined;
  skipCapacityCheck?: boolean | undefined;
  blockOnCapacity?: boolean | undefined;
  forceSmsFailure?: boolean | undefined; // Testing hook for verifying resilient decoupled SMS failure
}

export interface StudentEnrollmentResult {
  success: true;
  studentId: string;
  admissionNumber: string;
  personId: string;
  parentUserId: string | null;
  alreadyEnrolled?: boolean | undefined;
  concessionsApplied: string[];
  mandatorySubjectsEnrolledCount: number;
  capacityWarning?: boolean | undefined;
  parentCredentials?:
    | {
        email: string;
        claimToken: string;
        claimUrl: string;
        temporaryPassword?: string | undefined;
        mustChangePassword: true;
        mobile?: string | null | undefined;
      }
    | undefined;
  notificationDelivery?: {
    smsQueued: boolean;
    noticeCreated: boolean;
    telemetryLogged: boolean;
    cacheInvalidated: boolean;
    failureReason?: string | undefined;
  } | undefined;
}

export class StudentLifecycleEngine {
  /**
   * Executes the complete, authoritative, atomic enrollment pipeline.
   */
  public static async enrollApplicant(
    input: StudentEnrollmentInput,
  ): Promise<StudentEnrollmentResult> {
    const {
      schoolId,
      applicationId,
      classId,
      sectionId,
      performedByUserId,
      performedByUserEmail = "admin@schoolmitra.internal",
      performedByUserRole = "SCHOOL_ADMIN",
      requestIp,
      clientIp,
      userAgent = "SchoolMitra Lifecycle Engine",
    } = input;

    // Sanitize client IP: never allow fallback to 127.0.0.1 in audit/consent records
    const rawIp = requestIp || clientIp || "0.0.0.0";
    const cleanIp =
      !rawIp || rawIp === "127.0.0.1" || rawIp === "::1"
        ? "0.0.0.0"
        : rawIp;

    // ─── Layer 7: Pre-Transaction Sibling Detection ──────────────────────────
    // Pre-computed outside the transaction lock window using indexed search hashes.
    // Guarantees zero O(all families) decryption and zero search scans inside the tx.
    let precomputedSibling = {
      isDetected: false,
      siblingStudentId: null as string | null,
    };

    const preApp = await withTenant(schoolId, async (tenantDb) => {
      return await tenantDb.query.admissionApplications.findFirst({
        where: and(
          eq(admissionApplications.id, applicationId),
          eq(admissionApplications.schoolId, schoolId),
        ),
      });
    });

    if (preApp) {
      if (preApp.hasSiblingInSchool && preApp.siblingStudentId) {
        precomputedSibling = {
          isDetected: true,
          siblingStudentId: preApp.siblingStudentId,
        };
      } else {
        const rawMobile = preApp.primaryContactMobileEncrypted
          ? decryptData(preApp.primaryContactMobileEncrypted)
          : null;
        const rawEmail = preApp.primaryContactEmailEncrypted
          ? decryptData(preApp.primaryContactEmailEncrypted)
          : null;
        const mobileHash = rawMobile
          ? computeSearchHash(rawMobile.replace(/\D/g, "").slice(-10))
          : null;
        const emailHash = rawEmail
          ? computeSearchHash(rawEmail.trim().toLowerCase())
          : null;

        if (mobileHash || emailHash) {
          const matchingFamily = await withTenant(schoolId, async (tenantDb) => {
            return await tenantDb.query.studentFamilyMembers.findFirst({
              where: and(
                eq(studentFamilyMembers.schoolId, schoolId),
                mobileHash && emailHash
                  ? sql`(${studentFamilyMembers.mobileSearchHash} = ${mobileHash} OR ${studentFamilyMembers.emailSearchHash} = ${emailHash})`
                  : mobileHash
                    ? eq(studentFamilyMembers.mobileSearchHash, mobileHash)
                    : eq(studentFamilyMembers.emailSearchHash, emailHash!),
              ),
            });
          });

          if (matchingFamily) {
            precomputedSibling = {
              isDetected: true,
              siblingStudentId: matchingFamily.studentId,
            };
          }
        }
      }
    }

    const enrollmentTxResult = await withTenant(schoolId, async (tx) => {
      // 1. Fetch Application Record with Tenant Scope Guard
      const application = await tx.query.admissionApplications.findFirst({
        where: and(
          eq(admissionApplications.id, applicationId),
          eq(admissionApplications.schoolId, schoolId),
        ),
        with: {
          workflowSteps: true,
          documents: true,
        },
      });

      if (!application) {
        throw new Error(
          `Admission application '${applicationId}' not found or does not belong to school '${schoolId}'`,
        );
      }

      // Idempotency: Return existing student if already enrolled
      if (application.status === "ENROLLED" && application.enrolledStudentId) {
        const existing = await tx.query.students.findFirst({
          where: and(
            eq(students.id, application.enrolledStudentId),
            eq(students.schoolId, schoolId),
          ),
        });
        if (existing) {
          return {
            success: true,
            studentId: existing.id,
            admissionNumber: existing.admissionNumber,
            personId: "",
            parentUserId: existing.primaryParentUserId,
            alreadyEnrolled: true,
            concessionsApplied: [],
            mandatorySubjectsEnrolledCount: 0,
          };
        }
      }

      // 2. State Machine Validation Guard
      assertValidAdmissionTransition(application.status, "ENROLLED");

      // 3. Validate Target Class & Section
      const targetClass = await tx.query.classes.findFirst({
        where: and(
          eq(classes.id, classId),
          eq(classes.schoolId, schoolId),
          eq(classes.isActive, true),
        ),
      });
      if (!targetClass) {
        throw new Error(
          `Target class '${classId}' not found or inactive in school '${schoolId}'`,
        );
      }

      const targetSection = await tx.query.sections.findFirst({
        where: and(
          eq(sections.id, sectionId),
          eq(sections.classId, classId),
          eq(sections.schoolId, schoolId),
          eq(sections.isActive, true),
        ),
      });
      if (!targetSection) {
        throw new Error(
          `Target section '${sectionId}' not found or does not belong to class '${classId}'`,
        );
      }

      // 4. Validate Active Academic Year (L7 Typed Error)
      const activeYear = await tx.query.academicYears.findFirst({
        where: and(
          eq(academicYears.id, application.academicYearId),
          eq(academicYears.schoolId, schoolId),
          eq(academicYears.isActive, true),
        ),
      });
      if (!activeYear) {
        throw new InactiveAcademicYearError(application.academicYearId, schoolId);
      }

      // 5. Section Capacity Guard (Warn or block per Decision D4 / L7)
      let capacityWarning = false;
      if (!input.skipCapacityCheck && targetSection.capacity) {
        const [enrolledCountRow] = await tx
          .select({ count: count() })
          .from(students)
          .where(
            and(
              eq(students.schoolId, schoolId),
              eq(students.currentSectionId, sectionId),
              eq(students.isActive, true),
            ),
          );
        const currentCount = Number(enrolledCountRow?.count ?? 0);
        if (currentCount >= targetSection.capacity) {
          if (input.blockOnCapacity) {
            throw new SectionCapacityExceededError(
              sectionId,
              targetSection.capacity,
              currentCount,
            );
          }
          capacityWarning = true;
        }
      }

      // 6. Monotonic Admission Number Generation (Atomic DB sequence from L1)
      const year = new Date().getFullYear();
      const admissionNum = await generateAdmissionNumber(schoolId, { year }, tx);

      // 7. Parse Applicant Names & Hashes
      const applicantName =
        decryptData(application.applicantNameEncrypted) || "Unknown Student";
      const nameParts = applicantName.trim().split(/\s+/);
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
      const firstNameHash = computeSearchHash(firstName);
      const lastNameHash = computeSearchHash(lastName);

      const rawAadhaar = decryptData(application.aadhaarNumberEncrypted);
      const aadhaarLast4 = rawAadhaar ? rawAadhaar.slice(-4) : null;

      // 8. Provision Canonical Person Master Record
      const [person] = await tx
        .insert(persons)
        .values({
          schoolId,
          primaryType: "STUDENT",
          firstNameEncrypted: encryptData(firstName),
          lastNameEncrypted: encryptData(lastName),
          firstNameSearchHash: firstNameHash,
          lastNameSearchHash: lastNameHash,
          gender: application.gender,
          dateOfBirth: application.dateOfBirth,
          aadhaarLast4,
          createdBy: performedByUserId,
        })
        .returning({ id: persons.id });

      if (!person) {
        throw new Error("Failed to insert canonical person record for student");
      }

      // 9. Provision Student Profile Record
      const [newStudent] = await tx
        .insert(students)
        .values({
          schoolId,
          academicYearId: application.academicYearId,
          admissionNumber: admissionNum,
          firstNameEncrypted: encryptData(firstName),
          lastNameEncrypted: encryptData(lastName),
          firstNameSearchHash: firstNameHash,
          lastNameSearchHash: lastNameHash,
          dateOfBirth: application.dateOfBirth!,
          gender: application.gender,
          bloodGroup: application.bloodGroup,
          category: application.category,
          currentClassId: classId,
          currentSectionId: sectionId,
          admissionDate: new Date(),
          admissionApplicationId: application.id,
          rteApplicant: application.isRteApplicant,
          optInTransport: application.optInTransport,
          optInHostel: application.optInHostel,
          isActive: true,
        })
        .returning({ id: students.id });

      if (!newStudent) {
        throw new Error("Failed to insert student profile record");
      }

      // 10. Provision Initial Student Class History Record
      await tx.insert(studentClassHistory).values({
        studentId: newStudent.id,
        schoolId,
        academicYearId: application.academicYearId,
        classId,
        sectionId,
        promotionStatus: "ENROLLED",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 11. Provision Parent User Account & Family Members
      const fatherName = decryptData(application.fatherNameEncrypted);
      const motherName = decryptData(application.motherNameEncrypted);
      const guardianName = decryptData(application.guardianNameEncrypted);
      const primaryMobile = decryptData(application.primaryContactMobileEncrypted);
      const primaryEmail = decryptData(application.primaryContactEmailEncrypted);

      let parentUserId: string | null = null;
      let parentCredentials: StudentEnrollmentResult["parentCredentials"] | undefined;

      const guardianNameResolved =
        fatherName || motherName || guardianName || "Parent Guardian";

      const linkResult = await provisionOrLinkParent({
        schoolId,
        studentId: newStudent.id,
        primaryEmail,
        primaryMobile,
        guardianName: guardianNameResolved,
        performedByUserId,
        tx,
      });

      parentUserId = linkResult.parentUserId;
      parentCredentials = linkResult.parentCredentials;

      // Family Member Records (with search hashes for fast sibling lookups)
      const primaryMobileHash = primaryMobile
        ? computeSearchHash(primaryMobile.replace(/\D/g, "").slice(-10))
        : null;
      const primaryEmailHash = primaryEmail
        ? computeSearchHash(primaryEmail.trim().toLowerCase())
        : null;

      if (fatherName) {
        await tx.insert(studentFamilyMembers).values({
          studentId: newStudent.id,
          schoolId,
          userId: parentUserId,
          relation: "FATHER",
          nameEncrypted: encryptData(fatherName),
          mobileEncrypted: primaryMobile ? encryptData(primaryMobile) : null,
          emailEncrypted: primaryEmail ? encryptData(primaryEmail) : null,
          mobileSearchHash: primaryMobileHash,
          emailSearchHash: primaryEmailHash,
          isPrimaryContact: true,
          isEmergencyContact: true,
          hasConsentAuthority: true,
        });
      }

      if (motherName) {
        await tx.insert(studentFamilyMembers).values({
          studentId: newStudent.id,
          schoolId,
          userId: !fatherName ? parentUserId : null,
          relation: "MOTHER",
          nameEncrypted: encryptData(motherName),
          mobileEncrypted: primaryMobile ? encryptData(primaryMobile) : null,
          emailEncrypted: primaryEmail ? encryptData(primaryEmail) : null,
          mobileSearchHash: primaryMobileHash,
          emailSearchHash: primaryEmailHash,
          isPrimaryContact: !fatherName,
          isEmergencyContact: true,
          hasConsentAuthority: true,
        });
      }

      if (guardianName) {
        await tx.insert(studentFamilyMembers).values({
          studentId: newStudent.id,
          schoolId,
          userId: !fatherName && !motherName ? parentUserId : null,
          relation: "GUARDIAN",
          nameEncrypted: encryptData(guardianName),
          mobileEncrypted: primaryMobile ? encryptData(primaryMobile) : null,
          emailEncrypted: primaryEmail ? encryptData(primaryEmail) : null,
          mobileSearchHash: primaryMobileHash,
          emailSearchHash: primaryEmailHash,
          isPrimaryContact: !fatherName && !motherName,
          isEmergencyContact: true,
          hasConsentAuthority: true,
        });
      }

      // 12. Document Linkage (L7: Batched Insertion)
      const appDocs = await tx.query.admissionDocuments.findMany({
        where: eq(admissionDocuments.applicationId, application.id),
      });
      if (appDocs.length > 0) {
        await tx.insert(studentDocuments).values(
          appDocs.map((doc) => ({
            studentId: newStudent.id,
            schoolId,
            documentType: doc.documentType,
            s3Key: doc.s3Key,
            originalFileName: doc.originalFileName,
            mimeType: doc.mimeType,
            fileSizeBytes: 0,
            uploadedById: performedByUserId,
            isVerified: doc.isVerified,
            verifiedById: doc.verifiedById,
            verifiedAt: doc.verifiedAt,
          })),
        );
      }

      // 13. DPDP Truthful Consent Attestation (L4 foundation)
      // Pre-grant only statutory required purposes; defer optional purposes
      const requiredPurposes = ["admission_data", "academic_records"];
      for (const purposeId of requiredPurposes) {
        await tx.insert(consentRecords).values({
          schoolId,
          studentId: newStudent.id,
          parentUserId: performedByUserId,
          purposeId,
          granted: true,
          method: "admin_attestation",
          privacyNoticeVersion: "1.0",
          ipAddress: cleanIp,
          userAgent,
        });
      }

      // 14. Sibling Concessions (L7: Records outcome from pre-computed hash scan)
      const isSiblingDetected = precomputedSibling.isDetected;
      const detectedSiblingId = precomputedSibling.siblingStudentId;

      if (isSiblingDetected && !application.hasSiblingInSchool) {
        await tx
          .update(admissionApplications)
          .set({
            hasSiblingInSchool: true,
            siblingStudentId: detectedSiblingId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(admissionApplications.id, application.id),
              eq(admissionApplications.schoolId, schoolId),
            ),
          );
      }

      const concessionsApplied: string[] = [];

      if (application.isRteApplicant) {
        await tx.insert(feeConcessions).values({
          schoolId,
          academicYearId: application.academicYearId,
          studentId: newStudent.id,
          concessionType: "RTE_FREE",
          concessionName: "RTE 25% Statutory Free Quota",
          appliesTo: "ALL",
          discountPercentage: "100.00",
          approvedById: performedByUserId,
        });
        concessionsApplied.push("RTE_FREE");
      }

      if (isSiblingDetected) {
        await tx.insert(feeConcessions).values({
          schoolId,
          academicYearId: application.academicYearId,
          studentId: newStudent.id,
          concessionType: "SIBLING",
          concessionName: "Sibling Concession (10%)",
          appliesTo: "ALL",
          discountPercentage: "10.00",
          approvedById: performedByUserId,
        });
        concessionsApplied.push("SIBLING");
      }

      if (application.isStaffWard) {
        await tx.insert(feeConcessions).values({
          schoolId,
          academicYearId: application.academicYearId,
          studentId: newStudent.id,
          concessionType: "STAFF_WARD",
          concessionName: "Staff Ward Concession",
          appliesTo: "ALL",
          discountPercentage: "50.00",
          approvedById: performedByUserId,
        });
        concessionsApplied.push("STAFF_WARD");
      }

      // 15. Auto-Assign Fee Structures & Generate Initial Invoices
      await autoAssignFeeStructuresToStudent(newStudent.id, tx);

      // 16. Mandatory Subject Enrollments (In-Transaction; Immediate Exam Matrix Visibility)
      const { insertedCount: mandatoryCount } =
        await enrollStudentInMandatorySubjects(schoolId, newStudent.id, tx);

      // 17. Update Admission Application Status & Workflow
      const nextStepNumber = (application.workflowSteps?.length || 0) + 1;
      await tx
        .update(admissionApplications)
        .set({
          status: "ENROLLED",
          enrolledStudentId: newStudent.id,
          enrolledAt: new Date(),
          currentWorkflowStep: nextStepNumber,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(admissionApplications.id, applicationId),
            eq(admissionApplications.schoolId, schoolId),
          ),
        );

      await tx.insert(admissionWorkflowSteps).values({
        applicationId: application.id,
        schoolId,
        stepNumber: nextStepNumber,
        stepName: "ENROLLED",
        status: "COMPLETED",
        completedAt: new Date(),
        completedById: performedByUserId,
        notes: `Enrolled into ${targetClass.displayName} - ${targetSection.name}. Student ID: ${newStudent.id}`,
      });

      // 18. Audit Log (Truthful forensic context)
      await tx.insert(auditLogs).values({
        schoolId,
        userId: performedByUserId,
        userEmail: performedByUserEmail,
        userRole: performedByUserRole,
        action: "WRITE",
        tableName: "students",
        recordId: newStudent.id,
        purposeId: "student_enrollment",
        ipAddress: cleanIp,
        userAgent,
        metadata: {
          admissionNumber: admissionNum,
          classId,
          sectionId,
          applicationId: application.id,
          personId: person.id,
          mandatorySubjectsEnrolledCount: mandatoryCount,
          concessionsApplied,
          capacityWarning,
        },
      });

      // 19. Durable Domain Event Outbox (Migration 0042 domain_events)
      await tx.insert(domainEvents).values({
        schoolId,
        aggregateId: newStudent.id,
        eventType: "StudentEnrolledEvent",
        payload: {
          studentId: newStudent.id,
          personId: person.id,
          admissionNumber: admissionNum,
          classId,
          sectionId,
          academicYearId: application.academicYearId,
          parentUserId,
          mandatorySubjectsCount: mandatoryCount,
        },
        status: "PENDING",
      });

      return {
        success: true as const,
        studentId: newStudent.id,
        admissionNumber: admissionNum,
        personId: person.id,
        parentUserId,
        alreadyEnrolled: false,
        concessionsApplied,
        mandatorySubjectsEnrolledCount: mandatoryCount,
        capacityWarning,
        parentCredentials,
        classDisplayName: targetClass.displayName,
        sectionName: targetSection.name,
      };
    });

    if (enrollmentTxResult.alreadyEnrolled) {
      return {
        success: true,
        studentId: enrollmentTxResult.studentId,
        admissionNumber: enrollmentTxResult.admissionNumber,
        personId: enrollmentTxResult.personId,
        parentUserId: enrollmentTxResult.parentUserId,
        alreadyEnrolled: true,
        concessionsApplied: enrollmentTxResult.concessionsApplied,
        mandatorySubjectsEnrolledCount: enrollmentTxResult.mandatorySubjectsEnrolledCount,
        capacityWarning: enrollmentTxResult.capacityWarning,
        parentCredentials: enrollmentTxResult.parentCredentials,
      };
    }

    // Post-commit delivery decoupled from database transaction
    const delivery = await StudentLifecycleEngine.deliverPostCommitNotifications({
      schoolId,
      studentId: enrollmentTxResult.studentId,
      admissionNumber: enrollmentTxResult.admissionNumber,
      classDisplayName: (enrollmentTxResult as any).classDisplayName,
      sectionName: (enrollmentTxResult as any).sectionName,
      parentUserId: enrollmentTxResult.parentUserId,
      parentCredentials: enrollmentTxResult.parentCredentials,
      performedByUserId,
      performedByUserRole,
      forceSmsFailure: input.forceSmsFailure,
    });

    return {
      success: true,
      studentId: enrollmentTxResult.studentId,
      admissionNumber: enrollmentTxResult.admissionNumber,
      personId: enrollmentTxResult.personId,
      parentUserId: enrollmentTxResult.parentUserId,
      alreadyEnrolled: false,
      concessionsApplied: enrollmentTxResult.concessionsApplied,
      mandatorySubjectsEnrolledCount: enrollmentTxResult.mandatorySubjectsEnrolledCount,
      capacityWarning: enrollmentTxResult.capacityWarning,
      parentCredentials: enrollmentTxResult.parentCredentials,
      notificationDelivery: delivery,
    };
  }

  /**
   * Post-commit notification and credential delivery.
   * Decoupled from the database enrollment transaction:
   * 1. Enqueues SMS log to sms_logs without plaintext credentials.
   * 2. Writes in-app parent welcome notice to notices table.
   * 3. Logs first-party telemetry event in usage_events.
   * 4. Invalidates the school's dashboard summary cache keys.
   * Any downstream delivery or carrier failure NEVER rolls back the committed enrollment.
   */
  public static async deliverPostCommitNotifications(params: {
    schoolId: string;
    studentId: string;
    admissionNumber: string;
    classDisplayName: string;
    sectionName: string;
    parentUserId: string | null;
    parentCredentials?: StudentEnrollmentResult["parentCredentials"];
    performedByUserId: string;
    performedByUserRole: string;
    forceSmsFailure?: boolean | undefined;
  }): Promise<{
    smsQueued: boolean;
    noticeCreated: boolean;
    telemetryLogged: boolean;
    cacheInvalidated: boolean;
    failureReason?: string | undefined;
  }> {
    const {
      schoolId,
      studentId,
      admissionNumber,
      classDisplayName,
      sectionName,
      parentUserId,
      parentCredentials,
      performedByUserId,
      performedByUserRole,
      forceSmsFailure,
    } = params;

    let smsQueued = false;
    let noticeCreated = false;
    let telemetryLogged = false;
    let cacheInvalidated = false;
    let failureReason: string | undefined;

    // 1. Decoupled SMS Enqueue (never contains plaintext password)
    if (parentUserId && parentCredentials?.mobile) {
      try {
        if (forceSmsFailure) {
          throw new Error("Simulated SMS Gateway Outage (504 Gateway Timeout)");
        }
        await withTenant(schoolId, async (tenantDb) => {
          await tenantDb.insert(smsLogs).values({
            schoolId,
            recipientUserId: parentUserId,
            templateId: "PARENT_WELCOME_CLAIM",
            messageType: "NOTICE",
            status: "QUEUED",
          });
        });
        smsQueued = true;
      } catch (smsErr: any) {
        console.warn("[StudentLifecycleEngine] Failed to enqueue SMS:", smsErr?.message);
        failureReason = smsErr?.message || "SMS enqueue failed";
        try {
          await withTenant(schoolId, async (tenantDb) => {
            await tenantDb.insert(smsLogs).values({
              schoolId,
              recipientUserId: parentUserId,
              templateId: "PARENT_WELCOME_CLAIM",
              messageType: "NOTICE",
              status: "FAILED",
              failureReason: smsErr?.message || "Failed to enqueue SMS",
            });
          });
        } catch (logErr) {
          console.error("[StudentLifecycleEngine] Failed to record FAILED row in sms_logs:", logErr);
        }
      }
    }

    // 2. Parent Welcome In-App Notice
    try {
      await withTenant(schoolId, async (tenantDb) => {
        await tenantDb.insert(notices).values({
          schoolId,
          title: `Welcome to SchoolMitra! Student ${admissionNumber} Enrolled`,
          content: `<p>Your child has been successfully enrolled into ${classDisplayName} - ${sectionName}. You can view the fee schedule, syllabus, and academic updates in your portal.</p>`,
          audienceType: "PARENTS",
          audienceFilter: {
            targetParentUserId: parentUserId,
            studentId,
          },
          isPublished: true,
          publishedAt: new Date(),
          createdById: performedByUserId,
        });
      });
      noticeCreated = true;
    } catch (noticeErr: any) {
      console.error("[StudentLifecycleEngine] Failed to create welcome notice:", noticeErr);
    }

    // 3. Telemetry Usage Event (S10 First-Party Telemetry)
    try {
      await withTenant(schoolId, async (tenantDb) => {
        await tenantDb.insert(usageEvents).values({
          schoolId,
          screen: "/admissions",
          elementId: "btn_enroll_applicant",
          elementLabel: "Enroll Applicant",
          action: "submit",
          role: performedByUserRole,
          userId: performedByUserId,
          createdAt: new Date(),
        });
      });
      telemetryLogged = true;
    } catch (telemErr: any) {
      console.error("[StudentLifecycleEngine] Failed to log telemetry:", telemErr);
    }

    // 4. Invalidate Dashboard Cache
    try {
      await invalidateDashboardCache(schoolId);
      cacheInvalidated = true;
    } catch (cacheErr: any) {
      console.error("[StudentLifecycleEngine] Failed to invalidate dashboard cache:", cacheErr);
    }

    return {
      smsQueued,
      noticeCreated,
      telemetryLogged,
      cacheInvalidated,
      failureReason,
    };
  }
}
