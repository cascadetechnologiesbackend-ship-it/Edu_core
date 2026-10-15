"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission } from "@/lib/examPermissions";
import { revalidatePath } from "next/cache";
import {
  getClassEnrollmentMatrix,
  assignStudentElectives,
  bulkAssignElectiveBySection,
  backfillMandatoryEnrollments,
  type ClassEnrollmentMatrixResult,
} from "@/lib/enrollmentEngine";

/**
 * Fetches the student elective enrollment matrix for a class.
 */
export async function getEnrollmentMatrixAction(
  classId: string,
): Promise<{ success: boolean; data?: ClassEnrollmentMatrixResult; error?: string }> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);

    const matrix = await getClassEnrollmentMatrix(school.id, classId);
    return { success: true, data: matrix };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load enrollment matrix";
    return { success: false, error: message };
  }
}

/**
 * Assigns or updates elective enrollments for an individual student.
 */
export async function assignStudentElectivesAction(
  studentId: string,
  assignments: { classSubjectId: string; isElectiveTaken: boolean }[],
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    requireExamPermission(ctx, "exam.enrollments.manage");

    const result = await assignStudentElectives(school.id, studentId, assignments, ctx);
    revalidatePath("/exams/setup/enrollments");
    revalidatePath("/exams/marks");
    return { success: true, updatedCount: result.updatedCount };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to assign student electives";
    return { success: false, error: message };
  }
}

/**
 * Bulk assigns an elective subject across an entire section of students.
 */
export async function bulkAssignSectionElectiveAction(
  sectionId: string,
  classSubjectId: string,
  studentIdsToEnroll: string[],
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    requireExamPermission(ctx, "exam.enrollments.manage");

    const result = await bulkAssignElectiveBySection(
      school.id,
      sectionId,
      classSubjectId,
      studentIdsToEnroll,
      ctx,
    );
    revalidatePath("/exams/setup/enrollments");
    revalidatePath("/exams/marks");
    return { success: true, updatedCount: result.updatedCount };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to bulk assign section electives";
    return { success: false, error: message };
  }
}

/**
 * Runs the idempotent backfill to ensure all active students have ACTIVE rows
 * for all mandatory (non-elective) class subjects.
 */
export async function runMandatoryBackfillAction(): Promise<{
  success: boolean;
  insertedCount?: number;
  error?: string;
}> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    requireExamPermission(ctx, "exam.enrollments.manage");

    const result = await backfillMandatoryEnrollments(school.id, ctx);
    revalidatePath("/exams/setup/enrollments");
    return { success: true, insertedCount: result.insertedCount };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to run mandatory backfill";
    return { success: false, error: message };
  }
}
