import { db } from "@/db";
import {
  sections,
  sectionSubjectTeachers,
  classSubjects,
  timetablePeriods,
  academicYears,
  assignments,
  students,
  feeInvoices,
  staff,
  users,
} from "@/db/schema";
import { eq, and, or, inArray, isNull, gte, sql } from "drizzle-orm";

export class TeacherScopeError extends Error {
  public readonly statusCode: number = 403;
  public readonly code: string = "TEACHER_SCOPE_VIOLATION";

  constructor(message: string, statusCode: number = 403) {
    super(message);
    this.name = "TeacherScopeError";
    this.statusCode = statusCode;
  }
}

export interface TeachingSectionAllocation {
  sectionId: string;
  classSubjectId: string;
  subjectId: string;
  className?: string | undefined;
  sectionName?: string | undefined;
  subjectName?: string | undefined;
}

export interface TeacherScope {
  teacherUserId: string;
  schoolId: string;
  academicYearId: string | null;
  classTeacherSections: string[];
  teachingSections: TeachingSectionAllocation[];
  scheduledPeriods: string[];
  allSectionIds: string[];
}

export type FeeBadgeStatus = "PAID" | "DUE" | "OVERDUE";

export interface StudentFeeStatusProjection {
  studentId: string;
  status: FeeBadgeStatus;
}

// Request-scoped / short-lived in-memory cache
const scopeCache = new Map<string, { scope: TeacherScope; expiresAt: number }>();
const CACHE_TTL_MS = 5000; // 5 seconds per request lifecycle

export function clearTeacherScopeCache(teacherUserId?: string) {
  if (teacherUserId) {
    for (const key of scopeCache.keys()) {
      if (key.includes(teacherUserId)) {
        scopeCache.delete(key);
      }
    }
  } else {
    scopeCache.clear();
  }
}

/**
 * Resolves the canonical three-layered scope for a teacher:
 * 1. Class Teacher Sections (sections.classTeacherId)
 * 2. Section-Subject Allocations (sectionSubjectTeachers + classSubjects.assignedTeacherId)
 * 3. Scheduled Periods (timetablePeriods.teacherId for current academic year)
 *
 * All operations must run inside withTenant context.
 */
