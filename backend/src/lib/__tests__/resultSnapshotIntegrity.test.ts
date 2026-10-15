import { describe, it, expect } from "vitest";
import {
  calculateGrade,
  calculateComponentMarks,
  getCBSEDefaultRules,
  buildResultSnapshotPayload,
  UNENROLLED_SENTINEL,
  ABSENT_GRADE,
  MEDICAL_EXEMPT_GRADE,
  FAIL_GRADE,
  type GradeRule,
} from "../gradeEngine";
import { gradeToClassGroup, resolveGradeRules } from "../gradeRuleResolver";

describe("S12 Layer 2: Result Snapshot Engine & Elective Enrollment Enforcement", () => {
  const cbseRules = getCBSEDefaultRules();

  describe("gradeToClassGroup", () => {
    it("maps kindergarten correctly", () => {
      expect(gradeToClassGroup("UKG")).toBe("NURSERY_UKG");
      expect(gradeToClassGroup("LKG")).toBe("NURSERY_UKG");
      expect(gradeToClassGroup("Nursery")).toBe("NURSERY_UKG");
    });

    it("maps grades 1 to 5 to CLASS_1_5", () => {
      expect(gradeToClassGroup("Class 1")).toBe("CLASS_1_5");
      expect(gradeToClassGroup("5")).toBe("CLASS_1_5");
    });

    it("maps grades 6 to 8 to CLASS_6_8", () => {
      expect(gradeToClassGroup("Class 7")).toBe("CLASS_6_8");
      expect(gradeToClassGroup("8")).toBe("CLASS_6_8");
    });

    it("maps grades 9 and 10 to CLASS_9_10", () => {
      expect(gradeToClassGroup("Class 10")).toBe("CLASS_9_10");
    });

    it("maps grades 11 and 12 to CLASS_11_12", () => {
      expect(gradeToClassGroup("Class 12")).toBe("CLASS_11_12");
    });
  });

  describe("resolveGradeRules Mock Hierarchy Drill", () => {
    it("returns class-specific rules when present", async () => {
      const mockDb = {
        query: {
          gradeRules: {
            findMany: async ({ where }: any) => {
              return [
                {
                  minPercent: "90",
                  maxPercent: "100",
                  grade: "A*",
                  gradePoint: "10",
                  description: "Outstanding",
                },
              ];
            },
          },
          classes: {
            findFirst: async () => null,
          },
        },
      };

      const rules = await resolveGradeRules("school-1", "class-1", "CLASS_9_10", mockDb);
      expect(rules).toHaveLength(1);
      expect(rules[0]?.grade).toBe("A*");
    });

    it("falls back to CBSE default rules when no database rules exist", async () => {
      const mockDb = {
        query: {
          gradeRules: {
            findMany: async () => [],
          },
          classes: {
            findFirst: async () => null,
          },
        },
      };

      const rules = await resolveGradeRules("school-1", "class-1", "CLASS_9_10", mockDb);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]?.grade).toBe("A1"); // CBSE top grade
    });
  });

  describe("Snapshot Payload with Electives and Sentinels (F2, F3 closure)", () => {
    it("properly excludes unenrolled electives from failure/compartment counts and totals", () => {
      // Student enrolled in 2 core subjects (Math, English) and NOT enrolled in Elective Music
      const subjects = [
        {
          subjectId: "subj-math",
          subjectName: "Mathematics",
          totalObtained: 80,
          totalMax: 100,
          percent: 80,
          grade: "A2",
          gradePoint: 9,
          isPassed: true,
        },
        {
          subjectId: "subj-eng",
          subjectName: "English",
          totalObtained: 75,
          totalMax: 100,
          percent: 75,
          grade: "B1",
          gradePoint: 8,
          isPassed: true,
        },
        {
          subjectId: "subj-music",
          subjectName: "Hindustani Music",
          totalObtained: 0,
          totalMax: 0,
          percent: 0,
          grade: UNENROLLED_SENTINEL, // "-"
          gradePoint: 0,
          isPassed: true, // Excluded from failure penalty
        },
      ];

      const snapshot = buildResultSnapshotPayload({
        schoolId: "11111111-1111-1111-1111-111111111111",
        setupId: "22222222-2222-2222-2222-222222222222",
        student: {
          id: "33333333-3333-3333-3333-333333333333",
          name: "Rohan Verma",
          classId: "44444444-4444-4444-4444-444444444444",
          className: "Class 10-A",
        },
        subjects,
        rules: cbseRules,
      });

      // Assert that totals only reflect the 2 enrolled subjects (totalMax = 200, NOT 300)
      expect(snapshot.summary.totalMarks).toBe(155);
      expect(snapshot.summary.totalMaxMarks).toBe(200);
      expect(snapshot.summary.percentage).toBe(77.5);
      expect(snapshot.summary.resultStatus).toBe("PASSED");
    });

    it("handles absent and medical exempt flags without throwing", () => {
      const absentRes = calculateGrade(
        {
          marksObtained: null,
          maxMarks: 100,
          isAbsent: true,
          isMedicalExempt: false,
        },
        cbseRules,
      );
      expect(absentRes.grade).toBe(ABSENT_GRADE);
      expect(absentRes.isPassed).toBe(false);

      const exemptRes = calculateGrade(
        {
          marksObtained: null,
          maxMarks: 100,
          isAbsent: false,
          isMedicalExempt: true,
        },
        cbseRules,
      );
      expect(exemptRes.grade).toBe(MEDICAL_EXEMPT_GRADE);
      expect(exemptRes.isPassed).toBe(true);
    });

    it("aggregates components correctly without double counting", () => {
      // Theory 70 + Practical 25 = 95 out of 100
      const components = [
        {
          componentId: "comp-theory",
          componentName: "Theory",
          marksObtained: 60,
          maxMarks: 70,
          passingMarks: 23,
          isAbsent: false,
          isExempt: false,
        },
        {
          componentId: "comp-practical",
          componentName: "Practical",
          marksObtained: 28,
          maxMarks: 30,
          passingMarks: 10,
          isAbsent: false,
          isExempt: false,
        },
      ];

      const agg = calculateComponentMarks(components, 33);
      expect(agg.totalObtained).toBe(88);
      expect(agg.totalMax).toBe(100);
      expect(agg.percent).toBe(88);
      expect(agg.isPassed).toBe(true);
      expect(agg.components).toHaveLength(2);
    });
  });
});
