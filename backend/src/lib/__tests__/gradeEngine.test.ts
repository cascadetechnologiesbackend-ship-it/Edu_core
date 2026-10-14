import { describe, it, expect } from "vitest";
import {
  calculateGrade,
  aggregateSubjectGrades,
  calculateRanks,
  getCBSEDefaultRules,
  calculateDivision,
  calculateComponentMarks,
  resolveEffectiveSubjects,
  aggregateWeightedSetup,
  buildResultSnapshotPayload,
  rankSnapshots,
  checkFeeDefaulter,
  resolveResultVisibility,
  type GradeRule,
  type SubjectMarkInput,
} from "../gradeEngine";

const CBSE_RULES = getCBSEDefaultRules();

// Helper to build a standard input
function mkInput(overrides: Partial<SubjectMarkInput> = {}): SubjectMarkInput {
  return {
    marksObtained: 75,
    maxMarks: 100,
    isAbsent: false,
    isMedicalExempt: false,
    ...overrides,
  };
}

describe("calculateGrade — CBSE Scale", () => {
  it("returns A1 for marks in 91-100 range", () => {
    const result = calculateGrade(mkInput({ marksObtained: 95 }), CBSE_RULES);
    expect(result.grade).toBe("A1");
    expect(result.gradePoint).toBe(10);
    expect(result.isPassed).toBe(true);
  });

  it("returns A2 for marks in 81-90 range", () => {
    const result = calculateGrade(mkInput({ marksObtained: 85 }), CBSE_RULES);
    expect(result.grade).toBe("A2");
    expect(result.gradePoint).toBe(9);
  });

  it("returns B1 for marks in 71-80 range", () => {
    const result = calculateGrade(mkInput({ marksObtained: 75 }), CBSE_RULES);
    expect(result.grade).toBe("B1");
  });

  it("returns D (pass) at exactly 33 marks", () => {
    const result = calculateGrade(mkInput({ marksObtained: 33 }), CBSE_RULES);
    expect(result.grade).toBe("D");
    expect(result.isPassed).toBe(true);
  });

  it("returns E (fail) at 32 marks", () => {
    const result = calculateGrade(mkInput({ marksObtained: 32 }), CBSE_RULES);
    expect(result.grade).toBe("E");
    expect(result.isPassed).toBe(false);
  });

  it("edge case: zero marks returns fail grade E", () => {
    const result = calculateGrade(mkInput({ marksObtained: 0 }), CBSE_RULES);
    expect(result.grade).toBe("E");
    expect(result.percent).toBe(0);
    expect(result.isPassed).toBe(false);
  });

  it("edge case: exactly 100 marks returns A1", () => {
    const result = calculateGrade(mkInput({ marksObtained: 100 }), CBSE_RULES);
    expect(result.grade).toBe("A1");
  });

  it("throws if maxMarks is 0", () => {
    expect(() => calculateGrade(mkInput({ maxMarks: 0 }), CBSE_RULES)).toThrow(
      "maxMarks must be greater than zero",
    );
  });
});

describe("calculateGrade — Medical Exemption", () => {
  it("returns ME grade for medically exempt student", () => {
    const result = calculateGrade(
      mkInput({ isMedicalExempt: true, marksObtained: 0 }),
      CBSE_RULES,
    );
    expect(result.grade).toBe("ME");
    expect(result.isMedicalExempt).toBe(true);
    expect(result.isPassed).toBe(true); // Medical exemption = not penalized
    expect(result.percent).toBeNull();
  });

  it("medical exemption takes priority over absence", () => {
    const result = calculateGrade(
      mkInput({ isMedicalExempt: true, isAbsent: true }),
      CBSE_RULES,
    );
    expect(result.grade).toBe("ME"); // ME has higher priority than AB
  });
});

describe("calculateGrade — Absent", () => {
  it("returns AB grade for absent student", () => {
    const result = calculateGrade(mkInput({ isAbsent: true }), CBSE_RULES);
    expect(result.grade).toBe("AB");
    expect(result.isAbsent).toBe(true);
    expect(result.isPassed).toBe(false);
    expect(result.percent).toBeNull();
  });
});

describe("calculateGrade — Practical Absent", () => {
  it("returns PA for practical absent when practical marks present", () => {
    const result = calculateGrade(
      mkInput({
        marksObtained: 60,
        maxMarks: 70,
        practicalMaxMarks: 30,
        isPracticalAbsent: true,
        isAbsent: false,
      }),
      CBSE_RULES,
    );
    expect(result.grade).toBe("PA");
    expect(result.isPassed).toBe(false);
  });

  it("does not return PA when there are no practical marks configured", () => {
    const result = calculateGrade(
      mkInput({
        marksObtained: 80,
        maxMarks: 100,
        isPracticalAbsent: true,
      }),
      CBSE_RULES,
    );
    // No practical component, isPracticalAbsent should be ignored
    expect(result.grade).not.toBe("PA");
    expect(result.grade).toBe("B1"); // 80/100 = 80% → B1 (71-80 range)
  });
});