export async function resolveTeacherScope(
  teacherUserId: string,
  options?: {
    academicYearId?: string | undefined;
    bypassCache?: boolean | undefined;
    tx?: any | undefined;
    schoolId?: string | undefined;
  } | any
): Promise<TeacherScope> {
  if (!teacherUserId || !teacherUserId.trim()) {
    throw new TeacherScopeError("Teacher user ID is required to resolve scope", 400);
  }

  // Handle case where caller passed `tx` directly as the second argument instead of `{ tx }`
  const isDirectTx = options && typeof (options as any).execute === "function" && !(options as any).tx;
  const txDb = isDirectTx ? options : (options?.tx || db);

  // Verify tenant context from session or PostgreSQL app.current_school_id
  let schoolId = isDirectTx ? undefined : options?.schoolId;
  if (!schoolId) {
    try {
      const res: any = await txDb.execute(
        sql`SELECT current_setting('app.current_school_id', true) AS school_id`
      );
      const row = res.rows ? res.rows[0] : res[0];
      const settingVal = row?.school_id || row?.schoolId;
      if (settingVal && typeof settingVal === "string" && settingVal.trim()) {
        schoolId = settingVal.trim();
      }
    } catch {
      // Ignore if setting query fails in mock or environment
    }
  }

  // Fallback: look up teacher's school from staff or users if query method is available
  if (!schoolId && txDb.query?.staff?.findFirst) {
    try {
      const staffRow = await txDb.query.staff.findFirst({
        where: eq(staff.userId, teacherUserId),
        columns: { schoolId: true },
      });
      if (staffRow?.schoolId) {
        schoolId = staffRow.schoolId;
      }
    } catch {
      // Ignore
    }
  }

  if (!schoolId && txDb.query?.users?.findFirst) {
    try {
      const userRow = await txDb.query.users.findFirst({
        where: eq(users.id, teacherUserId),
        columns: { schoolId: true },
      });
      if (userRow?.schoolId) {
        schoolId = userRow.schoolId;
      }
    } catch {
      // Ignore
    }
  }

  if (!schoolId) {
    throw new TeacherScopeError(
      "Tenant isolation error: No active schoolId in transaction or parameter",
      403
    );
  }

  const cacheKey = `${schoolId}:${teacherUserId}:${options?.academicYearId || "default"}`;
  const now = Date.now();

  if (!options?.bypassCache) {
    const cached = scopeCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.scope;
    }
  }

  // 1. Resolve Academic Year
  let targetAcademicYearId = options?.academicYearId || null;
  if (!targetAcademicYearId) {
    const currentYear = await txDb.query.academicYears.findFirst({
      where: and(
        eq(academicYears.schoolId, schoolId),
        eq(academicYears.isActive, true)
      ),
      columns: { id: true },
    });
    targetAcademicYearId = currentYear?.id || null;
  }

  // 2. Fetch Class Teacher Sections
  const classTeacherSectionRows = await txDb.query.sections.findMany({
    where: and(
      eq(sections.schoolId, schoolId),
      eq(sections.classTeacherId, teacherUserId),
      eq(sections.isActive, true)
    ),
    columns: { id: true },
  });
  const classTeacherSections = classTeacherSectionRows.map((s: { id: string }) => s.id);

  // 3. Fetch Section-Subject Overrides (sectionSubjectTeachers)
  const todayStr = new Date().toISOString().split("T")[0] || "";
  const sectionSubjectRows = await txDb.query.sectionSubjectTeachers.findMany({
    where: and(
      eq(sectionSubjectTeachers.schoolId, schoolId),
      eq(sectionSubjectTeachers.teacherId, teacherUserId),
      eq(sectionSubjectTeachers.isActive, true),
      or(
        isNull(sectionSubjectTeachers.effectiveTo),
        gte(sectionSubjectTeachers.effectiveTo, todayStr)
      )
    ),
    with: {
      section: {
        with: {
          class: true,
        },
      },
      classSubject: {
        with: {
          subject: true,
        },
      },
    },
  });

  // 4. Fetch Class-Wide Default Mappings (classSubjects.assignedTeacherId)
  const classSubjectDefaultRows = await txDb.query.classSubjects.findMany({
    where: and(
      eq(classSubjects.schoolId, schoolId),
      eq(classSubjects.assignedTeacherId, teacherUserId)
    ),
    with: {
      class: {
        with: {
          sections: {
            where: eq(sections.isActive, true),
          },
        },
      },
      subject: true,
    },
  });

  // Consolidate Teaching Sections (avoiding duplicate section + subject combos)
  const teachingSectionMap = new Map<string, TeachingSectionAllocation>();

  // A. Section overrides take precedence
  for (const sst of sectionSubjectRows) {
    if (sst.section && sst.classSubject) {
      const key = `${sst.sectionId}:${sst.classSubject.subjectId}`;
      teachingSectionMap.set(key, {
        sectionId: sst.sectionId,
        classSubjectId: sst.classSubjectId,
        subjectId: sst.classSubject.subjectId,
        className: sst.section.class?.displayName || sst.section.class?.name,
        sectionName: sst.section.name,
        subjectName: sst.classSubject.subject?.name,
      });
    }
  }

  // B. Class defaults fill remaining sections
  for (const cs of classSubjectDefaultRows) {
    if (cs.class?.sections) {
      for (const sec of cs.class.sections) {
        const key = `${sec.id}:${cs.subjectId}`;
        if (!teachingSectionMap.has(key)) {
          teachingSectionMap.set(key, {
            sectionId: sec.id,
            classSubjectId: cs.id,
            subjectId: cs.subjectId,
            className: cs.class.displayName || cs.class.name,
            sectionName: sec.name,
            subjectName: cs.subject?.name,
          });
        }
      }
    }
  }

  const teachingSections = Array.from(teachingSectionMap.values());

  // 5. Fetch Scheduled Periods from Timetable
  const periodConditions = [
    eq(timetablePeriods.schoolId, schoolId),
    eq(timetablePeriods.teacherId, teacherUserId),
    eq(timetablePeriods.isActive, true),
  ];
  if (targetAcademicYearId) {
    periodConditions.push(eq(timetablePeriods.academicYearId, targetAcademicYearId));
  }

  const scheduledPeriodRows = await txDb.query.timetablePeriods.findMany({
    where: and(...periodConditions),
    columns: { id: true },
  });
  const scheduledPeriods = scheduledPeriodRows.map((p: { id: string }) => p.id);

  // 6. Union of all section IDs accessible by this teacher
  const allSectionIds = Array.from(
    new Set([
      ...classTeacherSections,
      ...teachingSections.map((ts) => ts.sectionId),
    ])
  );

  const scope: TeacherScope = {
    teacherUserId,
    schoolId,
    academicYearId: targetAcademicYearId,
    classTeacherSections,
    teachingSections,
    scheduledPeriods,
    allSectionIds,
  };

  scopeCache.set(cacheKey, { scope, expiresAt: now + CACHE_TTL_MS });

  return scope;
}

/**
 * Asserts that the teacher has permission to mark roll call or view attendance for the section.
 * Throws TeacherScopeError (403) if outside scope.
 */
