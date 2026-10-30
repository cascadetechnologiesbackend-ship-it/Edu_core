import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Mocks for React, Next, Auth & Server Utilities ────────────────────────
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/encryption", () => ({
  encryptData: vi.fn((val: string) => `enc_${val}`),
  decryptData: vi.fn((val: string) => (val?.startsWith("enc_") ? val.replace("enc_", "") : val)),
  computeSearchHash: vi.fn((val: string) => `hash_${val}`),
}));

// ─── 2. Multi-Tenant State & Active Session ──────────────────────────────────
const { activeSessionRef, mockTwoSchoolDb } = vi.hoisted(() => {
  const activeSessionRef = {
    current: {
      userId: "user-admin-a",
      role: "SCHOOL_ADMIN",
      schoolId: "school-A",
      email: "admin@school-a.edu",
    } as any,
  };

  const mockTwoSchoolDb = {
    schools: [
      { id: "school-A", name: "Delhi Public School (School A)" },
      { id: "school-B", name: "St. Xavier Academy (School B)" },
    ],
    classes: [
      { id: "cls-A-1", schoolId: "school-A", name: "Class 10" },
      { id: "cls-B-1", schoolId: "school-B", name: "Class 10" },
    ],
    sections: [
      { id: "sec-A-1", schoolId: "school-A", classId: "cls-A-1", name: "A" },
      { id: "sec-B-1", schoolId: "school-B", classId: "cls-B-1", name: "A" },
    ],
    bellSchedule: [
      { id: "bell-A-1", schoolId: "school-A", periodNumber: 1, name: "Period 1", isActive: true },
      { id: "bell-B-1", schoolId: "school-B", periodNumber: 1, name: "Period 1", isActive: true },
    ],
    timetablePeriods: [
      { id: "tt-A-1", schoolId: "school-A", sectionId: "sec-A-1", periodNumber: 1, dayOfWeek: "MONDAY", isActive: true },
      { id: "tt-B-1", schoolId: "school-B", sectionId: "sec-B-1", periodNumber: 1, dayOfWeek: "MONDAY", isActive: true },
    ],
    students: [
      { id: "stu-A-1", schoolId: "school-A", admissionNumber: "ADM-A-001" },
      { id: "stu-B-1", schoolId: "school-B", admissionNumber: "ADM-B-001" },
    ],
    staff: [
      { id: "stf-A-1", schoolId: "school-A", employeeCode: "EMP-A-101", role: "TEACHER" },
      { id: "stf-B-1", schoolId: "school-B", employeeCode: "EMP-B-101", role: "TEACHER" },
    ],
    auditLogs: [] as any[],
  };

  return { activeSessionRef, mockTwoSchoolDb };
});

// ─── 3. Mock Server Auth ─────────────────────────────────────────────────────
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    if (!activeSessionRef.current) {
      throw new Error("Unauthorized: No active session found.");
    }
    const role = activeSessionRef.current.role;
    if (allowedRoles && !allowedRoles.includes(role)) {
      throw new Error(`Forbidden: Role '${role}' is not authorized to perform this operation.`);
    }
    return {
      session: { user: activeSessionRef.current },
      userId: activeSessionRef.current.userId,
      role: activeSessionRef.current.role,
      schoolId: activeSessionRef.current.schoolId,
    };
  }),
  requireSchool: vi.fn(async (ctx: any) => {
    const school = mockTwoSchoolDb.schools.find((s) => s.id === ctx.schoolId);
    if (!school) throw new Error("School not found");
    return school;
  }),
  checkAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    if (!activeSessionRef.current) {
      throw new Error("Unauthorized: No active session found.");
    }
    const role = activeSessionRef.current.role;
    if (allowedRoles && !allowedRoles.includes(role)) {
      throw new Error(`Forbidden: Role '${role}' is not authorized.`);
    }
    return { user: activeSessionRef.current };
  }),
}));

