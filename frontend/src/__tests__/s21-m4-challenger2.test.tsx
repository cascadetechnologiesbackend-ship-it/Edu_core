/**
 * @vitest-environment jsdom
 */
import * as React from "react";
// @ts-ignore
global.React = React;
// @ts-ignore
globalThis.React = React;

import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import fs from "fs";
import path from "path";

// Mock Next.js navigation router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ImportExportModal
vi.mock("@/components/ui/ImportExportModal", () => ({
  ImportExportModal: () => <div data-testid="mock-import-export-modal" />,
}));

// Mock Server Actions for school-setup
vi.mock("@/app/(admin)/settings/school-setup/actions", () => ({
  getSchoolProfile: vi.fn().mockResolvedValue({
    school: {
      name: "Delhi Public School",
      address: "Sector 4",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      phone: "+91 11 2345 6789",
      email: "info@dps.edu",
      principalName: "Dr. Sharma",
      establishedYear: 1995,
      board: "CBSE",
      udiseCode: "07010100101",
      website: "https://dps.edu",
      motto: "Service Before Self",
      about: "Excellence in education",
      status: "ACTIVE",
      subscriptionTier: "PREMIUM",
      slug: "dps-delhi",
      logoUrl: null,
      socialHandles: {},
      themeColors: { light: "#4f46e5", dark: "#6366f1" },
    },
    completeness: {
      percent: 90,
      completedWeight: 90,
      totalWeight: 100,
      missing: [],
    },
  }),
  getSchoolConfigurationHealthAction: vi.fn().mockResolvedValue({
    configurationScore: 100,
    operationalScore: 80,
    overallScore: 100,
    isOperationallyReady: false,
    classesCount: 12,
    sectionsCount: 36,
    totalActiveSections: 36,
    subjectsCount: 18,
    feeHeadsCount: 5,
    pricedFeeHeadsCount: 3,
    unpricedFeeHeadsCount: 2,
    bellScheduleCount: 8,
    sectionsWithTimetableCount: 36,
    activeTeacherAllocationsCount: 45,
    enrolledStudentsCount: 650,
    hasActiveAcademicYear: true,
    salaryTemplatesCount: 4,
    holidaysCount: 15,
    isProvisioned: true,
    blueprintVersion: "1.0.0",
    categories: [
      {
        key: "academic-calendar",
        title: "Academic Calendar & Terms",
        description: "Active academic session, term boundaries, and calendar schedule.",
        href: "/academics/setup/calendar",
        status: "COMPLETE",
        metric: "Active Session Set",
      },
      {
        key: "classes-sections",
        title: "Classes & Sections",
        description: "Grade hierarchy, class names, and active sections.",
        href: "/academics",
        status: "COMPLETE",
        metric: "12 Classes • 36 Sections",
      },
      {
        key: "curriculum-subjects",
        title: "Curriculum & Subjects",
        description: "Class-wise theory, practical, language, and co-scholastic subjects.",
        href: "/academics/subjects",
        status: "COMPLETE",
        metric: "18 Subjects Configured",
      },
      {
        key: "fee-structures",
        title: "Fee Structures & Heads",
        description: "Tuition, transport, lab fees and chart-of-accounts mapping.",
        href: "/school/fee-structures",
        status: "PARTIAL",
        metric: "3/5 Heads Priced (2 Unpriced)",
        nextBestAction: {
          label: "Configure Pricing at /finance/fees",
          href: "/finance/fees",
        },
      },
      {
        key: "timetable-bell-schedule",
        title: "Timetable & Bell Schedule",
        description: "Daily bell schedule period slots and section timetable published coverage.",
        href: "/academics/timetable",
        status: "COMPLETE",
        metric: "8 Periods • 36/36 Timetables",
        nextBestAction: {
          label: "Open Timetable Builder",
          href: "/academics/timetable",
        },
      },
      {
        key: "enrollment-allocations",
        title: "Enrollment & Allocations",
        description: "Active enrolled students and subject-teacher section assignments.",
        href: "/students",
        secondaryHref: "/academics",
        secondaryLabel: "Allocations",
        status: "COMPLETE",
        metric: "650 Students • 45 Allocations",
        nextBestAction: {
          label: "Open Universal Import",
          href: "/school/import-center",
        },
      },
      {
        key: "hr-payroll",
        title: "HR Salary Grades",
        description: "Salary templates, standard allowances, and deductions.",
        href: "/hr",
        status: "COMPLETE",
        metric: "4 Templates Defined",
      },
      {
        key: "calendar-holidays",
        title: "Holidays & Closures",
        description: "National, gazetted, and school-specific holiday schedule.",
        href: "/academics/setup/calendar",
        status: "COMPLETE",
        metric: "15 Holidays Scheduled",
      },
    ],
  }),
  updateSchoolProfile: vi.fn(),
  uploadSchoolLogo: vi.fn(),
}));

