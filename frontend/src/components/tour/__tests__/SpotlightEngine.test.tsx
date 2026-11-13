/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TourHost } from "../TourHost";
import { PageTourDefinition } from "@/lib/tours/types";
import * as storage from "@/lib/tours/storage";
import * as telemetry from "@/app/actions/tourTelemetry";

vi.mock("@/app/actions/tourTelemetry", () => ({
  recordTourUsageAction: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/day-one",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockTours: PageTourDefinition[] = [
  {
    pagePath: "/admin/day-one",
    moduleId: "admin-day-one",
    moduleTitle: "Day One Cockpit",
    steps: [
      {
        anchorId: "day-one-readiness-strip",
        title: "Readiness Invariants",
        line: "Track 8 database-computed operational readiness milestones before school opens.",
      },
      {
        anchorId: "day-one-checks-grid",
        title: "Live Database Checks",
        line: "Inspect real schema counts for classes, curriculum, staff, and parent claims.",
      },
    ],
  },
  {
    pagePath: "/admissions",
    moduleId: "admin-admissions",
    moduleTitle: "Admissions & Intake",
    steps: [
      {
        anchorId: "admissions-new-btn",
        title: "New Student Enrolment",
        line: "Admit students with atomic ledger linkage and Aadhaar encryption.",
      },
    ],
  },
];

describe("Contextual Spotlight Engine & TourHost (CT-L1)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div id="root">
        <div data-tour="day-one-readiness-strip">Readiness Progress Bar</div>
        <div data-tour="day-one-checks-grid">8 Checks Grid</div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("auto-triggers on first visit and anchors to the first step element", async () => {
    render(
      <TourHost
        role="SCHOOL_ADMIN"
        tours={mockTours}
        allModuleIds={["admin-day-one", "admin-admissions"]}
      />
    );

    expect(screen.getByTestId("spotlight-overlay")).toBeDefined();
    expect(screen.getByTestId("coach-mark-card")).toBeDefined();
    expect(screen.getByText("Readiness Invariants")).toBeDefined();
    expect(screen.getByText("Step 1 of 2")).toBeDefined();

    expect(telemetry.recordTourUsageAction).toHaveBeenCalledWith(
      "tour_started",
      "SCHOOL_ADMIN",
      expect.objectContaining({ pagePath: "/admin/day-one", moduleId: "admin-day-one" })
    );
  });

  it("advances steps with Next and navigates back with Back", async () => {
    render(
      <TourHost
        role="SCHOOL_ADMIN"
        tours={mockTours}
        allModuleIds={["admin-day-one", "admin-admissions"]}
      />
    );

    const nextBtn = screen.getByTestId("coach-mark-next");
    expect(nextBtn.textContent).toContain("Next");

    // Click Next
    fireEvent.click(nextBtn);

    expect(screen.getByText("Live Database Checks")).toBeDefined();
    expect(screen.getByText("Step 2 of 2")).toBeDefined();

    // Back button should now be available
    const backBtn = screen.getByTestId("coach-mark-back");
    expect(backBtn).toBeDefined();

    // Click Back
    fireEvent.click(backBtn);
    expect(screen.getByText("Readiness Invariants")).toBeDefined();
    expect(screen.getByText("Step 1 of 2")).toBeDefined();
  });

  it("finishes module on last step and persists completion in progress trail", async () => {
    render(
      <TourHost
        role="SCHOOL_ADMIN"
        tours={mockTours}
        allModuleIds={["admin-day-one", "admin-admissions"]}
      />
    );

    // Step 1 -> Step 2
    fireEvent.click(screen.getByTestId("coach-mark-next"));

    // Step 2 shows Finish Module
    const finishBtn = screen.getByTestId("coach-mark-next");
    expect(finishBtn.textContent).toContain("Finish Module");

    fireEvent.click(finishBtn);

    // Card should close
    expect(screen.queryByTestId("coach-mark-card")).toBeNull();

    // Storage should have marked admin-day-one as done
    expect(storage.isModuleDone("SCHOOL_ADMIN", "admin-day-one")).toBe(true);

    expect(telemetry.recordTourUsageAction).toHaveBeenCalledWith(
      "tour_module_completed",
      "SCHOOL_ADMIN",
      expect.objectContaining({ moduleId: "admin-day-one" })
    );
  });

  it("skipping a module closes the popup and marks it dismissed", async () => {
    render(
      <TourHost
        role="SCHOOL_ADMIN"
        tours={mockTours}
        allModuleIds={["admin-day-one", "admin-admissions"]}
      />
    );

    const skipModBtn = screen.getByTestId("coach-mark-skip-module");
    fireEvent.click(skipModBtn);

    expect(screen.queryByTestId("coach-mark-card")).toBeNull();
    expect(storage.isModuleDone("SCHOOL_ADMIN", "admin-day-one")).toBe(true);
    expect(telemetry.recordTourUsageAction).toHaveBeenCalledWith(
      "tour_skipped",
      "SCHOOL_ADMIN",
      expect.objectContaining({ moduleId: "admin-day-one" })
    );
  });

  it("skipping entire tour marks tour dismissed and never auto-opens again", async () => {
    render(
      <TourHost
        role="SCHOOL_ADMIN"
        tours={mockTours}
        allModuleIds={["admin-day-one", "admin-admissions"]}
      />
    );

    const skipTourBtn = screen.getByTestId("coach-mark-skip-tour");
    fireEvent.click(skipTourBtn);

    expect(screen.queryByTestId("coach-mark-card")).toBeNull();
    expect(storage.isTourDismissed("SCHOOL_ADMIN")).toBe(true);

    // Re-render: should not auto-open
    const { container } = render(
      <TourHost
        role="SCHOOL_ADMIN"
        tours={mockTours}
        allModuleIds={["admin-day-one", "admin-admissions"]}
      />
    );

    expect(container.querySelector('[data-testid="coach-mark-card"]')).toBeNull();
  });

  it("supports manual re-triggering via custom event even if dismissed", async () => {
    storage.dismissEntireTour("SCHOOL_ADMIN");
    expect(storage.isTourDismissed("SCHOOL_ADMIN")).toBe(true);

    render(
      <TourHost
        role="SCHOOL_ADMIN"
        tours={mockTours}
        allModuleIds={["admin-day-one", "admin-admissions"]}
      />
    );

    // Card is not open initially
    expect(screen.queryByTestId("coach-mark-card")).toBeNull();

    // Dispatch custom event to reopen
    act(() => {
      window.dispatchEvent(
        new CustomEvent("open-contextual-tour", {
          detail: { role: "SCHOOL_ADMIN" },
        })
      );
    });

    expect(screen.getByTestId("coach-mark-card")).toBeDefined();
    expect(screen.getByText("Readiness Invariants")).toBeDefined();
  });

  it("Law 2: suppresses popup and does not render ghost popup if target anchor is missing", async () => {
    // Remove the anchor element from the DOM
    document.body.innerHTML = `<div id="root"><div>No anchors here</div></div>`;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <TourHost
        role="SCHOOL_ADMIN"
        tours={mockTours}
        allModuleIds={["admin-day-one", "admin-admissions"]}
      />
    );

    // Wait for the retry interval to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1400));
    });

    // Coach mark card should NOT be rendered
    expect(screen.queryByTestId("coach-mark-card")).toBeNull();
    expect(screen.queryByTestId("spotlight-overlay")).toBeNull();

    warnSpy.mockRestore();
  });
});

