"use server";

import { db } from "@/db";
import {
  reportCards,
  students,
  resultSnapshots,
  reportCardSetups,
  exams,
} from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission } from "@/lib/examPermissions";
import { calculateRanks } from "@/lib/gradeEngine";
import { decryptData } from "@/lib/encryption";

const ANALYTICS_ADMIN_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
] as const;

/**
 * Generates and commits merit ranking for students in an examination class.
 * Enforces strict fail-closed RBAC: exam.analytics.view + exam.result.publish.
 * Scoped strictly to the session tenant schoolId.
 */
export async function generateMeritList(examId: string, classId: string) {
  try {
    const ctx = await requireAuth(ANALYTICS_ADMIN_ROLES);
    requireExamPermission(ctx, "exam.analytics.view");
    requireExamPermission(ctx, "exam.result.publish");
    const school = await requireSchool(ctx);

    const classStudents = await db.query.students.findMany({
      where: and(
        eq(students.currentClassId, classId),
        eq(students.schoolId, school.id),
      ),
    });

    if (classStudents.length === 0) {
      return { success: false, message: "No active students found in this class." };
    }

    const studentIds = classStudents.map((s) => s.id);

    const cards = await db.query.reportCards.findMany({
      where: and(
        eq(reportCards.examId, examId),
        eq(reportCards.schoolId, school.id),
        inArray(reportCards.studentId, studentIds),
      ),
    });

    if (cards.length === 0) {
      return {
        success: false,
        message: "No report cards generated yet for this examination.",
      };
    }

    const rankingInput = cards.map((c) => {
      const gData = c.gradeData as Record<string, unknown> | null;
      return {
        studentId: c.studentId,
        totalMarks: Number(gData?.["totalMarks"] || 0),
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

    revalidatePath("/exams/analytics");
    revalidatePath("/exams/report-cards");
    revalidatePath("/exams/results");

    return {
      success: true,
      message: `Successfully calculated ranks for ${ranked.length} candidates.`,
      rankedCount: ranked.length,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message };
  }
}

/**
 * Generates an aggregated rank sheet for cohort analysis.
 * Scoped strictly to the session tenant schoolId.
 */
export async function generateRankSheet(examId: string, classId: string) {
  try {
    const ctx = await requireAuth(ANALYTICS_ADMIN_ROLES);
    requireExamPermission(ctx, "exam.analytics.view");
    const school = await requireSchool(ctx);

    const exam = await db.query.exams.findFirst({
      where: and(eq(exams.id, examId), eq(exams.schoolId, school.id)),
    });
    if (!exam) {
      return { success: false, message: "Exam not found or outside tenant scope." };
    }

    const rows = await db.query.reportCards.findMany({
      where: and(
        eq(reportCards.examId, examId),
        eq(reportCards.schoolId, school.id),
      ),
      orderBy: (t, { asc }) => [asc(t.rank)],
    });

    const studentIds = rows.map((r) => r.studentId).filter(Boolean);
    const studentsList =
      studentIds.length > 0
        ? await db.query.students.findMany({
            where: inArray(students.id, studentIds),
          })
        : [];
    const studentMap = new Map(studentsList.map((s) => [s.id, s]));

    return {
      success: true,
      data: rows.map((r) => {
        const st = studentMap.get(r.studentId);
        let studentName = "Candidate";
        if (st) {
          try {
            const first = decryptData(st.firstNameEncrypted);
            const last = st.lastNameEncrypted ? decryptData(st.lastNameEncrypted) : "";
            studentName = `${first} ${last}`.trim();
          } catch {
            studentName = "Candidate";
          }
        }

        return {
          id: r.id,
          studentId: r.studentId,
          studentName,
          admissionNumber: st?.admissionNumber ?? "—",
          rank: r.rank,
          overallGrade: r.overallGrade,
          gradeData: r.gradeData,
        };
      }),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message };
  }
}

/**
 * Exports summary statistics for a cohort report card setup.
 * Scoped strictly to the session tenant schoolId.
 */
export async function exportCohortAnalytics(setupId: string, classId?: string) {
  try {
    const ctx = await requireAuth(ANALYTICS_ADMIN_ROLES);
    requireExamPermission(ctx, "exam.analytics.view");
    const school = await requireSchool(ctx);

    const setup = await db.query.reportCardSetups.findFirst({
      where: and(
        eq(reportCardSetups.id, setupId),
        eq(reportCardSetups.schoolId, school.id),
      ),
    });
    if (!setup) {
      return { success: false, message: "Report card setup not found." };
    }

    const whereConditions = [
      eq(resultSnapshots.setupId, setupId),
      eq(resultSnapshots.schoolId, school.id),
      eq(resultSnapshots.isCurrent, true),
    ];

    const snapshots = await db.query.resultSnapshots.findMany({
      where: and(...whereConditions),
    });

    const parsedSnapshots = snapshots
      .map((s) => {
        const payload = s.payload as {
          student?: { classId?: string };
          summary?: { percentage?: number; resultStatus?: string };
        } | null;
        return {
          id: s.id,
          studentId: s.studentId,
          classId: payload?.student?.classId,
          percentage: payload?.summary?.percentage ?? 0,
          isPassed: payload?.summary?.resultStatus === "PASSED",
        };
      })
      .filter((s) => !classId || s.classId === classId);

    const totalEvaluated = parsedSnapshots.length;
    const passedCount = parsedSnapshots.filter((s) => s.isPassed).length;
    const passPercentage =
      totalEvaluated > 0
        ? Math.round((passedCount / totalEvaluated) * 1000) / 10
        : 0;

    return {
      success: true,
      setupName: setup.name,
      totalEvaluated,
      passedCount,
      passPercentage,
      snapshotsCount: parsedSnapshots.length,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message };
  }
}
