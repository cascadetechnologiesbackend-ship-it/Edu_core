import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock references for vi.mock
const { mockStaffFindMany, mockRolesFindFirst, mockUserRolesFindMany } = vi.hoisted(() => ({
  mockStaffFindMany: vi.fn(),
  mockRolesFindFirst: vi.fn(),
  mockUserRolesFindMany: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      staff: {
        findMany: mockStaffFindMany,
      },
      roles: {
        findFirst: mockRolesFindFirst,
      },
      userRoles: {
        findMany: mockUserRolesFindMany,
      },
    },
  },
}));

vi.mock("@/lib/encryption", () => ({
  decryptData: vi.fn((val: string) => val ? `decrypted_${val}` : ""),
  encryptData: vi.fn((val: string) => `enc_${val}`),
}));

import {
  getCanonicalTeachingStaff,
  invalidateTeachingStaffCache,
} from "../teachingStaff";

describe("Canonical Teaching Staff Resolver (S14-F01)", () => {
  const schoolId = "school-uuid-111";
  const teacherRoleId = "role-uuid-teacher";

  beforeEach(async () => {
    vi.clearAllMocks();
    await invalidateTeachingStaffCache(schoolId);
    mockRolesFindFirst.mockResolvedValue({ id: teacherRoleId, name: "TEACHER", schoolId });
  });

  it("includes regular teaching faculty with classificationConflict: false", async () => {
    mockStaffFindMany.mockResolvedValue([
      {
        id: "staff-1",
        userId: "user-1",
        schoolId,
        employeeCode: "FAC001",
        firstNameEncrypted: "Priya",
        lastNameEncrypted: "Sharma",
        emailEncrypted: "priya@school.com",
        isActive: true,
        designation: { id: "d1", name: "TGT Mathematics", isTeaching: true },
        department: { id: "dept-1", name: "Mathematics" },
        user: { id: "user-1", email: "priya@school.com", isActive: true },
      },
    ]);
    mockUserRolesFindMany.mockResolvedValue([]);

    const result = await getCanonicalTeachingStaff(schoolId);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "user-1",
      staffId: "staff-1",
      name: "decrypted_Priya decrypted_Sharma",
      email: "decrypted_priya@school.com",
      employeeCode: "FAC001",
      designationName: "TGT Mathematics",
      departmentName: "Mathematics",
      isTeaching: true,
      classificationConflict: false,
    });
  });

  it("includes TEACHER-role staff with isTeaching=false as classificationConflict: true (S14-F01 fix)", async () => {
    // Staff member whose designation was created with isTeaching=false, but user was granted TEACHER role
    mockStaffFindMany.mockResolvedValue([
      {
        id: "staff-2",
        userId: "user-2",
        schoolId,
        employeeCode: "FAC002",
        firstNameEncrypted: "Rohan",
        lastNameEncrypted: "Verma",
        emailEncrypted: "rohan@school.com",
        isActive: true,
        designation: { id: "d2", name: "PGT Physics (Misclassified)", isTeaching: false },
        department: { id: "dept-2", name: "Science" },
        user: { id: "user-2", email: "rohan@school.com", isActive: true },
      },
    ]);

    // User holds TEACHER role
    mockUserRolesFindMany.mockResolvedValue([
      {
        userId: "user-2",
        roleId: teacherRoleId,
        schoolId,
        user: { id: "user-2", email: "rohan@school.com", isActive: true },
      },
    ]);

    const result = await getCanonicalTeachingStaff(schoolId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "user-2",
      staffId: "staff-2",
      name: "decrypted_Rohan decrypted_Verma",
      email: "decrypted_rohan@school.com",
      employeeCode: "FAC002",
      designationName: "PGT Physics (Misclassified)",
      departmentName: "Science",
      isTeaching: false,
      classificationConflict: true,
    });
  });

  it("strictly excludes staff with isTeaching=false who do NOT hold the TEACHER role (e.g. Accountant)", async () => {
    mockStaffFindMany.mockResolvedValue([
      {
        id: "staff-3",
        userId: "user-3",
        schoolId,
        employeeCode: "ACC001",
        firstNameEncrypted: "Sunil",
        lastNameEncrypted: "Gupta",
        emailEncrypted: "sunil@school.com",
        isActive: true,
        designation: { id: "d3", name: "Accountant", isTeaching: false },
        department: { id: "dept-3", name: "Finance" },
        user: { id: "user-3", email: "sunil@school.com", isActive: true },
      },
    ]);

    // No user holds TEACHER role
    mockUserRolesFindMany.mockResolvedValue([]);

    const result = await getCanonicalTeachingStaff(schoolId);

    expect(result).toHaveLength(0);
  });

  it("includes fallback teacher user without staff profile with classificationConflict: false", async () => {
    mockStaffFindMany.mockResolvedValue([]);
    mockUserRolesFindMany.mockResolvedValue([
      {
        userId: "user-seed-teacher",
        roleId: teacherRoleId,
        schoolId,
        user: { id: "user-seed-teacher", email: "teacher.seed@school.com", isActive: true },
      },
    ]);

    const result = await getCanonicalTeachingStaff(schoolId);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "user-seed-teacher",
      staffId: "",
      name: "teacher.seed",
      email: "teacher.seed@school.com",
      employeeCode: "FACULTY",
      classificationConflict: false,
    });
  });

  it("serves from cache on repeated calls and invalidates cleanly", async () => {
    mockStaffFindMany.mockResolvedValue([]);
    mockUserRolesFindMany.mockResolvedValue([]);

    await getCanonicalTeachingStaff(schoolId);
    expect(mockStaffFindMany).toHaveBeenCalledTimes(1);

    // Second call serves from cache
    await getCanonicalTeachingStaff(schoolId);
    expect(mockStaffFindMany).toHaveBeenCalledTimes(1);

    // Invalidate cache
    await invalidateTeachingStaffCache(schoolId);

    // Third call fetches fresh data
    await getCanonicalTeachingStaff(schoolId);
    expect(mockStaffFindMany).toHaveBeenCalledTimes(2);
  });
});
