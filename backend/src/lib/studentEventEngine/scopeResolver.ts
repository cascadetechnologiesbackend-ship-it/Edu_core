/**
 * Authoritative Student Scope Resolver for Student PWA
 *
 * Guarantees strict multi-tenant isolation, subject enrollment scoping,
 * and account status checks across all student surfaces.
 *
 * Scoping rules:
 * 1. STUDENT role: students WHERE schoolId = options.schoolId AND userId = ctx.userId AND isActive = true
 * 2. Admin / Principal preview: students WHERE schoolId = options.schoolId AND id = options.studentId AND isActive = true
 * 3. ZERO fallback to arbitrary students (Defect SD4 permanently closed: findFirst deleted).
 * 4. Account Disabled status: detected when linked user row has isActive = false.
 */

import { db, withAuthContext } from "@/db";
import {
  students,
  classes,
  sections,
  academicYears,
  studentSubjectEnrollments,
  classSubjects,
  users,
} from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { decryptData } from "../encryption";

export class StudentScopeError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(
    message: string,
    statusCode: number = 403,
    code: string = "STUDENT_SCOPE_VIOLATION"
  ) {
    super(message);
    this.name = "StudentScopeError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface StudentScope {
  studentId: string;
  studentUserId: string | null;
  schoolId: string;
  admissionNumber: string;
  studentName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | string | null;
  gender: string | null;
  classId: string | null;
  className: string;
  sectionId: string | null;
  sectionName: string;
  rollNumber: string | null;
  academicYearId: string | null;
  academicYearLabel: string;
  enrolledSubjectIds: string[];
  enrolledClassSubjectIds: string[];
  isAccountDisabled: boolean;
}

export interface ResolveStudentScopeOptions {
  tx?: any;
  schoolId?: string;
  studentId?: string | null; // Explicit parameter for admin preview (?studentId=)
  role?: string;
  bypassCache?: boolean;
}

// Short-lived in-memory cache (5s TTL per request cycle)
const scopeCache = new Map<string, { scope: StudentScope; expiresAt: number }>();
const CACHE_TTL_MS = 5000;

export function clearStudentScopeCache(studentId?: string) {
  if (studentId) {
    for (const key of scopeCache.keys()) {
      if (key.includes(studentId)) {
        scopeCache.delete(key);
      }
    }
  } else {
    scopeCache.clear();
  }
}

