// ─── Grade Engine ─────────────────────────────────────────────────────────────
// Pure, testable functions for calculating grades, grade points, ranks, divisions,
// component marks, weighted exam setups, and snapshot payloads.
// No DB access — accepts pre-fetched grade rules as parameters.

export type ClassGroup =
  | "NURSERY_UKG"
  | "CLASS_1_5"
  | "CLASS_6_8"
  | "CLASS_9_10"
  | "CLASS_11_12";

export interface GradeRule {
  minPercent: number;
  maxPercent: number;
  grade: string;
  gradePoint: number;
  description?: string | null;
}

export interface GradeResult {
  grade: string;
  gradePoint: number;
  percent: number | null;
  isPassed: boolean;
  isAbsent: boolean;
  isMedicalExempt: boolean;
  description: string;
}

export interface SubjectMarkInput {
  marksObtained: number | null;
  maxMarks: number;
  practicalMarks?: number | null;
  practicalMaxMarks?: number | null;
  isAbsent: boolean;
  isMedicalExempt: boolean;
  isPracticalAbsent?: boolean;
  passingMarks?: number;
}

export interface AggregateResult {
  totalMarks: number;
  totalMaxMarks: number;
  overallPercent: number;
  overallGrade: string;
  overallGradePoint: number;
  subjectResults: GradeResult[];
  isPassed: boolean;
}

// ─── Special grade sentinel values ───────────────────────────────────────────
export const ABSENT_GRADE = "AB";
export const MEDICAL_EXEMPT_GRADE = "ME";
export const PRACTICAL_ABSENT_GRADE = "PA";
export const FAIL_GRADE = "E";
export const UNENROLLED_SENTINEL = "-";

/**
 * Calculates the grade for a single subject mark entry.
 * Rules are checked in priority order: medical exemption > absent > practical absent > marks.
 */
export function calculateGrade(
  input: SubjectMarkInput,
  rules: GradeRule[],
): GradeResult {
  // Priority 1: Medical exemption
  if (input.isMedicalExempt) {
    return {
      grade: MEDICAL_EXEMPT_GRADE,
      gradePoint: 0,
      percent: null,
      isPassed: true, // Exempted students are not penalized
      isAbsent: false,
      isMedicalExempt: true,
      description: "Medical Exemption",
    };
  }

  // Priority 2: Completely absent
  if (input.isAbsent) {
    return {
      grade: ABSENT_GRADE,
      gradePoint: 0,
      percent: null,
      isPassed: false,
      isAbsent: true,
      isMedicalExempt: false,
      description: "Absent",
    };
  }

  // Priority 3: Practical absent (theory marks present but practical missing)
  if (input.isPracticalAbsent === true && (input.practicalMaxMarks ?? 0) > 0) {
    return {
      grade: PRACTICAL_ABSENT_GRADE,
      gradePoint: 0,
      percent: null,
      isPassed: false,
      isAbsent: false,
      isMedicalExempt: false,
      description: "Practical Absent",
    };
  }

  if (input.maxMarks <= 0) {
    throw new Error("maxMarks must be greater than zero");
  }

  // Calculate combined marks (theory + practical)
  const theoryMarks = input.marksObtained ?? 0;
  const practicalMarks = input.practicalMarks ?? 0;
  const totalObtained = theoryMarks + practicalMarks;

  const practicalMax =
    input.isPracticalAbsent !== true ? (input.practicalMaxMarks ?? 0) : 0;
  const totalMax = input.maxMarks + practicalMax;

  const percent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

  // Find matching rule
  const sortedRules = [...rules].sort((a, b) => b.minPercent - a.minPercent);
  const matchedRule = sortedRules.find(
    (r) => percent >= r.minPercent && percent <= r.maxPercent,
  );

  const passingMarks = input.passingMarks ?? input.maxMarks * 0.33;
  const isPassed = totalObtained >= passingMarks;

  if (!matchedRule) {
    // Fallback: below lowest rule threshold = fail
    return {
      grade: FAIL_GRADE,
      gradePoint: 0,
      percent,
      isPassed: false,
      isAbsent: false,
      isMedicalExempt: false,
      description: "Fail",
    };
  }

  return {
    grade: matchedRule.grade,
    gradePoint: matchedRule.gradePoint,
    percent,
    isPassed,
    isAbsent: false,
    isMedicalExempt: false,
    description: matchedRule.description ?? matchedRule.grade,
  };
}

