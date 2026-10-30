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

let mockDriverRecord: any = null;
let mockAssignedRoute: any = null;

vi.mock("@/lib/serverAuth", () => ({
  getCachedSession: vi.fn(async () => ({
    user: {
      id: "user-driver-1",
      name: "Ramesh Kumar",
      role: "DRIVER",
      schoolId: "school-123",
    },
  })),
}));

vi.mock("@/lib/serverTiming", () => ({
  withDataPhaseTiming: vi.fn(async (_label: string, cb: any) => await cb()),
}));

vi.mock("@schoolmitra/database", () => ({
  assertQueryBudget: vi.fn(async (cb: any) => await cb()),
}));

vi.mock("@/lib/encryption", () => ({
  decryptData: vi.fn((val: string) => {
    if (val === "enc_name") return "Ramesh Kumar";
    if (val === "enc_licence") return "DL-04-2015-8888";
    return val;
  }),
}));

vi.mock("@/db", () => ({
  assertQueryBudget: vi.fn(async (cb: any) => await cb()),
  db: {
    query: {
      drivers: {
        findFirst: vi.fn(async () => mockDriverRecord),
      },
      routes: {
        findFirst: vi.fn(async () => mockAssignedRoute),
      },
    },
  },
}));

vi.mock("../DriverDashboardClient", () => ({
  default: ({ driver, vehicle, route }: any) => (
    <div data-testid="driver-dashboard-client">
      <div>Driver: {driver.name}</div>
      <div>Licence: {driver.licence}</div>
      <div>Vehicle: {vehicle?.busNumber}</div>
      <div>Route: {route?.routeName}</div>
    </div>
  ),
}));

import DriverDashboardPage from "../page";

describe("Sprint S23 Layer 5: Driver Dashboard Honest Empty State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders honest setup-missing card and NEVER fabricates DL-DEMO-2026 when user has no driver record", async () => {
    mockDriverRecord = null;
    mockAssignedRoute = null;

    const Component = await DriverDashboardPage();
    render(Component);

    // Setup-missing card rendered
    expect(screen.getByTestId("driver-setup-missing-card")).toBeDefined();
    expect(screen.getByText("No Vehicle or Route Assigned")).toBeDefined();
    expect(
      screen.getByText(/Your account is not linked to an active driver profile/)
    ).toBeDefined();

    // Fabricated demo literals must NEVER exist
    expect(screen.queryByText("DL-DEMO-2026")).toBeNull();
    expect(screen.queryByText("School Bus Driver")).toBeNull();
    expect(screen.queryByTestId("driver-dashboard-client")).toBeNull();
  });

  it("renders honest setup-missing card when driver has no assigned vehicle", async () => {
    mockDriverRecord = {
      id: "driver-1",
      userId: "user-driver-1",
      nameEncrypted: "enc_name",
      licenceEncrypted: "enc_licence",
      vehicleId: null,
      vehicle: null,
    };
    mockAssignedRoute = null;

    const Component = await DriverDashboardPage();
    render(Component);

    expect(screen.getByTestId("driver-setup-missing-card")).toBeDefined();
    expect(
      screen.getByText(/no transit vehicle is currently assigned to you/)
    ).toBeDefined();

    // Fabricated demo literals must NEVER exist
    expect(screen.queryByText("DL-DEMO-2026")).toBeNull();
    expect(screen.queryByTestId("driver-dashboard-client")).toBeNull();
  });

  it("renders active DriverDashboardClient when driver, vehicle, and route are legitimately assigned", async () => {
    mockDriverRecord = {
      id: "driver-1",
      userId: "user-driver-1",
      nameEncrypted: "enc_name",
      licenceEncrypted: "enc_licence",
      vehicleId: "veh-1",
      vehicle: {
        id: "veh-1",
        busNumber: "Bus 04",
        registrationNumber: "DL-01-AB-1234",
      },
    };
    mockAssignedRoute = {
      id: "route-1",
      routeName: "North Delhi Express Route 4",
      stops: [
        { id: "s1", stopName: "Rohini Sec 9", stopOrder: 1 },
        { id: "s2", stopName: "Pitampura Metro", stopOrder: 2 },
      ],
    };

    const Component = await DriverDashboardPage();
    render(Component);

    expect(screen.queryByTestId("driver-setup-missing-card")).toBeNull();
    expect(screen.getByTestId("driver-dashboard-client")).toBeDefined();
    expect(screen.getByText("Driver: Ramesh Kumar")).toBeDefined();
    expect(screen.getByText("Licence: DL-04-2015-8888")).toBeDefined();
    expect(screen.getByText("Vehicle: Bus 04")).toBeDefined();
    expect(screen.getByText("Route: North Delhi Express Route 4")).toBeDefined();

    // Fabricated demo literals must NEVER exist
    expect(screen.queryByText("DL-DEMO-2026")).toBeNull();
  });
});
