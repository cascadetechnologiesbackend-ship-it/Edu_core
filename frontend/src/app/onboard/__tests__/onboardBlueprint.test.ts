import { describe, it, expect } from "vitest";
import {
  deriveClassGroupsFromClasses,
  blueprintSummary,
  getBlueprint,
} from "@/lib/examBoardBlueprints";

describe("Onboarding Wizard - Blueprint Live Preview & Footprint Calculations", () => {
  const K10_CLASSES = [
    { gradeLevel: "NURSERY", displayName: "Nursery" },
    { gradeLevel: "LKG", displayName: "LKG" },
    { gradeLevel: "UKG", displayName: "UKG" },
    { gradeLevel: "CLASS_1", displayName: "Class 1" },
    { gradeLevel: "CLASS_2", displayName: "Class 2" },
    { gradeLevel: "CLASS_3", displayName: "Class 3" },
    { gradeLevel: "CLASS_4", displayName: "Class 4" },
    { gradeLevel: "CLASS_5", displayName: "Class 5" },
    { gradeLevel: "CLASS_6", displayName: "Class 6" },
    { gradeLevel: "CLASS_7", displayName: "Class 7" },
    { gradeLevel: "CLASS_8", displayName: "Class 8" },
    { gradeLevel: "CLASS_9", displayName: "Class 9" },
    { gradeLevel: "CLASS_10", displayName: "Class 10" },
  ];

  it("derives the exact 4 class groups for a Nursery through Class 10 school", () => {
    const groups = deriveClassGroupsFromClasses(K10_CLASSES);
    expect(groups).toEqual(["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10"]);
    expect(groups).not.toContain("CLASS_11_12");
  });

  it("derives all 5 class groups when Class 11 and 12 are included", () => {
    const k12 = [
      ...K10_CLASSES,
      { gradeLevel: "CLASS_11", displayName: "Class 11" },
      { gradeLevel: "CLASS_12", displayName: "Class 12" },
    ];
    const groups = deriveClassGroupsFromClasses(k12);
    expect(groups).toEqual(["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"]);
  });

  it("calculates accurate live preview summary for CBSE board with K-10 classes", () => {
    const groups = deriveClassGroupsFromClasses(K10_CLASSES);
    const summary = blueprintSummary("CBSE", "CBSE_9_POINT", groups);

    expect(summary.board).toBe("CBSE");
    expect(summary.activeGradingScale).toBe("CBSE_9_POINT");
    expect(summary.examTypeCount).toBe(7); // PT, HY, ANN, PRAC, IA, PB, ACT_OBS
    expect(summary.cocurricularCount).toBe(4);
    expect(summary.termPlanNames).toEqual(["Periodic Test 1", "Half-Yearly Examination", "Annual Examination"]);

    // Check grade rules breakdown: NURSERY_UKG (5), CLASS_1_5 (8), CLASS_6_8 (9), CLASS_9_10 (9), CLASS_11_12 (0 because not in school)
    expect(summary.gradeRuleCountsByGroup.NURSERY_UKG).toBe(5);
    expect(summary.gradeRuleCountsByGroup.CLASS_1_5).toBe(5);
    expect(summary.gradeRuleCountsByGroup.CLASS_6_8).toBe(9);
    expect(summary.gradeRuleCountsByGroup.CLASS_9_10).toBe(9);
    expect(summary.gradeRuleCountsByGroup.CLASS_11_12).toBe(0);

    const totalRules = Object.values(summary.gradeRuleCountsByGroup).reduce((a, b) => a + b, 0);
    expect(totalRules).toBe(5 + 5 + 9 + 9);
  });

  it("adapts grade rule counts when user selects PERCENTAGE scale in onboarding", () => {
    const groups = deriveClassGroupsFromClasses(K10_CLASSES);
    const summary = blueprintSummary("CBSE", "PERCENTAGE", groups);

    expect(summary.activeGradingScale).toBe("PERCENTAGE");
    // Standard division scale has 5 rows (Distinction, First, Second, Pass, Essential Repeat)
    expect(summary.gradeRuleCountsByGroup.CLASS_9_10).toBe(5);
  });

  it("calculates accurate live preview summaries across ICSE, STATE_BOARD, IGCSE, and IB", () => {
    const groups = deriveClassGroupsFromClasses(K10_CLASSES);
    const boards = ["ICSE", "STATE_BOARD", "IGCSE", "IB"] as const;

    for (const board of boards) {
      const summary = blueprintSummary(board, undefined, groups);
      expect(summary.board).toBe(board);
      expect(summary.examTypeCount).toBeGreaterThan(0);
      expect(summary.cocurricularCount).toBeGreaterThan(0);
      expect(summary.termPlanNames.length).toBeGreaterThan(0);

      const totalRules = Object.values(summary.gradeRuleCountsByGroup).reduce((a, b) => a + b, 0);
      expect(totalRules).toBeGreaterThan(0);
    }
  });
});
