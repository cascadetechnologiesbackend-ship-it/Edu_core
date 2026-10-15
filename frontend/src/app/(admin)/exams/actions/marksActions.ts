"use server";

import { db } from "@/db";
import {
  markEntries,
  examMarksLocks,
  exams,
  students,
  classSubjects,
  subjects,
  examMarkDistributions,
  studentSubjectEnrollments,
  examSchedules,
} from "@/db/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission, assertTeacherTeaches } from "@/lib/examPermissions";
import { z } from "zod";

import {
  verifyExamOwnership,
  verifyClassOwnership,
  logExamIsolationViolation,
} from "@/lib/examIsolation";
import { syncExamAttendance } from "@/lib/examAttendanceSync";

const GRADING_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TEACHER",
] as const;

const ADMIN_LOCK_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
] as const;

export interface SingleMarkEntryInput {
  studentId: string;
  marksObtained: number | null;
  componentId?: string | null;
  isAbsent?: boolean;
  isMedicalExempt?: boolean;
  remarks?: string | null;
}

export const saveMarkEntriesSchema = z.object({
  examId: z.string().uuid("Invalid examId UUID"),
  classId: z.string().uuid("Invalid classId UUID"),
  sectionId: z.string().uuid("Invalid sectionId UUID").nullable().optional(),
  subjectId: z.string().uuid("Invalid subjectId UUID"),
  entries: z
    .array(
      z.object({
        studentId: z.string().uuid("Invalid studentId UUID"),
        marksObtained: z.number().nullable().optional(),
        componentId: z.string().uuid("Invalid componentId UUID").nullable().optional(),
        isAbsent: z.boolean().optional(),
        isMedicalExempt: z.boolean().optional(),
        remarks: z.string().max(500).nullable().optional(),
      }),
    )
    .min(1, "At least one entry is required")
    .max(500, "Cannot save more than 500 entries per batch"),
});

