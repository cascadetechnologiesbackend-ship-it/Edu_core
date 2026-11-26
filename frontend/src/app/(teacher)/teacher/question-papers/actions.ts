"use server";

import { db, withTenant } from "@/db";
import {
  questionBank,
  questionPaperBlueprints,
  questionPapers,
  questionPaperItems,
  classes,
  subjects,
  exams,
} from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";

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
    const [blueprints, papers, bankQuestions, classList, subjectList, examList] =
      await Promise.all([
        tx
          .select()
          .from(questionPaperBlueprints)
          .where(eq(questionPaperBlueprints.schoolId, school.id))
          .orderBy(desc(questionPaperBlueprints.createdAt)),
        tx
          .select()
          .from(questionPapers)
          .where(eq(questionPapers.schoolId, school.id))
          .orderBy(desc(questionPapers.updatedAt)),
        tx
          .select()
          .from(questionBank)
          .where(eq(questionBank.schoolId, school.id))
          .orderBy(desc(questionBank.updatedAt))
          .limit(150),
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

export async function createBlueprint(input: CreateBlueprintInput) {
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

  const [created] = await withTenant(school.id, async (tx) => {
    return tx
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
  });

  revalidatePath("/teacher/question-papers");
  return { success: true, blueprint: created };
}

export async function assembleQuestionPaper(input: AssemblePaperInput) {
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

  const [paper] = await withTenant(school.id, async (tx) => {
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

    return [insertedPaper];
  });

  revalidatePath("/teacher/question-papers");
  return { success: true, paper };
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

export async function submitPaperForModeration(questionPaperId: string) {
  const ctx = await requireAuth([
    "TEACHER",
    "SCHOOL_ADMIN",
    "SUPER_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  await withTenant(school.id, async (tx) => {
    await tx
      .update(questionPapers)
      .set({ status: "MODERATED", updatedAt: new Date() })
      .where(
        and(
          eq(questionPapers.id, questionPaperId),
          eq(questionPapers.schoolId, school.id),
        ),
      );
  });

  revalidatePath("/teacher/question-papers");
  return { success: true };
}
