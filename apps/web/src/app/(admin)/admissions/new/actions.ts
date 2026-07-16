"use server";

import { db } from "@/db";
import { admissionApplications, admissionWorkflowSteps } from "@/db/schema";
import { createAdmissionApplicationSchema } from "@schoolmitra/validators";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

function encryptData(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export async function verifyConsentOtp(_mobile: string, otp: string) {
  // Mock OTP as requested: 123456
  if (otp !== "123456") {
    return { success: false, message: "Invalid OTP" };
  }
  return { success: true };
}

export async function submitAdmissionApplication(formData: any, _consentData: any) {
  try {
    const defaultSchool = await db.query.schools.findFirst();
    const defaultYear = await db.query.academicYears.findFirst();

    if (!defaultSchool || !defaultYear) {
      return { success: false, message: "System configuration error. Missing school or academic year." };
    }

    const payload = {
      ...formData,
      schoolId: defaultSchool.id,
      academicYearId: defaultYear.id,
      dateOfBirth: formData.dateOfBirth,
    };

    const parsed = createAdmissionApplicationSchema.parse(payload);

    const admissionNum = `APP/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;

    const [application] = await db.insert(admissionApplications).values({
      schoolId: parsed.schoolId,
      academicYearId: parsed.academicYearId,
      applicationNumber: admissionNum,
      applicantNameEncrypted: encryptData(parsed.applicantName),
      dateOfBirth: new Date(parsed.dateOfBirth),
      gender: parsed.gender,
      category: parsed.category,
      gradeAppliedFor: parsed.gradeAppliedFor,
      previousSchool: parsed.previousSchool ?? null,
      fatherNameEncrypted: encryptData(parsed.fatherName),
      motherNameEncrypted: encryptData(parsed.motherName),
      guardianNameEncrypted: parsed.guardianName ? encryptData(parsed.guardianName) : null,
      primaryContactMobileEncrypted: encryptData(parsed.primaryContactMobile),
      primaryContactEmailEncrypted: encryptData(parsed.primaryContactEmail),
      addressEncrypted: encryptData(parsed.address),
      pincode: parsed.pincode,
      isRteApplicant: parsed.isRteApplicant,
      hasSiblingInSchool: parsed.hasSiblingInSchool,
      siblingStudentId: parsed.siblingStudentId ?? null,
    }).returning({ id: admissionApplications.id, applicationNumber: admissionApplications.applicationNumber });

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
    }

    // In a real flow, we would store `consentRecords` here, attached to the parent user.
    // However, parent user isn't created yet until enrollment. So we skip storing it until then, 
    // or store it temporarily in a generic consent table linked to the application ID.
    
    return { success: true, applicationNumber: application?.applicationNumber };
  } catch (error: any) {
    console.error("Admission error:", error);
    return { success: false, message: error?.message || "Failed to submit application" };
  }
}
