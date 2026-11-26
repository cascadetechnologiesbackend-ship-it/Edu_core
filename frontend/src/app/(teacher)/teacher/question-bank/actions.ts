"use server";

import { db, withTenant } from "@/db";
import {
  questionBank,
  classes,
  subjects,
  syllabusChapters,
} from "@/db/schema";
import { eq, and, desc, asc, ilike, or } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";

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
    const conditions = [eq(questionBank.schoolId, school.id)];

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
        .where(eq(classes.schoolId, school.id))
        .orderBy(asc(classes.sortOrder)),
      tx
        .select({ id: subjects.id, name: subjects.name })
        .from(subjects)
        .where(eq(subjects.schoolId, school.id))
        .orderBy(asc(subjects.name)),
      tx
        .select({
          id: syllabusChapters.id,
          title: syllabusChapters.name,
        })
        .from(syllabusChapters)
        .where(eq(syllabusChapters.schoolId, school.id))
        .orderBy(asc(syllabusChapters.sortOrder)),
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

  await withTenant(school.id, async (tx) => {
    if (input.id) {
      await tx
        .update(questionBank)
        .set(payload)
        .where(
          and(
            eq(questionBank.id, input.id),
            eq(questionBank.schoolId, school.id),
          ),
        );
    } else {
      await tx.insert(questionBank).values({
        ...payload,
        createdById: ctx.userId,
      });
    }
  });

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

  await withTenant(school.id, async (tx) => {
    await tx
      .update(questionBank)
      .set({ reviewStatus, updatedAt: new Date() })
      .where(
        and(eq(questionBank.id, id), eq(questionBank.schoolId, school.id)),
      );
  });

  revalidatePath("/teacher/question-bank");
  return { success: true };
}
