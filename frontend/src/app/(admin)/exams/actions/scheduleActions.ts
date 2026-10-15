"use server";

import { db } from "@/db";
import {
  examSchedules,
  examMarkDistributions,
  exams,
} from "@/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission } from "@/lib/examPermissions";
import { z } from "zod";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const;

const CreateScheduleSchema = z.object({
  examId: z.string().uuid("Invalid exam ID"),
  classId: z.string().uuid("Invalid class ID"),
  subjectId: z.string().uuid("Invalid subject ID"),
  examDate: z.string().min(1, "Exam date required"),
  startTime: z.string().min(1, "Start time required"),
  durationMinutes: z.number().positive().default(180),
  maxMarks: z.number().positive("Max marks must be positive"),
  passingMarks: z.number().positive("Passing marks must be positive"),
  roomNumber: z.string().optional(),
});

import {
  verifyExamOwnership,
  verifyClassOwnership,
  verifyScheduleOwnership,
} from "@/lib/examIsolation";

export async function createExamSchedule(data: z.infer<typeof CreateScheduleSchema>) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.schedule.manage");
  const school = await requireSchool(ctx);

  const parsed = CreateScheduleSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const {
    examId,
    classId,
    subjectId,
    examDate,
    startTime,
    durationMinutes,
    maxMarks,
    passingMarks,
    roomNumber,
  } = parsed.data;

  const examVerification = await verifyExamOwnership(school.id, examId, ctx, "createExamSchedule");
  if (!examVerification.success) {
    return { success: false, error: examVerification.error, message: examVerification.message };
  }

  const classVerification = await verifyClassOwnership(school.id, classId, ctx, "createExamSchedule");
  if (!classVerification.success) {
    return { success: false, error: classVerification.error, message: classVerification.message };
  }

  const [schedule] = await db
    .insert(examSchedules)
    .values({
      schoolId: school.id,
      examId,
      classId,
      subjectId,
      examDate,
      startTime,
      durationMinutes,
      maxMarks: maxMarks.toFixed(2),
      passingMarks: passingMarks.toFixed(2),
      roomNumber: roomNumber ?? null,
    })
    .returning();

  revalidatePath("/exams/schedule");
  return { success: true, schedule };
}

export async function deleteExamSchedule(scheduleId: string, examId?: string) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.schedule.manage");
  const school = await requireSchool(ctx);

  const scheduleVerification = await verifyScheduleOwnership(school.id, scheduleId, ctx, "deleteExamSchedule");
  if (!scheduleVerification.success) {
    return { success: false, error: scheduleVerification.error, message: scheduleVerification.message };
  }

  await db
    .delete(examSchedules)
    .where(and(eq(examSchedules.id, scheduleId), eq(examSchedules.schoolId, school.id)));

  if (examId) {
    revalidatePath(`/exams/${examId}`);
  }
  revalidatePath("/exams/schedule");
  return { success: true, message: "Schedule deleted successfully" };
}

export async function publishDatesheet(scheduleIds: string[]) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.schedule.manage");
  const school = await requireSchool(ctx);

  if (!scheduleIds || scheduleIds.length === 0) {
    return { success: false, message: "No schedules provided" };
  }

  await db
    .update(examSchedules)
    .set({
      datesheetPublishedAt: new Date(),
      datesheetPublishedById: ctx.userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(examSchedules.id, scheduleIds),
        eq(examSchedules.schoolId, school.id),
      ),
    );

  revalidatePath("/exams/schedule");
  revalidatePath("/portal/admit-cards");
  return { success: true };
}

export async function setMarkDistribution(input: {
  examId: string;
  classId: string;
  subjectId: string;
  componentId?: string | null;
  maxMarks: number;
  passingMarks?: number;
  sortOrder?: number;
}) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.schedule.manage");
  const school = await requireSchool(ctx);

  const examVerification = await verifyExamOwnership(school.id, input.examId, ctx, "setMarkDistribution");
  if (!examVerification.success) {
    return { success: false, error: examVerification.error, message: examVerification.message };
  }

  const classVerification = await verifyClassOwnership(school.id, input.classId, ctx, "setMarkDistribution");
  if (!classVerification.success) {
    return { success: false, error: classVerification.error, message: classVerification.message };
  }

  const componentIdVal = input.componentId ?? null;

  const existing = await db.query.examMarkDistributions.findFirst({
    where: and(
      eq(examMarkDistributions.schoolId, school.id),
      eq(examMarkDistributions.examId, input.examId),
      eq(examMarkDistributions.classId, input.classId),
      eq(examMarkDistributions.subjectId, input.subjectId),
      componentIdVal
        ? eq(examMarkDistributions.componentId, componentIdVal)
        : isNull(examMarkDistributions.componentId),
    ),
  });

  if (existing) {
    await db
      .update(examMarkDistributions)
      .set({
        maxMarks: input.maxMarks.toFixed(2),
        passingMarks: input.passingMarks?.toFixed(2) ?? (input.maxMarks * 0.33).toFixed(2),
        sortOrder: input.sortOrder ?? existing.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(examMarkDistributions.id, existing.id));
  } else {
    await db.insert(examMarkDistributions).values({
      schoolId: school.id,
      examId: input.examId,
      classId: input.classId,
      subjectId: input.subjectId,
      componentId: componentIdVal,
      maxMarks: input.maxMarks.toFixed(2),
      passingMarks: input.passingMarks?.toFixed(2) ?? (input.maxMarks * 0.33).toFixed(2),
      sortOrder: input.sortOrder ?? 0,
    });
  }

  revalidatePath("/exams/schedule");
  return { success: true };
}
