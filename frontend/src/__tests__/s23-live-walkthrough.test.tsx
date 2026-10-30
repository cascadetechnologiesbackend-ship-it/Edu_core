// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ─── 1. Hoisted Walkthrough Fixtures ──────────────────────────────────────────
const { currentSchoolRef, currentDriverRef, walkthroughData } = vi.hoisted(() => {
  const currentSchoolRef = { current: "school-loaded" };
  const currentDriverRef = { current: "driver-assigned" };

  const walkthroughData: Record<string, {
    schoolName: string;
    sections: Array<{ id: string; schoolId: string; isActive: boolean }>;
    staff: Array<{ id: string; schoolId: string; isActive: boolean; deletedAt: any; designation: any }>;
    studentAttendance: Array<{ id: string; schoolId: string; status: string; attendanceDate: Date }>;
    examMarksLocks: Array<{ id: string; schoolId: string; status: string }>;
    staffAttendance: Array<{ id: string; schoolId: string; status: string; attendanceDate: Date }>;
    books: Array<{ id: string; schoolId: string; totalCopies: number; availableCopies: number; category: string; deletedAt: any; copies: any[] }>;
    bookIssues: Array<{ id: string; schoolId: string; status: string; returnedAt: any; dueDate: Date }>;
    vehicles: Array<{ id: string; schoolId: string; busNumber: string; registrationNumber: string; deletedAt: any; isActive: boolean; fitnessCertExpiryDate: any; insuranceExpiryDate: any }>;
    routes: Array<{ id: string; schoolId: string; vehicleId?: string; routeName: string; deletedAt: any; stops: any[] }>;
    busPasses: Array<{ id: string; schoolId: string; status: string; deletedAt: any }>;
    gpsPings: Array<{ id: string; vehicleId: string; recordedAt: Date }>;
    drivers: Array<{ id: string; schoolId: string; userId: string; vehicleId: string | null; nameEncrypted: string; licenceEncrypted: string; deletedAt: any }>;
  }> = {
    "school-loaded": {
      schoolName: "Delhi Public School (Loaded Tenant)",
      sections: Array.from({ length: 10 }, (_, i) => ({
        id: `sec-l-${i}`,
        schoolId: "school-loaded",
        isActive: true,
      })),
      staff: Array.from({ length: 25 }, (_, i) => ({
        id: `st-l-${i}`,
        schoolId: "school-loaded",
        isActive: true,
        deletedAt: null,
        designation: { isTeaching: true },
      })),
      studentAttendance: [
        ...Array.from({ length: 230 }, (_, i) => ({
          id: `att-p-${i}`,
          schoolId: "school-loaded",
          status: "PRESENT",
          attendanceDate: new Date(),
        })),
        ...Array.from({ length: 20 }, (_, i) => ({
          id: `att-a-${i}`,
          schoolId: "school-loaded",
          status: "ABSENT",
          attendanceDate: new Date(),
        })),
      ],
      examMarksLocks: [
        { id: "lock-1", schoolId: "school-loaded", status: "SUBMITTED" },
        { id: "lock-2", schoolId: "school-loaded", status: "SUBMITTED" },
        { id: "lock-3", schoolId: "school-loaded", status: "SUBMITTED" },
      ],
      staffAttendance: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `satt-p-${i}`,
          schoolId: "school-loaded",
          status: "PRESENT",
          attendanceDate: new Date(),
        })),
        {
          id: "satt-a-1",
          schoolId: "school-loaded",
          status: "ABSENT",
          attendanceDate: new Date(),
        },
      ],
      books: [
        {
          id: "bk-1",
          schoolId: "school-loaded",
          totalCopies: 500,
          availableCopies: 450,
          category: "Science",
          deletedAt: null,
          copies: [],
        },
        {
          id: "bk-2",
          schoolId: "school-loaded",
          totalCopies: 300,
          availableCopies: 270,
          category: "Mathematics",
          deletedAt: null,
          copies: [],
        },
      ],
      bookIssues: [
        ...Array.from({ length: 75 }, (_, i) => ({
          id: `iss-active-${i}`,
          schoolId: "school-loaded",
          status: "ISSUED",
          returnedAt: null,
          dueDate: new Date(Date.now() + 86400000 * 5),
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `iss-overdue-${i}`,
          schoolId: "school-loaded",
          status: "ISSUED",
          returnedAt: null,
          dueDate: new Date(Date.now() - 86400000 * 2), // 2 days overdue
        })),
      ],
      vehicles: [
        {
          id: "veh-1",
          schoolId: "school-loaded",
          busNumber: "Bus 01",
          registrationNumber: "DL-01-AB-1001",
          deletedAt: null,
          isActive: true,
          fitnessCertExpiryDate: new Date(Date.now() + 86400000 * 180),
          insuranceExpiryDate: new Date(Date.now() + 86400000 * 180),
        },
        {
          id: "veh-2",
          schoolId: "school-loaded",
          busNumber: "Bus 02",
          registrationNumber: "DL-01-AB-1002",
          deletedAt: null,
          isActive: true,
          fitnessCertExpiryDate: new Date(Date.now() + 86400000 * 180),
          insuranceExpiryDate: new Date(Date.now() + 86400000 * 180),
        },
        {
          id: "veh-3",
          schoolId: "school-loaded",
          busNumber: "Bus 03",
          registrationNumber: "DL-01-AB-1003",
          deletedAt: null,
          isActive: true,
          fitnessCertExpiryDate: new Date(Date.now() + 86400000 * 180),
          insuranceExpiryDate: new Date(Date.now() + 86400000 * 15), // Expiring in 15 days
        },
        {
          id: "veh-4",
          schoolId: "school-loaded",
          busNumber: "Bus 04",
          registrationNumber: "DL-01-AB-1004",
          deletedAt: null,
          isActive: true,
          fitnessCertExpiryDate: new Date(Date.now() + 86400000 * 180),
          insuranceExpiryDate: new Date(Date.now() + 86400000 * 180),
        },
        {
          id: "veh-5",
          schoolId: "school-loaded",
          busNumber: "Bus 05",
          registrationNumber: "DL-01-AB-1005",
          deletedAt: null,
          isActive: true,
          fitnessCertExpiryDate: new Date(Date.now() + 86400000 * 180),
          insuranceExpiryDate: new Date(Date.now() + 86400000 * 180),
        },
        {
          id: "veh-6",
          schoolId: "school-loaded",
          busNumber: "Bus 06",
          registrationNumber: "DL-01-AB-1006",
          deletedAt: null,
          isActive: true,
          fitnessCertExpiryDate: new Date(Date.now() + 86400000 * 180),
          insuranceExpiryDate: new Date(Date.now() + 86400000 * 180),
        },
      ],
      routes: [
        {
          id: "rt-1",
          schoolId: "school-loaded",
          vehicleId: "veh-1",
          routeName: "North Route 1",
          deletedAt: null,
          stops: [
            { id: "st-1", stopName: "Stop 1", stopOrder: 1 },
            { id: "st-2", stopName: "Stop 2", stopOrder: 2 },
            { id: "st-3", stopName: "Stop 3", stopOrder: 3 },
            { id: "st-4", stopName: "Stop 4", stopOrder: 4 },
            { id: "st-5", stopName: "Stop 5", stopOrder: 5 },
          ],
        },
        {
          id: "rt-2",
          schoolId: "school-loaded",
          vehicleId: "veh-2",
          routeName: "South Route 2",
          deletedAt: null,
          stops: Array.from({ length: 5 }, (_, i) => ({ id: `st-s-${i}`, stopName: `South Stop ${i}`, stopOrder: i })),
        },
        {
          id: "rt-3",
          schoolId: "school-loaded",
          vehicleId: "veh-3",
          routeName: "East Route 3",
          deletedAt: null,
          stops: Array.from({ length: 5 }, (_, i) => ({ id: `st-e-${i}`, stopName: `East Stop ${i}`, stopOrder: i })),
        },
        {
          id: "rt-4",
          schoolId: "school-loaded",
          vehicleId: "veh-4",
          routeName: "West Route 4",
          deletedAt: null,
          stops: Array.from({ length: 5 }, (_, i) => ({ id: `st-w-${i}`, stopName: `West Stop ${i}`, stopOrder: i })),
        },
        {
          id: "rt-5",
          schoolId: "school-loaded",
          vehicleId: "veh-5",
          routeName: "Central Route 5",
          deletedAt: null,
          stops: Array.from({ length: 4 }, (_, i) => ({ id: `st-c-${i}`, stopName: `Central Stop ${i}`, stopOrder: i })),
        },
      ],
      busPasses: Array.from({ length: 180 }, (_, i) => ({
        id: `bp-${i}`,
        studentId: `stu-${i}`,
        schoolId: "school-loaded",
        status: "ACTIVE",
        deletedAt: null,
      })),
      gpsPings: [
        {
          id: "ping-1",
          vehicleId: "veh-1",
          recordedAt: new Date(Date.now() - 120000), // 2 mins ago
        },
      ],
      drivers: [
        {
          id: "driver-assigned",
          schoolId: "school-loaded",
          userId: "user-driver-assigned",
          vehicleId: "veh-1",
          nameEncrypted: "Ramesh Sharma",
          licenceEncrypted: "DL-04-2015-8888",
          deletedAt: null,
        },
      ],
    },
    "school-fresh": {
      schoolName: "St. Xavier Model School (Fresh Tenant)",
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
      drivers: [],
    },
  };

  return { currentSchoolRef, currentDriverRef, walkthroughData };
});

