"use server";

import { withTenant } from "@/db";
import {
  questionBank,
  classes,
  subjects,
  syllabusChapters,
  syllabusUnits,
} from "@/db/schema";
import { eq, and, desc, asc, ilike, or, inArray } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";
import {
  ADMIN_MODERATION_ROLES,
  resolveTeacherClassSubjectScope,
  writeQuestionAuditLog,
} from "./scopeHelper";

export type QuestionTypeValue =
  | "MCQ"
  | "MSQ"
  | "TRUE_FALSE"
  | "FILL_BLANK"
  | "MATCH"
  | "VSA"
  | "SA"
  | "LA"
  | "CASE_BASED"
  | "SOURCE_BASED"
  | "DIAGRAM"
  | "NUMERICAL"
  | "PRACTICAL";

export type DifficultyValue = "EASY" | "MEDIUM" | "HARD";
export type CognitiveLevelValue =
  | "REMEMBER"
  | "UNDERSTAND"
  | "APPLY"
  | "ANALYZE"
  | "EVALUATE"
  | "CREATE";
export type ReviewStatusValue = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface QuestionBankFilters {
  subjectId?: string | undefined;
  chapterId?: string | undefined;
  questionType?: QuestionTypeValue | "" | undefined;
  difficulty?: DifficultyValue | "" | undefined;
  competencyTag?: string | undefined;
  reviewStatus?: ReviewStatusValue | "" | undefined;
  search?: string | undefined;
}

export interface SaveQuestionInput {
  id?: string | undefined;
  board?: string;
  classId: string;
  subjectId: string;
  syllabusChapterId?: string | null;
  learningOutcome?: string;
  questionType: QuestionTypeValue;
  questionText: string;
  optionsJson?: string[];
  correctAnswer?: string;
  markingScheme?: string;
  explanation?: string;
  maxMarks: number;
  difficulty: DifficultyValue;
  cognitiveLevel: CognitiveLevelValue;
  competencyTag?: string;
  language?: string;
  reviewStatus?: ReviewStatusValue;
}

export async function getQuestionBankData(filters: QuestionBankFilters = {}) {
  const ctx = await requireAuth([
    "TEACHER",
    "SCHOOL_ADMIN",
    "SUPER_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  return withTenant(school.id, async (tx) => {
    let allowedClassIds: string[] | null = null;
    let allowedSubjectIds: string[] | null = null;
    const conditions = [eq(questionBank.schoolId, school.id)];

    if (ctx.role === "TEACHER") {
      const scope = await resolveTeacherScope(ctx.userId, {
        tx,
        schoolId: school.id,
      });
      const pairs = scope.teachingSections.map((ts) => ({
        classId: ts.classId,
        subjectId: ts.subjectId,
      }));
      if (pairs.length === 0) {
        return { questions: [], classes: [], subjects: [], chapters: [] };
      }
      allowedClassIds = Array.from(new Set(pairs.map((p) => p.classId)));
      allowedSubjectIds = Array.from(new Set(pairs.map((p) => p.subjectId)));
      conditions.push(
        or(
          ...pairs.map((p) =>
            and(
              eq(questionBank.classId, p.classId),
              eq(questionBank.subjectId, p.subjectId),
            ),
          ),
        )!,
      );
    }

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
          questions: [],
          classes: [],
          subjects: [],
          chapters: [],
        };
      }

      const pairConditions = teacherScope.authorizedPairs.map((pair) =>
        and(
          eq(questionBank.classId, pair.classId),
          eq(questionBank.subjectId, pair.subjectId),
        )!,
      );
      conditions.push(or(...pairConditions)!);

      // Teachers cannot see another teacher's DRAFT/REJECTED/SUBMITTED questions
      conditions.push(
        or(
          eq(questionBank.createdById, ctx.userId),
          eq(questionBank.reviewStatus, "APPROVED"),
        )!,
      );
    }

    if (filters.subjectId) {
      conditions.push(eq(questionBank.subjectId, filters.subjectId));
    }
    if (filters.chapterId) {
      conditions.push(eq(questionBank.syllabusChapterId, filters.chapterId));
    }
    if (filters.questionType) {
      conditions.push(eq(questionBank.questionType, filters.questionType));
    }
    if (filters.difficulty) {
      conditions.push(eq(questionBank.difficulty, filters.difficulty));
    }
    if (filters.competencyTag) {
      conditions.push(
        ilike(questionBank.competencyTag, `%${filters.competencyTag}%`),
      );
    }
    if (filters.reviewStatus) {
      conditions.push(eq(questionBank.reviewStatus, filters.reviewStatus));
    }
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(questionBank.questionText, q),
          ilike(questionBank.learningOutcome, q),
        )!,
      );
    }

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

    const chapterQuery = teacherScope
      ? tx
          .select({
            id: syllabusChapters.id,
            title: syllabusChapters.name,
          })
          .from(syllabusChapters)
          .innerJoin(
            syllabusUnits,
            eq(syllabusChapters.unitId, syllabusUnits.id),
          )
          .where(
            and(
              eq(syllabusChapters.schoolId, school.id),
              eq(syllabusUnits.schoolId, school.id),
              inArray(
                syllabusUnits.classSubjectId,
                teacherScope.authorizedClassSubjectIds,
              ),
            ),
          )
          .orderBy(asc(syllabusChapters.sortOrder))
      : tx
          .select({
            id: syllabusChapters.id,
            title: syllabusChapters.name,
          })
          .from(syllabusChapters)
          .where(eq(syllabusChapters.schoolId, school.id))
          .orderBy(asc(syllabusChapters.sortOrder));

    const [questions, classList, subjectList, chapterList] = await Promise.all([
      tx
        .select()
        .from(questionBank)
        .where(and(...conditions))
        .orderBy(desc(questionBank.updatedAt))
        .limit(100),
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
      chapterQuery,
    ]);

    return {
      questions,
      classes: classList,
      subjects: subjectList,
      chapters: chapterList,
    };
  });
}

