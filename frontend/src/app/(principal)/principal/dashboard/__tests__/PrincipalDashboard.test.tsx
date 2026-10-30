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

const mockMetricsState = {
  activeSectionsCount: 0,
  activeTeachingStaffCount: 0,
  todayStudentAttendance: {
    totalMarked: 0,
    presentCount: 0,
    ratePercent: null as number | null,
    formattedPercent: "Not Marked",
    isMarkedToday: false,
  },
  pendingExamVerificationsCount: 0,
  staffAttendanceRate: null as {
    totalMarked: number;
    presentCount: number;
    ratePercent: number;
    formattedPercent: string;
  } | null,
};

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async () => ({
    userId: "principal-user-1",
    role: "PRINCIPAL",
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
  getPrincipalConsoleMetrics: vi.fn(async () => mockMetricsState),
}));

import PrincipalDashboardPage from "../page";

describe("Sprint S23 Layer 2: Principal Dashboard Truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders honest zeros and next-best actions for an empty provisioned school", async () => {
    mockMetricsState.activeSectionsCount = 0;
    mockMetricsState.activeTeachingStaffCount = 0;
    mockMetricsState.todayStudentAttendance = {
      totalMarked: 0,
      presentCount: 0,
      ratePercent: null,
      formattedPercent: "Not Marked",
      isMarkedToday: false,
    };
    mockMetricsState.pendingExamVerificationsCount = 0;
    mockMetricsState.staffAttendanceRate = null;

    const Component = await PrincipalDashboardPage();
    render(Component);

    // Honest zeros
    expect(screen.getByTestId("principal-sections-metric").textContent).toContain("0");
    expect(screen.getByTestId("principal-staff-metric").textContent).toContain("0");
    expect(screen.getByTestId("principal-attendance-metric").textContent).toContain("0.0%");
    expect(screen.getByTestId("principal-exams-metric").textContent).toContain("0 Classes");

    // Next-best action banner for fresh school
    expect(screen.getByText("School Setup in Progress")).toBeDefined();
    expect(screen.getByText(/Configure Class Sections/)).toBeDefined();

    // Fabricated literals must NOT exist
    expect(screen.queryByText("24")).toBeNull();
    expect(screen.queryByText("48")).toBeNull();
    expect(screen.queryByText("96% Daily Attendance")).toBeNull();
    expect(screen.queryByText("94.2%")).toBeNull();
  });

  it("renders live counts and student attendance rate for a populated school", async () => {
    mockMetricsState.activeSectionsCount = 12;
    mockMetricsState.activeTeachingStaffCount = 35;
    mockMetricsState.todayStudentAttendance = {
      totalMarked: 320,
      presentCount: 298,
      ratePercent: 93.1,
      formattedPercent: "93.1%",
      isMarkedToday: true,
    };
    mockMetricsState.pendingExamVerificationsCount = 5;
    mockMetricsState.staffAttendanceRate = {
      totalMarked: 35,
      presentCount: 34,
      ratePercent: 97.1,
      formattedPercent: "97.1%",
    };

    const Component = await PrincipalDashboardPage();
    render(Component);

    // Live counts rendered
    expect(screen.getByTestId("principal-sections-metric").textContent).toContain("12");
    expect(screen.getByTestId("principal-staff-metric").textContent).toContain("35");
    expect(screen.getByTestId("principal-staff-metric").textContent).toContain("97.1% Staff Attendance Today");
    expect(screen.getByTestId("principal-attendance-metric").textContent).toContain("93.1%");
    expect(screen.getByTestId("principal-exams-metric").textContent).toContain("5 Classes");

    // Next-best action banner should not render when populated
    expect(screen.queryByText("School Setup in Progress")).toBeNull();
  });
});
