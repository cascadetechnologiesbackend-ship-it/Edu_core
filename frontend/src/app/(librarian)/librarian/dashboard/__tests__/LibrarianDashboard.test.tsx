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

const mockLibrarianMetrics = {
  totalCopies: 0,
  availableCopies: 0,
  currentlyIssued: 0,
  overdueCount: 0,
  distinctCategoriesCount: 0,
  topCategories: [] as Array<{ category: string; count: number }>,
};

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async () => ({
    userId: "librarian-user-1",
    role: "LIBRARIAN",
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
  getLibrarianConsoleMetrics: vi.fn(async () => mockLibrarianMetrics),
}));

import LibrarianDashboardPage from "../page";

describe("Sprint S23 Layer 3: Librarian Dashboard Truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders honest zeros and setup-in-progress banner for an empty library", async () => {
    mockLibrarianMetrics.totalCopies = 0;
    mockLibrarianMetrics.availableCopies = 0;
    mockLibrarianMetrics.currentlyIssued = 0;
    mockLibrarianMetrics.overdueCount = 0;
    mockLibrarianMetrics.distinctCategoriesCount = 0;
    mockLibrarianMetrics.topCategories = [];

    const Component = await LibrarianDashboardPage();
    render(Component);

    // Honest zeros
    expect(screen.getByTestId("librarian-total-copies-metric").textContent).toContain("0");
    expect(screen.getByTestId("librarian-total-copies-metric").textContent).toContain("0 physical copies in inventory");
    expect(screen.getByTestId("librarian-issued-metric").textContent).toContain("0 Books");
    expect(screen.getByTestId("librarian-issued-metric").textContent).toContain("No books currently checked out");
    expect(screen.getByTestId("librarian-overdue-metric").textContent).toContain("0 Books");
    expect(screen.getByTestId("librarian-overdue-metric").textContent).toContain("No overdue returns");
    expect(screen.getByTestId("librarian-categories-metric").textContent).toContain("0");

    // Next-best action banner for fresh school
    expect(screen.getByText("Library Catalog Setup in Progress")).toBeDefined();
    expect(screen.getByText(/Add Catalog Titles/)).toBeDefined();

    // Fabricated literals must NOT exist
    expect(screen.queryByText("4,850")).toBeNull();
    expect(screen.queryByText("142 Books")).toBeNull();
    expect(screen.queryByText("8 Books")).toBeNull();
    expect(screen.queryByText("18")).toBeNull();
  });

  it("renders live counts, categories, and overdue alert for a populated library", async () => {
    mockLibrarianMetrics.totalCopies = 520;
    mockLibrarianMetrics.availableCopies = 495;
    mockLibrarianMetrics.currentlyIssued = 25;
    mockLibrarianMetrics.overdueCount = 3;
    mockLibrarianMetrics.distinctCategoriesCount = 6;
    mockLibrarianMetrics.topCategories = [
      { category: "Science", count: 120 },
      { category: "Literature", count: 95 },
      { category: "History", count: 80 },
    ];

    const Component = await LibrarianDashboardPage();
    render(Component);

    // Live counts rendered
    expect(screen.getByTestId("librarian-total-copies-metric").textContent).toContain("520");
    expect(screen.getByTestId("librarian-total-copies-metric").textContent).toContain("495 available in library");
    expect(screen.getByTestId("librarian-issued-metric").textContent).toContain("25 Books");
    expect(screen.getByTestId("librarian-issued-metric").textContent).toContain("Issued to students & staff");
    expect(screen.getByTestId("librarian-overdue-metric").textContent).toContain("3 Books");
    expect(screen.getByTestId("librarian-overdue-metric").textContent).toContain("Late fine applicable");
    expect(screen.getByTestId("librarian-categories-metric").textContent).toContain("6");
    expect(screen.getByTestId("librarian-categories-metric").textContent).toContain("Science, Literature, History");

    // Next-best action banner should not render when populated
    expect(screen.queryByText("Library Catalog Setup in Progress")).toBeNull();

    // Fabricated literals must NOT exist
    expect(screen.queryByText("4,850")).toBeNull();
    expect(screen.queryByText("142 Books")).toBeNull();
    expect(screen.queryByText("8 Books")).toBeNull();
    expect(screen.queryByText("18")).toBeNull();
  });
});

