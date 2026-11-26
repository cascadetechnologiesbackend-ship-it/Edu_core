"use server";

import { withTenant } from "@/db";
import {
  questionBank,
  questionPaperBlueprints,
  questionPapers,
  questionPaperItems,
  classes,
  subjects,
  exams,
} from "@/db/schema";
import { eq, and, desc, asc, or, inArray } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { TeacherScopeError } from "@/lib/teacherEventEngine/scopeResolver";
import { revalidatePath } from "next/cache";
import {
  ADMIN_MODERATION_ROLES,
  resolveTeacherClassSubjectScope,
  writeQuestionAuditLog,
} from "../question-bank/scopeHelper";

export interface BlueprintSection {
  label: string;
  questionCount: number;
  marksPerQuestion: number;
}

export interface CreateBlueprintInput {
  name: string;
  examId?: string | null;
  classId: string;
  subjectId: string;
  totalMarks: number;
  durationMinutes: number;
  sections: BlueprintSection[];
}

export interface AssemblePaperInput {
  title: string;
  blueprintId?: string | null;
  examId?: string | null;
  classId: string;
  subjectId: string;
  setCode: "A" | "B" | "C";
  totalMarks: number;
  durationMinutes: number;
  items: {
    questionId: string;
    sectionLabel: string;
    orderIndex: number;
    marks: number;
    isOptional?: boolean;
  }[];
}

export async function getQuestionPapersWorkspaceData() {
  const ctx = await requireAuth([
    "TEACHER",
    "SCHOOL_ADMIN",
    "SUPER_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  return withTenant(school.id, async (tx) => {
    let teacherScope: Awaited<
      ReturnType<typeof resolveTeacherClassSubjectScope>
    > | null = null;

    if (ctx.role === "TEACHER") {
      teacherScope = await resolveTeacherClassSubjectScope(
        tx,
        ctx.userId,
        school.id,
      );

      if (teacherScope.authorizedPairs.length === 0) {
        return {
          blueprints: [],
          papers: [],
          bankQuestions: [],
          classes: [],
          subjects: [],
          exams: [],
        };
      }
    }

    const blueprintWhere = teacherScope
      ? and(
          eq(questionPaperBlueprints.schoolId, school.id),
          or(
            ...teacherScope.authorizedPairs.map((pair) =>
              and(
                eq(questionPaperBlueprints.classId, pair.classId),
                eq(questionPaperBlueprints.subjectId, pair.subjectId),
              )!,
            ),
          )!,
        )
      : eq(questionPaperBlueprints.schoolId, school.id);

    const paperWhere = teacherScope
      ? and(
          eq(questionPapers.schoolId, school.id),
          or(
            ...teacherScope.authorizedPairs.map((pair) =>
              and(
                eq(questionPapers.classId, pair.classId),
                eq(questionPapers.subjectId, pair.subjectId),
              )!,
            ),
          )!,
        )
      : eq(questionPapers.schoolId, school.id);

    const bankWhere = teacherScope
      ? and(
          eq(questionBank.schoolId, school.id),
          or(
            ...teacherScope.authorizedPairs.map((pair) =>
              and(
                eq(questionBank.classId, pair.classId),
                eq(questionBank.subjectId, pair.subjectId),
              )!,
            ),
          )!,
          or(
            eq(questionBank.createdById, ctx.userId),
            eq(questionBank.reviewStatus, "APPROVED"),
          )!,
        )
      : eq(questionBank.schoolId, school.id);

    const classWhere = teacherScope
      ? and(
          eq(classes.schoolId, school.id),
          inArray(classes.id, teacherScope.authorizedClassIds),
        )
      : eq(classes.schoolId, school.id);

    const subjectWhere = teacherScope
      ? and(
          eq(subjects.schoolId, school.id),
          inArray(subjects.id, teacherScope.authorizedSubjectIds),
        )
      : eq(subjects.schoolId, school.id);

    const [blueprints, papers, bankQuestions, classList, subjectList, examList] =
      await Promise.all([
        tx
          .select()
          .from(questionPaperBlueprints)
          .where(blueprintWhere)
          .orderBy(desc(questionPaperBlueprints.createdAt)),
        tx
          .select()
          .from(questionPapers)
          .where(paperWhere)
          .orderBy(desc(questionPapers.updatedAt)),
        tx
          .select()
          .from(questionBank)
          .where(bankWhere)
          .orderBy(desc(questionBank.updatedAt))
          .limit(150),
        tx
          .select({ id: classes.id, name: classes.displayName })
          .from(classes)
          .where(classWhere)
          .orderBy(asc(classes.sortOrder)),
        tx
          .select({ id: subjects.id, name: subjects.name })
          .from(subjects)
          .where(subjectWhere)
          .orderBy(asc(subjects.name)),
        tx
          .select({ id: exams.id, name: exams.name })
          .from(exams)
          .where(eq(exams.schoolId, school.id))
          .orderBy(desc(exams.createdAt)),
      ]);

    return {
      blueprints,
      papers,
      bankQuestions,
      classes: classList,
      subjects: subjectList,
      exams: examList,
    };
  });
}

