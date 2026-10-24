/**
 * Teacher Authentication and Authorization Guards Module (S16)
 *
 * Implements strict separation of roles:
 * - Condition A (Instructional): Subject Teacher permissions restricted to allocated subjects & sections.
 * - Condition B (Administrative): Class Teacher override for homeroom students (Student 360, compiled report card, roll-call, leave).
 * - Anti-Tamper & IDOR Prevention: Cross-section student injections trigger abort and 403.
 */

import { db } from "@/db";
import { students, sections } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  resolveTeacherScope,
  TeacherScope,
  TeacherScopeError as BaseTeacherScopeError,
} from "./teacherEventEngine/scopeResolver";

export type TeacherAuthErrorCode =
  | "SUBJECT_TEACHER_FORBIDDEN"
  | "CLASS_TEACHER_OVERRIDE_REQUIRED"
  | "CROSS_SECTION_STUDENT_TAMPER_ATTEMPT"
  | "MARKS_WINDOW_LOCKED"
  | "TENANT_ACCESS_FORBIDDEN";

export class TeacherScopeError extends BaseTeacherScopeError {
  public override readonly statusCode: number;
  public override readonly code: TeacherAuthErrorCode;

  constructor(
    message: string,
    statusCode: number = 403,
    code: TeacherAuthErrorCode = "SUBJECT_TEACHER_FORBIDDEN"
  ) {
    super(message, statusCode);
    this.name = "TeacherScopeError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const ADMIN_BYPASS_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const;

export function isAdminRole(role?: string): boolean {
  if (!role) return false;
  return (ADMIN_BYPASS_ROLES as readonly string[]).includes(role);
}

/**
 * Asserts that the caller is allocated to teach `subjectId` in `sectionId`.
 * Administrative roles bypass.
 * Throws 403 SUBJECT_TEACHER_FORBIDDEN if unauthorized.
 */
export async function assertSubjectTeacherPermission(
  teacherUserId: string,
  sectionId: string,
  subjectId: string,
  options?: { tx?: any; schoolId?: string; role?: string }
): Promise<TeacherScope> {
  if (isAdminRole(options?.role)) {
    return resolveTeacherScope(teacherUserId, options);
  }

  const scope = await resolveTeacherScope(teacherUserId, options);

  const isAllocated = scope.teachingSections.some(
    (ts) => ts.sectionId === sectionId && ts.subjectId === subjectId
  );

  if (!isAllocated) {
    throw new TeacherScopeError(
      `Teacher is not allocated to teach subject ${subjectId} in section ${sectionId}`,
      403,
      "SUBJECT_TEACHER_FORBIDDEN"
    );
  }

  return scope;
}

/**
 * Asserts that the caller is the designated Class Teacher for `sectionId`.
 * Administrative roles bypass.
 * Throws 403 CLASS_TEACHER_OVERRIDE_REQUIRED if unauthorized.
 */
export async function assertClassTeacherOverride(
  teacherUserId: string,
  sectionId: string,
  options?: { tx?: any; schoolId?: string; role?: string }
): Promise<TeacherScope> {
  if (isAdminRole(options?.role)) {
    return resolveTeacherScope(teacherUserId, options);
  }

  const scope = await resolveTeacherScope(teacherUserId, options);

  if (!scope.classTeacherSections.includes(sectionId)) {
    throw new TeacherScopeError(
      `Class Teacher override required: teacher is not the designated Class Teacher for section ${sectionId}`,
      403,
      "CLASS_TEACHER_OVERRIDE_REQUIRED"
    );
  }

  return scope;
}

/**
 * Anti-Tamper & IDOR Guard:
 * Verifies that all student IDs in a write payload belong to the expected section roster.
 * If ANY student belongs to another section or school, aborts and throws 403 CROSS_SECTION_STUDENT_TAMPER_ATTEMPT.
 */
export async function assertStudentRosterMembership(
  studentIds: string[],
  expectedSectionId: string,
  schoolId: string,
  tx?: any
): Promise<void> {
  if (!studentIds || studentIds.length === 0) return;

  const txDb = tx || db;
  const uniqueIds = Array.from(new Set(studentIds));

  const validRows = await txDb
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(students.currentSectionId, expectedSectionId),
        inArray(students.id, uniqueIds)
      )
    );

  if (validRows.length !== uniqueIds.length) {
    throw new TeacherScopeError(
      `Anti-tamper violation: One or more student records do not belong to section ${expectedSectionId} roster. Transaction aborted.`,
      403,
      "CROSS_SECTION_STUDENT_TAMPER_ATTEMPT"
    );
  }
}

/**
 * Asserts Student 360 profile access:
 * - Admin or Class Teacher: full 360 access (cross-subject marks, attendance, conduct, fee status badge).
 * - Allocated Subject Teacher: restricted access (only own subject data visible).
 * - Otherwise: throws 403 CLASS_TEACHER_OVERRIDE_REQUIRED.
 */
export async function assertStudent360Access(
  teacherUserId: string,
  studentId: string,
  options?: { tx?: any; schoolId?: string; role?: string }
): Promise<{
  scope: TeacherScope;
  student: any;
  accessLevel: "FULL_HOMEROOM" | "RESTRICTED_SUBJECT";
}> {
  const txDb = options?.tx || db;
  const scope = await resolveTeacherScope(teacherUserId, options);

  const student = await txDb.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.schoolId, scope.schoolId)),
  });

  if (!student) {
    throw new TeacherScopeError(`Student ${studentId} not found`, 404, "SUBJECT_TEACHER_FORBIDDEN");
  }

  if (isAdminRole(options?.role)) {
    return { scope, student, accessLevel: "FULL_HOMEROOM" };
  }

  const sectionId = student.currentSectionId;
  if (!sectionId) {
    throw new TeacherScopeError("Student is not assigned to a section", 403, "CLASS_TEACHER_OVERRIDE_REQUIRED");
  }

  if (scope.classTeacherSections.includes(sectionId)) {
    return { scope, student, accessLevel: "FULL_HOMEROOM" };
  }

  const isSubjectTeacher = scope.teachingSections.some((ts) => ts.sectionId === sectionId);
  if (isSubjectTeacher) {
    return { scope, student, accessLevel: "RESTRICTED_SUBJECT" };
  }

  throw new TeacherScopeError(
    `Teacher is not authorized to access Student 360 for student ${studentId}`,
    403,
    "CLASS_TEACHER_OVERRIDE_REQUIRED"
  );
}
