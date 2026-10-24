import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Mock React cache to prevent cross-test memoization ─────────────────────
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
  };
});

// ─── 2. Hoisted Mock References ────────────────────────────────────────────────
const {
  activeSessionRef,
  mockTwoSchoolStore,
  withTenantExecutions,
  mockClassesFindFirst,
  mockSectionsFindFirst,
  mockClassSubjectsFindFirst,
  mockSectionSubjectTeachersFindFirst,
  mockTx,
} = vi.hoisted(() => {
  const activeSessionRef = {
    current: null as {
      userId: string;
      role: string;
      schoolId: string | null;
      email: string;
    } | null,
  };

  const mockTwoSchoolStore = {
    classes: [
      { id: "class-A1", schoolId: "school-A", displayName: "Class 8", isActive: true },
      { id: "class-B1", schoolId: "school-B", displayName: "Class 10", isActive: true },
    ],
    sections: [
      { id: "sec-A1", schoolId: "school-A", classId: "class-A1", name: "A", isActive: true },
      { id: "sec-B1", schoolId: "school-B", classId: "class-B1", name: "A", isActive: true },
    ],
    classSubjects: [
      { id: "cs-A1", schoolId: "school-A", classId: "class-A1", subjectId: "sub-A1", assignedTeacherId: null },
      { id: "cs-B1", schoolId: "school-B", classId: "class-B1", subjectId: "sub-B1", assignedTeacherId: null },
    ],
    teachersBySchool: {
      "school-A": [
        {
          id: "teacher-A1",
          userId: "user-A1",
          schoolId: "school-A",
          name: "Priya Sharma",
          email: "priya@school-a.edu",
          employeeCode: "FAC001",
          designationName: "TGT Mathematics",
          departmentName: "Mathematics",
          isTeaching: true,
          classificationConflict: false,
        },
        {
          id: "teacher-A2",
          userId: "user-A2",
          schoolId: "school-A",
          name: "Vikram Seth",
          email: "vikram@school-a.edu",
          employeeCode: "FAC002",
          designationName: "PGT English",
          departmentName: "English",
          isTeaching: true,
          classificationConflict: false,
        },
      ],
      "school-B": [
        {
          id: "teacher-B1",
          userId: "user-B1",
          schoolId: "school-B",
          name: "Ananya Rao",
          email: "ananya@school-b.edu",
          employeeCode: "B_FAC001",
          designationName: "TGT Science",
          departmentName: "Science",
          isTeaching: true,
          classificationConflict: false,
        },
        {
          id: "teacher-B2",
          userId: "user-B2",
          schoolId: "school-B",
          name: "Rohan Mehta",
          email: "rohan@school-b.edu",
          employeeCode: "B_FAC002",
          designationName: "TGT Hindi",
          departmentName: "Hindi",
          isTeaching: true,
          classificationConflict: false,
        },
      ],
    } as Record<string, any[]>,
  };

  const withTenantExecutions: Array<{ schoolId: string }> = [];

  const createChainable = () => {
    const chain: any = {
      values: vi.fn(() => chain),
      set: vi.fn(() => chain),
      where: vi.fn(() => chain),
      returning: vi.fn(() => Promise.resolve([{ id: "mock-inserted-id" }])),
      then: (resolve: any) => Promise.resolve({ success: true }).then(resolve),
    };
    return chain;
  };

  const mockClassesFindFirst = vi.fn();
  const mockSectionsFindFirst = vi.fn();
  const mockClassSubjectsFindFirst = vi.fn();
  const mockSectionSubjectTeachersFindFirst = vi.fn();

  const mockTx = {
    query: {
      classes: {
        findFirst: mockClassesFindFirst,
      },
      sections: {
        findFirst: mockSectionsFindFirst,
      },
      classSubjects: {
        findFirst: mockClassSubjectsFindFirst,
      },
      sectionSubjectTeachers: {
        findFirst: mockSectionSubjectTeachersFindFirst,
      },
      academicYears: {
        findFirst: vi.fn(async () => ({ id: "ay-1", schoolId: activeSessionRef.current?.schoolId, isActive: true })),
        findMany: vi.fn(async () => [{ id: "ay-1", schoolId: activeSessionRef.current?.schoolId, isActive: true }]),
      },
    },
    insert: vi.fn(() => createChainable()),
    update: vi.fn(() => createChainable()),
    delete: vi.fn(() => createChainable()),
    select: vi.fn(() => createChainable()),
  };

  return {
    activeSessionRef,
    mockTwoSchoolStore,
    withTenantExecutions,
    mockClassesFindFirst,
    mockSectionsFindFirst,
    mockClassSubjectsFindFirst,
    mockSectionSubjectTeachersFindFirst,
    mockTx,
  };
});