/**
 * Aggregates multiple subject grade results into an overall result.
 * Medical exemptions are excluded from percentage calculation.
 * A student fails overall if they fail in any non-exempt subject.
 */
export function aggregateSubjectGrades(
  subjects: Array<{
    result: GradeResult;
    maxMarks: number;
    marksObtained: number | null;
    practicalMarks?: number | null;
    practicalMaxMarks?: number | null;
  }>,
  rules: GradeRule[],
): AggregateResult {
  let totalMarks = 0;
  let totalMaxMarks = 0;
  let overallPassed = true;

  const subjectResults = subjects.map((s) => {
    if (
      s.result.isMedicalExempt ||
      s.result.isAbsent ||
      s.result.grade === PRACTICAL_ABSENT_GRADE
    ) {
      if (!s.result.isMedicalExempt) overallPassed = false;
      return s.result;
    }
    const obtained = (s.marksObtained ?? 0) + (s.practicalMarks ?? 0);
    const max = s.maxMarks + (s.practicalMaxMarks ?? 0);
    totalMarks += obtained;
    totalMaxMarks += max;
    if (!s.result.isPassed) overallPassed = false;
    return s.result;
  });

  const overallPercent =
    totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;

  const overallGradeResult = calculateGrade(
    {
      marksObtained: totalMarks,
      maxMarks: totalMaxMarks > 0 ? totalMaxMarks : 1,
      isAbsent: false,
      isMedicalExempt: false,
    },
    rules,
  );

  return {
    totalMarks,
    totalMaxMarks,
    overallPercent,
    overallGrade: overallPassed ? overallGradeResult.grade : FAIL_GRADE,
    overallGradePoint: overallPassed ? overallGradeResult.gradePoint : 0,
    subjectResults,
    isPassed: overallPassed,
  };
}

/**
 * Assigns ranks to a list of students based on their total marks.
 * Students with the same total marks receive the same rank.
 * Medical exemptions and absences are ranked last.
 */
export function calculateRanks(
  students: Array<{ studentId: string; totalMarks: number; isPassed: boolean }>,
): Array<{ studentId: string; rank: number }> {
  const sorted = [...students].sort((a, b) => {
    if (a.isPassed && !b.isPassed) return -1;
    if (!a.isPassed && b.isPassed) return 1;
    return b.totalMarks - a.totalMarks;
  });

  const result: Array<{ studentId: string; rank: number }> = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = sorted[i - 1];
    if (i > 0 && current && prev && current.totalMarks !== prev.totalMarks) {
      currentRank = i + 1;
    }
    if (current) {
      result.push({ studentId: current.studentId, rank: currentRank });
    }
  }

  return result;
}

/**
 * Returns the default CBSE grading scale for Class 9-10.
 * Used as seed data or when school hasn't configured custom rules.
 */
export function getCBSEDefaultRules(): GradeRule[] {
  return [
    {
      minPercent: 91,
      maxPercent: 100,
      grade: "A1",
      gradePoint: 10,
      description: "Outstanding",
    },
    {
      minPercent: 81,
      maxPercent: 90.99,
      grade: "A2",
      gradePoint: 9,
      description: "Excellent",
    },
    {
      minPercent: 71,
      maxPercent: 80.99,
      grade: "B1",
      gradePoint: 8,
      description: "Very Good",
    },
    {
      minPercent: 61,
      maxPercent: 70.99,
      grade: "B2",
      gradePoint: 7,
      description: "Good",
    },
    {
      minPercent: 51,
      maxPercent: 60.99,
      grade: "C1",
      gradePoint: 6,
      description: "Average",
    },
    {
      minPercent: 41,
      maxPercent: 50.99,
      grade: "C2",
      gradePoint: 5,
      description: "Satisfactory",
    },
    {
      minPercent: 33,
      maxPercent: 40.99,
      grade: "D",
      gradePoint: 4,
      description: "Pass",
    },
    {
      minPercent: 0,
      maxPercent: 32.99,
      grade: "E",
      gradePoint: 0,
      description: "Fail",
    },
  ];
}

// ─── Grade Engine v2 Extensions ──────────────────────────────────────────────

export type Division = "FIRST" | "SECOND" | "THIRD" | "FAIL";

export function calculateDivision(
  overallPercent: number,
  isPassed: boolean,
): Division {
  if (!isPassed || overallPercent < 33) return "FAIL";
  if (overallPercent >= 60) return "FIRST";
  if (overallPercent >= 50) return "SECOND";
  return "THIRD";
}

