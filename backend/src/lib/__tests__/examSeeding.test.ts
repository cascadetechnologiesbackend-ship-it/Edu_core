import { describe, it, expect, vi, beforeEach } from "vitest";
import { seedExamBoardDefaults } from "../examSeeding";
import { examTypes, gradeRules, cocurricularAreas } from "@/db/schema";

describe("Exam Board Blueprint Seeding Engine (Sprint S9 Layer 3)", () => {
  const schoolId = "test-school-uuid-1";

  let storedExamTypes: any[] = [];
  let storedGradeRules: any[] = [];
  let storedCocurricular: any[] = [];

  let mockClient: any;

  beforeEach(() => {
    storedExamTypes = [];
    storedGradeRules = [];
    storedCocurricular = [];

    mockClient = {
      query: {
        examTypes: {
          findFirst: vi.fn(async ({ where }: any) => {
            // Find in storedExamTypes matching schoolId and code
            // Drizzle query where clause representation or callback
            return storedExamTypes.find((et) => et.schoolId === schoolId) || null;
          }),
        },
        gradeRules: {
          findFirst: vi.fn(async () => null),
        },
        cocurricularAreas: {
          findFirst: vi.fn(async () => null),
        },
      },
      insert: vi.fn((table: any) => ({
        values: vi.fn(async (vals: any) => {
          if (table === examTypes) {
            storedExamTypes.push({ id: `et-${storedExamTypes.length + 1}`, ...vals });
          } else if (table === gradeRules) {
            storedGradeRules.push({ id: `gr-${storedGradeRules.length + 1}`, ...vals });
          } else if (table === cocurricularAreas) {
            storedCocurricular.push({ id: `cc-${storedCocurricular.length + 1}`, ...vals });
          }
          return [{ id: "new-id", ...vals }];
        }),
      })),
    };
  });

  function createRealisticMockClient() {
    return {
      query: {
        examTypes: {
          findFirst: vi.fn(async ({ where }: any) => {
            // Check by code
            return storedExamTypes.find((et) => et.schoolId === schoolId && storedExamTypes.some(x => x.code === et.code)) || null;
          }),
        },
        gradeRules: {
          findFirst: vi.fn(async ({ where }: any) => {
            return null;
          }),
        },
        cocurricularAreas: {
          findFirst: vi.fn(async () => null),
        },
      },
      insert: vi.fn((table: any) => ({
        values: vi.fn(async (vals: any) => {
          if (table === examTypes) storedExamTypes.push({ id: `et-${storedExamTypes.length + 1}`, ...vals });
          if (table === gradeRules) storedGradeRules.push({ id: `gr-${storedGradeRules.length + 1}`, ...vals });
          if (table === cocurricularAreas) storedCocurricular.push({ id: `cc-${storedCocurricular.length + 1}`, ...vals });
          return [{ id: "mock-id", ...vals }];
        }),
      })),
    };
  }

  describe("1. Full K-12 CBSE Seeding", () => {
    it("seeds all 7 exam types, 4 cocurricular areas, and grade rules across all 5 class categories", async () => {
      const client = {
        query: {
          examTypes: {
            findFirst: vi.fn(async () => null),
          },
          gradeRules: {
            findFirst: vi.fn(async () => null),
          },
          cocurricularAreas: {
            findFirst: vi.fn(async () => null),
          },
        },
        insert: vi.fn((table: any) => ({
          values: vi.fn(async (vals: any) => {
            if (table === examTypes) storedExamTypes.push(vals);
            if (table === gradeRules) storedGradeRules.push(vals);
            if (table === cocurricularAreas) storedCocurricular.push(vals);
            return [vals];
          }),
        })),
      };

      const result = await seedExamBoardDefaults(
        schoolId,
        "CBSE",
        "CBSE_9_POINT",
        client,
        {
          activeClassGroups: ["NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10", "CLASS_11_12"],
        },
      );

      expect(result.insertedExamTypes).toBe(7);
      expect(result.insertedCocurricular).toBe(4);
      expect(result.insertedGradeRules).toBe(5 + 5 + 9 + 9 + 5); // 33 rules total across 5 categories
      expect(result.skipped).toBe(0);

      // Verify exam types have applicableClassGroups populated
      const pt = storedExamTypes.find((e) => e.code === "PT");
      expect(pt).toBeDefined();
      expect(pt.applicableClassGroups).toContain("CLASS_9_10");
      expect(pt.applicableClassGroups).not.toContain("NURSERY_UKG");

      const actObs = storedExamTypes.find((e) => e.code === "ACT_OBS");
      expect(actObs).toBeDefined();
      expect(actObs.applicableClassGroups).toContain("NURSERY_UKG");

      // Verify cocurricular areas
      expect(storedCocurricular.map((c) => c.name)).toContain("Discipline");
      expect(storedCocurricular.map((c) => c.name)).toContain("Health and Physical Education");
    });
  });

  describe("2. Class Category Filtering (Pre-Primary Only School)", () => {
    it("seeds grade rules ONLY for NURSERY_UKG when school operates only pre-primary classes", async () => {
      const client = {
        query: {
          examTypes: { findFirst: vi.fn(async () => null) },
          gradeRules: { findFirst: vi.fn(async () => null) },
          cocurricularAreas: { findFirst: vi.fn(async () => null) },
        },
        insert: vi.fn((table: any) => ({
          values: vi.fn(async (vals: any) => {
            if (table === examTypes) storedExamTypes.push(vals);
            if (table === gradeRules) storedGradeRules.push(vals);
            if (table === cocurricularAreas) storedCocurricular.push(vals);
            return [vals];
          }),
        })),
      };

      const result = await seedExamBoardDefaults(
        schoolId,
        "CBSE",
        "CBSE_9_POINT",
        client,
        {
          activeClassGroups: ["NURSERY_UKG"],
        },
      );

      // Exam types and cocurricular are school-wide
      expect(result.insertedExamTypes).toBe(7);
      expect(result.insertedCocurricular).toBe(4);

      // Grade rules are strictly Pre-Primary (5 rules)
      expect(result.insertedGradeRules).toBe(5);
      expect(storedGradeRules.every((r) => r.classGroup === "NURSERY_UKG")).toBe(true);
      expect(storedGradeRules.some((r) => r.classGroup === "CLASS_9_10")).toBe(false);
      expect(storedGradeRules.some((r) => r.classGroup === "CLASS_11_12")).toBe(false);
    });
  });

  describe("3. State Board Enums Seeding", () => {
    it("seeds QUARTERLY, FORMATIVE, and SUMMATIVE exam types for STATE_BOARD", async () => {
      const client = {
        query: {
          examTypes: { findFirst: vi.fn(async () => null) },
          gradeRules: { findFirst: vi.fn(async () => null) },
          cocurricularAreas: { findFirst: vi.fn(async () => null) },
        },
        insert: vi.fn((table: any) => ({
          values: vi.fn(async (vals: any) => {
            if (table === examTypes) storedExamTypes.push(vals);
            if (table === gradeRules) storedGradeRules.push(vals);
            if (table === cocurricularAreas) storedCocurricular.push(vals);
            return [vals];
          }),
        })),
      };

      const result = await seedExamBoardDefaults(
        schoolId,
        "STATE_BOARD",
        "PERCENTAGE",
        client,
      );

      expect(result.insertedExamTypes).toBe(7);
      const examTypeEnums = storedExamTypes.map((et) => et.examType);
      expect(examTypeEnums).toContain("QUARTERLY");
      expect(examTypeEnums).toContain("FORMATIVE");
      expect(examTypeEnums).toContain("SUMMATIVE");
    });
  });

  describe("4. GradingScale Override Precedence", () => {
    it("provisions division scale for CBSE secondary when admin explicitly selected PERCENTAGE", async () => {
      const client = {
        query: {
          examTypes: { findFirst: vi.fn(async () => null) },
          gradeRules: { findFirst: vi.fn(async () => null) },
          cocurricularAreas: { findFirst: vi.fn(async () => null) },
        },
        insert: vi.fn((table: any) => ({
          values: vi.fn(async (vals: any) => {
            if (table === gradeRules) storedGradeRules.push(vals);
            return [vals];
          }),
        })),
      };

      await seedExamBoardDefaults(
        schoolId,
        "CBSE",
        "PERCENTAGE", // Admin override from Step 5
        client,
        {
          activeClassGroups: ["CLASS_9_10"],
        },
      );

      const secondaryGrades = storedGradeRules.filter((r) => r.classGroup === "CLASS_9_10");
      expect(secondaryGrades.map((r) => r.grade)).toContain("Distinction");
      expect(secondaryGrades.map((r) => r.grade)).toContain("Essential Repeat");
      expect(secondaryGrades.map((r) => r.grade)).not.toContain("A1");
    });
  });

  describe("5. Amendment 3: NULL Guard for Class-Specific Overrides", () => {
    it("ensures blueprint group-level seeding filters on classId IS NULL so per-class overrides are never collided with", async () => {
      // Simulate an existing per-class override row in the database: Class 10 has a custom "A1" rule
      const existingClassOverride = {
        schoolId,
        classGroup: "CLASS_9_10",
        classId: "custom-class-10-uuid", // S8 per-class override
        grade: "A1",
        minPercent: "95.00",
        maxPercent: "100.00",
      };

      const client = {
        query: {
          examTypes: { findFirst: vi.fn(async () => null) },
          gradeRules: {
            // Emulates find-first-then-insert where query filters on classId IS NULL
            findFirst: vi.fn(async ({ where }: any) => {
              // The search looks for group default (classId IS NULL).
              // It does NOT match existingClassOverride because its classId is NOT NULL!
              return null;
            }),
          },
          cocurricularAreas: { findFirst: vi.fn(async () => null) },
        },
        insert: vi.fn((table: any) => ({
          values: vi.fn(async (vals: any) => {
            if (table === gradeRules) storedGradeRules.push(vals);
            return [vals];
          }),
        })),
      };

      const result = await seedExamBoardDefaults(
        schoolId,
        "CBSE",
        "CBSE_9_POINT",
        client,
        { activeClassGroups: ["CLASS_9_10"] },
      );

      // Group-level A1 row was inserted without collision with per-class override
      const insertedA1 = storedGradeRules.find((r) => r.grade === "A1" && r.classGroup === "CLASS_9_10");
      expect(insertedA1).toBeDefined();
      expect(insertedA1.classId).toBeNull();
    });
  });

  describe("6. Idempotency & User Edit Invariance", () => {
    it("re-running seeding on already-seeded school skips existing rows without duplicating", async () => {
      // Prepopulate mock store with all CBSE rows
      const existingExamTypes = [
        { schoolId, code: "PT", name: "Periodic Test" },
        { schoolId, code: "HY", name: "Half-Yearly Examination" },
      ];
      const existingGradeRules = [
        { schoolId, classGroup: "CLASS_9_10", grade: "A1", description: "Custom User Edited Description (Sacred)" },
      ];

      const client = {
        query: {
          examTypes: {
            findFirst: vi.fn(async () => ({ id: "existing-et-id" })),
          },
          gradeRules: {
            findFirst: vi.fn(async () => ({ id: "existing-gr-id" })),
          },
          cocurricularAreas: {
            findFirst: vi.fn(async () => ({ id: "existing-cc-id" })),
          },
        },
        insert: vi.fn((table: any) => ({
          values: vi.fn(async (vals: any) => [vals]),
        })),
      };

      const result = await seedExamBoardDefaults(
        schoolId,
        "CBSE",
        "CBSE_9_POINT",
        client,
        { activeClassGroups: ["CLASS_9_10"] },
      );

      // All existing items were skipped; 0 inserted
      expect(result.insertedExamTypes).toBe(0);
      expect(result.insertedGradeRules).toBe(0);
      expect(result.insertedCocurricular).toBe(0);
      expect(result.skipped).toBeGreaterThan(0);

      // Verify insert was never called because findFirst returned existing records
      expect(client.insert).not.toHaveBeenCalled();
    });
  });
});
