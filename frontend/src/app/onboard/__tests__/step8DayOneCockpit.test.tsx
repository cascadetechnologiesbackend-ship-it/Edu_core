// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Step8Completion } from "../steps/Step8Completion";
import { OnboardingProvider } from "../onboardContext";

describe("Phase D1-L2: Step 8 Completion & Day One Cockpit Handoff", () => {
  it("renders the primary action button routing directly to /admin/day-one?welcome=true", () => {
    render(
      <OnboardingProvider>
        <Step8Completion />
      </OnboardingProvider>
    );

    const primaryCta = screen.getByTestId("enter-day-one-cockpit-btn");
    expect(primaryCta).toBeDefined();
    expect(primaryCta.getAttribute("href")).toBe("/admin/day-one?welcome=true");
    expect(screen.getByText("Enter Day One Cockpit")).toBeDefined();
  });

  it("eliminates empty dashboard drops and renders explicit Day One setup shortcuts", () => {
    const { container } = render(
      <OnboardingProvider>
        <Step8Completion />
      </OnboardingProvider>
    );

    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));

    // Primary action
    expect(links).toContain("/admin/day-one?welcome=true");

    // Completing shortcuts
    expect(links).toContain("/school/import-center?tab=staff");
    expect(links).toContain("/school/import-center?tab=students");
    expect(links).toContain("/school/fee-structures");

    // Zero empty dashboard drops
    expect(links).not.toContain("/dashboard");
    expect(links).not.toContain("/admin/dashboard");
  });

  it("renders Super Admin return action when mode is superadmin", () => {
    render(
      <OnboardingProvider mode="superadmin">
        <Step8Completion />
      </OnboardingProvider>
    );

    const returnBtn = screen.getByTestId("return-to-schools-directory-btn");
    expect(returnBtn).toBeDefined();
    expect(returnBtn.getAttribute("href")).toBe("/super-admin/schools");
    expect(screen.getByText("Return to School Directory")).toBeDefined();
    expect(screen.getByText("Provision Another School")).toBeDefined();
  });
});