export async function assertTeacherCanMarkAttendance(
  teacherUserId: string,
  sectionId: string,
  options?: { tx?: any; schoolId?: string }
): Promise<TeacherScope> {
  const scope = await resolveTeacherScope(teacherUserId, options);
  if (!scope.allSectionIds.includes(sectionId)) {
    throw new TeacherScopeError(
      `Teacher ${teacherUserId} is not authorized to mark attendance for section ${sectionId}`,
      403
    );
  }
  return scope;
}

/**
 * Asserts that the teacher has permission to grade submissions for the assignment.
 * Throws TeacherScopeError (403) if outside scope.
 */
export async function assertTeacherCanGradeAssignment(
  teacherUserId: string,
  assignmentId: string,
  options?: { tx?: any; schoolId?: string }
): Promise<{ scope: TeacherScope; assignment: any }> {
  const txDb = options?.tx || db;
  const scope = await resolveTeacherScope(teacherUserId, options);

  const assignment = await txDb.query.assignments.findFirst({
    where: and(
      eq(assignments.id, assignmentId),
      eq(assignments.schoolId, scope.schoolId)
    ),
  });

  if (!assignment) {
    throw new TeacherScopeError(`Assignment ${assignmentId} not found`, 404);
  }

  const isAuthor = assignment.createdByTeacherId === teacherUserId;
  const isSectionSubjectTeacher = scope.teachingSections.some(
    (ts) =>
      ts.sectionId === assignment.sectionId &&
      ts.classSubjectId === assignment.classSubjectId
  );

  if (!isAuthor && !isSectionSubjectTeacher) {
    throw new TeacherScopeError(
      `Teacher ${teacherUserId} is not authorized to grade assignment ${assignmentId}`,
      403
    );
  }

  return { scope, assignment };
}

/**
 * Asserts that the teacher has permission to access a student record (scoped to their sections).
 * Throws TeacherScopeError (403) if student is not in the teacher's sections.
 */
export async function assertTeacherCanAccessStudent(
  teacherUserId: string,
  studentId: string,
  options?: { tx?: any; schoolId?: string }
): Promise<{ scope: TeacherScope; student: any }> {
  const txDb = options?.tx || db;
  const scope = await resolveTeacherScope(teacherUserId, options);

  const student = await txDb.query.students.findFirst({
    where: and(
      eq(students.id, studentId),
      eq(students.schoolId, scope.schoolId)
    ),
  });

  if (!student) {
    throw new TeacherScopeError(`Student ${studentId} not found`, 404);
  }

  if (!student.currentSectionId || !scope.allSectionIds.includes(student.currentSectionId)) {
    throw new TeacherScopeError(
      `Teacher ${teacherUserId} is not authorized to access student ${studentId}`,
      403
    );
  }

  return { scope, student };
}

/**
 * High-Intent Fee Status Projection (Hard Privacy Contract AC-T2).
 * Teachers receive ONLY status badges ('PAID' | 'DUE' | 'OVERDUE') on student rosters.
 * Balance amounts, line items, late fees, and family payment history are NEVER queried or returned.
 */
export async function projectScopedRosterFeeStatus(
  teacherUserId: string,
  sectionId: string,
  options?: { tx?: any; schoolId?: string }
): Promise<StudentFeeStatusProjection[]> {
  const txDb = options?.tx || db;

  // 1. Verify caller has section access
  const scope = await assertTeacherCanMarkAttendance(teacherUserId, sectionId, options);

  // 2. Query students in this section
  const sectionStudents = await txDb
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.schoolId, scope.schoolId),
        eq(students.currentSectionId, sectionId),
        eq(students.isActive, true)
      )
    );

  if (sectionStudents.length === 0) {
    return [];
  }

  const studentIds = sectionStudents.map((s: { id: string }) => s.id);

  // 3. Query fee invoices projection: ONLY studentId and status (NO amounts)
  const invoiceRows = await txDb
    .select({
      studentId: feeInvoices.studentId,
      status: feeInvoices.status,
    })
    .from(feeInvoices)
    .where(
      and(
        eq(feeInvoices.schoolId, scope.schoolId),
        inArray(feeInvoices.studentId, studentIds)
      )
    );

  // Group status by studentId
  const statusMap = new Map<string, FeeBadgeStatus>();

  // Default every student to PAID until an unpaid invoice is encountered
  for (const sId of studentIds) {
    statusMap.set(sId, "PAID");
  }

  for (const inv of invoiceRows) {
    const current = statusMap.get(inv.studentId) || "PAID";
    if (inv.status === "OVERDUE") {
      statusMap.set(inv.studentId, "OVERDUE");
    } else if (
      (inv.status === "PENDING" || inv.status === "PARTIAL") &&
      current !== "OVERDUE"
    ) {
      statusMap.set(inv.studentId, "DUE");
    }
  }

  return studentIds.map((sId: string) => ({
    studentId: sId,
    status: statusMap.get(sId) || "PAID",
  }));
}
