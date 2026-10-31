// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeacherFeedContainer } from "../components/teacher/TeacherFeedContainer";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../components/teacher/AttendanceWorkbench", () => ({
  AttendanceWorkbench: () => null,
}));

describe("S24 L8: Live Two-Tenant Walkthrough (Loaded vs Fresh Tenant)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  describe("Tenant A: Loaded School Tenant", () => {
    const loadedCards: DerivedTeacherFeedCard[] = [
      {
        id: "card-leave-1",
        teacherUserId: "teacher-loaded",
        cardType: "LeaveQueueCard",
        tier: "T2_informational",
        priority: 65,
        title: { en: "Student Leave Requests", hi: "अवकाश अनुरोध" },
        summary: { en: "1 student leave request waiting.", hi: "1 अनुरोध" },
        payload: {
          pendingCount: 1,
          requests: [
            {
              id: "req-1",
              studentName: "Rohan Verma", // Real decrypted name
              className: "Class 7",
              sectionName: "A",
              leaveType: "SICK",
            },
          ],
        },
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      },
      {
        id: "card-ptm-1",
        teacherUserId: "teacher-loaded",
        cardType: "PTMTodayCard",
        tier: "T2_informational",
        priority: 60,
        title: { en: "PTM Sessions Scheduled Today", hi: "पीटीएम सत्र" },
        summary: { en: "1 meeting scheduled with parents today.", hi: "1 सत्र" },
        payload: {
          bookings: [
            {
              bookingId: "b-1",
              parentName: "Vikram Sharma",
              studentName: "Aarav Sharma", // Real decrypted name
              sectionName: "Class 6-A", // Real class-section
              startTime: new Date().toISOString(),
            },
          ],
        },
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      },
      {
        id: "card-marks-1",
        teacherUserId: "teacher-loaded",
        cardType: "MarksEntryCard",
        tier: "T2_informational",
        priority: 70,
        title: { en: "Marks Entry Window Open", hi: "अंक प्रविष्टि" },
        summary: { en: "Midterm (Class 8-A Mathematics): 15 of 20 entered.", hi: "प्रविष्टि" },
        payload: {
          topWindow: {
            examId: "exam-1",
            sectionId: "sec-1",
            subjectId: "sub-1",
            subjectName: "Mathematics", // Real subject name
            maxMarks: 80, // Real configured maxMarks
            completedEntries: 15,
            totalStudents: 20,
          },
        },
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      },
      {
        id: "card-classwork-1",
        teacherUserId: "teacher-loaded",
        cardType: "ClassworkPendingCard",
        tier: "T1_action_required",
        priority: 68,
        title: { en: "Record Classwork: Period 1 (Class 6-A)", hi: "कक्षा कार्य" },
        summary: { en: "Science · Mark topic taught and homework to update parent feed", hi: "विज्ञान" },
        payload: {
          periodNumber: 1,
          subjectName: "Science",
          className: "Class 6",
          sectionName: "A",
          startTime: "09:15",
          endTime: "10:00",
        },
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      },
    ];

    it("displays real student names, real subjects, and truthful context across all cards with zero dummy strings", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TeacherFeedContainer
            initialCards={loadedCards}
            teacherName="Meenakshi Sundaram"
            schoolName="Kendriya Vidyalaya"
            sectionsTaught={["Class 6-A", "Class 7-A", "Class 8-A"]}
            subjectsTaught={["Science", "Mathematics"]}
            locale="en"
          />
        </QueryClientProvider>
      );

      // Verify real decrypted names are present
      expect(screen.getByText("Rohan Verma")).toBeInTheDocument();
      expect(screen.getByText("Vikram Sharma")).toBeInTheDocument();
      expect(screen.getByText("(Aarav Sharma · Class 6-A)")).toBeInTheDocument();
      expect(screen.getByText("Midterm (Class 8-A Mathematics): 15 of 20 entered.")).toBeInTheDocument();
      expect(screen.getByText("Record Classwork: Period 1 (Class 6-A)")).toBeInTheDocument();

      // Honesty Law verification: Dummy placeholders must NOT exist in document
      expect(screen.queryByText("Student of Section")).not.toBeInTheDocument();
      expect(screen.queryByText("Class-8A Subject")).not.toBeInTheDocument();
    });
  });

  describe("Tenant B: Fresh School Tenant", () => {
    it("renders honest calm state without fabricated cards or invented statistics", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TeacherFeedContainer
            initialCards={[]}
            teacherName="New Educator"
            schoolName="Fresh Horizon Academy"
            sectionsTaught={[]}
            subjectsTaught={[]}
            locale="en"
          />
        </QueryClientProvider>
      );

      // Fresh tenant renders honest empty calm state
      expect(screen.getByText(/0 tasks await your attention today/i)).toBeInTheDocument();
      expect(screen.getByText("0 Pending")).toBeInTheDocument();

      // Zero fabricated cards rendered
      expect(screen.queryByTestId("teacher-card-LeaveQueueCard")).not.toBeInTheDocument();
      expect(screen.queryByTestId("teacher-card-PTMTodayCard")).not.toBeInTheDocument();
      expect(screen.queryByTestId("teacher-card-MarksEntryCard")).not.toBeInTheDocument();
      expect(screen.queryByTestId("teacher-feed-cards")).not.toBeInTheDocument();
    });
  });
});
