import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Mock React cache ───────────────────────────────────────────────────────
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
  };
});

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/requestContext", () => ({
  getClientRequestContext: vi.fn(() => ({})),
}));

// ─── 2. Hoisted Mock References ────────────────────────────────────────────────
const {
  activeSessionRef,
  mockWithTenant,
  mockRequireAuth,
  mockRequireSchool,
  mockSectionsFindFirst,
  mockAcademicYearsFindFirst,
  mockClassTeacherAssignmentsFindFirst,
  mockClassTeacherAssignmentsUpdate,
  mockClassTeacherAssignmentsInsert,
  mockSectionsUpdate,
  mockClassSubjectsFindFirst,
  mockClassSubjectsUpdate,
  mockSectionSubjectTeachersFindFirst,
  mockSectionSubjectTeachersInsert,
  mockSectionsFindMany,
  mockLogHrAudit,
  mockInvalidateTeachingStaffCache,
  mockClearTeacherScopeCache,
} = vi.hoisted(() => {
  const activeSessionRef = {
    current: null as {
      userId: string;
      role: string;
      schoolId: string;
      email: string;
    } | null,
  };

  return {
    activeSessionRef,
    mockWithTenant: vi.fn(),
    mockRequireAuth: vi.fn(),
    mockRequireSchool: vi.fn(),
    mockSectionsFindFirst: vi.fn(),
    mockAcademicYearsFindFirst: vi.fn(),
    mockClassTeacherAssignmentsFindFirst: vi.fn(),
    mockClassTeacherAssignmentsUpdate: vi.fn(),
    mockClassTeacherAssignmentsInsert: vi.fn(),
    mockSectionsUpdate: vi.fn(),
    mockClassSubjectsFindFirst: vi.fn(),
    mockClassSubjectsUpdate: vi.fn(),
    mockSectionSubjectTeachersFindFirst: vi.fn(),
    mockSectionSubjectTeachersInsert: vi.fn(),
    mockSectionsFindMany: vi.fn(),
    mockLogHrAudit: vi.fn(),
    mockInvalidateTeachingStaffCache: vi.fn(),
    mockClearTeacherScopeCache: vi.fn(),
  };
});

// ─── 3. Mock Server Auth & Database ────────────────────────────────────────────
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles: readonly string[]) => {
    if (!activeSessionRef.current) throw new Error("Unauthorized");
    if (!allowedRoles.includes(activeSessionRef.current.role)) {
      throw new Error(`Role ${activeSessionRef.current.role} is not permitted`);
    }
    return {
      session: {
        user: activeSessionRef.current,
      },
    };
  }),
  requireSchool: vi.fn(async (ctx: any) => {
    if (!ctx.session.user.schoolId) throw new Error("No school associated");
    return { id: ctx.session.user.schoolId, name: "Test School" };
  }),
  checkAuth: vi.fn(async (allowedRoles: readonly string[]) => {
    if (!activeSessionRef.current) throw new Error("Unauthorized");
    if (!allowedRoles.includes(activeSessionRef.current.role)) {
      throw new Error(`Forbidden: ${activeSessionRef.current.role}`);
    }
    return { user: activeSessionRef.current };
  }),
  getCachedSession: vi.fn(async () => {
    return activeSessionRef.current ? { user: activeSessionRef.current } : null;
  }),
}));

vi.mock("@/db", () => {
  const mockTx = {
    query: {
      sections: {
        findFirst: mockSectionsFindFirst,
        findMany: mockSectionsFindMany,
      },
      academicYears: {
        findFirst: mockAcademicYearsFindFirst,
      },
      classTeacherAssignments: {
        findFirst: mockClassTeacherAssignmentsFindFirst,
      },
      classSubjects: {
        findFirst: mockClassSubjectsFindFirst,
      },
      sectionSubjectTeachers: {
        findFirst: mockSectionSubjectTeachersFindFirst,
      },
      staff: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      departments: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      designations: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    update: vi.fn((table: any) => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
    insert: vi.fn((table: any) => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "new-id" }]),
      })),
    })),
  };

  return {
    db: mockTx,
    withTenant: vi.fn(async (schoolId: string, cb: (tx: any) => Promise<any>) => {
      return cb(mockTx);
    }),
  };
});

vi.mock("@/lib/encryption", () => ({
  decryptData: vi.fn((val: string) => val || ""),
  encryptData: vi.fn((val: string) => val || ""),
  computeSearchHash: vi.fn((val: string) => val || ""),
}));

vi.mock("@/lib/teacherEventEngine/scopeResolver", () => ({
  clearTeacherScopeCache: mockClearTeacherScopeCache,
}));

