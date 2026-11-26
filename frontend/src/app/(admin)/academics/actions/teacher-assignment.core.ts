import { db, withTenant } from "@/db";
import {
  classTeacherAssignments,
  sections,
  schools,
  auditLogs,
  domainEvents,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getActiveAcademicYear } from "./auth-helper";
import { clearTeacherScopeCache } from "@/lib/teacherEventEngine/scopeResolver";
import { invalidateTeachingStaffCache } from "@/app/(admin)/hr/teachingStaff";
import { getClientRequestContext } from "@/lib/requestContext";
import { revalidatePath } from "next/cache";

export interface UpsertClassTeacherParams {
  sectionId: string;
  teacherId?: string | null | undefined;
  role?: "PRIMARY" | "DEPUTY" | undefined;
  effectiveFrom?: string | undefined; // "YYYY-MM-DD"
  notes?: string | undefined;
  forceTransfer?: boolean | undefined;
  checkSectionConflict?: boolean | undefined;
}

export interface ClassTeacherConflictInfo {
  type?: "teacher_already_assigned" | "section_has_teacher" | undefined;
  teacherId: string;
  existingTeacherId?: string | undefined;
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

export interface ClassTeacherActor {
  userId: string;
  schoolId: string;
  role: string;
  email: string;
}

async function isMultiSectionAllowed(schoolId: string): Promise<boolean> {
  try {
    if (typeof (db.query as any)?.schools?.findFirst !== "function") {
      return false;
    }
    const schoolRow = await db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
      columns: { featureFlags: true },
    });
    return Boolean((schoolRow?.featureFlags as any)?.allowMultiSectionClassTeacher === true);
  } catch {
    return false;
  }
}

export async function checkClassTeacherConflictCore(
  schoolId: string,
  teacherId: string,
  sectionId: string,
  role: "PRIMARY" | "DEPUTY" = "PRIMARY",
): Promise<ClassTeacherConflictInfo | null> {
  if (role === "DEPUTY") {
    return null;
  }

  const allowMultiSection = await isMultiSectionAllowed(schoolId);
  if (allowMultiSection) {
    return null;
  }

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
      eq(classTeacherAssignments.role, "PRIMARY"),
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
      type: "teacher_already_assigned",
      teacherId,
      existingSectionId: existing.sectionId,
      existingSectionName: sectionName,
      existingClassName: className,
      message: `Teacher is already assigned as Class Teacher of ${className} Section ${sectionName} for this academic year.`,
    };
  }

  return null;
}

