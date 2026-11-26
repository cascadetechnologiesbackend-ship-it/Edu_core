"use server";

import { withTenant } from "@/db";
import {
  classTeacherAssignments,
  sections,
  academicYears,
  auditLogs,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { getClientRequestContext } from "@/lib/requestContext";

export async function getClassTeacherAssignmentsAction(sectionId?: string) {
  const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] as const);
  const school = await requireSchool(ctx);

  return withTenant(school.id, async (tx) => {
    const conditions = [eq(classTeacherAssignments.schoolId, school.id)];
    if (sectionId) {
      conditions.push(eq(classTeacherAssignments.sectionId, sectionId));
    }

    return tx.query.classTeacherAssignments.findMany({
      where: and(...conditions),
      orderBy: [desc(classTeacherAssignments.isActive), desc(classTeacherAssignments.effectiveFrom)],
      with: {
        section: { with: { class: true } },
        teacher: { columns: { id: true, email: true } },
      },
    });
  });
}

export async function assignClassTeacherAction(params: {
  sectionId: string;
  teacherId: string | null;
  forceTransfer?: boolean;
  notes?: string;
}) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);
    const schoolId = school.id;

    const sec = await withTenant(schoolId, async (tx) =>
      tx.query.sections.findFirst({
        where: and(eq(sections.id, params.sectionId), eq(sections.schoolId, schoolId)),
        with: { class: true },
      }),
    );
    if (!sec) {
      return { success: false as const, error: "Section not found or access denied." };
    }

    const activeYearRow = await withTenant(schoolId, async (tx) =>
      tx.query.academicYears.findFirst({
        where: and(eq(academicYears.isActive, true), eq(academicYears.schoolId, schoolId)),
      }),
    );
    const academicYearId = sec.class?.academicYearId || activeYearRow?.id;
    if (!academicYearId) {
      return { success: false as const, error: "No active academic year found." };
    }

    // Primary-teacher conflict prevention
    if (params.teacherId && !params.forceTransfer) {
      const teacherConflict = await withTenant(schoolId, async (tx) =>
        tx.query.classTeacherAssignments.findFirst({
          where: and(
            eq(classTeacherAssignments.schoolId, schoolId),
            eq(classTeacherAssignments.academicYearId, academicYearId),
            eq(classTeacherAssignments.teacherId, params.teacherId!),
            eq(classTeacherAssignments.isActive, true),
          ),
          with: { section: { with: { class: true } } },
        }),
      );
      if (teacherConflict && teacherConflict.sectionId !== params.sectionId) {
        return {
          success: false as const,
          conflict: {
            type: "teacher_already_assigned" as const,
            message: `Teacher is already class teacher of ${teacherConflict.section?.class?.displayName || ""} ${teacherConflict.section?.name || ""}. Confirm transfer?`,
          },
        };
      }

      const sectionConflict = await withTenant(schoolId, async (tx) =>
        tx.query.classTeacherAssignments.findFirst({
          where: and(
            eq(classTeacherAssignments.schoolId, schoolId),
            eq(classTeacherAssignments.academicYearId, academicYearId),
            eq(classTeacherAssignments.sectionId, params.sectionId),
            eq(classTeacherAssignments.isActive, true),
          ),
        }),
      );
      if (sectionConflict && sectionConflict.teacherId !== params.teacherId) {
        return {
          success: false as const,
          conflict: {
            type: "section_has_teacher" as const,
            message: "This section already has an active class teacher. Replacing will close the previous assignment. Confirm?",
          },
        };
      }
    }

    const effectiveFromDate = new Date().toISOString().split("T")[0]!;

    await withTenant(schoolId, async (tx) => {
      if (params.forceTransfer && params.teacherId) {
        await tx
          .update(classTeacherAssignments)
          .set({ isActive: false, effectiveTo: effectiveFromDate, updatedAt: new Date() })
          .where(
            and(
              eq(classTeacherAssignments.schoolId, schoolId),
              eq(classTeacherAssignments.academicYearId, academicYearId),
              eq(classTeacherAssignments.teacherId, params.teacherId),
              eq(classTeacherAssignments.isActive, true),
            ),
          );
      }

      // Preserve history by closing any existing active assignment for this section
      await tx
        .update(classTeacherAssignments)
        .set({ isActive: false, effectiveTo: effectiveFromDate, updatedAt: new Date() })
        .where(
          and(
            eq(classTeacherAssignments.schoolId, schoolId),
            eq(classTeacherAssignments.academicYearId, academicYearId),
            eq(classTeacherAssignments.sectionId, params.sectionId),
            eq(classTeacherAssignments.isActive, true),
          ),
        );

      await tx
        .update(sections)
        .set({ classTeacherId: params.teacherId, updatedAt: new Date() })
        .where(and(eq(sections.id, params.sectionId), eq(sections.schoolId, schoolId)));

      if (params.teacherId) {
        await tx.insert(classTeacherAssignments).values({
          schoolId,
          academicYearId,
          sectionId: params.sectionId,
          teacherId: params.teacherId,
          isActive: true,
          effectiveFrom: effectiveFromDate,
          effectiveTo: null,
          notes: params.notes || null,
        });
      }

      const reqCtx = await getClientRequestContext();
      await tx.insert(auditLogs).values({
        schoolId,
        userId: ctx.userId,
        userEmail: ctx.email,
        userRole: ctx.role,
        action: "WRITE",
        tableName: "class_teacher_assignments",
        recordId: params.sectionId,
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
      });
    });

    revalidatePath("/academics");
    revalidatePath("/academics/classes");
    return { success: true as const };
  } catch (error: any) {
    console.error("Failed to assign class teacher:", error);
    return { success: false as const, error: error?.message || "Failed to assign class teacher." };
  }
}
