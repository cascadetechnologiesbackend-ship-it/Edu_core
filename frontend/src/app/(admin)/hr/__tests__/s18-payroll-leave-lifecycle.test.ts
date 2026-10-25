import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Mock React cache ───────────────────────────────────────────────────────
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/requestContext", () => ({
  getClientRequestContext: vi.fn(() => ({})),
}));

// ─── 2. Hoisted Mock References ────────────────────────────────────────────────
const { activeSessionRef, mockState } = vi.hoisted(() => {
  const activeSessionRef = {
    current: null as {
      userId: string;
      role: string;
      schoolId: string;
      email: string;
    } | null,
  };

  const mockState = {
    schoolId: "school-100",
    academicYear: {
      id: "ay-2026",
      schoolId: "school-100",
      isActive: true,
    },
    staff: [] as any[],
    leaveTypes: [
      { id: "lt-cl", schoolId: "school-100", code: "CL", name: "Casual Leave" },
      { id: "lt-lwp", schoolId: "school-100", code: "LWP", name: "Leave Without Pay" },
    ],
    leaveBalances: [] as any[],
    leaveRequests: [] as any[],
    payrollRuns: [] as any[],
    payslips: [] as any[],
    staffLoans: [] as any[],
  };

  return { activeSessionRef, mockState };
});

// ─── 3. Mock Server Auth & Next-Auth ───────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => {
    if (!activeSessionRef.current) return null;
    return {
      user: {
        id: activeSessionRef.current.userId,
        role: activeSessionRef.current.role,
        schoolId: activeSessionRef.current.schoolId,
        email: activeSessionRef.current.email,
      },
    };
  }),
}));

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles: readonly string[]) => {
    if (!activeSessionRef.current) throw new Error("Unauthorized");
    if (!allowedRoles.includes(activeSessionRef.current.role)) {
      throw new Error(`Role ${activeSessionRef.current.role} is not permitted`);
    }
    return {
      session: { user: activeSessionRef.current },
      userId: activeSessionRef.current.userId,
      role: activeSessionRef.current.role,
      schoolId: activeSessionRef.current.schoolId,
    };
  }),
  requireSchool: vi.fn(async () => ({ id: mockState.schoolId, name: "Test School" })),
  checkAuth: vi.fn(async () => ({ user: activeSessionRef.current })),
}));

// ─── 4. Mock Database ──────────────────────────────────────────────────────────
vi.mock("@/db", () => {
  const mockDb = {
    query: {
      academicYears: {
        findFirst: vi.fn(async () => mockState.academicYear),
      },
      staff: {
        findFirst: vi.fn(async (opts: any) => {
          return mockState.staff.find((s) => s.id === opts?.where?.value || true) || mockState.staff[0];
        }),
        findMany: vi.fn(async () => mockState.staff),
      },
      leaveTypes: {
        findFirst: vi.fn(async (opts: any) => {
          return mockState.leaveTypes.find((lt) => lt.id === opts?.where?.value) || mockState.leaveTypes[0];
        }),
      },
      leaveBalances: {
        findFirst: vi.fn(async () => mockState.leaveBalances[0] || null),
      },
      leaveRequests: {
        findFirst: vi.fn(async (opts: any) => {
          return mockState.leaveRequests.find((lr) => lr.id === opts?.where?.value) || mockState.leaveRequests[0];
        }),
        findMany: vi.fn(async () => mockState.leaveRequests),
      },
      staffAttendance: {
        findMany: vi.fn(async () => []),
      },
      staffLoans: {
        findFirst: vi.fn(async () => mockState.staffLoans[0] || null),
      },
      payrollRuns: {
        findFirst: vi.fn(async (opts: any) => {
          const run = mockState.payrollRuns.find((r) => r.id === opts?.where?.value || true);
          if (!run) return null;
          return {
            ...run,
            payslips: mockState.payslips.filter((p) => p.payrollRunId === run.id),
          };
        }),
        findMany: vi.fn(async () => mockState.payrollRuns),
      },
    },
    insert: (table: any) => ({
      values: (vals: any) => {
        const id = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const record = { id, ...vals };
        if (vals.month && vals.totalGross !== undefined) {
          // payrollRun
          mockState.payrollRuns.push(record);
        } else if (vals.payrollRunId) {
          // payslip
          mockState.payslips.push(record);
        } else if (vals.totalDays !== undefined) {
          // leaveRequest
          mockState.leaveRequests.push(record);
        }
        return {
          returning: () => [record],
        };
      },
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: (condition: any) => {
          if (values.usedDays !== undefined && mockState.leaveBalances[0]) {
            mockState.leaveBalances[0].usedDays = values.usedDays;
          }
          if (
            (values.rejectionReason !== undefined ||
              values.hodApprovedById !== undefined ||
              values.hrApprovedById !== undefined) &&
            mockState.leaveRequests[0]
          ) {
            Object.assign(mockState.leaveRequests[0], values);
          }
          if (
            (values.approvedById !== undefined || values.totalGross !== undefined) &&
            mockState.payrollRuns[0]
          ) {
            Object.assign(mockState.payrollRuns[0], values);
          }
          if (values.remainingAmount !== undefined && mockState.staffLoans[0]) {
            Object.assign(mockState.staffLoans[0], values);
          }
          return Promise.resolve({ rowCount: 1 });
        },
      }),
    }),
  };

  return {
    db: mockDb,
    withTenant: vi.fn(async (_schoolId: string, cb: any) => cb(mockDb)),
  };
});

