"use server";

import { withTenant } from "@/db";
import { classTeacherAssignments } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { upsertClassTeacherAssignment } from "../actions/teacher-assignment.actions";

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
  role?: "PRIMARY" | "DEPUTY";
  effectiveFrom?: string;
  forceTransfer?: boolean;
  notes?: string;
}) {
  try {
    await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);

    const res = await upsertClassTeacherAssignment({
      sectionId: params.sectionId,
      teacherId: params.teacherId,
      role: params.role,
      effectiveFrom: params.effectiveFrom,
      forceTransfer: params.forceTransfer,
      notes: params.notes,
      checkSectionConflict: true,
    });

    if (!res.success) {
      if (res.conflict) {
        return {
          success: false as const,
          conflict: {
            type: (res.conflict.type || "teacher_already_assigned") as
              | "teacher_already_assigned"
              | "section_has_teacher",
            message: res.conflict.message,
          },
        };
      }
      return { success: false as const, error: res.error || "Failed to assign class teacher." };
    }

    revalidatePath("/academics");
    revalidatePath("/academics/classes");
    return { success: true as const };
  } catch (error: any) {
    console.error("Failed to assign class teacher:", error);
    return { success: false as const, error: error?.message || "Failed to assign class teacher." };
  }
}
