import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Hoisted Multi-Tenant Fixtures ─────────────────────────────────────────
const { mockSessionRef, mockMultiTenantDb } = vi.hoisted(() => {
  const mockSessionRef = {
    current: {
      id: "user-1",
      role: "PRINCIPAL",
      schoolId: "school-A",
      name: "Dr. Principal",
      email: "principal@school-a.edu",
    } as any,
  };

  const mockMultiTenantDb: Record<string, {
    sections: Array<{ id: string; schoolId: string; isActive: boolean }>;
    staff: Array<{ id: string; schoolId: string; isActive: boolean; deletedAt: any; designation: any }>;
    studentAttendance: Array<{ id: string; schoolId: string; status: string; attendanceDate: Date }>;
    examMarksLocks: Array<{ id: string; schoolId: string; status: string }>;
    staffAttendance: Array<{ id: string; schoolId: string; status: string; attendanceDate: Date }>;
    books: Array<{ id: string; schoolId: string; totalCopies: number; availableCopies: number; category: string; deletedAt: any; copies: any[] }>;
    bookIssues: Array<{ id: string; schoolId: string; status: string; returnedAt: any; dueDate: Date }>;
    vehicles: Array<{ id: string; schoolId: string; busNumber: string; deletedAt: any; isActive: boolean; fitnessCertExpiryDate: any; insuranceExpiryDate: any }>;
    routes: Array<{ id: string; schoolId: string; deletedAt: any; stops: any[] }>;
    busPasses: Array<{ id: string; schoolId: string; status: string; deletedAt: any }>;
    gpsPings: Array<{ id: string; vehicleId: string; recordedAt: Date }>;
  }> = {
    "school-A": {
      sections: [
        { id: "sec-a1", schoolId: "school-A", isActive: true },
        { id: "sec-a2", schoolId: "school-A", isActive: true },
      ],
      staff: [
        { id: "st-a1", schoolId: "school-A", isActive: true, deletedAt: null, designation: { isTeaching: true } },
        { id: "st-a2", schoolId: "school-A", isActive: true, deletedAt: null, designation: { isTeaching: true } },
        { id: "st-a3", schoolId: "school-A", isActive: true, deletedAt: null, designation: { isTeaching: true } },
      ],
      studentAttendance: [
        { id: "att-a1", schoolId: "school-A", status: "PRESENT", attendanceDate: new Date() },
        { id: "att-a2", schoolId: "school-A", status: "PRESENT", attendanceDate: new Date() },
      ],
      examMarksLocks: [
        { id: "lock-a1", schoolId: "school-A", status: "SUBMITTED" },
      ],
      staffAttendance: [],
      books: [
        { id: "bk-a1", schoolId: "school-A", totalCopies: 20, availableCopies: 18, category: "Science", deletedAt: null, copies: [] },
      ],
      bookIssues: [
        { id: "iss-a1", schoolId: "school-A", status: "ISSUED", returnedAt: null, dueDate: new Date() },
      ],
      vehicles: [
        { id: "veh-a1", schoolId: "school-A", busNumber: "Bus A-1", deletedAt: null, isActive: true, fitnessCertExpiryDate: null, insuranceExpiryDate: null },
      ],
      routes: [
        { id: "rt-a1", schoolId: "school-A", deletedAt: null, stops: [{ id: "st-1" }, { id: "st-2" }] },
      ],
      busPasses: [
        { id: "bp-a1", schoolId: "school-A", status: "ACTIVE", deletedAt: null },
      ],
      gpsPings: [],
    },
    "school-B": {
      sections: [
        { id: "sec-b1", schoolId: "school-B", isActive: true },
      ],
      staff: [
        { id: "st-b1", schoolId: "school-B", isActive: true, deletedAt: null, designation: { isTeaching: true } },
      ],
      studentAttendance: [],
      examMarksLocks: [],
      staffAttendance: [],
      books: [
        { id: "bk-b1", schoolId: "school-B", totalCopies: 5, availableCopies: 5, category: "Literature", deletedAt: null, copies: [] },
      ],
      bookIssues: [],
      vehicles: [
        { id: "veh-b1", schoolId: "school-B", busNumber: "Bus B-1", deletedAt: null, isActive: true, fitnessCertExpiryDate: null, insuranceExpiryDate: null },
        { id: "veh-b2", schoolId: "school-B", busNumber: "Bus B-2", deletedAt: null, isActive: true, fitnessCertExpiryDate: null, insuranceExpiryDate: null },
      ],
      routes: [
        { id: "rt-b1", schoolId: "school-B", deletedAt: null, stops: [{ id: "st-b1" }] },
      ],
      busPasses: [],
      gpsPings: [],
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
    return {
      userId: user.id,
      role: user.role,
      schoolId: user.schoolId,
    };
  }),
  requireSchool: vi.fn(async (ctx: { schoolId: string | null }) => {
    if (!ctx.schoolId) {
      throw new Error("BAD_REQUEST: Missing school tenant scope");
    }
    return {
      id: ctx.schoolId,
      name: ctx.schoolId === "school-A" ? "School A" : "School B",
    };
  }),
  getCachedSession: vi.fn(async () => {
    if (!mockSessionRef.current) return null;
    return { user: mockSessionRef.current };
  }),
}));

