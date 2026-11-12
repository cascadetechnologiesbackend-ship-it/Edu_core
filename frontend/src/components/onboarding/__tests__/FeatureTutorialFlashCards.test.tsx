// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeatureTutorialFlashCards } from "../FeatureTutorialFlashCards";

describe("FeatureTutorialFlashCards Component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the initial tutorial flash card with what it is and why it matters", () => {
    render(<FeatureTutorialFlashCards initialOpen={true} />);

    expect(screen.getByTestId("feature-tutorial-flashcards")).toBeDefined();
    expect(screen.getByText("Day One Cockpit")).toBeDefined();
    expect(screen.getByText("What it is")).toBeDefined();
    expect(screen.getByText("Why it matters")).toBeDefined();
    expect(screen.getByText("Open Day One Cockpit")).toBeDefined();
  });

  it("navigates forward and backward through cards using Next and Previous buttons", () => {
    render(<FeatureTutorialFlashCards initialOpen={true} />);

    // Initial card is Day One Cockpit
    expect(screen.getByText("Day One Cockpit")).toBeDefined();

    // Click Next -> should transition to Admissions
    const nextBtn = screen.getByRole("button", { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText("Admissions & Student Enrolment")).toBeDefined();
    expect(screen.getByText("Open Admissions Hub")).toBeDefined();

    // Click Previous -> should return to Day One Cockpit
    const prevBtn = screen.getByRole("button", { name: /Previous/i });
    fireEvent.click(prevBtn);

    expect(screen.getByText("Day One Cockpit")).toBeDefined();
  });

  it("hides when dismissed and persists dismissal in localStorage", () => {
    render(<FeatureTutorialFlashCards initialOpen={true} />);

    const dismissBtn = screen.getByRole("button", { name: /Dismiss Tutorial/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId("feature-tutorial-flashcards")).toBeNull();
    expect(localStorage.getItem("schoolmitra_tutorial_flashcards_dismissed")).toBe("true");
  });

  it("reopens when open-tutorial-flashcards window event is dispatched", () => {
    localStorage.setItem("schoolmitra_tutorial_flashcards_dismissed", "true");
    render(<FeatureTutorialFlashCards initialOpen={false} />);

    expect(screen.queryByTestId("feature-tutorial-flashcards")).toBeNull();

    // Dispatch custom event
    fireEvent(window, new CustomEvent("open-tutorial-flashcards"));

    expect(screen.getByTestId("feature-tutorial-flashcards")).toBeDefined();
    expect(screen.getByText("Day One Cockpit")).toBeDefined();
  });
});

