"use server";

import { db } from "@/db";
import { gradeRules } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/serverAuth";
import { revalidatePath } from "next/cache";
import { getCBSEDefaultRules } from "@/lib/gradeEngine";
import { z } from "zod";

const ALLOWED_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const;

type ClassGroupValue = "NURSERY_UKG" | "CLASS_1_5" | "CLASS_6_8" | "CLASS_9_10";

const GradeRuleSchema = z.object({
  minPercent: z.number().min(0).max(100),
  maxPercent: z.number().min(0).max(100),
  grade: z.string().min(1),
  gradePoint: z.number().min(0).max(10),
  description: z.string().optional(),
});

interface SaveGradeRulesInput {
  // NOTE: schoolId is intentionally NOT accepted from the client — comes from session
  classGroup: ClassGroupValue;
  rules: Array<z.infer<typeof GradeRuleSchema>>;
}

export async function saveGradeRules(input: SaveGradeRulesInput) {
  try {
    const ctx = await requireAuth(ALLOWED_ROLES);
    const schoolId = ctx.schoolId;
    if (!schoolId) return { success: false, message: "No school context" };

    // Delete existing rules for this school + class group
    await db
      .delete(gradeRules)
      .where(
        and(
          eq(gradeRules.schoolId, schoolId),
          eq(gradeRules.classGroup, input.classGroup),
        ),
      );

    if (input.rules.length > 0) {
      const validatedRules = input.rules.map((r) => {
        const parsed = GradeRuleSchema.parse(r);
        return {
          schoolId,
          classGroup: input.classGroup,
          minPercent: parsed.minPercent.toFixed(2),
          maxPercent: parsed.maxPercent.toFixed(2),
          grade: parsed.grade.toUpperCase(),
          gradePoint: parsed.gradePoint.toFixed(2),
          description: parsed.description ?? null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      await db.insert(gradeRules).values(validatedRules);
    }

    revalidatePath("/settings/grading");
    return {
      success: true,
      message: `Saved ${input.rules.length} grade rules`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message };
  }
}

export async function seedCBSERules({
  classGroup,
}: {
  classGroup: ClassGroupValue;
}) {
  try {
    const ctx = await requireAuth(ALLOWED_ROLES);
    const schoolId = ctx.schoolId;
    if (!schoolId) return { success: false, message: "No school context" };

    const cbseRules = getCBSEDefaultRules();

    // Delete existing
    await db
      .delete(gradeRules)
      .where(
        and(
          eq(gradeRules.schoolId, schoolId),
          eq(gradeRules.classGroup, classGroup),
        ),
      );

    const inserted = await db
      .insert(gradeRules)
      .values(
        cbseRules.map((r) => ({
          schoolId,
          classGroup,
          minPercent: r.minPercent.toFixed(2),
          maxPercent: r.maxPercent.toFixed(2),
          grade: r.grade,
          gradePoint: r.gradePoint.toFixed(2),
          description: r.description ?? null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      )
      .returning();

    revalidatePath("/settings/grading");
    return {
      success: true,
      rules: inserted.map((r) => ({
        id: r.id,
        classGroup: r.classGroup,
        minPercent: parseFloat(r.minPercent),
        maxPercent: parseFloat(r.maxPercent),
        grade: r.grade,
        gradePoint: parseFloat(r.gradePoint),
        description: r.description ?? "",
      })),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message };
  }
}
