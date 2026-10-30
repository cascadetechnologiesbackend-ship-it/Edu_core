import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Mock React cache ────────────────────────────────────────────────────────
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
  clearTeacherScopeCacheMock,
  revalidatePathMock,
  mockClassesFindFirst,
  mockSectionsFindFirst,
  mockClassSubjectsFindFirst,
  mockSectionSubjectTeachersFindFirst,
  mockSubjectsFindFirst,
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

  const clearTeacherScopeCacheMock = vi.fn();
  const revalidatePathMock = vi.fn();

  const mockTwoSchoolStore = {
    classes: [
      { id: "class-A1", schoolId: "school-A", displayName: "Class 1", isActive: true },
      { id: "class-B1", schoolId: "school-B", displayName: "Class 2", isActive: true },
    ],
    sections: [
      {
        id: "sec-A1",
        schoolId: "school-A",
        classId: "class-A1",
        name: "A",
        capacity: 40,
        classTeacherId: null,
        roomNumber: "101",
        isActive: true,
      },
      {
        id: "sec-B1",
        schoolId: "school-B",
        classId: "class-B1",
        name: "A",
        capacity: 35,
        classTeacherId: null,
        roomNumber: "201",
        isActive: true,
      },
    ],
    classSubjects: [
      {
        id: "cs-A1",
        schoolId: "school-A",
        classId: "class-A1",
        subjectId: "sub-A1",
        assignedTeacherId: null,
      },
      {
        id: "cs-B1",
        schoolId: "school-B",
        classId: "class-B1",
        subjectId: "sub-B1",
        assignedTeacherId: null,
      },
    ],
    subjects: [
      { id: "sub-A1", schoolId: "school-A", name: "Mathematics", code: "MATH1", isActive: true },
      { id: "sub-B1", schoolId: "school-B", name: "English", code: "ENG1", isActive: true },
    ],
    teachersBySchool: {
      "school-A": [
        {
          id: "user-A1",
          staffId: "staff-A1",
          schoolId: "school-A",
          name: "Priya Sharma",
          email: "priya.sharma@school-a.edu",
          employeeCode: "NH-T01",
          designationName: "PRT Primary Teacher",
          departmentName: "Primary Wing",
          isTeaching: true,
        },
        {
          id: "user-A2",
          staffId: "staff-A2",
          schoolId: "school-A",
          name: "Rajesh Kumar",
          email: "rajesh.kumar@school-a.edu",
          employeeCode: "NH-T02",
          designationName: "TGT Mathematics",
          departmentName: "Secondary Wing",
          isTeaching: true,
        },
      ],
      "school-B": [
        {
          id: "user-B1",
          staffId: "staff-B1",
          schoolId: "school-B",
          name: "Kavita Rao",
          email: "kavita.rao@school-b.edu",
          employeeCode: "DPS-T01",
          designationName: "PGT English",
          departmentName: "Senior Wing",
          isTeaching: true,
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
      returning: vi.fn(() => Promise.resolve([{ id: "mock-id" }])),
      then: (resolve: any) => Promise.resolve([{ id: "mock-id" }]).then(resolve),
    };
    return chain;
  };

  const mockClassesFindFirst = vi.fn();
  const mockSectionsFindFirst = vi.fn();
  const mockClassSubjectsFindFirst = vi.fn();
  const mockSectionSubjectTeachersFindFirst = vi.fn();
  const mockSubjectsFindFirst = vi.fn();

  const mockTx = {
    query: {
      classes: {
        findFirst: mockClassesFindFirst,
      },
      sections: {
        findFirst: mockSectionsFindFirst,
        findMany: vi.fn(async () =>
          mockTwoSchoolStore.sections.filter(
            (s) => s.schoolId === activeSessionRef.current?.schoolId,
          ),
        ),
      },
      classSubjects: {
        findFirst: mockClassSubjectsFindFirst,
      },
      subjects: {
        findFirst: mockSubjectsFindFirst,
      },
      sectionSubjectTeachers: {
        findFirst: mockSectionSubjectTeachersFindFirst,
      },
      academicYears: {
        findFirst: vi.fn(async () => ({
          id: "ay-1",
          schoolId: activeSessionRef.current?.schoolId,
          isActive: true,
        })),
        findMany: vi.fn(async () => [
          { id: "ay-1", schoolId: activeSessionRef.current?.schoolId, isActive: true },
        ]),
      },
      classTeacherAssignments: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
    },
    insert: vi.fn(() => createChainable()),
    update: vi.fn(() => createChainable()),
    delete: vi.fn(() => createChainable()),
    select: vi.fn(() => {
      const selectChain: any = {
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ id: "mock-id" }])),
        })),
      };
      return selectChain;
    }),
  };

  return {
    activeSessionRef,
    mockTwoSchoolStore,
    withTenantExecutions,
    clearTeacherScopeCacheMock,
    revalidatePathMock,
    mockClassesFindFirst,
    mockSectionsFindFirst,
    mockClassSubjectsFindFirst,
    mockSectionSubjectTeachersFindFirst,
    mockSubjectsFindFirst,
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
  revalidatePath: vi.fn((path: string) => revalidatePathMock(path)),
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
  clearTeacherScopeCache: vi.fn(() => clearTeacherScopeCacheMock()),
}));

