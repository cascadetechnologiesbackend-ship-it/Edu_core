/**
 * Exam Module RBAC Permissions Registry & Guards (S8 Offline Examinations Rebuild)
 * Enforces strict fail-closed authorization across all 11 exam lifecycle operations.
 */

export type ExamPermission =
  | "exam.dashboard.view"
  | "exam.setup.manage"
  | "exam.schedule.manage"
  | "exam.admit_card.manage"
  | "exam.admit_card.view"
  | "exam.marks.entry"
  | "exam.marks.lock"
  | "exam.marks.unlock"
  | "exam.result.publish"
  | "exam.result.view"
  | "exam.analytics.view";

export const ALL_EXAM_PERMISSIONS: readonly ExamPermission[] = [
  "exam.dashboard.view",
  "exam.setup.manage",
  "exam.schedule.manage",
  "exam.admit_card.manage",
  "exam.admit_card.view",
  "exam.marks.entry",
  "exam.marks.lock",
  "exam.marks.unlock",
  "exam.result.publish",
  "exam.result.view",
  "exam.analytics.view",
] as const;

/**
 * Role-to-Permissions Mapping for Examinations
 * Note on TEACHER: Per Amendment 2, teachers are excluded from all /exams/* routes
 * and their ONLY operational permission is `exam.marks.entry` (exercised exclusively via /teacher/grading).
 * Note on PRINCIPAL: Holds `exam.result.publish` in addition to SCHOOL_ADMIN and SUPER_ADMIN.
 */
export const ROLE_EXAM_PERMISSIONS: Record<string, readonly ExamPermission[]> = {
  SUPER_ADMIN: ALL_EXAM_PERMISSIONS,
  SCHOOL_ADMIN: ALL_EXAM_PERMISSIONS,
  PRINCIPAL: ALL_EXAM_PERMISSIONS,
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

/**
 * Guard function that throws ExamAuthorizationError (403) if role lacks permission.
 */
export function requireExamPermission(
  role: string | null | undefined,
  permission: ExamPermission,
): void {
  if (!hasExamPermission(role, permission)) {
    throw new ExamAuthorizationError(
      `Forbidden: Role '${role ?? "ANONYMOUS"}' lacks required exam permission '${permission}'.`,
    );
  }
}

/**
 * Verifies whether a teacher is assigned to teach a given class and/or subject in a school.
 * Non-teacher roles (SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL) bypass teacher-specific assignment.
 */
export async function assertTeacherTeaches(params: {
  teacherId: string;
  schoolId: string;
  role?: string;
  classId?: string;
  subjectId?: string;
  sectionId?: string;
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

  // Teacher must have active assignment
  try {
    const { db } = await import("@/db");
    const { classSubjects, sectionSubjectTeachers } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");

    // 1. Check direct classSubjects assignment
    if (classId && subjectId) {
      const direct = await db.query.classSubjects.findFirst({
        where: and(
          eq(classSubjects.schoolId, schoolId),
          eq(classSubjects.classId, classId),
          eq(classSubjects.subjectId, subjectId),
          eq(classSubjects.assignedTeacherId, teacherId),
        ),
      });
      if (direct) return true;
    }

    // 2. Check sectionSubjectTeachers override
    if (sectionId) {
      const sectionTeacher = await db.query.sectionSubjectTeachers.findFirst({
        where: and(
          eq(sectionSubjectTeachers.schoolId, schoolId),
          eq(sectionSubjectTeachers.sectionId, sectionId),
          eq(sectionSubjectTeachers.teacherId, teacherId),
          eq(sectionSubjectTeachers.isActive, true),
        ),
      });
      if (sectionTeacher) return true;
    }

    // Fallback: check if teacher is assigned to any section or subject in the school
    const anyAssignment = await db.query.classSubjects.findFirst({
      where: and(
        eq(classSubjects.schoolId, schoolId),
        eq(classSubjects.assignedTeacherId, teacherId),
      ),
    });

    return !!anyAssignment;
  } catch (err) {
    console.error("[assertTeacherTeaches] Error checking teacher assignment:", err);
    return false;
  }
}
