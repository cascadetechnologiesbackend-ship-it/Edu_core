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
  requireExamPermission(ctx.role, "exam.marks.lock");
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
  requireExamPermission(ctx.role, "exam.marks.unlock");
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
  try {
    const ctx = await requireAuth(ADMIN_LOCK_ROLES);
    requireExamPermission(ctx.role, "exam.result.publish");
    const school = await requireSchool(ctx);

    const classStudents = await db.query.students.findMany({
      where: and(
        eq(students.currentClassId, classId),
        eq(students.schoolId, school.id),
      ),
    });

    if (classStudents.length === 0) {
      return { success: false, message: "No students in this class" };
    }

    const studentIds = classStudents.map((s) => s.id);

    const cards = await db.query.reportCards.findMany({
      where: and(
        eq(reportCards.examId, examId),
        inArray(reportCards.studentId, studentIds),
      ),
    });

    if (cards.length === 0) {
      return {
        success: false,
        message: "No report cards generated yet for this class",
      };
    }

    const rankingInput = cards.map((c) => {
      const gData = c.gradeData as Record<string, any>;
      return {
        studentId: c.studentId,
        totalMarks: gData?.["totalMarks"] || 0,
        isPassed: gData?.["isPassed"] !== false,
      };
    });

    const ranked = calculateRanks(rankingInput);

    for (const item of ranked) {
      const card = cards.find((c) => c.studentId === item.studentId);
      if (card) {
        await db
          .update(reportCards)
          .set({ rank: item.rank, updatedAt: new Date() })
          .where(
            and(
              eq(reportCards.id, card.id),
              eq(reportCards.schoolId, school.id),
            ),
          );
      }
    }

    revalidatePath("/exams/results");
    return {
      success: true,
      message: `Successfully ranked ${ranked.length} students`,
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