// ─── 2. Auth & Tenancy Mocks ──────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({ children, href, className, ...rest }: any) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async () => ({
    userId: "walkthrough-admin",
    role: "SCHOOL_ADMIN",
    schoolId: currentSchoolRef.current,
  })),
  requireSchool: vi.fn(async () => ({
    id: currentSchoolRef.current,
    name: walkthroughData[currentSchoolRef.current]!.schoolName,
  })),
  getCachedSession: vi.fn(async () => ({
    user: {
      id: currentDriverRef.current === "driver-assigned" ? "user-driver-assigned" : "user-driver-fresh",
      name: "Driver User",
      role: "DRIVER",
      schoolId: currentSchoolRef.current,
    },
  })),
}));

vi.mock("@schoolmitra/database", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    assertQueryBudget: vi.fn(async (cb: any) => await cb()),
    db: {
      transaction: vi.fn(async (cb: any) => await cb({})),
      query: {
        drivers: {
          findFirst: vi.fn(async () => {
            const data = walkthroughData[currentSchoolRef.current]!;
            if (currentDriverRef.current === "driver-assigned") {
              return data.drivers.find((d) => d.id === "driver-assigned") || null;
            }
            return null;
          }),
        },
        routes: {
          findFirst: vi.fn(async () => {
            const data = walkthroughData[currentSchoolRef.current]!;
            if (currentDriverRef.current === "driver-assigned") {
              return data.routes[0] || null;
            }
            return null;
          }),
        },
      },
    },
  };
});