export interface ComponentMarkInput {
  componentId: string;
  componentName?: string | undefined;
  componentCode?: string | undefined;
  marksObtained: number | null;
  maxMarks: number;
  passingMarks?: number | undefined;
  weightagePercent?: number | undefined;
  isAbsent?: boolean | undefined;
  isExempt?: boolean | undefined;
}

export interface ComponentAggregateResult {
  totalObtained: number;
  totalMax: number;
  percent: number | null;
  isPassed: boolean;
  isAbsent: boolean;
  isExempt: boolean;
  components: Array<{
    componentId: string;
    componentName?: string | undefined;
    marksObtained: number | null;
    maxMarks: number;
    isPassed: boolean;
    isAbsent: boolean;
    isExempt: boolean;
  }>;
}

export function calculateComponentMarks(
  components: ComponentMarkInput[],
  passingPercentage: number = 33,
): ComponentAggregateResult {
  if (!components || components.length === 0) {
    return {
      totalObtained: 0,
      totalMax: 0,
      percent: 0,
      isPassed: false,
      isAbsent: false,
      isExempt: false,
      components: [],
    };
  }

  const isAllExempt = components.every((c) => c.isExempt);
  if (isAllExempt) {
    return {
      totalObtained: 0,
      totalMax: components.reduce((sum, c) => sum + c.maxMarks, 0),
      percent: null,
      isPassed: true,
      isAbsent: false,
      isExempt: true,
      components: components.map((c) => ({
        componentId: c.componentId,
        componentName: c.componentName,
        marksObtained: null,
        maxMarks: c.maxMarks,
        isPassed: true,
        isAbsent: false,
        isExempt: true,
      })),
    };
  }

  const isAllAbsent = components.every((c) => c.isAbsent);
  if (isAllAbsent) {
    return {
      totalObtained: 0,
      totalMax: components.reduce((sum, c) => sum + c.maxMarks, 0),
      percent: 0,
      isPassed: false,
      isAbsent: true,
      isExempt: false,
      components: components.map((c) => ({
        componentId: c.componentId,
        componentName: c.componentName,
        marksObtained: 0,
        maxMarks: c.maxMarks,
        isPassed: false,
        isAbsent: true,
        isExempt: false,
      })),
    };
  }

  let totalObtained = 0;
  let totalMax = 0;
  let allComponentsPassed = true;

  const componentDetails = components.map((c) => {
    if (c.isExempt) {
      return {
        componentId: c.componentId,
        componentName: c.componentName,
        marksObtained: null,
        maxMarks: c.maxMarks,
        isPassed: true,
        isAbsent: false,
        isExempt: true,
      };
    }

    if (c.isAbsent) {
      allComponentsPassed = false;
      totalMax += c.maxMarks;
      return {
        componentId: c.componentId,
        componentName: c.componentName,
        marksObtained: 0,
        maxMarks: c.maxMarks,
        isPassed: false,
        isAbsent: true,
        isExempt: false,
      };
    }

    const obtained = c.marksObtained ?? 0;
    const passThreshold =
      c.passingMarks ?? (c.maxMarks * passingPercentage) / 100;
    const passed = obtained >= passThreshold;
    if (!passed) allComponentsPassed = false;

    totalObtained += obtained;
    totalMax += c.maxMarks;

    return {
      componentId: c.componentId,
      componentName: c.componentName,
      marksObtained: obtained,
      maxMarks: c.maxMarks,
      isPassed: passed,
      isAbsent: false,
      isExempt: false,
    };
  });

  const percent = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
  const overallPassingThreshold = (totalMax * passingPercentage) / 100;
  const isPassed =
    allComponentsPassed && totalObtained >= overallPassingThreshold;

  return {
    totalObtained,
    totalMax,
    percent,
    isPassed,
    isAbsent: false,
    isExempt: false,
    components: componentDetails,
  };
}

export interface EffectiveSubjectInput {
  subjectId: string;
  subjectName: string;
  isOptional?: boolean;
  isElective?: boolean;
  isEnrolled?: boolean;
  marksObtained: number;
  maxMarks: number;
  percent: number;
  isPassed: boolean;
  grade?: string;
}

export interface EffectiveSubjectsResult {
  countedSubjects: EffectiveSubjectInput[];
  excludedSubjects: EffectiveSubjectInput[];
  unenrolledSubjects: EffectiveSubjectInput[];
  totalMarks: number;
  totalMaxMarks: number;
  percent: number;
}

