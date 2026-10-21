/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeacherTodayStrip } from "../TeacherTodayStrip";
import { TeacherIdentityHeader } from "../TeacherIdentityHeader";
import { TeacherFeedContainer, isNightQuietHours } from "../TeacherFeedContainer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/teacher/dashboard",
}));

// Mock AttendanceWorkbench modal
vi.mock("../AttendanceWorkbench", () => ({
  AttendanceWorkbench: () => <div data-testid="attendance-workbench-mock" />,
}));

describe("Phase T3: Teacher Feed Home Components & Zero-Clutter Invariant", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient.clear();
  });

  describe("TeacherTodayStrip", () => {
    it("renders emerald Day-Complete satisfaction strip when activeCardsCount is 0", () => {
      render(
        <TeacherTodayStrip
          activeCardsCount={0}
          isDayComplete={true}
          dayCompleteSummary="All 4 sections marked. 132 students accounted for."
          locale="en"
        />
      );

      const strip = screen.getByTestId("teacher-today-strip");
      expect(strip.className).toContain("border-emerald-500/40");
      expect(screen.getByText("All 4 sections marked. 132 students accounted for.")).toBeDefined();
      expect(screen.getByTestId("day-complete-badge")).toBeDefined();
      expect(screen.getByText("Day Complete")).toBeDefined();
    });

    it("renders pending count when active cards exist", () => {
      render(
        <TeacherTodayStrip
          activeCardsCount={3}
          daySummary="Attendance marked for 2 of 4 sections"
          locale="en"
        />
      );

      expect(screen.getByText("Attendance marked for 2 of 4 sections")).toBeDefined();
      expect(screen.getByText("3 Pending")).toBeDefined();
    });

    it("supports Hindi localization for day-complete state", () => {
      render(
        <TeacherTodayStrip
          activeCardsCount={0}
          isDayComplete={true}
          locale="hi"
        />
      );

      expect(screen.getByText("दिन पूर्ण")).toBeDefined();
      expect(screen.getByText("आज का सारा कार्य पूर्ण है। सभी विद्यार्थी दर्ज हैं।")).toBeDefined();
    });
  });

  describe("TeacherIdentityHeader", () => {
    it("renders teacher name, school, initials, and teaching chips", () => {
      render(
        <TeacherIdentityHeader
          teacherName="Ananya Sharma"
          schoolName="Delhi Public Academy"
          subjectsTaught={["Mathematics", "Science"]}
          sectionsTaught={["8-A", "8-B", "9-A"]}
          isClassTeacher={true}
          classTeacherSectionName="8-A"
          locale="en"
        />
      );

      expect(screen.getByText("Ananya Sharma")).toBeDefined();
      expect(screen.getByText("Delhi Public Academy")).toBeDefined();
      expect(screen.getByText("AS")).toBeDefined(); // Initials
      expect(screen.getByText("Class Teacher (8-A)")).toBeDefined();
      expect(screen.getByText("Mathematics")).toBeDefined();
      expect(screen.getByText("Science")).toBeDefined();
      expect(screen.getByText("8-A")).toBeDefined();
      expect(screen.getByText("8-B")).toBeDefined();
    });
  });

  describe("TeacherFeedContainer (AC-T1 Invariant)", () => {
    it("AC-T1 ZERO-CLUTTER: renders only IdentityHeader and Day-Complete strip when cards array is empty", () => {
      render(
        <TeacherFeedContainer
          initialCards={[]}
          teacherName="Vikram Malhotra"
          schoolName="St. Xavier High School"
          sectionsTaught={["10-A", "10-B"]}
          subjectsTaught={["English"]}
          locale="en"
          isNightOverride={false}
        />,
        { wrapper }
      );

      expect(screen.getByText("Vikram Malhotra")).toBeDefined();
      expect(screen.getByTestId("teacher-today-strip")).toBeDefined();
      expect(screen.getByTestId("day-complete-badge")).toBeDefined();

      // No card container should be rendered
      expect(screen.queryByTestId("teacher-feed-cards")).toBeNull();
    });

    it("renders feed cards when active cards are present", () => {
      const mockCard: DerivedTeacherFeedCard = {
        id: "attendance-now-1",
        teacherUserId: "teacher-1",
        cardType: "AttendanceNowCard",
        tier: "T1_action_required",
        priority: 110,
        title: {
          en: "Morning Attendance",
          hi: "सुबह की उपस्थिति",
        },
        summary: {
          en: "Attendance pending for Class 8-A (40 students).",
          hi: "Class 8-A के लिए उपस्थिति दर्ज करना बाकी है।",
        },
        payload: {
          sections: [
            {
              sectionId: "sec-1",
              className: "Class 8",
              sectionName: "A",
              totalStudents: 40,
              isMarked: false,
            },
          ],
          unmarkedSections: [
            {
              sectionId: "sec-1",
              className: "Class 8",
              sectionName: "A",
              totalStudents: 40,
              isMarked: false,
            },
          ],
          unmarkedCount: 1,
          totalSections: 1,
        },
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      render(
        <TeacherFeedContainer
          initialCards={[mockCard]}
          teacherName="Vikram Malhotra"
          schoolName="St. Xavier High School"
          locale="en"
          isNightOverride={false}
        />,
        { wrapper }
      );

      expect(screen.getByTestId("teacher-feed-cards")).toBeDefined();
      expect(screen.getByTestId("teacher-card-AttendanceNowCard")).toBeDefined();
      expect(screen.getByText("Morning Attendance")).toBeDefined();
      expect(screen.getByText("Mark Attendance")).toBeDefined();
    });

    it("displays night quiet hours banner when during quiet hours (21:30 - 06:30)", () => {
      const nightDate = new Date("2026-10-21T22:30:00");
      expect(isNightQuietHours(nightDate)).toBe(true);

      render(
        <TeacherFeedContainer
          initialCards={[]}
          teacherName="Vikram Malhotra"
          schoolName="St. Xavier High School"
          locale="en"
          now={nightDate}
          isNightOverride={true}
        />,
        { wrapper }
      );

      expect(screen.getByTestId("night-staleness-note")).toBeDefined();
      expect(screen.getByText(/Quiet hours active/i)).toBeDefined();
    });

    it("renders InsightFeedCard with attendance trend sparkline", () => {
      const mockInsightCard: DerivedTeacherFeedCard = {
        id: "insight-attn-1",
        teacherUserId: "teacher-1",
        cardType: "InsightCard",
        tier: "T2_informational",
        priority: 45,
        title: {
          en: "Attendance Dip: Class 8-B",
          hi: "उपस्थिति में गिरावट: Class 8-B",
        },
        summary: {
          en: "30-day average attendance is 78.4% (below 85% benchmark).",
          hi: "30 दिनों की औसत उपस्थिति 78.4% है।",
        },
        payload: {
          model: "section_attendance_trend",
          severity: "AMBER",
          avgRate: 78.4,
          sparklineData: [78, 80, 82, 79, 76, 75, 80],
        },
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      render(
        <TeacherFeedContainer
          initialCards={[mockInsightCard]}
          teacherName="Vikram Malhotra"
          schoolName="St. Xavier High School"
          locale="en"
          isNightOverride={false}
        />,
        { wrapper }
      );

      expect(screen.getByTestId("teacher-card-InsightCard")).toBeDefined();
      expect(screen.getByText("Attendance Dip: Class 8-B")).toBeDefined();
      expect(screen.getByTestId("insight-attendance-sparkline")).toBeDefined();
      expect(screen.getByText("78.4% avg")).toBeDefined();
    });

    it("renders InsightFeedCard with homework neglect student chips", () => {
      const mockHwCard: DerivedTeacherFeedCard = {
        id: "insight-hw-1",
        teacherUserId: "teacher-1",
        cardType: "InsightCard",
        tier: "T2_informational",
        priority: 45,
        title: {
          en: "Homework Attention: Class 8-B",
          hi: "गृहकार्य ध्यान: Class 8-B",
        },
        summary: {
          en: "2 students have missed 2 or more assignments in the last 14 days.",
          hi: "2 विद्यार्थियों ने असाइनमेंट नहीं किए।",
        },
        payload: {
          model: "homework_neglect_list",
          severity: "AMBER",
          students: [
            { studentId: "s1", studentName: "Aarav Sharma", missingCount: 3 },
            { studentId: "s2", studentName: "Diya Patel", missingCount: 2 },
          ],
        },
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      render(
        <TeacherFeedContainer
          initialCards={[mockHwCard]}
          teacherName="Vikram Malhotra"
          schoolName="St. Xavier High School"
          locale="en"
          isNightOverride={false}
        />,
        { wrapper }
      );

      expect(screen.getByTestId("insight-homework-neglect-list")).toBeDefined();
      expect(screen.getByText("Aarav Sharma")).toBeDefined();
      expect(screen.getByText("3 missed")).toBeDefined();
      expect(screen.getByText("Diya Patel")).toBeDefined();
    });
  });
});
