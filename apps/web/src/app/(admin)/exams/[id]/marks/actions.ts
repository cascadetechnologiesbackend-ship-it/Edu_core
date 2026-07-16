"use server";

import { db } from "@/db";
import { markEntries, exams, gradeRules, students, classes, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { calculateGrade, type GradeRule } from "@/lib/gradeEngine";
import { gradeToClassGroup } from "@/lib/pdf/ReportCardPDF";
import { z } from "zod";

const MarkEntrySchema = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  marksObtained: z.number().nullable(),
  maxMarks: z.number().positive(),
  isAbsent: z.boolean(),
  isMedicalExempt: z.boolean(),
});

interface SaveMarksInput {
  examId: string;
  entries: z.infer<typeof MarkEntrySchema>[];
}

export async function saveMarkEntries(input: SaveMarksInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });
    if (!dbUser) {
      return {
        success: false,
        message: "Your session is invalid or stale (the database may have been re-seeded). Please sign out and sign back in.",
      };
    }

    const exam = await db.query.exams.findFirst({
      where: eq(exams.id, input.examId),
    });

    if (!exam) return { success: false, message: "Exam not found" };
    if (exam.isLocked) return { success: false, message: "Exam is locked. Cannot enter marks." };

    for (const entry of input.entries) {
      const parsed = MarkEntrySchema.safeParse(entry);
      if (!parsed.success) continue;

      const { studentId, subjectId, marksObtained, maxMarks, isAbsent, isMedicalExempt } = parsed.data;

      // Fetch grade rules for this student
      const student = await db.query.students.findFirst({
        where: eq(students.id, studentId),
      });

      let grade: string | null = null;
      let gradePoint: string | null = null;

      if (student?.currentClassId) {
        const studentClass = await db.query.classes.findFirst({
          where: eq(classes.id, student.currentClassId),
        });
        const classGroup = studentClass ? gradeToClassGroup(studentClass.gradeLevel) : "CLASS_1_5";

        const dbRules = await db.query.gradeRules.findMany({
          where: and(
            eq(gradeRules.schoolId, exam.schoolId),
            eq(gradeRules.classGroup, classGroup),
          ),
        });

        if (dbRules.length > 0) {
          const engineRules: GradeRule[] = dbRules.map((r) => ({
            minPercent: parseFloat(r.minPercent),
            maxPercent: parseFloat(r.maxPercent),
            grade: r.grade,
            gradePoint: parseFloat(r.gradePoint),
            description: r.description,
          }));

          const result = calculateGrade(
            { marksObtained, maxMarks, isAbsent, isMedicalExempt },
            engineRules,
          );
          grade = result.grade;
          gradePoint = result.gradePoint.toFixed(2);
        }
      }

      const existing = await db.query.markEntries.findFirst({
        where: and(
          eq(markEntries.examId, input.examId),
          eq(markEntries.studentId, studentId),
          eq(markEntries.subjectId, subjectId),
        ),
      });

      const values = {
        schoolId: exam.schoolId,
        examId: input.examId,
        studentId,
        subjectId,
        marksObtained: marksObtained?.toFixed(2) ?? null,
        maxMarks: maxMarks.toFixed(2),
        isAbsent,
        isMedicalExempt,
        grade,
        gradePoint: gradePoint ?? null,
        status: "SUBMITTED" as const,
        enteredById: session.user.id,
        enteredAt: new Date(),
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(markEntries).set(values).where(eq(markEntries.id, existing.id));
      } else {
        await db.insert(markEntries).values(values);
      }
    }

    revalidatePath(`/exams/${input.examId}/marks`);
    return { success: true, message: `Saved ${input.entries.length} mark entries` };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[saveMarkEntries]", message);
    return { success: false, message };
  }
}
