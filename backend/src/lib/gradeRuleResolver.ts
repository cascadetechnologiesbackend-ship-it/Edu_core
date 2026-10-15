import { db as defaultDb } from "@/db";
import { gradeRules, classes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  type GradeRule,
  type ClassGroup,
  getCBSEDefaultRules,
} from "./gradeEngine";

/**
 * Maps a class grade level string (e.g. "Class 10", "10", "UKG") to a ClassGroup enum value.
 */
export function gradeToClassGroup(gradeLevel: string): ClassGroup {
  const norm = (gradeLevel || "").trim().toUpperCase();
  if (["NURSERY", "LKG", "UKG", "PRE_KG", "KG"].includes(norm)) {
    return "NURSERY_UKG";
  }
  const num = parseInt(norm.replace(/[^0-9]/g, ""), 10);
  if (!isNaN(num)) {
    if (num <= 5) return "CLASS_1_5";
    if (num <= 8) return "CLASS_6_8";
    if (num <= 10) return "CLASS_9_10";
    return "CLASS_11_12";
  }
  return "CLASS_1_5";
}

/**
 * Unifies grade rule resolution across Result Snapshots, PDF Generation, and Bulk Report Card workers.
 *
 * Hierarchy:
 * 1. Specific class rules: `grade_rules WHERE school_id = :schoolId AND class_id = :classId`
 * 2. Class group rules: `grade_rules WHERE school_id = :schoolId AND class_group = :classGroup`
 * 3. Default fallback: CBSE 9-point scale (`getCBSEDefaultRules()`)
 */
export async function resolveGradeRules(
  schoolId: string,
  classId?: string | null,
  classGroup?: ClassGroup | null,
  dbOrTx: any = defaultDb,
): Promise<GradeRule[]> {
  // 1. Try class-specific rules if classId provided
  if (classId) {
    const classRules = await dbOrTx.query.gradeRules.findMany({
      where: and(
        eq(gradeRules.schoolId, schoolId),
        eq(gradeRules.classId, classId),
      ),
    });
    if (classRules && classRules.length > 0) {
      return classRules.map((r: any) => ({
        minPercent: parseFloat(r.minPercent),
        maxPercent: parseFloat(r.maxPercent),
        grade: r.grade,
        gradePoint: parseFloat(r.gradePoint),
        description: r.description,
      }));
    }

    // If classGroup not provided, derive it from class gradeLevel
    if (!classGroup) {
      const classRecord = await dbOrTx.query.classes.findFirst({
        where: and(eq(classes.id, classId), eq(classes.schoolId, schoolId)),
      });
      if (classRecord) {
        classGroup = gradeToClassGroup(classRecord.gradeLevel);
      }
    }
  }

  // 2. Try classGroup rules
  if (classGroup) {
    const groupRules = await dbOrTx.query.gradeRules.findMany({
      where: and(
        eq(gradeRules.schoolId, schoolId),
        eq(gradeRules.classGroup, classGroup),
      ),
    });
    if (groupRules && groupRules.length > 0) {
      return groupRules.map((r: any) => ({
        minPercent: parseFloat(r.minPercent),
        maxPercent: parseFloat(r.maxPercent),
        grade: r.grade,
        gradePoint: parseFloat(r.gradePoint),
        description: r.description,
      }));
    }
  }

  // 3. Fallback to CBSE default rules
  return getCBSEDefaultRules();
}
