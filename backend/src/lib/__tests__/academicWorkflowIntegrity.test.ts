import { describe, expect, it } from "vitest";
import { gradeToClassGroup } from "../gradeRuleResolver";
import { sanitizeForSpreadsheet } from "../xlsx/xlsxHelper";

describe("Academic Workflow Integrity", () => {
  describe("gradeToClassGroup", () => {
    it("maps pre-primary grades to NURSERY_UKG", () => {
      expect(gradeToClassGroup("Nursery")).toBe("NURSERY_UKG");
      expect(gradeToClassGroup("LKG")).toBe("NURSERY_UKG");
      expect(gradeToClassGroup("UKG")).toBe("NURSERY_UKG");
    });

    it("maps primary grades 1-5 to CLASS_1_5", () => {
      expect(gradeToClassGroup("Class 1")).toBe("CLASS_1_5");
      expect(gradeToClassGroup("3")).toBe("CLASS_1_5");
      expect(gradeToClassGroup("5")).toBe("CLASS_1_5");
    });

    it("maps middle grades 6-8 to CLASS_6_8", () => {
      expect(gradeToClassGroup("Class 6")).toBe("CLASS_6_8");
      expect(gradeToClassGroup("7")).toBe("CLASS_6_8");
      expect(gradeToClassGroup("Class 8")).toBe("CLASS_6_8");
    });

    it("maps secondary grades 9-10 to CLASS_9_10", () => {
      expect(gradeToClassGroup("Class 9")).toBe("CLASS_9_10");
      expect(gradeToClassGroup("10")).toBe("CLASS_9_10");
    });

    it("maps senior secondary grades 11-12 to CLASS_11_12", () => {
      expect(gradeToClassGroup("Class 11")).toBe("CLASS_11_12");
      expect(gradeToClassGroup("12")).toBe("CLASS_11_12");
    });
  });

  describe("sanitizeForSpreadsheet (formula injection protection)", () => {
    it("prefixes dangerous formula-triggering characters with a single quote", () => {
      expect(sanitizeForSpreadsheet("=CMD('calc')")).toBe("'=CMD('calc')");
      expect(sanitizeForSpreadsheet("+1+1")).toBe("'+1+1");
      expect(sanitizeForSpreadsheet("-1+1")).toBe("'-1+1");
      expect(sanitizeForSpreadsheet("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
      expect(sanitizeForSpreadsheet("\tcmd")).toBe("'\tcmd");
      expect(sanitizeForSpreadsheet("\rcmd")).toBe("'\rcmd");
    });

    it("leaves safe strings and empty strings unchanged", () => {
      expect(sanitizeForSpreadsheet("Aarav Sharma")).toBe("Aarav Sharma");
      expect(sanitizeForSpreadsheet("100")).toBe("100");
      expect(sanitizeForSpreadsheet("")).toBe("");
    });
  });

  describe("Roll number & class teacher assignment invariants", () => {
    it("assigns unique sequential roll numbers per section without duplicates", () => {
      const students = [
        { id: "s2", name: "Zoya Khan", admissionNumber: "ADM-002" },
        { id: "s1", name: "Aarav Sharma", admissionNumber: "ADM-001" },
        { id: "s3", name: "Kabir Verma", admissionNumber: "ADM-003" },
      ];

      const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name));
      const assigned = sorted.map((student, idx) => ({
        ...student,
        rollNumber: idx + 1,
      }));

      const rollNumbers = assigned.map((s) => s.rollNumber);
      expect(new Set(rollNumbers).size).toBe(students.length);
      expect(rollNumbers).toEqual([1, 2, 3]);
      expect(assigned[0]?.name).toBe("Aarav Sharma");
    });

    it("enforces single active class teacher per section and per teacher in an academic year", () => {
      type Assignment = {
        academicYearId: string;
        sectionId: string;
        teacherId: string;
        isActive: boolean;
      };

      const assignments: Assignment[] = [
        { academicYearId: "ay-1", sectionId: "sec-1", teacherId: "t-1", isActive: true },
        { academicYearId: "ay-1", sectionId: "sec-2", teacherId: "t-2", isActive: true },
      ];

      const hasTeacherConflict = (teacherId: string, sectionId: string, academicYearId: string) =>
        assignments.some(
          (a) =>
            a.isActive &&
            a.academicYearId === academicYearId &&
            a.teacherId === teacherId &&
            a.sectionId !== sectionId,
        );

      const hasSectionConflict = (sectionId: string, teacherId: string, academicYearId: string) =>
        assignments.some(
          (a) =>
            a.isActive &&
            a.academicYearId === academicYearId &&
            a.sectionId === sectionId &&
            a.teacherId !== teacherId,
        );

      expect(hasTeacherConflict("t-1", "sec-2", "ay-1")).toBe(true);
      expect(hasTeacherConflict("t-1", "sec-1", "ay-1")).toBe(false);
      expect(hasSectionConflict("sec-1", "t-2", "ay-1")).toBe(true);
      expect(hasSectionConflict("sec-1", "t-1", "ay-1")).toBe(false);
    });
  });
});