vi.mock("@schoolmitra/database", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    assertQueryBudget: vi.fn(async (cb: any) => await cb()),
    db: {
      transaction: vi.fn(async (cb: any) => await cb({})),
    },
  };
});

vi.mock("@/lib/tenant", () => ({
  withTenant: vi.fn(async (schoolId: string, cb: (tenantDb: any) => Promise<any>) => {
    const data = mockMultiTenantDb[schoolId] || {
      sections: [],
      staff: [],
      studentAttendance: [],
      examMarksLocks: [],
      staffAttendance: [],
      books: [],
      bookIssues: [],
      vehicles: [],
      routes: [],
      busPasses: [],
      gpsPings: [],
    };

    const mockTenantDb = {
      query: {
        sections: { findMany: vi.fn(async () => data.sections) },
        staff: { findMany: vi.fn(async () => data.staff) },
        studentAttendance: { findMany: vi.fn(async () => data.studentAttendance) },
        examMarksLocks: { findMany: vi.fn(async () => data.examMarksLocks) },
        staffAttendance: { findMany: vi.fn(async () => data.staffAttendance) },
        books: { findMany: vi.fn(async () => data.books) },
        bookIssues: { findMany: vi.fn(async () => data.bookIssues) },
        vehicles: { findMany: vi.fn(async () => data.vehicles) },
        routes: { findMany: vi.fn(async () => data.routes) },
        busPasses: { findMany: vi.fn(async () => data.busPasses) },
        studentBusPasses: { findMany: vi.fn(async () => data.busPasses) },
        gpsPings: { findMany: vi.fn(async () => data.gpsPings) },
      },
    };

    return await cb(mockTenantDb);
  }),
}));

import { getPrincipalDashboardMetricsAction } from "../app/(principal)/principal/dashboard/actions";
import { getLibrarianDashboardMetricsAction } from "../app/(librarian)/librarian/dashboard/actions";
import { getTransportDashboardMetricsAction } from "../app/(transport-manager)/transport/dashboard/actions";
import {
  getPrincipalConsoleMetrics,
  getLibrarianConsoleMetrics,
  getTransportConsoleMetrics,
} from "@/lib/roleConsoleEngine";