// ─── 5. Mock DB & withTenant ───────────────────────────────────────────────────
vi.mock("@/db", () => ({
  db: {
    query: {
      classes: { findFirst: mockClassesFindFirst },
      sections: {
        findFirst: mockSectionsFindFirst,
        findMany: vi.fn(async () =>
          mockTwoSchoolStore.sections.filter(
            (s) => s.schoolId === activeSessionRef.current?.schoolId,
          ),
        ),
      },
      classSubjects: { findFirst: mockClassSubjectsFindFirst },
      subjects: { findFirst: mockSubjectsFindFirst },
      sectionSubjectTeachers: {
        findFirst: mockSectionSubjectTeachersFindFirst,
        findMany: vi.fn(async ({ where }: any) => {
          return [
            {
              id: "sst-1",
              classSubjectId: "cs-A1",
              sectionId: "sec-A1",
              teacherId: "user-A1",
              effectiveFrom: "2026-04-01",
              effectiveTo: null,
              isActive: true,
              teacher: { id: "user-A1", email: "priya.sharma@school-a.edu" },
              section: { id: "sec-A1", name: "A" },
            },
          ];
        }),
      },
      academicYears: {
        findFirst: vi.fn(async () => ({
          id: "ay-1",
          schoolId: activeSessionRef.current?.schoolId,
          isActive: true,
        })),
      },
      classTeacherAssignments: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
    },
    insert: vi.fn(() => mockTx.insert()),
    update: vi.fn(() => mockTx.update()),
    delete: vi.fn(() => mockTx.delete()),
    select: vi.fn(() => mockTx.select()),
  },
  withTenant: vi.fn(async (schoolId: string, callback: (tx: any) => Promise<any>) => {
    withTenantExecutions.push({ schoolId });
    return callback(mockTx);
  }),
}));

// ─── 6. Mock Canonical Teaching Staff ─────────────────────────────────────────
vi.mock("@/app/(admin)/hr/teachingStaff", () => ({
  getCanonicalTeachingStaff: vi.fn(async (schoolId: string) => {
    return mockTwoSchoolStore.teachersBySchool[schoolId] || [];
  }),
}));

// ─── 7. Import Functions Under Test ───────────────────────────────────────────
import {
  saveSection,
  saveClassSubject,
  getTeachersList,
} from "../actions";
import {
  getClassWithDetails,
  getClassHubOverview,
  getSectionSubjectTeachers,
  assignSectionTeacher,
} from "../actions/class-setup.actions";

