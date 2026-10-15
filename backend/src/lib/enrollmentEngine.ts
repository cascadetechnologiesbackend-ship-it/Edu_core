/**
 * Student Subject Enrollment Engine (Sprint S11 Layer 1)
 * Closes the electives data gap with full tenant-isolation, idempotent backfill,
 * section-wide bulk assignment, and enrollment matrix resolution.
 */

import { db } from "@/db";
import {
  studentSubjectEnrollments,
  classSubjects,
  subjects,
  students,
  classes,
  sections,
} from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  requireExamPermission,
  type ExamAuthContext,
} from "./examPermissions";
import { logExamIsolationViolation } from "./examIsolation";

export interface StudentEnrollmentRecord {
  id: string;
  studentId: string;
  classSubjectId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  isElective: boolean;
  isElectiveTaken: boolean;
  enrollmentStatus: "ACTIVE" | "DROPPED" | "COMPLETED";
}

export interface ClassEnrollmentMatrixResult {
  classId: string;
  className: string;
  subjects: {
    classSubjectId: string;
    subjectId: string;
    code: string;
    name: string;
    isElective: boolean;
  }[];
  students: {
    studentId: string;
    admissionNumber: string;
    rollNumber: string | null;
    name: string;
    sectionName: string | null;
    enrollments: Record<string, boolean>; // classSubjectId -> isEnrolled
  }[];
}

/**
 * Retrieves all subject enrollments for a specific student.
 */
export async function getStudentSubjectEnrollments(
  schoolId: string,
  studentId: string,
): Promise<StudentEnrollmentRecord[]> {
  const rows = await db
    .select({
      id: studentSubjectEnrollments.id,
      studentId: studentSubjectEnrollments.studentId,
      classSubjectId: studentSubjectEnrollments.classSubjectId,
      subjectId: classSubjects.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      isElective: classSubjects.isElective,
      isElectiveTaken: studentSubjectEnrollments.isElectiveTaken,
      enrollmentStatus: studentSubjectEnrollments.enrollmentStatus,
    })
    .from(studentSubjectEnrollments)
    .innerJoin(
      classSubjects,
      eq(studentSubjectEnrollments.classSubjectId, classSubjects.id),
    )
    .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(
      and(
        eq(studentSubjectEnrollments.schoolId, schoolId),
        eq(studentSubjectEnrollments.studentId, studentId),
      ),
    );

  return rows;
}

/**
 * Retrieves the full student-subject enrollment matrix for an entire class.
 */
export async function getClassEnrollmentMatrix(
  schoolId: string,
  classId: string,
): Promise<ClassEnrollmentMatrixResult> {
  const targetClass = await db.query.classes.findFirst({
    where: and(eq(classes.id, classId), eq(classes.schoolId, schoolId)),
  });

  if (!targetClass) {
    throw new Error(`Class ${classId} not found in school ${schoolId}`);
  }

  // 1. Fetch class subjects
  const classSubjRows = await db
    .select({
      classSubjectId: classSubjects.id,
      subjectId: subjects.id,
      code: subjects.code,
      name: subjects.name,
      isElective: classSubjects.isElective,
    })
    .from(classSubjects)
    .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(
      and(
        eq(classSubjects.schoolId, schoolId),
        eq(classSubjects.classId, classId),
      ),
    );

  // 2. Fetch active students in class
  const classStudents = await db
    .select({
      studentId: students.id,
      admissionNumber: students.admissionNumber,
      rollNumber: students.rollNumber,
      firstName: students.firstNameEncrypted, // Decryption handled in UI/Action layer
      lastName: students.lastNameEncrypted,
      sectionId: students.currentSectionId,
    })
    .from(students)
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(students.currentClassId, classId),
        eq(students.isActive, true),
        sql`${students.deletedAt} IS NULL`,
      ),
    );

  const studentIds = classStudents.map((s) => s.studentId);

  // 3. Fetch existing enrollments
  const existingEnrollments =
    studentIds.length > 0
      ? await db
          .select({
            studentId: studentSubjectEnrollments.studentId,
            classSubjectId: studentSubjectEnrollments.classSubjectId,
            enrollmentStatus: studentSubjectEnrollments.enrollmentStatus,
            isElectiveTaken: studentSubjectEnrollments.isElectiveTaken,
          })
          .from(studentSubjectEnrollments)
          .where(
            and(
              eq(studentSubjectEnrollments.schoolId, schoolId),
              inArray(studentSubjectEnrollments.studentId, studentIds),
            ),
          )
      : [];

  const enrollmentMap = new Map<string, boolean>();
  for (const enr of existingEnrollments) {
    const key = `${enr.studentId}:${enr.classSubjectId}`;
    enrollmentMap.set(
      key,
      enr.enrollmentStatus === "ACTIVE" && enr.isElectiveTaken,
    );
  }

  // Build result rows
  const studentsWithEnrollments = classStudents.map((stud) => {
    const enrollmentsRecord: Record<string, boolean> = {};
    for (const cs of classSubjRows) {
      const key = `${stud.studentId}:${cs.classSubjectId}`;
      const isEnrolled = enrollmentMap.get(key) ?? !cs.isElective; // default true for non-electives
      enrollmentsRecord[cs.classSubjectId] = isEnrolled;
    }

    return {
      studentId: stud.studentId,
      admissionNumber: stud.admissionNumber,
      rollNumber: stud.rollNumber,
      name: `${stud.firstName} ${stud.lastName}`.trim(),
      sectionName: null,
      enrollments: enrollmentsRecord,
    };
  });

  return {
    classId: targetClass.id,
    className: targetClass.gradeLevel,
    subjects: classSubjRows,
    students: studentsWithEnrollments,
  };
}