describe("Sprint S23 Layer 7: Guard Matrix & Multi-Tenant Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Server Actions RBAC Fail-Closed Enforcement", () => {
    it("rejects unauthorized roles from calling Principal Dashboard action", async () => {
      // Allowed: SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL
      const unauthorizedRoles = ["PARENT", "STUDENT", "TEACHER", "DRIVER", "LIBRARIAN", "TRANSPORT_MANAGER"];

      for (const role of unauthorizedRoles) {
        mockSessionRef.current = {
          id: "unauth-user",
          role,
          schoolId: "school-A",
        };

        const res = await getPrincipalDashboardMetricsAction();
        expect(res.success).toBe(false);
        expect(res.metrics).toBeNull();
        expect(res.error).toContain("FORBIDDEN");
      }
    });

    it("permits authorized roles to call Principal Dashboard action", async () => {
      const authorizedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];

      for (const role of authorizedRoles) {
        mockSessionRef.current = {
          id: "auth-user",
          role,
          schoolId: "school-A",
        };

        const res = await getPrincipalDashboardMetricsAction();
        expect(res.success).toBe(true);
        expect(res.metrics).toBeDefined();
        expect(res.metrics?.activeSectionsCount).toBe(2);
      }
    });

    it("rejects unauthorized roles from calling Librarian Dashboard action", async () => {
      // Allowed: SUPER_ADMIN, SCHOOL_ADMIN, LIBRARIAN
      const unauthorizedRoles = ["PARENT", "STUDENT", "TEACHER", "DRIVER", "PRINCIPAL", "TRANSPORT_MANAGER"];

      for (const role of unauthorizedRoles) {
        mockSessionRef.current = {
          id: "unauth-user",
          role,
          schoolId: "school-A",
        };

        const res = await getLibrarianDashboardMetricsAction();
        expect(res.success).toBe(false);
        expect(res.metrics).toBeNull();
        expect(res.error).toContain("FORBIDDEN");
      }
    });

    it("rejects unauthorized roles from calling Transport Dashboard action", async () => {
      // Allowed: SUPER_ADMIN, SCHOOL_ADMIN, TRANSPORT_MANAGER
      const unauthorizedRoles = ["PARENT", "STUDENT", "TEACHER", "DRIVER", "PRINCIPAL", "LIBRARIAN"];

      for (const role of unauthorizedRoles) {
        mockSessionRef.current = {
          id: "unauth-user",
          role,
          schoolId: "school-A",
        };

        const res = await getTransportDashboardMetricsAction();
        expect(res.success).toBe(false);
        expect(res.metrics).toBeNull();
        expect(res.error).toContain("FORBIDDEN");
      }
    });
  });

  describe("2. Multi-Tenant Isolation & Zero Leakage", () => {
    it("ensures getPrincipalConsoleMetrics isolates School A from School B", async () => {
      const metricsA = await getPrincipalConsoleMetrics("school-A");
      const metricsB = await getPrincipalConsoleMetrics("school-B");

      // School A has 2 sections and 3 staff
      expect(metricsA.activeSectionsCount).toBe(2);
      expect(metricsA.activeTeachingStaffCount).toBe(3);
      expect(metricsA.pendingExamVerificationsCount).toBe(1);

      // School B has 1 section and 1 staff
      expect(metricsB.activeSectionsCount).toBe(1);
      expect(metricsB.activeTeachingStaffCount).toBe(1);
      expect(metricsB.pendingExamVerificationsCount).toBe(0);

      // Absolute isolation: values are distinct and never bled
      expect(metricsA.activeSectionsCount).not.toBe(metricsB.activeSectionsCount);
    });

    it("ensures getLibrarianConsoleMetrics isolates School A from School B", async () => {
      const metricsA = await getLibrarianConsoleMetrics("school-A");
      const metricsB = await getLibrarianConsoleMetrics("school-B");

      expect(metricsA.totalCopies).toBe(20);
      expect(metricsA.currentlyIssued).toBe(1);
      expect(metricsA.topCategories[0]?.category).toBe("Science");

      expect(metricsB.totalCopies).toBe(5);
      expect(metricsB.currentlyIssued).toBe(0);
      expect(metricsB.topCategories[0]?.category).toBe("Literature");

      expect(metricsA.totalCopies).not.toBe(metricsB.totalCopies);
    });

    it("ensures getTransportConsoleMetrics isolates School A from School B", async () => {
      const metricsA = await getTransportConsoleMetrics("school-A");
      const metricsB = await getTransportConsoleMetrics("school-B");

      expect(metricsA.activeVehiclesCount).toBe(1);
      expect(metricsA.pickupStopsCount).toBe(2);
      expect(metricsA.optedInStudentsCount).toBe(1);

      expect(metricsB.activeVehiclesCount).toBe(2);
      expect(metricsB.pickupStopsCount).toBe(1);
      expect(metricsB.optedInStudentsCount).toBe(0);

      expect(metricsA.activeVehiclesCount).not.toBe(metricsB.activeVehiclesCount);
    });
  });

  describe("3. Missing Tenant Fail-Closed Behavior", () => {
    it("fails closed when session has no schoolId", async () => {
      mockSessionRef.current = {
        id: "no-school-user",
        role: "PRINCIPAL",
        schoolId: null,
      };

      const res = await getPrincipalDashboardMetricsAction();
      expect(res.success).toBe(false);
      expect(res.error).toContain("BAD_REQUEST");
    });
  });
});
