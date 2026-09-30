import { describe, it, expect } from "vitest";
import {
  calculateGrade,
  aggregateSubjectGrades,
  calculateRanks,
  getCBSEDefaultRules,
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
