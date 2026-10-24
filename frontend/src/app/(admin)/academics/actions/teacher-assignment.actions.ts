"use server";

import { db, withTenant } from "@/db";
import {
  classTeacherAssignments,
  sections,
  classes,
  users,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkAuth, getActiveAcademicYear } from "./auth-helper";
import { clearTeacherScopeCache } from "@/lib/teacherEventEngine/scopeResolver";
import { revalidatePath } from "next/cache";

export interface UpsertClassTeacherParams {
  sectionId: string;
  teacherId?: string | null | undefined;
  effectiveFrom?: string | undefined; // "YYYY-MM-DD"
  notes?: string | undefined;
  forceTransfer?: boolean | undefined;
}

export interface ClassTeacherConflictInfo {
  teacherId: string;
  existingSectionId: string;
  existingSectionName: string;
  existingClassName: string;
  message: string;
}

export interface UpsertClassTeacherResult {
  success: boolean;
  conflict?: ClassTeacherConflictInfo | undefined;
  assignmentId?: string | undefined;
  error?: string | undefined;
}

/**
 * Checks whether a teacher is currently assigned as active Class Teacher to another section
 * in the same academic year (Invariant: At most ONE homeroom per teacher per year).
 */
export async function checkClassTeacherAssignmentConflict(
  teacherId: string,
  sectionId: string,
): Promise<ClassTeacherConflictInfo | null> {
  const session = await checkAuth();
  const schoolId = session.user.schoolId;

  const sec = await db.query.sections.findFirst({
    where: and(eq(sections.id, sectionId), eq(sections.schoolId, schoolId)),
    with: { class: true },
  });

  if (!sec) return null;

  const academicYearId = sec.class?.academicYearId || (await getActiveAcademicYear(schoolId)).id;
  if (!academicYearId) return null;

  const existing = await db.query.classTeacherAssignments.findFirst({
    where: and(
      eq(classTeacherAssignments.schoolId, schoolId),
      eq(classTeacherAssignments.academicYearId, academicYearId),
      eq(classTeacherAssignments.teacherId, teacherId),
      eq(classTeacherAssignments.isActive, true),
    ),
    with: {
      section: {
        with: { class: true },
      },
    },
  });

  if (existing && existing.sectionId !== sectionId) {
    const className = existing.section?.class?.displayName || "Grade";
    const sectionName = existing.section?.name || "";
    return {
      teacherId,
      existingSectionId: existing.sectionId,
      existingSectionName: sectionName,
      existingClassName: className,
      message: `Teacher is already assigned as Class Teacher of ${className} Section ${sectionName} for this academic year.`,
    };
  }

  return null;
}

/**
 * Single source of truth for Class Teacher assignments (S16).
 * Enforces:
 * 1. At most one active Class Teacher per section per academic year.
 * 2. At most one active Section per teacher per academic year.
 * 3. Transactionally mirrors assignment into `sections.classTeacherId` for backward read compatibility.
 * 4. Invalidates teacher scope cache on write.
 */
