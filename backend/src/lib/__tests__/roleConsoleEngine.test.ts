import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock tenant wrapper to return a mock DB
vi.mock("../tenant", () => ({
  withTenant: vi.fn(async (schoolId: string, cb: any) => {
    return await cb(createScopedMockDb(schoolId));
  }),
}));

const mockDbState = {
  sections: [] as any[],
  staff: [] as any[],
  studentAttendance: [] as any[],
  staffAttendance: [] as any[],
  examMarksLocks: [] as any[],
  books: [] as any[],
  bookCopies: [] as any[],
  bookIssues: [] as any[],
  vehicles: [] as any[],
  routes: [] as any[],
  routeStops: [] as any[],
  studentBusPasses: [] as any[],
  gpsPings: [] as any[],
};

function createScopedMockDb(schoolId: string) {
  return {
    query: {
      sections: {
        findMany: vi.fn(async () =>
          mockDbState.sections.filter((s) => s.schoolId === schoolId && s.isActive)
        ),
      },
      staff: {
        findMany: vi.fn(async () =>
          mockDbState.staff.filter((s) => s.schoolId === schoolId && s.isActive && !s.deletedAt)
        ),
      },
      studentAttendance: {
        findMany: vi.fn(async (opts?: any) =>
          mockDbState.studentAttendance.filter((a) => a.schoolId === schoolId)
        ),
      },
      staffAttendance: {
        findMany: vi.fn(async (opts?: any) =>
          mockDbState.staffAttendance.filter((a) => a.schoolId === schoolId)
        ),
      },
      examMarksLocks: {
        findMany: vi.fn(async (opts?: any) =>
          mockDbState.examMarksLocks.filter((l) => l.schoolId === schoolId && l.status === "SUBMITTED")
        ),
      },
      books: {
        findMany: vi.fn(async () =>
          mockDbState.books.filter((b) => b.schoolId === schoolId && !b.deletedAt)
        ),
      },
      bookIssues: {
        findMany: vi.fn(async () =>
          mockDbState.bookIssues.filter((i) => i.schoolId === schoolId)
        ),
      },
      vehicles: {
        findMany: vi.fn(async () =>
          mockDbState.vehicles.filter((v) => v.schoolId === schoolId && !v.deletedAt)
        ),
      },
      routes: {
        findMany: vi.fn(async () =>
          mockDbState.routes.filter((r) => r.schoolId === schoolId && !r.deletedAt)
        ),
      },
      studentBusPasses: {
        findMany: vi.fn(async () =>
          mockDbState.studentBusPasses.filter((p) => p.schoolId === schoolId && p.isActive)
        ),
      },
      gpsPings: {
        findMany: vi.fn(async () => mockDbState.gpsPings),
      },
    },
  };
}

import {
  getPrincipalConsoleMetrics,
  getLibrarianConsoleMetrics,
  getTransportConsoleMetrics,
} from "../roleConsoleEngine";

