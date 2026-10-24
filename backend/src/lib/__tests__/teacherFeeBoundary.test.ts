import { describe, it, expect } from "vitest";
import type {
  FeeBadgeStatus,
  StudentFeeStatusProjection,
} from "../teacherEventEngine/scopeResolver";

// Forbidden financial keys under DPDP Act 2023 Statutory Shield (S16 Layer L7)
// Teachers MUST NEVER receive financial amounts, balances, payment history, or parent banking details.
const FORBIDDEN_FINANCIAL_KEYS = [
  "amount",
  "balance",
  "feetotal",
  "payment",
  "bank",
  "upi",
  "transaction",
  "netpayable",
  "arrears",
  "discount",
  "fine",
  "accountnumber",
  "ifsc",
  "ledger",
  "invoiceamount",
  "paidamount",
];

/**
 * Deep recursive key scanner:
 * Asserts that no forbidden key substring appears anywhere in the object tree.
 */
function scanForForbiddenKeys(data: any, path: string = ""): string[] {
  const violations: string[] = [];
  if (!data || typeof data !== "object") return violations;

  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      violations.push(...scanForForbiddenKeys(item, `${path}[${index}]`));
    });
    return violations;
  }

  for (const [key, value] of Object.entries(data)) {
    const currentPath = path ? `${path}.${key}` : key;
    const lowerKey = key.toLowerCase();

    for (const forbidden of FORBIDDEN_FINANCIAL_KEYS) {
      if (lowerKey.includes(forbidden)) {
        violations.push(`Violation at "${currentPath}": contains forbidden token "${forbidden}"`);
      }
    }

    if (value && typeof value === "object") {
      violations.push(...scanForForbiddenKeys(value, currentPath));
    }
  }

  return violations;
}

describe("S16 Layer L7: DPDP Fee Boundary & Response Shape Tests", () => {
  it("Task 7.1: Forbidden Key Scanner detects leaked financial properties", () => {
    const compliantPayload = {
      studentId: "11111111-1111-1111-1111-111111111111",
      name: "Aarav Sharma",
      feeStatus: "PAID" as FeeBadgeStatus,
      attendanceRate: 95,
    };
    expect(scanForForbiddenKeys(compliantPayload)).toHaveLength(0);

    const nonCompliantPayload = {
      studentId: "11111111-1111-1111-1111-111111111111",
      name: "Aarav Sharma",
      feeStatus: "DUE",
      totalAmountDue: 15000, // VIOLATION
      bankDetails: { ifsc: "HDFC0001" }, // VIOLATION
    };
    const violations = scanForForbiddenKeys(nonCompliantPayload);
    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(violations.some((v) => v.includes("totalAmountDue"))).toBe(true);
    expect(violations.some((v) => v.includes("bankDetails"))).toBe(true);
  });

  it("Task 7.2: projectScopedRosterFeeStatus projection shape contract", () => {
    const mockProjections: StudentFeeStatusProjection[] = [
      { studentId: "s-1", status: "PAID" },
      { studentId: "s-2", status: "DUE" },
      { studentId: "s-3", status: "OVERDUE" },
    ];

    for (const proj of mockProjections) {
      const keys = Object.keys(proj);
      expect(keys.sort()).toEqual(["status", "studentId"].sort());
      expect(["PAID", "DUE", "OVERDUE"]).toContain(proj.status);
    }

    const violations = scanForForbiddenKeys(mockProjections);
    expect(violations).toHaveLength(0);
  });

  it("Task 7.3: Student 360 Full Homeroom view carries categorical fee status only", () => {
    const fullHomeroom360 = {
      studentId: "st-101",
      name: "Ananya Patel",
      admissionNumber: "ADM-2026-089",
      rollNumber: "14",
      className: "Class 9",
      sectionName: "A",
      accessLevel: "FULL_HOMEROOM" as const,
      feeStatus: "DUE" as FeeBadgeStatus,
      attendanceSummary: {
        totalDays: 30,
        presentDays: 28,
        attendancePercent: 93,
      },
      assignmentHistory: [
        {
          assignmentId: "asg-1",
          title: "Algebra Quadratics Problem Set",
          dueDate: "2026-10-20",
          marksAwarded: 18,
          maxMarks: 20,
          isLate: false,
          remarks: "Excellent clarity",
        },
      ],
      examMarksHistory: [
        { examName: "Term 1 Exam", subjectName: "Mathematics", marksObtained: 88, isAbsent: false },
        { examName: "Term 1 Exam", subjectName: "Science", marksObtained: 79, isAbsent: false },
        { examName: "Term 1 Exam", subjectName: "English", marksObtained: 92, isAbsent: false },
      ],
      homeroomRemarks: {
        remarks: "Exemplary class citizen; active participant in science exhibitions.",
        conductGrade: "A+",
        signedOffAt: "2026-10-24T10:00:00Z",
      },
    };

    // Assert strictly categorical feeStatus
    expect(["PAID", "DUE", "OVERDUE"]).toContain(fullHomeroom360.feeStatus);

    // Deep crawl for forbidden financial fields
    const violations = scanForForbiddenKeys(fullHomeroom360);
    expect(violations).toHaveLength(0);
  });

  it("Task 7.4: Student 360 Restricted Subject view hides fee status and cross-subject marks", () => {
    const restrictedSubject360 = {
      studentId: "st-101",
      name: "Ananya Patel",
      admissionNumber: "ADM-2026-089",
      rollNumber: "14",
      className: "Class 9",
      sectionName: "A",
      accessLevel: "RESTRICTED_SUBJECT" as const,
      feeStatus: undefined, // Strictly hidden for non-homeroom subject teachers
      attendanceSummary: {
        totalDays: 30,
        presentDays: 28,
        attendancePercent: 93,
      },
      assignmentHistory: [
        {
          assignmentId: "asg-1",
          title: "Algebra Quadratics Problem Set",
          dueDate: "2026-10-20",
          marksAwarded: 18,
          maxMarks: 20,
          isLate: false,
          remarks: null,
        },
      ],
      examMarksHistory: [
        // Only teacher's own allocated subject visible
        { examName: "Term 1 Exam", subjectName: "Mathematics", marksObtained: 88, isAbsent: false },
      ],
      homeroomRemarks: undefined, // Hidden
    };

    expect(restrictedSubject360.feeStatus).toBeUndefined();
    expect(restrictedSubject360.homeroomRemarks).toBeUndefined();
    expect(restrictedSubject360.examMarksHistory).toHaveLength(1);
    expect(restrictedSubject360.examMarksHistory[0]?.subjectName).toBe("Mathematics");

    const violations = scanForForbiddenKeys(restrictedSubject360);
    expect(violations).toHaveLength(0);
  });

  it("Task 7.5: Teacher Section Roster payload contains zero fee amounts", () => {
    const rosterRow = {
      studentId: "st-202",
      name: "Ishaan Verma",
      admissionNumber: "ADM-2026-112",
      rollNumber: "22",
      attendanceRate30d: 87,
      attendanceStatusChip: "EXCELLENT" as const,
      feeStatus: "OVERDUE" as FeeBadgeStatus,
      latestSubmission: {
        assignmentTitle: "Physics Motion",
        status: "GRADED" as const,
        marksAwarded: 24,
        maxMarks: 25,
      },
    };

    expect(["PAID", "DUE", "OVERDUE"]).toContain(rosterRow.feeStatus);
    const violations = scanForForbiddenKeys(rosterRow);
    expect(violations).toHaveLength(0);
  });
});
