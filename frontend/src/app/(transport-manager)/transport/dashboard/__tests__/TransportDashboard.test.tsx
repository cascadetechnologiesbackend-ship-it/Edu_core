// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockTransportMetrics = {
  activeVehiclesCount: 0,
  activeRoutesCount: 0,
  pickupStopsCount: 0,
  optedInStudentsCount: 0,
  maintenanceAlertsCount: 0,
  vehiclesWithMaintenanceAlert: [] as Array<{
    vehicleId: string;
    busNumber: string;
    issue: string;
  }>,
  activeGpsVehiclesCount: 0,
  gpsStatus: {
    hasActivePings: false,
    lastPingAt: null as Date | null,
    pingRecencyLabel: "No recent GPS signal",
  },
};

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async () => ({
    userId: "transport-user-1",
    role: "TRANSPORT_MANAGER",
    schoolId: "school-123",
  })),
  requireSchool: vi.fn(async () => ({
    id: "school-123",
    name: "Delhi Public School",
  })),
}));

vi.mock("@schoolmitra/database", () => ({
  assertQueryBudget: vi.fn(async (cb: any) => await cb()),
}));

vi.mock("@/lib/roleConsoleEngine", () => ({
  getTransportConsoleMetrics: vi.fn(async () => mockTransportMetrics),
}));

import TransportManagerDashboardPage from "../page";

describe("Sprint S23 Layer 4: Transport Manager Dashboard Truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders honest zeros and setup-in-progress banner for an empty fleet", async () => {
    mockTransportMetrics.activeVehiclesCount = 0;
    mockTransportMetrics.activeRoutesCount = 0;
    mockTransportMetrics.pickupStopsCount = 0;
    mockTransportMetrics.optedInStudentsCount = 0;
    mockTransportMetrics.maintenanceAlertsCount = 0;
    mockTransportMetrics.vehiclesWithMaintenanceAlert = [];
    mockTransportMetrics.activeGpsVehiclesCount = 0;
    mockTransportMetrics.gpsStatus = {
      hasActivePings: false,
      lastPingAt: null,
      pingRecencyLabel: "No recent GPS signal",
    };

    const Component = await TransportManagerDashboardPage();
    render(Component);

    // Honest zeros
    expect(screen.getByTestId("transport-vehicles-metric").textContent).toContain("0 Vehicles");
    expect(screen.getByTestId("transport-vehicles-metric").textContent).toContain("0 vehicles registered");
    expect(screen.getByTestId("transport-routes-metric").textContent).toContain("0 Routes");
    expect(screen.getByTestId("transport-routes-metric").textContent).toContain("0 pickup stops defined");
    expect(screen.getByTestId("transport-students-metric").textContent).toContain("0 Students");
    expect(screen.getByTestId("transport-students-metric").textContent).toContain("No student passes issued");
    expect(screen.getByTestId("transport-maintenance-metric").textContent).toContain("0 Vehicles");
    expect(screen.getByTestId("transport-maintenance-metric").textContent).toContain("All vehicles fitness-certified");

    // Next-best action banner for fresh school
    expect(screen.getByText("Transport Fleet Setup in Progress")).toBeDefined();
    expect(screen.getByText(/Configure Fleet & Routes/)).toBeDefined();

    // Fabricated literals must NOT exist
    expect(screen.queryByText("8 Vehicles")).toBeNull();
    expect(screen.queryByText("Active GPS Tracking")).toBeNull();
    expect(screen.queryByText("12 Routes")).toBeNull();
    expect(screen.queryByText("45 Pickup Stops")).toBeNull();
    expect(screen.queryByText("320 Students")).toBeNull();
  });

  it("renders live counts, GPS recency, and maintenance alert for a populated fleet", async () => {
    mockTransportMetrics.activeVehiclesCount = 6;
    mockTransportMetrics.activeRoutesCount = 4;
    mockTransportMetrics.pickupStopsCount = 22;
    mockTransportMetrics.optedInStudentsCount = 145;
    mockTransportMetrics.maintenanceAlertsCount = 1;
    mockTransportMetrics.vehiclesWithMaintenanceAlert = [
      { vehicleId: "v1", busNumber: "DL-01-AB-1234", issue: "Fitness check due" },
    ];
    mockTransportMetrics.activeGpsVehiclesCount = 3;
    mockTransportMetrics.gpsStatus = {
      hasActivePings: true,
      lastPingAt: new Date(),
      pingRecencyLabel: "Live (just now)",
    };

    const Component = await TransportManagerDashboardPage();
    render(Component);

    // Live counts rendered
    expect(screen.getByTestId("transport-vehicles-metric").textContent).toContain("6 Vehicles");
    expect(screen.getByTestId("transport-vehicles-metric").textContent).toContain("Live (just now)");
    expect(screen.getByTestId("transport-routes-metric").textContent).toContain("4 Routes");
    expect(screen.getByTestId("transport-routes-metric").textContent).toContain("22 Pickup Stops");
    expect(screen.getByTestId("transport-students-metric").textContent).toContain("145 Students");
    expect(screen.getByTestId("transport-students-metric").textContent).toContain("Auto Transport Fee Assigned");
    expect(screen.getByTestId("transport-maintenance-metric").textContent).toContain("1 Vehicle");
    expect(screen.getByTestId("transport-maintenance-metric").textContent).toContain("DL-01-AB-1234: Fitness check due");

    // Next-best action banner should not render when populated
    expect(screen.queryByText("Transport Fleet Setup in Progress")).toBeNull();

    // Fabricated literals must NOT exist
    expect(screen.queryByText("8 Vehicles")).toBeNull();
    expect(screen.queryByText("Active GPS Tracking")).toBeNull();
    expect(screen.queryByText("12 Routes")).toBeNull();
    expect(screen.queryByText("45 Pickup Stops")).toBeNull();
    expect(screen.queryByText("320 Students")).toBeNull();
  });
});
