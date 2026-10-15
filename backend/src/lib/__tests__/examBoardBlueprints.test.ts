import { describe, it, expect } from "vitest";
import {
  BOARD_BLUEPRINTS,
  getBlueprint,
  resolveGradeRulesForCategory,
  blueprintSummary,
  mapGradeLevelToClassGroup,
  deriveClassGroupsFromClasses,
  ALL_CLASS_GROUPS,
  GROUP_TO_CATEGORY,
  computeProportionalDates,
  previewBoardTermPlan,
  SchoolBoard,
  ClassCategory,
  GradingScale,
} from "../examBoardBlueprints";

describe("Exam Board Blueprint Registry (Sprint S9 Layer 1)", () => {
  const ALL_BOARDS: SchoolBoard[] = ["CBSE", "ICSE", "STATE_BOARD", "IGCSE", "IB"];
  const ALL_CATEGORIES: ClassCategory[] = [
    "PRE_PRIMARY",
    "PRIMARY",
    "MIDDLE",
    "SECONDARY",
    "SENIOR_SECONDARY",
  ];

  describe("Registry Completeness & Integrity", () => {
    it("contains registered blueprints for all 5 education boards", () => {
      for (const board of ALL_BOARDS) {
        const bp = getBlueprint(board);
        expect(bp).toBeDefined();
        expect(bp.board).toBe(board);
        expect(bp.examTypes.length).toBeGreaterThan(0);
        expect(bp.cocurricularAreas.length).toBeGreaterThanOrEqual(4);
        expect(bp.termPlan.terms.length).toBeGreaterThanOrEqual(2);
      }
    });

    it("verifies every blueprint row description carries the non-legal default disclaimer", () => {
      for (const board of ALL_BOARDS) {
        const bp = getBlueprint(board);

        // Exam types
        for (const et of bp.examTypes) {
          expect(et.description).toMatch(/Board default \(editable\)$/);
          expect(et.applicableClassGroups.length).toBeGreaterThan(0);
        }

        // Cocurricular areas
        for (const cc of bp.cocurricularAreas) {
          expect(cc.description).toMatch(/Board default \(editable\)$/);
        }

        // Grade rules across all categories
        for (const cat of ALL_CATEGORIES) {
          const rules = bp.gradeScales[cat];
          expect(rules.length).toBeGreaterThan(0);
          for (const r of rules) {
            expect(r.description).toMatch(/Board default \(editable\)$/);
          }
        }
      }
    });
  });

  describe("Amendment 9: 0-100% Contiguity & Gap-Free Completeness for ALL Scales", () => {
    function assertScaleContiguity(rules: Array<{ minPercent: number; maxPercent: number; grade: string }>, context: string) {
      expect(rules.length, `${context} has no rules`).toBeGreaterThan(0);

      // Sort descending by minPercent
      const sorted = [...rules].sort((a, b) => b.minPercent - a.minPercent);

      // Top rule must reach 100%
      expect(sorted[0]!.maxPercent, `${context} top rule must reach 100%`).toBe(100.0);

      // Bottom rule must start at 0%
      expect(sorted[sorted.length - 1]!.minPercent, `${context} bottom rule must start at 0%`).toBe(0.0);

      // Verify strict contiguity: for each step, max of current rule equals min of preceding rule (with 0.01 tolerance for inclusive boundaries)
      for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i]!;
        expect(current.minPercent, `${context} rule ${current.grade} invalid range`).toBeLessThan(current.maxPercent);

        if (i > 0) {
          const prev = sorted[i - 1]!;
          // Preceding minPercent (e.g. 91.0) and current maxPercent (e.g. 90.99)
          const gap = Math.abs(prev.minPercent - current.maxPercent);
          expect(gap, `${context}: gap/overlap between ${prev.grade} (min: ${prev.minPercent}) and ${current.grade} (max: ${current.maxPercent})`).toBeLessThanOrEqual(0.02);
        }
      }
    }

    it("verifies contiguity for all board default grade scales across all 5 class categories", () => {
      for (const board of ALL_BOARDS) {
        const bp = getBlueprint(board);
        for (const cat of ALL_CATEGORIES) {
          const rules = bp.gradeScales[cat];
          assertScaleContiguity(rules, `${board} -> ${cat}`);
        }
      }
    });

    it("verifies contiguity for all gradeScalesByOverride scales", () => {
      for (const board of ALL_BOARDS) {
        const bp = getBlueprint(board);
        if (!bp.gradeScalesByOverride) continue;

        for (const [scaleKey, catMap] of Object.entries(bp.gradeScalesByOverride)) {
          if (!catMap) continue;
          for (const [catKey, rules] of Object.entries(catMap)) {
            if (!rules) continue;
            assertScaleContiguity(rules, `${board} override [${scaleKey}] -> ${catKey}`);
          }
        }
      }
    });
  });

  describe("Educational Hierarchy & Class Category Derivations", () => {
    it("maps individual grade levels to correct ClassGroups", () => {
      expect(mapGradeLevelToClassGroup("NURSERY")).toBe("NURSERY_UKG");
      expect(mapGradeLevelToClassGroup("LKG")).toBe("NURSERY_UKG");
      expect(mapGradeLevelToClassGroup("UKG")).toBe("NURSERY_UKG");
      expect(mapGradeLevelToClassGroup("CLASS_1")).toBe("CLASS_1_5");
      expect(mapGradeLevelToClassGroup("CLASS_5")).toBe("CLASS_1_5");
      expect(mapGradeLevelToClassGroup("CLASS_6")).toBe("CLASS_6_8");
      expect(mapGradeLevelToClassGroup("CLASS_8")).toBe("CLASS_6_8");
      expect(mapGradeLevelToClassGroup("CLASS_9")).toBe("CLASS_9_10");
      expect(mapGradeLevelToClassGroup("CLASS_10")).toBe("CLASS_9_10");
      expect(mapGradeLevelToClassGroup("CLASS_11")).toBe("CLASS_11_12");
      expect(mapGradeLevelToClassGroup("CLASS_12")).toBe("CLASS_11_12");
    });

    it("derives active ClassGroups strictly from operated classes in canonical order", () => {
      // Pre-Primary only school
      const prePrimaryOnly = deriveClassGroupsFromClasses([
        { gradeLevel: "NURSERY" },
        { gradeLevel: "LKG" },
        { gradeLevel: "UKG" },
      ]);
      expect(prePrimaryOnly).toEqual(["NURSERY_UKG"]);

      // K-10 school (no senior secondary)
      const k10School = deriveClassGroupsFromClasses([
        { gradeLevel: "CLASS_10" },
        { gradeLevel: "CLASS_1" },
        { gradeLevel: "NURSERY" },
        { gradeLevel: "CLASS_7" },
      ]);
      expect(k10School).toEqual(["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10"]);
      expect(k10School).not.toContain("CLASS_11_12");

      // Full K-12 school
      const k12School = deriveClassGroupsFromClasses([
        { gradeLevel: "CLASS_12" },
        { gradeLevel: "CLASS_2" },
        { gradeLevel: "LKG" },
      ]);
      expect(k12School).toEqual(["NURSERY_UKG", "CLASS_1_5", "CLASS_11_12"]);
    });
  });

  describe("Grading Scale Override Precedence", () => {
    it("respects user-selected gradingScale override over board default", () => {
      const cbse = getBlueprint("CBSE");
      expect(cbse.defaultGradingScale).toBe("CBSE_9_POINT");

      // Default resolution gives 9-point scale for SECONDARY
      const defaultRules = resolveGradeRulesForCategory(cbse, "SECONDARY");
      expect(defaultRules.some((r) => r.grade === "A1")).toBe(true);

      // User chooses PERCENTAGE override: should resolve to division scale
      const percentageRules = resolveGradeRulesForCategory(cbse, "SECONDARY", "PERCENTAGE");
      expect(percentageRules.some((r) => r.grade === "Distinction")).toBe(true);
      expect(percentageRules.some((r) => r.grade === "Essential Repeat")).toBe(true);

      // User chooses GPA override on State Board: resolves to 10-point GPA scale
      const stateBoard = getBlueprint("STATE_BOARD");
      const gpaRules = resolveGradeRulesForCategory(stateBoard, "SECONDARY", "GPA");
      expect(gpaRules.some((r) => r.grade === "A+" && r.gradePoint === 10.0)).toBe(true);
    });
  });

  describe("blueprintSummary() for UI and Preview Cards", () => {
    it("produces accurate counts filtered by active class groups", () => {
      const summaryFull = blueprintSummary("CBSE", "CBSE_9_POINT");
      expect(summaryFull.board).toBe("CBSE");
      expect(summaryFull.examTypeCount).toBe(7);
      expect(summaryFull.cocurricularCount).toBe(4);
      expect(summaryFull.gradeRuleCountsByGroup.NURSERY_UKG).toBe(5);
      expect(summaryFull.gradeRuleCountsByGroup.CLASS_9_10).toBe(9);
      expect(summaryFull.gradeRuleCountsByGroup.CLASS_11_12).toBe(5);

      // Filtered to Pre-Primary only
      const summaryPrePrimary = blueprintSummary("CBSE", "CBSE_9_POINT", ["NURSERY_UKG"]);
      expect(summaryPrePrimary.gradeRuleCountsByGroup.NURSERY_UKG).toBe(5);
      expect(summaryPrePrimary.gradeRuleCountsByGroup.CLASS_1_5).toBe(0);
      expect(summaryPrePrimary.gradeRuleCountsByGroup.CLASS_9_10).toBe(0);
      expect(summaryPrePrimary.gradeRuleCountsByGroup.CLASS_11_12).toBe(0);
    });
  });

  describe("Term Plan Calculations & Preview Helpers (Amendments 4, 6, 8)", () => {
    it("computes proportional placeholder dates bounded within the academic year window", () => {
      const yearStart = new Date("2026-04-01T00:00:00.000Z");
      const yearEnd = new Date("2027-03-31T00:00:00.000Z");

      // Mid-year (0.5)
      const mid = computeProportionalDates(yearStart, yearEnd, 0.5, 7);
      expect(mid.startDate.getTime()).toBeGreaterThan(yearStart.getTime());
      expect(mid.endDate.getTime()).toBeLessThan(yearEnd.getTime());
      expect(mid.endDate.getTime() - mid.startDate.getTime()).toBe(7 * 86400000);

      // Early term (0.25)
      const early = computeProportionalDates(yearStart, yearEnd, 0.25, 5);
      expect(early.startDate.getTime()).toBeLessThan(mid.startDate.getTime());
      expect(early.startDate.getTime()).toBeGreaterThanOrEqual(yearStart.getTime());

      // Final annual (0.92)
      const late = computeProportionalDates(yearStart, yearEnd, 0.92, 10);
      expect(late.startDate.getTime()).toBeGreaterThan(mid.endDate.getTime());
      expect(late.endDate.getTime()).toBeLessThanOrEqual(yearEnd.getTime());
    });

    it("previews board term plan with intersected class scopes and explicit components", () => {
      const sampleClasses = [
        { id: "c-nur", displayName: "Nursery A", gradeLevel: "NURSERY" },
        { id: "c-1", displayName: "Class 1 A", gradeLevel: "CLASS_1" },
        { id: "c-10", displayName: "Class 10 A", gradeLevel: "CLASS_10" },
      ];

      const preview = previewBoardTermPlan(
        "CBSE",
        "2026-04-01T00:00:00.000Z",
        "2027-03-31T00:00:00.000Z",
        sampleClasses,
      );

      expect(preview.length).toBe(3); // PT1, HY, ANN
      expect(preview[0]!.name).toBe("Periodic Test 1");
      expect(preview[0]!.components.length).toBe(1);
      expect(preview[0]!.components[0]!.name).toBe("Written Assessment");
      expect(preview[0]!.components[0]!.weightPercent).toBe(100);

      // Scopes should include Class 1 and Class 10, but NOT Nursery for standard PT/HY
      expect(preview[0]!.scopedClassCount).toBe(2);
      expect(preview[0]!.scopedClassNames).toContain("Class 1 A");
      expect(preview[0]!.scopedClassNames).toContain("Class 10 A");
      expect(preview[0]!.scopedClassNames).not.toContain("Nursery A");

      // HY has 2 components: Theory Paper (80%) and Internal Assessment (20%)
      expect(preview[1]!.name).toBe("Half-Yearly Examination");
      expect(preview[1]!.components.length).toBe(2);
      expect(preview[1]!.components[0]!.weightPercent).toBe(80);
      expect(preview[1]!.components[1]!.weightPercent).toBe(20);
    });
  });
});