vi.mock("@/lib/serverTiming", () => ({
  withDataPhaseTiming: vi.fn(async (_label: string, cb: any) => await cb()),
}));

vi.mock("@/lib/encryption", () => ({
  decryptData: vi.fn((val: string) => val),
}));

vi.mock("@/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    assertQueryBudget: vi.fn(async (cb: any) => await cb()),
    db: {
      ...actual.db,
      query: {
        ...actual.db?.query,
        drivers: {
          findFirst: vi.fn(async () => {
            const data = walkthroughData[currentSchoolRef.current]!;
            if (currentDriverRef.current === "driver-assigned") {
              const drv = data.drivers.find((d) => d.id === "driver-assigned");
              if (drv) {
                const veh = data.vehicles.find((v) => v.id === drv.vehicleId);
                return { ...drv, vehicle: veh };
              }
            }
            return null;
          }),
        },
        routes: {
          findFirst: vi.fn(async () => {
            const data = walkthroughData[currentSchoolRef.current]!;
            if (currentDriverRef.current === "driver-assigned") {
              return data.routes[0] || null;
            }
            return null;
          }),
        },
      },
    },
  };
});

vi.mock("@/lib/tenant", () => ({
  withTenant: vi.fn(async (schoolId: string, cb: (tenantDb: any) => Promise<any>) => {
    const data = walkthroughData[schoolId]!;

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

vi.mock("../app/(driver)/driver/dashboard/DriverDashboardClient", () => ({
  default: ({ driver, vehicle, route }: any) => (
    <div data-testid="driver-dashboard-client">
      <div>Driver: {driver.name}</div>
      <div>Licence: {driver.licence}</div>
      <div>Vehicle: {vehicle?.busNumber}</div>
      <div>Route: {route?.routeName}</div>
    </div>
  ),
}));

import PrincipalDashboardPage from "../app/(principal)/principal/dashboard/page";
import LibrarianDashboardPage from "../app/(librarian)/librarian/dashboard/page";
import TransportManagerDashboardPage from "../app/(transport-manager)/transport/dashboard/page";
import DriverDashboardPage from "../app/(driver)/driver/dashboard/page";

describe("Sprint S23 Layer 8: Live Two-Tenant Walkthrough Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Loaded Test School (Operational Telemetry)", () => {
    beforeEach(() => {
      currentSchoolRef.current = "school-loaded";
      currentDriverRef.current = "driver-assigned";
    });

    it("verifies Principal sees live sections, faculty, attendance %, and exam locks", async () => {
      const Component = await PrincipalDashboardPage();
      render(Component);

      // Live metrics matching domain data
      expect(screen.getByTestId("principal-sections-metric").textContent).toContain("10");
      expect(screen.getByTestId("principal-staff-metric").textContent).toContain("25");
      expect(screen.getByTestId("principal-staff-metric").textContent).toContain("96.0% Staff Attendance Today");
      expect(screen.getByTestId("principal-attendance-metric").textContent).toContain("92.0%");
      expect(screen.getByTestId("principal-exams-metric").textContent).toContain("3 Classes");

      // Setup banner must not appear
      expect(screen.queryByText("School Setup in Progress")).toBeNull();

      // Zero fabricated literals
      expect(screen.queryByText("24")).toBeNull();
      expect(screen.queryByText("48")).toBeNull();
      expect(screen.queryByText("94.2%")).toBeNull();
    });

    it("verifies Librarian sees live copy volume, active issues, overdue alerts, and categories", async () => {
      const Component = await LibrarianDashboardPage();
      render(Component);

      expect(screen.getByTestId("librarian-total-copies-metric").textContent).toContain("800");
      expect(screen.getByTestId("librarian-total-copies-metric").textContent).toContain("720 available in library");
      expect(screen.getByTestId("librarian-issued-metric").textContent).toContain("80 Books");
      expect(screen.getByTestId("librarian-overdue-metric").textContent).toContain("5 Books");
      expect(screen.getByTestId("librarian-overdue-metric").textContent).toContain("Late fine applicable");
      expect(screen.getByTestId("librarian-categories-metric").textContent).toContain("2");
      expect(screen.getByTestId("librarian-categories-metric").textContent).toContain("Science, Mathematics");

      expect(screen.queryByText("Library Catalog Setup in Progress")).toBeNull();

      // Zero fabricated literals
      expect(screen.queryByText("4,850")).toBeNull();
      expect(screen.queryByText("142 Books")).toBeNull();
      expect(screen.queryByText("8 Books")).toBeNull();
      expect(screen.queryByText("18")).toBeNull();
    });

    it("verifies Transport Manager sees live fleet, GPS recency, routes, opt-in students, and maintenance", async () => {
      const Component = await TransportManagerDashboardPage();
      render(Component);

      expect(screen.getByTestId("transport-vehicles-metric").textContent).toContain("6 Vehicles");
      expect(screen.getByTestId("transport-vehicles-metric").textContent).toContain("Active (2m ago)");
      expect(screen.getByTestId("transport-routes-metric").textContent).toContain("5 Routes");
      expect(screen.getByTestId("transport-routes-metric").textContent).toContain("24 Pickup Stops");
      expect(screen.getByTestId("transport-students-metric").textContent).toContain("180 Students");
      expect(screen.getByTestId("transport-maintenance-metric").textContent).toContain("1 Vehicle");
      expect(screen.getByTestId("transport-maintenance-metric").textContent).toContain("Bus 03: Insurance renewal due");

      expect(screen.queryByText("Transport Fleet Setup in Progress")).toBeNull();

      // Zero fabricated literals
      expect(screen.queryByText("8 Vehicles")).toBeNull();
      expect(screen.queryByText("Active GPS Tracking")).toBeNull();
      expect(screen.queryByText("12 Routes")).toBeNull();
      expect(screen.queryByText("45 Pickup Stops")).toBeNull();
      expect(screen.queryByText("320 Students")).toBeNull();
    });

    it("verifies Driver sees active trip console with assigned bus and route stops", async () => {
      const Component = await DriverDashboardPage();
      render(Component);

      expect(screen.getByTestId("driver-dashboard-client")).toBeDefined();
      expect(screen.getByText("Driver: Ramesh Sharma")).toBeDefined();
      expect(screen.getByText("Licence: DL-04-2015-8888")).toBeDefined();
      expect(screen.getByText("Vehicle: Bus 01")).toBeDefined();
      expect(screen.getByText("Route: North Route 1")).toBeDefined();

      expect(screen.queryByTestId("driver-setup-missing-card")).toBeNull();
      expect(screen.queryByText("DL-DEMO-2026")).toBeNull();
    });
  });

  describe("2. Fresh Provisioned School (Honest Empty State & Next-Best Actions)", () => {
    beforeEach(() => {
      currentSchoolRef.current = "school-fresh";
      currentDriverRef.current = "driver-unassigned";
    });

    it("verifies Principal sees honest zeros and School Setup in Progress banner", async () => {
      const Component = await PrincipalDashboardPage();
      render(Component);

      expect(screen.getByTestId("principal-sections-metric").textContent).toContain("0");
      expect(screen.getByTestId("principal-sections-metric").textContent).toContain("0 active class sections");
      expect(screen.getByTestId("principal-staff-metric").textContent).toContain("0");
      expect(screen.getByTestId("principal-staff-metric").textContent).toContain("0 active faculty members");
      expect(screen.getByTestId("principal-attendance-metric").textContent).toContain("0.0%");
      expect(screen.getByTestId("principal-attendance-metric").textContent).toContain("Attendance not taken today");
      expect(screen.getByTestId("principal-exams-metric").textContent).toContain("0 Classes");

      expect(screen.getByText("School Setup in Progress")).toBeDefined();
      expect(screen.getByText(/Configure Class Sections/)).toBeDefined();
    });

    it("verifies Librarian sees honest zeros and Library Catalog Setup in Progress banner", async () => {
      const Component = await LibrarianDashboardPage();
      render(Component);

      expect(screen.getByTestId("librarian-total-copies-metric").textContent).toContain("0");
      expect(screen.getByTestId("librarian-total-copies-metric").textContent).toContain("0 physical copies in inventory");
      expect(screen.getByTestId("librarian-issued-metric").textContent).toContain("0 Books");
      expect(screen.getByTestId("librarian-issued-metric").textContent).toContain("No books currently checked out");
      expect(screen.getByTestId("librarian-overdue-metric").textContent).toContain("0 Books");
      expect(screen.getByTestId("librarian-overdue-metric").textContent).toContain("No overdue returns");
      expect(screen.getByTestId("librarian-categories-metric").textContent).toContain("0");

      expect(screen.getByText("Library Catalog Setup in Progress")).toBeDefined();
      expect(screen.getByText(/Add Catalog Titles/)).toBeDefined();
    });

    it("verifies Transport Manager sees honest zeros and Transport Fleet Setup banner", async () => {
      const Component = await TransportManagerDashboardPage();
      render(Component);

      expect(screen.getByTestId("transport-vehicles-metric").textContent).toContain("0 Vehicles");
      expect(screen.getByTestId("transport-vehicles-metric").textContent).toContain("0 vehicles registered");
      expect(screen.getByTestId("transport-routes-metric").textContent).toContain("0 Routes");
      expect(screen.getByTestId("transport-routes-metric").textContent).toContain("0 pickup stops defined");
      expect(screen.getByTestId("transport-students-metric").textContent).toContain("0 Students");
      expect(screen.getByTestId("transport-students-metric").textContent).toContain("No student passes issued");
      expect(screen.getByTestId("transport-maintenance-metric").textContent).toContain("0 Vehicles");
      expect(screen.getByTestId("transport-maintenance-metric").textContent).toContain("All vehicles fitness-certified");

      expect(screen.getByText("Transport Fleet Setup in Progress")).toBeDefined();
      expect(screen.getByText(/Configure Fleet & Routes/)).toBeDefined();
    });

    it("verifies Driver sees honest setup-missing card and zero DL-DEMO-2026 theft", async () => {
      const Component = await DriverDashboardPage();
      render(Component);

      expect(screen.getByTestId("driver-setup-missing-card")).toBeDefined();
      expect(screen.getByText("No Vehicle or Route Assigned")).toBeDefined();
      expect(screen.getByText("Transport Allocation Pending")).toBeDefined();
      expect(screen.getByText(/Your account is not linked to an active driver profile/)).toBeDefined();

      expect(screen.queryByTestId("driver-dashboard-client")).toBeNull();
      expect(screen.queryByText("DL-DEMO-2026")).toBeNull();
      expect(screen.queryByText("School Bus Driver")).toBeNull();
    });
  });
});
