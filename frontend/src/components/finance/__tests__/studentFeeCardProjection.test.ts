import { describe, it, expect } from "vitest";
import {
  StudentFeeCardSchema,
  PROHIBITED_STUDENT_FEE_CARD_KEYS,
  type StudentFeeCard,
} from "@schoolmitra/validators";
import {
  projectToStudentFeeCard,
  assertNoProhibitedStudentKeys,
} from "@/lib/studentFeeCard";
import {
  canRoleAccessRoute,
  assertRouteAccess,
  FULL_STUDENT_PROFILE_ALLOWED_ROLES,
} from "@/lib/routeGuards";

describe("Phase A3: StudentFeeCard Field-Level Projections & Data Scope Isolation (GT-06)", () => {
  const sampleRawStudentRecord = {
    id: "stu-uuid-001",
    admissionNumber: "ADM-2024-0042",
    fullName: "Aarav Sharma",
    name: "Aarav Sharma",
    className: "Class 10",
    sectionName: "Section A",
    academicYearId: "ay-2024-2025",
    enrollmentStatus: "ENROLLED",
    creditBalance: 500,
    advanceBalance: 1200,
    totalDue: 4500,
    pendingInvoiceCount: 2,
    invoices: [
      {
        id: "inv-001",
        invoiceNumber: "INV-2024-001",
        feeHeadName: "Tuition Fee",
        term: "Q1",
        grossAmount: 5000,
        discountAmount: 500,
        lateFeeAmount: 0,
        taxAmount: 0,
        netAmount: 4500,
        paidAmount: 2000,
        balanceAmount: 2500,
        dueDate: "2024-06-15T00:00:00.000Z",
        status: "PARTIAL",
      },
    ],
    payments: [
      {
        receiptNumber: "REC-2024-001",
        receiptGroupId: null,
        amountPaid: 2000,
        paymentMode: "UPI",
        paymentDate: "2024-06-10T10:30:00.000Z",
      },
    ],
    concessions: [
      {
        policy: "Sibling Discount 10%",
        status: "ACTIVE",
        approvedBy: "usr-admin-1",
      },
    ],
    reminders: [
      {
        d7SentAt: "SENT",
        d15SentAt: null,
        d30SentAt: null,
      },
    ],
  };

  it("validates a compliant student fee card against StudentFeeCardSchema", () => {
    const parsed = StudentFeeCardSchema.parse(sampleRawStudentRecord);
    expect(parsed.id).toBe("stu-uuid-001");
    expect(parsed.fullName).toBe("Aarav Sharma");
    expect(parsed.creditBalance).toBe(500);
    expect(parsed.invoices).toHaveLength(1);
    expect(parsed.invoices[0]?.balanceAmount).toBe(2500);
    expect(parsed.payments).toHaveLength(1);
    expect(parsed.concessions).toHaveLength(1);
  });

  it("projectToStudentFeeCard strips non-whitelisted raw database fields", () => {
    const rawStudentWithLeaks = {
      ...sampleRawStudentRecord,
      randomInternalField: "some-internal-data",
      internalNotes: "sensitive internal admin memo",
    };

    const projected = projectToStudentFeeCard(rawStudentWithLeaks);

    expect(projected.id).toBe("stu-uuid-001");
    expect((projected as any).randomInternalField).toBeUndefined();
    expect((projected as any).internalNotes).toBeUndefined();
  });

  it("assertNoProhibitedStudentKeys strictly detects and throws on any prohibited student PII key", () => {
    expect(PROHIBITED_STUDENT_FEE_CARD_KEYS.length).toBeGreaterThanOrEqual(10);

    for (const forbiddenKey of PROHIBITED_STUDENT_FEE_CARD_KEYS) {
      const maliciousPayload = {
        id: "stu-1",
        fullName: "Test Student",
        [forbiddenKey]: "leaked-sensitive-info",
      };

      expect(() => {
        assertNoProhibitedStudentKeys(maliciousPayload);
      }).toThrowError(/SecurityViolation: Prohibited student field/);
    }
  });

  it("projectToStudentFeeCard output has ZERO prohibited keys", () => {
    const projected = projectToStudentFeeCard(sampleRawStudentRecord);
    const projectedKeys = Object.keys(projected);

    for (const prohibitedKey of PROHIBITED_STUDENT_FEE_CARD_KEYS) {
      expect(projectedKeys).not.toContain(prohibitedKey);
      expect((projected as any)[prohibitedKey]).toBeUndefined();
    }
  });

  it("restricts full student profile (/students/[id]) server-side away from ACCOUNTANT", () => {
    // Symmetrical check: FULL_STUDENT_PROFILE_ALLOWED_ROLES must not contain ACCOUNTANT, LIBRARIAN, TRANSPORT_MANAGER
    expect(FULL_STUDENT_PROFILE_ALLOWED_ROLES).not.toContain("ACCOUNTANT");
    expect(FULL_STUDENT_PROFILE_ALLOWED_ROLES).not.toContain("LIBRARIAN");
    expect(FULL_STUDENT_PROFILE_ALLOWED_ROLES).not.toContain("TRANSPORT_MANAGER");

    // canRoleAccessRoute returns false for ACCOUNTANT navigating to student profile
    expect(canRoleAccessRoute("ACCOUNTANT", "/students/stu-uuid-001")).toBe(false);

    // assertRouteAccess denies access and returns fail-closed redirect
    const access = assertRouteAccess("ACCOUNTANT", "/students/stu-uuid-001", {
      id: "acc-user-1",
      email: "accountant@school.org",
    });
    expect(access.allowed).toBe(false);
    expect(access.redirectUrl).toBe("/school/fees-dashboard");
  });

  it("allows authorized roles (SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL, TEACHER) to access full student profile", () => {
    expect(canRoleAccessRoute("SUPER_ADMIN", "/students/stu-uuid-001")).toBe(true);
    expect(canRoleAccessRoute("SCHOOL_ADMIN", "/students/stu-uuid-001")).toBe(true);
    expect(canRoleAccessRoute("PRINCIPAL", "/students/stu-uuid-001")).toBe(true);
    expect(canRoleAccessRoute("TEACHER", "/students/stu-uuid-001")).toBe(true);
  });
});
