"use server";

import { db, withTenant } from "@/db";
import {
  classSubjects,
  sectionSubjectTeachers,
  academicYears,
  sections,
  auditLogs,
  domainEvents,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { checkAuth } from "./auth-helper";
import { clearTeacherScopeCache } from "@/lib/teacherEventEngine/scopeResolver";
import { invalidateTeachingStaffCache } from "@/app/(admin)/hr/teachingStaff";
import { getClientRequestContext } from "@/lib/requestContext";
import {
  upsertClassTeacherAssignmentCore,
  checkClassTeacherConflictCore,
  type UpsertClassTeacherParams,
  type ClassTeacherConflictInfo,
  type UpsertClassTeacherResult,
} from "./teacher-assignment.core";

export type {
  UpsertClassTeacherParams,
  ClassTeacherConflictInfo,
  UpsertClassTeacherResult,
};

/**
 * Checks whether a teacher is currently assigned as active PRIMARY Class Teacher to another section
 * in the same academic year (respecting allowMultiSectionClassTeacher feature flag and DEPUTY role).
 */
export async function checkClassTeacherAssignmentConflict(
  teacherId: string,
  sectionId: string,
  role: "PRIMARY" | "DEPUTY" = "PRIMARY",
): Promise<ClassTeacherConflictInfo | null> {
  const session = await checkAuth();
  return checkClassTeacherConflictCore(session.user.schoolId, teacherId, sectionId, role);
}

/**
 * Single source of truth for Class Teacher assignments (S16 + Phase AC).
 */
export async function upsertClassTeacherAssignment(
  params: UpsertClassTeacherParams,
): Promise<UpsertClassTeacherResult> {
  const session = await checkAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"]);
  return upsertClassTeacherAssignmentCore(
    {
      userId: session.user.id,
      schoolId: session.user.schoolId,
      role: session.user.role,
      email: session.user.email,
    },
    params,
  );
}

export interface SetClassSubjectLeadParams {
  schoolId: string;
  classSubjectId: string;
  teacherId: string | null;
  periodsPerWeek?: number;
  isElective?: boolean;
  overrideReason?: string | null;
  recordAudit?: boolean;
  actor?: {
    userId: string;
    email?: string;
    role: string;
  };
}

export interface SetClassSubjectLeadResult {
  success: boolean;
  oldTeacherId?: string | null;
  newTeacherId?: string | null;
  classId?: string;
  error?: string;
}

/**
 * Consolidated single source of truth for Subject Lead assignments (S18 + Phase AC).
 * Enforces:
 * 1. Transactional update of `classSubjects.assignedTeacherId`.
 * 2. Auto-seeds primary `sectionSubjectTeachers` for un-overridden active sections.
 * 3. Bidirectional displacement-aware cache clearing (both old and new teachers).
 * 4. Invalidates dropdown teaching staff cache.
 * 5. Records auditLogs (including qualification overrideReason) & TeacherReassignedEvent when invoked via write paths.
 */
export async function setClassSubjectLead(
  params: SetClassSubjectLeadParams,
  outerTx?: any,
): Promise<SetClassSubjectLeadResult> {
  const { schoolId, classSubjectId, teacherId } = params;
  const effectiveFromDate = new Date().toISOString().split("T")[0]!;

  const runLogic = async (tx: any) => {
    // 1. Fetch current classSubject record to verify existence and capture oldTeacherId
    const cs = await tx.query.classSubjects.findFirst({
      where: and(
        eq(classSubjects.id, classSubjectId),
        eq(classSubjects.schoolId, schoolId),
      ),
      with: { subject: true },
    });

    if (!cs) {
      return { success: false, error: "Class-subject not found or access denied." };
    }

    const oldTeacherId = cs.assignedTeacherId || null;

    // 2. Fetch active academic year
    const activeYearRow = await tx.query.academicYears.findFirst({
      where: and(
        eq(academicYears.isActive, true),
        eq(academicYears.schoolId, schoolId),
      ),
    });

    if (!activeYearRow) {
      return { success: false, error: "No active academic year found." };
    }

    // 3. Update class-level lead (assignedTeacherId)
    await tx
      .update(classSubjects)
      .set({
        assignedTeacherId: teacherId,
        ...(params.periodsPerWeek !== undefined ? { periodsPerWeek: params.periodsPerWeek } : {}),
        ...(params.isElective !== undefined ? { isElective: params.isElective } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(classSubjects.id, classSubjectId),
          eq(classSubjects.schoolId, schoolId),
        ),
      );

    // 4. Auto-seed / reassign primary sectionSubjectTeachers for active sections without an override
    const classSections =
      typeof tx.query?.sections?.findMany === "function"
        ? await tx.query.sections.findMany({
            where: and(
              eq(sections.classId, cs.classId),
              eq(sections.schoolId, schoolId),
              eq(sections.isActive, true),
            ),
          })
        : [];

    if (teacherId) {
      for (const sec of classSections) {
        const existing = await tx.query.sectionSubjectTeachers.findFirst({
          where: and(
            eq(sectionSubjectTeachers.classSubjectId, classSubjectId),
            eq(sectionSubjectTeachers.sectionId, sec.id),
            eq(sectionSubjectTeachers.isActive, true),
            eq(sectionSubjectTeachers.isPrimary, true),
            isNull(sectionSubjectTeachers.effectiveTo),
          ),
        });

        // If existing primary assignment was for the displaced old teacher, deactivate it
        if (existing && oldTeacherId && existing.teacherId === oldTeacherId) {
          await tx
            .update(sectionSubjectTeachers)
            .set({
              isActive: false,
              effectiveTo: effectiveFromDate,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(sectionSubjectTeachers.id, existing.id),
                eq(sectionSubjectTeachers.schoolId, schoolId),
              ),
            );
        }

        // Seed new teacher if section had no primary assignment or previously had the displaced lead
        if (!existing || (oldTeacherId && existing.teacherId === oldTeacherId)) {
          await tx.insert(sectionSubjectTeachers).values({
            schoolId,
            academicYearId: activeYearRow.id,
            classSubjectId,
            sectionId: sec.id,
            teacherId,
            isPrimary: true,
            periodsPerWeek: params.periodsPerWeek ?? cs.periodsPerWeek ?? 5,
            effectiveFrom: effectiveFromDate,
            effectiveTo: null,
            isActive: true,
          });
        }
      }
    } else if (oldTeacherId) {
      // Unassigning lead: deactivate primary section assignments previously seeded for the displaced lead
      for (const sec of classSections) {
        const existing = await tx.query.sectionSubjectTeachers.findFirst({
          where: and(
            eq(sectionSubjectTeachers.classSubjectId, classSubjectId),
            eq(sectionSubjectTeachers.sectionId, sec.id),
            eq(sectionSubjectTeachers.isActive, true),
            eq(sectionSubjectTeachers.isPrimary, true),
            isNull(sectionSubjectTeachers.effectiveTo),
          ),
        });

        if (existing && existing.teacherId === oldTeacherId) {
          await tx
            .update(sectionSubjectTeachers)
            .set({
              isActive: false,
              effectiveTo: effectiveFromDate,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(sectionSubjectTeachers.id, existing.id),
                eq(sectionSubjectTeachers.schoolId, schoolId),
              ),
            );
        }
      }
    }

    if (params.recordAudit || params.overrideReason?.trim()) {
      const reqCtx = getClientRequestContext();
      await tx.insert(auditLogs).values({
        userId: params.actor?.userId || "00000000-0000-0000-0000-000000000000",
        userEmail: params.actor?.email || "[audit-system]",
        userRole: (params.actor?.role || "SCHOOL_ADMIN") as any,
        schoolId,
        action: "WRITE",
        tableName: "class_subjects",
        recordId: classSubjectId,
        purposeId: params.overrideReason?.trim() ? "qualification_override" : "academic_assignments",
        ipAddress: reqCtx.ipAddress,
        userAgent: reqCtx.userAgent,
        metadata: {
          classSubjectId,
          classId: cs.classId,
          subjectId: cs.subjectId,
          oldTeacherId,
          newTeacherId: teacherId,
          overrideReason: params.overrideReason?.trim() || null,
        },
      });

      await tx.insert(domainEvents).values({
        schoolId,
        aggregateId: classSubjectId,
        eventType: "TeacherReassignedEvent",
        payload: {
          assignmentType: "SUBJECT_LEAD",
          classSubjectId,
          classId: cs.classId,
          subjectId: cs.subjectId,
          previousTeacherId: oldTeacherId,
          newTeacherId: teacherId,
          overrideReason: params.overrideReason?.trim() || null,
          reassignedByUserId: params.actor?.userId || null,
        },
        status: "PENDING",
      });
    }

    return {
      success: true,
      oldTeacherId,
      newTeacherId: teacherId,
      classId: cs.classId,
    };
  };

  const res = outerTx
    ? await runLogic(outerTx)
    : await withTenant(schoolId, runLogic);

  if (!res.success) {
    return res;
  }

  // Displacement-Aware Cache Invalidation (L3)
  try {
    await invalidateTeachingStaffCache(schoolId);
    if (res.oldTeacherId && res.oldTeacherId !== teacherId) {
      clearTeacherScopeCache(res.oldTeacherId);
    }
    if (teacherId) {
      clearTeacherScopeCache(teacherId);
    }
    clearTeacherScopeCache(); // broad flush
  } catch {}

  return res;
}