export function resolveEffectiveSubjects(
  subjects: EffectiveSubjectInput[],
  options?: {
    bestOfCount?: number;
    coreSubjectIds?: string[];
    enrolledSubjectIds?: string[];
  },
): EffectiveSubjectsResult {
  const enrolledIds = options?.enrolledSubjectIds
    ? new Set(options.enrolledSubjectIds)
    : null;

  // Filter out unenrolled elective/optional subjects
  const enrolled: EffectiveSubjectInput[] = [];
  const unenrolled: EffectiveSubjectInput[] = [];

  for (const s of subjects) {
    const isSubjectElective = s.isElective || s.isOptional;
    const isExplicitlyUnenrolled = s.isEnrolled === false;
    const isUnenrolledViaOptions =
      enrolledIds !== null && isSubjectElective && !enrolledIds.has(s.subjectId);

    if (isExplicitlyUnenrolled || isUnenrolledViaOptions) {
      unenrolled.push({
        ...s,
        isEnrolled: false,
        grade: UNENROLLED_SENTINEL,
      });
    } else {
      enrolled.push({
        ...s,
        isEnrolled: true,
      });
    }
  }

  if (options?.bestOfCount && enrolled.length > options.bestOfCount) {
    const coreIds = new Set(options.coreSubjectIds ?? []);
    const core = enrolled.filter(
      (s) => !s.isOptional || coreIds.has(s.subjectId),
    );
    const optional = enrolled.filter(
      (s) => s.isOptional && !coreIds.has(s.subjectId),
    );

    optional.sort((a, b) => b.percent - a.percent);

    const needed = Math.max(0, options.bestOfCount - core.length);
    const selectedOptional = optional.slice(0, needed);
    const excluded = optional.slice(needed);

    const counted = [...core, ...selectedOptional];
    const totalMarks = counted.reduce((sum, s) => sum + s.marksObtained, 0);
    const totalMax = counted.reduce((sum, s) => sum + s.maxMarks, 0);
    const percent = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;

    return {
      countedSubjects: counted,
      excludedSubjects: excluded,
      unenrolledSubjects: unenrolled,
      totalMarks,
      totalMaxMarks: totalMax,
      percent,
    };
  }

  const totalMarks = enrolled.reduce((sum, s) => sum + s.marksObtained, 0);
  const totalMax = enrolled.reduce((sum, s) => sum + s.maxMarks, 0);
  const percent = totalMax > 0 ? (totalMarks / totalMax) * 100 : 0;
  return {
    countedSubjects: enrolled,
    excludedSubjects: [],
    unenrolledSubjects: unenrolled,
    totalMarks,
    totalMaxMarks: totalMax,
    percent,
  };
}

export interface WeightedExamSubject {
  subjectId: string;
  subjectName: string;
  marksObtained: number | null;
  maxMarks: number;
  isAbsent?: boolean;
  isMedicalExempt?: boolean;
}

export interface WeightedExamInput {
  examId: string;
  examName: string;
  weightagePercent: number; // e.g. 30 for 30%
  subjects: WeightedExamSubject[];
}

export interface WeightedSubjectAggregate {
  subjectId: string;
  subjectName: string;
  weightedScore: number;
  totalWeight: number;
  percent: number;
  grade: string;
  gradePoint: number;
  isPassed: boolean;
}

export interface WeightedSetupResult {
  subjects: WeightedSubjectAggregate[];
  totalWeightedScore: number;
  totalWeight: number;
  overallPercent: number;
  overallGrade: string;
  overallGradePoint: number;
  division: Division;
  isPassed: boolean;
}

