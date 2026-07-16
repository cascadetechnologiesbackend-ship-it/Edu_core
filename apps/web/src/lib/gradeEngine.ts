// ─── Grade Engine ─────────────────────────────────────────────────────────────
// Pure, testable functions for calculating grades, grade points, and ranks.
// No DB access — accepts pre-fetched grade rules as parameters.

export type ClassGroup = "NURSERY_UKG" | "CLASS_1_5" | "CLASS_6_8" | "CLASS_9_10";

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
const ABSENT_GRADE = "AB";
const MEDICAL_EXEMPT_GRADE = "ME";
const PRACTICAL_ABSENT_GRADE = "PA";
const FAIL_GRADE = "E";

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

  const practicalMax = (input.isPracticalAbsent !== true) ? (input.practicalMaxMarks ?? 0) : 0;
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
  subjects: Array<{ result: GradeResult; maxMarks: number; marksObtained: number | null; practicalMarks?: number | null; practicalMaxMarks?: number | null }>,
  rules: GradeRule[],
): AggregateResult {
  let totalMarks = 0;
  let totalMaxMarks = 0;
  let overallPassed = true;

  const subjectResults = subjects.map((s) => {
    if (s.result.isMedicalExempt || s.result.isAbsent || s.result.grade === PRACTICAL_ABSENT_GRADE) {
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

  const overallPercent = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;

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
    { minPercent: 91, maxPercent: 100, grade: "A1", gradePoint: 10, description: "Outstanding" },
    { minPercent: 81, maxPercent: 90.99, grade: "A2", gradePoint: 9, description: "Excellent" },
    { minPercent: 71, maxPercent: 80.99, grade: "B1", gradePoint: 8, description: "Very Good" },
    { minPercent: 61, maxPercent: 70.99, grade: "B2", gradePoint: 7, description: "Good" },
    { minPercent: 51, maxPercent: 60.99, grade: "C1", gradePoint: 6, description: "Average" },
    { minPercent: 41, maxPercent: 50.99, grade: "C2", gradePoint: 5, description: "Satisfactory" },
    { minPercent: 33, maxPercent: 40.99, grade: "D", gradePoint: 4, description: "Pass" },
    { minPercent: 0, maxPercent: 32.99, grade: "E", gradePoint: 0, description: "Fail" },
  ];
}
