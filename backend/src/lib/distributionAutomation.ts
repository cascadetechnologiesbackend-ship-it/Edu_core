/**
 * Mark Distribution Automation Engine (Sprint S11 Layer 6)
 * Generates and ensures default marks distribution rows for an examination across classes,
 * subjects, and exam components.
 *
 * Rules:
 * 1. Target Classes: Scoped to examClassScopes if configured, otherwise school classes or requested classIds.
 * 2. Mandatory Subjects: Always included.
 * 3. Elective Subjects: Included IF AND ONLY IF at least one student is actively enrolled (student_subject_enrollments).
 * 4. Mark Inheritance: Default maxMarks & passingMarks inherited from subject (or 100/33 fallback).
 * 5. Component Expansion: Expands across examComponents with weighted distribution if components exist.
 * 6. Ensure Semantics: Preserves existing customized distribution rows (never overwrites them).
 * 7. Immutability Guard: Never modifies or overwrites distributions where mark entries already exist.
 * 8. Preview Capability: Generates proposed distributions for review before committing to DB.
 */

import { db } from "@/db";
import {
  examMarkDistributions,
  examComponents,
  examClassScopes,
  markEntries,
  exams,
  classes,
  subjects,
  classSubjects,
  studentSubjectEnrollments,
  students,
} from "@/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import {
  requireExamPermission,
  type ExamAuthContext,
} from "./examPermissions";

export interface GenerateDistributionsInput {
  schoolId: string;
  examId: string;
  classIds?: string[] | undefined;
  previewOnly?: boolean | undefined;
  actorCtx?: ExamAuthContext | string | undefined;
}

export type DistributionAction =
  | "CREATE"
  | "PRESERVE_EXISTING"
  | "PROTECTED_HAS_MARKS";

export interface DistributionProposal {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  isElective: boolean;
  componentId: string | null;
  componentName: string | null;
  maxMarks: number;
  passingMarks: number;
  sortOrder: number;
  action: DistributionAction;
  reason?: string;
  existingDistributionId?: string | undefined;
}

export interface GenerateDistributionsResult {
  success: boolean;
  previewOnly: boolean;
  totalEligible: number;
  createdCount: number;
  preservedCount: number;
  protectedCount: number;
  proposals: DistributionProposal[];
  message?: string;
}

/**
 * Automates mark distributions generation for an exam following S11 ensure-semantics
 * and immutability rules.
 */
