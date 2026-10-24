import { db, withTenant } from "@/db";
import {
  academicYears,
  classes,
  sections,
  classSubjects,
  sectionSubjectTeachers,
  schools,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/serverAuth";
import type { Role } from "@schoolmitra/validators";
import { cache } from "react";

// checkAuth is wrapped in React cache() so it only calls requireAuth() ONCE per request,
// resolving active user, tenant schoolId (including sm_impersonation token), and role.
export const checkAuth = cache(async function checkAuthImpl(allowedRoles?: string[]) {
  const ctx = await requireAuth(allowedRoles as readonly Role[] | undefined);
  let schoolId = ctx.schoolId;

  // Fallback for SUPER_ADMIN inspecting without an active impersonation cookie in dev/admin context
  if (!schoolId && ctx.role === "SUPER_ADMIN") {
    const activeSchool = await db.query.schools.findFirst({
      where: eq(schools.isActive, true),
      columns: { id: true },
    });
    schoolId = activeSchool?.id || null;
  }

  if (!schoolId) {
    throw new Error("No school context. Please select or impersonate a school instance.");
  }

  return {
    user: {
      id: ctx.userId,
      schoolId,
      role: ctx.role,
      email: ctx.email,
    },
  };
});

// In-memory TTL cache for active academic year (infrequently mutated)
const activeYearCache = new Map<string, { data: any; expiresAt: number }>();

export function invalidateActiveYearCache(schoolId?: string) {
  if (schoolId) {
    activeYearCache.delete(schoolId);
  } else {
    activeYearCache.clear();
  }
}

// Cached per-request and with 60s in-memory TTL across requests
export const getActiveAcademicYear = cache(async function getActiveAcademicYearImpl(schoolId: string) {
  if (!schoolId) {
    throw new Error("Cannot fetch academic year: School ID is required.");
  }

  const now = Date.now();
  const cached = activeYearCache.get(schoolId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const activeYears = typeof (db.query.academicYears as any)?.findMany === "function"
    ? await db.query.academicYears.findMany({
        where: and(
          eq(academicYears.schoolId, schoolId),
          eq(academicYears.isActive, true),
        ),
      })
    : [
        await db.query.academicYears.findFirst({
          where: and(
            eq(academicYears.schoolId, schoolId),
            eq(academicYears.isActive, true),
          ),
        }),
      ].filter(Boolean);

  if (activeYears.length === 0) {
    // If no active year found, try finding the latest academic year for this school as fallback
    const latestYear = await db.query.academicYears.findFirst({
      where: eq(academicYears.schoolId, schoolId),
      orderBy: (t, { desc }) => [desc(t.startDate)],
    });
    if (latestYear) {
      activeYearCache.set(schoolId, { data: latestYear, expiresAt: now + 60_000 });
      return latestYear;
    }
    throw new Error(
      "No active academic year found for this school. Please configure and activate an academic year.",
    );
  }

  if (activeYears.length > 1) {
    throw new Error(
      `Multiple active academic years found for this school (${activeYears.length} active). Exactly one academic year must be active at a time.`,
    );
  }

  const result = activeYears[0]!;
  activeYearCache.set(schoolId, { data: result, expiresAt: now + 60_000 });
  return result;
});

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
  return withTenant(session.user.schoolId, async (tx) => {
    // 1. Verify classSubject exists and belongs to this school
    const cs = await tx.query.classSubjects.findFirst({
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
      const sec = await tx.query.sections.findFirst({
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
        const sectionAlloc = await tx.query.sectionSubjectTeachers.findFirst({
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
      } else {
        // If no sectionId specified (e.g. class-level syllabus), check if teacher is allocated to any section
        const anySectionAlloc = await tx.query.sectionSubjectTeachers.findFirst({
          where: and(
            eq(sectionSubjectTeachers.schoolId, session.user.schoolId),
            eq(sectionSubjectTeachers.classSubjectId, classSubjectId),
            eq(sectionSubjectTeachers.teacherId, session.user.id),
            eq(sectionSubjectTeachers.isActive, true),
            isNull(sectionSubjectTeachers.effectiveTo),
          ),
        });
        if (anySectionAlloc) {
          return;
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
  });
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