export function aggregateWeightedSetup(
  exams: WeightedExamInput[],
  rules: GradeRule[],
): WeightedSetupResult {
  const subjectMap = new Map<
    string,
    {
      subjectName: string;
      weightedScoreSum: number;
      weightSum: number;
      allPassed: boolean;
    }
  >();

  const totalExamWeight =
    exams.reduce((s, e) => s + e.weightagePercent, 0) || 100;

  for (const exam of exams) {
    const w = exam.weightagePercent;
    for (const sub of exam.subjects) {
      if (!subjectMap.has(sub.subjectId)) {
        subjectMap.set(sub.subjectId, {
          subjectName: sub.subjectName,
          weightedScoreSum: 0,
          weightSum: 0,
          allPassed: true,
        });
      }
      const entry = subjectMap.get(sub.subjectId)!;
      if (!sub.isMedicalExempt) {
        const subPercent =
          sub.maxMarks > 0 ? ((sub.marksObtained ?? 0) / sub.maxMarks) * 100 : 0;
        const weightedScore = (subPercent * w) / 100;
        entry.weightedScoreSum += weightedScore;
        entry.weightSum += w;
        if (sub.isAbsent || subPercent < 33) {
          entry.allPassed = false;
        }
      }
    }
  }

  const subjectAggregates: WeightedSubjectAggregate[] = [];
  let overallWeightedScore = 0;
  let overallWeightCount = 0;
  let allSubjectsPassed = true;

  for (const [subjectId, data] of subjectMap.entries()) {
    const normalizedPercent =
      data.weightSum > 0 ? (data.weightedScoreSum / data.weightSum) * 100 : 0;
    const gradeRes = calculateGrade(
      {
        marksObtained: normalizedPercent,
        maxMarks: 100,
        isAbsent: false,
        isMedicalExempt: false,
      },
      rules,
    );

    const isPassed = data.allPassed && normalizedPercent >= 33;
    if (!isPassed) allSubjectsPassed = false;

    overallWeightedScore += normalizedPercent;
    overallWeightCount += 1;

    subjectAggregates.push({
      subjectId,
      subjectName: data.subjectName,
      weightedScore: Number(normalizedPercent.toFixed(2)),
      totalWeight: data.weightSum,
      percent: Number(normalizedPercent.toFixed(2)),
      grade: gradeRes.grade,
      gradePoint: gradeRes.gradePoint,
      isPassed,
    });
  }

  const overallPercent =
    overallWeightCount > 0 ? overallWeightedScore / overallWeightCount : 0;
  const overallGradeRes = calculateGrade(
    {
      marksObtained: overallPercent,
      maxMarks: 100,
      isAbsent: false,
      isMedicalExempt: false,
    },
    rules,
  );

  const division = calculateDivision(overallPercent, allSubjectsPassed);

  return {
    subjects: subjectAggregates,
    totalWeightedScore: Number(overallWeightedScore.toFixed(2)),
    totalWeight: totalExamWeight,
    overallPercent: Number(overallPercent.toFixed(2)),
    overallGrade: allSubjectsPassed ? overallGradeRes.grade : FAIL_GRADE,
    overallGradePoint: allSubjectsPassed ? overallGradeRes.gradePoint : 0,
    division,
    isPassed: allSubjectsPassed,
  };
}

export interface BuildSnapshotParams {
  schoolId: string;
  setupId: string;
  student: {
    id: string;
    name: string;
    rollNumber?: string | null;
    admissionNumber?: string | null;
    classId: string;
    className: string;
    sectionName?: string | null;
    dob?: string | null;
  };
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode?: string | null;
    components?: Array<{
      name: string;
      obtained: number | null;
      maxMarks: number;
    }>;
    totalObtained: number;
    totalMax: number;
    percent: number;
    grade: string;
    gradePoint: number;
    isPassed: boolean;
  }>;
  cocurricular?: Array<{
    areaName: string;
    grade: string;
    description?: string | null;
  }>;
  attendance?: {
    totalWorkingDays: number;
    presentDays: number;
    percentage: number;
  };
  remarks?: string | null;
  rules: GradeRule[];
}

export interface ResultSnapshotPayload {
  student: BuildSnapshotParams["student"];
  subjects: BuildSnapshotParams["subjects"];
  cocurricular: BuildSnapshotParams["cocurricular"];
  attendance: BuildSnapshotParams["attendance"];
  summary: {
    totalMarks: number;
    totalMaxMarks: number;
    percentage: number;
    overallGrade: string;
    overallGradePoint: number;
    division: Division;
    resultStatus: "PASSED" | "FAILED" | "COMPARTMENT" | "WITHHELD";
    rank?: number;
    generatedAt: string;
  };
  remarks?: string | null;
}

