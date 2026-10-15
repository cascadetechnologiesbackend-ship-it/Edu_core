"use server";

import { db } from "@/db";
import { exams, reportCards, students } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission } from "@/lib/examPermissions";
import { calculateRanks } from "@/lib/gradeEngine";

const ADMIN_LOCK_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const;

export async function lockExam(examId: string) {
  const ctx = await requireAuth(ADMIN_LOCK_ROLES);
  requireExamPermission(ctx, "exam.marks.lock");
  const school = await requireSchool(ctx);

  const exam = await db.query.exams.findFirst({
    where: and(eq(exams.id, examId), eq(exams.schoolId, school.id)),
  });
  if (!exam) throw new Error("Exam not found");

  await db
    .update(exams)
    .set({
      isLocked: true,
      lockedById: ctx.userId,
      lockedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(exams.id, examId), eq(exams.schoolId, school.id)));

  revalidatePath("/exams/dashboard");
  revalidatePath("/exams/manage");
  revalidatePath("/exams");
}

export async function unlockExam(examId: string) {
  const ctx = await requireAuth(ADMIN_LOCK_ROLES);
  requireExamPermission(ctx, "exam.marks.unlock");
  const school = await requireSchool(ctx);

  await db
    .update(exams)
    .set({
      isLocked: false,
      lockedById: null,
      lockedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(exams.id, examId), eq(exams.schoolId, school.id)));

  revalidatePath("/exams/dashboard");
  revalidatePath("/exams/manage");
  revalidatePath("/exams");
}

export async function generateMeritList(examId: string, classId: string) {
  const { generateMeritList: genMerit } = await import("./actions/analyticsActions");
  return genMerit(examId, classId);
}
