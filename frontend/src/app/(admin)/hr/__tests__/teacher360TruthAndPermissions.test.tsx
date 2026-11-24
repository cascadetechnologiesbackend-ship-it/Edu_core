// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: {},
  })),
}));

vi.mock("@/lib/serverAuth", () => ({
  getCachedSession: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn((key: string) => (key === "tab" ? "compensation" : null)),
    toString: () => "",
  }),
  usePathname: () => "/hr/staff/emp-1",
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/forms/AddressAutofill", () => ({
  AddressAutofill: () => <div data-testid="address-autofill" />,
  formatAddressForStorage: vi.fn(() => ""),
}));

vi.mock("react", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    cache: (fn: any) => fn,
  };
});

vi.mock("../actions", () => ({
  updateStaff: vi.fn(async () => ({ success: true })),
  updateStaffPhotoAction: vi.fn(async () => ({ success: true })),
  confirmStaffProbation: vi.fn(async () => ({ success: true })),
  offboardStaff: vi.fn(async () => ({ success: true })),
  reactivateStaff: vi.fn(async () => ({ success: true })),
  toggleStaffLegalHold: vi.fn(async () => ({ success: true })),
  revealStaffPii: vi.fn(async () => ({ success: true, data: {} })),
}));

vi.mock("../../actions", () => ({
  updateStaff: vi.fn(async () => ({ success: true })),
  updateStaffPhotoAction: vi.fn(async () => ({ success: true })),
  confirmStaffProbation: vi.fn(async () => ({ success: true })),
  offboardStaff: vi.fn(async () => ({ success: true })),
  reactivateStaff: vi.fn(async () => ({ success: true })),
  toggleStaffLegalHold: vi.fn(async () => ({ success: true })),
  revealStaffPii: vi.fn(async () => ({ success: true, data: {} })),
}));

import React from "react";
import { render, screen } from "@testing-library/react";
import { Staff360Client } from "../staff/[id]/Staff360Client";

describe("Teacher 360 Truth & Permission Invariants", () => {
  const baseProfile = {
    id: "emp-001",
    employeeCode: "OGA-CBSE-EMP-038E",
    firstName: "Ramesh",
    lastName: "Gupta",
    fullName: "Ramesh Gupta",
    email: "ramesh.gupta@school.edu",
    mobile: "9876543210",
    address: "Bangalore",
    emergencyContact: null,
    dateOfBirth: "1985-06-20",
    gender: "Male",
    aadhaarLast4: "1234",
    departmentId: "dept-1",
    departmentName: "Mathematics",
    designationId: "desig-1",
    designationName: "Senior Teacher",
    isTeaching: true,
    contractType: "PERMANENT",
    joiningDate: "2022-06-01",
    confirmationDate: "2023-06-01",
    relievingDate: null,
    separationType: null,
    separationReason: null,
    isActive: true,
    legalHold: false,
    qualification: "M.Sc Mathematics, B.Ed",
    experience: "10 years",
    academicAllocations: {
      classTeacherOf: ["Class 10 - Section A"],
      classSubjects: [{ id: "cs-1", className: "Class 10", subjectName: "Mathematics" }],
      weeklyPeriodsCount: 18,
    },
    salaryConfigured: false,
    salaryComponents: null,
    salaryBreakdown: null,
    activeLoansCount: 0,
    documentsCount: 2,
    leaveBalances: [{ id: "lb-1", leaveType: "Casual Leave", allocatedDays: 12, usedDays: 3, remainingDays: 9 }],
    createdAt: "2022-06-01T00:00:00.000Z",
    photoUrl: null,
  };

  it("never fabricates 1.35x multiplier or hardcoded ₹200 PT when only provisional components exist", () => {
    // Staff with provisional components but no backend breakdown
    const provisionalProfile = {
      ...baseProfile,
      salaryConfigured: true,
      salaryComponents: {
        basicSalary: "30000",
        daPercent: "10",
        hraPercent: "20",
        monthlyTdsAmount: "1000",
      },
      salaryBreakdown: null,
    };

    render(
      <Staff360Client
        profile={provisionalProfile}
        departments={[]}
        designations={[]}
        userRole="HR_MANAGER"
        schoolName="Oakridge Global Academy"
      />
    );

    // Must show provisional disclaimer
    expect(screen.getByText(/Provisional components on record/i)).toBeDefined();
    expect(screen.getByText(/Uncomputed/i)).toBeDefined();

    // Must NOT fabricate 1.35x: 30000 * 1.35 = 40500
    expect(screen.queryByText(/40,500/)).toBeNull();
    // Must NOT fabricate hardcoded 200 PT
    expect(screen.queryByText(/Professional Tax \(PT\)/i)).toBeNull();
  });

  it("renders honest gap state with CTA when no salary structure is configured", () => {
    render(
      <Staff360Client
        profile={baseProfile}
        departments={[]}
        designations={[]}
        userRole="HR_MANAGER"
        schoolName="Oakridge Global Academy"
      />
    );

    expect(screen.getByText("No salary components configured yet for this staff member.")).toBeDefined();
    expect(screen.getAllByText("Configure Salary Structure →").length).toBeGreaterThan(0);
  });

  it("disables offboarding button when legal hold is active", () => {
    const legalHoldProfile = {
      ...baseProfile,
      legalHold: true,
    };

    render(
      <Staff360Client
        profile={legalHoldProfile}
        departments={[]}
        designations={[]}
        userRole="HR_MANAGER"
        schoolName="Oakridge Global Academy"
      />
    );

    const offboardBtn = screen.getByRole("button", { name: "Offboard Staff" }) as HTMLButtonElement;
    expect(offboardBtn.disabled).toBe(true);
  });
});