export function buildResultSnapshotPayload(
  params: BuildSnapshotParams,
): ResultSnapshotPayload {
  let totalMarks = 0;
  let totalMaxMarks = 0;
  let failedSubjectsCount = 0;

  for (const s of params.subjects) {
    totalMarks += s.totalObtained;
    totalMaxMarks += s.totalMax;
    if (!s.isPassed) failedSubjectsCount++;
  }

  const percentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
  const isPassed = failedSubjectsCount === 0;

  const overallGradeRes = calculateGrade(
    {
      marksObtained: totalMarks,
      maxMarks: totalMaxMarks > 0 ? totalMaxMarks : 1,
      isAbsent: false,
      isMedicalExempt: false,
    },
    params.rules,
  );

  const division = calculateDivision(percentage, isPassed);

  let resultStatus: "PASSED" | "FAILED" | "COMPARTMENT" | "WITHHELD" = "PASSED";
  if (failedSubjectsCount === 1) {
    resultStatus = "COMPARTMENT";
  } else if (failedSubjectsCount > 1) {
    resultStatus = "FAILED";
  }

  return {
    student: params.student,
    subjects: params.subjects,
    cocurricular: params.cocurricular ?? [],
    attendance: params.attendance,
    summary: {
      totalMarks,
      totalMaxMarks,
      percentage: Number(percentage.toFixed(2)),
      overallGrade: isPassed ? overallGradeRes.grade : FAIL_GRADE,
      overallGradePoint: isPassed ? overallGradeRes.gradePoint : 0,
      division,
      resultStatus,
      generatedAt: new Date().toISOString(),
    },
    remarks: params.remarks ?? null,
  };
}

export function rankSnapshots(
  students: Array<{
    studentId: string;
    totalMarks: number;
    isPassed: boolean;
    percentage?: number;
  }>,
): Array<{ studentId: string; rank: number }> {
  const sorted = [...students].sort((a, b) => {
    if (a.isPassed && !b.isPassed) return -1;
    if (!a.isPassed && b.isPassed) return 1;
    const scoreA = a.percentage ?? a.totalMarks;
    const scoreB = b.percentage ?? b.totalMarks;
    return scoreB - scoreA;
  });

  const result: Array<{ studentId: string; rank: number }> = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = sorted[i - 1];
    if (i > 0 && current && prev) {
      const scoreCurrent = current.percentage ?? current.totalMarks;
      const scorePrev = prev.percentage ?? prev.totalMarks;
      if (scoreCurrent !== scorePrev) {
        currentRank = i + 1;
      }
    }
    if (current) {
      result.push({ studentId: current.studentId, rank: currentRank });
    }
  }

  return result;
}

export function checkFeeDefaulter(params: {
  feeLockMode: "OFF" | "SOFT_WARNING" | "HARD_LOCK";
  outstandingAmount: number;
  threshold: number;
  hasManualOverride: boolean;
}): { isBlocked: boolean; reason: string | null; warning: string | null } {
  if (params.feeLockMode === "OFF" || params.hasManualOverride) {
    return { isBlocked: false, reason: null, warning: null };
  }

  if (params.outstandingAmount > params.threshold) {
    if (params.feeLockMode === "HARD_LOCK") {
      return {
        isBlocked: true,
        reason: `Admit card withheld due to unpaid fees (₹${params.outstandingAmount}).`,
        warning: null,
      };
    }
    if (params.feeLockMode === "SOFT_WARNING") {
      return {
        isBlocked: false,
        reason: null,
        warning: `Notice: Fee dues of ₹${params.outstandingAmount} are pending. Please clear them soon.`,
      };
    }
  }

  return { isBlocked: false, reason: null, warning: null };
}

export function resolveResultVisibility(params: {
  isPublished: boolean;
  scheduledPublishAt?: string | Date | null;
  feeBlocked: boolean;
  adminHold: boolean;
  adminHoldReason?: string | null;
}): {
  isVisible: boolean;
  status:
    | "PUBLISHED"
    | "UNPUBLISHED"
    | "SCHEDULED"
    | "WITHHELD_FEE"
    | "WITHHELD_ADMIN";
  reason?: string;
} {
  // Gate 1: Master publish toggle
  if (!params.isPublished) {
    return {
      isVisible: false,
      status: "UNPUBLISHED",
      reason: "Result has not been published yet.",
    };
  }

  // Gate 2: Scheduled publish time
  if (params.scheduledPublishAt) {
    const scheduledTime = new Date(params.scheduledPublishAt).getTime();
    if (Date.now() < scheduledTime) {
      return {
        isVisible: false,
        status: "SCHEDULED",
        reason: `Result is scheduled to be released on ${new Date(scheduledTime).toLocaleString()}.`,
      };
    }
  }

  // Gate 3: Admin individual hold
  if (params.adminHold) {
    return {
      isVisible: false,
      status: "WITHHELD_ADMIN",
      reason:
        params.adminHoldReason || "Result is withheld by school administration.",
    };
  }

  // Gate 4: Fee defaulter hold
  if (params.feeBlocked) {
    return {
      isVisible: false,
      status: "WITHHELD_FEE",
      reason:
        "Result is withheld due to outstanding fee dues. Please contact the accounts office.",
    };
  }

  return {
    isVisible: true,
    status: "PUBLISHED",
  };
}