export async function upsertClassTeacherAssignment(
  params: UpsertClassTeacherParams,
): Promise<UpsertClassTeacherResult> {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  const schoolId = session.user.schoolId;
  const effectiveFromDate = params.effectiveFrom || new Date().toISOString().split("T")[0]!;

  // 1. Fetch target section and its academic year
  const sec = await db.query.sections.findFirst({
    where: and(eq(sections.id, params.sectionId), eq(sections.schoolId, schoolId)),
    with: { class: true },
  });

  if (!sec) {
    return { success: false, error: "Section not found or access denied." };
  }

  const academicYearId = sec.class?.academicYearId || (await getActiveAcademicYear(schoolId)).id;
  if (!academicYearId) {
    return { success: false, error: "No active academic year found for section." };
  }

  // 2. Conflict check if assigning a teacher
  if (params.teacherId) {
    const conflict = await checkClassTeacherAssignmentConflict(params.teacherId, params.sectionId);
    if (conflict && !params.forceTransfer) {
      return {
        success: false,
        conflict,
        error: conflict.message,
      };
    }
  }

  // 3. Transactional update
  const result = await withTenant(schoolId, async (tx) => {
    // If transferring from another section, deactivate prior assignment and clear previous section's mirror
    if (params.teacherId && params.forceTransfer) {
      const prior = await tx.query.classTeacherAssignments.findFirst({
        where: and(
          eq(classTeacherAssignments.schoolId, schoolId),
          eq(classTeacherAssignments.academicYearId, academicYearId),
          eq(classTeacherAssignments.teacherId, params.teacherId),
          eq(classTeacherAssignments.isActive, true),
        ),
      });

      if (prior && prior.sectionId !== params.sectionId) {
        await tx
          .update(classTeacherAssignments)
          .set({
            isActive: false,
            effectiveTo: effectiveFromDate,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(classTeacherAssignments.id, prior.id),
              eq(classTeacherAssignments.schoolId, schoolId),
            ),
          );

        await tx
          .update(sections)
          .set({
            classTeacherId: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(sections.id, prior.sectionId),
              eq(sections.schoolId, schoolId),
            ),
          );
      }
    }

    // Current active assignment for THIS section
    const currentActive = await tx.query.classTeacherAssignments.findFirst({
      where: and(
        eq(classTeacherAssignments.schoolId, schoolId),
        eq(classTeacherAssignments.academicYearId, academicYearId),
        eq(classTeacherAssignments.sectionId, params.sectionId),
        eq(classTeacherAssignments.isActive, true),
      ),
    });

    if (currentActive) {
      if (!params.teacherId) {
        // Unassign section
        await tx
          .update(classTeacherAssignments)
          .set({
            isActive: false,
            effectiveTo: effectiveFromDate,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(classTeacherAssignments.id, currentActive.id),
              eq(classTeacherAssignments.schoolId, schoolId),
            ),
          );

        await tx
          .update(sections)
          .set({
            classTeacherId: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(sections.id, params.sectionId),
              eq(sections.schoolId, schoolId),
            ),
          );

        return { success: true };
      }

      if (
        currentActive.teacherId === params.teacherId &&
        currentActive.effectiveFrom === effectiveFromDate
      ) {
        // Same-day update: maintain row, update notes
        await tx
          .update(classTeacherAssignments)
          .set({
            notes: params.notes ?? currentActive.notes,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(classTeacherAssignments.id, currentActive.id),
              eq(classTeacherAssignments.schoolId, schoolId),
            ),
          );

        // Ensure mirror is aligned
        await tx
          .update(sections)
          .set({
            classTeacherId: params.teacherId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(sections.id, params.sectionId),
              eq(sections.schoolId, schoolId),
            ),
          );

        return { success: true, assignmentId: currentActive.id };
      }

      // Deactivate previous active row
      await tx
        .update(classTeacherAssignments)
        .set({
          isActive: false,
          effectiveTo: effectiveFromDate,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(classTeacherAssignments.id, currentActive.id),
            eq(classTeacherAssignments.schoolId, schoolId),
          ),
        );
    }

    // Insert new active row if teacherId provided
    if (params.teacherId) {
      const [newRow] = await tx
        .insert(classTeacherAssignments)
        .values({
          schoolId,
          academicYearId,
          sectionId: params.sectionId,
          teacherId: params.teacherId,
          isActive: true,
          effectiveFrom: effectiveFromDate,
          effectiveTo: null,
          notes: params.notes || null,
        })
        .returning({ id: classTeacherAssignments.id });

      // Mirror into sections.classTeacherId
      await tx
        .update(sections)
        .set({
          classTeacherId: params.teacherId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sections.id, params.sectionId),
            eq(sections.schoolId, schoolId),
          ),
        );

      return { success: true, assignmentId: newRow?.id };
    }

    return { success: true };
  });

  try {
    clearTeacherScopeCache();
    revalidatePath("/academics");
    revalidatePath("/academics/classrooms");
    if (sec.classId) {
      revalidatePath(`/academics/classes/${sec.classId}`);
    }
  } catch {}

  return result;
}