describe("calculateGrade — Theory + Practical Combined", () => {
  it("combines theory and practical for percentage calculation", () => {
    const result = calculateGrade(
      mkInput({
        marksObtained: 60, // 60/70 theory
        maxMarks: 70,
        practicalMarks: 25, // 25/30 practical
        practicalMaxMarks: 30,
        isAbsent: false,
        isPracticalAbsent: false,
      }),
      CBSE_RULES,
    );
    // total: 85/100 = 85%  → A2
    expect(result.percent).toBeCloseTo(85, 1);
    expect(result.grade).toBe("A2");
  });
});

describe("calculateGrade — No matching rule", () => {
  it("returns E grade when no rule matches", () => {
    const sparseRules: GradeRule[] = [
      { minPercent: 80, maxPercent: 100, grade: "A", gradePoint: 10 },
    ];
    const result = calculateGrade(mkInput({ marksObtained: 50 }), sparseRules);
    expect(result.grade).toBe("E");
  });
});

describe("aggregateSubjectGrades", () => {
  it("calculates overall percent correctly across subjects", () => {
    const subjects = [
      {
        result: calculateGrade(
          mkInput({ marksObtained: 80, maxMarks: 100 }),
          CBSE_RULES,
        ),
        maxMarks: 100,
        marksObtained: 80,
      },
      {
        result: calculateGrade(
          mkInput({ marksObtained: 60, maxMarks: 100 }),
          CBSE_RULES,
        ),
        maxMarks: 100,
        marksObtained: 60,
      },
    ];
    const agg = aggregateSubjectGrades(subjects, CBSE_RULES);
    expect(agg.totalMarks).toBe(140);
    expect(agg.totalMaxMarks).toBe(200);
    expect(agg.overallPercent).toBeCloseTo(70, 1);
    expect(agg.isPassed).toBe(true);
  });

  it("marks overall as failed if any subject is failed", () => {
    const subjects = [
      {
        result: calculateGrade(mkInput({ marksObtained: 85 }), CBSE_RULES),
        maxMarks: 100,
        marksObtained: 85,
      },
      {
        result: calculateGrade(mkInput({ marksObtained: 20 }), CBSE_RULES), // fail
        maxMarks: 100,
        marksObtained: 20,
      },
    ];
    const agg = aggregateSubjectGrades(subjects, CBSE_RULES);
    expect(agg.isPassed).toBe(false);
    expect(agg.overallGrade).toBe("E");
  });

  it("excludes medical exempt subjects from percentage", () => {
    const subjects = [
      {
        result: calculateGrade(mkInput({ marksObtained: 80 }), CBSE_RULES),
        maxMarks: 100,
        marksObtained: 80,
      },
      {
        result: calculateGrade(mkInput({ isMedicalExempt: true }), CBSE_RULES),
        maxMarks: 100,
        marksObtained: null,
      },
    ];
    const agg = aggregateSubjectGrades(subjects, CBSE_RULES);
    // Only the first subject should count
    expect(agg.totalMaxMarks).toBe(100);
    expect(agg.totalMarks).toBe(80);
    expect(agg.isPassed).toBe(true);
  });
});

describe("calculateRanks", () => {
  it("assigns correct ranks to students", () => {
    const students = [
      { studentId: "s1", totalMarks: 450, isPassed: true },
      { studentId: "s2", totalMarks: 480, isPassed: true },
      { studentId: "s3", totalMarks: 450, isPassed: true },
      { studentId: "s4", totalMarks: 300, isPassed: false },
    ];
    const ranks = calculateRanks(students);
    const rankMap = Object.fromEntries(ranks.map((r) => [r.studentId, r.rank]));

    expect(rankMap["s2"]).toBe(1);
    expect(rankMap["s1"]).toBe(2);
    expect(rankMap["s3"]).toBe(2); // Tie with s1
    expect(rankMap["s4"]).toBe(4); // Failed, ranked last
  });

  it("failed students rank after passed students regardless of marks", () => {
    const students = [
      { studentId: "pass", totalMarks: 200, isPassed: true },
      { studentId: "fail", totalMarks: 500, isPassed: false }, // High marks but failed
    ];
    const ranks = calculateRanks(students);
    const passRank = ranks.find((r) => r.studentId === "pass")!.rank;
    const failRank = ranks.find((r) => r.studentId === "fail")!.rank;
    expect(passRank).toBeLessThan(failRank);
  });
});