/**
 * Assigns or updates elective enrollments for a specific student.
 */
export async function assignStudentElectives(
  schoolId: string,
  studentId: string,
  assignments: { classSubjectId: string; isElectiveTaken: boolean }[],
  ctx?: ExamAuthContext | null,
): Promise<{ updatedCount: number }> {
  if (ctx) {
    requireExamPermission(ctx, "exam.setup.manage");
  }

  // Cross-tenant verification: verify student belongs to school
  const student = await db.query.students.findFirst({
    where: and(eq(students.id, studentId), eq(students.schoolId, schoolId)),
  });

  if (!student) {
    if (ctx) {
      await logExamIsolationViolation({
        schoolId,
        userId: ctx.userId,
        userRole: ctx.role,
        userEmail: ctx.email,
        tableName: "students",
        recordId: studentId,
        action: "WRITE",
        purposeId: "cross_tenant_violation",
        metadata: { action: "assignStudentElectives", reason: "Student does not belong to school" },
      });
    }
    throw new Error("Student not found or access denied.");
  }

  let count = 0;
  for (const item of assignments) {
    const status = item.isElectiveTaken ? "ACTIVE" : "DROPPED";

    await db
      .insert(studentSubjectEnrollments)
      .values({
        schoolId,
        studentId,
        classSubjectId: item.classSubjectId,
        isElectiveTaken: item.isElectiveTaken,
        enrollmentStatus: status,
      })
      .onConflictDoUpdate({
        target: [
          studentSubjectEnrollments.studentId,
          studentSubjectEnrollments.classSubjectId,
        ],
        set: {
          isElectiveTaken: item.isElectiveTaken,
          enrollmentStatus: status,
          updatedAt: new Date(),
        },
      });

    count++;
  }

  return { updatedCount: count };
}

/**
 * Bulk assigns an elective subject across an entire section of students.
 */
export async function bulkAssignElectiveBySection(
  schoolId: string,
  sectionId: string,
  classSubjectId: string,
  studentIdsToEnroll: string[],
  ctx?: ExamAuthContext | null,
): Promise<{ updatedCount: number }> {
  if (ctx) {
    requireExamPermission(ctx, "exam.setup.manage");
  }

  // Verify section ownership
  const section = await db.query.sections.findFirst({
    where: and(eq(sections.id, sectionId), eq(sections.schoolId, schoolId)),
  });

  if (!section) {
    throw new Error("Section not found or cross-tenant access denied.");
  }

  // Fetch all active students in section
  const sectionStudents = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.schoolId, schoolId),
        eq(students.currentSectionId, sectionId),
        eq(students.isActive, true),
        sql`${students.deletedAt} IS NULL`,
      ),
    );

  const enrolledSet = new Set(studentIdsToEnroll);
  let updatedCount = 0;

  for (const stud of sectionStudents) {
    const isTaken = enrolledSet.has(stud.id);
    const status = isTaken ? "ACTIVE" : "DROPPED";

    await db
      .insert(studentSubjectEnrollments)
      .values({
        schoolId,
        studentId: stud.id,
        classSubjectId,
        isElectiveTaken: isTaken,
        enrollmentStatus: status,
      })
      .onConflictDoUpdate({
        target: [
          studentSubjectEnrollments.studentId,
          studentSubjectEnrollments.classSubjectId,
        ],
        set: {
          isElectiveTaken: isTaken,
          enrollmentStatus: status,
          updatedAt: new Date(),
        },
      });

    updatedCount++;
  }

  return { updatedCount };
}

/**
 * Idempotent backfill: creates ACTIVE rows for all mandatory (non-elective)
 * classSubjects for all active students in a school.
 */
export async function backfillMandatoryEnrollments(
  schoolId: string,
  ctx?: ExamAuthContext | null,
): Promise<{ insertedCount: number }> {
  if (ctx) {
    requireExamPermission(ctx, "exam.setup.manage");
  }

  const result = await db.execute(sql`
    INSERT INTO "student_subject_enrollments" (
      "id",
      "school_id",
      "student_id",
      "class_subject_id",
      "is_elective_taken",
      "enrollment_status",
      "enrolled_at",
      "updated_at"
    )
    SELECT
      gen_random_uuid(),
      s.school_id,
      s.id AS student_id,
      cs.id AS class_subject_id,
      true,
      'ACTIVE'::enrollment_status_enum,
      now(),
      now()
    FROM "students" s
    JOIN "class_subjects" cs ON cs.class_id = s.current_class_id AND cs.school_id = s.school_id
    WHERE s.school_id = ${schoolId}
      AND s.deleted_at IS NULL
      AND s.is_active = true
      AND s.current_class_id IS NOT NULL
      AND cs.is_elective = false
    ON CONFLICT ("student_id", "class_subject_id") DO NOTHING;
  `);

  return { insertedCount: Number(result.rowCount ?? 0) };
}
