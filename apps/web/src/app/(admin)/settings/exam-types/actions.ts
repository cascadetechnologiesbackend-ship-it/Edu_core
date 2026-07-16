"use server";

import { db } from "@/db";
import { examTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { z } from "zod";

const CreateExamTypeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().min(1, "Code is required"),
  examType: z.enum(["UNIT_TEST", "HALF_YEARLY", "ANNUAL", "PRE_BOARD"]),
  weightagePercent: z.number().min(0).max(100),
});

export async function createExamType(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const school = await db.query.schools.findFirst();
    if (!school) return { success: false, message: "School not configured" };

    const weightage = formData.get("weightagePercent");

    const parsed = CreateExamTypeSchema.parse({
      name: formData.get("name"),
      code: formData.get("code"),
      examType: formData.get("examType"),
      weightagePercent: parseFloat(weightage as string) || 0,
    });

    await db.insert(examTypes).values({
      schoolId: school.id,
      name: parsed.name,
      code: parsed.code.toUpperCase(),
      examType: parsed.examType,
      weightagePercent: parsed.weightagePercent.toFixed(2),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath("/settings/exam-types");
    revalidatePath("/exams/new");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function deleteExamType(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    await db.delete(examTypes).where(eq(examTypes.id, id));

    revalidatePath("/settings/exam-types");
    revalidatePath("/exams/new");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