export async function saveMarkEntries(input: {
  examId: string;
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  entries: SingleMarkEntryInput[];
}) {
  const ctx = await requireAuth(GRADING_ROLES);
  requireExamPermission(ctx.role, "exam.marks.entry");
  const school = await requireSchool(ctx);

  // 1. Zod input validation & payload bounding
  const parsed = saveMarkEntriesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "VALIDATION_FAILED",
      message: "Invalid marks entry payload",
      details: parsed.error.format(),
      count: 0,
      acceptedCount: 0,
      rejectedCount: input?.entries?.length ?? 0,
      rejected: (input?.entries ?? []).map((e) => ({
        studentId: e.studentId,
        reason: "VALIDATION_FAILED: Schema constraint violation",
      })),
    };
  }
  const validatedInput = parsed.data;

  // 2. Verify exam and class tenant boundaries
  const examVerification = await verifyExamOwnership(school.id, validatedInput.examId, ctx, "saveMarkEntries");
  if (!examVerification.success) {
    return { success: false, error: examVerification.error, message: examVerification.message };
  }

  const classVerification = await verifyClassOwnership(school.id, validatedInput.classId, ctx, "saveMarkEntries");
  if (!classVerification.success) {
    return { success: false, error: classVerification.error, message: classVerification.message };
  }

  // 3. If teacher, verify teacher is assigned to this class/subject
  if (ctx.role === "TEACHER") {
    const isAssigned = await assertTeacherTeaches({
      teacherId: ctx.userId,
      schoolId: school.id,
      role: ctx.role,
      classId: validatedInput.classId,
      subjectId: validatedInput.subjectId,
      ...(validatedInput.sectionId ? { sectionId: validatedInput.sectionId } : {}),
    });
    if (!isAssigned) {
      await logExamIsolationViolation({
        schoolId: school.id,
        userId: ctx.userId,
        userEmail: ctx.email,
        userRole: ctx.role,
        action: "WRITE",
        tableName: "mark_entries",
        recordId: `${validatedInput.examId}:${validatedInput.classId}:${validatedInput.subjectId}`,
        purposeId: "teacher_assignment_violation",
        metadata: {
          event: "TEACHER_CROSS_SUBJECT_WRITE_DENIED",
          teacherId: ctx.userId,
          classId: validatedInput.classId,
          subjectId: validatedInput.subjectId,
          examId: validatedInput.examId,
        },
      });
      return {
        success: false,
        error: "TENANT_ACCESS_DENIED",
        message: "Unauthorized: You are not assigned to grade this class and subject.",
      };
    }
  }

  // 4. Check if marks are locked for this subject
  const lock = await db.query.examMarksLocks.findFirst({
    where: and(
      eq(examMarksLocks.schoolId, school.id),
      eq(examMarksLocks.examId, validatedInput.examId),
      eq(examMarksLocks.classId, validatedInput.classId),
      eq(examMarksLocks.subjectId, validatedInput.subjectId),
    ),
  });

  if (lock?.status === "LOCKED") {
    return {
      success: false,
      message: "Marks for this subject are locked and cannot be modified without administrator approval.",
    };
  }

  // 5. Batch resolve active class students to verify class membership (single query)
  const studentIds = validatedInput.entries.map((e) => e.studentId);
  const classStudents = await db.query.students.findMany({
    where: and(
      eq(students.schoolId, school.id),
      eq(students.currentClassId, validatedInput.classId),
      eq(students.isActive, true),
      inArray(students.id, studentIds),
    ),
    columns: { id: true },
  });
  const validStudentIdSet = new Set(classStudents.map((s) => s.id));

  // 6. Check elective status and active subject enrollments
  const classSubj = await db.query.classSubjects.findFirst({
    where: and(
      eq(classSubjects.schoolId, school.id),
      eq(classSubjects.classId, validatedInput.classId),
      eq(classSubjects.subjectId, validatedInput.subjectId),
    ),
  });

  const isElective = Boolean(classSubj?.isElective);
  let enrolledStudentIdSet = new Set<string>();

  if (isElective && classSubj) {
    const enrollments = await db.query.studentSubjectEnrollments.findMany({
      where: and(
        eq(studentSubjectEnrollments.schoolId, school.id),
        eq(studentSubjectEnrollments.classSubjectId, classSubj.id),
        inArray(studentSubjectEnrollments.studentId, studentIds),
        eq(studentSubjectEnrollments.enrollmentStatus, "ACTIVE"),
        eq(studentSubjectEnrollments.isElectiveTaken, true),
      ),
      columns: { studentId: true },
    });
    enrolledStudentIdSet = new Set(enrollments.map((e) => e.studentId));
  }

  // 7. Resolve paper and component maximum marks from distributions/schedules/subjects
  const distributions = await db.query.examMarkDistributions.findMany({
    where: and(
      eq(examMarkDistributions.schoolId, school.id),
      eq(examMarkDistributions.examId, validatedInput.examId),
      eq(examMarkDistributions.classId, validatedInput.classId),
      eq(examMarkDistributions.subjectId, validatedInput.subjectId),
    ),
  });

  const distCompMap = new Map<string, number>();
  let overallDistMax: number | null = null;

  for (const d of distributions) {
    if (d.componentId) {
      distCompMap.set(d.componentId, parseFloat(d.maxMarks));
    } else {
      overallDistMax = parseFloat(d.maxMarks);
    }
  }

  const schedule = await db.query.examSchedules.findFirst({
    where: and(
      eq(examSchedules.schoolId, school.id),
      eq(examSchedules.examId, validatedInput.examId),
      eq(examSchedules.classId, validatedInput.classId),
      eq(examSchedules.subjectId, validatedInput.subjectId),
    ),
  });

  const subjectRecord = await db.query.subjects.findFirst({
    where: and(
      eq(subjects.schoolId, school.id),
      eq(subjects.id, validatedInput.subjectId),
    ),
  });

  const defaultScheduleMax = schedule?.maxMarks ? parseFloat(schedule.maxMarks) : null;
  const defaultSubjectMax = subjectRecord?.maxMarks ? parseFloat(subjectRecord.maxMarks.toString()) : 100;
  const fallbackMaxMarks = overallDistMax ?? defaultScheduleMax ?? defaultSubjectMax ?? 100;

  // 8. Validate each entry against class roster, elective enrollment, and ceiling bounds
  const acceptedEntries: Array<{
    entry: typeof validatedInput.entries[number];
    maxMarks: number;
  }> = [];
  const rejectedEntries: Array<{ studentId: string; reason: string }> = [];

  for (const entry of validatedInput.entries) {
    // Check class membership
    if (!validStudentIdSet.has(entry.studentId)) {
      rejectedEntries.push({
        studentId: entry.studentId,
        reason: "STUDENT_NOT_IN_CLASS: Student does not belong to active class roster.",
      });
      continue;
    }

    // Check elective enrollment
    if (isElective && !enrolledStudentIdSet.has(entry.studentId)) {
      rejectedEntries.push({
        studentId: entry.studentId,
        reason: "STUDENT_NOT_ENROLLED: Student is not actively enrolled in this elective subject.",
      });
      continue;
    }

    // Determine max marks for this entry
    let entryMaxMarks = fallbackMaxMarks;
    if (entry.componentId) {
      const compMax = distCompMap.get(entry.componentId);
      if (compMax !== undefined) {
        entryMaxMarks = compMax;
      }
    }

    // Bounds check for present students
    if (!entry.isAbsent && !entry.isMedicalExempt) {
      if (entry.marksObtained === null || entry.marksObtained === undefined) {
        rejectedEntries.push({
          studentId: entry.studentId,
          reason: "MARKS_REQUIRED: Marks obtained must be specified for present students.",
        });
        continue;
      }
      if (
        !Number.isFinite(entry.marksObtained) ||
        entry.marksObtained < 0 ||
        entry.marksObtained > entryMaxMarks
      ) {
        rejectedEntries.push({
          studentId: entry.studentId,
          reason: `MARKS_OUT_OF_BOUNDS: Marks obtained (${entry.marksObtained}) must be between 0 and paper maximum (${entryMaxMarks}).`,
        });
        continue;
      }
    }

    acceptedEntries.push({ entry, maxMarks: entryMaxMarks });
  }

  // 9. Perform batch upsert with max_marks populated
  for (const { entry, maxMarks } of acceptedEntries) {
    const componentIdVal = entry.componentId ?? null;
    const marksObtainedVal =
      entry.marksObtained !== null && entry.marksObtained !== undefined
        ? entry.marksObtained.toFixed(2)
        : null;
    const maxMarksVal = maxMarks.toFixed(2);

    if (componentIdVal) {
      // Upsert on (exam_id, student_id, subject_id, component_id)
      await db.execute(sql`
        INSERT INTO mark_entries (
          id, school_id, exam_id, student_id, subject_id, component_id,
          marks_obtained, max_marks, is_absent, is_medical_exempt, remarks, entered_by_id,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${school.id}, ${validatedInput.examId}, ${entry.studentId}, ${validatedInput.subjectId}, ${componentIdVal},
          ${marksObtainedVal}, ${maxMarksVal}, ${Boolean(entry.isAbsent)}, ${Boolean(entry.isMedicalExempt)}, ${entry.remarks ?? null}, ${ctx.userId},
          NOW(), NOW()
        )
        ON CONFLICT (exam_id, student_id, subject_id, component_id) WHERE component_id IS NOT NULL
        DO UPDATE SET
          marks_obtained = EXCLUDED.marks_obtained,
          max_marks = EXCLUDED.max_marks,
          is_absent = EXCLUDED.is_absent,
          is_medical_exempt = EXCLUDED.is_medical_exempt,
          remarks = EXCLUDED.remarks,
          entered_by_id = EXCLUDED.entered_by_id,
          updated_at = NOW();
      `);
    } else {
      // Upsert on (exam_id, student_id, subject_id) WHERE component_id IS NULL
      await db.execute(sql`
        INSERT INTO mark_entries (
          id, school_id, exam_id, student_id, subject_id, component_id,
          marks_obtained, max_marks, is_absent, is_medical_exempt, remarks, entered_by_id,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${school.id}, ${validatedInput.examId}, ${entry.studentId}, ${validatedInput.subjectId}, NULL,
          ${marksObtainedVal}, ${maxMarksVal}, ${Boolean(entry.isAbsent)}, ${Boolean(entry.isMedicalExempt)}, ${entry.remarks ?? null}, ${ctx.userId},
          NOW(), NOW()
        )
        ON CONFLICT (exam_id, student_id, subject_id) WHERE component_id IS NULL
        DO UPDATE SET
          marks_obtained = EXCLUDED.marks_obtained,
          max_marks = EXCLUDED.max_marks,
          is_absent = EXCLUDED.is_absent,
          is_medical_exempt = EXCLUDED.is_medical_exempt,
          remarks = EXCLUDED.remarks,
          entered_by_id = EXCLUDED.entered_by_id,
          updated_at = NOW();
      `);
    }
  }

  // 10. Synchronize exam-day absenteeism to student_attendance for accepted entries
  let attendanceSyncResult = { syncedAbsencesCount: 0, reconciledCount: 0 };
  if (acceptedEntries.length > 0) {
    attendanceSyncResult = await syncExamAttendance({
      schoolId: school.id,
      examId: validatedInput.examId,
      classId: validatedInput.classId,
      subjectId: validatedInput.subjectId,
      sectionId: validatedInput.sectionId ?? null,
      markedById: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      entries: acceptedEntries.map(({ entry }) => ({
        studentId: entry.studentId,
        marksObtained: entry.marksObtained ?? null,
        isAbsent: entry.isAbsent ?? false,
        isMedicalExempt: entry.isMedicalExempt ?? false,
        remarks: entry.remarks ?? null,
      })),
    });
  }

  try {
    revalidatePath("/exams/marks");
    revalidatePath("/teacher/grading");
  } catch {}

  return {
    success: acceptedEntries.length > 0,
    count: acceptedEntries.length,
    acceptedCount: acceptedEntries.length,
    rejectedCount: rejectedEntries.length,
    rejected: rejectedEntries,
    syncedAttendance: attendanceSyncResult,
  };
}