// ─── 3. Mock Server Auth & RBAC State ──────────────────────────────────────────
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    if (!activeSessionRef.current) {
      throw new Error("UNAUTHORIZED");
    }
    if (
      allowedRoles &&
      allowedRoles.length > 0 &&
      !allowedRoles.includes(activeSessionRef.current.role)
    ) {
      throw new Error(
        `FORBIDDEN: requires roles [${allowedRoles.join(", ")}], got ${activeSessionRef.current.role}`,
      );
    }
    return {
      userId: activeSessionRef.current.userId,
      role: activeSessionRef.current.role,
      schoolId: activeSessionRef.current.schoolId,
      email: activeSessionRef.current.email,
    };
  }),
  requireSchool: vi.fn(async () => {
    if (!activeSessionRef.current?.schoolId) throw new Error("No school context");
    return { id: activeSessionRef.current.schoolId, name: "Test School" };
  }),
  getCachedSession: vi.fn(async () => activeSessionRef.current),
}));

// ─── 4. Mock Next.js Cache & Headers ──────────────────────────────────────────
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({
    get: vi.fn((name: string) => (name === "user-agent" ? "vitest" : "127.0.0.1")),
    entries: vi.fn(() => []),
  })),
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
  })),
}));

vi.mock("@/lib/teacherEventEngine/scopeResolver", () => ({
  clearTeacherScopeCache: vi.fn(),
}));

// ─── 5. Mock Multi-Tenant Database ─────────────────────────────────────────────
vi.mock("@/db", () => ({
  db: mockTx,
  withTenant: vi.fn(async (schoolId: string, cb: any) => {
    withTenantExecutions.push({ schoolId });
    return cb(mockTx);
  }),
}));

// Mock canonical teaching staff resolver
vi.mock("@/app/(admin)/hr/actions", () => ({
  getCanonicalTeachingStaff: vi.fn(async (schoolId: string) => {
    return mockTwoSchoolStore.teachersBySchool[schoolId] || [];
  }),
}));

vi.mock("../hr/actions", () => ({
  getCanonicalTeachingStaff: vi.fn(async (schoolId: string) => {
    return mockTwoSchoolStore.teachersBySchool[schoolId] || [];
  }),
}));

vi.mock("@/app/(admin)/hr/teachingStaff", () => ({
  getCanonicalTeachingStaff: vi.fn(async (schoolId: string) => {
    return mockTwoSchoolStore.teachersBySchool[schoolId] || [];
  }),
  invalidateTeachingStaffCache: vi.fn(),
}));

import {
  saveSection,
  batchUpdateClassSubjectMappings,
  assignSectionTeacher,
  getTeachersList,
} from "../actions";

