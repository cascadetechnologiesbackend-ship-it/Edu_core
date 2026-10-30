// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, className, ...rest }: any) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

// Mocks for Principal Dashboard
const mockPrincipalMetrics = {
  activeSectionsCount: 12,
  activeTeachingStaffCount: 24,
  todayStudentAttendance: {
    totalMarked: 240,
    presentCount: 228,
    ratePercent: 95.0,
    formattedPercent: "95.0%",
    isMarkedToday: true,
  },
  pendingExamVerificationsCount: 2,
  staffAttendanceRate: {
    totalMarked: 24,
    presentCount: 23,
    ratePercent: 95.8,
    formattedPercent: "95.8%",
  },
};

// Mocks for Librarian Dashboard
const mockLibrarianMetrics = {
  totalCopies: 450,
  availableCopies: 420,
  currentlyIssued: 30,
  overdueCount: 4,
  distinctCategoriesCount: 8,
  topCategories: [
    { category: "Science", count: 120 },
    { category: "Mathematics", count: 90 },
  ],
};

// Mocks for Transport Dashboard
const mockTransportMetrics = {
  activeVehiclesCount: 5,
  activeRoutesCount: 4,
  pickupStopsCount: 18,
  optedInStudentsCount: 110,
  maintenanceAlertsCount: 1,
  vehiclesWithMaintenanceAlert: [
    { vehicleId: "v1", busNumber: "Bus 01", issue: "Fitness check due" },
  ],
  activeGpsVehiclesCount: 3,
  gpsStatus: {
    hasActivePings: true,
    lastPingAt: new Date(),
    pingRecencyLabel: "Live (just now)",
  },
};

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async () => ({
    userId: "test-user-1",
    role: "SCHOOL_ADMIN",
    schoolId: "school-123",
  })),
  requireSchool: vi.fn(async () => ({
    id: "school-123",
    name: "Delhi Public School",
  })),
  getCachedSession: vi.fn(async () => ({
    user: {
      id: "test-user-1",
      name: "Test User",
      role: "DRIVER",
      schoolId: "school-123",
    },
  })),
}));

vi.mock("@schoolmitra/database", () => ({
  assertQueryBudget: vi.fn(async (cb: any) => await cb()),
}));

vi.mock("@/lib/serverTiming", () => ({
  withDataPhaseTiming: vi.fn(async (_label: string, cb: any) => await cb()),
}));

vi.mock("@/lib/encryption", () => ({
  decryptData: vi.fn((val: string) => val),
}));

vi.mock("@/db", () => ({
  assertQueryBudget: vi.fn(async (cb: any) => await cb()),
  db: {
    query: {
      drivers: {
        findFirst: vi.fn(async () => null),
      },
      routes: {
        findFirst: vi.fn(async () => null),
      },
    },
  },
}));

vi.mock("@/lib/roleConsoleEngine", () => ({
  getPrincipalConsoleMetrics: vi.fn(async () => mockPrincipalMetrics),
  getLibrarianConsoleMetrics: vi.fn(async () => mockLibrarianMetrics),
  getTransportConsoleMetrics: vi.fn(async () => mockTransportMetrics),
}));

import PrincipalDashboardPage from "../app/(principal)/principal/dashboard/page";
import LibrarianDashboardPage from "../app/(librarian)/librarian/dashboard/page";
import TransportManagerDashboardPage from "../app/(transport-manager)/transport/dashboard/page";
import DriverDashboardPage from "../app/(driver)/driver/dashboard/page";

describe("Sprint S23 Layer 6: Mobile Law (390px Viewport & >= 38px Touch Targets)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const checkZeroHorizontalOverflow = (container: HTMLElement) => {
    // Check root container has overflow-x-hidden or responsive max-width
    const rootDiv = container.firstElementChild as HTMLElement;
    expect(rootDiv).toBeDefined();
    expect(rootDiv.className).toContain("overflow-x-hidden");

    // Check no element has fixed pixel width > 390px
    const allElements = container.querySelectorAll("*");
    allElements.forEach((el) => {
      const classNames = el.className;
      if (typeof classNames === "string") {
        const match = classNames.match(/w-\[(\d+)px\]/);
        if (match && match[1]) {
          const widthVal = parseInt(match[1], 10);
          expect(widthVal).toBeLessThanOrEqual(390);
        }
      }
    });
  };

  const checkInteractiveTouchTargets = (container: HTMLElement) => {
    // Check all clickable links and buttons enforce minimum 38px touch targets
    const clickables = container.querySelectorAll("a, button");
    expect(clickables.length).toBeGreaterThan(0);
    clickables.forEach((el) => {
      const classNames = el.className;
      expect(classNames).toContain("min-h-[38px]");
    });
  };

  describe("1. Principal Executive Dashboard: 390px Reflow & Touch Targets", () => {
    it("guarantees zero horizontal overflow and overflow-x-hidden at 390px", async () => {
      const Component = await PrincipalDashboardPage();
      const { container } = render(Component);
      checkZeroHorizontalOverflow(container);
    });

    it("enforces minimum 38px touch targets on all interactive actions", async () => {
      const Component = await PrincipalDashboardPage();
      const { container } = render(Component);
      checkInteractiveTouchTargets(container);
    });
  });

  describe("2. Librarian Operations Console: 390px Reflow & Touch Targets", () => {
    it("guarantees zero horizontal overflow and overflow-x-hidden at 390px", async () => {
      const Component = await LibrarianDashboardPage();
      const { container } = render(Component);
      checkZeroHorizontalOverflow(container);
    });

    it("enforces minimum 38px touch targets on all interactive actions", async () => {
      const Component = await LibrarianDashboardPage();
      const { container } = render(Component);
      checkInteractiveTouchTargets(container);
    });
  });

  describe("3. Transport Fleet Console: 390px Reflow & Touch Targets", () => {
    it("guarantees zero horizontal overflow and overflow-x-hidden at 390px", async () => {
      const Component = await TransportManagerDashboardPage();
      const { container } = render(Component);
      checkZeroHorizontalOverflow(container);
    });

    it("enforces minimum 38px touch targets on all interactive actions", async () => {
      const Component = await TransportManagerDashboardPage();
      const { container } = render(Component);
      checkInteractiveTouchTargets(container);
    });
  });

  describe("4. Driver Dashboard Honest Empty State: 390px Reflow & Touch Targets", () => {
    it("renders setup-missing card within 390px without horizontal overflow", async () => {
      const Component = await DriverDashboardPage();
      const { container } = render(Component);

      const setupCard = container.querySelector("[data-testid='driver-setup-missing-card']") as HTMLElement;
      expect(setupCard).toBeDefined();
      expect(setupCard.className).toContain("max-w-lg");

      // Verify action link has >= 38px touch target
      const actionLink = setupCard.querySelector("a");
      if (actionLink) {
        expect(actionLink.className).toContain("min-h-[38px]");
      }
    });
  });
});