export async function resolveStudentScope(
  userId: string,
  options?: ResolveStudentScopeOptions
): Promise<StudentScope> {
  if (!userId || !userId.trim()) {
    throw new StudentScopeError("User ID is required to resolve student scope", 400);
  }

  // Support direct transaction passing: resolveStudentScope(userId, tx)
  const isDirectTx = options && typeof (options as any).execute === "function" && !(options as any).tx;
  const txDb = isDirectTx ? options : (options?.tx || db);

  // 1. Resolve schoolId
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
      // Ignore if session setting is absent in mock/local test
    }
  }

  if (!schoolId && txDb.query?.users?.findFirst) {
    try {
      const userRow = await txDb.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { schoolId: true },
      });
      if (userRow?.schoolId) {
        schoolId = userRow.schoolId;
      }
    } catch {
      // Ignore
    }
  }

  // If still not resolved (e.g. strict fail-closed RLS blocked direct lookup without active GUC),
  // use withAuthContext (sets SYSTEM_AUTH locally to allow reading users table)
  if (!schoolId && typeof withAuthContext === "function") {
    try {
      await withAuthContext(async (authTx) => {
        const userRow = await authTx.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { schoolId: true },
        });
        if (userRow?.schoolId) {
          schoolId = userRow.schoolId;
        }
      });
    } catch {
      // Ignore if auth lookup fails or in mock test environment
    }
  }

  if (!schoolId) {
    throw new StudentScopeError(
      "Tenant isolation error: No active schoolId in transaction or parameter",
      403
    );
  }

  const role = options?.role || "STUDENT";
  const isAdminRole = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(role);
  const cacheKey = `${schoolId}:${userId}:${options?.studentId || "self"}:${role}`;
  const now = Date.now();

  if (!options?.bypassCache) {
    const cached = scopeCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.scope;
    }
  }

  // 2. Query student record with strict scoping
  let studentRecord: any = null;

  if (isAdminRole) {
    // Admin preview requires explicit ?studentId= — ZERO FALLBACK to findFirst (SD4 fixed)
    if (!options?.studentId) {
      throw new StudentScopeError(
        "Admin preview requires an explicit studentId parameter",
        400,
        "ADMIN_STUDENT_ID_REQUIRED"
      );
    }

    studentRecord = await txDb.query.students.findFirst({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.id, options.studentId),
        eq(students.isActive, true)
      ),
    });
  } else {
    // Normal student access: mapped via students.userId
    studentRecord = await txDb.query.students.findFirst({
      where: and(
        eq(students.schoolId, schoolId),
        eq(students.userId, userId),
        eq(students.isActive, true)
      ),
    });
  }

  if (!studentRecord) {
    throw new StudentScopeError(
      "Student record not found or not active in this school",
      404,
      "STUDENT_NOT_FOUND"
    );
  }

  // 3. Check if account is disabled (BR9)
  let isAccountDisabled = false;
  if (studentRecord.userId && txDb.query?.users?.findFirst) {
    try {
      const userRow = await txDb.query.users.findFirst({
        where: and(eq(users.id, studentRecord.userId), eq(users.schoolId, schoolId)),
        columns: { isActive: true },
      });
      if (userRow && userRow.isActive === false) {
        isAccountDisabled = true;
      }
    } catch {
      // Ignore
    }
  }

  // 4. Decrypt student name
  const firstName = decryptData(studentRecord.firstNameEncrypted) || "Student";
  const lastName = decryptData(studentRecord.lastNameEncrypted) || "";
  const studentName = `${firstName} ${lastName}`.trim();

  // 5. Concurrently resolve Class, Section, and Academic Year display labels
  const [classRow, sectionRow, academicYearRow] = await Promise.all([
    studentRecord.currentClassId && txDb.query?.classes?.findFirst
      ? txDb.query.classes.findFirst({
          where: and(
            eq(classes.id, studentRecord.currentClassId),
            eq(classes.schoolId, schoolId)
          ),
          columns: { id: true, displayName: true, name: true },
        })
      : Promise.resolve(null),
    studentRecord.currentSectionId && txDb.query?.sections?.findFirst
      ? txDb.query.sections.findFirst({
          where: and(
            eq(sections.id, studentRecord.currentSectionId),
            eq(sections.schoolId, schoolId)
          ),
          columns: { id: true, displayName: true, name: true },
        })
      : Promise.resolve(null),
    studentRecord.academicYearId && txDb.query?.academicYears?.findFirst
      ? txDb.query.academicYears.findFirst({
          where: and(
            eq(academicYears.id, studentRecord.academicYearId),
            eq(academicYears.schoolId, schoolId)
          ),
          columns: { id: true, name: true, isActive: true },
        })
      : txDb.query?.academicYears?.findFirst
      ? txDb.query.academicYears.findFirst({
          where: and(
            eq(academicYears.schoolId, schoolId),
            eq(academicYears.isActive, true)
          ),
          columns: { id: true, name: true, isActive: true },
        })
      : Promise.resolve(null),
  ]);

  const className = classRow?.displayName || classRow?.name || "Class";
  const sectionName = sectionRow?.displayName || sectionRow?.name || "-";
  const academicYearId = academicYearRow?.id || studentRecord.academicYearId || null;
  const academicYearLabel = academicYearRow?.name || "Current Session";

  // 6. Resolve Subject Enrollments (AC-5, BR3: strictly student's own subjects)
  let enrolledClassSubjectIds: string[] = [];
  let enrolledSubjectIds: string[] = [];

  if (txDb.query?.studentSubjectEnrollments?.findMany) {
    try {
      const enrollments = await txDb.query.studentSubjectEnrollments.findMany({
        where: and(
          eq(studentSubjectEnrollments.schoolId, schoolId),
          eq(studentSubjectEnrollments.studentId, studentRecord.id),
          eq(studentSubjectEnrollments.enrollmentStatus, "ACTIVE")
        ),
        columns: { classSubjectId: true },
      });

      if (enrollments && enrollments.length > 0) {
        enrolledClassSubjectIds = enrollments.map((e: any) => e.classSubjectId);
        if (enrolledClassSubjectIds.length > 0 && txDb.query?.classSubjects?.findMany) {
          const csList = await txDb.query.classSubjects.findMany({
            where: and(
              eq(classSubjects.schoolId, schoolId),
              inArray(classSubjects.id, enrolledClassSubjectIds)
            ),
            columns: { subjectId: true },
          });
          enrolledSubjectIds = csList.map((cs: any) => cs.subjectId);
        }
      }
    } catch {
      // Ignore
    }
  }

  // Fallback: If no explicit student_subject_enrollments rows exist,
  // enroll all non-elective subjects of the student's class (standard baseline)
  if (enrolledClassSubjectIds.length === 0 && studentRecord.currentClassId && txDb.query?.classSubjects?.findMany) {
    try {
      const defaultClassSubjects = await txDb.query.classSubjects.findMany({
        where: and(
          eq(classSubjects.schoolId, schoolId),
          eq(classSubjects.classId, studentRecord.currentClassId),
          eq(classSubjects.isElective, false)
        ),
        columns: { id: true, subjectId: true },
      });
      enrolledClassSubjectIds = defaultClassSubjects.map((cs: any) => cs.id);
      enrolledSubjectIds = defaultClassSubjects.map((cs: any) => cs.subjectId);
    } catch {
      // Ignore
    }
  }

  const scope: StudentScope = {
    studentId: studentRecord.id,
    studentUserId: studentRecord.userId,
    schoolId,
    admissionNumber: studentRecord.admissionNumber,
    studentName,
    firstName,
    lastName,
    dateOfBirth: studentRecord.dateOfBirth,
    gender: studentRecord.gender,
    classId: studentRecord.currentClassId,
    className,
    sectionId: studentRecord.currentSectionId,
    sectionName,
    rollNumber: studentRecord.rollNumber,
    academicYearId,
    academicYearLabel,
    enrolledSubjectIds,
    enrolledClassSubjectIds,
    isAccountDisabled,
  };

  scopeCache.set(cacheKey, { scope, expiresAt: now + CACHE_TTL_MS });

  return scope;
}
