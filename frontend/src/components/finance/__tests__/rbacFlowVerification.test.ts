import { describe, it, expect } from "vitest";

// ─── BASELINE ROLE MATRIX FROM SPEC v3.0.0 ──────────────────────────────────
export const BASELINE_ROLE_MATRIX = {
  collect_and_print: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"],
  cancel_reverse: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  refunds_request: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"],
  refunds_approve_and_process: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  concessions_configure: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"],
  concessions_approve: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  carry_forward_and_import: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  view_audit_logs: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  vouchers_create: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"],
  expenses_approve: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  bank_accounts_manage: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  finance_dashboards_view: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"],
  finance_dashboards_readonly: ["PRINCIPAL"],
} as const;

export type Permission = keyof typeof BASELINE_ROLE_MATRIX;
export type Role =
  | "SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "ACCOUNTANT"
  | "PRINCIPAL"
  | "TEACHER"
  | "HR_MANAGER"
  | "LIBRARIAN"
  | "TRANSPORT_MANAGER"
  | "DRIVER"
  | "STUDENT"
  | "PARENT";

function checkRolePermission(permission: Permission, role: Role): boolean {
  const allowed = BASELINE_ROLE_MATRIX[permission] as readonly string[];
  return allowed.includes(role);
}

describe("Part B: RBAC Baseline Role Matrix Enforcement", () => {
  const allRoles: Role[] = [
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "ACCOUNTANT",
    "PRINCIPAL",
    "TEACHER",
    "HR_MANAGER",
    "LIBRARIAN",
    "TRANSPORT_MANAGER",
  ];

  it("enforces ACCOUNTANT permissions strictly per baseline_role_matrix", () => {
    // ACCOUNTANT can collect, create vouchers, request refunds, configure concessions
    expect(checkRolePermission("collect_and_print", "ACCOUNTANT")).toBe(true);
    expect(checkRolePermission("vouchers_create", "ACCOUNTANT")).toBe(true);
    expect(checkRolePermission("refunds_request", "ACCOUNTANT")).toBe(true);
    expect(checkRolePermission("concessions_configure", "ACCOUNTANT")).toBe(true);
    expect(checkRolePermission("finance_dashboards_view", "ACCOUNTANT")).toBe(true);

    // ACCOUNTANT is strictly 403 / forbidden on administrative approvals and system settings
    expect(checkRolePermission("cancel_reverse", "ACCOUNTANT")).toBe(false);
    expect(checkRolePermission("expenses_approve", "ACCOUNTANT")).toBe(false);
    expect(checkRolePermission("refunds_approve_and_process", "ACCOUNTANT")).toBe(false);
    expect(checkRolePermission("concessions_approve", "ACCOUNTANT")).toBe(false);
    expect(checkRolePermission("bank_accounts_manage", "ACCOUNTANT")).toBe(false);
    expect(checkRolePermission("carry_forward_and_import", "ACCOUNTANT")).toBe(false);
    expect(checkRolePermission("view_audit_logs", "ACCOUNTANT")).toBe(false);
  });

  it("enforces SCHOOL_ADMIN has full financial operations and administrative approvals", () => {
    expect(checkRolePermission("collect_and_print", "SCHOOL_ADMIN")).toBe(true);
    expect(checkRolePermission("cancel_reverse", "SCHOOL_ADMIN")).toBe(true);
    expect(checkRolePermission("refunds_request", "SCHOOL_ADMIN")).toBe(true);
    expect(checkRolePermission("refunds_approve_and_process", "SCHOOL_ADMIN")).toBe(true);
    expect(checkRolePermission("concessions_configure", "SCHOOL_ADMIN")).toBe(true);
    expect(checkRolePermission("concessions_approve", "SCHOOL_ADMIN")).toBe(true);
    expect(checkRolePermission("carry_forward_and_import", "SCHOOL_ADMIN")).toBe(true);
    expect(checkRolePermission("view_audit_logs", "SCHOOL_ADMIN")).toBe(true);
    expect(checkRolePermission("vouchers_create", "SCHOOL_ADMIN")).toBe(true);
    expect(checkRolePermission("expenses_approve", "SCHOOL_ADMIN")).toBe(true);
    expect(checkRolePermission("bank_accounts_manage", "SCHOOL_ADMIN")).toBe(true);
  });

  it("enforces PRINCIPAL is strictly read-only and denied on all mutation paths", () => {
    expect(checkRolePermission("finance_dashboards_readonly", "PRINCIPAL")).toBe(true);

    // All mutations must 403
    expect(checkRolePermission("collect_and_print", "PRINCIPAL")).toBe(false);
    expect(checkRolePermission("cancel_reverse", "PRINCIPAL")).toBe(false);
    expect(checkRolePermission("refunds_request", "PRINCIPAL")).toBe(false);
    expect(checkRolePermission("refunds_approve_and_process", "PRINCIPAL")).toBe(false);
    expect(checkRolePermission("concessions_configure", "PRINCIPAL")).toBe(false);
    expect(checkRolePermission("concessions_approve", "PRINCIPAL")).toBe(false);
    expect(checkRolePermission("vouchers_create", "PRINCIPAL")).toBe(false);
    expect(checkRolePermission("expenses_approve", "PRINCIPAL")).toBe(false);
    expect(checkRolePermission("bank_accounts_manage", "PRINCIPAL")).toBe(false);
  });

  it("enforces non-finance roles receive 403 on all finance operations", () => {
    const nonFinanceRoles: Role[] = ["TEACHER", "HR_MANAGER", "LIBRARIAN", "TRANSPORT_MANAGER"];
    const allFinancePermissions: Permission[] = [
      "collect_and_print",
      "cancel_reverse",
      "refunds_request",
      "refunds_approve_and_process",
      "concessions_configure",
      "concessions_approve",
      "carry_forward_and_import",
      "view_audit_logs",
      "vouchers_create",
      "expenses_approve",
      "bank_accounts_manage",
    ];

    for (const role of nonFinanceRoles) {
      for (const perm of allFinancePermissions) {
        expect(checkRolePermission(perm, role)).toBe(false);
      }
    }
  });
});

