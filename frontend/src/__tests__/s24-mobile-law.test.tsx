// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { TeacherFeedContainer } from "../components/teacher/TeacherFeedContainer";
import type { DerivedTeacherFeedCard } from "@/lib/teacherEventEngine/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../components/teacher/AttendanceWorkbench", () => ({
  AttendanceWorkbench: () => null,
}));

describe("S24 L8: Mobile Law & Universal Scroll-and-Click Law (390px, min-h-[38px])", () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const sampleCards: DerivedTeacherFeedCard[] = [
    {
      id: "c-1",
      teacherUserId: "teacher-1",
      cardType: "ClassworkPendingCard",
      tier: "T1_action_required",
      priority: 68,
      title: { en: "Record Classwork: Period 1 (Class 6-A)", hi: "कक्षा कार्य" },
      summary: { en: "Mathematics · Mark topic taught", hi: "गणित" },
      payload: { periodNumber: 1, subjectName: "Mathematics", className: "Class 6", sectionName: "A" },
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    },
    {
      id: "c-2",
      teacherUserId: "teacher-1",
      cardType: "HomeworkDueCard",
      tier: "T2_informational",
      priority: 55,
      title: { en: "Homework Due Soon: Science (Class 8-B)", hi: "गृहकार्य" },
      summary: { en: "Cell Biology · 15/20 submitted", hi: "जीव विज्ञान" },
      payload: { assignmentId: "asg-1", title: "Cell Biology", submissionCount: 15, totalStudents: 20 },
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    },
    {
      id: "c-3",
      teacherUserId: "teacher-1",
      cardType: "SubstitutionCard",
      tier: "T1_action_required",
      priority: 88,
      title: { en: "Cover Period 3 (A)", hi: "पीरियड 3" },
      summary: { en: "Cover requested for Rajesh Kumar (Class 6-A Mathematics). Warning: Clash with your timetable.", hi: "कवर" },
      payload: {
        topSubstitution: {
          id: "sub-1",
          direction: "INCOMING",
          periodNumber: 3,
          hasConflict: true,
          conflictReason: "Schedule clash",
        },
      },
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    },
  ];

  it("enforces mobile viewport constraints: zero horizontal table scroll and vertical feed layout", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TeacherFeedContainer
          initialCards={sampleCards}
          teacherName="Anjali Mehta"
          schoolName="Delhi Public Academy"
          sectionsTaught={["Class 6-A", "Class 8-B"]}
          subjectsTaught={["Mathematics", "Science"]}
          locale="en"
        />
      </QueryClientProvider>
    );

    // Root container must have overflow-x-hidden
    const root = container.querySelector(".overflow-x-hidden");
    expect(root).toBeInTheDocument();

    // Universal Scroll-and-Click Law: No <table> elements allowed on the teacher feed
    const tables = container.querySelectorAll("table");
    expect(tables.length).toBe(0);
  });

  it("enforces touch target ergonomics: all card action buttons have min-h-[38px]", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TeacherFeedContainer
          initialCards={sampleCards}
          teacherName="Anjali Mehta"
          schoolName="Delhi Public Academy"
          sectionsTaught={["Class 6-A"]}
          subjectsTaught={["Mathematics"]}
          locale="en"
        />
      </QueryClientProvider>
    );

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBeGreaterThan(0);

    for (const btn of buttons) {
      // Primary and secondary card buttons must have min-h-[38px] class
      const hasMinHeight = btn.className.includes("min-h-[38px]") || btn.className.includes("min-h-[40px]");
      expect(hasMinHeight).toBe(true);
    }
  });
});