// Import page components
import SchoolSetupPage from "../app/(admin)/settings/school-setup/page";

describe("Milestone 4 Challenger 2: Mobile Reflow, Click Budget & Category Links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. UNIVERSAL SCROLL-AND-CLICK LAW & 390PX VIEWPORT LAYOUT ─────────────
  describe("1. Universal Scroll-and-Click Law (R7) & 390px Mobile Layout", () => {
    it("should render outer container with responsive padding and no fixed pixel overflow widths", async () => {
      const { container } = render(<SchoolSetupPage />);

      // Wait for loading to complete
      await screen.findByText("Setup Hub & Digital Twin");

      // Outer container has max-w-5xl and px-4
      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).not.toBeNull();
      expect(mainDiv.className).toContain("max-w-5xl");
      expect(mainDiv.className).toContain("px-4");

      // Verify no element has fixed width > 390px (e.g. w-[400px], w-[500px], etc.)
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
    });

    it("should reflow scorecards, checklist strip, and category cards to single column on mobile", async () => {
      const { container } = render(<SchoolSetupPage />);

      // Wait for loading to finish
      await screen.findByText("Setup Hub & Digital Twin");

      // Scorecard grid must be grid-cols-1 md:grid-cols-2
      const scorecardsGrid = container.querySelector("div.grid.grid-cols-1.md\\:grid-cols-2");
      expect(scorecardsGrid).not.toBeNull();

      // 5-Gate Checklist strip must be grid-cols-1 sm:grid-cols-2 lg:grid-cols-5
      const checklistGrid = container.querySelector(
        "div.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5"
      );
      expect(checklistGrid).not.toBeNull();

      // Category cards grid must be grid-cols-1 md:grid-cols-2 lg:grid-cols-3
      const categoryGrid = container.querySelector(
        "div.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3"
      );
      expect(categoryGrid).not.toBeNull();
    });
  });

  // ─── 2. NEXT-BEST-ACTION ALERT (F16) ───────────────────────────────────────
  describe("2. Next-Best-Action Alert for Unpriced Fee Heads", () => {
    it("should render prominent Next-Best-Action card linking to /finance/fees when unpriced fee heads exist", async () => {
      render(<SchoolSetupPage />);

      // Find the Next Best Action banner
      const bannerHeading = await screen.findByText("Configure Fee Structure Pricing");
      expect(bannerHeading).toBeDefined();

      // Direct button linking to /finance/fees
      const links = screen.getAllByRole("link");
      const financeLinks = links.filter((l) => l.getAttribute("href") === "/finance/fees");
      expect(financeLinks.length).toBeGreaterThanOrEqual(1);

      // Verify the button text and touch target ergonomics
      const nbaBtn = financeLinks[0]!;
      expect(nbaBtn).toBeDefined();
      expect(nbaBtn.textContent).toContain("/finance/fees");
      expect(nbaBtn.className).toContain("min-h-[38px]");
    });
  });

  // ─── 3. TOUCH TARGET ERGONOMICS (>= 38PX) ──────────────────────────────────
  describe("3. Touch Target Ergonomics (>= 38px)", () => {
    it("should enforce all interactive buttons and action links have touch targets >= 38px", async () => {
      render(<SchoolSetupPage />);

      await screen.findByText("Setup Hub & Digital Twin");

      // Verify tabs have min-h-[44px]
      const tabButtons = screen.getAllByRole("button").filter((b) =>
        b.textContent?.includes("Setup Hub") || b.textContent?.includes("Institution Identity")
      );
      tabButtons.forEach((tab) => {
        expect(tab.className).toContain("min-h-[44px]");
      });

      // Verify category card action links have min-h-[38px]
      const workspaceLinks = screen.getAllByRole("link").filter((l) =>
        l.textContent?.includes("Open Workspace") || l.textContent?.includes("Allocations")
      );
      expect(workspaceLinks.length).toBeGreaterThan(0);
      workspaceLinks.forEach((link) => {
        expect(link.className).toContain("min-h-[38px]");
      });
    });
  });

  // ─── 4. CATEGORY CARD LINKS: EMPIRICAL RESOLUTION AUDIT ─────────────────────
  describe("4. Category Card Links: Empirical Resolution Audit", () => {
    // Read next.config.mjs to extract canonical redirects
    const nextConfigContent = fs.readFileSync(
      path.resolve(__dirname, "../../next.config.mjs"),
      "utf-8"
    );

    const hasRedirect = (sourcePath: string) => {
      return nextConfigContent.includes(`source: "${sourcePath}"`);
    };

    const hasAppRoute = (routePath: string) => {
      // Map routePath (e.g. /students) to frontend/src/app/(admin)/students/page.tsx or similar
      const baseApp = path.resolve(__dirname, "../app");
      const cleanPath = routePath.split("?")[0] || "";
      
      const potentialPaths = [
        path.join(baseApp, cleanPath, "page.tsx"),
        path.join(baseApp, "(admin)", cleanPath, "page.tsx"),
        path.join(baseApp, cleanPath, "page.jsx"),
        path.join(baseApp, "(admin)", cleanPath, "page.jsx"),
      ];

      return potentialPaths.some((p) => fs.existsSync(p));
    };

    it("evaluates operational resolution for all 8 Category Card links", async () => {
      const { getSchoolConfigurationHealthAction } = await import(
        "@/app/(admin)/settings/school-setup/actions"
      );
      const health = await getSchoolConfigurationHealthAction();
      expect(health.categories).toHaveLength(8);

      const auditResults: Record<
        string,
        { href: string; resolvesDirectly: boolean; hasRedirect: boolean; status: "OK" | "BROKEN" }
      > = {};

      for (const cat of health.categories) {
        const resolvesDirectly = hasAppRoute(cat.href);
        const redirects = hasRedirect(cat.href);
        const status = resolvesDirectly || redirects ? "OK" : "BROKEN";
        auditResults[cat.key] = {
          href: cat.href,
          resolvesDirectly,
          hasRedirect: redirects,
          status,
        };
      }

      console.log("CATEGORY CARD LINKS RESOLUTION AUDIT:", auditResults);

      // Verify the working links
      expect(auditResults["timetable-bell-schedule"]?.status).toBe("OK");
      expect(auditResults["enrollment-allocations"]?.status).toBe("OK");
      expect(auditResults["fee-structures"]?.status).toBe("OK");
      expect(auditResults["academic-calendar"]?.status).toBe("OK");
      expect(auditResults["classes-sections"]?.status).toBe("OK");
      expect(auditResults["curriculum-subjects"]?.status).toBe("OK");
      expect(auditResults["hr-payroll"]?.status).toBe("OK");
      expect(auditResults["calendar-holidays"]?.status).toBe("OK");

      // Audit status of all cards: must be zero broken cards
      const brokenCards = Object.entries(auditResults).filter(([_, res]) => res.status === "BROKEN");
      console.log(`Audited: ${brokenCards.length} of 8 category cards point to non-existent /settings routes`);
      expect(brokenCards).toHaveLength(0);
    });

    it("verifies permanent redirects exist for all legacy /settings/... routes in next.config.mjs", () => {
      expect(hasRedirect("/settings/calendar")).toBe(true);
      expect(hasRedirect("/settings/classes")).toBe(true);
      expect(hasRedirect("/settings/subjects")).toBe(true);
      expect(hasRedirect("/settings/hr/salary-grades")).toBe(true);
      expect(hasRedirect("/finance/fees")).toBe(true);
    });
  });
});
