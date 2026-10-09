import { describe, it, expect } from "vitest";
import { webVitalsBatchSchema, metricItemSchema, containsProhibitedPii } from "../webVitals";

describe("Web Vitals INP Enforcement & Schema Validation", () => {
  it("validates INP metric with interaction attribution (PF-R26)", () => {
    const validInp = {
      id: "inp-test-01",
      name: "INP",
      value: 64.2,
      route: "/dashboard",
      timestamp: Date.now(),
      attribution: {
        interactionTarget: "button#save-attendance",
        interactionType: "pointerdown",
      },
    };

    const parsed = metricItemSchema.safeParse(validInp);
    expect(parsed.success).toBe(true);
  });

  it("strictly rejects deprecated FID metric per rulebook (INP, never FID)", () => {
    const deprecatedFid = {
      id: "fid-test-01",
      name: "FID",
      value: 12.5,
      route: "/dashboard",
      timestamp: Date.now(),
    };

    const parsed = metricItemSchema.safeParse(deprecatedFid);
    expect(parsed.success).toBe(false);
  });

  it("validates all required Core Web Vitals (LCP, INP, CLS, TTFB, FCP)", () => {
    const validNames = ["LCP", "INP", "CLS", "TTFB", "FCP"];
    for (const name of validNames) {
      const metric = {
        id: `m-${name}`,
        name,
        value: 100,
        route: "/dashboard",
        timestamp: Date.now(),
      };
      const parsed = metricItemSchema.safeParse(metric);
      expect(parsed.success).toBe(true);
    }
  });

  it("enforces PF-R111: detects PII in metric payloads", () => {
    expect(containsProhibitedPii({ studentId: "stu_123" })).toBe(true);
    expect(containsProhibitedPii({ student_id: "stu_123" })).toBe(true);
    expect(containsProhibitedPii({ aadhaar: "999988887777" })).toBe(true);
    expect(containsProhibitedPii({ studentName: "Aarav" })).toBe(true);
    expect(containsProhibitedPii({ schoolId: "sch_1", role: "ADMIN", route: "/dashboard" })).toBe(false);
  });
});
