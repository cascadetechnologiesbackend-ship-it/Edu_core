// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/serverAuth", () => ({
  getCachedSession: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../actions", () => ({
  updateStudentPhotoAction: vi.fn(async () => ({ success: true })),
  reassignStudentAction: vi.fn(async () => ({ success: true })),
}));

import React from "react";
import { render, screen } from "@testing-library/react";
import { Student360Client, Student360Data } from "../[id]/Student360Client";

describe("Student 360 Truth & Permission Invariants", () => {
  const baseZeroData: Student360Data = {
    id: "std-001",
    admissionNumber: "ADM-2026-001",
    fullName: "Name not recorded",
    isNameRecorded: false,
    photoS3Key: null,
    dateOfBirth: "2016-05-15",
    gender: "MALE",
    category: "GENERAL",
    bloodGroup: null,
    aadhaarLast4: null,
    apaarId: null,
    photoUrl: null,
    isActive: true,
    admissionDate: "2026-04-01",
    leavingDate: null,
    leavingReason: null,
    classId: "cls-1",
    className: "Class 1",
    sectionName: "A",
    academicYearLabel: "2026-27",
    classTeacherName: "teacher.cbse",
    familyMembers: [],
    subjects: [],
    attendanceSummary: {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      percentage: null,
      scopeLabel: "this term",
    },
    attendanceLogs: [],
    canViewFees: true,
    canMutateFees: true,
    feeStructures: [],
    invoices: [],
    concessions: [],
    documents: [],
    classHistory: [],
    timelineEvents: [],
    canViewExams: true,
    examMarks: [],
    reportCards: [],
    homeworkSubmissions: [],
  };

  it("renders UNKNOWN for attendance percentage when zero days are recorded (never 100%)", () => {
    render(
      <Student360Client
        data={baseZeroData}
        schoolId="sch-001"
        userRole="ADMIN"
        availableClasses={[]}
        availableYears={[]}
      />
    );

    // MetricCard should display UNKNOWN with honest zero-data subtext
    expect(screen.getByText("No attendance recorded this term")).toBeDefined();
    const unknownMetrics = screen.getAllByText("UNKNOWN");
    expect(unknownMetrics.length).toBeGreaterThan(0);

    // Must NOT fabricate 100%
    const fabricated100 = screen.queryByText("100%");
    expect(fabricated100).toBeNull();
  });

  it("never renders the fabricated superlative banner over zero records", () => {
    render(
      <Student360Client
        data={baseZeroData}
        schoolId="sch-001"
        userRole="ADMIN"
        availableClasses={[]}
        availableYears={[]}
      />
    );

    const superlativeBanner = screen.queryByText(
      /All attendance, fees, and academic milestones are in excellent standing/i
    );
    expect(superlativeBanner).toBeNull();
  });

  it("renders 'Name not recorded' and admission number when name is missing instead of fake 'Unknown'", () => {
    render(
      <Student360Client
        data={baseZeroData}
        schoolId="sch-001"
        userRole="ADMIN"
        availableClasses={[]}
        availableYears={[]}
      />
    );

    expect(screen.getAllByText("Name not recorded").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ADM-2026-001/).length).toBeGreaterThan(0);
  });

  it("gates Fee tab when canViewFees is false (e.g. for TEACHER role)", () => {
    const teacherData: Student360Data = {
      ...baseZeroData,
      canViewFees: false,
      canMutateFees: false,
    };

    const { unmount } = render(
      <Student360Client
        data={teacherData}
        schoolId="sch-001"
        userRole="TEACHER"
        availableClasses={[]}
        availableYears={[]}
      />
    );

    // Fee tab should NOT be rendered when canViewFees is false
    expect(screen.queryByRole("tab", { name: "Fees" })).toBeNull();
    unmount();

    // As ADMIN with canViewFees: true, Fee tab SHOULD be rendered
    render(
      <Student360Client
        data={baseZeroData}
        schoolId="sch-001"
        userRole="ADMIN"
        availableClasses={[]}
        availableYears={[]}
      />
    );

    expect(screen.getByRole("tab", { name: "Fees" })).toBeDefined();
  });
});