export async function saveBlueprint(input: CreateBlueprintInput) {
  const ctx = await requireAuth([
    "TEACHER",
    "SCHOOL_ADMIN",
    "SUPER_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  if (!input.name.trim() || !input.classId || !input.subjectId) {
    return {
      success: false,
      error: "Blueprint name, class, and subject are required.",
    };
  }
  if (!Number.isFinite(input.totalMarks) || input.totalMarks <= 0) {
    return { success: false, error: "Total marks must be greater than 0." };
  }

  const result = await withTenant(school.id, async (tx) => {
    if (ctx.role === "TEACHER") {
      const teacherScope = await resolveTeacherClassSubjectScope(
        tx,
        ctx.userId,
        school.id,
      );
      if (
        !teacherScope.authorizedPairKeys.has(
          `${input.classId}:${input.subjectId}`,
        )
      ) {
        return {
          success: false as const,
          error:
            "Forbidden: You are not assigned to teach this class and subject.",
        };
      }
    }

    const [created] = await tx
      .insert(questionPaperBlueprints)
      .values({
        schoolId: school.id,
        examId: input.examId || null,
        classId: input.classId,
        subjectId: input.subjectId,
        name: input.name.trim(),
        totalMarks: input.totalMarks,
        durationMinutes: input.durationMinutes || 180,
        sectionsJson: input.sections,
        createdById: ctx.userId,
      })
      .returning();

    await writeQuestionAuditLog(tx, {
      userId: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      schoolId: school.id,
      tableName: "question_paper_blueprints",
      recordId: created?.id ?? null,
      purposeId: "question_paper_blueprint_create",
      metadata: {
        classId: input.classId,
        subjectId: input.subjectId,
        totalMarks: input.totalMarks,
      },
    });

    return { success: true as const, blueprint: created };
  });

  if (!result.success) {
    return result;
  }

  revalidatePath("/teacher/question-papers");
  return result;
}

export async function createBlueprint(input: CreateBlueprintInput) {
  return saveBlueprint(input);
}

export async function saveQuestionPaper(input: AssemblePaperInput) {
  const ctx = await requireAuth([
    "TEACHER",
    "SCHOOL_ADMIN",
    "SUPER_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  if (!input.title.trim() || !input.classId || !input.subjectId) {
    return {
      success: false,
      error: "Paper title, class, and subject are required.",
    };
  }
  if (!input.items.length) {
    return {
      success: false,
      error: "Add at least one question to assemble the paper.",
    };
  }

  // Duplicate-question prevention
  const seen = new Set<string>();
  for (const item of input.items) {
    if (seen.has(item.questionId)) {
      return {
        success: false,
        error: "Duplicate question detected. Each question can appear only once.",
      };
    }
    seen.add(item.questionId);
  }

  // Total-marks validation (sum of non-optional items must match paper totalMarks)
  const assembledMarks = input.items
    .filter((i) => !i.isOptional)
    .reduce((sum, i) => sum + Number(i.marks), 0);

  if (Math.abs(assembledMarks - input.totalMarks) > 0.01) {
    return {
      success: false,
      error: `Total marks mismatch: selected non-optional questions sum to ${assembledMarks}, expected ${input.totalMarks}.`,
    };
  }

  const result = await withTenant(school.id, async (tx) => {
    if (ctx.role === "TEACHER") {
      const teacherScope = await resolveTeacherClassSubjectScope(
        tx,
        ctx.userId,
        school.id,
      );
      if (
        !teacherScope.authorizedPairKeys.has(
          `${input.classId}:${input.subjectId}`,
        )
      ) {
        return {
          success: false as const,
          error:
            "Forbidden: You are not assigned to teach this class and subject.",
        };
      }
    }

    if (input.blueprintId) {
      const [blueprint] = await tx
        .select({
          id: questionPaperBlueprints.id,
          classId: questionPaperBlueprints.classId,
          subjectId: questionPaperBlueprints.subjectId,
          totalMarks: questionPaperBlueprints.totalMarks,
        })
        .from(questionPaperBlueprints)
        .where(
          and(
            eq(questionPaperBlueprints.id, input.blueprintId),
            eq(questionPaperBlueprints.schoolId, school.id),
          ),
        )
        .limit(1);

      if (!blueprint) {
        return {
          success: false as const,
          error: "Selected blueprint not found.",
        };
      }

      if (
        blueprint.classId !== input.classId ||
        blueprint.subjectId !== input.subjectId
      ) {
        return {
          success: false as const,
          error:
            "Paper class and subject must match the selected blueprint.",
        };
      }

      if (
        Math.abs(assembledMarks - blueprint.totalMarks) > 0.01 ||
        Math.abs(input.totalMarks - blueprint.totalMarks) > 0.01
      ) {
        return {
          success: false as const,
          error: `Total marks mismatch against blueprint: expected ${blueprint.totalMarks}, got ${assembledMarks}.`,
        };
      }
    }

    const questionIds = Array.from(seen);
    const validQuestions = await tx
      .select({ id: questionBank.id })
      .from(questionBank)
      .where(
        and(
          eq(questionBank.schoolId, school.id),
          inArray(questionBank.id, questionIds),
        ),
      );

    if (validQuestions.length !== questionIds.length) {
      return {
        success: false as const,
        error: "One or more selected questions were not found in this school.",
      };
    }

    const [insertedPaper] = await tx
      .insert(questionPapers)
      .values({
        schoolId: school.id,
        examId: input.examId || null,
        blueprintId: input.blueprintId || null,
        classId: input.classId,
        subjectId: input.subjectId,
        title: input.title.trim(),
        setCode: input.setCode,
        totalMarks: input.totalMarks,
        durationMinutes: input.durationMinutes || 180,
        status: "DRAFT",
        createdById: ctx.userId,
      })
      .returning();

    if (!insertedPaper) {
      throw new Error("Failed to create question paper.");
    }

    await tx.insert(questionPaperItems).values(
      input.items.map((item, idx) => ({
        schoolId: school.id,
        questionPaperId: insertedPaper.id,
        questionId: item.questionId,
        sectionLabel: item.sectionLabel || "Section A",
        orderIndex: item.orderIndex ?? idx + 1,
        marks: String(item.marks),
        isOptional: Boolean(item.isOptional),
      })),
    );

    await writeQuestionAuditLog(tx, {
      userId: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      schoolId: school.id,
      tableName: "question_papers",
      recordId: insertedPaper.id,
      purposeId: "question_paper_create",
      metadata: {
        classId: input.classId,
        subjectId: input.subjectId,
        blueprintId: input.blueprintId ?? null,
        totalMarks: input.totalMarks,
        itemCount: input.items.length,
      },
    });

    return { success: true as const, paper: insertedPaper };
  });

  if (!result.success) {
    return result;
  }

  revalidatePath("/teacher/question-papers");
  return result;
}

export async function assembleQuestionPaper(input: AssemblePaperInput) {
  return saveQuestionPaper(input);
}

export async function getAnswerKeyPreview(questionPaperId: string) {
  const ctx = await requireAuth([
    "TEACHER",
    "SCHOOL_ADMIN",
    "SUPER_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  return withTenant(school.id, async (tx) => {
    const [paper] = await tx
      .select({
        id: questionPapers.id,
        classId: questionPapers.classId,
        subjectId: questionPapers.subjectId,
      })
      .from(questionPapers)
      .where(
        and(
          eq(questionPapers.id, questionPaperId),
          eq(questionPapers.schoolId, school.id),
        ),
      )
      .limit(1);

    if (!paper) {
      return [];
    }

    if (ctx.role === "TEACHER") {
      const teacherScope = await resolveTeacherClassSubjectScope(
        tx,
        ctx.userId,
        school.id,
      );
      if (
        !teacherScope.authorizedPairKeys.has(
          `${paper.classId}:${paper.subjectId}`,
        )
      ) {
        throw new TeacherScopeError(
          "Forbidden: You are not assigned to teach this class and subject.",
          403,
        );
      }
    }

    const items = await tx
      .select({
        id: questionPaperItems.id,
        sectionLabel: questionPaperItems.sectionLabel,
        orderIndex: questionPaperItems.orderIndex,
        marks: questionPaperItems.marks,
        isOptional: questionPaperItems.isOptional,
        questionText: questionBank.questionText,
        questionType: questionBank.questionType,
        correctAnswer: questionBank.correctAnswer,
        markingScheme: questionBank.markingScheme,
      })
      .from(questionPaperItems)
      .innerJoin(
        questionBank,
        eq(questionPaperItems.questionId, questionBank.id),
      )
      .where(
        and(
          eq(questionPaperItems.questionPaperId, questionPaperId),
          eq(questionPaperItems.schoolId, school.id),
        ),
      )
      .orderBy(asc(questionPaperItems.orderIndex));

    return items;
  });
}

export async function submitQuestionPaperForModeration(
  questionPaperId: string,
  targetStatus: "MODERATED" | "APPROVED" | "LOCKED" = "MODERATED",
) {
  const ctx = await requireAuth([
    "TEACHER",
    "SCHOOL_ADMIN",
    "SUPER_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  if (
    (targetStatus === "APPROVED" || targetStatus === "LOCKED") &&
    !ADMIN_MODERATION_ROLES.has(ctx.role)
  ) {
    return {
      success: false,
      error:
        "Forbidden: Only School Admin, Principal, or Super Admin can approve or lock question papers.",
    };
  }

  const result = await withTenant(school.id, async (tx) => {
    const [paper] = await tx
      .select({
        id: questionPapers.id,
        classId: questionPapers.classId,
        subjectId: questionPapers.subjectId,
        status: questionPapers.status,
      })
      .from(questionPapers)
      .where(
        and(
          eq(questionPapers.id, questionPaperId),
          eq(questionPapers.schoolId, school.id),
        ),
      )
      .limit(1);

    if (!paper) {
      return {
        success: false as const,
        error: "Question paper not found.",
      };
    }

    if (ctx.role === "TEACHER") {
      const teacherScope = await resolveTeacherClassSubjectScope(
        tx,
        ctx.userId,
        school.id,
      );
      if (
        !teacherScope.authorizedPairKeys.has(
          `${paper.classId}:${paper.subjectId}`,
        )
      ) {
        return {
          success: false as const,
          error:
            "Forbidden: You are not assigned to teach this class and subject.",
        };
      }

      if (paper.status === "APPROVED" || paper.status === "LOCKED") {
        return {
          success: false as const,
          error:
            "Forbidden: Approved or locked question papers cannot be modified by teachers.",
        };
      }
    }

    const updateValues: {
      status: "MODERATED" | "APPROVED" | "LOCKED";
      updatedAt: Date;
      approvedById?: string;
      approvedAt?: Date;
    } = {
      status: targetStatus,
      updatedAt: new Date(),
    };

    if (targetStatus === "APPROVED") {
      updateValues.approvedById = ctx.userId;
      updateValues.approvedAt = new Date();
    }

    await tx
      .update(questionPapers)
      .set(updateValues)
      .where(
        and(
          eq(questionPapers.id, questionPaperId),
          eq(questionPapers.schoolId, school.id),
        ),
      );

    await writeQuestionAuditLog(tx, {
      userId: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      schoolId: school.id,
      tableName: "question_papers",
      recordId: questionPaperId,
      purposeId: "question_paper_moderation",
      metadata: {
        previousStatus: paper.status,
        newStatus: targetStatus,
      },
    });

    return { success: true as const };
  });

  if (!result.success) {
    return result;
  }

  revalidatePath("/teacher/question-papers");
  return { success: true };
}

export async function submitPaperForModeration(
  questionPaperId: string,
  targetStatus: "MODERATED" | "APPROVED" | "LOCKED" = "MODERATED",
) {
  return submitQuestionPaperForModeration(questionPaperId, targetStatus);
}