export async function saveQuestionBankItem(input: SaveQuestionInput) {
  const ctx = await requireAuth([
    "TEACHER",
    "SCHOOL_ADMIN",
    "SUPER_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  if (!input.classId || !input.subjectId || !input.questionText.trim()) {
    return {
      success: false,
      error: "Class, Subject, and Question Text are required.",
    };
  }
  if (!Number.isFinite(input.maxMarks) || input.maxMarks <= 0) {
    return { success: false, error: "Max marks must be greater than 0." };
  }

  if (
    ctx.role === "TEACHER" &&
    (input.reviewStatus === "APPROVED" || input.reviewStatus === "REJECTED")
  ) {
    return {
      success: false,
      error:
        "Forbidden: Only School Admin, Principal, or Super Admin can approve or reject questions.",
    };
  }

  const payload = {
    schoolId: school.id,
    board: input.board?.trim() || null,
    classId: input.classId,
    subjectId: input.subjectId,
    syllabusChapterId: input.syllabusChapterId || null,
    learningOutcome: input.learningOutcome?.trim() || null,
    questionType: input.questionType,
    questionText: input.questionText.trim(),
    optionsJson:
      input.optionsJson && input.optionsJson.length > 0
        ? input.optionsJson.filter((o) => o.trim().length > 0)
        : null,
    correctAnswer: input.correctAnswer?.trim() || null,
    markingScheme: input.markingScheme?.trim() || null,
    explanation: input.explanation?.trim() || null,
    maxMarks: String(input.maxMarks),
    difficulty: input.difficulty,
    cognitiveLevel: input.cognitiveLevel,
    competencyTag: input.competencyTag?.trim() || null,
    language: input.language?.trim() || "en",
    reviewStatus: input.reviewStatus ?? "DRAFT",
    updatedAt: new Date(),
  };

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

    if (input.id) {
      const [existing] = await tx
        .select({
          id: questionBank.id,
          createdById: questionBank.createdById,
          reviewStatus: questionBank.reviewStatus,
        })
        .from(questionBank)
        .where(
          and(
            eq(questionBank.id, input.id),
            eq(questionBank.schoolId, school.id),
          ),
        )
        .limit(1);

      if (!existing) {
        return {
          success: false as const,
          error: "Question not found.",
        };
      }

      if (ctx.role === "TEACHER") {
        if (existing.createdById !== ctx.userId) {
          return {
            success: false as const,
            error: "Forbidden: You can only edit your own questions.",
          };
        }
        if (existing.reviewStatus === "APPROVED") {
          return {
            success: false as const,
            error: "Forbidden: Approved questions cannot be edited.",
          };
        }
      }

      await tx
        .update(questionBank)
        .set(payload)
        .where(
          and(
            eq(questionBank.id, input.id),
            eq(questionBank.schoolId, school.id),
          ),
        );

      await writeQuestionAuditLog(tx, {
        userId: ctx.userId,
        userEmail: ctx.email,
        userRole: ctx.role,
        schoolId: school.id,
        tableName: "question_bank",
        recordId: input.id,
        purposeId: "question_bank_update",
        metadata: {
          operation: "UPDATE",
          classId: input.classId,
          subjectId: input.subjectId,
          reviewStatus: payload.reviewStatus,
        },
      });

      return { success: true as const };
    }

    const [inserted] = await tx
      .insert(questionBank)
      .values({
        ...payload,
        createdById: ctx.userId,
      })
      .returning({ id: questionBank.id });

    await writeQuestionAuditLog(tx, {
      userId: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      schoolId: school.id,
      tableName: "question_bank",
      recordId: inserted?.id ?? null,
      purposeId: "question_bank_create",
      metadata: {
        operation: "CREATE",
        classId: input.classId,
        subjectId: input.subjectId,
        reviewStatus: payload.reviewStatus,
      },
    });

    return { success: true as const };
  });

  if (!result.success) {
    return result;
  }

  revalidatePath("/teacher/question-bank");
  return { success: true };
}

