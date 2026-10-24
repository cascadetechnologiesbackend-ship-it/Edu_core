/**
 * Exam Module RBAC Permissions Registry & Guards (S8 Offline Examinations Rebuild)
 * Enforces strict fail-closed authorization across all 11 exam lifecycle operations.
 */

export type ExamPermission =
  | "exam.dashboard.view"
  | "exam.setup.manage"
  | "exam.enrollments.manage"
  | "exam.schedule.manage"
  | "exam.schedule.conflict.override"
  | "exam.admit_card.manage"
  | "exam.admit_card.view"
  | "exam.marks.entry"
  | "exam.marks.lock"
  | "exam.marks.unlock"
  | "exam.result.publish"
  | "exam.result.view"
  | "exam.analytics.view"
  | "exam.usage.view";

export const ALL_EXAM_PERMISSIONS: readonly ExamPermission[] = [
  "exam.dashboard.view",
  "exam.setup.manage",
  "exam.enrollments.manage",
  "exam.schedule.manage",
  "exam.schedule.conflict.override",
  "exam.admit_card.manage",
  "exam.admit_card.view",
  "exam.marks.entry",
  "exam.marks.lock",
  "exam.marks.unlock",
  "exam.result.publish",
  "exam.result.view",
  "exam.analytics.view",
  "exam.usage.view",
] as const;

/**
 * Role-to-Permissions Mapping for Examinations
 * Note on TEACHER: Per Amendment 2, teachers are excluded from all /exams/* routes
 * and their ONLY operational permission is `exam.marks.entry` (exercised exclusively via /teacher/grading).
 * Note on PRINCIPAL: Holds all operational permissions including result publish and conflict override,
 * with enrollments management reserved for SCHOOL_ADMIN and SUPER_ADMIN.
 */
export const ROLE_EXAM_PERMISSIONS: Record<string, readonly ExamPermission[]> = {
  SUPER_ADMIN: ALL_EXAM_PERMISSIONS,
  SCHOOL_ADMIN: ALL_EXAM_PERMISSIONS,
  PRINCIPAL: ALL_EXAM_PERMISSIONS.filter((p) => p !== "exam.enrollments.manage"),
  TEACHER: ["exam.marks.entry"],
  ACCOUNTANT: ["exam.admit_card.manage", "exam.admit_card.view"],
  STUDENT: ["exam.admit_card.view", "exam.result.view"],
  PARENT: ["exam.admit_card.view", "exam.result.view"],
  HR_MANAGER: [],
  LIBRARIAN: [],
  TRANSPORT_MANAGER: [],
  DRIVER: [],
};

/**
 * Checks whether a given role holds the requested exam permission.
 * Fail-closed: returns false for unknown roles or null/undefined.
 */
export function hasExamPermission(
  role: string | null | undefined,
  permission: ExamPermission,
): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;

  const permissions = ROLE_EXAM_PERMISSIONS[role];
  if (!permissions) return false;

  return permissions.includes(permission);
}

export class ExamAuthorizationError extends Error {
  public readonly statusCode: number = 403;
  constructor(message: string) {
    super(message);
    this.name = "ExamAuthorizationError";
  }
}

export interface ExamAuthContext {
  userId?: string | null;
  schoolId?: string | null;
  role: string | null | undefined;
  email?: string | null;
}

/**
 * Guard function that throws ExamAuthorizationError (403) if role lacks permission
 * or if a non-SUPER_ADMIN context lacks school tenant scoping (Amendment 1).
 */
export function requireExamPermission(
  ctxOrRole: ExamAuthContext | string | null | undefined,
  permission: ExamPermission,
): void {
  const role = typeof ctxOrRole === "string" ? ctxOrRole : ctxOrRole?.role;

  if (!hasExamPermission(role, permission)) {
    throw new ExamAuthorizationError(
      `Forbidden: Role '${role ?? "ANONYMOUS"}' lacks required exam permission '${permission}'.`,
    );
  }

  // Fail-closed tenant scoping check (Amendment 1)
  if (typeof ctxOrRole === "object" && ctxOrRole !== null) {
    if (role !== "SUPER_ADMIN" && !ctxOrRole.schoolId) {
      throw new ExamAuthorizationError(
        `Forbidden: Role '${role}' requires active tenant school scope for permission '${permission}'.`,
      );
    }
  }
}

/**
 * Verifies whether a teacher is assigned to teach a given class and/or subject in a school.
 * Non-teacher roles (SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL) bypass teacher-specific assignment.
 */
export async function assertTeacherTeaches(params: {
  teacherId: string;
  schoolId: string;
  role?: string | undefined;
  classId?: string | undefined;
  subjectId?: string | undefined;
  sectionId?: string | undefined;
}): Promise<boolean> {
  const { teacherId, schoolId, role, classId, subjectId, sectionId } = params;

  // Administrative roles have school-wide evaluation access
  if (
    role === "SUPER_ADMIN" ||
    role === "SCHOOL_ADMIN" ||
    role === "PRINCIPAL"
  ) {
    return true;
  }

  // Fail-closed on missing essential identifiers
  if (!teacherId || !schoolId) {
    return false;
  }

  // Teacher evaluation operations require explicit class and subject scope
  if (!classId || !subjectId) {
    return false;
  }

  // Teacher must have active, verified assignment
  try {
    const { db } = await import("@/db");
    const { classSubjects, sectionSubjectTeachers } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");

    // 1. Find target classSubject mapping
    const targetClassSubject = await db.query.classSubjects.findFirst({
      where: and(
        eq(classSubjects.schoolId, schoolId),
        eq(classSubjects.classId, classId),
        eq(classSubjects.subjectId, subjectId),
      ),
    });
    if (!targetClassSubject) return false;

    // 2. Check section override if sectionId is specified
    if (sectionId) {
      const activeSectionOverride = await db.query.sectionSubjectTeachers.findFirst({
        where: and(
          eq(sectionSubjectTeachers.schoolId, schoolId),
          eq(sectionSubjectTeachers.classSubjectId, targetClassSubject.id),
          eq(sectionSubjectTeachers.sectionId, sectionId),
          eq(sectionSubjectTeachers.isActive, true),
        ),
      });

      if (activeSectionOverride) {
        // Section override strictly governs this section
        return activeSectionOverride.teacherId === teacherId;
      }
    }

    // 3. Fall back to class-wide lead teacher assignment
    return targetClassSubject.assignedTeacherId === teacherId;

    // Fail closed: Unrelated assignments in the school do NOT grant access
    return false;
  } catch (err) {
    console.error("[assertTeacherTeaches] Error checking teacher assignment:", err);
    return false;
  }
}
