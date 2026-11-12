// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/app/actions/tourTelemetry", () => ({
  recordTourUsageAction: vi.fn().mockResolvedValue({ success: true }),
}));

import { FeatureTutorialFlashCards } from "../FeatureTutorialFlashCards";

describe("FeatureTutorialFlashCards Two-Level Tour Engine", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the initial module card with what it is and why it matters", () => {
    render(<FeatureTutorialFlashCards role="SCHOOL_ADMIN" initialOpen={true} />);

    expect(screen.getByTestId("feature-tutorial-flashcards")).toBeDefined();
    expect(screen.getByText("Day One Cockpit")).toBeDefined();
    expect(screen.getByText("What it is")).toBeDefined();
    expect(screen.getByText("Why it matters")).toBeDefined();
    expect(screen.getByText("Open Day One Cockpit")).toBeDefined();
  });

  it("drills down to Level 2 sub-modules and navigates back via breadcrumb", () => {
    render(<FeatureTutorialFlashCards role="SCHOOL_ADMIN" initialOpen={true} />);

    // Day One Cockpit has sub-module "8 Operational Readiness Checks"
    const drillDownBtn = screen.getByText(/See What's Inside/i);
    fireEvent.click(drillDownBtn);

    // Should now be on Level 2 sub-module view
    expect(screen.getByText("8 Operational Readiness Checks")).toBeDefined();
    expect(screen.getByText(/← Back to Day One Cockpit/i)).toBeDefined();

    // Click breadcrumb back to level 1
    const backBtn = screen.getByText(/← Back to Day One Cockpit/i);
    fireEvent.click(backBtn);

    // Returned to Level 1 module card
    expect(screen.getByText("Day One Cockpit")).toBeDefined();
    expect(screen.getByText(/See What's Inside/i)).toBeDefined();
  });

  it("skips a single module using 'Skip module' button", () => {
    render(<FeatureTutorialFlashCards role="SCHOOL_ADMIN" initialOpen={true} />);

    // Starts at Module 1: Day One Cockpit
    expect(screen.getByText("Day One Cockpit")).toBeDefined();

    // Click Skip module
    const skipModBtn = screen.getByText("Skip module");
    fireEvent.click(skipModBtn);

    // Moves to Module 2: Admissions & Intake
    expect(screen.getByText("Admissions & Intake")).toBeDefined();
  });

  it("skips the entire tour and persists dismissed state", () => {
    render(<FeatureTutorialFlashCards role="SCHOOL_ADMIN" initialOpen={true} />);

    const skipTourBtn = screen.getByRole("button", { name: /Dismiss Tutorial/i });
    fireEvent.click(skipTourBtn);

    expect(screen.queryByTestId("feature-tutorial-flashcards")).toBeNull();
    const saved = JSON.parse(localStorage.getItem("schoolmitra_tour_school-admin") || "{}");
    expect(saved.status).toBe("dismissed");
  });

  it("renders role-specific decks correctly (e.g. Teacher, Student)", () => {
    const { unmount } = render(<FeatureTutorialFlashCards role="TEACHER" initialOpen={true} />);

    expect(screen.getByText("Teacher Command Hub")).toBeDefined();
    expect(screen.getByText(/Educator \/ Teacher Tour/i)).toBeDefined();
    unmount();

    render(<FeatureTutorialFlashCards role="STUDENT" initialOpen={true} />);
    expect(screen.getByText("Student Home Feed")).toBeDefined();
    expect(screen.getByText(/Student Tour/i)).toBeDefined();
  });

  it("renders completion state upon finishing and allows restart", () => {
    render(<FeatureTutorialFlashCards role="LIBRARIAN" initialOpen={true} />);

    // Librarian has 2 modules: Library Operations Center, Book Catalog & Circulation
    expect(screen.getByText("Library Operations Center")).toBeDefined();

    // Next -> Module 2
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText("Book Catalog & Circulation")).toBeDefined();

    // Next -> Finish Tour
    fireEvent.click(screen.getByRole("button", { name: /Finish Tour/i }));

    // Should display completion screen
    expect(screen.getByText(/Library Tour Complete!/i)).toBeDefined();
    expect(screen.getByText("Restart Tour")).toBeDefined();

    // Restart tour
    fireEvent.click(screen.getByText("Restart Tour"));
    expect(screen.getByText("Library Operations Center")).toBeDefined();
  });

  it("resumes where left off from localStorage", () => {
    // Seed in_progress state at module index 2
    localStorage.setItem(
      "schoolmitra_tour_school-admin",
      JSON.stringify({
        status: "in_progress",
        level: 1,
        moduleIndex: 2,
        subIndex: 0,
      })
    );

    render(<FeatureTutorialFlashCards role="SCHOOL_ADMIN" initialOpen={true} />);

    // Module index 2 is Student Information Directory
    expect(screen.getByText("Student Information Directory")).toBeDefined();
  });
});
