import { describe, expect, it } from "vitest";
import { parseOmniboxQuery } from "../query-ner";

describe("Omnibox Query NER Parser", () => {
  it("parses high-intent marks entry query with class, section, and subject", () => {
    const res = parseOmniboxQuery("enter marks class 10-A mathematics");

    expect(res.rawQuery).toBe("enter marks class 10-A mathematics");
    expect(res.primaryIntent?.type).toBe("ENTER_MARKS");
    expect(res.primaryIntent?.targetDomain).toBe("EXAMINATIONS");
    expect(res.targetRoute).toContain("/admin/exams/marks");
    expect(res.targetRoute).toContain("grade=10");
    expect(res.targetRoute).toContain("section=A");
    expect(res.targetRoute).toContain("subject=Mathematics");

    const entities = res.recognizedEntities;
    expect(entities.some((e) => e.type === "ACTION_INTENT" && e.normalized === "ENTER_MARKS")).toBe(true);
    expect(entities.some((e) => e.type === "CLASS_SECTION" && e.normalized === "Class 10-A")).toBe(true);
    expect(entities.some((e) => e.type === "SUBJECT" && e.normalized === "Mathematics")).toBe(true);
    expect(res.parseDurationMs).toBeLessThan(20);
  });

  it("parses fee due query with fee head", () => {
    const res = parseOmniboxQuery("tuition fee dues");

    expect(res.primaryIntent?.type).toBe("VIEW_FEE_DUES");
    expect(res.primaryIntent?.targetDomain).toBe("FEES_FINANCE");
    expect(res.targetRoute).toContain("/admin/fees/dues");
    expect(res.targetRoute).toContain("feeHead=Tuition+Fee");
    expect(res.recognizedEntities.some((e) => e.type === "FEE_HEAD")).toBe(true);
  });

  it("parses bus tracking queries with route number", () => {
    const res = parseOmniboxQuery("where is bus route 4");

    expect(res.primaryIntent?.type).toBe("TRACK_BUS");
    expect(res.primaryIntent?.targetDomain).toBe("TRANSPORT");
    expect(res.targetRoute).toContain("/admin/transport/live");
    expect(res.targetRoute).toContain("route=4");
  });

  it("parses report card generation query", () => {
    const res = parseOmniboxQuery("generate report card class 5-b");

    expect(res.primaryIntent?.type).toBe("VIEW_REPORT_CARD");
    expect(res.primaryIntent?.targetDomain).toBe("EXAMINATIONS");
    expect(res.targetRoute).toContain("/admin/exams/report-cards");
    expect(res.targetRoute).toContain("grade=5");
    expect(res.targetRoute).toContain("section=B");
  });

  it("handles fallback query gracefully", () => {
    const res = parseOmniboxQuery("random nonexistent keyword");

    expect(res.primaryIntent?.type).toBe("SEARCH_GENERAL");
    expect(res.targetRoute).toBe("/admin/search?q=random%20nonexistent%20keyword");
    expect(res.confidenceScore).toBeLessThanOrEqual(0.6);
  });

  it("executes fast (< 5ms typical) deterministic parsing", () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      parseOmniboxQuery("enter marks class 12-C physics unit test 1");
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 50;
    expect(avgMs).toBeLessThan(10);
  });
});