// ─── 5. Import Actions Under Test ──────────────────────────────────────────────
import {
  createLeaveRequest,
  approveLeaveRequest,
  runPayrollForMonth,
  approveAndLockPayroll,
} from "../actions";

describe("S18 L6: Payroll & Leave Lifecycle CI Test Suite (S18-F07)", () => {
  beforeEach(() => {
    mockState.staff = [
      {
        id: "staff-101",
        schoolId: mockState.schoolId,
        isActive: true,
        salaryComponents: [
          {
            basicSalary: "30000.00",
            daPercent: "10.00",
            hraPercent: "20.00",
            pfEmployeePercent: "12.00",
            pfEmployerPercent: "12.00",
            esiApplicable: false,
            monthlyTdsAmount: "1000.00",
            otherAllowances: [],
            professionalTaxState: "DL",
          },
        ],
        loans: [
          {
            id: "loan-1",
            status: "ACTIVE",
            emiAmount: "2500.00",
            remainingAmount: "5000.00",
          },
        ],
        leaveRequests: [],
      },
    ];

    mockState.leaveBalances = [
      {
        id: "lb-1",
        schoolId: mockState.schoolId,
        staffId: "staff-101",
        leaveType: "CL",
        academicYearId: "ay-2026",
        allocatedDays: "12.0",
        usedDays: "2.0",
      },
    ];

    mockState.staffLoans = [
      {
        id: "loan-1",
        schoolId: mockState.schoolId,
        staffId: "staff-101",
        status: "ACTIVE",
        emiAmount: "2500.00",
        remainingAmount: "5000.00",
      },
    ];

    mockState.leaveRequests = [];
    mockState.payrollRuns = [];
    mockState.payslips = [];

    activeSessionRef.current = {
      userId: "user-hr-admin",
      role: "HR_MANAGER",
      schoolId: mockState.schoolId,
      email: "hr@school.edu",
    };
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PART 1: LEAVE REQUEST LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════════

  it("1.1 createLeaveRequest: creates leave request with PENDING status", async () => {
    const res = await createLeaveRequest({
      staffId: "staff-101",
      leaveTypeId: "lt-cl",
      startDate: "2026-11-01",
      endDate: "2026-11-02",
      totalDays: 2,
      reason: "Family emergency",
    });

    expect(res.success).toBe(true);
    expect(mockState.leaveRequests).toHaveLength(1);
    const created = mockState.leaveRequests[0]!;
    expect(created.status).toBe("PENDING");
    expect(created.staffId).toBe("staff-101");
    expect(created.totalDays).toBe("2.0");
    expect(created.reason).toBe("Family emergency");
  });

  it("1.2 approveLeaveRequest (HOD Approval step): transitions to HOD_APPROVED", async () => {
    // Initial pending request
    mockState.leaveRequests = [
      {
        id: "lr-1",
        schoolId: mockState.schoolId,
        staffId: "staff-101",
        leaveTypeId: "lt-cl",
        totalDays: "2.0",
        status: "PENDING",
      },
    ];

    activeSessionRef.current = {
      userId: "user-hod",
      role: "TEACHER",
      schoolId: mockState.schoolId,
      email: "hod@school.edu",
    };

    const res = await approveLeaveRequest("lr-1", "HOD", true);
    expect(res.success).toBe(true);
    expect(mockState.leaveRequests[0]!.status).toBe("HOD_APPROVED");
    expect(mockState.leaveRequests[0]!.hodApprovedById).toBe("user-hod");
    expect(mockState.leaveRequests[0]!.hodApprovedAt).toBeDefined();
  });

  it("1.3 approveLeaveRequest (HR Approval step): transitions to HR_APPROVED and updates leaveBalance usedDays", async () => {
    mockState.leaveRequests = [
      {
        id: "lr-1",
        schoolId: mockState.schoolId,
        staffId: "staff-101",
        leaveTypeId: "lt-cl",
        totalDays: "3.0",
        status: "HOD_APPROVED",
      },
    ];

    activeSessionRef.current = {
      userId: "user-hr",
      role: "HR_MANAGER",
      schoolId: mockState.schoolId,
      email: "hr@school.edu",
    };

    const initialUsedDays = parseFloat(mockState.leaveBalances[0]!.usedDays); // 2.0
    const res = await approveLeaveRequest("lr-1", "HR", true);

    expect(res.success).toBe(true);
    expect(mockState.leaveRequests[0]!.status).toBe("HR_APPROVED");
    expect(mockState.leaveRequests[0]!.hrApprovedById).toBe("user-hr");
    // Assert balance increment: 2.0 + 3.0 = 5.0
    expect(parseFloat(mockState.leaveBalances[0]!.usedDays)).toBe(initialUsedDays + 3.0);
  });

  it("1.4 approveLeaveRequest (Reject): transitions to REJECTED with rejection reason", async () => {
    mockState.leaveRequests = [
      {
        id: "lr-1",
        schoolId: mockState.schoolId,
        staffId: "staff-101",
        leaveTypeId: "lt-cl",
        totalDays: "2.0",
        status: "PENDING",
      },
    ];

    const res = await approveLeaveRequest("lr-1", "HR", false, "Staff shortage during exam week");
    expect(res.success).toBe(true);
    expect(mockState.leaveRequests[0]!.status).toBe("REJECTED");
    expect(mockState.leaveRequests[0]!.rejectionReason).toBe("Staff shortage during exam week");
  });

  it("1.5 createLeaveRequest: rejects unauthenticated caller with error", async () => {
    activeSessionRef.current = null;
    const res = await createLeaveRequest({
      staffId: "staff-101",
      leaveTypeId: "lt-cl",
      startDate: "2026-11-01",
      endDate: "2026-11-02",
      totalDays: 2,
      reason: "Unauthorized attempt",
    });

    expect(res.success).toBe(false);
    expect(res.message).toBe("Unauthorized");
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PART 2: PAYROLL RUN LIFECYCLE & STATE LOCK
  // ══════════════════════════════════════════════════════════════════════════════

  it("2.1 runPayrollForMonth: calculates gross, deductions, netPay and sets status to PROCESSED", async () => {
    activeSessionRef.current = {
      userId: "user-hr-admin",
      role: "HR_MANAGER",
      schoolId: mockState.schoolId,
      email: "hr@school.edu",
    };

    const res = await runPayrollForMonth("2026-11");
    expect(res.success).toBe(true);
    expect(res.runId).toBeDefined();

    expect(mockState.payrollRuns).toHaveLength(1);
    const run = mockState.payrollRuns[0]!;
    expect(run.status).toBe("PROCESSED");
    expect(parseFloat(run.totalGross)).toBeGreaterThan(0);
    expect(parseFloat(run.totalNetPay)).toBeGreaterThan(0);

    // Verify payslip was generated for staff-101
    expect(mockState.payslips).toHaveLength(1);
    const slip = mockState.payslips[0]!;
    expect(slip.staffId).toBe("staff-101");
    expect(slip.month).toBe("2026-11");
    expect(parseFloat(slip.loanDeduction)).toBe(2500); // from activeLoan.emiAmount
  });

  it("2.2 runPayrollForMonth: rejects unauthorized roles (e.g. TEACHER)", async () => {
    activeSessionRef.current = {
      userId: "user-teacher",
      role: "TEACHER",
      schoolId: mockState.schoolId,
      email: "teacher@school.edu",
    };

    const res = await runPayrollForMonth("2026-11");
    expect(res.success).toBe(false);
    expect(res.message).toContain("not permitted");
  });

  it("2.3 approveAndLockPayroll: transitions run to APPROVED, sets approvedBy/At, and updates loan balances", async () => {
    // Setup processed payroll run with loan deduction
    mockState.payrollRuns = [
      {
        id: "run-nov-2026",
        schoolId: mockState.schoolId,
        month: "2026-11",
        status: "PROCESSED",
      },
    ];

    mockState.payslips = [
      {
        id: "slip-1",
        payrollRunId: "run-nov-2026",
        staffId: "staff-101",
        loanDeduction: "2500.00",
      },
    ];

    activeSessionRef.current = {
      userId: "user-principal",
      role: "PRINCIPAL",
      schoolId: mockState.schoolId,
      email: "principal@school.edu",
    };

    const initialRemainingLoan = parseFloat(mockState.staffLoans[0]!.remainingAmount); // 5000.00
    const res = await approveAndLockPayroll("run-nov-2026");

    expect(res.success).toBe(true);
    expect(mockState.payrollRuns[0]!.status).toBe("APPROVED");
    expect(mockState.payrollRuns[0]!.approvedById).toBe("user-principal");
    expect(mockState.payrollRuns[0]!.approvedAt).toBeDefined();

    // Loan remaining amount reduced: 5000 - 2500 = 2500
    expect(parseFloat(mockState.staffLoans[0]!.remainingAmount)).toBe(initialRemainingLoan - 2500);
    expect(mockState.staffLoans[0]!.status).toBe("ACTIVE");
  });
});
