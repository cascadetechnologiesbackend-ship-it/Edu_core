"use server";

import { db } from "@/db";
import {
  exams,
  examComponents,
  examClassScopes,
  cocurricularAreas,
  cocurricularGrades,
  gradeRules,
  academicYears,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission } from "@/lib/examPermissions";
import { z } from "zod";

const ADMIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const;

const CreateExamSchema = z.object({
  name: z.string().min(2, "Name required"),
  examTypeId: z.string().uuid("Invalid exam type"),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().min(1, "End date required"),
  classIds: z.array(z.string().uuid()).optional(),
});

export async function createExam(input: z.infer<typeof CreateExamSchema> | FormData) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.setup.manage");
  const school = await requireSchool(ctx);

  let rawData: Record<string, unknown>;
  if (input instanceof FormData) {
    const classIdsRaw = input.getAll("classIds");
    rawData = {
      name: input.get("name"),
      examTypeId: input.get("examTypeId"),
      startDate: input.get("startDate"),
      endDate: input.get("endDate"),
      classIds: classIdsRaw.length > 0 ? classIdsRaw : undefined,
    };
  } else {
    rawData = input;
  }

  const parsed = CreateExamSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { name, examTypeId, startDate, endDate, classIds } = parsed.data;

  const activeYear = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.isActive, true),
      eq(academicYears.schoolId, school.id),
    ),
  });

  if (!activeYear) {
    return { success: false, errors: { _: ["No active academic year found"] } };
  }

  const [newExam] = await db
    .insert(exams)
    .values({
      schoolId: school.id,
      academicYearId: activeYear.id,
      examTypeId,
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isLocked: false,
    })
    .returning();

  if (newExam && classIds && classIds.length > 0) {
    await db.insert(examClassScopes).values(
      classIds.map((classId) => ({
        examId: newExam.id,
        classId,
        schoolId: school.id,
      })),
    );
  }

  revalidatePath("/exams/dashboard");
  revalidatePath("/exams/manage");
  return { success: true, examId: newExam?.id };
}

export async function updateExam(
  examId: string,
  input: {
    name?: string;
    startDate?: string;
    endDate?: string;
    classIds?: string[];
  },
) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const existing = await db.query.exams.findFirst({
    where: and(eq(exams.id, examId), eq(exams.schoolId, school.id), isNull(exams.deletedAt)),
  });

  if (!existing) {
    return { success: false, message: "Exam not found" };
  }

  const updateValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.name) updateValues["name"] = input.name;
  if (input.startDate) updateValues["startDate"] = new Date(input.startDate);
  if (input.endDate) updateValues["endDate"] = new Date(input.endDate);

  await db
    .update(exams)
    .set(updateValues)
    .where(and(eq(exams.id, examId), eq(exams.schoolId, school.id)));

  if (input.classIds) {
    await db
      .delete(examClassScopes)
      .where(and(eq(examClassScopes.examId, examId), eq(examClassScopes.schoolId, school.id)));

    if (input.classIds.length > 0) {
      await db.insert(examClassScopes).values(
        input.classIds.map((classId) => ({
          examId,
          classId,
          schoolId: school.id,
        })),
      );
    }
  }

  revalidatePath("/exams/dashboard");
  revalidatePath("/exams/manage");
  return { success: true };
}

export async function deleteExam(examId: string) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.setup.manage");
  const school = await requireSchool(ctx);

  await db
    .update(exams)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(exams.id, examId), eq(exams.schoolId, school.id)));

  revalidatePath("/exams/dashboard");
  revalidatePath("/exams/manage");
  return { success: true };
}

export async function createExamComponent(input: {
  examId: string;
  examTypeId: string;
  name: string;
  sortOrder?: number;
  weightagePercent?: number;
  showOnReportCard?: boolean;
}) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const [comp] = await db
    .insert(examComponents)
    .values({
      schoolId: school.id,
      examId: input.examId,
      examTypeId: input.examTypeId,
      displayName: input.name,
      sortOrder: input.sortOrder ?? 0,
      weightPercent: input.weightagePercent ? input.weightagePercent.toFixed(2) : "100.00",
      showOnReportCard: input.showOnReportCard ?? true,
    })
    .returning();

  revalidatePath("/exams/manage");
  return { success: true, component: comp };
}

export async function deleteExamComponent(componentId: string) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.setup.manage");
  const school = await requireSchool(ctx);

  await db
    .delete(examComponents)
    .where(and(eq(examComponents.id, componentId), eq(examComponents.schoolId, school.id)));

  revalidatePath("/exams/manage");
  return { success: true };
}

export async function createCocurricularArea(input: {
  name: string;
  description?: string;
}) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const [area] = await db
    .insert(cocurricularAreas)
    .values({
      schoolId: school.id,
      name: input.name,
      description: input.description ?? null,
      isActive: true,
    })
    .returning();

  revalidatePath("/exams/manage");
  return { success: true, area };
}

export async function saveCocurricularGrade(input: {
  examId: string;
  studentId: string;
  areaId: string;
  grade: string;
  remark?: string;
}) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const existing = await db.query.cocurricularGrades.findFirst({
    where: and(
      eq(cocurricularGrades.schoolId, school.id),
      eq(cocurricularGrades.examId, input.examId),
      eq(cocurricularGrades.studentId, input.studentId),
      eq(cocurricularGrades.areaId, input.areaId),
    ),
  });

  if (existing) {
    await db
      .update(cocurricularGrades)
      .set({
        grade: input.grade.toUpperCase(),
        remark: input.remark ?? null,
        gradedById: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(cocurricularGrades.id, existing.id));
  } else {
    await db.insert(cocurricularGrades).values({
      schoolId: school.id,
      examId: input.examId,
      studentId: input.studentId,
      areaId: input.areaId,
      grade: input.grade.toUpperCase(),
      remark: input.remark ?? null,
      gradedById: ctx.userId,
    });
  }

  return { success: true };
}

export async function saveClassSpecificGradeRule(input: {
  classId?: string | null;
  classGroup: "NURSERY_UKG" | "CLASS_1_5" | "CLASS_6_8" | "CLASS_9_10" | "CLASS_11_12";
  minPercent: number;
  maxPercent: number;
  grade: string;
  gradePoint: number;
  description?: string;
}) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx.role, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const [rule] = await db
    .insert(gradeRules)
    .values({
      schoolId: school.id,
      classId: input.classId ?? null,
      classGroup: input.classGroup,
      minPercent: input.minPercent.toFixed(2),
      maxPercent: input.maxPercent.toFixed(2),
      grade: input.grade.toUpperCase(),
      gradePoint: input.gradePoint.toFixed(2),
      description: input.description ?? null,
      isActive: true,
    })
    .returning();

  revalidatePath("/exams/manage");
  revalidatePath("/settings/grading");
  return { success: true, rule };
}