describe("Layer L7: Teacher Assignment RBAC Matrix & Isolation Probe (S14-F10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withTenantExecutions.length = 0;

    // Default: findFirst matches against active session's schoolId
    mockClassesFindFirst.mockImplementation(async () => {
      return { id: "class-A1", schoolId: activeSessionRef.current?.schoolId, displayName: "Class 8", isActive: true };
    });

    mockSectionsFindFirst.mockImplementation(async () => {
      return { id: "sec-A1", schoolId: activeSessionRef.current?.schoolId, classId: "class-A1", name: "A", isActive: true };
    });

    mockClassSubjectsFindFirst.mockImplementation(async () => {
      return { id: "cs-A1", schoolId: activeSessionRef.current?.schoolId, classId: "class-A1", subjectId: "sub-A1" };
    });

    mockSectionSubjectTeachersFindFirst.mockImplementation(async () => null);
  });

  // ─── SUITE 1: RBAC Permission Matrix ─────────────────────────────────────────

  describe("1. RBAC Guard Matrix: Allowed vs Denied Roles", () => {
    const deniedRoles = [
      "TEACHER",
      "HR_MANAGER",
      "ACCOUNTANT",
      "STUDENT",
      "PARENT",
      "DRIVER",
    ] as const;

    const allowedRoles = [
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
    ] as const;

    for (const role of deniedRoles) {
      it(`denies ${role} from calling saveSection`, async () => {
        activeSessionRef.current = {
          userId: `user-${role.toLowerCase()}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school.edu`,
        };

        await expect(
          saveSection({
            classId: "class-A1",
            name: "A",
            classTeacherId: "teacher-A1",
          }),
        ).rejects.toThrow(/FORBIDDEN.*requires roles/);
      });

      it(`denies ${role} from calling batchUpdateClassSubjectMappings`, async () => {
        activeSessionRef.current = {
          userId: `user-${role.toLowerCase()}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school.edu`,
        };

        await expect(
          batchUpdateClassSubjectMappings({
            toAdd: [{ classId: "class-A1", subjectId: "sub-1", assignedTeacherId: "teacher-A1" }],
            toRemove: [],
          }),
        ).rejects.toThrow(/FORBIDDEN.*requires roles/);
      });

      it(`denies ${role} from calling assignSectionTeacher`, async () => {
        activeSessionRef.current = {
          userId: `user-${role.toLowerCase()}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school.edu`,
        };

        await expect(
          assignSectionTeacher({
            classSubjectId: "cs-A1",
            sectionId: "sec-A1",
            teacherId: "teacher-A2",
          }),
        ).rejects.toThrow(/FORBIDDEN.*requires roles/);
      });
    }

    it("denies unauthenticated calls (no session)", async () => {
      activeSessionRef.current = null;

      await expect(
        saveSection({ classId: "class-A1", name: "A" }),
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(
        batchUpdateClassSubjectMappings({ toAdd: [], toRemove: [] }),
      ).rejects.toThrow("UNAUTHORIZED");

      await expect(
        assignSectionTeacher({ classSubjectId: "cs-A1", sectionId: "sec-A1" }),
      ).rejects.toThrow("UNAUTHORIZED");
    });

    for (const role of allowedRoles) {
      it(`authorizes ${role} to perform teacher assignment mutations`, async () => {
        activeSessionRef.current = {
          userId: `user-${role.toLowerCase()}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school.edu`,
        };

        const secRes = await saveSection({
          classId: "class-A1",
          name: "A",
          classTeacherId: "teacher-A1",
        });
        expect(secRes.success).toBe(true);

        const mapRes = await batchUpdateClassSubjectMappings({
          toAdd: [{ classId: "class-A1", subjectId: "sub-1", assignedTeacherId: "teacher-A1" }],
          toRemove: [],
        });
        expect(mapRes.success).toBe(true);

        const ovrRes = await assignSectionTeacher({
          classSubjectId: "cs-A1",
          sectionId: "sec-A1",
          teacherId: "teacher-A2",
        });
        expect(ovrRes.success).toBe(true);
      });
    }
  });

  // ─── SUITE 2: Multi-Tenant Two-School Isolation Probe ─────────────────────────

  describe("2. Multi-Tenant Two-School Isolation Probe", () => {
    it("getTeachersList in School A never returns School B teachers", async () => {
      // Authenticate as School A admin
      activeSessionRef.current = {
        userId: "admin-A",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      const teachersA = await getTeachersList();
      expect(teachersA).toHaveLength(2);
      expect(teachersA.map((t) => t.id)).toEqual(["teacher-A1", "teacher-A2"]);
      expect(teachersA.every((t) => !t.id.includes("B"))).toBe(true);
      expect(teachersA[0]!.displayName).toBe("Priya Sharma (FAC001)");

      // Authenticate as School B admin
      activeSessionRef.current = {
        userId: "admin-B",
        role: "SCHOOL_ADMIN",
        schoolId: "school-B",
        email: "admin@school-b.edu",
      };

      const teachersB = await getTeachersList();
      expect(teachersB).toHaveLength(2);
      expect(teachersB.map((t) => t.id)).toEqual(["teacher-B1", "teacher-B2"]);
      expect(teachersB.every((t) => !t.id.includes("A"))).toBe(true);
      expect(teachersB[0]!.displayName).toBe("Ananya Rao (B_FAC001)");
    });

    it("cross-school class in saveSection fails closed with 'Invalid class specified'", async () => {
      activeSessionRef.current = {
        userId: "admin-A",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      // Attacker passes classId from School B: cls does not exist in school-A
      mockClassesFindFirst.mockResolvedValueOnce(null);

      await expect(
        saveSection({
          classId: "class-B1", // belongs to School B
          name: "A",
          classTeacherId: "teacher-A1",
        }),
      ).rejects.toThrow("Invalid class specified");
    });

    it("cross-school classSubject in assignSectionTeacher fails closed with 'Invalid class subject specified'", async () => {
      activeSessionRef.current = {
        userId: "admin-A",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      // Attacker passes classSubjectId from School B: cs does not exist in school-A
      mockClassSubjectsFindFirst.mockResolvedValueOnce(null);

      await expect(
        assignSectionTeacher({
          classSubjectId: "cs-B1", // belongs to School B
          sectionId: "sec-A1",
          teacherId: "teacher-A1",
        }),
      ).rejects.toThrow("Invalid class subject specified");
    });

    it("cross-school section in assignSectionTeacher fails closed with 'Invalid section specified'", async () => {
      activeSessionRef.current = {
        userId: "admin-A",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      // Valid class subject in school-A
      mockClassSubjectsFindFirst.mockResolvedValueOnce({
        id: "cs-A1",
        schoolId: "school-A",
        classId: "class-A1",
      });
      // But section belongs to school-B
      mockSectionsFindFirst.mockResolvedValueOnce(null);

      await expect(
        assignSectionTeacher({
          classSubjectId: "cs-A1",
          sectionId: "sec-B1", // belongs to School B
          teacherId: "teacher-A1",
        }),
      ).rejects.toThrow("Invalid section specified");
    });

    it("batchUpdateClassSubjectMappings scopes operations strictly to session schoolId", async () => {
      activeSessionRef.current = {
        userId: "admin-A",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      await batchUpdateClassSubjectMappings({
        toAdd: [
          { classId: "class-A1", subjectId: "sub-A1", assignedTeacherId: "teacher-A1" },
        ],
        toRemove: [{ classId: "class-A1", subjectId: "sub-A2" }],
        toUpdate: [{ id: "cs-A1", assignedTeacherId: "teacher-A2" }],
      });

      // Verify withTenant was executed strictly with school-A
      expect(withTenantExecutions).toHaveLength(1);
      expect(withTenantExecutions[0]!.schoolId).toBe("school-A");
    });
  });
});
