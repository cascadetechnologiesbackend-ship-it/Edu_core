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
  schools,
  classes,
  auditLogs,
  examTypes,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { requireExamPermission } from "@/lib/examPermissions";
import { seedExamBoardDefaults } from "@/lib/examSeeding";
import {
  getBlueprint,
  deriveClassGroupsFromClasses,
  mapGradeLevelToClassGroup,
  computeProportionalDates,
  previewBoardTermPlan,
} from "@/lib/examBoardBlueprints";
import {
  verifyExamOwnership,
  verifyClassOwnership,
  verifyStudentOwnership,
} from "@/lib/examIsolation";
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
  requireExamPermission(ctx, "exam.setup.manage");
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

  // SEC-REF-004: Validate examTypeId belongs to current school tenant
  const validExamType = await db.query.examTypes.findFirst({
    where: and(
      eq(examTypes.id, examTypeId),
      eq(examTypes.schoolId, school.id),
    ),
  });

  if (!validExamType) {
    return {
      success: false,
      errors: { examTypeId: ["Exam type not found or does not belong to this school"] },
    };
  }

  // SEC-REF-004: Validate classIds against duplicate entries and verify tenant ownership
  const uniqueClassIds = classIds ? Array.from(new Set(classIds)) : [];
  if (classIds && uniqueClassIds.length !== classIds.length) {
    return {
      success: false,
      errors: { classIds: ["Duplicate class IDs submitted"] },
    };
  }

  for (const cid of uniqueClassIds) {
    const classCheck = await verifyClassOwnership(school.id, cid, ctx, "createExamClassScope");
    if (!classCheck.success) {
      return {
        success: false,
        errors: { classIds: [`Class ${cid} does not belong to this school or is invalid`] },
      };
    }
  }

  const activeYear = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.isActive, true),
      eq(academicYears.schoolId, school.id),
    ),
  });

  if (!activeYear) {
    return { success: false, errors: { _: ["No active academic year found"] } };
  }

  // SEC-REF-004: Atomic transaction ensures failed scope creation leaves no orphan exam
  const newExam = await db.transaction(async (tx) => {
    const [created] = await tx
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

    if (!created) {
      throw new Error("Failed to insert exam record");
    }

    if (uniqueClassIds.length > 0) {
      await tx.insert(examClassScopes).values(
        uniqueClassIds.map((classId) => ({
          examId: created.id,
          classId,
          schoolId: school.id,
        })),
      );
    }

    return created;
  });

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
  requireExamPermission(ctx, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const verification = await verifyExamOwnership(school.id, examId, ctx, "updateExam");
  if (!verification.success) {
    return { success: false, error: verification.error, message: verification.message };
  }

  if (input.classIds && input.classIds.length > 0) {
    for (const classId of input.classIds) {
      const classCheck = await verifyClassOwnership(school.id, classId, ctx, "updateExamClassScope");
      if (!classCheck.success) {
        return { success: false, error: classCheck.error, message: classCheck.message };
      }
    }
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
  requireExamPermission(ctx, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const verification = await verifyExamOwnership(school.id, examId, ctx, "deleteExam");
  if (!verification.success) {
    return { success: false, error: verification.error, message: verification.message };
  }

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
  requireExamPermission(ctx, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const examCheck = await verifyExamOwnership(school.id, input.examId, ctx, "createExamComponent");
  if (!examCheck.success) {
    return { success: false, error: examCheck.error, message: examCheck.message };
  }

  const validExamType = await db.query.examTypes.findFirst({
    where: and(
      eq(examTypes.id, input.examTypeId),
      eq(examTypes.schoolId, school.id),
    ),
  });
  if (!validExamType) {
    return { success: false, message: "Exam type does not belong to this school" };
  }

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
  requireExamPermission(ctx, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const existing = await db.query.examComponents.findFirst({
    where: and(
      eq(examComponents.id, componentId),
      eq(examComponents.schoolId, school.id),
    ),
  });
  if (!existing) {
    return { success: false, message: "Exam component not found or unauthorized" };
  }

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
  requireExamPermission(ctx, "exam.setup.manage");
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
  requireExamPermission(ctx, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const examCheck = await verifyExamOwnership(school.id, input.examId, ctx, "saveCocurricularGrade");
  if (!examCheck.success) {
    return { success: false, error: examCheck.error, message: examCheck.message };
  }

  const studentCheck = await verifyStudentOwnership(school.id, input.studentId, ctx, "saveCocurricularGrade");
  if (!studentCheck.success) {
    return { success: false, error: studentCheck.error, message: studentCheck.message };
  }

  const validArea = await db.query.cocurricularAreas.findFirst({
    where: and(
      eq(cocurricularAreas.id, input.areaId),
      eq(cocurricularAreas.schoolId, school.id),
    ),
  });
  if (!validArea) {
    return { success: false, message: "Co-curricular area does not belong to this school" };
  }

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
  requireExamPermission(ctx, "exam.setup.manage");
  const school = await requireSchool(ctx);

  if (input.classId) {
    const classCheck = await verifyClassOwnership(school.id, input.classId, ctx, "saveClassSpecificGradeRule");
    if (!classCheck.success) {
      return { success: false, error: classCheck.error, message: classCheck.message };
    }
  }

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

export async function loadBoardDefaultsForSchool(input?: {
  gradingScaleOverride?: "CBSE_9_POINT" | "PERCENTAGE" | "GPA";
}) {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const schoolRow = await db.query.schools.findFirst({
    where: eq(schools.id, school.id),
  });

  if (!schoolRow) {
    return { success: false, message: "School tenant not found" };
  }

  const schoolClasses = await db.query.classes.findMany({
    where: and(eq(classes.schoolId, school.id), isNull(classes.deletedAt)),
  });

  const activeGroups = deriveClassGroupsFromClasses(schoolClasses);

  const seedResult = await seedExamBoardDefaults(
    school.id,
    schoolRow.board,
    input?.gradingScaleOverride,
    db,
    { activeClassGroups: activeGroups },
  );

  // Audit log entry per Amendment 11
  await db.insert(auditLogs).values({
    userId: ctx.userId,
    userEmail: ctx.email,
    userRole: ctx.role,
    schoolId: school.id,
    action: "WRITE",
    tableName: "examinations",
    recordId: school.id,
    purposeId: "exam_setup",
    ipAddress: "127.0.0.1",
    userAgent: "SchoolMitra/ExamSetup",
    metadata: {
      action: "LOAD_BOARD_DEFAULTS",
      board: schoolRow.board,
      gradingScale: input?.gradingScaleOverride || null,
      examTypesInserted: seedResult.insertedExamTypes,
      gradeRulesInserted: seedResult.insertedGradeRules,
      cocurricularInserted: seedResult.insertedCocurricular,
      skipped: seedResult.skipped,
    },
  });

  revalidatePath("/exams/dashboard");
  revalidatePath("/exams/manage");

  return {
    success: true,
    message: `Board defaults loaded for ${schoolRow.board}: ${seedResult.insertedExamTypes} exam types, ${seedResult.insertedGradeRules} grade rules, and ${seedResult.insertedCocurricular} cocurricular areas inserted.`,
    stats: seedResult,
  };
}

/**
 * Previews the board term plan for the confirmation drawer (UX-P09).
 * Returns term names, proportional dates, and intersected class scopes from active classes.
 */
export async function getBoardTermPlanPreview() {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const schoolRow = await db.query.schools.findFirst({
    where: eq(schools.id, school.id),
  });
  if (!schoolRow) {
    return { success: false, message: "School not found", terms: [] };
  }

  const activeYear = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.schoolId, school.id),
      eq(academicYears.isActive, true),
    ),
  });
  if (!activeYear) {
    return {
      success: false,
      message: "No active academic year configured",
      terms: [],
    };
  }

  const schoolClasses = await db.query.classes.findMany({
    where: and(eq(classes.schoolId, school.id), isNull(classes.deletedAt)),
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  });

  const preview = previewBoardTermPlan(
    schoolRow.board,
    activeYear.startDate,
    activeYear.endDate,
    schoolClasses,
  );

  return {
    success: true,
    board: schoolRow.board,
    activeYearLabel: activeYear.label,
    terms: preview,
  };
}

/**
 * Creates examination term shells based on the school's affiliation board blueprint (Sprint S9 Layer 6).
 *
 * Implements:
 * - Amendment 1: Full context requireExamPermission(ctx, "exam.setup.manage")
 * - Amendment 2: Session-derived schoolId (never accepts client schoolId)
 * - Amendment 4: Class scopes intersect applicable_class_groups per term
 * - Amendment 5: Idempotency Key (schoolId, academicYearId, name)
 * - Amendment 6: Proportionally derived placeholder dates within academic year window
 * - Amendment 8: Explicit component mapping from blueprint (or 100% default fallback)
 * - Amendment 11: Audit log insertion (purposeId: "exam_setup")
 */
export async function createBoardTermPlan() {
  const ctx = await requireAuth(ADMIN_ROLES);
  requireExamPermission(ctx, "exam.setup.manage");
  const school = await requireSchool(ctx);

  const schoolRow = await db.query.schools.findFirst({
    where: eq(schools.id, school.id),
  });
  if (!schoolRow) {
    return { success: false, message: "School tenant not found" };
  }

  const activeYear = await db.query.academicYears.findFirst({
    where: and(
      eq(academicYears.schoolId, school.id),
      eq(academicYears.isActive, true),
    ),
  });
  if (!activeYear) {
    return {
      success: false,
      message: "No active academic year configured for this school.",
    };
  }

  const schoolClasses = await db.query.classes.findMany({
    where: and(eq(classes.schoolId, school.id), isNull(classes.deletedAt)),
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  });

  const schoolExamTypes = await db.query.examTypes.findMany({
    where: and(eq(examTypes.schoolId, school.id), eq(examTypes.isActive, true)),
  });

  const blueprint = getBlueprint(schoolRow.board);
  const termItems = blueprint.termPlan.terms;

  const createdExams: Array<{
    id: string;
    name: string;
    componentsCount: number;
    scopedClassesCount: number;
  }> = [];
  const skippedExams: Array<{ name: string; reason: string }> = [];

  for (const term of termItems) {
    // Amendment 5: Idempotency Key (schoolId, academicYearId, name)
    const existingExam = await db.query.exams.findFirst({
      where: and(
        eq(exams.schoolId, school.id),
        eq(exams.academicYearId, activeYear.id),
        eq(exams.name, term.name),
        isNull(exams.deletedAt),
      ),
    });

    if (existingExam) {
      skippedExams.push({
        name: term.name,
        reason: "Exam shell already exists for active academic year",
      });
      continue;
    }

    // Resolve primary exam type
    const primaryExamType =
      schoolExamTypes.find((et) => et.code === term.examTypeCode) ||
      schoolExamTypes.find((et) =>
        et.name.toLowerCase().includes(term.name.toLowerCase()),
      ) ||
      schoolExamTypes[0];

    if (!primaryExamType) {
      skippedExams.push({
        name: term.name,
        reason: "No active exam type available",
      });
      continue;
    }

    // Amendment 6: Proportionally Derived Placeholder Dates
    const { startDate, endDate } = computeProportionalDates(
      activeYear.startDate,
      activeYear.endDate,
      term.defaultProportion,
    );

    // Create the exam shell
    const [newExam] = await db
      .insert(exams)
      .values({
        schoolId: school.id,
        academicYearId: activeYear.id,
        examTypeId: primaryExamType.id,
        name: term.name,
        startDate,
        endDate,
        isLocked: false,
      })
      .returning();

    if (!newExam) continue;

    // Amendment 4: Term Plan Scopes Intersect applicable_class_groups
    const matchingClasses = schoolClasses.filter((c) => {
      const group = mapGradeLevelToClassGroup(c.gradeLevel || c.displayName);
      return term.applicableGroups.includes(group);
    });

    if (matchingClasses.length > 0) {
      await db.insert(examClassScopes).values(
        matchingClasses.map((cls) => ({
          schoolId: school.id,
          examId: newExam.id,
          classId: cls.id,
        })),
      );
    }

    // Amendment 8: Explicit Component Mapping on Term Shells
    let compSortOrder = 0;
    const insertedComponentTypes = new Set<string>();

    for (const cmp of term.components) {
      let compExamType = primaryExamType;
      if (cmp.examTypeCode && cmp.examTypeCode !== primaryExamType.code) {
        const found = schoolExamTypes.find((et) => et.code === cmp.examTypeCode);
        if (found) compExamType = found;
      }

      // Respect exam_components_exam_type_unique on (examId, examTypeId)
      if (insertedComponentTypes.has(compExamType.id)) {
        const alternate = schoolExamTypes.find(
          (et) => !insertedComponentTypes.has(et.id),
        );
        if (alternate) {
          compExamType = alternate;
        } else {
          continue;
        }
      }

      insertedComponentTypes.add(compExamType.id);

      await db.insert(examComponents).values({
        schoolId: school.id,
        examId: newExam.id,
        examTypeId: compExamType.id,
        displayName: cmp.name,
        sortOrder: compSortOrder++,
        weightPercent: cmp.weightPercent.toFixed(2),
        showOnReportCard: true,
      });
    }

    // If no components were added, insert default 100% component
    if (insertedComponentTypes.size === 0) {
      await db.insert(examComponents).values({
        schoolId: school.id,
        examId: newExam.id,
        examTypeId: primaryExamType.id,
        displayName: term.name,
        sortOrder: 0,
        weightPercent: "100.00",
        showOnReportCard: true,
      });
    }

    createdExams.push({
      id: newExam.id,
      name: newExam.name,
      componentsCount: Math.max(insertedComponentTypes.size, 1),
      scopedClassesCount: matchingClasses.length,
    });
  }

  // Amendment 11: Audit log entry
  await db.insert(auditLogs).values({
    userId: ctx.userId,
    userEmail: ctx.email,
    userRole: ctx.role,
    schoolId: school.id,
    action: "WRITE",
    tableName: "examinations",
    recordId: school.id,
    purposeId: "exam_setup",
    ipAddress: "127.0.0.1",
    userAgent: "SchoolMitra/ExamSetup",
    metadata: {
      action: "CREATE_BOARD_TERM_PLAN",
      board: schoolRow.board,
      academicYearId: activeYear.id,
      createdExamsCount: createdExams.length,
      skippedExamsCount: skippedExams.length,
      createdExams,
      skippedExams,
    },
  });

  revalidatePath("/exams/dashboard");
  revalidatePath("/exams/manage");

  return {
    success: true,
    message: `Provisioned ${createdExams.length} term plan shells for ${schoolRow.board} (${skippedExams.length} skipped).`,
    createdExams,
    skippedExams,
  };
}