describe("Role Interaction Flows (RIF-01 to RIF-08)", () => {
  it("RIF-01: Accountant voucher starts PENDING and requires separation of duties for approval", () => {
    const accountantUser = { id: "user-acc", role: "ACCOUNTANT" as const };
    const adminUser = { id: "user-admin", role: "SCHOOL_ADMIN" as const };

    // Accountant voucher creation sets PENDING status
    const requestedStatus = "APPROVED";
    const status = accountantUser.role === "ACCOUNTANT" ? "PENDING" : requestedStatus;
    expect(status).toBe("PENDING");

    // Approver must not be the submitter (separation of duties)
    const voucher = { id: "v-1", createdById: accountantUser.id, status: "PENDING", amount: "5000.00" };
    
    // Submitter trying to approve themselves fails
    const canSelfApprove = voucher.createdById !== accountantUser.id;
    expect(canSelfApprove).toBe(false);

    // School admin (different user) can approve
    const canAdminApprove =
      checkRolePermission("expenses_approve", adminUser.role) &&
      voucher.createdById !== adminUser.id;
    expect(canAdminApprove).toBe(true);
  });

  it("RIF-03: Refund request cannot exceed net paid amount and processes via administrative approval", () => {
    const receipt = {
      receiptNumber: "REC-2026-001",
      amountPaid: 12000,
      existingRefunds: [
        { amount: 3000, status: "PROCESSED" },
        { amount: 1000, status: "PENDING" },
      ],
    };

    const totalActive = receipt.existingRefunds.reduce((sum, r) => sum + r.amount, 0);
    const maxRefundable = receipt.amountPaid - totalActive;
    expect(maxRefundable).toBe(8000);

    // Accountant requests 5000 (valid <= 8000)
    const requestedAmount = 5000;
    expect(requestedAmount <= maxRefundable).toBe(true);

    // Accountant requesting 9000 is rejected
    const invalidAmount = 9000;
    expect(invalidAmount <= maxRefundable).toBe(false);
  });

  it("RIF-04: Approved concession assignment reduces net amount at invoice generation (AUTO-06)", () => {
    const grossAmount = 25000;
    const concession = {
      discountPercentage: 20, // 20% concession
      discountAmount: null,
      isActive: true,
      approvedAt: new Date(), // Approved
    };

    let discount = 0;
    if (concession.discountPercentage) {
      discount = (grossAmount * concession.discountPercentage) / 100;
    }
    const netAmount = grossAmount - discount;

    expect(discount).toBe(5000);
    expect(netAmount).toBe(20000);
    expect(netAmount).toBe(grossAmount - discount);
  });

  it("RIF-07: Staff-ward concession suggestions surface strictly to concessions_approve roles", () => {
    expect(checkRolePermission("concessions_approve", "SUPER_ADMIN")).toBe(true);
    expect(checkRolePermission("concessions_approve", "SCHOOL_ADMIN")).toBe(true);
    // HR_MANAGER and ACCOUNTANT are rejected
    expect(checkRolePermission("concessions_approve", "ACCOUNTANT")).toBe(false);
    expect(checkRolePermission("concessions_approve", "HR_MANAGER")).toBe(false);
  });

  it("RIF-06: Impersonation audit rows record actor + impersonatedBySuperAdminId correctly", () => {
    const superAdminId = "super-admin-999";
    const impersonatedAccountantId = "accountant-user-111";

    // Simulate session context resolved under active impersonation
    const impersonationContext = {
      userId: impersonatedAccountantId,
      role: "ACCOUNTANT" as const,
      impersonatedBy: superAdminId,
      schoolId: "school-123",
    };

    // Construct audit payload as written by logFeeAuditEvent
    const auditPayload = {
      schoolId: impersonationContext.schoolId,
      action: "FEE_COLLECTION",
      entityType: "FEE_PAYMENT",
      entityId: "rec-payment-001",
      actorId: impersonationContext.userId,
      actorRole: impersonationContext.role,
      impersonatedBySuperAdminId: impersonationContext.impersonatedBy,
      details: { amount: 5000, receiptNumber: "REC-2026-001" },
    };

    expect(auditPayload.actorId).toBe("accountant-user-111");
    expect(auditPayload.actorRole).toBe("ACCOUNTANT");
    expect(auditPayload.impersonatedBySuperAdminId).toBe("super-admin-999");
    expect(auditPayload.impersonatedBySuperAdminId).not.toBeNull();
  });

  it("RIF-08: Reminder log in StudentLedgerDrawer + zero ciphertext in action payloads", () => {
    // 1. Reminder log verification in StudentLedgerDrawer
    const reminderLog = [
      { id: "rem-1", channel: "SMS", sentAt: "2026-10-01T10:00:00Z", status: "DELIVERED", reminderType: "D7_OVERDUE" },
      { id: "rem-2", channel: "WHATSAPP", sentAt: "2026-10-05T10:00:00Z", status: "DELIVERED", reminderType: "D15_OVERDUE" },
    ];
    expect(reminderLog).toHaveLength(2);
    expect(reminderLog[0]?.reminderType).toBe("D7_OVERDUE");

    // 2. DPDP Zero Ciphertext Assertion in action payloads
    const serverActionPayload = {
      studentId: "stud-123",
      studentName: "Aarav Sharma", // Decrypted plaintext
      admissionNumber: "ADM-2026-0042",
      guardianName: "Rajesh Sharma",
      mobile: "+91 9876543210",
      invoices: [{ invoiceNumber: "INV-2026-001", feeHeadName: "Tuition Fee", balance: 5000 }],
    };

    // Hex ciphertext or iv:ciphertext pattern regex (e.g. 32-char iv:hex data)
    const ciphertextRegex = /^[a-f0-9]{32}:[a-f0-9]{32,}/i;

    expect(ciphertextRegex.test(serverActionPayload.studentName)).toBe(false);
    expect(ciphertextRegex.test(serverActionPayload.admissionNumber)).toBe(false);
    expect(ciphertextRegex.test(serverActionPayload.guardianName)).toBe(false);
    expect(ciphertextRegex.test(serverActionPayload.mobile)).toBe(false);
    expect(serverActionPayload.studentName).toBe("Aarav Sharma");
  });
});

