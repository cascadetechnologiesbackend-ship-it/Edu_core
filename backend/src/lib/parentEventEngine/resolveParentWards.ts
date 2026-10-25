/**
 * Authoritative Shared Ward Resolver for Parent Companion App & Portal
 *
 * Guarantees strict multi-tenant isolation and active parent linkage across all
 * parent surfaces (dashboard, documents, fees, bus, attendance, messages, profile, portal).
 *
 * Scoping rules:
 * - PARENT role: students WHERE schoolId = ctx.schoolId AND primaryParentUserId = ctx.userId AND isActive = true
 * - Admin/Principal preview: students WHERE schoolId = ctx.schoolId AND id = searchParamStudentId AND isActive = true
 * - Zero fallback to global students (Defect D6 permanently closed).
 */

import { db } from "@/db";
import { students, classes, sections, classTeacherAssignments, staff } from "@schoolmitra/database";
import { eq, and, asc, inArray } from "drizzle-orm";
import { decryptData } from "../encryption";
import { withTenant } from "../tenant";

export interface ParentWard {
  id: string;
  schoolId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  currentClassId: string | null;
  currentSectionId: string | null;
  className: string;
  sectionName: string;
  photoS3Key: string | null;
  isActive: boolean;
  rollNumber?: string | null;
  dateOfBirth?: Date | null;
  classTeacherName?: string | null;
  classTeacherDesignation?: string | null;
}

export interface ResolveParentWardsContext {
  role: string;
  userId: string;
}

export async function resolveParentWards(
  ctx: ResolveParentWardsContext,
  schoolId: string,
  searchParamStudentId?: string | null,
  tx?: any
): Promise<ParentWard[]> {
  const runResolver = async (executor: any) => {
    let studentRows: any[] = [];

    if (ctx.role === "PARENT") {
      studentRows = await executor.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.primaryParentUserId, ctx.userId),
          eq(students.isActive, true)
        ),
        orderBy: [asc(students.admissionNumber)],
      });
    } else {
      // Admin / Principal previewing parent portal require explicit ?studentId=
      if (!searchParamStudentId) {
        return [];
      }

      studentRows = await executor.query.students.findMany({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.id, searchParamStudentId),
          eq(students.isActive, true)
        ),
        limit: 1,
      });
    }

    if (!studentRows || studentRows.length === 0) {
      return [];
    }

    // Resolve class & section display names within school
    const classIds = studentRows.map((s) => s.currentClassId).filter(Boolean) as string[];
    const sectionIds = studentRows.map((s) => s.currentSectionId).filter(Boolean) as string[];

    const [classList, sectionList, ctaList] = await Promise.all([
      classIds.length > 0
        ? executor.query.classes.findMany({
            where: and(eq(classes.schoolId, schoolId), inArray(classes.id, classIds)),
            columns: { id: true, displayName: true, name: true, gradeLevel: true },
          })
        : [],
      sectionIds.length > 0
        ? executor.query.sections.findMany({
            where: and(eq(sections.schoolId, schoolId), inArray(sections.id, sectionIds)),
            columns: { id: true, displayName: true, name: true, classTeacherId: true },
          })
        : [],
      sectionIds.length > 0 && executor.query?.classTeacherAssignments
        ? executor.query.classTeacherAssignments.findMany({
            where: and(
              eq(classTeacherAssignments.schoolId, schoolId),
              inArray(classTeacherAssignments.sectionId, sectionIds),
              eq(classTeacherAssignments.isActive, true)
            ),
          })
        : [],
    ]);

    const classMap = new Map<string, string>(
      classList.map((c: any) => [c.id, c.displayName || c.name || c.gradeLevel || "Class"])
    );
    const sectionMap = new Map<string, any>(
      sectionList.map((s: any) => [s.id, s])
    );

    // Resolve teacher user IDs from canonical CTA first, then section mirror
    const teacherUserIdsSet = new Set<string>();
    for (const sId of sectionIds) {
      const ctaRow = ctaList.find((c: any) => c.sectionId === sId);
      const secRow = sectionMap.get(sId);
      const tId = ctaRow?.teacherId || secRow?.classTeacherId;
      if (tId) teacherUserIdsSet.add(tId);
    }

    const teacherUserIds = Array.from(teacherUserIdsSet);
    const teacherStaffList =
      teacherUserIds.length > 0 && executor.query?.staff
        ? await executor.query.staff.findMany({
            where: and(
              eq(staff.schoolId, schoolId),
              inArray(staff.userId, teacherUserIds),
              eq(staff.isActive, true)
            ),
            with: { designation: true },
          })
        : [];

    const teacherMap = new Map<string, { name: string; designation: string }>();
    for (const st of teacherStaffList) {
      if (st.userId) {
        const fn = decryptData(st.firstNameEncrypted) || "";
        const ln = decryptData(st.lastNameEncrypted) || "";
        const fullName = `${fn} ${ln}`.trim() || "Faculty";
        const designation = st.designation?.name || "Class Teacher";
        teacherMap.set(st.userId, { name: fullName, designation });
      }
    }

    return studentRows.map((s: any) => {
      const firstName = decryptData(s.firstNameEncrypted) || "";
      const lastName = decryptData(s.lastNameEncrypted) || "";
      const fullName = `${firstName} ${lastName}`.trim() || "Student";
      const sec = s.currentSectionId ? sectionMap.get(s.currentSectionId) : null;
      const cta = s.currentSectionId ? ctaList.find((c: any) => c.sectionId === s.currentSectionId) : null;
      const tId = cta?.teacherId || sec?.classTeacherId;
      const tInfo = tId ? teacherMap.get(tId) : null;

      return {
        id: s.id,
        schoolId: s.schoolId,
        admissionNumber: s.admissionNumber,
        firstName,
        lastName,
        fullName,
        currentClassId: s.currentClassId,
        currentSectionId: s.currentSectionId,
        className: (s.currentClassId && classMap.get(s.currentClassId)) || "Unassigned",
        sectionName: sec ? (sec.displayName || sec.name || "-") : "-",
        photoS3Key: s.photoS3Key || null,
        isActive: s.isActive,
        rollNumber: s.rollNumber || null,
        dateOfBirth: s.dateOfBirth || null,
        classTeacherName: tInfo ? tInfo.name : null,
        classTeacherDesignation: tInfo ? tInfo.designation : null,
      };
    });
  };

  if (tx) {
    return await runResolver(tx);
  }
  return await withTenant(schoolId, runResolver);
}
