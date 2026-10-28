import { describe, it, expect } from "vitest";
import {
  ALL_CANONICAL_BLUEPRINTS,
  getCanonicalBlueprint,
  listAvailableBlueprints,
  CanonicalBlueprint,
} from "../lib/canonicalBlueprints";

describe("Sprint S20: Canonical Blueprint Catalog & Specification Invariants", () => {
  it("should have at least 6 authoritative canonical blueprints registered", () => {
    expect(ALL_CANONICAL_BLUEPRINTS.length).toBeGreaterThanOrEqual(6);
    expect(listAvailableBlueprints().length).toBe(ALL_CANONICAL_BLUEPRINTS.length);
  });

  it("should retrieve specific blueprints by ID", () => {
    const cbse = getCanonicalBlueprint("cbse-secondary-v1");
    expect(cbse).toBeDefined();
    expect(cbse?.board).toBe("CBSE");
    expect(cbse?.displayName).toContain("CBSE Secondary");

    const icse = getCanonicalBlueprint("icse-secondary-v1");
    expect(icse).toBeDefined();
    expect(icse?.board).toBe("ICSE");

    const karnataka = getCanonicalBlueprint("state-board-karnataka-v1");
    expect(karnataka).toBeDefined();
    expect(karnataka?.board).toBe("STATE_BOARD");

    const ib = getCanonicalBlueprint("ib-pyp-myp-v1");
    expect(ib).toBeDefined();
    expect(ib?.board).toBe("IB");
  });

  it("should guarantee unique blueprint IDs across the catalog", () => {
    const ids = ALL_CANONICAL_BLUEPRINTS.map((b) => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  describe.each(ALL_CANONICAL_BLUEPRINTS)(
    "Blueprint Invariants: $id ($displayName)",
    (blueprint: CanonicalBlueprint) => {
      it("has a valid version and school type", () => {
        expect(blueprint.version).toBe("1.0.0");
        expect(["PRIMARY", "SECONDARY", "SENIOR_SECONDARY", "INTEGRATED"]).toContain(
          blueprint.schoolType
        );
      });

      it("contains non-empty class progression with valid sections", () => {
        expect(blueprint.classes.length).toBeGreaterThan(0);
        for (const cls of blueprint.classes) {
          expect(cls.name).toBeTruthy();
          expect(typeof cls.numericLevel).toBe("number");
          expect(cls.defaultSections.length).toBeGreaterThan(0);
        }
      });

      it("contains curriculum subjects with positive weekly periods", () => {
        expect(blueprint.subjects.length).toBeGreaterThan(0);
        for (const sub of blueprint.subjects) {
          expect(sub.name).toBeTruthy();
          expect(sub.code).toBeTruthy();
          expect(sub.weeklyPeriods).toBeGreaterThan(0);
          expect([
            "THEORY",
            "PRACTICAL",
            "LANGUAGE",
            "ACTIVITY",
            "CO_SCHOLASTIC",
          ]).toContain(sub.subjectType);
        }
      });

      it("has a coherent bell schedule with valid periods", () => {
        const schedule = blueprint.bellSchedule;
        expect(schedule.workingDays.length).toBeGreaterThanOrEqual(5);
        expect(schedule.periodsPerDay).toBeGreaterThanOrEqual(6);
        expect(schedule.periods.length).toBeGreaterThan(0);

        for (const p of schedule.periods) {
          expect(p.durationMinutes).toBeGreaterThan(0);
          expect(p.startTime).toMatch(/^\d{2}:\d{2}$/);
          expect(p.endTime).toMatch(/^\d{2}:\d{2}$/);
        }
      });

      it("contains non-empty fee heads with valid frequencies", () => {
        expect(blueprint.feeHeads.length).toBeGreaterThan(0);
        for (const fh of blueprint.feeHeads) {
          expect(fh.name).toBeTruthy();
          expect([
            "MONTHLY",
            "QUARTERLY",
            "HALF_YEARLY",
            "ANNUAL",
            "ONE_TIME",
          ]).toContain(fh.frequency);
          expect([
            "TUITION",
            "ADMISSION",
            "TRANSPORT",
            "HOSTEL",
            "LAB",
            "LIBRARY",
            "EXAM",
            "EXAMINATION",
            "MISCELLANEOUS",
          ]).toContain(fh.headType);
        }
      });

      it("contains valid statutory salary grades with positive basic pay", () => {
        expect(blueprint.salaryGrades.length).toBeGreaterThan(0);
        for (const sg of blueprint.salaryGrades) {
          expect(sg.gradeName).toBeTruthy();
          expect(sg.basicSalaryPaise).toBeGreaterThan(0);
          expect(sg.hraPercent).toBeGreaterThanOrEqual(0);
          expect(sg.daPercent).toBeGreaterThanOrEqual(0);
          expect(sg.pfPercent).toBeGreaterThanOrEqual(0);
        }
      });

      it("contains valid annual holidays with month (1-12) and day (1-31)", () => {
        expect(blueprint.holidays.length).toBeGreaterThan(0);
        for (const hol of blueprint.holidays) {
          expect(hol.name).toBeTruthy();
          expect(hol.month).toBeGreaterThanOrEqual(1);
          expect(hol.month).toBeLessThanOrEqual(12);
          expect(hol.day).toBeGreaterThanOrEqual(1);
          expect(hol.day).toBeLessThanOrEqual(31);
          expect(["NATIONAL", "REGIONAL", "FESTIVAL"]).toContain(hol.holidayType);
        }
      });

      it("contains system role defaults including SUPER_ADMIN, SCHOOL_ADMIN, TEACHER", () => {
        expect(blueprint.roleDefaults.length).toBeGreaterThan(0);
        const roleNames = blueprint.roleDefaults.map((r) => r.roleName);
        expect(roleNames).toContain("SUPER_ADMIN");
        expect(roleNames).toContain("SCHOOL_ADMIN");
        expect(roleNames).toContain("TEACHER");
      });
    }
  );
});
