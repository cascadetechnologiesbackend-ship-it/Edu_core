import { db } from "@/db";
import {
  persons,
  students,
  studentClassHistory,
  studentFamilyMembers,
  admissionApplications,
  consentRecords,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { DomainEventPublisher } from "@schoolmitra/domain-events";
import crypto from "crypto";

export interface ApproveAndEnrollInput {
  applicationId: string;
  schoolId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  performedByUserId?: string;
}

export class AdmissionsDomainService {
  /**
   * Executes the full Admission Approval & Enrolment Workflow
   */
  public static async approveAndEnroll(input: ApproveAndEnrollInput) {
    const { applicationId, schoolId, academicYearId, classId, sectionId } = input;

    return await db.transaction(async (tx) => {
      // 1. Fetch Application Record
      const app = await tx.query.admissionApplications.findFirst({
        where: eq(admissionApplications.id, applicationId),
      });

      if (!app) {
        throw new Error("Admission application not found");
      }

      // Idempotency: return existing if already enrolled
      if (app.status === "ENROLLED" && app.enrolledStudentId) {
        const existing = await tx.query.students.findFirst({
          where: eq(students.id, app.enrolledStudentId),
        });
        if (existing) {
          return { student: existing, alreadyEnrolled: true };
        }
      }

      // 2. Provision Canonical Person Core Record
      const [person] = await tx
        .insert(persons)
        .values({
          schoolId,
          primaryType: "STUDENT",
          firstNameEncrypted: app.applicantNameEncrypted,
          lastNameEncrypted: app.applicantNameEncrypted,
          gender: app.gender,
          dateOfBirth: app.dateOfBirth,
          aadhaarLast4: app.aadhaarNumberEncrypted
            ? app.aadhaarNumberEncrypted.slice(-4)
            : null,
          ...(input.performedByUserId
            ? { createdBy: input.performedByUserId }
            : {}),
        })
        .returning();

      if (!person) {
        throw new Error("Failed to insert person record");
      }

      // 3. Create Student Profile Record
      const admissionNumber = `ADM-${Date.now().toString().slice(-6)}`;
      const [student] = await tx
        .insert(students)
        .values({
          schoolId,
          academicYearId,
          admissionNumber,
          firstNameEncrypted: app.applicantNameEncrypted,
          lastNameEncrypted: app.applicantNameEncrypted,
          dateOfBirth: app.dateOfBirth!,
          gender: app.gender as any,
          category: app.category as any,
          currentClassId: classId,
          currentSectionId: sectionId,
          admissionDate: new Date(),
          admissionApplicationId: app.id,
          isActive: true,
        })
        .returning();

      if (!student) {
        throw new Error("Failed to insert student record");
      }

      // 4. Create Initial Student Class History Record
      await tx.insert(studentClassHistory).values({
        studentId: student.id,
        schoolId,
        academicYearId,
        classId,
        sectionId,
        promotionStatus: "ENROLLED",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 5. Create Family Member Records
      if (app.fatherNameEncrypted) {
        await tx.insert(studentFamilyMembers).values({
          studentId: student.id,
          schoolId,
          relation: "FATHER",
          nameEncrypted: app.fatherNameEncrypted,
          mobileEncrypted: app.primaryContactMobileEncrypted,
          emailEncrypted: app.primaryContactEmailEncrypted,
          isPrimaryContact: true,
          isEmergencyContact: true,
          hasConsentAuthority: true,
        });
      }
      if (app.motherNameEncrypted) {
        await tx.insert(studentFamilyMembers).values({
          studentId: student.id,
          schoolId,
          relation: "MOTHER",
          nameEncrypted: app.motherNameEncrypted,
          mobileEncrypted: app.primaryContactMobileEncrypted,
          emailEncrypted: app.primaryContactEmailEncrypted,
          isPrimaryContact: !app.fatherNameEncrypted,
          isEmergencyContact: true,
          hasConsentAuthority: true,
        });
      }

      // 6. DPDP Consent Record
      await tx.insert(consentRecords).values({
        schoolId,
        studentId: student.id,
        parentUserId: input.performedByUserId || "00000000-0000-0000-0000-000000000000",
        purposeId: "academic_records",
        granted: true,
        method: "web_form",
        privacyNoticeVersion: "1.0",
      });

      // 7. Transition Application Workflow Status to ENROLLED
      await tx
        .update(admissionApplications)
        .set({
          status: "ENROLLED",
          enrolledStudentId: student.id,
          enrolledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(admissionApplications.id, applicationId));

      // 8. Emit Asynchronous Domain Event for Downstream Modules
      try {
        await DomainEventPublisher.publish({
          eventId: crypto.randomUUID(),
          eventType: "StudentEnrolledEvent",
          aggregateId: student.id,
          tenantId: schoolId,
          occurredOn: new Date(),
          payload: {
            studentId: student.id,
            personId: person.id,
            admissionNumber,
            classId,
            sectionId,
            academicYearId,
          },
        });
      } catch (err) {
        console.warn("Domain event publish warning:", err);
      }

      return { student, person };
    });
  }
}
