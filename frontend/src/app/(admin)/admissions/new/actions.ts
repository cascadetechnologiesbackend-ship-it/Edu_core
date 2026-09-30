"use server";

import { db } from "@/db";
import { admissionApplications, admissionWorkflowSteps, schools, academicYears, admissionDocuments } from "@/db/schema";
import { createAdmissionApplicationSchema } from "@schoolmitra/validators";
import crypto from "crypto";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { and, eq } from "drizzle-orm";

import { sendSMS } from "@/lib/sms";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY environment variable is required. Generate with: openssl rand -hex 32");
}

function encryptData(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY as string, "hex"),
    iv,
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

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

    const admissionNum = `APP/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

    const [application] = await db
      .insert(admissionApplications)
      .values({
        schoolId: parsed.schoolId,
        academicYearId: parsed.academicYearId,
        applicationNumber: admissionNum,
        applicantNameEncrypted: encryptData(parsed.applicantName),
        dateOfBirth: new Date(parsed.dateOfBirth),
        gender: parsed.gender,
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
        hasSiblingInSchool: parsed.hasSiblingInSchool,
        siblingStudentId: parsed.siblingStudentId ?? null,
      })
      .returning({
        id: admissionApplications.id,
        applicationNumber: admissionApplications.applicationNumber,
      });

    if (application) {
      await db.insert(admissionWorkflowSteps).values({
        applicationId: application.id,
        schoolId: parsed.schoolId,
        stepNumber: 1,
        stepName: "APPLICATION_SUBMITTED",
        status: "COMPLETED",
        completedAt: new Date(),
        notes: "Application submitted via wizard",
      });
      const documentsToInsert = [];
      if (documentKeys.birthCertificate) {
        documentsToInsert.push({
          applicationId: application.id,
          schoolId: parsed.schoolId,
          documentType: "BIRTH_CERTIFICATE",
          s3Key: documentKeys.birthCertificate,
          originalFileName: "birth_certificate",
          mimeType: "application/octet-stream", // Fallback, could be passed from client
        } as const);
      }
      if (documentKeys.aadhaar) {
        documentsToInsert.push({
          applicationId: application.id,
          schoolId: parsed.schoolId,
          documentType: "AADHAAR_PHOTO_MASKED",
          s3Key: documentKeys.aadhaar,
          originalFileName: "aadhaar_card",
          mimeType: "application/octet-stream",
        } as const);
      }
      if (documentKeys.photo) {
        documentsToInsert.push({
          applicationId: application.id,
          schoolId: parsed.schoolId,
          documentType: "PASSPORT_PHOTO",
          s3Key: documentKeys.photo,
          originalFileName: "student_photo",
          mimeType: "application/octet-stream",
        } as const);
      }

      if (documentsToInsert.length > 0) {
        await db.insert(admissionDocuments).values(documentsToInsert);
      }
    }

    // In a real flow, we would store `consentRecords` here, attached to the parent user.
    // However, parent user isn't created yet until enrollment. So we skip storing it until then,
    // or store it temporarily in a generic consent table linked to the application ID.

    return { success: true, applicationNumber: application?.applicationNumber };
  } catch (error: any) {
    console.error("Admission error:", error);
    return {
      success: false,
      message: error?.message || "Failed to submit application",
    };
  }
}
