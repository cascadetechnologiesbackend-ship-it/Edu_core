"use server";

import { db } from "@/db";
import {
  markEntries,
  examMarksLocks,
  exams,
} from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission, assertTeacherTeaches } from "@/lib/examPermissions";
import { z } from "zod";

import {
  verifyExamOwnership,
  verifyClassOwnership,
  logExamIsolationViolation,
} from "@/lib/examIsolation";

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

  // 1. Verify exam and class tenant boundaries
  const examVerification = await verifyExamOwnership(school.id, input.examId, ctx, "saveMarkEntries");
  if (!examVerification.success) {
    return { success: false, error: examVerification.error, message: examVerification.message };
  }

  const classVerification = await verifyClassOwnership(school.id, input.classId, ctx, "saveMarkEntries");
  if (!classVerification.success) {
    return { success: false, error: classVerification.error, message: classVerification.message };
  }

  // 2. If teacher, verify teacher is assigned to this class/subject
  if (ctx.role === "TEACHER") {
    const isAssigned = await assertTeacherTeaches({
      teacherId: ctx.userId,
      schoolId: school.id,
      role: ctx.role,
      classId: input.classId,
      subjectId: input.subjectId,
      ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    });
    if (!isAssigned) {
      await logExamIsolationViolation({
        schoolId: school.id,
        userId: ctx.userId,
        userEmail: ctx.email,
        userRole: ctx.role,
        action: "WRITE",
        tableName: "mark_entries",
        recordId: `${input.examId}:${input.classId}:${input.subjectId}`,
        purposeId: "teacher_assignment_violation",
        metadata: {
          event: "TEACHER_CROSS_SUBJECT_WRITE_DENIED",
          teacherId: ctx.userId,
          classId: input.classId,
          subjectId: input.subjectId,
          examId: input.examId,
        },
      });
      return {
        success: false,
        error: "TENANT_ACCESS_DENIED",
        message: "Unauthorized: You are not assigned to grade this class and subject.",
      };
    }
  }

  // 2. Check if marks are locked for this subject
  const lock = await db.query.examMarksLocks.findFirst({
    where: and(
      eq(examMarksLocks.schoolId, school.id),
      eq(examMarksLocks.examId, input.examId),
      eq(examMarksLocks.classId, input.classId),
      eq(examMarksLocks.subjectId, input.subjectId),
    ),
  });

  if (lock?.status === "LOCKED") {
    return {
      success: false,
      message: "Marks for this subject are locked and cannot be modified without administrator approval.",
    };
  }

  // 3. Perform batch upsert respecting Amendment 1 (partial unique indexes)
  for (const entry of input.entries) {
    const componentIdVal = entry.componentId ?? null;
    const marksObtainedVal = entry.marksObtained !== null && entry.marksObtained !== undefined
      ? entry.marksObtained.toFixed(2)
      : null;

    if (componentIdVal) {
      // Upsert on (exam_id, student_id, subject_id, component_id)
      await db.execute(sql`
        INSERT INTO mark_entries (
          id, school_id, exam_id, student_id, subject_id, component_id,
          marks_obtained, is_absent, is_medical_exempt, remarks, entered_by_id,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${school.id}, ${input.examId}, ${entry.studentId}, ${input.subjectId}, ${componentIdVal},
          ${marksObtainedVal}, ${Boolean(entry.isAbsent)}, ${Boolean(entry.isMedicalExempt)}, ${entry.remarks ?? null}, ${ctx.userId},
          NOW(), NOW()
        )
        ON CONFLICT (exam_id, student_id, subject_id, component_id) WHERE component_id IS NOT NULL
        DO UPDATE SET
          marks_obtained = EXCLUDED.marks_obtained,
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
          marks_obtained, is_absent, is_medical_exempt, remarks, entered_by_id,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${school.id}, ${input.examId}, ${entry.studentId}, ${input.subjectId}, NULL,
          ${marksObtainedVal}, ${Boolean(entry.isAbsent)}, ${Boolean(entry.isMedicalExempt)}, ${entry.remarks ?? null}, ${ctx.userId},
          NOW(), NOW()
        )
        ON CONFLICT (exam_id, student_id, subject_id) WHERE component_id IS NULL
        DO UPDATE SET
          marks_obtained = EXCLUDED.marks_obtained,
          is_absent = EXCLUDED.is_absent,
          is_medical_exempt = EXCLUDED.is_medical_exempt,
          remarks = EXCLUDED.remarks,
          entered_by_id = EXCLUDED.entered_by_id,
          updated_at = NOW();
      `);
    }
  }

  revalidatePath("/exams/marks");
  revalidatePath("/teacher/grading");
  return { success: true, count: input.entries.length };
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
