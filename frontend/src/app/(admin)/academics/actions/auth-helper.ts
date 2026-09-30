import { db } from "@/db";
import {
  academicYears,
  classes,
  sections,
  classSubjects,
  sectionSubjectTeachers,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function checkAuth(allowedRoles?: string[]) {
  let session = null;
  if (process.env.NODE_ENV !== "production" && process.env.TEST_AUTH_USER) {
    try {
      session = JSON.parse(process.env.TEST_AUTH_USER);
    } catch {
      session = null;
    }
  }
  if (!session) {
    session = await auth();
  }
  if (!session?.user?.id || !session?.user?.schoolId) {
    throw new Error("Unauthorized");
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    throw new Error("Access Denied: Insufficient Permissions");
  }
  return session as typeof session & {
    user: { id: string; schoolId: string; role: string; email?: string | null };
  };
}

export async function getActiveAcademicYear(schoolId: string) {
  const activeYears = await db.query.academicYears.findMany({
    where: and(
      eq(academicYears.schoolId, schoolId),
      eq(academicYears.isActive, true),
    ),
  });

  if (activeYears.length === 0) {
    throw new Error(
      "No active academic year found for this school. Please configure and activate an academic year.",
    );
  }

  if (activeYears.length > 1) {
    throw new Error(
      `Multiple active academic years found for this school (${activeYears.length} active). Exactly one academic year must be active at a time.`,
    );
  }

  return activeYears[0]!;
}

/**
 * Server-side teacher authorization for a classSubject + optional section (Rule #11).
 * Validates the full context hierarchy:
 * School -> Active Academic Year -> Class -> Section -> ClassSubject -> Teacher Allocation.
 * Never trusts IDs from the browser as proof of access.
 */
export async function verifyTeacherAccessToClassSubject(
  session: Awaited<ReturnType<typeof checkAuth>>,
  classSubjectId: string,
  sectionId?: string,
): Promise<void> {
  // 1. Verify classSubject exists and belongs to this school
  const cs = await db.query.classSubjects.findFirst({
    where: and(
      eq(classSubjects.id, classSubjectId),
      eq(classSubjects.schoolId, session.user.schoolId),
    ),
    with: {
      class: true,
    },
  });
  if (!cs || !cs.class || !cs.class.isActive) {
    throw new Error("Invalid or inactive class subject");
  }

  // 2. Verify class belongs to active academic year
  const activeYear = await getActiveAcademicYear(session.user.schoolId);
  if (cs.class.academicYearId !== activeYear.id) {
    throw new Error("Class subject does not belong to the active academic year");
  }

  // 3. If sectionId is specified, verify it belongs to this exact class and school
  if (sectionId) {
    const sec = await db.query.sections.findFirst({
      where: and(
        eq(sections.id, sectionId),
        eq(sections.schoolId, session.user.schoolId),
        eq(sections.classId, cs.classId),
        eq(sections.isActive, true),
      ),
    });
    if (!sec) {
      throw new Error(
        "Invalid section: section does not belong to this class or is inactive",
      );
    }
  }

  // 4. Role & Assignment authorization check
  if (["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(session.user.role)) {
    return;
  }

  if (session.user.role === "TEACHER") {
    // If sectionId is specified, check section-level allocation first
    if (sectionId) {
      const sectionAlloc = await db.query.sectionSubjectTeachers.findFirst({
        where: and(
          eq(sectionSubjectTeachers.schoolId, session.user.schoolId),
          eq(sectionSubjectTeachers.classSubjectId, classSubjectId),
          eq(sectionSubjectTeachers.sectionId, sectionId),
          eq(sectionSubjectTeachers.isActive, true),
          isNull(sectionSubjectTeachers.effectiveTo),
        ),
      });

      if (sectionAlloc) {
        // Section-specific teacher allocation takes absolute precedence
        if (sectionAlloc.teacherId === session.user.id) {
          return;
        }
        throw new Error(
          "Access Denied: Another teacher is specifically allocated to this section.",
        );
      }
    }

    // Class-level default teacher mapping (only applies if no section-specific allocation exists)
    if (cs.assignedTeacherId === session.user.id) {
      return;
    }
  }

  throw new Error(
    "Access Denied: You are not assigned or authorized for this subject/section.",
  );
}

/**
 * Standardized Syllabus Progress Formula used consistently across all AMS views:
 * (completed active topics / total active topics) * 100
 * A topic is considered completed if it is linked to at least one lesson plan with status = 'COMPLETED'.
 * Clamped strictly between 0 and 100.
 */
export function calculateSyllabusProgress(
  totalActiveTopics: number,
  completedTopics: number,
): number {
  if (totalActiveTopics <= 0) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((completedTopics / totalActiveTopics) * 100)),
  );
}