// ─── TEST SUITE: S15 Class Hub Assignment Surfaces ────────────────────────────
describe("S15 Class Hub Assignment Surfaces: RBAC, Isolation & Reflection Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withTenantExecutions.length = 0;
    activeSessionRef.current = {
      userId: "admin-A1",
      role: "SCHOOL_ADMIN",
      schoolId: "school-A",
      email: "admin@school-a.edu",
    };

    // Default mock handlers for school-A
    mockClassesFindFirst.mockImplementation(async ({ where }: any) => {
      return mockTwoSchoolStore.classes.find(
        (c) => c.schoolId === activeSessionRef.current?.schoolId,
      ) || null;
    });

    mockSectionsFindFirst.mockImplementation(async ({ where }: any) => {
      return mockTwoSchoolStore.sections.find(
        (s) => s.schoolId === activeSessionRef.current?.schoolId,
      ) || null;
    });

    mockClassSubjectsFindFirst.mockImplementation(async ({ where }: any) => {
      return mockTwoSchoolStore.classSubjects.find(
        (cs) => cs.schoolId === activeSessionRef.current?.schoolId,
      ) || null;
    });

    mockSubjectsFindFirst.mockImplementation(async ({ where }: any) => {
      return mockTwoSchoolStore.subjects.find(
        (s) => s.schoolId === activeSessionRef.current?.schoolId,
      ) || null;
    });

    mockSectionSubjectTeachersFindFirst.mockResolvedValue(null);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. RBAC Guard Matrix
  // ═══════════════════════════════════════════════════════════════════════════
  describe("1. RBAC Guard Matrix", () => {
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];
    const deniedRoles = [
      "TEACHER",
      "HR_MANAGER",
      "ACCOUNTANT",
      "STUDENT",
      "PARENT",
      "DRIVER",
    ];

    describe("saveSection (update class teacher on existing section)", () => {
      it.each(allowedRoles)("permits allowed role: %s", async (role) => {
        activeSessionRef.current = {
          userId: `user-${role}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        const result = await saveSection({
          id: "sec-A1",
          classId: "class-A1",
          name: "A",
          capacity: 40,
          classTeacherId: "user-A1",
          roomNumber: "101",
        });

        expect(result).toEqual({ success: true });
        expect(clearTeacherScopeCacheMock).toHaveBeenCalled();
        expect(revalidatePathMock).toHaveBeenCalledWith("/academics");
        expect(revalidatePathMock).toHaveBeenCalledWith("/academics/classes/class-A1");
      });

      it.each(deniedRoles)("denies unprivileged role: %s", async (role) => {
        activeSessionRef.current = {
          userId: `user-${role}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        await expect(
          saveSection({
            id: "sec-A1",
            classId: "class-A1",
            name: "A",
            classTeacherId: "user-A1",
          }),
        ).rejects.toThrow(/FORBIDDEN/);
      });

      it("fails closed when unauthenticated", async () => {
        activeSessionRef.current = null;
        await expect(
          saveSection({
            id: "sec-A1",
            classId: "class-A1",
            name: "A",
            classTeacherId: "user-A1",
          }),
        ).rejects.toThrow(/UNAUTHORIZED/);
      });
    });

    describe("saveClassSubject (update lead teacher on existing subject)", () => {
      it.each(allowedRoles)("permits allowed role: %s", async (role) => {
        activeSessionRef.current = {
          userId: `user-${role}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        const result = await saveClassSubject({
          id: "cs-A1",
          classId: "class-A1",
          subjectId: "sub-A1",
          assignedTeacherId: "user-A1",
        });

        expect(result).toEqual({ success: true });
        expect(clearTeacherScopeCacheMock).toHaveBeenCalled();
        expect(revalidatePathMock).toHaveBeenCalledWith("/academics");
        expect(revalidatePathMock).toHaveBeenCalledWith("/academics/classes/class-A1");
      });

      it.each(deniedRoles)("denies unprivileged role: %s", async (role) => {
        activeSessionRef.current = {
          userId: `user-${role}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        await expect(
          saveClassSubject({
            id: "cs-A1",
            classId: "class-A1",
            subjectId: "sub-A1",
            assignedTeacherId: "user-A1",
          }),
        ).rejects.toThrow(/FORBIDDEN/);
      });

      it("fails closed when unauthenticated", async () => {
        activeSessionRef.current = null;
        await expect(
          saveClassSubject({
            id: "cs-A1",
            classId: "class-A1",
            subjectId: "sub-A1",
            assignedTeacherId: "user-A1",
          }),
        ).rejects.toThrow(/UNAUTHORIZED/);
      });
    });

    describe("assignSectionTeacher (section-level teacher override)", () => {
      it.each(allowedRoles)("permits allowed role: %s", async (role) => {
        activeSessionRef.current = {
          userId: `user-${role}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        const result = await assignSectionTeacher({
          classSubjectId: "cs-A1",
          sectionId: "sec-A1",
          teacherId: "user-A1",
        });

        expect(result).toEqual({ success: true });
        expect(clearTeacherScopeCacheMock).toHaveBeenCalled();
      });

      it.each(deniedRoles)("denies unprivileged role: %s", async (role) => {
        activeSessionRef.current = {
          userId: `user-${role}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        await expect(
          assignSectionTeacher({
            classSubjectId: "cs-A1",
            sectionId: "sec-A1",
            teacherId: "user-A1",
          }),
        ).rejects.toThrow(/FORBIDDEN/);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Multi-Tenant Partitioning & Isolation
  // ═══════════════════════════════════════════════════════════════════════════
  describe("2. Multi-Tenant Partitioning & Isolation", () => {
    it("School A admin cannot update section of School B", async () => {
      activeSessionRef.current = {
        userId: "admin-A1",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      // Mock classes.findFirst to return null because class-B1 does not belong to school-A
      mockClassesFindFirst.mockResolvedValueOnce(null);

      await expect(
        saveSection({
          id: "sec-B1",
          classId: "class-B1",
          name: "A",
          classTeacherId: "user-A1",
        }),
      ).rejects.toThrow("Invalid class specified");
    });

    it("School A admin cannot update subject of School B", async () => {
      activeSessionRef.current = {
        userId: "admin-A1",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      // Class B1 belongs to School B, so tenant-scoped lookup under School A yields null
      mockClassesFindFirst.mockResolvedValueOnce(null);

      await expect(
        saveClassSubject({
          id: "cs-B1",
          classId: "class-B1",
          subjectId: "sub-B1",
          assignedTeacherId: "user-A1",
        }),
      ).rejects.toThrow("Invalid class specified");
    });

    it("getTeachersList in School A strictly excludes School B teachers", async () => {
      activeSessionRef.current = {
        userId: "admin-A1",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      const teachersA = await getTeachersList();

      expect(teachersA.length).toBe(2);
      expect(teachersA.map((t) => t.email)).toContain("priya.sharma@school-a.edu");
      expect(teachersA.map((t) => t.email)).toContain("rajesh.kumar@school-a.edu");
      expect(teachersA.map((t) => t.email)).not.toContain("kavita.rao@school-b.edu");
      expect(teachersA[0]?.displayName).toBe("Priya Sharma (NH-T01)");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Identity Resolution & Data Enrichment (Layer L4 Invariants)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("3. Identity Resolution & Data Enrichment", () => {
    it("getClassWithDetails enriches sections and subjects with canonical displayName", async () => {
      activeSessionRef.current = {
        userId: "admin-A1",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      mockClassesFindFirst.mockResolvedValueOnce({
        id: "class-A1",
        displayName: "Class 1",
        sections: [
          {
            id: "sec-A1",
            name: "A",
            classTeacher: { id: "user-A1", email: "priya.sharma@school-a.edu" },
          },
        ],
        classSubjects: [
          {
            id: "cs-A1",
            subjectId: "sub-A1",
            subject: { name: "Mathematics", code: "MTH01" },
            teacher: { id: "user-A2", email: "rajesh.kumar@school-a.edu" },
          },
        ],
      });

      const cls = await getClassWithDetails("class-A1");

      expect(cls).not.toBeNull();
      expect(cls?.sections[0].classTeacher?.displayName).toBe("Priya Sharma (NH-T01)");
      expect(cls?.sections[0].classTeacher?.name).toBe("Priya Sharma");
      expect(cls?.classSubjects[0].teacher?.displayName).toBe("Rajesh Kumar (NH-T02)");
      expect(cls?.classSubjects[0].teacher?.name).toBe("Rajesh Kumar");
    });

    it("getSectionSubjectTeachers enriches section override records with displayName", async () => {
      activeSessionRef.current = {
        userId: "admin-A1",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      const records = await getSectionSubjectTeachers("cs-A1");

      expect(records.length).toBeGreaterThan(0);
      const teacher = records[0]?.teacher as { displayName?: string; name?: string } | null;
      expect(teacher?.displayName).toBe("Priya Sharma (NH-T01)");
      expect(teacher?.name).toBe("Priya Sharma");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Downstream Reflection & Cache Invalidation
  // ═══════════════════════════════════════════════════════════════════════════
  describe("4. Downstream Reflection & Cache Invalidation", () => {
    it("all assignment edits invalidate teacher scope cache immediately", async () => {
      activeSessionRef.current = {
        userId: "admin-A1",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      // 1. Save section
      await saveSection({
        id: "sec-A1",
        classId: "class-A1",
        name: "A",
        classTeacherId: "user-A1",
      });
      expect(clearTeacherScopeCacheMock).toHaveBeenCalledTimes(1);

      // 2. Save class subject
      await saveClassSubject({
        id: "cs-A1",
        classId: "class-A1",
        subjectId: "sub-A1",
        assignedTeacherId: "user-A1",
      });
      expect(clearTeacherScopeCacheMock).toHaveBeenCalledTimes(2);

      // 3. Assign section teacher override
      await assignSectionTeacher({
        classSubjectId: "cs-A1",
        sectionId: "sec-A1",
        teacherId: "user-A2",
      });
      expect(clearTeacherScopeCacheMock).toHaveBeenCalledTimes(3);
    });
  });
});