export async function generateMarkDistributions(
  params: GenerateDistributionsInput,
): Promise<GenerateDistributionsResult> {
  const { schoolId, examId, classIds, previewOnly = false, actorCtx } = params;

  // 1. RBAC Guard: If actor context provided, verify permission
  if (actorCtx) {
    requireExamPermission(actorCtx, "exam.schedule.manage");
  }

  // 2. Tenant & Exam existence validation
  const exam = await db.query.exams.findFirst({
    where: and(eq(exams.id, examId), eq(exams.schoolId, schoolId)),
  });

  if (!exam) {
    return {
      success: false,
      previewOnly: Boolean(previewOnly),
      totalEligible: 0,
      createdCount: 0,
      preservedCount: 0,
      protectedCount: 0,
      proposals: [],
      message: "Exam not found in this school.",
    };
  }

  // 3. Determine target classes (respecting examClassScopes if configured)
  const classScopes = await db
    .select({ classId: examClassScopes.classId })
    .from(examClassScopes)
    .where(
      and(
        eq(examClassScopes.examId, examId),
        eq(examClassScopes.schoolId, schoolId),
      ),
    );

  const scopedClassIds = classScopes.map((s) => s.classId);

  let targetClassIds: string[] = [];

  if (scopedClassIds.length > 0) {
    // If scopes are defined, we restrict to the scoped classes
    if (classIds && classIds.length > 0) {
      targetClassIds = classIds.filter((id) => scopedClassIds.includes(id));
    } else {
      targetClassIds = scopedClassIds;
    }
  } else {
    // If no scopes defined on exam, use specified classIds or all active classes
    if (classIds && classIds.length > 0) {
      targetClassIds = classIds;
    } else {
      const allActive = await db
        .select({ id: classes.id })
        .from(classes)
        .where(
          and(
            eq(classes.schoolId, schoolId),
            eq(classes.isActive, true),
            isNull(classes.deletedAt),
          ),
        );
      targetClassIds = allActive.map((c) => c.id);
    }
  }

  if (targetClassIds.length === 0) {
    return {
      success: true,
      previewOnly: Boolean(previewOnly),
      totalEligible: 0,
      createdCount: 0,
      preservedCount: 0,
      protectedCount: 0,
      proposals: [],
      message: "No classes eligible for distribution generation.",
    };
  }

  // 4. Fetch class metadata
  const classRecords = await db
    .select({
      id: classes.id,
      displayName: classes.displayName,
      sortOrder: classes.sortOrder,
    })
    .from(classes)
    .where(
      and(
        eq(classes.schoolId, schoolId),
        inArray(classes.id, targetClassIds),
      ),
    );

  const classMap = new Map(classRecords.map((c) => [c.id, c]));

  // 5. Fetch exam components for this exam
  const components = await db
    .select({
      id: examComponents.id,
      displayName: examComponents.displayName,
      weightPercent: examComponents.weightPercent,
      sortOrder: examComponents.sortOrder,
    })
    .from(examComponents)
    .where(
      and(
        eq(examComponents.examId, examId),
        eq(examComponents.schoolId, schoolId),
      ),
    );

  components.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // 6. Fetch existing distributions for (schoolId, examId)
  const existingDistributions = await db
    .select({
      id: examMarkDistributions.id,
      classId: examMarkDistributions.classId,
      subjectId: examMarkDistributions.subjectId,
      componentId: examMarkDistributions.componentId,
      maxMarks: examMarkDistributions.maxMarks,
      passingMarks: examMarkDistributions.passingMarks,
    })
    .from(examMarkDistributions)
    .where(
      and(
        eq(examMarkDistributions.examId, examId),
        eq(examMarkDistributions.schoolId, schoolId),
      ),
    );

  const existingDistMap = new Map<string, typeof existingDistributions[0]>();
  for (const dist of existingDistributions) {
    const key = `${dist.classId}:${dist.subjectId}:${dist.componentId ?? "null"}`;
    existingDistMap.set(key, dist);
  }

  // 7. Immutability guard: identify subjects/components where markEntries already exist
  const existingMarks = await db
    .select({
      subjectId: markEntries.subjectId,
      componentId: markEntries.componentId,
      currentClassId: students.currentClassId,
    })
    .from(markEntries)
    .innerJoin(students, eq(students.id, markEntries.studentId))
    .where(
      and(
        eq(markEntries.examId, examId),
        eq(markEntries.schoolId, schoolId),
      ),
    );

  const markEnteredKeys = new Set<string>();
  for (const mark of existingMarks) {
    if (mark.currentClassId) {
      // Class + Subject level marker
      markEnteredKeys.add(`${mark.currentClassId}:${mark.subjectId}`);
      // Class + Subject + Component level marker
      markEnteredKeys.add(
        `${mark.currentClassId}:${mark.subjectId}:${mark.componentId ?? "null"}`,
      );
    }
  }

  // 8. Fetch class subjects & active subjects for target classes
  const classSubjectRows = await db
    .select({
      classSubjectId: classSubjects.id,
      classId: classSubjects.classId,
      subjectId: classSubjects.subjectId,
      isElective: classSubjects.isElective,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      subjectMaxMarks: subjects.maxMarks,
      subjectPassingMarks: subjects.passingMarks,
    })
    .from(classSubjects)
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .where(
      and(
        eq(classSubjects.schoolId, schoolId),
        inArray(classSubjects.classId, targetClassIds),
        eq(subjects.schoolId, schoolId),
        eq(subjects.isActive, true),
        isNull(subjects.deletedAt),
      ),
    );

  // 9. Elective filtering: identify which elective classSubjects have >= 1 active enrollment
  const electiveClassSubjectIds = classSubjectRows
    .filter((cs) => cs.isElective)
    .map((cs) => cs.classSubjectId);

  const activeElectiveEnrollments = new Set<string>();
  if (electiveClassSubjectIds.length > 0) {
    const enrollments = await db
      .select({ classSubjectId: studentSubjectEnrollments.classSubjectId })
      .from(studentSubjectEnrollments)
      .where(
        and(
          eq(studentSubjectEnrollments.schoolId, schoolId),
          inArray(
            studentSubjectEnrollments.classSubjectId,
            electiveClassSubjectIds,
          ),
          eq(studentSubjectEnrollments.isElectiveTaken, true),
          eq(studentSubjectEnrollments.enrollmentStatus, "ACTIVE"),
        ),
      );

    for (const enr of enrollments) {
      activeElectiveEnrollments.add(enr.classSubjectId);
    }
  }

  // 10. Generate proposals
  const proposals: DistributionProposal[] = [];

  for (const cs of classSubjectRows) {
    // Negative rule: If subject is elective and 0 active students are enrolled, exclude it
    if (cs.isElective && !activeElectiveEnrollments.has(cs.classSubjectId)) {
      continue;
    }

    const cls = classMap.get(cs.classId);
    const className = cls?.displayName ?? "Unknown Class";
    const subjectMax = Number(cs.subjectMaxMarks ?? 100) || 100;
    const subjectPass = Number(cs.subjectPassingMarks ?? 33) || 33;

    if (components.length > 0) {
      // Component expansion
      for (const comp of components) {
        let maxMarks: number;
        let passingMarks: number;

        if (comp.weightPercent) {
          const weightNum = Number(comp.weightPercent);
          maxMarks = Math.round(((subjectMax * weightNum) / 100) * 100) / 100;
          passingMarks = Math.round(maxMarks * 0.33 * 100) / 100;
        } else {
          maxMarks = subjectMax;
          passingMarks = subjectPass;
        }

        const key = `${cs.classId}:${cs.subjectId}:${comp.id}`;
        const existing = existingDistMap.get(key);

        let action: DistributionAction = "CREATE";
        let reason = "Proposed default distribution";

        // Immutability Check: If markEntries exist for this combination
        if (
          markEnteredKeys.has(key) ||
          markEnteredKeys.has(`${cs.classId}:${cs.subjectId}`)
        ) {
          action = "PROTECTED_HAS_MARKS";
          reason =
            "Mark entries already exist for this subject/component; distribution is immutable";
        } else if (existing) {
          // Ensure semantics: existing customized rows remain untouched
          action = "PRESERVE_EXISTING";
          reason = "Existing configured distribution preserved";
        }

        proposals.push({
          classId: cs.classId,
          className,
          subjectId: cs.subjectId,
          subjectName: cs.subjectName,
          subjectCode: cs.subjectCode,
          isElective: cs.isElective,
          componentId: comp.id,
          componentName: comp.displayName,
          maxMarks: existing ? Number(existing.maxMarks) : maxMarks,
          passingMarks: existing
            ? Number(existing.passingMarks)
            : passingMarks,
          sortOrder: comp.sortOrder ?? 0,
          action,
          reason,
          existingDistributionId: existing?.id,
        });
      }
    } else {
      // Single overall paper without components
      const key = `${cs.classId}:${cs.subjectId}:null`;
      const existing = existingDistMap.get(key);

      let action: DistributionAction = "CREATE";
      let reason = "Proposed default distribution";

      if (markEnteredKeys.has(`${cs.classId}:${cs.subjectId}`)) {
        action = "PROTECTED_HAS_MARKS";
        reason =
          "Mark entries already exist for this subject; distribution is immutable";
      } else if (existing) {
        action = "PRESERVE_EXISTING";
        reason = "Existing configured distribution preserved";
      }

      proposals.push({
        classId: cs.classId,
        className,
        subjectId: cs.subjectId,
        subjectName: cs.subjectName,
        subjectCode: cs.subjectCode,
        isElective: cs.isElective,
        componentId: null,
        componentName: null,
        maxMarks: existing ? Number(existing.maxMarks) : subjectMax,
        passingMarks: existing
          ? Number(existing.passingMarks)
          : subjectPass,
        sortOrder: 0,
        action,
        reason,
        existingDistributionId: existing?.id,
      });
    }
  }

  // 11. Count aggregation
  const createdCount = proposals.filter((p) => p.action === "CREATE").length;
  const preservedCount = proposals.filter(
    (p) => p.action === "PRESERVE_EXISTING",
  ).length;
  const protectedCount = proposals.filter(
    (p) => p.action === "PROTECTED_HAS_MARKS",
  ).length;

  // 12. Execute DB writes if not preview
  if (!previewOnly && createdCount > 0) {
    const toInsert = proposals
      .filter((p) => p.action === "CREATE")
      .map((p) => ({
        schoolId,
        examId,
        classId: p.classId,
        subjectId: p.subjectId,
        componentId: p.componentId,
        maxMarks: p.maxMarks.toFixed(2),
        passingMarks: p.passingMarks.toFixed(2),
        sortOrder: p.sortOrder,
      }));

    if (toInsert.length > 0) {
      await db.insert(examMarkDistributions).values(toInsert);
    }
  }

  return {
    success: true,
    previewOnly: Boolean(previewOnly),
    totalEligible: proposals.length,
    createdCount,
    preservedCount,
    protectedCount,
    proposals,
    message: previewOnly
      ? `Preview generated: ${createdCount} to create, ${preservedCount} preserved, ${protectedCount} protected.`
      : `Successfully generated ${createdCount} mark distribution rows (${preservedCount} preserved, ${protectedCount} protected).`,
  };
}
