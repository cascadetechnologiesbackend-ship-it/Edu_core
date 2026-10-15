"use server";

import { db } from "@/db";
import {
  examAdmitCardSettings,
  examAdmitCardHolds,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission } from "@/lib/examPermissions";

import {
  verifyExamOwnership,
  verifyStudentOwnership,
} from "@/lib/examIsolation";
import { notifyAdmitCardsReleased } from "@/lib/examNotifications";

const ADMIT_CARD_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "ACCOUNTANT",
] as const;

export async function saveAdmitCardSettings(input: {
  examId: string;
  downloadStartDate: string;
  downloadEndDate: string;
  feeLockMode: "OFF" | "SOFT" | "HARD" | "SOFT_WARNING" | "HARD_LOCK";
  feeThresholdAmount: number;
  instructions?: string;
  examCentre?: string;
  reportingTime?: string;
}) {
  const ctx = await requireAuth(ADMIT_CARD_ROLES);
  requireExamPermission(ctx.role, "exam.admit_card.manage");
  const school = await requireSchool(ctx);

  const examVerification = await verifyExamOwnership(school.id, input.examId, ctx, "saveAdmitCardSettings");
  if (!examVerification.success) {
    return { success: false, error: examVerification.error, message: examVerification.message };
  }

  const normalizedFeeLockMode: "OFF" | "SOFT" | "HARD" =
    input.feeLockMode === "SOFT_WARNING"
      ? "SOFT"
      : input.feeLockMode === "HARD_LOCK"
      ? "HARD"
      : input.feeLockMode;

  const existing = await db.query.examAdmitCardSettings.findFirst({
    where: and(
      eq(examAdmitCardSettings.schoolId, school.id),
      eq(examAdmitCardSettings.examId, input.examId),
    ),
  });

  const availableFrom = new Date(input.downloadStartDate);
  const availableUntil = new Date(input.downloadEndDate);

  if (existing) {
    await db
      .update(examAdmitCardSettings)
      .set({
        availableFrom,
        availableUntil,
        feeLockMode: normalizedFeeLockMode,
        feeLockThresholdAmount: input.feeThresholdAmount.toFixed(2),
        instructions: input.instructions ?? existing.instructions,
        examCentre: input.examCentre ?? existing.examCentre,
        reportingTime: input.reportingTime ?? existing.reportingTime,
        updatedAt: new Date(),
      })
      .where(eq(examAdmitCardSettings.id, existing.id));
  } else {
    await db.insert(examAdmitCardSettings).values({
      schoolId: school.id,
      examId: input.examId,
      availableFrom,
      availableUntil,
      feeLockMode: normalizedFeeLockMode,
      feeLockThresholdAmount: input.feeThresholdAmount.toFixed(2),
      instructions: input.instructions ?? null,
      examCentre: input.examCentre ?? null,
      reportingTime: input.reportingTime ?? null,
    });
  }

  // S11 Layer 3: Dispatch Admit Cards Released Notification
  try {
    await notifyAdmitCardsReleased({
      schoolId: school.id,
      examId: input.examId,
      triggeredById: ctx.userId,
    });
  } catch (notifErr) {
    console.error("[saveAdmitCardSettings] Notification dispatch error:", notifErr);
  }

  revalidatePath("/exams/admit-cards");
  revalidatePath("/portal/admit-cards");
  return { success: true };
}

export async function toggleAdmitCardHold(input: {
  examId: string;
  studentId: string;
  isHeld: boolean;
  holdReason?: string;
}) {
  const ctx = await requireAuth(ADMIT_CARD_ROLES);
  requireExamPermission(ctx.role, "exam.admit_card.manage");
  const school = await requireSchool(ctx);

  const examVerification = await verifyExamOwnership(school.id, input.examId, ctx, "toggleAdmitCardHold");
  if (!examVerification.success) {
    return { success: false, error: examVerification.error, message: examVerification.message };
  }

  const studentVerification = await verifyStudentOwnership(school.id, input.studentId, ctx, "toggleAdmitCardHold");
  if (!studentVerification.success) {
    return { success: false, error: studentVerification.error, message: studentVerification.message };
  }

  const existing = await db.query.examAdmitCardHolds.findFirst({
    where: and(
      eq(examAdmitCardHolds.schoolId, school.id),
      eq(examAdmitCardHolds.examId, input.examId),
      eq(examAdmitCardHolds.studentId, input.studentId),
    ),
  });

  if (input.isHeld) {
    if (existing) {
      await db
        .update(examAdmitCardHolds)
        .set({
          reason: input.holdReason ?? existing.reason,
          releasedById: null,
          releasedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(examAdmitCardHolds.id, existing.id));
    } else {
      await db.insert(examAdmitCardHolds).values({
        schoolId: school.id,
        examId: input.examId,
        studentId: input.studentId,
        reason: input.holdReason ?? "Withheld by administration",
        placedById: ctx.userId,
      });
    }
  } else {
    if (existing) {
      await db
        .delete(examAdmitCardHolds)
        .where(eq(examAdmitCardHolds.id, existing.id));
    }
  }

  revalidatePath("/exams/admit-cards");
  revalidatePath("/portal/admit-cards");
  return { success: true };
}

export async function releaseAdmitCardHold(input: {
  examId: string;
  studentId: string;
}) {
  const ctx = await requireAuth(ADMIT_CARD_ROLES);
  requireExamPermission(ctx.role, "exam.admit_card.manage");
  const school = await requireSchool(ctx);

  const examVerification = await verifyExamOwnership(school.id, input.examId, ctx, "releaseAdmitCardHold");
  if (!examVerification.success) {
    return { success: false, error: examVerification.error, message: examVerification.message };
  }

  const studentVerification = await verifyStudentOwnership(school.id, input.studentId, ctx, "releaseAdmitCardHold");
  if (!studentVerification.success) {
    return { success: false, error: studentVerification.error, message: studentVerification.message };
  }

  await db
    .delete(examAdmitCardHolds)
    .where(
      and(
        eq(examAdmitCardHolds.schoolId, school.id),
        eq(examAdmitCardHolds.examId, input.examId),
        eq(examAdmitCardHolds.studentId, input.studentId),
      ),
    );

  revalidatePath("/exams/admit-cards");
  revalidatePath("/portal/admit-cards");
  return { success: true };
}