export async function lockMarks(input: {
  examId: string;
  classId: string;
  sectionId?: string | null;
  subjectId: string;
}) {
  const ctx = await requireAuth(ADMIN_LOCK_ROLES);
  requireExamPermission(ctx.role, "exam.marks.lock");
  const school = await requireSchool(ctx);

  const examVerification = await verifyExamOwnership(school.id, input.examId, ctx, "lockMarks");
  if (!examVerification.success) {
    return { success: false, error: examVerification.error, message: examVerification.message };
  }

  const classVerification = await verifyClassOwnership(school.id, input.classId, ctx, "lockMarks");
  if (!classVerification.success) {
    return { success: false, error: classVerification.error, message: classVerification.message };
  }

  const existing = await db.query.examMarksLocks.findFirst({
    where: and(
      eq(examMarksLocks.schoolId, school.id),
      eq(examMarksLocks.examId, input.examId),
      eq(examMarksLocks.classId, input.classId),
      eq(examMarksLocks.subjectId, input.subjectId),
    ),
  });

  if (existing) {
    await db
      .update(examMarksLocks)
      .set({
        status: "LOCKED",
        lockedById: ctx.userId,
        lockedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(examMarksLocks.id, existing.id));
  } else {
    await db.insert(examMarksLocks).values({
      schoolId: school.id,
      examId: input.examId,
      classId: input.classId,
      subjectId: input.subjectId,
      status: "LOCKED",
      lockedById: ctx.userId,
      lockedAt: new Date(),
    });
  }

  revalidatePath("/exams/marks");
  revalidatePath("/teacher/grading");
  return { success: true };
}

export async function unlockMarks(input: {
  examId: string;
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  reason: string;
}) {
  const ctx = await requireAuth(ADMIN_LOCK_ROLES);
  requireExamPermission(ctx.role, "exam.marks.unlock");
  const school = await requireSchool(ctx);

  const examVerification = await verifyExamOwnership(school.id, input.examId, ctx, "unlockMarks");
  if (!examVerification.success) {
    return { success: false, error: examVerification.error, message: examVerification.message };
  }

  const classVerification = await verifyClassOwnership(school.id, input.classId, ctx, "unlockMarks");
  if (!classVerification.success) {
    return { success: false, error: classVerification.error, message: classVerification.message };
  }

  const existing = await db.query.examMarksLocks.findFirst({
    where: and(
      eq(examMarksLocks.schoolId, school.id),
      eq(examMarksLocks.examId, input.examId),
      eq(examMarksLocks.classId, input.classId),
      eq(examMarksLocks.subjectId, input.subjectId),
    ),
  });

  if (existing) {
    await db
      .update(examMarksLocks)
      .set({
        status: "SUBMITTED",
        unlockedById: ctx.userId,
        unlockedAt: new Date(),
        unlockReason: input.reason,
        updatedAt: new Date(),
      })
      .where(eq(examMarksLocks.id, existing.id));
  } else {
    await db.insert(examMarksLocks).values({
      schoolId: school.id,
      examId: input.examId,
      classId: input.classId,
      subjectId: input.subjectId,
      status: "SUBMITTED",
      unlockedById: ctx.userId,
      unlockedAt: new Date(),
      unlockReason: input.reason,
    });
  }

  revalidatePath("/exams/marks");
  revalidatePath("/teacher/grading");
  return { success: true };
}