describe("calculateDivision", () => {
  it("returns FIRST for >= 60%", () => {
    expect(calculateDivision(75, true)).toBe("FIRST");
    expect(calculateDivision(60, true)).toBe("FIRST");
  });

  it("returns SECOND for 50-59.99%", () => {
    expect(calculateDivision(59.5, true)).toBe("SECOND");
    expect(calculateDivision(50, true)).toBe("SECOND");
  });

  it("returns THIRD for 33-49.99%", () => {
    expect(calculateDivision(45, true)).toBe("THIRD");
    expect(calculateDivision(33, true)).toBe("THIRD");
  });

  it("returns FAIL for < 33% or failed student", () => {
    expect(calculateDivision(32.5, true)).toBe("FAIL");
    expect(calculateDivision(85, false)).toBe("FAIL");
  });
});

describe("calculateComponentMarks", () => {
  it("aggregates theory and practical components correctly", () => {
    const components = [
      {
        componentId: "c1",
        componentName: "Theory",
        marksObtained: 60,
        maxMarks: 80,
        passingMarks: 26.4,
      },
      {
        componentId: "c2",
        componentName: "Practical",
        marksObtained: 18,
        maxMarks: 20,
        passingMarks: 6.6,
      },
    ];
    const res = calculateComponentMarks(components);
    expect(res.totalObtained).toBe(78);
    expect(res.totalMax).toBe(100);
    expect(res.percent).toBe(78);
    expect(res.isPassed).toBe(true);
    expect(res.isAbsent).toBe(false);
  });

  it("marks as failed if any required component fails", () => {
    const components = [
      {
        componentId: "c1",
        marksObtained: 50,
        maxMarks: 80,
        passingMarks: 26.4,
      },
      {
        componentId: "c2",
        marksObtained: 4, // Below passing 6.6
        maxMarks: 20,
        passingMarks: 6.6,
      },
    ];
    const res = calculateComponentMarks(components);
    expect(res.isPassed).toBe(false);
  });

  it("handles exempt components without penalizing total", () => {
    const components = [
      {
        componentId: "c1",
        marksObtained: null,
        maxMarks: 50,
        isExempt: true,
      },
      {
        componentId: "c2",
        marksObtained: null,
        maxMarks: 50,
        isExempt: true,
      },
    ];
    const res = calculateComponentMarks(components);
    expect(res.isExempt).toBe(true);
    expect(res.isPassed).toBe(true);
  });

  it("handles absence in components", () => {
    const components = [
      {
        componentId: "c1",
        marksObtained: null,
        maxMarks: 100,
        isAbsent: true,
      },
    ];
    const res = calculateComponentMarks(components);
    expect(res.isAbsent).toBe(true);
    expect(res.isPassed).toBe(false);
  });
});

describe("resolveEffectiveSubjects", () => {
  it("selects best of 5 subjects dropping lowest optional", () => {
    const subjects = [
      { subjectId: "s1", subjectName: "Eng", isOptional: false, marksObtained: 80, maxMarks: 100, percent: 80, isPassed: true },
      { subjectId: "s2", subjectName: "Math", isOptional: false, marksObtained: 90, maxMarks: 100, percent: 90, isPassed: true },
      { subjectId: "s3", subjectName: "Sci", isOptional: false, marksObtained: 85, maxMarks: 100, percent: 85, isPassed: true },
      { subjectId: "s4", subjectName: "SSt", isOptional: false, marksObtained: 75, maxMarks: 100, percent: 75, isPassed: true },
      { subjectId: "s5", subjectName: "Hindi", isOptional: true, marksObtained: 70, maxMarks: 100, percent: 70, isPassed: true },
      { subjectId: "s6", subjectName: "IT", isOptional: true, marksObtained: 95, maxMarks: 100, percent: 95, isPassed: true },
    ];
    const res = resolveEffectiveSubjects(subjects, { bestOfCount: 5 });
    expect(res.countedSubjects.length).toBe(5);
    expect(res.excludedSubjects.length).toBe(1);
    expect(res.excludedSubjects[0]!.subjectId).toBe("s5"); // Hindi 70 dropped for IT 95
    expect(res.totalMarks).toBe(80 + 90 + 85 + 75 + 95);
  });
});

describe("aggregateWeightedSetup", () => {
  it("calculates weighted combined terms accurately", () => {
    const exams = [
      {
        examId: "term1",
        examName: "Term 1",
        weightagePercent: 40,
        subjects: [
          { subjectId: "sub1", subjectName: "Math", marksObtained: 80, maxMarks: 100 },
        ],
      },
      {
        examId: "term2",
        examName: "Term 2",
        weightagePercent: 60,
        subjects: [
          { subjectId: "sub1", subjectName: "Math", marksObtained: 90, maxMarks: 100 },
        ],
      },
    ];
    const res = aggregateWeightedSetup(exams, CBSE_RULES);
    // Math: 80 * 0.4 + 90 * 0.6 = 32 + 54 = 86%
    expect(res.subjects[0]!.percent).toBe(86);
    expect(res.subjects[0]!.grade).toBe("A2");
    expect(res.division).toBe("FIRST");
    expect(res.isPassed).toBe(true);
  });
});

