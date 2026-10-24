import { describe, it, expect, vi, beforeEach } from "vitest";

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

describe("Teaching Staff Cache Invalidation Regression Suite (S14-F04 / Layer L2)", () => {
  const schoolA = "school-uuid-aaa";
  const schoolB = "school-uuid-bbb";

  beforeEach(async () => {
    vi.clearAllMocks();
    await invalidateTeachingStaffCache();
    mockRolesFindFirst.mockResolvedValue({ id: "role-teacher", name: "TEACHER" });
    mockUserRolesFindMany.mockResolvedValue([]);
  });

  it("regression: designation isTeaching mutation reflects immediately when invalidateTeachingStaffCache is called", async () => {
    // 1. Initial state: Staff member has non-teaching designation
    const staffState = {
      id: "staff-1",
      userId: "user-1",
      schoolId: schoolA,
      employeeCode: "FAC001",
      firstNameEncrypted: "Anita",
      lastNameEncrypted: "Desai",
      emailEncrypted: "anita@school.com",
      isActive: true,
      designation: { id: "d1", name: "Lab Assistant", isTeaching: false },
      department: { id: "dept-1", name: "Science" },
      user: { id: "user-1", email: "anita@school.com", isActive: true },
    };

    mockStaffFindMany.mockImplementation(async () => [staffState]);

    const initialResult = await getCanonicalTeachingStaff(schoolA);
    // User does not hold TEACHER role in userRoles, so 0 returned
    expect(initialResult).toHaveLength(0);
    expect(mockStaffFindMany).toHaveBeenCalledTimes(1);

    // 2. Mutation: Admin updates designation to isTeaching: true
    staffState.designation = { id: "d1", name: "TGT Science", isTeaching: true };

    // Without invalidation, cache would serve stale 0 results
    const staleResult = await getCanonicalTeachingStaff(schoolA);
    expect(staleResult).toHaveLength(0);
    expect(mockStaffFindMany).toHaveBeenCalledTimes(1);

    // 3. Trigger cache invalidation (as wired in hr/actions.ts updateDesignation)
    await invalidateTeachingStaffCache(schoolA);

    // 4. Immediate re-query reflects isTeaching: true within the same process cycle
    const freshResult = await getCanonicalTeachingStaff(schoolA);
    expect(mockStaffFindMany).toHaveBeenCalledTimes(2);
    expect(freshResult).toHaveLength(1);
    expect(freshResult[0]).toMatchObject({
      id: "user-1",
      staffId: "staff-1",
      employeeCode: "FAC001",
      designationName: "TGT Science",
      isTeaching: true,
      classificationConflict: false,
    });
  });

  it("invalidating School A does not purge School B cached data", async () => {
    mockStaffFindMany.mockImplementation(async (query: any) => {
      return [
        {
          id: `staff-${query?.where?.schoolId || "x"}`,
          userId: `user-${query?.where?.schoolId || "x"}`,
          schoolId: query?.where?.schoolId || "x",
          employeeCode: "EMP001",
          firstNameEncrypted: "Teacher",
          lastNameEncrypted: "Test",
          emailEncrypted: "test@school.com",
          isActive: true,
          designation: { id: "d1", name: "Teacher", isTeaching: true },
          department: { id: "dept-1", name: "Academics" },
          user: { id: `user-${query?.where?.schoolId || "x"}`, email: "test@school.com", isActive: true },
        },
      ];
    });

    // Populate caches for both schools
    await getCanonicalTeachingStaff(schoolA);
    await getCanonicalTeachingStaff(schoolB);
    expect(mockStaffFindMany).toHaveBeenCalledTimes(2);

    // Invalidate School A only
    await invalidateTeachingStaffCache(schoolA);

    // Query School B: should hit cache
    await getCanonicalTeachingStaff(schoolB);
    expect(mockStaffFindMany).toHaveBeenCalledTimes(2);

    // Query School A: should re-fetch
    await getCanonicalTeachingStaff(schoolA);
    expect(mockStaffFindMany).toHaveBeenCalledTimes(3);
  });
});
