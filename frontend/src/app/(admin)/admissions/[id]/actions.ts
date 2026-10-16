"use server";

import { db } from "@/db";
import {
  admissionApplications,
  admissionWorkflowSteps,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { StudentLifecycleEngine } from "@schoolmitra/backend/lib/studentLifecycleEngine";
import { validateAdmissionTransition } from "@schoolmitra/validators";
import { getClientRequestContext } from "@/lib/requestContext";

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
 * Thin server-action wrapper delegating to StudentLifecycleEngine.
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
  const clientContext = getClientRequestContext();

  const result = await StudentLifecycleEngine.enrollApplicant({
    schoolId: school.id,
    applicationId,
    classId: options.classId,
    sectionId: options.sectionId,
    performedByUserId: ctx.userId,
    performedByUserEmail: ctx.email,
    performedByUserRole: ctx.role,
    requestIp: clientContext.ipAddress,
    userAgent: clientContext.userAgent,
  });

  safeRevalidate(`/admissions`);
  safeRevalidate(`/admissions/${applicationId}`);
  safeRevalidate(`/students`);
  safeRevalidate(`/students/${result.studentId}`);

  return {
    success: true as const,
    studentId: result.studentId,
    admissionNumber: result.admissionNumber,
    alreadyEnrolled: result.alreadyEnrolled,
    capacityWarning: result.capacityWarning,
  };
}

/**
 * Updates application status through the admissions funnel.
 * Enforces server-side transition legality via the Admissions State Machine.
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

    // Validate transition via canonical Admissions State Machine
    const transitionCheck = validateAdmissionTransition(
      application.status,
      newStatus,
    );
    if (!transitionCheck.valid) {
      return {
        success: false,
        message: transitionCheck.error.message,
      };
    }

    // Insert Workflow Step
    const nextStepNumber = (application.workflowSteps?.length || 0) + 1;
    await db.insert(admissionWorkflowSteps).values({
      applicationId: application.id,
      schoolId: school.id,
      stepNumber: nextStepNumber,
      stepName: transitionCheck.targetStatus,
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: ctx.userId,
      notes: `Status changed to ${transitionCheck.targetStatus}`,
    });

    // Update Application Status
    await db
      .update(admissionApplications)
      .set({
        status: transitionCheck.targetStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(admissionApplications.id, applicationId),
          eq(admissionApplications.schoolId, school.id),
        ),
      );

    safeRevalidate(`/admissions/${applicationId}`);
    safeRevalidate(`/admissions`);
    return { success: true as const };
  } catch (error: any) {
    console.error("Failed to update status:", error);
    return { success: false, message: error?.message || "Operation failed" };
  }
}
