import { describe, it, expect, vi } from "vitest";
import { resolveParentWards } from "../resolveParentWards";

// Mock encryption
vi.mock("../../encryption", () => ({
  decryptData: vi.fn((val: string) => {
    if (val === "enc_aarav") return "Aarav";
    if (val === "enc_sharma") return "Sharma";
    if (val === "enc_rajesh") return "Rajesh";
    if (val === "enc_kumar") return "Kumar";
    if (val === "enc_sunita") return "Sunita";
    return val;
  }),
}));

describe("S18-F04: Family-Facing Class Teacher Surfacing", () => {
  const schoolId = "school-100";
  const parentUserId = "parent-1";

  const studentA = {
    id: "student-1",
    schoolId,
    admissionNumber: "ADM-101",
    firstNameEncrypted: "enc_aarav",
    lastNameEncrypted: "enc_sharma",
    primaryParentUserId: parentUserId,
    currentClassId: "class-10",
    currentSectionId: "sec-10a",
    photoS3Key: null,
    isActive: true,
  };

  const class10 = { id: "class-10", schoolId, displayName: "Class 10" };
  const section10A = {
    id: "sec-10a",
    schoolId,
    displayName: "10-A",
    name: "A",
    classTeacherId: "teacher-user-1",
  };

  const staffTeacher1 = {
    id: "staff-1",
    userId: "teacher-user-1",
    schoolId,
    firstNameEncrypted: "enc_rajesh",
    lastNameEncrypted: "enc_kumar",
    emailEncrypted: "enc_rajesh@school.edu",
    bankAccountEncrypted: "enc_BANK_12345",
    isActive: true,
    designation: { name: "Senior Teacher" },
  };

  const staffTeacher2 = {
    id: "staff-2",
    userId: "teacher-user-2",
    schoolId,
    firstNameEncrypted: "enc_sunita",
    lastNameEncrypted: "enc_sharma",
    emailEncrypted: "enc_sunita@school.edu",
    bankAccountEncrypted: "enc_BANK_67890",
    isActive: true,
    designation: { name: "Head of Primary" },
  };

  it("1. Resolves class teacher display name and designation from canonical classTeacherAssignments", async () => {
    const mockTx = {
      query: {
        students: {
          findMany: vi.fn(async () => [studentA]),
        },
        classes: {
          findMany: vi.fn(async () => [class10]),
        },
        sections: {
          findMany: vi.fn(async () => [section10A]),
        },
        classTeacherAssignments: {
          findMany: vi.fn(async () => [
            {
              id: "cta-1",
              schoolId,
              sectionId: "sec-10a",
              teacherId: "teacher-user-1",
              isActive: true,
            },
          ]),
        },
        staff: {
          findMany: vi.fn(async () => [staffTeacher1]),
        },
      },
    };

    const wards = await resolveParentWards(
      { role: "PARENT", userId: parentUserId },
      schoolId,
      null,
      mockTx
    );

    expect(wards).toHaveLength(1);
    const ward = wards[0]!;
    expect(ward.classTeacherName).toBe("Rajesh Kumar");
    expect(ward.classTeacherDesignation).toBe("Senior Teacher");

    // DPDP Invariant: Never leak contact or financial data in family-facing ward view
    expect((ward as any).email).toBeUndefined();
    expect((ward as any).bankAccount).toBeUndefined();
    expect((ward as any).phone).toBeUndefined();
  });

  it("2. Falls back to sections.classTeacherId mirror when CTA row is not yet migrated", async () => {
    const mockTx = {
      query: {
        students: {
          findMany: vi.fn(async () => [studentA]),
        },
        classes: {
          findMany: vi.fn(async () => [class10]),
        },
        sections: {
          findMany: vi.fn(async () => [section10A]),
        },
        classTeacherAssignments: {
          findMany: vi.fn(async () => []),
        },
        staff: {
          findMany: vi.fn(async () => [staffTeacher1]),
        },
      },
    };

    const wards = await resolveParentWards(
      { role: "PARENT", userId: parentUserId },
      schoolId,
      null,
      mockTx
    );

    expect(wards[0]!.classTeacherName).toBe("Rajesh Kumar");
    expect(wards[0]!.classTeacherDesignation).toBe("Senior Teacher");
  });

  it("3. Reflects class teacher reassignment immediately without client cache or reload lag", async () => {
    // Reassigned to Teacher 2
    const mockTx = {
      query: {
        students: {
          findMany: vi.fn(async () => [studentA]),
        },
        classes: {
          findMany: vi.fn(async () => [class10]),
        },
        sections: {
          findMany: vi.fn(async () => [{ ...section10A, classTeacherId: "teacher-user-2" }]),
        },
        classTeacherAssignments: {
          findMany: vi.fn(async () => [
            {
              id: "cta-2",
              schoolId,
              sectionId: "sec-10a",
              teacherId: "teacher-user-2",
              isActive: true,
            },
          ]),
        },
        staff: {
          findMany: vi.fn(async () => [staffTeacher2]),
        },
      },
    };

    const wards = await resolveParentWards(
      { role: "PARENT", userId: parentUserId },
      schoolId,
      null,
      mockTx
    );

    expect(wards[0]!.classTeacherName).toBe("Sunita Sharma");
    expect(wards[0]!.classTeacherDesignation).toBe("Head of Primary");
  });
});
