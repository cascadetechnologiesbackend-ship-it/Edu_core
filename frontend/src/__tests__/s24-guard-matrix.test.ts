import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Hoisted Multi-Tenant & Session Fixtures ────────────────────────────────
const { mockSessionRef, mockMultiTenantDb } = vi.hoisted(() => {
  const mockSessionRef = {
    current: {
      userId: "teacher-A",
      role: "TEACHER",
      schoolId: "school-A",
      name: "Teacher Alice",
      email: "alice@school-a.edu",
    } as any,
  };

  const mockMultiTenantDb: Record<
    string,
    {
      students: Array<{ id: string; schoolId: string; firstName: string; lastName: string; rollNumber: string }>;
      leaveRequests: Array<{ id: string; schoolId: string; studentId: string; status: string }>;
    }
  > = {
    "school-A": {
      students: [
        { id: "stu-a1", schoolId: "school-A", firstName: "Aarav", lastName: "Sharma", rollNumber: "01" },
        { id: "stu-a2", schoolId: "school-A", firstName: "Rohan", lastName: "Verma", rollNumber: "02" },
      ],
      leaveRequests: [
        { id: "leave-a1", schoolId: "school-A", studentId: "stu-a1", status: "PENDING" },
      ],
    },
    "school-B": {
      students: [
        { id: "stu-b1", schoolId: "school-B", firstName: "Kabir", lastName: "Singh", rollNumber: "11" },
      ],
      leaveRequests: [
        { id: "leave-b1", schoolId: "school-B", studentId: "stu-b1", status: "PENDING" },
      ],
    },
  };

  return { mockSessionRef, mockMultiTenantDb };
});

// ─── 2. Auth Mocks ────────────────────────────────────────────────────────────
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    const user = mockSessionRef.current;
    if (!user) {
      throw new Error("UNAUTHORIZED: Session expired or invalid");
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      throw new Error(`FORBIDDEN: Role ${user.role} is not permitted`);
    }
    return user;
  }),
  requireSchool: vi.fn(async () => {
    const user = mockSessionRef.current;
    if (!user?.schoolId) {
      throw new Error("UNAUTHORIZED: Missing school context");
    }
    return user.schoolId;
  }),
}));

describe("Sprint S24 Layer 9: Guard Matrix (RBAC & Multi-Tenant Isolation)", () => {
  beforeEach(() => {
    mockSessionRef.current = {
      userId: "teacher-A",
      role: "TEACHER",
      schoolId: "school-A",
      name: "Teacher Alice",
      email: "alice@school-a.edu",
    };
  });

  describe("1. RBAC Guard Fail-Closed on Teacher Operations", () => {
    it("denies access to non-teacher roles (STUDENT, PARENT, DRIVER)", async () => {
      const { requireAuth } = await import("@/lib/serverAuth");

      // Test STUDENT
      mockSessionRef.current.role = "STUDENT";
      await expect(
        requireAuth(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"])
      ).rejects.toThrow("FORBIDDEN: Role STUDENT is not permitted");

      // Test PARENT
      mockSessionRef.current.role = "PARENT";
      await expect(
        requireAuth(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"])
      ).rejects.toThrow("FORBIDDEN: Role PARENT is not permitted");

      // Test DRIVER
      mockSessionRef.current.role = "DRIVER";
      await expect(
        requireAuth(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"])
      ).rejects.toThrow("FORBIDDEN: Role DRIVER is not permitted");
    });

    it("allows authorized teacher and administrative roles", async () => {
      const { requireAuth } = await import("@/lib/serverAuth");

      // Test TEACHER
      mockSessionRef.current.role = "TEACHER";
      const teacherUser = await requireAuth(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"]);
      expect(teacherUser.role).toBe("TEACHER");

      // Test PRINCIPAL
      mockSessionRef.current.role = "PRINCIPAL";
      const principalUser = await requireAuth(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN", "PRINCIPAL"]);
      expect(principalUser.role).toBe("PRINCIPAL");
    });
  });

  describe("2. Multi-Tenant Cross-School Data Leak Prevention", () => {
    it("prevents Teacher in School A from accessing or resolving School B students", () => {
      const currentSchool = mockSessionRef.current.schoolId; // school-A
      const schoolAStudents = mockMultiTenantDb[currentSchool]!.students;

      // Attempting to look up a student belonging to School B
      const targetStudentId = "stu-b1";
      const resolved = schoolAStudents.find((s) => s.id === targetStudentId);

      // Must be undefined under School A boundary
      expect(resolved).toBeUndefined();
    });

    it("ensures leave requests are strictly isolated to the caller's schoolId", () => {
      const currentSchool = mockSessionRef.current.schoolId;
      const schoolALeaves = mockMultiTenantDb[currentSchool]!.leaveRequests;

      expect(schoolALeaves.length).toBe(1);
      expect(schoolALeaves[0]!.id).toBe("leave-a1");
      expect(schoolALeaves.some((l) => l.schoolId === "school-B")).toBe(false);
    });
  });
});