export async function updateQuestionReviewStatus(
  id: string,
  reviewStatus: ReviewStatusValue,
) {
  const ctx = await requireAuth([
    "TEACHER",
    "SCHOOL_ADMIN",
    "SUPER_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  if (
    (reviewStatus === "APPROVED" || reviewStatus === "REJECTED") &&
    !ADMIN_MODERATION_ROLES.has(ctx.role)
  ) {
    return {
      success: false,
      error:
        "Forbidden: Only School Admin, Principal, or Super Admin can approve or reject questions.",
    };
  }

  const result = await withTenant(school.id, async (tx) => {
    const [existing] = await tx
      .select({
        id: questionBank.id,
        createdById: questionBank.createdById,
        reviewStatus: questionBank.reviewStatus,
        classId: questionBank.classId,
        subjectId: questionBank.subjectId,
      })
      .from(questionBank)
      .where(and(eq(questionBank.id, id), eq(questionBank.schoolId, school.id)))
      .limit(1);

    if (!existing) {
      return { success: false as const, error: "Question not found." };
    }

    if (ctx.role === "TEACHER") {
      const teacherScope = await resolveTeacherClassSubjectScope(
        tx,
        ctx.userId,
        school.id,
      );
      if (
        !teacherScope.authorizedPairKeys.has(
          `${existing.classId}:${existing.subjectId}`,
        )
      ) {
        return {
          success: false as const,
          error:
            "Forbidden: You are not assigned to teach this class and subject.",
        };
      }
      if (existing.createdById !== ctx.userId) {
        return {
          success: false as const,
          error: "Forbidden: You can only update status on your own questions.",
        };
      }
      if (existing.reviewStatus === "APPROVED") {
        return {
          success: false as const,
          error: "Forbidden: Approved questions cannot be modified.",
        };
      }
    }

    await tx
      .update(questionBank)
      .set({ reviewStatus, updatedAt: new Date() })
      .where(and(eq(questionBank.id, id), eq(questionBank.schoolId, school.id)));

    await writeQuestionAuditLog(tx, {
      userId: ctx.userId,
      userEmail: ctx.email,
      userRole: ctx.role,
      schoolId: school.id,
      tableName: "question_bank",
      recordId: id,
      purposeId: "question_bank_review_status",
      metadata: {
        previousStatus: existing.reviewStatus,
        newStatus: reviewStatus,
      },
    });

    return { success: true as const };
  });

  if (!result.success) {
    return result;
  }

  revalidatePath("/teacher/question-bank");
  return { success: true };
}
