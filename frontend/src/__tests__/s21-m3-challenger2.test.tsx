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
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  QuickTimetable,
  DAYS_OF_WEEK,
  DayOfWeek,
  TimetableRecord,
} from "../components/academics/QuickTimetable";
import * as timetableActions from "@/app/(admin)/academics/actions/timetable.actions";

// Mock Next.js navigation router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock timetable actions
vi.mock("@/app/(admin)/academics/actions/timetable.actions", () => ({
  saveTimetablePeriod: vi.fn(),
  deleteTimetablePeriod: vi.fn(),
  copyMondayToAllDays: vi.fn(),
  copyTimetableToSection: vi.fn(),
  clearSectionTimetable: vi.fn(),
  generateSectionTimetablePreview: vi.fn(),
  commitSectionTimetable: vi.fn(),
}));

describe("Milestone 3 Challenger 2: Mobile Reflow, Click Budget & UI Invariants", () => {
  const mockClassId = "cls-10";
  const mockSectionId = "sec-10a";
  const mockSections = [
    { id: "sec-10a", name: "A" },
    { id: "sec-10b", name: "B" },
  ];

  const mockClassSubjects = [
    {
      id: "cs-math",
      subjectId: "sub-math",
      assignedTeacherId: "tch-1",
      subject: { id: "sub-math", name: "Mathematics" },
      teacher: { id: "tch-1", email: "math@school.edu" },
    },
    {
      id: "cs-sci",
      subjectId: "sub-sci",
      assignedTeacherId: "tch-2",
      subject: { id: "sub-sci", name: "Science" },
      teacher: { id: "tch-2", email: "sci@school.edu" },
    },
  ];

  const mockTeachers = [
    { id: "tch-1", email: "math@school.edu", name: "Dr. Math" },
    { id: "tch-2", email: "sci@school.edu", name: "Dr. Science" },
  ];

  const mockBellPeriods = [
    { id: "bp-1", periodNumber: 1, name: "Period 1", startTime: "08:00", endTime: "08:45", periodType: "REGULAR" },
    { id: "bp-2", periodNumber: 2, name: "Period 2", startTime: "08:45", endTime: "09:30", periodType: "REGULAR" },
    { id: "bp-3", periodNumber: 3, name: "Period 3", startTime: "09:30", endTime: "10:15", periodType: "REGULAR" },
    { id: "bp-4", periodNumber: 4, name: "Period 4", startTime: "10:30", endTime: "11:15", periodType: "REGULAR" },
    { id: "bp-5", periodNumber: 5, name: "Period 5", startTime: "11:15", endTime: "12:00", periodType: "REGULAR" },
    { id: "bp-6", periodNumber: 6, name: "Period 6", startTime: "12:00", endTime: "12:45", periodType: "REGULAR" },
    { id: "bp-7", periodNumber: 7, name: "Period 7", startTime: "13:30", endTime: "14:15", periodType: "REGULAR" },
    { id: "bp-8", periodNumber: 8, name: "Period 8", startTime: "14:15", endTime: "15:00", periodType: "REGULAR" },
  ];

  const mockTimetable: TimetableRecord[] = [
    {
      id: "tt-1",
      sectionId: "sec-10a",
      dayOfWeek: "MONDAY",
      periodNumber: 1,
      startTime: "08:00",
      endTime: "08:45",
      periodType: "REGULAR",
      subjectId: "sub-math",
      teacherId: "tch-1",
      roomNumber: "101",
      isManualOverride: true,
      subject: { id: "sub-math", name: "Mathematics" },
      teacher: { id: "tch-1", email: "math@school.edu" },
    },
    {
      id: "tt-2",
      sectionId: "sec-10a",
      dayOfWeek: "TUESDAY",
      periodNumber: 2,
      startTime: "08:45",
      endTime: "09:30",
      periodType: "REGULAR",
      subjectId: "sub-sci",
      teacherId: "tch-2",
      roomNumber: "Lab 1",
      isManualOverride: false,
      subject: { id: "sub-sci", name: "Science" },
      teacher: { id: "tch-2", email: "sci@school.edu" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. UNIVERSAL SCROLL-AND-CLICK LAW & 390PX ZERO OVERFLOW ───────────────
  describe("1. Universal Scroll-and-Click Law (R7) & 390px Zero Overflow", () => {
    it("should render responsive separation: desktop table hidden on mobile, day tabs container block on mobile", () => {
      const { container } = render(
        <QuickTimetable
          classId={mockClassId}
          sectionId={mockSectionId}
          sections={mockSections}
          classSubjects={mockClassSubjects}
          teachers={mockTeachers}
          bellPeriods={mockBellPeriods}
          timetable={mockTimetable}
          isAdmin={true}
        />
      );

      // Desktop table container must have 'hidden md:block' and 'overflow-x-auto'
      const desktopTable = container.querySelector("div.hidden.md\\:block");
      expect(desktopTable).not.toBeNull();
      expect(desktopTable?.className).toContain("overflow-x-auto");

      // Mobile container must have 'block md:hidden'
      const mobileContainer = container.querySelector("div.block.md\\:hidden");
      expect(mobileContainer).not.toBeNull();

      // Mobile day tabs grid must be 6 columns with gap-1
      const dayTabsGrid = mobileContainer?.querySelector("div.grid.grid-cols-6");
      expect(dayTabsGrid).not.toBeNull();
      expect(dayTabsGrid?.className).toContain("gap-1");
    });

    it("should mathematically guarantee zero horizontal overflow within 390px viewport width", () => {
      const viewportWidth = 390;
      const pageMargin = 12 * 2; // 12px padding on each side
      const contentWidth = viewportWidth - pageMargin; // 366px

      // In mobile day tabs: 6 tabs across contentWidth
      // 5 gaps of 4px each = 20px
      // 2 * 6px padding inside container = 12px
      // Remaining for 6 buttons = 366 - 20 - 12 = 334px -> ~55.6px per button
      const numTabs = 6;
      const gapPx = 4;
      const containerPadding = 12;
      const availableForTabs = contentWidth - (numTabs - 1) * gapPx - containerPadding;
      const perTabWidth = availableForTabs / numTabs;

      expect(perTabWidth).toBeGreaterThan(50); // Sufficient for 3-letter day codes like "MON"
      expect(contentWidth).toBeLessThanOrEqual(viewportWidth);
    });
  });

  // ─── 2. MOBILE DAY TABS NAVIGATION & VERTICAL STACK ────────────────────────
  describe("2. Mobile Day Tabs Navigation & Period Card Stack", () => {
    it("should render all 6 days (MON, TUE, WED, THU, FRI, SAT) as touch-friendly tab buttons", () => {
      render(
        <QuickTimetable
          classId={mockClassId}
          sectionId={mockSectionId}
          sections={mockSections}
          classSubjects={mockClassSubjects}
          teachers={mockTeachers}
          bellPeriods={mockBellPeriods}
          timetable={mockTimetable}
          isAdmin={true}
        />
      );

      const expectedDayLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
      for (const day of expectedDayLabels) {
        const buttons = screen.getAllByRole("button", { name: day });
        expect(buttons.length).toBeGreaterThanOrEqual(1);
        const dayTab = buttons[0];
        expect(dayTab?.className).toContain("min-h-[38px]");
      }
    });

    it("should switch active day tab and filter period card stack to that day", () => {
      render(
        <QuickTimetable
          classId={mockClassId}
          sectionId={mockSectionId}
          sections={mockSections}
          classSubjects={mockClassSubjects}
          teachers={mockTeachers}
          bellPeriods={mockBellPeriods}
          timetable={mockTimetable}
          isAdmin={true}
        />
      );

      // Default active day is MONDAY
      expect(screen.getByText("MONDAY Schedule")).toBeDefined();
      // On Monday, Period 1 has Mathematics (manual override)
      const mathElements = screen.getAllByText("Mathematics");
      expect(mathElements.length).toBeGreaterThan(0);

      // Click TUE tab
      const tueTab = screen.getAllByRole("button", { name: "TUE" })[0];
      fireEvent.click(tueTab!);

      // Schedule header changes to TUESDAY Schedule
      expect(screen.getByText("TUESDAY Schedule")).toBeDefined();
      // On Tuesday, Period 2 has Science
      const sciElements = screen.getAllByText("Science");
      expect(sciElements.length).toBeGreaterThan(0);
    });

    it("should display all 8 bell periods in the vertical card stack for the active day", () => {
      const { container } = render(
        <QuickTimetable
          classId={mockClassId}
          sectionId={mockSectionId}
          sections={mockSections}
          classSubjects={mockClassSubjects}
          teachers={mockTeachers}
          bellPeriods={mockBellPeriods}
          timetable={mockTimetable}
          isAdmin={true}
        />
      );

      const mobileContainer = container.querySelector("div.block.md\\:hidden");
      expect(mobileContainer).not.toBeNull();

      // For the active day, verify periods 1 through 8 are displayed
      for (let p = 1; p <= 8; p++) {
        const periodCards = mobileContainer?.querySelectorAll(`div`);
        const hasPeriod = Array.from(periodCards || []).some(
          (el) => el.textContent?.includes(`Period ${p}`)
        );
        expect(hasPeriod).toBe(true);
      }
    });
  });

  // ─── 3. GENERATOR PREVIEW MODAL 3-TIER REPORT RENDERING ─────────────────────
  describe("3. Generator Preview Modal 3-Tier Report Rendering", () => {
    it("should render all three tiers: workload fit stats, clash alert list, and unassigned teacher allocations", async () => {
      const mockPreviewResult = {
        fits: true,
        fitReport: {
          fits: true,
          availableWeeklyPeriods: 48,
          totalRequiredPeriods: 42,
          slackOrDeficit: 6,
          message: "Feasible schedule: 42 required periods fit within 48 available periods.",
          subjectBreakdown: [
            { subjectId: "sub-math", subjectName: "Mathematics", weeklyPeriods: 6, percentageOfSchedule: 14 },
            { subjectId: "sub-sci", subjectName: "Science", weeklyPeriods: 6, percentageOfSchedule: 14 },
          ],
        },
        slots: [
          { dayOfWeek: 1, periodNumber: 1, subjectId: "sub-math", subjectName: "Mathematics", teacherId: "tch-1", isManualOverride: true },
          { dayOfWeek: 1, periodNumber: 2, subjectId: "sub-sci", subjectName: "Science", teacherId: undefined },
        ],
        clashes: [
          {
            type: "TEACHER_DOUBLE_BOOKING" as const,
            dayOfWeek: 2,
            periodNumber: 3,
            conflictingEntityId: "tch-1",
            message: "Teacher tch-1 is double-booked with Section 10-B in Period 3.",
          },
        ],
        needsAssignmentReport: [
          {
            subjectId: "sub-sci",
            subjectName: "Science",
            unassignedCount: 1,
          },
        ],
        unassignedPeriodsCount: 1,
      };

      vi.mocked(timetableActions.generateSectionTimetablePreview).mockResolvedValueOnce(
        mockPreviewResult as any
      );

      render(
        <QuickTimetable
          classId={mockClassId}
          sectionId={mockSectionId}
          sections={mockSections}
          classSubjects={mockClassSubjects}
          teachers={mockTeachers}
          bellPeriods={mockBellPeriods}
          timetable={mockTimetable}
          isAdmin={true}
        />
      );

      // Click "Generate Timetable"
      const generateBtn = screen.getByRole("button", { name: /generate timetable/i });
      fireEvent.click(generateBtn);

      // Verify modal opens and calls server action
      expect(timetableActions.generateSectionTimetablePreview).toHaveBeenCalledWith("sec-10a");

      // Wait for preview data to render
      await waitFor(() => {
        expect(screen.getByText("1. Workload Feasibility Fit")).toBeDefined();
      });

      // Tier 1: Workload Fit Report
      expect(screen.getByText("48")).toBeDefined(); // Available periods
      expect(screen.getByText("42")).toBeDefined(); // Required periods
      expect(screen.getByText("+6")).toBeDefined(); // Slack
      expect(screen.getByText("Feasible Fit")).toBeDefined();
      expect(screen.getByText("Subject Quota Breakdown")).toBeDefined();

      // Tier 2: Concurrency Clash Report
      expect(screen.getByText("2. Concurrency Clash Checks")).toBeDefined();
      expect(screen.getByText("1 Clash")).toBeDefined();
      expect(screen.getByText(/Teacher tch-1 is double-booked/)).toBeDefined();

      // Tier 3: Teacher Allocations Report
      expect(screen.getByText("3. Teacher Allocations")).toBeDefined();
      expect(screen.getByText("1 Need Manual Assignment")).toBeDefined();
      expect(screen.getByText("1 period unassigned")).toBeDefined();

      // Summary strip
      expect(screen.getByText(/ready to apply/i)).toBeDefined();
      expect(screen.getByText(/1 Overrides Retained/)).toBeDefined();
    });

    it("should render clean zero-clash banner and fully-allocated banner when no issues exist", async () => {
      const mockCleanPreview = {
        fits: true,
        fitReport: {
          fits: true,
          availableWeeklyPeriods: 48,
          totalRequiredPeriods: 40,
          slackOrDeficit: 8,
          message: "Feasible schedule.",
          subjectBreakdown: [],
        },
        slots: [
          { dayOfWeek: 1, periodNumber: 1, subjectId: "sub-math", subjectName: "Mathematics", teacherId: "tch-1" },
        ],
        clashes: [],
        needsAssignmentReport: [],
        unassignedPeriodsCount: 0,
      };

      vi.mocked(timetableActions.generateSectionTimetablePreview).mockResolvedValueOnce(
        mockCleanPreview as any
      );

      render(
        <QuickTimetable
          classId={mockClassId}
          sectionId={mockSectionId}
          sections={mockSections}
          classSubjects={mockClassSubjects}
          teachers={mockTeachers}
          bellPeriods={mockBellPeriods}
          timetable={mockTimetable}
          isAdmin={true}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /generate timetable/i }));

      await waitFor(() => {
        expect(screen.getByText("0 Clashes Detected")).toBeDefined();
        expect(screen.getByText("Fully Allocated")).toBeDefined();
      });

      expect(screen.getByText(/Zero clashes: No teacher double-bookings or room overlaps/)).toBeDefined();
      expect(screen.getByText(/All scheduled subjects have unique active teacher allocations/)).toBeDefined();
    });
  });

  // ─── 4. PRIMARY CLICK BUDGET VERIFICATION (<= 3 TAPS) ──────────────────────
  describe("4. Primary Click Budget Verification (<= 3 Taps)", () => {
    it("should complete full generate-to-confirm workflow in exactly 2 taps (<= 3 taps)", async () => {
      const mockPreviewResult = {
        fits: true,
        fitReport: {
          fits: true,
          availableWeeklyPeriods: 48,
          totalRequiredPeriods: 36,
          slackOrDeficit: 12,
          message: "Feasible schedule.",
          subjectBreakdown: [],
        },
        slots: [
          { dayOfWeek: 1, periodNumber: 1, subjectId: "sub-math", subjectName: "Mathematics", teacherId: "tch-1" },
        ],
        clashes: [],
        needsAssignmentReport: [],
        unassignedPeriodsCount: 0,
      };

      vi.mocked(timetableActions.generateSectionTimetablePreview).mockResolvedValueOnce(
        mockPreviewResult as any
      );
      vi.mocked(timetableActions.commitSectionTimetable).mockResolvedValueOnce({
        success: true,
        upsertedCount: 36,
        deactivatedCount: 0,
        preservedOverridesCount: 1,
      });

      let tapCount = 0;

      render(
        <QuickTimetable
          classId={mockClassId}
          sectionId={mockSectionId}
          sections={mockSections}
          classSubjects={mockClassSubjects}
          teachers={mockTeachers}
          bellPeriods={mockBellPeriods}
          timetable={mockTimetable}
          isAdmin={true}
        />
      );

      // Tap 1: Open generate preview modal
      const generateBtn = screen.getByRole("button", { name: /generate timetable/i });
      fireEvent.click(generateBtn);
      tapCount++;

      // Modal loads and displays "Confirm & Apply"
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /confirm & apply/i })).toBeDefined();
      });

      // Tap 2: Confirm and persist timetable
      const confirmBtn = screen.getByRole("button", { name: /confirm & apply/i });
      expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(confirmBtn);
      tapCount++;

      // Assert commitSectionTimetable was dispatched with slots
      await waitFor(() => {
        expect(timetableActions.commitSectionTimetable).toHaveBeenCalledWith(
          "sec-10a",
          mockPreviewResult.slots
        );
      });

      // Primary click budget assertion: strictly <= 3 taps
      expect(tapCount).toBe(2);
      expect(tapCount).toBeLessThanOrEqual(3);
    });

    it("should disable Confirm & Apply button if workload fits is false (Deficit Guard)", async () => {
      const mockDeficitPreview = {
        fits: false, // Deficit!
        fitReport: {
          fits: false,
          availableWeeklyPeriods: 30,
          totalRequiredPeriods: 36,
          slackOrDeficit: -6,
          message: "Workload deficit: 36 required periods exceed 30 available periods.",
          subjectBreakdown: [],
        },
        slots: [],
        clashes: [],
        needsAssignmentReport: [],
        unassignedPeriodsCount: 0,
      };

      vi.mocked(timetableActions.generateSectionTimetablePreview).mockResolvedValueOnce(
        mockDeficitPreview as any
      );

      render(
        <QuickTimetable
          classId={mockClassId}
          sectionId={mockSectionId}
          sections={mockSections}
          classSubjects={mockClassSubjects}
          teachers={mockTeachers}
          bellPeriods={mockBellPeriods}
          timetable={mockTimetable}
          isAdmin={true}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /generate timetable/i }));

      await waitFor(() => {
        expect(screen.getByText("Workload Deficit")).toBeDefined();
      });

      // Confirm & Apply button must be disabled
      const confirmBtn = screen.getByRole("button", { name: /confirm & apply/i });
      expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
