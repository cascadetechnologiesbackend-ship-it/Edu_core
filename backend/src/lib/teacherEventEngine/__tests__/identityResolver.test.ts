import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  batchResolveStudentIdentities,
  batchResolveSectionContexts,
  batchResolveSubjectContexts,
} from "../identityResolver";

vi.mock("../../encryption", () => ({
  decryptData: vi.fn((val: string | null) => {
    if (!val) return null;
    if (val === "corrupted") throw new Error("Decryption failed");
    if (val.startsWith("enc_")) return val.replace("enc_", "");
    return val;
  }),
}));

describe("S24 L1: Shared Identity Resolver (identityResolver.ts)", () => {
  const schoolId = "school-test-uuid";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("batchResolveStudentIdentities", () => {
    it("returns an empty Map when studentIds is empty or contains only falsy values", async () => {
      const mockTx = {
        query: {
          students: { findMany: vi.fn() },
          sections: { findMany: vi.fn() },
        },
      };

      const resEmpty = await batchResolveStudentIdentities(schoolId, [], mockTx);
      expect(resEmpty.size).toBe(0);
      expect(mockTx.query.students.findMany).not.toHaveBeenCalled();

      const resFalsy = await batchResolveStudentIdentities(schoolId, ["", null as any], mockTx);
      expect(resFalsy.size).toBe(0);
      expect(mockTx.query.students.findMany).not.toHaveBeenCalled();
    });

    it("resolves and decrypts student identities with linked class/section contexts in a single pass", async () => {
      const mockStudents = [
        {
          id: "stu-1",
          firstNameEncrypted: "enc_Aarav",
          lastNameEncrypted: "enc_Sharma",
          rollNumber: "101",
          currentClassId: "cls-6",
          currentSectionId: "sec-6a",
        },
        {
          id: "stu-2",
          firstNameEncrypted: "enc_Diya",
          lastNameEncrypted: null,
          rollNumber: "102",
          currentClassId: "cls-6",
          currentSectionId: "sec-6a",
        },
      ];

      const mockSections = [
        {
          id: "sec-6a",
          name: "A",
          class: { displayName: "Class 6", gradeLevel: "CLASS_6" },
        },
      ];

      const mockTx = {
        query: {
          students: {
            findMany: vi.fn().mockResolvedValue(mockStudents),
          },
          sections: {
            findMany: vi.fn().mockResolvedValue(mockSections),
          },
        },
      };

      const result = await batchResolveStudentIdentities(schoolId, ["stu-1", "stu-2"], mockTx);

      expect(result.size).toBe(2);

      const stu1 = result.get("stu-1");
      expect(stu1).toBeDefined();
      expect(stu1?.fullName).toBe("Aarav Sharma");
      expect(stu1?.firstName).toBe("Aarav");
      expect(stu1?.lastName).toBe("Sharma");
      expect(stu1?.rollNumber).toBe("101");
      expect(stu1?.sectionName).toBe("A");
      expect(stu1?.className).toBe("Class 6");
      expect(stu1?.classSectionDisplayName).toBe("Class 6-A");

      const stu2 = result.get("stu-2");
      expect(stu2).toBeDefined();
      expect(stu2?.fullName).toBe("Diya");
      expect(stu2?.lastName).toBe("");
      expect(stu2?.rollNumber).toBe("102");
    });

    it("adheres to Honesty Law: never emits placeholder strings like 'Student' or 'Section'", async () => {
      const mockStudents = [
        {
          id: "stu-corrupt",
          firstNameEncrypted: "corrupted",
          lastNameEncrypted: "corrupted",
          rollNumber: null,
          currentClassId: null,
          currentSectionId: null,
        },
      ];

      const mockTx = {
        query: {
          students: {
            findMany: vi.fn().mockResolvedValue(mockStudents),
          },
          sections: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      };

      const result = await batchResolveStudentIdentities(schoolId, ["stu-corrupt"], mockTx);
      const stu = result.get("stu-corrupt");

      expect(stu).toBeDefined();
      expect(stu?.fullName).toBe("");
      expect(stu?.fullName).not.toContain("Student");
      expect(stu?.sectionName).toBe("");
      expect(stu?.sectionName).not.toContain("Section");
    });
  });

  describe("batchResolveSectionContexts", () => {
    it("returns an empty Map when sectionIds is empty", async () => {
      const mockTx = {
        query: {
          sections: { findMany: vi.fn() },
        },
      };

      const res = await batchResolveSectionContexts(schoolId, [], mockTx);
      expect(res.size).toBe(0);
      expect(mockTx.query.sections.findMany).not.toHaveBeenCalled();
    });

    it("correctly resolves sections with class display names", async () => {
      const mockSections = [
        {
          id: "sec-9b",
          name: "B",
          class: { displayName: "Grade 9", gradeLevel: "CLASS_9" },
        },
      ];

      const mockTx = {
        query: {
          sections: {
            findMany: vi.fn().mockResolvedValue(mockSections),
          },
        },
      };

      const res = await batchResolveSectionContexts(schoolId, ["sec-9b"], mockTx);
      expect(res.size).toBe(1);

      const sec = res.get("sec-9b");
      expect(sec?.sectionName).toBe("B");
      expect(sec?.className).toBe("Grade 9");
      expect(sec?.classSectionDisplayName).toBe("Grade 9-B");
    });
  });

  describe("batchResolveSubjectContexts", () => {
    it("returns an empty Map when subjectIds is empty", async () => {
      const mockTx = {
        query: {
          subjects: { findMany: vi.fn() },
        },
      };

      const res = await batchResolveSubjectContexts(schoolId, [], mockTx);
      expect(res.size).toBe(0);
      expect(mockTx.query.subjects.findMany).not.toHaveBeenCalled();
    });

    it("resolves subject names and configured maxMarks accurately", async () => {
      const mockSubjects = [
        {
          id: "sub-sci",
          name: "Integrated Science",
          maxMarks: 80,
        },
        {
          id: "sub-eng",
          name: "English Literature",
          maxMarks: 100,
        },
      ];

      const mockTx = {
        query: {
          subjects: {
            findMany: vi.fn().mockResolvedValue(mockSubjects),
          },
        },
      };

      const res = await batchResolveSubjectContexts(schoolId, ["sub-sci", "sub-eng"], mockTx);
      expect(res.size).toBe(2);

      const sci = res.get("sub-sci");
      expect(sci?.subjectName).toBe("Integrated Science");
      expect(sci?.maxMarks).toBe(80);

      const eng = res.get("sub-eng");
      expect(eng?.subjectName).toBe("English Literature");
      expect(eng?.maxMarks).toBe(100);
    });
  });
});