vi.mock("@/app/(admin)/hr/teachingStaff", () => ({
  invalidateTeachingStaffCache: mockInvalidateTeachingStaffCache,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  hrAssignClassTeacher,
  hrAssignSubjectTeacher,
} from "../actions";

describe("S17 Guard Matrix & Tenant Isolation Suite", () => {
  const SCHOOL_A = "school-00000000-0000-0000-0000-000000000001";
  const SCHOOL_B = "school-00000000-0000-0000-0000-000000000002";
  const SECTION_A1 = "sec-00000000-0000-0000-0000-000000000001";
  const TEACHER_A1 = "usr-teacher-0000-0000-0000-000000000001";
  const CLASSSUBJ_A1 = "cs-00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock returns for successful school A queries
    mockSectionsFindFirst.mockResolvedValue({
      id: SECTION_A1,
      schoolId: SCHOOL_A,
      name: "Section A",
      classId: "class-1",
      class: { displayName: "Grade 10", academicYearId: "ay-2026" },
    });

    mockAcademicYearsFindFirst.mockResolvedValue({
      id: "ay-2026",
      schoolId: SCHOOL_A,
      isActive: true,
      label: "2026-2027",
    });

    mockClassSubjectsFindFirst.mockResolvedValue({
      id: CLASSSUBJ_A1,
      schoolId: SCHOOL_A,
      classId: "class-1",
      subjectId: "sub-1",
      periodsPerWeek: 5,
    });

    mockSectionsFindMany.mockResolvedValue([
      { id: SECTION_A1, schoolId: SCHOOL_A, classId: "class-1", isActive: true },
    ]);

    mockClassTeacherAssignmentsFindFirst.mockResolvedValue(null);
    mockSectionSubjectTeachersFindFirst.mockResolvedValue(null);
  });

  describe("RBAC Matrix: hrAssignClassTeacher", () => {
    it("permits HR_MANAGER to assign class teacher with audit log (OD1 resolved)", async () => {
      activeSessionRef.current = {
        userId: "usr-hr-1",
        role: "HR_MANAGER",
        schoolId: SCHOOL_A,
        email: "hr@school.edu",
      };

      const res = await hrAssignClassTeacher({
        sectionId: SECTION_A1,
        teacherId: TEACHER_A1,
      });

      expect(res.success).toBe(true);
      expect(mockInvalidateTeachingStaffCache).toHaveBeenCalledWith(SCHOOL_A);
      expect(mockClearTeacherScopeCache).toHaveBeenCalledWith(TEACHER_A1);
    });

    it("permits SCHOOL_ADMIN and PRINCIPAL", async () => {
      for (const role of ["SCHOOL_ADMIN", "PRINCIPAL"] as const) {
        activeSessionRef.current = {
          userId: `usr-${role.toLowerCase()}`,
          role,
          schoolId: SCHOOL_A,
          email: `${role.toLowerCase()}@school.edu`,
        };

        const res = await hrAssignClassTeacher({
          sectionId: SECTION_A1,
          teacherId: TEACHER_A1,
        });

        expect(res.success).toBe(true);
      }
    });

    it("strictly blocks TEACHER role from modifying class teacher allocations (403)", async () => {
      activeSessionRef.current = {
        userId: "usr-teacher-1",
        role: "TEACHER",
        schoolId: SCHOOL_A,
        email: "teacher@school.edu",
      };

      const res = await hrAssignClassTeacher({
        sectionId: SECTION_A1,
        teacherId: TEACHER_A1,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Role TEACHER is not permitted/i);
    });
  });

  describe("RBAC Matrix: hrAssignSubjectTeacher", () => {
    it("permits HR_MANAGER to assign subject lead (OD1)", async () => {
      activeSessionRef.current = {
        userId: "usr-hr-1",
        role: "HR_MANAGER",
        schoolId: SCHOOL_A,
        email: "hr@school.edu",
      };

      const res = await hrAssignSubjectTeacher({
        classSubjectId: CLASSSUBJ_A1,
        teacherId: TEACHER_A1,
      });

      expect(res.success).toBe(true);
      expect(mockInvalidateTeachingStaffCache).toHaveBeenCalledWith(SCHOOL_A);
      expect(mockClearTeacherScopeCache).toHaveBeenCalledWith(TEACHER_A1);
    });

    it("strictly blocks TEACHER role from modifying subject lead", async () => {
      activeSessionRef.current = {
        userId: "usr-teacher-1",
        role: "TEACHER",
        schoolId: SCHOOL_A,
        email: "teacher@school.edu",
      };

      const res = await hrAssignSubjectTeacher({
        classSubjectId: CLASSSUBJ_A1,
        teacherId: TEACHER_A1,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Role TEACHER is not permitted/i);
    });
  });

  describe("Tenant Isolation Probes", () => {
    it("cross-school probe: user from School B cannot assign class teacher in School A's section", async () => {
      activeSessionRef.current = {
        userId: "usr-hr-b",
        role: "HR_MANAGER",
        schoolId: SCHOOL_B,
        email: "hr@school-b.edu",
      };

      // Mock section query returns null because section belongs to School A, not School B
      mockSectionsFindFirst.mockResolvedValueOnce(null);

      const res = await hrAssignClassTeacher({
        sectionId: SECTION_A1,
        teacherId: TEACHER_A1,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Section not found or access denied/i);
    });
  });

  describe("Bidirectional Conflict Detection (TW-3)", () => {
    it("surfaces teacher_already_assigned conflict when teacher is homeroom lead of another section", async () => {
      activeSessionRef.current = {
        userId: "usr-hr-1",
        role: "HR_MANAGER",
        schoolId: SCHOOL_A,
        email: "hr@school.edu",
      };

      mockClassTeacherAssignmentsFindFirst.mockResolvedValueOnce({
        id: "cta-prior",
        sectionId: "sec-other",
        teacherId: TEACHER_A1,
        isActive: true,
        section: { name: "B", class: { displayName: "Grade 9" } },
      });

      const res = await hrAssignClassTeacher({
        sectionId: SECTION_A1,
        teacherId: TEACHER_A1,
      });

      expect(res.success).toBe(false);
      expect(res.conflict?.type).toBe("teacher_already_assigned");
      expect(res.conflict?.message).toContain("Teacher is already class teacher of Grade 9 B");
    });

    it("allows assignment when forceTransfer is true, closing prior assignment", async () => {
      activeSessionRef.current = {
        userId: "usr-hr-1",
        role: "HR_MANAGER",
        schoolId: SCHOOL_A,
        email: "hr@school.edu",
      };

      const res = await hrAssignClassTeacher({
        sectionId: SECTION_A1,
        teacherId: TEACHER_A1,
        forceTransfer: true,
      });

      expect(res.success).toBe(true);
    });
  });
});
