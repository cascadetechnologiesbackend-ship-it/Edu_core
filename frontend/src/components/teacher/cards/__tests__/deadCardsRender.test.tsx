// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClassworkPendingFeedCard } from "../ClassworkPendingFeedCard";
import { HomeworkDueFeedCard } from "../HomeworkDueFeedCard";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("S24 L6: ClassworkPendingFeedCard and HomeworkDueFeedCard UI Components", () => {
  it("renders ClassworkPendingFeedCard with period, subject, class-section, and deep-link action", () => {
    const card: DerivedTeacherFeedCard = {
      id: "classwork-pending-2",
      teacherUserId: "teacher-1",
      cardType: "ClassworkPendingCard",
      tier: "T1_action_required",
      priority: 68,
      title: {
        en: "Record Classwork: Period 2 (Class 6-A)",
        hi: "कक्षा कार्य दर्ज करें: पीरियड 2 (Class 6-A)",
      },
      summary: {
        en: "Science · Mark topic taught and homework to update parent feed",
        hi: "Science · पढ़ाएं",
      },
      payload: {
        periodNumber: 2,
        subjectName: "Science",
        className: "Class 6",
        sectionName: "A",
        startTime: "10:00",
        endTime: "10:45",
        classSubjectId: "cs-123",
        sectionId: "sec-456",
      },
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    };

    render(<ClassworkPendingFeedCard card={card} locale="en" />);

    expect(screen.getByText("Record Classwork: Period 2 (Class 6-A)")).toBeInTheDocument();
    expect(screen.getByText("Record Classwork")).toBeInTheDocument();
    expect(screen.getByText("Period 2")).toBeInTheDocument();
    expect(screen.getByText("10:00 - 10:45")).toBeInTheDocument();
  });

  it("renders HomeworkDueFeedCard with assignment progress, due badge, and action button", () => {
    const card: DerivedTeacherFeedCard = {
      id: "hw-due-1",
      teacherUserId: "teacher-1",
      cardType: "HomeworkDueCard",
      tier: "T2_informational",
      priority: 55,
      title: {
        en: "Homework Due Soon: Mathematics (Class 8-B)",
        hi: "गृहकार्य",
      },
      summary: {
        en: "Quadratic Equations · 18/25 submitted",
        hi: "समीकरण",
      },
      payload: {
        assignmentId: "asg-99",
        title: "Quadratic Equations",
        subjectName: "Mathematics",
        className: "Class 8",
        sectionName: "B",
        dueDate: "2026-10-31T17:00:00.000Z",
        submissionCount: 18,
        totalStudents: 25,
      },
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    };

    render(<HomeworkDueFeedCard card={card} locale="en" />);

    expect(screen.getByText("Homework Due Soon: Mathematics (Class 8-B)")).toBeInTheDocument();
    expect(screen.getByText("Quadratic Equations")).toBeInTheDocument();
    expect(screen.getByText("18/25 submitted")).toBeInTheDocument();
    expect(screen.getByText("View Submissions")).toBeInTheDocument();
  });
});
