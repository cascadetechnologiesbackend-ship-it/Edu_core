/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MyDayTimeline from "../MyDayTimeline";
import SectionRosters from "../SectionRosters";
import type {
  MyDayPeriodItem,
  TeacherSectionSummary,
  StudentRosterRow,
  Student360Data,
} from "@/app/(teacher)/teacher/classes/classesActions";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock classesActions server actions
vi.mock("@/app/(teacher)/teacher/classes/classesActions", () => ({
  completeLessonPlanAction: vi.fn().mockResolvedValue({
    success: true,
    message: "Lesson marked complete.",
  }),
  getTeacherStudent360Drawer: vi.fn().mockResolvedValue({
    studentId: "st-1",
    name: "Aarav Sharma",
    admissionNumber: "ADM001",
    rollNumber: "1",
    className: "Class 8",
    sectionName: "A",
    feeStatus: "PAID",
    attendanceCalendar: [
      { date: "2026-10-21", status: "PRESENT" },
      { date: "2026-10-20", status: "PRESENT" },
    ],
    attendanceSummary: {
      totalDays: 20,
      presentDays: 19,
      attendancePercent: 95,
    },
    assignmentHistory: [
      {
        assignmentId: "asg-1",
        title: "Algebra Homework 1",
        dueDate: "2026-10-18",
        marksAwarded: 18,
        maxMarks: 20,
        isLate: false,
        remarks: "Well solved",
      },
    ],
    examMarksHistory: [
      {
        examName: "Term 1 Final",
        subjectName: "Mathematics",
        marksObtained: 92,
        isAbsent: false,
      },
    ],
  }),
}));

describe("MyDayTimeline & SectionRosters (Phase T7 & AC-T2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTimeline: MyDayPeriodItem[] = [
    {
      periodNumber: 1,
      name: "Period 1",
      startTime: "08:00",
      endTime: "08:45",
      periodType: "REGULAR",
      isFree: false,
      classId: "cls-1",
      className: "Class 8",
      sectionId: "sec-1",
      sectionName: "A",
      subjectId: "sub-1",
      subjectName: "Mathematics",
      roomNumber: "Room 102",
      isNow: true,
      isPast: false,
      lessonPlan: {
        id: "lp-1",
        title: "Quadratic Formula",
        chapterName: "Algebra",
        status: "PLANNED",
      },
    },
    {
      periodNumber: 2,
      name: "Period 2",
      startTime: "08:50",
      endTime: "09:35",
      periodType: "REGULAR",
      isFree: false,
      classId: "cls-1",
      className: "Class 8",
      sectionId: "sec-2",
      sectionName: "B",
      subjectId: "sub-1",
      subjectName: "Mathematics",
      roomNumber: "Room 104",
      isNow: false,
      isPast: false,
      substitution: {
        type: "INCOMING_COVER",
        partnerTeacherName: "Mr. Sharma",
        status: "CONFIRMED",
      },
      lessonPlan: {
        id: "lp-2",
        title: "Coordinate Geometry",
        chapterName: "Geometry",
        status: "COMPLETED",
      },
    },
    {
      periodNumber: 3,
      name: "Recess Break",
      startTime: "09:35",
      endTime: "10:00",
      periodType: "BREAK",
      isFree: true,
      isNow: false,
      isPast: false,
    },
  ];

  describe("MyDayTimeline: Chronological Feed & 1-Tap Lesson Completion", () => {
    it("renders timeline periods with running now status and room details", () => {
      render(
        <MyDayTimeline
          timeline={mockTimeline}
          date="2026-10-21"
          dayOfWeek="Wednesday"
        />
      );

      expect(screen.getByText(/Wednesday/)).toBeDefined();
      expect(screen.getByText("Period 1")).toBeDefined();
      expect(screen.getByText("Running Now")).toBeDefined();
      expect(screen.getByText("Room 102")).toBeDefined();
      expect(screen.getByText("Quadratic Formula")).toBeDefined();
      expect(screen.getByText("Covering Class")).toBeDefined();
    });

    it("completes lesson plan with exactly 1 tap (Click Budget: 1 tap)", async () => {
      render(
        <MyDayTimeline
          timeline={mockTimeline}
          date="2026-10-21"
          dayOfWeek="Wednesday"
        />
      );

      const completeBtn = screen.getByRole("button", { name: /Complete Lesson/i });
      fireEvent.click(completeBtn);

      await waitFor(() => {
        expect(screen.getByText("Lesson Complete")).toBeDefined();
      });
    });
  });

  describe("SectionRosters: Privacy-Shielded Fee Status & Student 360 (AC-T2)", () => {
    const mockSections: TeacherSectionSummary[] = [
      {
        id: "sec-1",
        name: "A",
        className: "Class 8",
        classId: "cls-1",
        roomNumber: "Room 102",
        capacity: 40,
        isClassTeacher: true,
        studentCount: 2,
      },
    ];

    const mockStudents: StudentRosterRow[] = [
      {
        studentId: "st-1",
        name: "Aarav Sharma",
        admissionNumber: "ADM001",
        rollNumber: "1",
        attendanceRate30d: 95,
        attendanceStatusChip: "EXCELLENT",
        feeStatus: "PAID",
        latestSubmission: {
          assignmentTitle: "Algebra Homework 1",
          status: "GRADED",
          marksAwarded: 18,
          maxMarks: 20,
        },
      },
      {
        studentId: "st-2",
        name: "Pooja Patel",
        admissionNumber: "ADM002",
        rollNumber: "2",
        attendanceRate30d: 72,
        attendanceStatusChip: "AT_RISK",
        feeStatus: "DUE",
        latestSubmission: {
          assignmentTitle: "Algebra Homework 1",
          status: "LATE",
          marksAwarded: null,
          maxMarks: 20,
        },
      },
    ];

    it("renders student roster with attendance rates and fee status badge ONLY (AC-T2)", () => {
      const { container } = render(
        <SectionRosters
          sections={mockSections}
          initialStudents={mockStudents}
        />
      );

      expect(screen.getByText("Aarav Sharma")).toBeDefined();
      expect(screen.getByText("95% Att.")).toBeDefined();
      expect(screen.getByText("PAID")).toBeDefined();

      expect(screen.getByText("Pooja Patel")).toBeDefined();
      expect(screen.getByText("72% Att.")).toBeDefined();
      expect(screen.getByText("DUE")).toBeDefined();

      // STRICT PRIVACY CHECK (AC-T2): Ensure NO monetary currency figures appear in DOM
      expect(container.textContent).not.toMatch(/₹|\$|INR|USD|[0-9]{3,}\.[0-9]{2}/);
    });

    it("opens Student 360 drawer when student row is tapped", async () => {
      render(
        <SectionRosters
          sections={mockSections}
          initialStudents={mockStudents}
        />
      );

      const aaravRow = screen.getByText("Aarav Sharma");
      fireEvent.click(aaravRow);

      await waitFor(() => {
        expect(
          screen.getByText(/DPDP Act 2023 Statutory Shield/i)
        ).toBeDefined();
        expect(screen.getByText("Cleared (Paid)")).toBeDefined();
        expect(screen.getByText(/30-Day Attendance/i)).toBeDefined();
        expect(screen.getByText("Algebra Homework 1")).toBeDefined();
      });
    });
  });
});
