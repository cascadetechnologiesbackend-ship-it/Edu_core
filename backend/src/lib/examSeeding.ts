/**
 * Examination Module Idempotent Seeding Engine (Sprint S9)
 * 
 * Follows the canonical ensureSchoolChartOfAccounts precedent:
 * - Transaction-aware executor parameterization (tx || db).
 * - Keyed find-first-then-insert.
 * - Invariant: NEVER update or delete existing records; user edits to seeds are sacred.
 * - Scoped strictly to school tenant.
 */

import {
  db,
  examTypes,
  gradeRules,
  cocurricularAreas,
  schools,
  classes,
} from "@schoolmitra/database";
import { eq, and, isNull } from "drizzle-orm";
import {
  getBlueprint,
  resolveGradeRulesForCategory,
  GROUP_TO_CATEGORY,
  ALL_CLASS_GROUPS,
  deriveClassGroupsFromClasses,
  type SchoolBoard,
  type GradingScale,
  type ClassGroup,
} from "./examBoardBlueprints";

export interface ExamSeedingOptions {
  activeClassGroups?: ClassGroup[];
}

export interface ExamSeedingResult {
  insertedExamTypes: number;
  insertedGradeRules: number;
  insertedCocurricular: number;
  skipped: number;
}

/**
 * Seeds examination blueprint defaults (exam types, grade rules, cocurricular areas)
 * into a school tenant idempotently.
 * 
 * Can run inside an existing transaction (e.g. registerSchoolTenant) or standalone.
 */
export async function seedExamBoardDefaults(
  schoolId: string,
  board: SchoolBoard,
  gradingScale?: GradingScale,
  executor?: any,
  options?: ExamSeedingOptions,
): Promise<ExamSeedingResult> {
  const client = executor || db;
  const blueprint = getBlueprint(board);

  let insertedExamTypes = 0;
  let insertedGradeRules = 0;
  let insertedCocurricular = 0;
  let skipped = 0;

  // 1. Seed Exam Types (keyed on school_id, code)
  for (const et of blueprint.examTypes) {
    const existing = await client.query.examTypes.findFirst({
      where: and(
        eq(examTypes.schoolId, schoolId),
        eq(examTypes.code, et.code),
      ),
    });

    if (!existing) {
      await client.insert(examTypes).values({
        schoolId,
        name: et.name,
        code: et.code,
        examType: et.examType as any,
        applicableClassGroups: et.applicableClassGroups as any,
        weightagePercent: et.weightPercent != null ? et.weightPercent.toFixed(2) : null,
        isActive: true,
      });
      insertedExamTypes++;
    } else {
      skipped++;
    }
  }

  // 2. Seed Grade Rules for active class categories only
  // Derivation Rule: seed grade rules ONLY for class groups the school actually operates
  const groupsToSeed = options?.activeClassGroups && options.activeClassGroups.length > 0
    ? options.activeClassGroups
    : ALL_CLASS_GROUPS;

  for (const group of groupsToSeed) {
    const category = GROUP_TO_CATEGORY[group];
    const rules = resolveGradeRulesForCategory(blueprint, category, gradingScale);

    for (const rule of rules) {
      // Amendment 3: Ensure-key MUST guard with isNull(classId) so blueprint group seeds
      // never collide with or block per-class override rows.
      const existing = await client.query.gradeRules.findFirst({
        where: and(
          eq(gradeRules.schoolId, schoolId),
          eq(gradeRules.classGroup, group),
          eq(gradeRules.grade, rule.grade),
          isNull(gradeRules.classId),
        ),
      });

      if (!existing) {
        await client.insert(gradeRules).values({
          schoolId,
          classGroup: group,
          classId: null, // Group-level default
          minPercent: rule.minPercent.toFixed(2),
          maxPercent: rule.maxPercent.toFixed(2),
          grade: rule.grade,
          gradePoint: rule.gradePoint.toFixed(2),
          description: rule.description,
          isActive: true,
        });
        insertedGradeRules++;
      } else {
        skipped++;
      }
    }
  }

  // 3. Seed Cocurricular Areas (keyed on school_id, name)
  for (const cc of blueprint.cocurricularAreas) {
    const existing = await client.query.cocurricularAreas.findFirst({
      where: and(
        eq(cocurricularAreas.schoolId, schoolId),
        eq(cocurricularAreas.name, cc.name),
      ),
    });

    if (!existing) {
      await client.insert(cocurricularAreas).values({
        schoolId,
        name: cc.name,
        description: cc.description,
        isActive: true,
      });
      insertedCocurricular++;
    } else {
      skipped++;
    }
  }

  return {
    insertedExamTypes,
    insertedGradeRules,
    insertedCocurricular,
    skipped,
  };
}