export async function upsertClassTeacherAssignmentCore(
  actor: ClassTeacherActor,
  params: UpsertClassTeacherParams & { auditPurposeId?: string; source?: string },
): Promise<UpsertClassTeacherResult> {
  const schoolId = actor.schoolId;
  const targetRole: "PRIMARY" | "DEPUTY" = params.role === "DEPUTY" ? "DEPUTY" : "PRIMARY";
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

  const allowMultiSection = await isMultiSectionAllowed(schoolId);

  // 2. Conflict check if assigning a PRIMARY teacher
  if (params.teacherId && targetRole === "PRIMARY" && !params.forceTransfer) {
    const conflict = await checkClassTeacherConflictCore(
      schoolId,
      params.teacherId,
      params.sectionId,
      targetRole,
    );
    if (conflict) {
      return {
        success: false,
        conflict,
        error: conflict.message,
      };
    }

    if (params.checkSectionConflict) {
      const sectionConflict = await db.query.classTeacherAssignments.findFirst({
        where: and(
          eq(classTeacherAssignments.schoolId, schoolId),
          eq(classTeacherAssignments.academicYearId, academicYearId),
          eq(classTeacherAssignments.sectionId, params.sectionId),
          eq(classTeacherAssignments.isActive, true),
          eq(classTeacherAssignments.role, "PRIMARY"),
        ),
      });
      if (sectionConflict && sectionConflict.teacherId !== params.teacherId) {
        return {
          success: false,
          conflict: {
            type: "section_has_teacher",
            teacherId: params.teacherId,
            existingTeacherId: sectionConflict.teacherId,
            existingSectionId: params.sectionId,
            existingSectionName: sec.name || "",
            existingClassName: sec.class?.displayName || "",
            message:
              "This section already has an active class teacher. Replacing will close the previous assignment. Confirm?",
          },
          error:
            "This section already has an active class teacher. Replacing will close the previous assignment. Confirm?",
        };
      }
    }
  }

  // 3. Transactional update
  let priorActiveTeacherId: string | null = null;
  const reqCtx = getClientRequestContext();

  const result = await withTenant(schoolId, async (tx) => {
    if (targetRole === "PRIMARY") {
      // If transferring from another section, deactivate prior assignment and clear old section's mirror
      if (params.teacherId && params.forceTransfer && !allowMultiSection) {
        const prior = await tx.query.classTeacherAssignments.findFirst({
          where: and(
            eq(classTeacherAssignments.schoolId, schoolId),
            eq(classTeacherAssignments.academicYearId, academicYearId),
            eq(classTeacherAssignments.teacherId, params.teacherId),
            eq(classTeacherAssignments.isActive, true),
            eq(classTeacherAssignments.role, "PRIMARY"),
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

      // Current active PRIMARY assignment for THIS section
      const currentActive = await tx.query.classTeacherAssignments.findFirst({
        where: and(
          eq(classTeacherAssignments.schoolId, schoolId),
          eq(classTeacherAssignments.academicYearId, academicYearId),
          eq(classTeacherAssignments.sectionId, params.sectionId),
          eq(classTeacherAssignments.isActive, true),
          eq(classTeacherAssignments.role, "PRIMARY"),
        ),
      });
      if (currentActive?.teacherId) {
        priorActiveTeacherId = currentActive.teacherId;
      }

      let assignmentId: string | undefined;

      if (currentActive) {
        if (!params.teacherId) {
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
        } else if (
          currentActive.teacherId === params.teacherId &&
          currentActive.effectiveFrom === effectiveFromDate
        ) {
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

          assignmentId = currentActive.id;
        } else {
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
      }

      if (params.teacherId && !assignmentId) {
        const [newRow] = await tx
          .insert(classTeacherAssignments)
          .values({
            schoolId,
            academicYearId,
            sectionId: params.sectionId,
            teacherId: params.teacherId,
            role: "PRIMARY",
            isActive: true,
            effectiveFrom: effectiveFromDate,
            effectiveTo: null,
            notes: params.notes || null,
          })
          .returning({ id: classTeacherAssignments.id });

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

        assignmentId = newRow?.id;
      }

      await tx.insert(auditLogs).values({
        userId: actor.userId,
        userEmail: actor.email || "[audit-system]",
        userRole: actor.role as any,
        schoolId,
        action: "WRITE",
        tableName: "class_teacher_assignments",
        recordId: params.sectionId,
        purposeId: params.auditPurposeId || "academic_assignments",
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
        metadata: {
          sectionId: params.sectionId,
          teacherId: params.teacherId ?? null,
          priorTeacherId: priorActiveTeacherId,
          role: "PRIMARY",
          forceTransfer: Boolean(params.forceTransfer),
          effectiveFrom: effectiveFromDate,
          source: params.source || "academics",
        },
      });

      await tx.insert(domainEvents).values({
        schoolId,
        aggregateId: params.sectionId,
        eventType: "TeacherReassignedEvent",
        payload: {
          assignmentType: "CLASS_TEACHER",
          sectionId: params.sectionId,
          role: "PRIMARY",
          previousTeacherId: priorActiveTeacherId,
          newTeacherId: params.teacherId ?? null,
          effectiveFrom: effectiveFromDate,
          forceTransfer: Boolean(params.forceTransfer),
          reassignedByUserId: actor.userId,
        },
        status: "PENDING",
      });

      return { success: true, assignmentId };
    } else {
      // DEPUTY class teacher assignment — does NOT overwrite PRIMARY or sections.classTeacherId
      let assignmentId: string | undefined;

      if (!params.teacherId) {
        await tx
          .update(classTeacherAssignments)
          .set({
            isActive: false,
            effectiveTo: effectiveFromDate,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(classTeacherAssignments.schoolId, schoolId),
              eq(classTeacherAssignments.academicYearId, academicYearId),
              eq(classTeacherAssignments.sectionId, params.sectionId),
              eq(classTeacherAssignments.role, "DEPUTY"),
              eq(classTeacherAssignments.isActive, true),
            ),
          );
      } else {
        const existingDeputy = await tx.query.classTeacherAssignments.findFirst({
          where: and(
            eq(classTeacherAssignments.schoolId, schoolId),
            eq(classTeacherAssignments.academicYearId, academicYearId),
            eq(classTeacherAssignments.sectionId, params.sectionId),
            eq(classTeacherAssignments.teacherId, params.teacherId),
            eq(classTeacherAssignments.role, "DEPUTY"),
            eq(classTeacherAssignments.isActive, true),
          ),
        });

        if (existingDeputy) {
          await tx
            .update(classTeacherAssignments)
            .set({
              notes: params.notes ?? existingDeputy.notes,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(classTeacherAssignments.id, existingDeputy.id),
                eq(classTeacherAssignments.schoolId, schoolId),
              ),
            );
          assignmentId = existingDeputy.id;
        } else {
          const [newRow] = await tx
            .insert(classTeacherAssignments)
            .values({
              schoolId,
              academicYearId,
              sectionId: params.sectionId,
              teacherId: params.teacherId,
              role: "DEPUTY",
              isActive: true,
              effectiveFrom: effectiveFromDate,
              effectiveTo: null,
              notes: params.notes || null,
            })
            .returning({ id: classTeacherAssignments.id });
          assignmentId = newRow?.id;
        }
      }

      await tx.insert(auditLogs).values({
        userId: actor.userId,
        userEmail: actor.email || "[audit-system]",
        userRole: actor.role as any,
        schoolId,
        action: "WRITE",
        tableName: "class_teacher_assignments",
        recordId: params.sectionId,
        purposeId: params.auditPurposeId || "academic_assignments",
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
        metadata: {
          sectionId: params.sectionId,
          teacherId: params.teacherId ?? null,
          role: "DEPUTY",
          effectiveFrom: effectiveFromDate,
          source: params.source || "academics",
        },
      });

      await tx.insert(domainEvents).values({
        schoolId,
        aggregateId: params.sectionId,
        eventType: "TeacherReassignedEvent",
        payload: {
          assignmentType: "CLASS_TEACHER",
          sectionId: params.sectionId,
          role: "DEPUTY",
          previousTeacherId: null,
          newTeacherId: params.teacherId ?? null,
          effectiveFrom: effectiveFromDate,
          reassignedByUserId: actor.userId,
        },
        status: "PENDING",
      });

      return { success: true, assignmentId };
    }
  });

  try {
    await invalidateTeachingStaffCache(schoolId);
    if (priorActiveTeacherId && priorActiveTeacherId !== params.teacherId) {
      clearTeacherScopeCache(priorActiveTeacherId);
    }
    if (params.teacherId) {
      clearTeacherScopeCache(params.teacherId);
    }
    clearTeacherScopeCache();
    revalidatePath("/academics");
    revalidatePath("/academics/classes");
    revalidatePath("/academics/classrooms");
    if (sec.classId) {
      revalidatePath(`/academics/classes/${sec.classId}`);
    }
  } catch {}

  return result;
}
