"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission } from "@/lib/examPermissions";
import { verifyExamOwnership } from "@/lib/examIsolation";
import {
  generateMarkDistributions,
  type GenerateDistributionsResult,
} from "@/lib/distributionAutomation";
import { z } from "zod";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const;

const DistributionInputSchema = z.object({
  examId: z.string().uuid("Invalid exam ID"),
  classIds: z.array(z.string().uuid()).optional(),
  previewOnly: z.boolean().optional(),
});

/**
 * Generates or previews mark distributions for an exam across classes & subjects.
 * Guarded by exam.schedule.manage permission and strict tenant verification.
 */
export async function generateDistributionsAction(input: {
  examId: string;
  classIds?: string[] | undefined;
  previewOnly?: boolean | undefined;
}): Promise<GenerateDistributionsResult> {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.schedule.manage");
  const school = await requireSchool(ctx);

  const parsed = DistributionInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      previewOnly: Boolean(input.previewOnly),
      totalEligible: 0,
      createdCount: 0,
      preservedCount: 0,
      protectedCount: 0,
      proposals: [],
      message: "Invalid input parameters",
    };
  }

  // Tenant ownership verification
  const examVerification = await verifyExamOwnership(
    school.id,
    parsed.data.examId,
    ctx,
    "generateDistributionsAction",
  );
  if (!examVerification.success) {
    return {
      success: false,
      previewOnly: Boolean(input.previewOnly),
      totalEligible: 0,
      createdCount: 0,
      preservedCount: 0,
      protectedCount: 0,
      proposals: [],
      message: examVerification.message || "Unauthorized access to exam.",
    };
  }

  const result = await generateMarkDistributions({
    schoolId: school.id,
    examId: parsed.data.examId,
    classIds: parsed.data.classIds,
    previewOnly: parsed.data.previewOnly,
    actorCtx: ctx,
  });

  if (!parsed.data.previewOnly && result.success) {
    revalidatePath("/exams/manage");
    revalidatePath("/exams/schedule");
    revalidatePath("/exams/marks");
  }

  return result;
}

/**
 * Preview proposed mark distributions without executing DB writes.
 */
export async function previewDistributionsAction(input: {
  examId: string;
  classIds?: string[] | undefined;
}): Promise<GenerateDistributionsResult> {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.schedule.manage");
  return generateDistributionsAction({
    ...input,
    previewOnly: true,
  });
}