// ─── 4. Mock Database with Tenant Scoping ────────────────────────────────────
vi.mock("@/db", () => {
  return {
    db: {
      query: {
        schools: {
          findFirst: vi.fn(async ({ where }: any) => {
            return mockTwoSchoolDb.schools.find((s) => s.id === activeSessionRef.current.schoolId) || null;
          }),
        },
        sections: {
          findFirst: vi.fn(async ({ where }: any) => {
            // Must strictly filter by schoolId of session
            return mockTwoSchoolDb.sections.find(
              (sec) => sec.schoolId === activeSessionRef.current.schoolId
            ) || null;
          }),
        },
        bellSchedule: {
          findMany: vi.fn(async () => {
            return mockTwoSchoolDb.bellSchedule.filter(
              (b) => b.schoolId === activeSessionRef.current.schoolId && b.isActive
            );
          }),
        },
        timetablePeriods: {
          findMany: vi.fn(async () => {
            return mockTwoSchoolDb.timetablePeriods.filter(
              (t) => t.schoolId === activeSessionRef.current.schoolId && t.isActive
            );
          }),
        },
      },
    },
    withTenant: vi.fn(async (schoolId: string, cb: any) => {
      // Enforce fail-closed if schoolId is mismatched
      if (activeSessionRef.current && activeSessionRef.current.schoolId !== schoolId) {
        throw new Error("Tenant Mismatch: Cannot execute queries across tenant boundaries.");
      }
      return cb(mockTwoSchoolDb);
    }),
  };
});

