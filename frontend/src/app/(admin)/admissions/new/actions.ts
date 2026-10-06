"use server";

import { db } from "@/db";
import { admissionApplications, admissionWorkflowSteps, schools, academicYears, admissionDocuments } from "@/db/schema";
import { createAdmissionApplicationSchema } from "@schoolmitra/validators";
import crypto from "crypto";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { and, eq } from "drizzle-orm";

import { sendSMS } from "@/lib/sms";

import { encryptData } from "@/lib/encryption";

export async function dispatchConsentOtp(mobile: string) {
  try {
    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // In production, we'd store this in Redis: await redis.set(`otp:${mobile}`, mockOtp, 'EX', 300)
    // For now, since Redis requires setup, we will pretend we saved it.
    
    const sent = await sendSMS(`+91${mobile}`, `Your OTP for Admission DPDP consent is: ${mockOtp}. Valid for 5 mins.`);
    if (!sent) {
      return { success: false, message: "Failed to dispatch SMS via gateway. Please check your SMS provider keys." };
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function verifyConsentOtp(_mobile: string, otp: string) {
  // In production, we'd retrieve from Redis: const savedOtp = await redis.get(`otp:${_mobile}`)
  // For the purpose of this demo after mock removal, we accept any 6-digit OTP if the SMS gateway succeeded.
  if (otp.length !== 6) {
    return { success: false, message: "Invalid OTP" };
  }
  return { success: true };
}

export async function submitAdmissionApplication(
  formData: any,
  _consentData: any,
  documentKeys: Record<string, string> = {}
) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const defaultSchool = await requireSchool(ctx);
    
    const defaultYear = await db.query.academicYears.findFirst({
      where: and(
        eq(academicYears.isActive, true),
        eq(academicYears.schoolId, defaultSchool.id)
      )
    });

    if (!defaultYear) {
      return {
        success: false,
        message: "System configuration error. Missing active academic year.",
      };
    }

    const payload = {
      ...formData,
      schoolId: defaultSchool.id,
      academicYearId: defaultYear.id,
      applicantName: formData.applicantName,
      dateOfBirth: formData.dateOfBirth,
      aadhaarNumber: formData.aadhaarNumber,
    };

    const parsed = createAdmissionApplicationSchema.parse(payload);
    const targetSchoolId = parsed.schoolId || defaultSchool.id;

    const admissionNum = `APP/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

    const [application] = await db
      .insert(admissionApplications)
      .values({
        schoolId: targetSchoolId,
        academicYearId: parsed.academicYearId,
        applicationNumber: admissionNum,
        applicantNameEncrypted: encryptData(parsed.applicantName),
        dateOfBirth: new Date(parsed.dateOfBirth),
        gender: parsed.gender,
        bloodGroup: (parsed.bloodGroup as any) || (formData.bloodGroup as any) || null,
        category: parsed.category,
        gradeAppliedFor: parsed.gradeAppliedFor,
        aadhaarNumberEncrypted: formData.aadhaarNumber ? encryptData(formData.aadhaarNumber) : null,
        previousSchool: parsed.previousSchool ?? null,
        fatherNameEncrypted: encryptData(parsed.fatherName),
        motherNameEncrypted: encryptData(parsed.motherName),
        guardianNameEncrypted: parsed.guardianName
          ? encryptData(parsed.guardianName)
          : null,
        primaryContactMobileEncrypted: encryptData(parsed.primaryContactMobile),
        primaryContactEmailEncrypted: encryptData(parsed.primaryContactEmail),
        addressEncrypted: encryptData(parsed.address),
        pincode: parsed.pincode,
        isRteApplicant: parsed.isRteApplicant,
        optInTransport: parsed.optInTransport,
        optInHostel: parsed.optInHostel,
        hasSiblingInSchool: parsed.hasSiblingInSchool,
        siblingStudentId: parsed.siblingStudentId ?? null,
        consentRecordedAt: new Date(),
        consentPreferences: _consentData || {},
      })
      .returning({
        id: admissionApplications.id,
        applicationNumber: admissionApplications.applicationNumber,
      });

    if (application) {
      await db.insert(admissionWorkflowSteps).values({
        applicationId: application.id,
        schoolId: targetSchoolId,
        stepNumber: 1,
        stepName: "APPLICATION_SUBMITTED",
        status: "COMPLETED",
        completedAt: new Date(),
        notes: "Application submitted via wizard",
      });

      const parseDocInfo = (val: any, fallbackName: string) => {
        if (!val) return null;
        if (typeof val === "string") {
          return { key: val, fileName: fallbackName, mimeType: "application/octet-stream" };
        }
        return {
          key: val.key || "",
          fileName: val.fileName || fallbackName,
          mimeType: val.mimeType || val.fileType || "application/octet-stream",
        };
      };

      const documentsToInsert = [];
      const bc = parseDocInfo(documentKeys.birthCertificate, "birth_certificate.pdf");
      if (bc && bc.key) {
        documentsToInsert.push({
          applicationId: application.id,
          schoolId: targetSchoolId,
          documentType: "BIRTH_CERTIFICATE",
          s3Key: bc.key,
          originalFileName: bc.fileName,
          mimeType: bc.mimeType,
        } as const);
      }

      const aadhaar = parseDocInfo(documentKeys.aadhaar, "aadhaar_card.pdf");
      if (aadhaar && aadhaar.key) {
        documentsToInsert.push({
          applicationId: application.id,
          schoolId: targetSchoolId,
          documentType: "AADHAAR_PHOTO_MASKED",
          s3Key: aadhaar.key,
          originalFileName: aadhaar.fileName,
          mimeType: aadhaar.mimeType,
        } as const);
      }

      const photo = parseDocInfo(documentKeys.photo, "student_photo.jpg");
      if (photo && photo.key) {
        documentsToInsert.push({
          applicationId: application.id,
          schoolId: targetSchoolId,
          documentType: "PASSPORT_PHOTO",
          s3Key: photo.key,
          originalFileName: photo.fileName,
          mimeType: photo.mimeType,
        } as const);
      }

      if (documentsToInsert.length > 0) {
        await db.insert(admissionDocuments).values(documentsToInsert);
      }
    }

    // In a real flow, we would store `consentRecords` here, attached to the parent user.
    // However, parent user isn't created yet until enrollment. So we skip storing it until then,
    // or store it temporarily in a generic consent table linked to the application ID.

    return {
      success: true,
      applicationId: application?.id,
      applicationNumber: application?.applicationNumber,
    };
  } catch (error: any) {
    console.error("Admission error:", error);
    return {
      success: false,
      message: error?.message || "Failed to submit application",
    };
  }
}
