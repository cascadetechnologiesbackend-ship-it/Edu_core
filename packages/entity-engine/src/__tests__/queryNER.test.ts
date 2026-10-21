import { describe, expect, it } from "vitest";
import { parseOmniboxQuery } from "../query-ner";
import { foldDevanagariNumerals } from "../query-ner/patterns";
import { isKnownRoute, ROUTE_REGISTRY } from "../query-ner/routes";

describe("Omnibox Query NER Parser", () => {
  it("parses high-intent marks entry query with class, section, and subject", () => {
    const res = parseOmniboxQuery("enter marks class 10-A mathematics");

    expect(res.rawQuery).toBe("enter marks class 10-A mathematics");
    expect(res.primaryIntent?.type).toBe("ENTER_MARKS");
    expect(res.primaryIntent?.targetDomain).toBe("EXAMINATIONS");
    // Route now uses ROUTE_REGISTRY — /exams/marks (not /admin/exams/marks)
    expect(res.targetRoute).toContain("/exams/marks");
    expect(res.targetRoute).not.toContain("/admin/");
    expect(res.targetRoute).toContain("grade=10");
    expect(res.targetRoute).toContain("section=A");
    expect(res.targetRoute).toContain("subject=Mathematics");

    const entities = res.recognizedEntities;
    expect(entities.some((e) => e.type === "ACTION_INTENT" && e.normalized === "ENTER_MARKS")).toBe(true);
    expect(entities.some((e) => e.type === "CLASS_SECTION" && e.normalized === "Class 10-A")).toBe(true);
    expect(entities.some((e) => e.type === "SUBJECT" && e.normalized === "Mathematics")).toBe(true);
    expect(res.parseDurationMs).toBeLessThan(20);
  });

  it("parses fee due query with fee head — route points to /fees", () => {
    const res = parseOmniboxQuery("tuition fee dues");

    expect(res.primaryIntent?.type).toBe("VIEW_FEE_DUES");
    expect(res.primaryIntent?.targetDomain).toBe("FEES_FINANCE");
    // /fees is the real top-level route (fees page handles dues via query params)
    expect(res.targetRoute).toContain("/fees");
    expect(res.targetRoute).not.toContain("/admin/");
    expect(res.targetRoute).toContain("feeHead=Tuition+Fee");
    expect(res.recognizedEntities.some((e) => e.type === "FEE_HEAD")).toBe(true);
  });

  it("parses bus tracking queries with route number — route points to /transport", () => {
    const res = parseOmniboxQuery("where is bus route 4");

    expect(res.primaryIntent?.type).toBe("TRACK_BUS");
    expect(res.primaryIntent?.targetDomain).toBe("TRANSPORT");
    // /transport is the real route (has GPS tab with route param)
    expect(res.targetRoute).toContain("/transport");
    expect(res.targetRoute).not.toContain("/admin/");
    expect(res.targetRoute).toContain("route=4");
  });

  it("parses report card generation query — route points to /exams/report-cards", () => {
    const res = parseOmniboxQuery("generate report card class 5-b");

    expect(res.primaryIntent?.type).toBe("VIEW_REPORT_CARD");
    expect(res.primaryIntent?.targetDomain).toBe("EXAMINATIONS");
    expect(res.targetRoute).toContain("/exams/report-cards");
    expect(res.targetRoute).not.toContain("/admin/");
    expect(res.targetRoute).toContain("grade=5");
    expect(res.targetRoute).toContain("section=B");
  });

  it("parses attendance intent — route points to /attendance", () => {
    const res = parseOmniboxQuery("mark attendance class 8-A");

    expect(res.primaryIntent?.type).toBe("TAKE_ATTENDANCE");
    expect(res.targetRoute).toContain("/attendance");
    expect(res.targetRoute).not.toContain("/admin/");
    expect(res.confidenceScore).toBeGreaterThanOrEqual(0.80);
  });

  it("parses student profile intent — route points to /students", () => {
    const res = parseOmniboxQuery("student profile class 7-B");

    expect(res.primaryIntent?.type).toBe("VIEW_STUDENT_PROFILE");
    expect(res.targetRoute).toContain("/students");
    expect(res.targetRoute).not.toContain("/admin/");
  });

  it("parses staff profile intent — route points to /hr", () => {
    const res = parseOmniboxQuery("staff directory teacher list");

    expect(res.primaryIntent?.type).toBe("VIEW_STAFF_PROFILE");
    expect(res.targetRoute).toContain("/hr");
    expect(res.targetRoute).not.toContain("/admin/");
  });

  it("parses notice creation intent — route points to /communication/notices", () => {
    const res = parseOmniboxQuery("create notice announcement");

    expect(res.primaryIntent?.type).toBe("CREATE_NOTICE");
    expect(res.targetRoute).toContain("/communication/notices");
    expect(res.targetRoute).not.toContain("/admin/");
  });

  it("handles fallback query gracefully — SEARCH_GENERAL emits NO route", () => {
    const res = parseOmniboxQuery("random nonexistent keyword");

    expect(res.primaryIntent?.type).toBe("SEARCH_GENERAL");
    // SEARCH_GENERAL must NOT emit a route — palette falls back to searchEverything results
    expect(res.targetRoute).toBeUndefined();
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

  // ─── Golden Corpus Route Validation ─────────────────────────────────────────
  // Every route emitted for known-good queries must be a real app route.
  describe("golden corpus — all emitted routes are real app routes (AC-E2)", () => {
    const goldenCorpus: { query: string; expectedIntentType: string }[] = [
      { query: "enter marks class 10-A mathematics", expectedIntentType: "ENTER_MARKS" },
      { query: "marks entry 10-A", expectedIntentType: "ENTER_MARKS" },
      { query: "exam marks class 10-A mathematics", expectedIntentType: "VIEW_MARKS" },
      { query: "view marks class 9-B term 1", expectedIntentType: "VIEW_MARKS" },
      { query: "report card class 5-B", expectedIntentType: "VIEW_REPORT_CARD" },
      { query: "generate report card", expectedIntentType: "VIEW_REPORT_CARD" },
      { query: "exam schedule", expectedIntentType: "MANAGE_EXAM_SCHEDULE" },
      { query: "date sheet", expectedIntentType: "MANAGE_EXAM_SCHEDULE" },
      { query: "mark attendance class 8-A", expectedIntentType: "TAKE_ATTENDANCE" },
      { query: "attendance today class 6-C", expectedIntentType: "VIEW_ATTENDANCE" },
      { query: "collect fee", expectedIntentType: "COLLECT_FEE" },
      { query: "tuition fee dues class 7", expectedIntentType: "VIEW_FEE_DUES" },
      { query: "fee dues", expectedIntentType: "VIEW_FEE_DUES" },
      { query: "track bus route 5", expectedIntentType: "TRACK_BUS" },
      { query: "where is bus 3", expectedIntentType: "TRACK_BUS" },
      { query: "student profile class 7-B", expectedIntentType: "VIEW_STUDENT_PROFILE" },
      { query: "staff directory", expectedIntentType: "VIEW_STAFF_PROFILE" },
      { query: "timetable class 9", expectedIntentType: "VIEW_TIMETABLE" },
      { query: "create notice", expectedIntentType: "CREATE_NOTICE" },
      { query: "send circular", expectedIntentType: "CREATE_NOTICE" },
    ];

    for (const { query, expectedIntentType } of goldenCorpus) {
      it(`"${query}" → intent ${expectedIntentType} → real route`, () => {
        const res = parseOmniboxQuery(query);
        expect(res.primaryIntent?.type).toBe(expectedIntentType);
        // If a route is emitted, it MUST be a known real route
        if (res.targetRoute) {
          expect(
            isKnownRoute(res.targetRoute),
            `Route "${res.targetRoute}" is not in REAL_ADMIN_ROUTES (query: "${query}")`
          ).toBe(true);
          // Absolutely no /admin/ prefix allowed
          expect(res.targetRoute).not.toMatch(/^\/admin\//);
        }
      });
    }
  });

  // ─── ROUTE_REGISTRY completeness guard ──────────────────────────────────────
  it("every ROUTE_REGISTRY value is a known real app route", () => {
    for (const [intent, route] of Object.entries(ROUTE_REGISTRY)) {
      expect(
        isKnownRoute(route),
        `ROUTE_REGISTRY["${intent}"] = "${route}" is not a known real route`
      ).toBe(true);
    }
  });

  // ─── Phase E5: Bilingual (Devanagari / Hindi) & Numeral Folding ─────────────
  describe("Phase E5: Bilingual (Hindi/Devanagari) NER & Numeral Folding", () => {
    it("correctly folds Devanagari numerals ०-९ to standard ASCII digits", () => {
      expect(foldDevanagariNumerals("०१२३४५६७८९")).toBe("0123456789");
      expect(foldDevanagariNumerals("कक्षा १०-ए")).toBe("कक्षा 10-ए");
      expect(foldDevanagariNumerals("बस रूट ४")).toBe("बस रूट 4");
    });

    it("parses Devanagari marks entry query with Devanagari numerals and Hindi subject", () => {
      const res = parseOmniboxQuery("अंक दर्ज करें कक्षा १०-ए गणित");

      expect(res.primaryIntent?.type).toBe("ENTER_MARKS");
      expect(res.primaryIntent?.targetDomain).toBe("EXAMINATIONS");
      expect(res.targetRoute).toContain("/exams/marks");
      expect(res.targetRoute).toContain("grade=10");
      expect(res.targetRoute).toContain("section=A");
      expect(res.targetRoute).toContain("subject=Mathematics");

      const entities = res.recognizedEntities;
      expect(entities.some((e) => e.type === "ACTION_INTENT" && e.normalized === "ENTER_MARKS")).toBe(true);
      expect(entities.some((e) => e.type === "CLASS_SECTION" && e.normalized === "Class 10-A")).toBe(true);
      expect(entities.some((e) => e.type === "SUBJECT" && e.normalized === "Mathematics")).toBe(true);
      expect(res.confidenceScore).toBeGreaterThanOrEqual(0.85);
    });

    it("parses Devanagari attendance intent with section letter and Hindi keywords", () => {
      const res = parseOmniboxQuery("हाज़िरी लगाएं कक्षा 8-ब");

      expect(res.primaryIntent?.type).toBe("TAKE_ATTENDANCE");
      expect(res.primaryIntent?.targetDomain).toBe("ATTENDANCE");
      expect(res.targetRoute).toContain("/attendance");
      expect(res.targetRoute).toContain("grade=8");
      expect(res.targetRoute).toContain("section=B");
    });

    it("parses Devanagari fee dues query with grade", () => {
      const res = parseOmniboxQuery("बकाया फीस कक्षा 7");

      expect(res.primaryIntent?.type).toBe("VIEW_FEE_DUES");
      expect(res.primaryIntent?.targetDomain).toBe("FEES_FINANCE");
      expect(res.targetRoute).toContain("/fees");
      expect(res.targetRoute).toContain("grade=7");
    });

    it("parses Devanagari transport fee head query", () => {
      const res = parseOmniboxQuery("परिवहन शुल्क");

      expect(res.primaryIntent?.type).toBe("VIEW_FEE_DUES");
      expect(res.primaryIntent?.targetDomain).toBe("FEES_FINANCE");
      expect(res.targetRoute).toContain("/fees");
      expect(res.targetRoute).toContain("feeHead=Transport+Fee");
    });

    it("parses Devanagari live bus tracking query with route number", () => {
      const res = parseOmniboxQuery("बस कहां है बस रूट ४");

      expect(res.primaryIntent?.type).toBe("TRACK_BUS");
      expect(res.primaryIntent?.targetDomain).toBe("TRANSPORT");
      expect(res.targetRoute).toContain("/transport");
      expect(res.targetRoute).toContain("route=4");
    });

    it("parses Devanagari report card query with class", () => {
      const res = parseOmniboxQuery("प्रगति पत्रक कक्षा 5-ब");

      expect(res.primaryIntent?.type).toBe("VIEW_REPORT_CARD");
      expect(res.primaryIntent?.targetDomain).toBe("EXAMINATIONS");
      expect(res.targetRoute).toContain("/exams/report-cards");
      expect(res.targetRoute).toContain("grade=5");
      expect(res.targetRoute).toContain("section=B");
    });

    it("parses Devanagari exam marks view with exam name", () => {
      const res = parseOmniboxQuery("अर्धवार्षिक परीक्षा परिणाम");

      expect(res.primaryIntent?.type).toBe("VIEW_MARKS");
      expect(res.primaryIntent?.targetDomain).toBe("EXAMINATIONS");
      expect(res.targetRoute).toContain("/exams/results");
      expect(res.targetRoute).toContain("exam=Half+Yearly");
    });

    it("parses Devanagari staff directory intent", () => {
      const res = parseOmniboxQuery("शिक्षक सूची");

      expect(res.primaryIntent?.type).toBe("VIEW_STAFF_PROFILE");
      expect(res.primaryIntent?.targetDomain).toBe("HR_STAFF");
      expect(res.targetRoute).toContain("/hr");
    });

    it("parses Devanagari student profile search intent", () => {
      const res = parseOmniboxQuery("छात्र खोजें");

      expect(res.primaryIntent?.type).toBe("VIEW_STUDENT_PROFILE");
      expect(res.primaryIntent?.targetDomain).toBe("STUDENTS_LIFECYCLE");
      expect(res.targetRoute).toContain("/students");
    });

    it("parses Devanagari notice broadcast intent", () => {
      const res = parseOmniboxQuery("सूचना जारी करें");

      expect(res.primaryIntent?.type).toBe("CREATE_NOTICE");
      expect(res.primaryIntent?.targetDomain).toBe("COMMUNICATION");
      expect(res.targetRoute).toContain("/communication/notices");
    });

    it("parses Romanized Hindi (Hinglish) marks entry query", () => {
      const res = parseOmniboxQuery("marks entry kaksha 10-A ganit");

      expect(res.primaryIntent?.type).toBe("ENTER_MARKS");
      expect(res.targetRoute).toContain("/exams/marks");
      expect(res.targetRoute).toContain("grade=10");
      expect(res.targetRoute).toContain("section=A");
      expect(res.targetRoute).toContain("subject=Mathematics");
    });

    it("executes bilingual parsing in < 5ms average over 50 iterations", () => {
      const queries = [
        "अंक दर्ज करें कक्षा १०-ए गणित",
        "हाज़िरी लगाएं कक्षा 8-ब",
        "बकाया फीस कक्षा 7",
        "बस कहां है बस रूट ४",
        "marks entry kaksha 10-A ganit",
      ];
      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        parseOmniboxQuery(queries[i % queries.length]);
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / 50;
      expect(avgMs).toBeLessThan(5);
    });
  });
});