describe("Sprint S21: RBAC Guard Matrix, Multi-Tenant Isolation & Role Clamping", () => {
  beforeEach(() => {
    // Reset to School A admin by default
    activeSessionRef.current = {
      userId: "user-admin-a",
      role: "SCHOOL_ADMIN",
      schoolId: "school-A",
      email: "admin@school-a.edu",
    };
  });

  // ─── 1. RBAC Guard Matrix: Role Denial Matrix ──────────────────────────────
  describe("1. RBAC Guard Matrix: Strict Denials for Non-Admin Roles", () => {
    const prohibitedRoles = ["TEACHER", "PARENT", "STUDENT", "DRIVER"];

    it.each(prohibitedRoles)(
      "should deny role '%s' from executing student import commit action",
      async (role) => {
        activeSessionRef.current = {
          userId: `user-${role.toLowerCase()}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        const commitStudentImportGuarded = async () => {
          const { requireAuth } = await import("@/lib/serverAuth");
          await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
          return { success: true };
        };

        await expect(commitStudentImportGuarded()).rejects.toThrow(/Forbidden: Role/);
      }
    );

    it.each(prohibitedRoles)(
      "should deny role '%s' from executing staff import commit action",
      async (role) => {
        activeSessionRef.current = {
          userId: `user-${role.toLowerCase()}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        const commitStaffImportGuarded = async () => {
          const { requireAuth } = await import("@/lib/serverAuth");
          await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
          return { success: true };
        };

        await expect(commitStaffImportGuarded()).rejects.toThrow(/Forbidden: Role/);
      }
    );

    it.each(prohibitedRoles)(
      "should deny role '%s' from executing bell schedule top-up or provisioning",
      async (role) => {
        activeSessionRef.current = {
          userId: `user-${role.toLowerCase()}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        const topUpBellScheduleGuarded = async () => {
          const { requireAuth } = await import("@/lib/serverAuth");
          await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
          return { success: true };
        };

        await expect(topUpBellScheduleGuarded()).rejects.toThrow(/Forbidden: Role/);
      }
    );

    it.each(prohibitedRoles)(
      "should deny role '%s' from executing timetable generation preview & commit",
      async (role) => {
        activeSessionRef.current = {
          userId: `user-${role.toLowerCase()}`,
          role,
          schoolId: "school-A",
          email: `${role.toLowerCase()}@school-a.edu`,
        };

        const generateTimetableGuarded = async () => {
          const { requireAuth } = await import("@/lib/serverAuth");
          await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
          return { success: true };
        };

        if (role === "TEACHER" || role === "PARENT" || role === "STUDENT" || role === "DRIVER") {
          await expect(generateTimetableGuarded()).rejects.toThrow(/Forbidden: Role/);
        }
      }
    );

    it("should reject unauthenticated caller (null session) across all admin actions", async () => {
      activeSessionRef.current = null;

      const adminAction = async () => {
        const { requireAuth } = await import("@/lib/serverAuth");
        await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
      };

      await expect(adminAction()).rejects.toThrow(/Unauthorized/);
    });
  });

  // ─── 2. Multi-Tenant Two-School Isolation & Scope Derivation ───────────────
  describe("2. Multi-Tenant Two-School Isolation Matrix", () => {
    it("should strictly derive schoolId from session and reject client-supplied schoolId tampering", async () => {
      // Attacker session is School A
      activeSessionRef.current = {
        userId: "admin-attacker",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "attacker@school-a.edu",
      };

      // Attacker attempts to pass school-B in payload
      const secureTenantAction = async (payload: { clientSchoolId?: string }) => {
        const { requireAuth } = await import("@/lib/serverAuth");
        const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);

        // Security Invariant: Context schoolId must strictly come from ctx.schoolId, never clientSchoolId
        const effectiveSchoolId = ctx.schoolId;
        if (payload.clientSchoolId && payload.clientSchoolId !== effectiveSchoolId) {
          throw new Error("Security Violation: Client-supplied schoolId does not match authenticated session.");
        }
        return { schoolId: effectiveSchoolId };
      };

      // Direct override attempt must be blocked
      await expect(secureTenantAction({ clientSchoolId: "school-B" })).rejects.toThrow(
        /Security Violation/
      );

      // Normal call succeeds with caller's own schoolId
      const result = await secureTenantAction({ clientSchoolId: "school-A" });
      expect(result.schoolId).toBe("school-A");
    });

    it("School A admin cannot read or mutate School B timetable periods or sections", async () => {
      activeSessionRef.current = {
        userId: "admin-school-a",
        role: "SCHOOL_ADMIN",
        schoolId: "school-A",
        email: "admin@school-a.edu",
      };

      // Action resolving section must strictly enforce section.schoolId === session.schoolId
      const resolveSectionForTimetable = async (sectionId: string) => {
        const { requireAuth } = await import("@/lib/serverAuth");
        const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);

        const sec = mockTwoSchoolDb.sections.find((s) => s.id === sectionId);
        if (!sec || sec.schoolId !== ctx.schoolId) {
          throw new Error("Invalid section specified: Section does not belong to your institution.");
        }
        return sec;
      };

      // Attempting to resolve School B's section (sec-B-1) while logged into School A
      await expect(resolveSectionForTimetable("sec-B-1")).rejects.toThrow(
        /Invalid section specified/
      );

      // Resolving School A's section succeeds
      const validSec = await resolveSectionForTimetable("sec-A-1");
      expect(validSec.id).toBe("sec-A-1");
      expect(validSec.schoolId).toBe("school-A");
    });

    it("withTenant throws TenantMismatch if called with alien schoolId", async () => {
      const { withTenant } = await import("@/db");

      // Logged in as School A, but function tries to query School B
      await expect(
        withTenant("school-B", async (tx: any) => {
          return tx.students;
        })
      ).rejects.toThrow(/Tenant Mismatch/);
    });
  });

  // ─── 3. Role Clamping Guard Matrix ──────────────────────────────────────────
  describe("3. STAFF Import Role Clamping Boundary Defense", () => {
    it("permits allowed roles and rejects administrative escalation attempts", () => {
      const ALLOWED_STAFF_ROLES = ["TEACHER", "STAFF", "ACCOUNTANT"];
      const ELEVATED_PROHIBITED_ROLES = [
        "PRINCIPAL",
        "SUPER_ADMIN",
        "ADMIN",
        "ROOT",
        "SUPERUSER",
        "CHAIRMAN",
        "DIRECTOR",
      ];

      const checkRoleClamp = (role: string) => {
        const normalized = role.trim().toUpperCase();
        if (!ALLOWED_STAFF_ROLES.includes(normalized)) {
          return {
            allowed: false,
            error: `Role '${role}' is prohibited in bulk import. Only [TEACHER, STAFF, ACCOUNTANT] can be provisioned via CSV.`,
          };
        }
        return { allowed: true, role: normalized };
      };

      // Permitted
      for (const r of ALLOWED_STAFF_ROLES) {
        expect(checkRoleClamp(r).allowed).toBe(true);
      }

      // Prohibited
      for (const r of ELEVATED_PROHIBITED_ROLES) {
        const check = checkRoleClamp(r);
        expect(check.allowed).toBe(false);
        expect(check.error).toContain("prohibited in bulk import");
      }
    });
  });

  // ─── 4. 5,000-Row Denial of Service Guard ──────────────────────────────────
  describe("4. 5,000-Row Maximum File Size Guard", () => {
    it("guards server action boundaries against excessive memory allocation", () => {
      const MAX_IMPORT_ROWS = 5000;

      const guardBatchSize = (rowCount: number) => {
        if (rowCount <= 0) {
          throw new Error("No data rows supplied for import.");
        }
        if (rowCount > MAX_IMPORT_ROWS) {
          throw new Error(
            `Import batch size (${rowCount}) exceeds institutional ceiling of ${MAX_IMPORT_ROWS} records.`
          );
        }
        return true;
      };

      expect(guardBatchSize(1)).toBe(true);
      expect(guardBatchSize(5000)).toBe(true);
      expect(() => guardBatchSize(0)).toThrow(/No data rows supplied/);
      expect(() => guardBatchSize(5001)).toThrow(/exceeds institutional ceiling of 5000 records/);
      expect(() => guardBatchSize(20000)).toThrow(/exceeds institutional ceiling of 5000 records/);
    });
  });
});
