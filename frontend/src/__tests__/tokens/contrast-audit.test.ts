// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getLuminance, getContrastRatio, runContrastAudit, checkTokenTruth, checkStrictSurfaces } from "../../../../scripts/audit-design-tokens.mjs";

describe("AD-L6: Mechanical Enforcement & Contrast Audit", () => {
  describe("Relative Luminance Calculation (WCAG 2.1 AA)", () => {
    it("computes correct luminance for pure black and pure white", () => {
      expect(getLuminance("#000000")).toBeCloseTo(0, 4);
      expect(getLuminance("#FFFFFF")).toBeCloseTo(1, 4);
    });

    it("computes correct contrast ratio for pure black on pure white", () => {
      const ratio = getContrastRatio("#000000", "#FFFFFF");
      expect(ratio).toBeCloseTo(21, 1);
    });
  });

  describe("Token Truth in globals.css & tailwind.config.ts", () => {
    it("passes token truth checks with zero hue-222 navy values", () => {
      const issues = checkTokenTruth();
      expect(issues).toEqual([]);
    });
  });

  describe("Strict Surface Banned Palette Check", () => {
    it("verifies landed core surfaces are 100% clean of banned legacy color tokens", () => {
      const violations = checkStrictSurfaces();
      expect(violations).toEqual([]);
    });
  });

  describe("WCAG 2.1 AA Semantic Token Contrast Ratios", () => {
    it("satisfies contrast thresholds across all light and dark appearance pairings", () => {
      const results = runContrastAudit();
      const failed = results.filter(r => !r.passed);
      expect(failed).toHaveLength(0);
    });

    it("ensures dark mode semantic tokens achieve >= 4.5:1 ratio on true black and card surfaces", () => {
      const darkBlackRatio = getContrastRatio("#0A84FF", "#000000"); // Dark interactive
      const darkMoneyInRatio = getContrastRatio("#30D158", "#000000"); // Dark money in
      const darkMoneyOwedRatio = getContrastRatio("#FF453A", "#000000"); // Dark money owed

      expect(darkBlackRatio).toBeGreaterThanOrEqual(4.5);
      expect(darkMoneyInRatio).toBeGreaterThanOrEqual(4.5);
      expect(darkMoneyOwedRatio).toBeGreaterThanOrEqual(4.5);
    });
  });
});
