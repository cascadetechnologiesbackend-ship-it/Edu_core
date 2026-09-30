"use server";

import { db } from "@/db";
import {
  admissionApplications,
  admissionWorkflowSteps,
  students,
  studentFamilyMembers,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");

function encryptData(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv,
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decryptData(encryptedText: string | null) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(":");
    const ivStr = parts[0];
    const encryptedStr = parts[1];
    if (!ivStr || !encryptedStr) return encryptedText;

    const iv = Buffer.from(ivStr, "hex");
    const encrypted = Buffer.from(encryptedStr, "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY, "hex"),
      iv,
    );
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return encryptedText;
  }
}

export async function updateApplicationStatus(
  applicationId: string,
  newStatus: string,
) {
  try {
    const application = await db.query.admissionApplications.findFirst({
      where: eq(admissionApplications.id, applicationId),
      with: {
        workflowSteps: true,
      },
    });

    if (!application) {
      return { success: false, message: "Application not found" };
    }

    if (application.status === newStatus) {
      return { success: false, message: "Status is already " + newStatus };
    }

    // Insert Workflow Step
    const nextStepNumber = (application.workflowSteps?.length || 0) + 1;
    await db.insert(admissionWorkflowSteps).values({
      applicationId: application.id,
      schoolId: application.schoolId,
      stepNumber: nextStepNumber,
      stepName: newStatus,
      status: "COMPLETED",
      completedAt: new Date(),
      notes: `Status changed to ${newStatus}`,
    });

    // Update Application Status
    await db
      .update(admissionApplications)
      .set({ status: newStatus as any, updatedAt: new Date() })
      .where(eq(admissionApplications.id, applicationId));

    // If Enrolled, generate Student record
    if (newStatus === "ENROLLED") {
      const admissionNum = `${new Date().getFullYear()}/${application.gradeAppliedFor}/${Math.floor(1000 + Math.random() * 9000)}`;

      // Try parsing names
      const applicantName =
        decryptData(application.applicantNameEncrypted) || "Unknown Student";
      const nameParts = applicantName.split(" ");
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

      const [newStudent] = await db
        .insert(students)
        .values({
          schoolId: application.schoolId,
          academicYearId: application.academicYearId,
          admissionNumber: admissionNum,
          firstNameEncrypted: encryptData(firstName),
          lastNameEncrypted: encryptData(lastName),
          dateOfBirth: application.dateOfBirth!,
          gender: application.gender,
          category: application.category,
          admissionDate: new Date(),
          admissionApplicationId: application.id,
          rteApplicant: application.isRteApplicant,
          isActive: true,
        })
        .returning({ id: students.id });

      if (!newStudent) throw new Error("Failed to create student");

      // Create Family members
      const fatherName = decryptData(application.fatherNameEncrypted);
      const motherName = decryptData(application.motherNameEncrypted);
      const primaryMobile = decryptData(
        application.primaryContactMobileEncrypted,
      );

      if (fatherName) {
        await db.insert(studentFamilyMembers).values({
          studentId: newStudent.id,
          schoolId: application.schoolId,
          relation: "FATHER",
          nameEncrypted: encryptData(fatherName),
          mobileEncrypted: primaryMobile ? encryptData(primaryMobile) : null,
          isPrimaryContact: true,
          hasConsentAuthority: true,
        });
      }

      if (motherName) {
        await db.insert(studentFamilyMembers).values({
          studentId: newStudent.id,
          schoolId: application.schoolId,
          relation: "MOTHER",
          nameEncrypted: encryptData(motherName),
          isPrimaryContact: false,
          hasConsentAuthority: true,
        });
      }
    }

    revalidatePath(`/admissions/${applicationId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update status:", error);
    return { success: false, message: error.message };
  }
}
