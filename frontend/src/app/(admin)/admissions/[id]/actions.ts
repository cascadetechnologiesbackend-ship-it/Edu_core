"use server";

import { db } from "@/db";
import {
  admissionApplications,
  admissionWorkflowSteps,
  admissionDocuments,
  students,
  studentFamilyMembers,
  studentClassHistory,
  studentDocuments,
  persons,
  consentRecords,
  feeConcessions,
  classes,
  sections,
  auditLogs,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { autoAssignFeeStructuresToStudent } from "@/lib/feeAssignmentEngine";
import {
  encryptData,
  decryptData,
  computeSearchHash,
  ENCRYPTION_KEY,
} from "@/lib/encryption";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {}
}

export interface EnrollApplicantOptions {
  classId: string;
  sectionId: string;
}

/**
 * Authoritative, atomic enrollment action.
 * Transforms an approved application into an active student within an existing class & section.
 * Safe and idempotent: returns existing student if already enrolled.
 */
export async function enrollApplicant(
  applicationId: string,
  options: EnrollApplicantOptions,
) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  const application = await db.query.admissionApplications.findFirst({
    where: and(
      eq(admissionApplications.id, applicationId),
      eq(admissionApplications.schoolId, school.id),
    ),
    with: {
      workflowSteps: true,
      documents: true,
    },
  });

  if (!application) {
    throw new Error("Application not found or does not belong to school");
  }

  // Idempotency: Return existing student if already enrolled
  if (application.status === "ENROLLED" && application.enrolledStudentId) {
    const existing = await db.query.students.findFirst({
      where: and(
        eq(students.id, application.enrolledStudentId),
        eq(students.schoolId, school.id),
      ),
    });
    if (existing) {
      return {
        success: true as const,
        studentId: existing.id,
        alreadyEnrolled: true,
      };
    }
  }

  // Validate target class and section belong to this school
  const targetClass = await db.query.classes.findFirst({
    where: and(
      eq(classes.id, options.classId),
      eq(classes.schoolId, school.id),
      eq(classes.isActive, true),
    ),
  });
  if (!targetClass) {
    throw new Error("Target class not found or inactive");
  }

  const targetSection = await db.query.sections.findFirst({
    where: and(
      eq(sections.id, options.sectionId),
      eq(sections.classId, options.classId),
      eq(sections.schoolId, school.id),
      eq(sections.isActive, true),
    ),
  });
  if (!targetSection) {
    throw new Error("Target section not found or does not belong to class");
  }

  // Generate institutional admission number
  const admissionNum = `ADM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Parse applicant names
  const applicantName =
    decryptData(application.applicantNameEncrypted) || "Unknown Student";
  const nameParts = applicantName.split(" ");
  const firstName = nameParts[0] || "Unknown";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  const firstNameHash = computeSearchHash(firstName);
  const lastNameHash = computeSearchHash(lastName);

  const rawAadhaar = decryptData(application.aadhaarNumberEncrypted);
  const aadhaarLast4 = rawAadhaar ? rawAadhaar.slice(-4) : null;

  return await db.transaction(async (tx) => {
    // 1. Provision canonical Person Master record
    const [person] = await tx
      .insert(persons)
      .values({
        schoolId: school.id,
        primaryType: "STUDENT",
        firstNameEncrypted: encryptData(firstName),
        lastNameEncrypted: encryptData(lastName),
        firstNameSearchHash: firstNameHash,
        lastNameSearchHash: lastNameHash,
        gender: application.gender,
        dateOfBirth: application.dateOfBirth,
        aadhaarLast4,
        createdBy: ctx.userId,
      })
      .returning({ id: persons.id });

    // 2. Provision Student Profile record
    const [newStudent] = await tx
      .insert(students)
      .values({
        schoolId: school.id,
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
        currentClassId: options.classId,
        currentSectionId: options.sectionId,
        admissionDate: new Date(),
        admissionApplicationId: application.id,
        rteApplicant: application.isRteApplicant,
        optInTransport: application.optInTransport,
        optInHostel: application.optInHostel,
        isActive: true,
      })
      .returning({ id: students.id });

    if (!newStudent) {
      throw new Error("Failed to insert student record");
    }

    // 3. Provision initial student_class_history record
    await tx.insert(studentClassHistory).values({
      studentId: newStudent.id,
      schoolId: school.id,
      academicYearId: application.academicYearId,
      classId: options.classId,
      sectionId: options.sectionId,
      promotionStatus: "ENROLLED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 4. Provision family members
    const fatherName = decryptData(application.fatherNameEncrypted);
    const motherName = decryptData(application.motherNameEncrypted);
    const guardianName = decryptData(application.guardianNameEncrypted);
    const primaryMobile = decryptData(
      application.primaryContactMobileEncrypted,
    );
    const primaryEmail = decryptData(
      application.primaryContactEmailEncrypted,
    );

    if (fatherName) {
      await tx.insert(studentFamilyMembers).values({
        studentId: newStudent.id,
        schoolId: school.id,
        relation: "FATHER",
        nameEncrypted: encryptData(fatherName),
        mobileEncrypted: primaryMobile ? encryptData(primaryMobile) : null,
        emailEncrypted: primaryEmail ? encryptData(primaryEmail) : null,
        isPrimaryContact: true,
        isEmergencyContact: true,
        hasConsentAuthority: true,
      });
    }

    if (motherName) {
      await tx.insert(studentFamilyMembers).values({
        studentId: newStudent.id,
        schoolId: school.id,
        relation: "MOTHER",
        nameEncrypted: encryptData(motherName),
        mobileEncrypted: primaryMobile ? encryptData(primaryMobile) : null,
        emailEncrypted: primaryEmail ? encryptData(primaryEmail) : null,
        isPrimaryContact: !fatherName,
        isEmergencyContact: true,
        hasConsentAuthority: true,
      });
    }

    if (guardianName) {
      await tx.insert(studentFamilyMembers).values({
        studentId: newStudent.id,
        schoolId: school.id,
        relation: "GUARDIAN",
        nameEncrypted: encryptData(guardianName),
        mobileEncrypted: primaryMobile ? encryptData(primaryMobile) : null,
        emailEncrypted: primaryEmail ? encryptData(primaryEmail) : null,
        isPrimaryContact: !fatherName && !motherName,
        isEmergencyContact: true,
        hasConsentAuthority: true,
      });
    }

    // 5. Link / copy admission documents to student_documents
    const appDocs = await tx.query.admissionDocuments.findMany({
      where: eq(admissionDocuments.applicationId, application.id),
    });
    for (const doc of appDocs) {
      await tx.insert(studentDocuments).values({
        studentId: newStudent.id,
        schoolId: school.id,
        documentType: doc.documentType,
        s3Key: doc.s3Key,
        originalFileName: doc.originalFileName,
        mimeType: doc.mimeType,
        fileSizeBytes: "0",
        uploadedById: ctx.userId,
        isVerified: doc.isVerified,
        verifiedById: doc.verifiedById,
        verifiedAt: doc.verifiedAt,
      });
    }

    // 6. DPDP Consent records
    const consentPrefs = (application.consentPreferences as Record<string, boolean>) || {};
    const standardPurposes = [
      "admission_data",
      "academic_records",
      "attendance",
      "health_records",
      "communication",
      "transport",
    ];
    const grantedPurposes = new Set<string>(standardPurposes);
    for (const [purpose, granted] of Object.entries(consentPrefs)) {
      if (granted) {
        grantedPurposes.add(purpose);
      } else if (purpose !== "admission_data" && purpose !== "academic_records" && purpose !== "attendance") {
        grantedPurposes.delete(purpose);
      }
    }

    for (const purposeId of grantedPurposes) {
      await tx.insert(consentRecords).values({
        schoolId: school.id,
        studentId: newStudent.id,
        parentUserId: ctx.userId,
        purposeId,
        granted: true,
        method: "web_form",
        privacyNoticeVersion: "1.0",
        ipAddress: "127.0.0.1",
        userAgent: "SchoolMitra Admissions",
      });
    }

    // 7. Automatic Fee Concession assignment
    if (application.isRteApplicant) {
      await tx.insert(feeConcessions).values({
        schoolId: school.id,
        academicYearId: application.academicYearId,
        studentId: newStudent.id,
        concessionType: "RTE_FREE",
        concessionName: "RTE 25% Statutory Free Quota",
        appliesTo: "ALL",
        discountPercentage: "100.00",
        approvedById: ctx.userId,
      });
    }
    if (application.hasSiblingInSchool) {
      await tx.insert(feeConcessions).values({
        schoolId: school.id,
        academicYearId: application.academicYearId,
        studentId: newStudent.id,
        concessionType: "SIBLING",
        concessionName: "Sibling Concession",
        appliesTo: "ALL",
        discountPercentage: "10.00",
        approvedById: ctx.userId,
      });
    }
    if (application.isStaffWard) {
      await tx.insert(feeConcessions).values({
        schoolId: school.id,
        academicYearId: application.academicYearId,
        studentId: newStudent.id,
        concessionType: "STAFF_WARD",
        concessionName: "Staff Ward Concession",
        appliesTo: "ALL",
        discountPercentage: "50.00",
        approvedById: ctx.userId,
      });
    }

    // 7.5. Automatically assign class fee structures & generate initial invoices for enrolled student
    await autoAssignFeeStructuresToStudent(newStudent.id, tx);

    // 8. Update admission application
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
      .where(eq(admissionApplications.id, applicationId));

    // 9. Workflow step record
    await tx.insert(admissionWorkflowSteps).values({
      applicationId: application.id,
      schoolId: school.id,
      stepNumber: nextStepNumber,
      stepName: "ENROLLED",
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: ctx.userId,
      notes: `Enrolled into ${targetClass.displayName} - ${targetSection.name}. Student ID: ${newStudent.id}`,
    });

    // 10. Audit log
    await tx.insert(auditLogs).values({
      schoolId: school.id,
      userId: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      action: "WRITE",
      tableName: "students",
      recordId: newStudent.id,
      purposeId: "student_enrollment",
      ipAddress: "127.0.0.1",
      userAgent: "SchoolMitra SIS",
      metadata: {
        admissionNumber: admissionNum,
        classId: options.classId,
        sectionId: options.sectionId,
        applicationId: application.id,
        personId: person?.id,
      },
    });

    safeRevalidate(`/admissions`);
    safeRevalidate(`/admissions/${applicationId}`);
    safeRevalidate(`/students`);
    safeRevalidate(`/students/${newStudent.id}`);

    return {
      success: true as const,
      studentId: newStudent.id,
      admissionNumber: admissionNum,
    };
  });
}

/**
 * Updates application status through the admissions funnel.
 * If status is ENROLLED, options with classId and sectionId must be provided.
 */
export async function updateApplicationStatus(
  applicationId: string,
  newStatus: string,
  options?: { classId?: string; sectionId?: string },
) {
  try {
    const ctx = await requireAuth([
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
    ] as const);
    const school = await requireSchool(ctx);

    const application = await db.query.admissionApplications.findFirst({
      where: and(
        eq(admissionApplications.id, applicationId),
        eq(admissionApplications.schoolId, school.id),
      ),
      with: {
        workflowSteps: true,
      },
    });

    if (!application) {
      return { success: false, message: "Application not found" };
    }

    if (newStatus === "ENROLLED") {
      if (!options?.classId || !options?.sectionId) {
        return {
          success: false,
          message: "Class and Section selection is required for enrollment",
        };
      }
      return await enrollApplicant(applicationId, {
        classId: options.classId,
        sectionId: options.sectionId,
      });
    }

    if (application.status === newStatus) {
      return { success: false, message: "Status is already " + newStatus };
    }

    // Insert Workflow Step
    const nextStepNumber = (application.workflowSteps?.length || 0) + 1;
    await db.insert(admissionWorkflowSteps).values({
      applicationId: application.id,
      schoolId: school.id,
      stepNumber: nextStepNumber,
      stepName: newStatus,
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: ctx.userId,
      notes: `Status changed to ${newStatus}`,
    });

    // Update Application Status
    await db
      .update(admissionApplications)
      .set({ status: newStatus as any, updatedAt: new Date() })
      .where(eq(admissionApplications.id, applicationId));

    safeRevalidate(`/admissions/${applicationId}`);
    safeRevalidate(`/admissions`);
    return { success: true as const };
  } catch (error: any) {
    console.error("Failed to update status:", error);
    return { success: false, message: error?.message || "Operation failed" };
  }
}
