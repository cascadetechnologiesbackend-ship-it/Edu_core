/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SubstitutionCard } from "../SubstitutionCard";
import type { TeacherSubstitutionItem } from "@/app/(teacher)/teacher/classes/substitutionsActions";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock server actions called by UI
const { mockAccept, mockDecline, mockCancel, mockRequestAbsence } = vi.hoisted(
  () => ({
    mockAccept: vi.fn(),
    mockDecline: vi.fn(),
    mockCancel: vi.fn(),
    mockRequestAbsence: vi.fn(),
  })
);

vi.mock("@/app/(teacher)/teacher/classes/substitutionsActions", () => ({
  acceptSubstitutionAction: (id: string) => mockAccept(id),
  declineSubstitutionAction: (id: string, reason?: string) =>
    reason !== undefined ? mockDecline(id, reason) : mockDecline(id),
  cancelAbsenceRequestAction: (id: string) => mockCancel(id),
  requestAbsenceCoverageAction: (data: any) => mockRequestAbsence(data),
  getTeacherTimetablePeriodsForDate: vi.fn().mockResolvedValue([
    {
      id: "period-1",
      periodNumber: 1,
      startTime: "08:30",
      endTime: "09:15",
      className: "Class 8",
      sectionName: "A",
      subjectName: "Mathematics",
    },
  ]),
}));

describe("Phase T8: SubstitutionCard UI & 2-Tap Budget (AC-T8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockIncoming: TeacherSubstitutionItem[] = [
    {
      id: "incoming-sub-1",
      direction: "INCOMING",
      date: "2026-10-21",
      timetablePeriodId: "period-3",
      periodNumber: 3,
      startTime: "10:15",
      endTime: "11:00",
      className: "Class 8",
      sectionName: "B",
      sectionId: "sec-8b",
      subjectName: "Mathematics",
      otherTeacherName: "Vikram Sharma",
      otherTeacherId: "teacher-vikram",
      reason: "Medical appointment",
      status: "PENDING",
      hasConflict: false,
      createdAt: new Date().toISOString(),
    },
  ];

  const mockIncomingWithClash: TeacherSubstitutionItem[] = [
    {
      id: "incoming-sub-clash",
      direction: "INCOMING",
      date: "2026-10-21",
      timetablePeriodId: "period-4",
      periodNumber: 4,
      startTime: "11:00",
      endTime: "11:45",
      className: "Class 9",
      sectionName: "A",
      sectionId: "sec-9a",
      subjectName: "Physics",
      otherTeacherName: "Sunita Verma",
      otherTeacherId: "teacher-sunita",
      reason: "Personal leave",
      status: "PENDING",
      hasConflict: true,
      conflictReason: "Clashes with your scheduled Class 8-B Maths (Period 4)",
      createdAt: new Date().toISOString(),
    },
  ];

  const mockOutgoing: TeacherSubstitutionItem[] = [
    {
      id: "outgoing-sub-1",
      direction: "OUTGOING",
      date: "2026-10-22",
      timetablePeriodId: "period-5",
      periodNumber: 5,
      startTime: "12:00",
      endTime: "12:45",
      className: "Class 10",
      sectionName: "A",
      sectionId: "sec-10a",
      subjectName: "Chemistry",
      otherTeacherName: "Awaiting Assignment",
      otherTeacherId: "",
      reason: "Family emergency",
      status: "PENDING",
      createdAt: new Date().toISOString(),
    },
  ];

  it("renders incoming cover card with details and Accept / Decline CTA", () => {
    render(<SubstitutionCard incoming={mockIncoming} outgoing={[]} />);

    expect(screen.getByText(/Substitutions & Cover/i)).toBeDefined();
    expect(screen.getByText(/Period 3/i)).toBeDefined();
    expect(screen.getByText(/Class 8-B/i)).toBeDefined();
    expect(screen.getByText(/Mathematics/i)).toBeDefined();
    expect(screen.getByText(/Vikram Sharma/i)).toBeDefined();
    expect(screen.getByText(/Accept Cover/i)).toBeDefined();
    expect(screen.getByText(/Decline/i)).toBeDefined();
  });

  it("fulfills 2-tap budget: Accept button triggers accept action immediately", async () => {
    mockAccept.mockResolvedValueOnce({
      success: true,
      substitutionId: "incoming-sub-1",
      status: "CONFIRMED",
    });

    render(<SubstitutionCard incoming={mockIncoming} outgoing={[]} />);

    const acceptBtn = screen.getByRole("button", { name: /Accept Cover/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalledWith("incoming-sub-1");
    });
  });

  it("highlights schedule clash with alert banner when conflict is pre-flagged (AC-T8)", () => {
    render(<SubstitutionCard incoming={mockIncomingWithClash} outgoing={[]} />);

    expect(screen.getByText(/Schedule Conflict Detected/i)).toBeDefined();
    expect(
      screen.getByText(/Clashes with your scheduled Class 8-B Maths/i)
    ).toBeDefined();
  });

  it("fulfills decline flow: Decline button invokes decline action", async () => {
    mockDecline.mockResolvedValueOnce({
      success: true,
      substitutionId: "incoming-sub-1",
      status: "PENDING",
      unassigned: true,
    });

    render(<SubstitutionCard incoming={mockIncoming} outgoing={[]} />);

    const declineBtn = screen.getByRole("button", { name: /Decline/i });
    fireEvent.click(declineBtn);

    await waitFor(() => {
      expect(mockDecline).toHaveBeenCalledWith("incoming-sub-1");
    });
  });

  it("allows switching to outgoing requests tab and cancelling pending request", async () => {
    mockCancel.mockResolvedValueOnce({
      success: true,
      substitutionId: "outgoing-sub-1",
      status: "CANCELLED",
    });

    render(<SubstitutionCard incoming={[]} outgoing={mockOutgoing} />);

    expect(screen.getByText(/My Outgoing Requests/i)).toBeDefined();
    expect(screen.getByText(/Awaiting Assignment/i)).toBeDefined();

    const cancelBtn = screen.getByRole("button", { name: /Cancel Request/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(mockCancel).toHaveBeenCalledWith("outgoing-sub-1");
    });
  });

  it("renders bilingual Hindi support cleanly", () => {
    render(
      <SubstitutionCard
        incoming={mockIncoming}
        outgoing={mockOutgoing}
        locale="hi"
      />
    );

    expect(screen.getByText(/स्थानापन्न प्रबंधन/i)).toBeDefined();
    expect(screen.getAllByText(/कवर का अनुरोध करें/i)[0]).toBeDefined();
    expect(screen.getByText(/आने वाले अनुरोध/i)).toBeDefined();
    expect(screen.getAllByText(/स्वीकार करें/i)[0]).toBeDefined();
    expect(screen.getAllByText(/अस्वीकार करें/i)[0]).toBeDefined();
  });
});
