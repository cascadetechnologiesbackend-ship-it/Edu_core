import { describe, it, expect, vi } from "vitest";
import { resolveParentWards } from "../resolveParentWards";

// Mock encryption
vi.mock("../../encryption", () => ({
  decryptData: vi.fn((val: string) => {
    if (val === "enc_aarav") return "Aarav";
    if (val === "enc_sharma") return "Sharma";
    if (val === "enc_priya") return "Priya";
    return val;
  }),
}));

describe("Shared Ward Resolver (resolveParentWards)", () => {
  const schoolA = "school-tenant-a";
  const schoolB = "school-tenant-b";
  const parentUser = "parent-user-1";

  const mockStudents = [
    {
      id: "student-1",
      schoolId: schoolA,
      admissionNumber: "ADM-001",
      firstNameEncrypted: "enc_aarav",
      lastNameEncrypted: "enc_sharma",
      primaryParentUserId: parentUser,
      currentClassId: "class-10",
      currentSectionId: "sec-a",
      photoS3Key: "photos/student-1.jpg",
      isActive: true,
    },
    {
      id: "student-2",
      schoolId: schoolA,
      admissionNumber: "ADM-002",
      firstNameEncrypted: "enc_priya",
      lastNameEncrypted: "enc_sharma",
      primaryParentUserId: parentUser,
      currentClassId: "class-10",
      currentSectionId: "sec-b",
      photoS3Key: null,
      isActive: false, // inactive student
    },
    {
      id: "student-3",
      schoolId: schoolB, // different school
      admissionNumber: "ADM-B01",
      firstNameEncrypted: "enc_aarav",
      lastNameEncrypted: "enc_sharma",
      primaryParentUserId: parentUser,
      currentClassId: "class-9",
      currentSectionId: "sec-a",
      photoS3Key: null,
      isActive: true,
    },
  ];

  const mockClasses = [
    { id: "class-10", schoolId: schoolA, displayName: "Class 10", gradeLevel: "10" },
    { id: "class-9", schoolId: schoolB, displayName: "Class 9", gradeLevel: "9" },
  ];

  const mockSections = [
    { id: "sec-a", schoolId: schoolA, displayName: "A", name: "A" },
    { id: "sec-b", schoolId: schoolA, displayName: "B", name: "B" },
  ];

  function createMockTx() {
    return {
      query: {
        students: {
          findMany: vi.fn(async ({ where }: any) => {
            // Filter based on findMany simulation
            return mockStudents.filter((s) => {
              if (s.schoolId !== schoolA) return false;
              return true;
            });
          }),
        },
        classes: {
          findMany: vi.fn(async () => mockClasses.filter((c) => c.schoolId === schoolA)),
        },
        sections: {
          findMany: vi.fn(async () => mockSections.filter((sec) => sec.schoolId === schoolA)),
        },
      },
    };
  }

  it("resolves active wards linked to PARENT strictly within schoolId", async () => {
    const mockTx = {
      query: {
        students: {
          findMany: vi.fn(async () => [mockStudents[0]]),
        },
        classes: {
          findMany: vi.fn(async () => [mockClasses[0]]),
        },
        sections: {
          findMany: vi.fn(async () => [mockSections[0]]),
        },
      },
    };

    const wards = await resolveParentWards(
      { role: "PARENT", userId: parentUser },
      schoolA,
      null,
      mockTx
    );

    expect(wards).toHaveLength(1);
    expect(wards[0].id).toBe("student-1");
    expect(wards[0].fullName).toBe("Aarav Sharma");
    expect(wards[0].className).toBe("Class 10");
    expect(wards[0].sectionName).toBe("A");
    expect(wards[0].schoolId).toBe(schoolA);
    expect(wards[0].isActive).toBe(true);
  });

  it("returns empty array for ADMIN preview when searchParamStudentId is omitted (D6 demoStudent elimination)", async () => {
    const mockTx = createMockTx();

    const wards = await resolveParentWards(
      { role: "ADMIN", userId: "admin-user-1" },
      schoolA,
      null, // No studentId supplied
      mockTx
    );

    expect(wards).toHaveLength(0);
    expect(mockTx.query.students.findMany).not.toHaveBeenCalled();
  });

  it("resolves specific student for ADMIN preview when valid searchParamStudentId is provided", async () => {
    const mockTx = {
      query: {
        students: {
          findMany: vi.fn(async () => [mockStudents[0]]),
        },
        classes: {
          findMany: vi.fn(async () => [mockClasses[0]]),
        },
        sections: {
          findMany: vi.fn(async () => [mockSections[0]]),
        },
      },
    };

    const wards = await resolveParentWards(
      { role: "SCHOOL_ADMIN", userId: "admin-user-1" },
      schoolA,
      "student-1",
      mockTx
    );

    expect(wards).toHaveLength(1);
    expect(wards[0].id).toBe("student-1");
    expect(wards[0].admissionNumber).toBe("ADM-001");
  });

  it("returns empty array when requested preview studentId belongs to another school (cross-tenant protection)", async () => {
    const mockTx = {
      query: {
        students: {
          findMany: vi.fn(async () => []), // No student found in schoolA
        },
        classes: {
          findMany: vi.fn(async () => []),
        },
        sections: {
          findMany: vi.fn(async () => []),
        },
      },
    };

    const wards = await resolveParentWards(
      { role: "PRINCIPAL", userId: "principal-user-1" },
      schoolA,
      "student-3", // belongs to schoolB
      mockTx
    );

    expect(wards).toHaveLength(0);
  });
});