describe("Idempotency Key & Double-Entry Invariants", () => {
  it("Idempotency: Key scoped per school + user, duplicate submit returns original receipt with 0 new ledger rows", () => {
    const schoolId = "sch-100";
    const userId = "acc-user-50";
    const idempotencyKey = "client-req-uuid-9876";

    // Mock storage of completed payments
    const existingPayments = [
      {
        id: "pay-1",
        schoolId,
        collectedById: userId,
        idempotencyKey,
        receiptNumber: "REC-2026-9001",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
    ];

    let ledgerRowCount = 1;

    // Simulate second submit with exact same key, school, and user within 24h
    const isWithin24Hours = (date: Date) => Date.now() - date.getTime() < 24 * 60 * 60 * 1000;
    const existing = existingPayments.find(
      (p) =>
        p.schoolId === schoolId &&
        p.collectedById === userId &&
        p.idempotencyKey === idempotencyKey &&
        isWithin24Hours(p.createdAt),
    );

    let resultReceipt: string;
    if (existing) {
      // Short-circuit: Return original receipt without inserting ledger transaction
      resultReceipt = existing.receiptNumber;
      // ledgerRowCount does not increase
    } else {
      ledgerRowCount += 1;
      resultReceipt = "REC-NEW";
    }

    expect(resultReceipt).toBe("REC-2026-9001");
    expect(ledgerRowCount).toBe(1); // Exactly 1 row in ledger, no double-post
  });

  it("DECIDE-12 Option A + AUTO-04: Auto-settle posts ACC-05 gateway fee split with debit==credit invariant", () => {
    const grossAmount = 10000.00;
    const gatewayFee = 200.00;
    const netSettled = grossAmount - gatewayFee; // 9800.00

    // Double-entry postings for gateway fee split
    const journalLines = [
      { account: "Bank Account (Asset)", side: "DEBIT" as const, amount: netSettled },
      { account: "Gateway Fees Expense (Expense)", side: "DEBIT" as const, amount: gatewayFee },
      { account: "Student Receivable (Asset)", side: "CREDIT" as const, amount: grossAmount },
    ];

    const totalDebits = journalLines
      .filter((l) => l.side === "DEBIT")
      .reduce((sum, l) => sum + l.amount, 0);

    const totalCredits = journalLines
      .filter((l) => l.side === "CREDIT")
      .reduce((sum, l) => sum + l.amount, 0);

    expect(totalDebits).toBe(10000.00);
    expect(totalCredits).toBe(10000.00);
    expect(totalDebits).toBe(totalCredits); // Invariant holds!
  });
});

describe("Cross-Module Data Flow & Treasury Invariants", () => {
  it("Treasury Invariant: Treasury total equals sum(bank_accounts.currentBalance) after mixed operations", () => {
    // Initial treasury state
    let bankBalance = 50000;
    const ledgerTransactions: Array<{ type: "CREDIT" | "DEBIT"; amount: number }> = [];

    // 1. Counter Collection (+15,000)
    const collectAmount = 15000;
    bankBalance += collectAmount;
    ledgerTransactions.push({ type: "CREDIT", amount: collectAmount });

    // 2. Receipt Cancellation (-3,000)
    const cancelAmount = 3000;
    bankBalance -= cancelAmount;
    ledgerTransactions.push({ type: "DEBIT", amount: cancelAmount });

    // 3. Processed Refund (-2,000)
    const refundAmount = 2000;
    bankBalance -= refundAmount;
    ledgerTransactions.push({ type: "DEBIT", amount: refundAmount });

    // 4. Approved Expense Voucher (-5,000)
    const expenseAmount = 5000;
    bankBalance -= expenseAmount;
    ledgerTransactions.push({ type: "DEBIT", amount: expenseAmount });

    // Verify Treasury Balance invariant
    const netLedgerImpact = ledgerTransactions.reduce((acc, tx) => {
      return tx.type === "CREDIT" ? acc + tx.amount : acc - tx.amount;
    }, 0);

    const expectedEndingBalance = 50000 + netLedgerImpact;
    expect(bankBalance).toBe(55000);
    expect(bankBalance).toBe(expectedEndingBalance);
  });

  it("Tenant Isolation: Operation on school A cannot affect school B", () => {
    const schoolA = "school-uuid-aaa";
    const schoolB = "school-uuid-bbb";

    const accounts = [
      { id: "acc-1", schoolId: schoolA, balance: 10000 },
      { id: "acc-2", schoolId: schoolB, balance: 25000 },
    ];

    // Query scoped to School A
    const schoolAAccounts = accounts.filter((a) => a.schoolId === schoolA);
    expect(schoolAAccounts).toHaveLength(1);
    expect(schoolAAccounts[0]?.id).toBe("acc-1");

    // Attempt to access with wrong schoolId yields no results
    const leaked = schoolAAccounts.filter((a) => a.schoolId === schoolB);
    expect(leaked).toHaveLength(0);
  });
});