describe("buildResultSnapshotPayload", () => {
  it("builds an immutable snapshot data structure with compartment detection", () => {
    const params = {
      schoolId: "sch1",
      setupId: "set1",
      student: {
        id: "stud1",
        name: "Aarav Sharma",
        rollNumber: "12",
        admissionNumber: "ADM-101",
        classId: "cls1",
        className: "Class 10",
        sectionName: "A",
      },
      subjects: [
        {
          subjectId: "sub1",
          subjectName: "Math",
          totalObtained: 80,
          totalMax: 100,
          percent: 80,
          grade: "B1",
          gradePoint: 8,
          isPassed: true,
        },
        {
          subjectId: "sub2",
          subjectName: "Science",
          totalObtained: 25,
          totalMax: 100,
          percent: 25,
          grade: "E",
          gradePoint: 0,
          isPassed: false,
        },
      ],
      cocurricular: [{ areaName: "Art", grade: "A" }],
      rules: CBSE_RULES,
    };

    const snapshot = buildResultSnapshotPayload(params);
    expect(snapshot.student.name).toBe("Aarav Sharma");
    expect(snapshot.summary.resultStatus).toBe("COMPARTMENT");
    expect(snapshot.summary.overallGrade).toBe("E");
    expect(snapshot.cocurricular?.length).toBe(1);
  });
});

describe("checkFeeDefaulter", () => {
  it("allows access when mode is OFF", () => {
    const res = checkFeeDefaulter({
      feeLockMode: "OFF",
      outstandingAmount: 5000,
      threshold: 0,
      hasManualOverride: false,
    });
    expect(res.isBlocked).toBe(false);
  });

  it("returns warning in SOFT_WARNING mode when dues exceed threshold", () => {
    const res = checkFeeDefaulter({
      feeLockMode: "SOFT_WARNING",
      outstandingAmount: 2500,
      threshold: 500,
      hasManualOverride: false,
    });
    expect(res.isBlocked).toBe(false);
    expect(res.warning).toContain("2500");
  });

  it("blocks access in HARD_LOCK mode when dues exceed threshold", () => {
    const res = checkFeeDefaulter({
      feeLockMode: "HARD_LOCK",
      outstandingAmount: 3000,
      threshold: 1000,
      hasManualOverride: false,
    });
    expect(res.isBlocked).toBe(true);
    expect(res.reason).toContain("3000");
  });

  it("allows access in HARD_LOCK mode if manual override is granted", () => {
    const res = checkFeeDefaulter({
      feeLockMode: "HARD_LOCK",
      outstandingAmount: 10000,
      threshold: 0,
      hasManualOverride: true,
    });
    expect(res.isBlocked).toBe(false);
  });
});

describe("resolveResultVisibility", () => {
  it("blocks when unpublished", () => {
    const res = resolveResultVisibility({
      isPublished: false,
      feeBlocked: false,
      adminHold: false,
    });
    expect(res.isVisible).toBe(false);
    expect(res.status).toBe("UNPUBLISHED");
  });

  it("blocks when scheduled in future", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const res = resolveResultVisibility({
      isPublished: true,
      scheduledPublishAt: futureDate,
      feeBlocked: false,
      adminHold: false,
    });
    expect(res.isVisible).toBe(false);
    expect(res.status).toBe("SCHEDULED");
  });

  it("blocks with admin hold", () => {
    const res = resolveResultVisibility({
      isPublished: true,
      feeBlocked: false,
      adminHold: true,
      adminHoldReason: "Disciplinary hold",
    });
    expect(res.isVisible).toBe(false);
    expect(res.status).toBe("WITHHELD_ADMIN");
    expect(res.reason).toBe("Disciplinary hold");
  });

  it("blocks with fee dues", () => {
    const res = resolveResultVisibility({
      isPublished: true,
      feeBlocked: true,
      adminHold: false,
    });
    expect(res.isVisible).toBe(false);
    expect(res.status).toBe("WITHHELD_FEE");
  });

  it("allows when published and no holds", () => {
    const res = resolveResultVisibility({
      isPublished: true,
      feeBlocked: false,
      adminHold: false,
    });
    expect(res.isVisible).toBe(true);
    expect(res.status).toBe("PUBLISHED");
  });
});