describe("Sprint S23 Layer 1: Role Console Truth Domain Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbState.sections = [];
    mockDbState.staff = [];
    mockDbState.studentAttendance = [];
    mockDbState.staffAttendance = [];
    mockDbState.examMarksLocks = [];
    mockDbState.books = [];
    mockDbState.bookCopies = [];
    mockDbState.bookIssues = [];
    mockDbState.vehicles = [];
    mockDbState.routes = [];
    mockDbState.routeStops = [];
    mockDbState.studentBusPasses = [];
    mockDbState.gpsPings = [];
  });

  describe("1. Principal Console Metrics", () => {
    it("returns honest zeros for an empty, freshly provisioned school tenant", async () => {
      const metrics = await getPrincipalConsoleMetrics("school-empty");
      expect(metrics.activeSectionsCount).toBe(0);
      expect(metrics.activeTeachingStaffCount).toBe(0);
      expect(metrics.todayStudentAttendance.totalMarked).toBe(0);
      expect(metrics.todayStudentAttendance.isMarkedToday).toBe(false);
      expect(metrics.todayStudentAttendance.ratePercent).toBeNull();
      expect(metrics.todayStudentAttendance.formattedPercent).toBe("Not Marked");
      expect(metrics.pendingExamVerificationsCount).toBe(0);
      expect(metrics.staffAttendanceRate).toBeNull(); // OD3: null when unpopulated
    });

    it("calculates live metrics accurately for a populated school tenant", async () => {
      const schoolId = "school-live";
      const now = new Date("2026-10-30T10:00:00Z");

      // Sections
      mockDbState.sections.push(
        { id: "sec-1", schoolId, isActive: true },
        { id: "sec-2", schoolId, isActive: true },
        { id: "sec-3", schoolId, isActive: false } // Inactive section ignored
      );

      // Staff
      mockDbState.staff.push(
        { id: "st-1", schoolId, isActive: true, designation: { isTeaching: true } },
        { id: "st-2", schoolId, isActive: true, designation: { isTeaching: true } },
        { id: "st-3", schoolId, isActive: true, designation: { isTeaching: false } } // Non-teaching staff ignored
      );

      // Student Attendance for today: 8 present, 2 absent = 80.0%
      for (let i = 0; i < 8; i++) {
        mockDbState.studentAttendance.push({ id: `sa-${i}`, schoolId, status: "PRESENT", attendanceDate: now });
      }
      for (let i = 0; i < 2; i++) {
        mockDbState.studentAttendance.push({ id: `sa-abs-${i}`, schoolId, status: "ABSENT", attendanceDate: now });
      }

      // Staff Attendance for today (OD3): 2 present, 0 absent = 100.0%
      mockDbState.staffAttendance.push(
        { id: "sta-1", schoolId, status: "PRESENT", attendanceDate: now },
        { id: "sta-2", schoolId, status: "PRESENT", attendanceDate: now }
      );

      // Exam Mark Locks: 3 submitted
      mockDbState.examMarksLocks.push(
        { id: "lock-1", schoolId, status: "SUBMITTED" },
        { id: "lock-2", schoolId, status: "SUBMITTED" },
        { id: "lock-3", schoolId, status: "SUBMITTED" }
      );

      const metrics = await getPrincipalConsoleMetrics(schoolId, { now });

      expect(metrics.activeSectionsCount).toBe(2);
      expect(metrics.activeTeachingStaffCount).toBe(2);
      expect(metrics.todayStudentAttendance.isMarkedToday).toBe(true);
      expect(metrics.todayStudentAttendance.totalMarked).toBe(10);
      expect(metrics.todayStudentAttendance.presentCount).toBe(8);
      expect(metrics.todayStudentAttendance.ratePercent).toBe(80);
      expect(metrics.todayStudentAttendance.formattedPercent).toBe("80.0%");
      expect(metrics.pendingExamVerificationsCount).toBe(3);
      expect(metrics.staffAttendanceRate).not.toBeNull();
      expect(metrics.staffAttendanceRate?.ratePercent).toBe(100);
      expect(metrics.staffAttendanceRate?.formattedPercent).toBe("100.0%");
    });
  });

  describe("2. Librarian Console Metrics", () => {
    it("returns honest zeros for an empty library", async () => {
      const metrics = await getLibrarianConsoleMetrics("school-empty");
      expect(metrics.totalCopies).toBe(0);
      expect(metrics.availableCopies).toBe(0);
      expect(metrics.currentlyIssued).toBe(0);
      expect(metrics.overdueCount).toBe(0);
      expect(metrics.distinctCategoriesCount).toBe(0);
      expect(metrics.topCategories).toEqual([]);
    });

    it("computes live inventory, active issues, and overdue returns accurately", async () => {
      const schoolId = "school-library";
      const now = new Date("2026-10-30T10:00:00Z");
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Books with copies
      mockDbState.books.push(
        {
          id: "book-1",
          schoolId,
          totalCopies: 3,
          availableCopies: 2,
          category: "Mathematics",
          copies: [
            { id: "copy-1", isAvailable: true },
            { id: "copy-2", isAvailable: true },
            { id: "copy-3", isAvailable: false },
          ],
        },
        {
          id: "book-2",
          schoolId,
          totalCopies: 2,
          availableCopies: 1,
          category: "Science",
          copies: [
            { id: "copy-4", isAvailable: true },
            { id: "copy-5", isAvailable: false },
          ],
        }
      );

      // Issues: 1 active on-time, 1 active overdue, 1 returned
      mockDbState.bookIssues.push(
        { id: "issue-1", schoolId, status: "ISSUED", dueDate: nextWeek, returnedAt: null },
        { id: "issue-2", schoolId, status: "ISSUED", dueDate: yesterday, returnedAt: null }, // Overdue!
        { id: "issue-3", schoolId, status: "RETURNED", dueDate: yesterday, returnedAt: yesterday } // Returned!
      );

      const metrics = await getLibrarianConsoleMetrics(schoolId, { now });

      expect(metrics.totalCopies).toBe(5);
      expect(metrics.availableCopies).toBe(3);
      expect(metrics.currentlyIssued).toBe(2);
      expect(metrics.overdueCount).toBe(1);
      expect(metrics.distinctCategoriesCount).toBe(2);
      expect(metrics.topCategories.length).toBe(2);
    });
  });

  describe("3. Transport Console Metrics", () => {
    it("returns honest zeros and no blanket GPS claim for empty fleet", async () => {
      const metrics = await getTransportConsoleMetrics("school-empty");
      expect(metrics.activeVehiclesCount).toBe(0);
      expect(metrics.activeRoutesCount).toBe(0);
      expect(metrics.pickupStopsCount).toBe(0);
      expect(metrics.optedInStudentsCount).toBe(0);
      expect(metrics.maintenanceAlertsCount).toBe(0);
      expect(metrics.activeGpsVehiclesCount).toBe(0);
      expect(metrics.gpsStatus.hasActivePings).toBe(false);
      expect(metrics.gpsStatus.pingRecencyLabel).toBe("No recent GPS signal");
    });

    it("evaluates live fleet counts, maintenance alerts, and actual GPS recency", async () => {
      const schoolId = "school-transport";
      const now = new Date("2026-10-30T10:00:00Z");
      const pastDate = new Date("2026-09-01T00:00:00Z"); // Expired!
      const futureSafeDate = new Date("2027-10-30T00:00:00Z");

      // Vehicles: 1 healthy, 1 with expired fitness check
      mockDbState.vehicles.push(
        {
          id: "veh-1",
          schoolId,
          busNumber: "BUS-01",
          fitnessCertExpiryDate: futureSafeDate,
          insuranceExpiryDate: futureSafeDate,
        },
        {
          id: "veh-2",
          schoolId,
          busNumber: "BUS-02",
          fitnessCertExpiryDate: pastDate, // Alert!
          insuranceExpiryDate: futureSafeDate,
        }
      );

      // Routes and stops
      mockDbState.routes.push({
        id: "route-1",
        schoolId,
        vehicleId: "veh-1",
        stops: [{ id: "stop-1" }, { id: "stop-2" }, { id: "stop-3" }],
      });

      // Opted-in students: 2 passes for 2 distinct students
      mockDbState.studentBusPasses.push(
        { id: "pass-1", schoolId, studentId: "stu-1", isActive: true },
        { id: "pass-2", schoolId, studentId: "stu-2", isActive: true }
      );

      // GPS Ping: veh-1 pinged 3 minutes ago
      const threeMinsAgo = new Date(now.getTime() - 3 * 60 * 1000);
      mockDbState.gpsPings.push({
        vehicleId: "veh-1",
        latitude: "28.6139",
        longitude: "77.2090",
        recordedAt: threeMinsAgo,
      });

      const metrics = await getTransportConsoleMetrics(schoolId, { now });

      expect(metrics.activeVehiclesCount).toBe(2);
      expect(metrics.activeRoutesCount).toBe(1);
      expect(metrics.pickupStopsCount).toBe(3);
      expect(metrics.optedInStudentsCount).toBe(2);
      expect(metrics.maintenanceAlertsCount).toBe(1);
      expect(metrics.vehiclesWithMaintenanceAlert[0]!.busNumber).toBe("BUS-02");
      expect(metrics.vehiclesWithMaintenanceAlert[0]!.issue).toContain("Fitness expired");
      expect(metrics.activeGpsVehiclesCount).toBe(1);
      expect(metrics.gpsStatus.hasActivePings).toBe(true);
      expect(metrics.gpsStatus.pingRecencyLabel).toBe("Active (3m ago)");
    });
  });
});
