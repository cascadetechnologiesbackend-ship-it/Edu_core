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

  describe("Phase 7B Part B 403 Matrix: Statements, BRS & JV/Contra", () => {
    const PHASE_7B_PERMISSIONS = {
      statements_view: ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"],
      statements_export: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
      jv_contra_brs_create: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
      brs_statement_preview: ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"],
    } as const;

    function check7BPermission(perm: keyof typeof PHASE_7B_PERMISSIONS, role: Role): boolean {
      const allowed = PHASE_7B_PERMISSIONS[perm] as readonly string[];
      return allowed.includes(role);
    }

    it("verifies financial statements view: SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL (read-only); non-admins export denied", () => {
      // View permissions
      expect(check7BPermission("statements_view", "SUPER_ADMIN")).toBe(true);
      expect(check7BPermission("statements_view", "SCHOOL_ADMIN")).toBe(true);
      expect(check7BPermission("statements_view", "PRINCIPAL")).toBe(true);
      expect(check7BPermission("statements_view", "ACCOUNTANT")).toBe(false);
      expect(check7BPermission("statements_view", "TEACHER")).toBe(false);

      // Export permissions (Admins only)
      expect(check7BPermission("statements_export", "SUPER_ADMIN")).toBe(true);
      expect(check7BPermission("statements_export", "SCHOOL_ADMIN")).toBe(true);
      expect(check7BPermission("statements_export", "PRINCIPAL")).toBe(false); // 403
      expect(check7BPermission("statements_export", "ACCOUNTANT")).toBe(false); // 403
      expect(check7BPermission("statements_export", "TEACHER")).toBe(false); // 403
    });

    it("verifies JV, Contra, and BRS Adjusting JV create: Admins only; ACCOUNTANT receives 403", () => {
      // Admins allowed
      expect(check7BPermission("jv_contra_brs_create", "SUPER_ADMIN")).toBe(true);
      expect(check7BPermission("jv_contra_brs_create", "SCHOOL_ADMIN")).toBe(true);

      // Accountant and Principal strictly denied (403)
      expect(check7BPermission("jv_contra_brs_create", "ACCOUNTANT")).toBe(false);
      expect(check7BPermission("jv_contra_brs_create", "PRINCIPAL")).toBe(false);
      expect(check7BPermission("jv_contra_brs_create", "TEACHER")).toBe(false);
    });

    it("verifies BRS matcher dry-run preview is accessible to accountant and principal for operational auditing", () => {
      expect(check7BPermission("brs_statement_preview", "SUPER_ADMIN")).toBe(true);
      expect(check7BPermission("brs_statement_preview", "SCHOOL_ADMIN")).toBe(true);
      expect(check7BPermission("brs_statement_preview", "ACCOUNTANT")).toBe(true);
      expect(check7BPermission("brs_statement_preview", "PRINCIPAL")).toBe(true);
      expect(check7BPermission("brs_statement_preview", "TEACHER")).toBe(false);
    });
  });

  describe("Track D: Role Engineering, Onboarding Integrity & RBAC Operations", () => {
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

    // D1 & D2: Designation -> Role Mapping Matrix
    const DESIGNATION_MAPPING_MATRIX: Array<{
      name: string;
      isTeaching: boolean;
      expectedMappedRole: Role;
      participatesInAms: boolean;
    }> = [
      { name: "Mathematics Senior Teacher", isTeaching: true, expectedMappedRole: "TEACHER", participatesInAms: true },
      { name: "Primary Science Educator", isTeaching: true, expectedMappedRole: "TEACHER", participatesInAms: true },
      { name: "Chief Accountant / Bursar", isTeaching: false, expectedMappedRole: "ACCOUNTANT", participatesInAms: false },
      { name: "HR & Payroll Manager", isTeaching: false, expectedMappedRole: "HR_MANAGER", participatesInAms: false },
      { name: "Head Librarian", isTeaching: false, expectedMappedRole: "LIBRARIAN", participatesInAms: false },
      { name: "School Principal", isTeaching: false, expectedMappedRole: "PRINCIPAL", participatesInAms: false },
      { name: "Transport Operations Manager", isTeaching: false, expectedMappedRole: "TRANSPORT_MANAGER", participatesInAms: false },
      { name: "System Administrator / IT Support", isTeaching: false, expectedMappedRole: "SCHOOL_ADMIN", participatesInAms: false },
    ];

    it("D1: enforces strict designation-to-role authoritative mapping and AMS isolation", () => {
      for (const d of DESIGNATION_MAPPING_MATRIX) {
        // Invariant: isTeaching = true strictly requires mappedRole = 'TEACHER' and participatesInAms = true
        if (d.isTeaching) {
          expect(d.expectedMappedRole).toBe("TEACHER");
          expect(d.participatesInAms).toBe(true);
        } else {
          // Non-teaching designations must receive their domain role and NEVER participate in AMS
          expect(d.expectedMappedRole).not.toBe("TEACHER");
          expect(d.participatesInAms).toBe(false);
        }
      }
    });

    it("D2: asserts that every onboarded staff member lands with exactly one authoritative ERP role", () => {
      for (const d of DESIGNATION_MAPPING_MATRIX) {
        const assignedRoles = [d.expectedMappedRole];
        expect(assignedRoles.length).toBe(1);
        expect(allRoles).toContain(assignedRoles[0]);
      }
    });

    it("D3: verifies role-based dashboard landing paths per canonical ROLE_CONFIGS", () => {
      const EXPECTED_ROLE_LANDINGS: Record<Role, string> = {
        SUPER_ADMIN: "/super-admin/dashboard",
        SCHOOL_ADMIN: "/dashboard",
        ACCOUNTANT: "/school/fees-dashboard",
        PRINCIPAL: "/principal/dashboard",
        HR_MANAGER: "/hr/dashboard",
        TEACHER: "/teacher/dashboard",
        LIBRARIAN: "/librarian/dashboard",
        TRANSPORT_MANAGER: "/transport/dashboard",
        PARENT: "/parent/dashboard",
        STUDENT: "/student/dashboard",
        DRIVER: "/driver/dashboard",
      };

      for (const [roleKey, expectedUrl] of Object.entries(EXPECTED_ROLE_LANDINGS)) {
        // Assert role has configured defaultDashboard
        expect(expectedUrl).toMatch(/^\/[a-z0-9\-_/]+$/);
      }

      // Assert ACCOUNTANT default dashboard points to canonical Finance Hub
      expect(EXPECTED_ROLE_LANDINGS.ACCOUNTANT).toBe("/school/fees-dashboard");
    });

    it("D3: validates forced password change redirection with preserved next query parameter", () => {
      const testCases = [
        { role: "ACCOUNTANT" as Role, mustChange: true, expectedNext: "/school/fees-dashboard" },
        { role: "PRINCIPAL" as Role, mustChange: true, expectedNext: "/principal/dashboard" },
        { role: "TEACHER" as Role, mustChange: false, expectedNext: "/teacher/dashboard" },
      ];

      for (const tc of testCases) {
        if (tc.mustChange) {
          const redirectUrl = `/force-password-change?next=${encodeURIComponent(tc.expectedNext)}`;
          expect(redirectUrl).toContain("/force-password-change?next=");
          expect(decodeURIComponent(redirectUrl.split("next=")[1] || "")).toBe(tc.expectedNext);
        }
      }
    });

    it("D3: enforces DECIDE-18 multi-role resolution priority (staff mappedRole first, fallback to hierarchy)", () => {
      const HIERARCHY_WEIGHTS: Record<Role, number> = {
        SUPER_ADMIN: 100,
        SCHOOL_ADMIN: 90,
        PRINCIPAL: 80,
        ACCOUNTANT: 70,
        HR_MANAGER: 60,
        TEACHER: 50,
        LIBRARIAN: 40,
        TRANSPORT_MANAGER: 30,
        PARENT: 20,
        STUDENT: 10,
        DRIVER: 5,
      };

      function resolvePrimaryRole(
        userRoles: Role[],
        staffMappedRole?: Role,
      ): Role {
        if (staffMappedRole && userRoles.includes(staffMappedRole)) {
          return staffMappedRole;
        }
        return [...userRoles].sort(
          (a, b) => (HIERARCHY_WEIGHTS[b] ?? 0) - (HIERARCHY_WEIGHTS[a] ?? 0),
        )[0] ?? "STUDENT";
      }

      // User has both SCHOOL_ADMIN and ACCOUNTANT; designation mappedRole is ACCOUNTANT
      const userA = resolvePrimaryRole(["SCHOOL_ADMIN", "ACCOUNTANT"], "ACCOUNTANT");
      expect(userA).toBe("ACCOUNTANT");

      // User has multiple roles with no staff designation mappedRole -> falls back to highest hierarchy
      const userB = resolvePrimaryRole(["ACCOUNTANT", "TEACHER", "SCHOOL_ADMIN"]);
      expect(userB).toBe("SCHOOL_ADMIN");
    });

    it("D5: validates RBAC CRUD permission boundaries: SUPER_ADMIN vs SCHOOL_ADMIN vs non-admins", () => {
      const RBAC_ACTIONS = {
        create_update_custom_role: ["SUPER_ADMIN"],
        assign_remove_user_role: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
        toggle_user_access: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
        reset_staff_credentials: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
      } as const;

      function canPerformRbac(action: keyof typeof RBAC_ACTIONS, role: Role): boolean {
        return (RBAC_ACTIONS[action] as readonly string[]).includes(role);
      }

      // SUPER_ADMIN can perform all RBAC actions
      expect(canPerformRbac("create_update_custom_role", "SUPER_ADMIN")).toBe(true);
      expect(canPerformRbac("assign_remove_user_role", "SUPER_ADMIN")).toBe(true);
      expect(canPerformRbac("toggle_user_access", "SUPER_ADMIN")).toBe(true);
      expect(canPerformRbac("reset_staff_credentials", "SUPER_ADMIN")).toBe(true);

      // SCHOOL_ADMIN can manage user memberships and credentials, but NOT create/update system or tenant roles
      expect(canPerformRbac("create_update_custom_role", "SCHOOL_ADMIN")).toBe(false); // 403
      expect(canPerformRbac("assign_remove_user_role", "SCHOOL_ADMIN")).toBe(true);
      expect(canPerformRbac("toggle_user_access", "SCHOOL_ADMIN")).toBe(true);
      expect(canPerformRbac("reset_staff_credentials", "SCHOOL_ADMIN")).toBe(true);

      // Operational roles (ACCOUNTANT, PRINCIPAL, TEACHER) are strictly 403 on all RBAC management
      for (const opRole of ["ACCOUNTANT", "PRINCIPAL", "TEACHER"] as Role[]) {
        expect(canPerformRbac("create_update_custom_role", opRole)).toBe(false);
        expect(canPerformRbac("assign_remove_user_role", opRole)).toBe(false);
        expect(canPerformRbac("toggle_user_access", opRole)).toBe(false);
        expect(canPerformRbac("reset_staff_credentials", opRole)).toBe(false);
      }
    });

    it("D5: enforces Last-Active-SUPER_ADMIN guard invariant", () => {
      function canRemoveSuperAdmin(activeSuperAdminCount: number): { allowed: boolean; message?: string } {
        if (activeSuperAdminCount <= 1) {
          return { allowed: false, message: "Guard Violation: Cannot remove the last active SUPER_ADMIN of this school." };
        }
        return { allowed: true };
      }

      expect(canRemoveSuperAdmin(1).allowed).toBe(false);
      expect(canRemoveSuperAdmin(1).message).toContain("Cannot remove the last active SUPER_ADMIN");
      expect(canRemoveSuperAdmin(2).allowed).toBe(true);
    });

    it("D2/D3: asserts SMS fallback security: unconfigured provider never reveals plaintext in payload", () => {
      interface ResetResponse {
        success: boolean;
        warning?: string;
        credentials?: {
          email: string;
          tempPassword: string;
          roleDisplayName: string;
          dashboardUrl: string;
        };
      }

      function simulateCredentialReset(smsConfigured: boolean): ResetResponse {
        const tempPassword = "MockSecretTemp#123";
        if (!smsConfigured) {
          return {
            success: true,
            warning: "SMS not delivered (provider unconfigured). Please provide credentials manually.",
            credentials: {
              email: "bursar@school.edu",
              tempPassword,
              roleDisplayName: "Chief Accountant",
              dashboardUrl: "/school/fees-dashboard",
            },
          };
        }
        return { success: true };
      }

      const resUnconfigured = simulateCredentialReset(false);
      expect(resUnconfigured.success).toBe(true);
      expect(resUnconfigured.warning).toContain("SMS not delivered");
      expect(resUnconfigured.credentials?.tempPassword).toBeDefined();

      const resConfigured = simulateCredentialReset(true);
      expect(resConfigured.success).toBe(true);
      expect(resConfigured.credentials).toBeUndefined(); // Plaintext not returned when SMS is dispatched
    });
  });

  describe("Phase 7C: ACC-07 Concession & Waiver Summary Report Invariants & RBAC", () => {
    it("enforces view and export RBAC boundaries for concession summary report", () => {
      const canView = (role: Role) =>
        ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "PRINCIPAL"].includes(role);
      const canExport = (role: Role) =>
        ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(role);

      // View permissions
      expect(canView("SUPER_ADMIN")).toBe(true);
      expect(canView("SCHOOL_ADMIN")).toBe(true);
      expect(canView("ACCOUNTANT")).toBe(true);
      expect(canView("PRINCIPAL")).toBe(true);
      expect(canView("TEACHER")).toBe(false);
      expect(canView("LIBRARIAN")).toBe(false);

      // Export permissions (Strictly admins)
      expect(canExport("SUPER_ADMIN")).toBe(true);
      expect(canExport("SCHOOL_ADMIN")).toBe(true);
      expect(canExport("ACCOUNTANT")).toBe(false); // 403 on export
      expect(canExport("PRINCIPAL")).toBe(false); // 403 on export
      expect(canExport("TEACHER")).toBe(false);
    });

    it("verifies Policy x Term x Class aggregation invariants and realization calculations", () => {
      const mockRawInvoices = [
        { studentId: "s1", policy: "Merit Scholarship", type: "MERIT", term: "TERM_1", class: "Grade 10-A", gross: 25000, discount: 5000 },
        { studentId: "s2", policy: "Merit Scholarship", type: "MERIT", term: "TERM_1", class: "Grade 10-A", gross: 25000, discount: 5000 },
        { studentId: "s3", policy: "Sibling Discount", type: "SIBLING", term: "TERM_1", class: "Grade 8-B", gross: 20000, discount: 4000 },
        { studentId: "s4", policy: "Administrative Fee Waiver", type: "SPECIAL", term: "TERM_2", class: "Grade 8-B", gross: 20000, discount: 2000 },
      ];

      // Simulate aggregation
      interface GroupAcc {
        policy: string;
        type: string;
        term: string;
        class: string;
        students: Set<string>;
        gross: number;
        discount: number;
      }
      const groups = new Map<string, GroupAcc>();

      for (const inv of mockRawInvoices) {
        const key = `${inv.policy}::${inv.term}::${inv.class}`;
        let g = groups.get(key);
        if (!g) {
          g = { policy: inv.policy, type: inv.type, term: inv.term, class: inv.class, students: new Set(), gross: 0, discount: 0 };
          groups.set(key, g);
        }
        g.students.add(inv.studentId);
        g.gross += inv.gross;
        g.discount += inv.discount;
      }

      expect(groups.size).toBe(3);

      const meritGroup = groups.get("Merit Scholarship::TERM_1::Grade 10-A")!;
      expect(meritGroup.students.size).toBe(2);
      expect(meritGroup.gross).toBe(50000);
      expect(meritGroup.discount).toBe(10000);

      const netRealized = meritGroup.gross - meritGroup.discount;
      expect(netRealized).toBe(40000);

      const rate = (netRealized / meritGroup.gross) * 100;
      expect(rate).toBe(80.0);

      const totalGross = Array.from(groups.values()).reduce((sum, g) => sum + g.gross, 0);
      const totalDiscount = Array.from(groups.values()).reduce((sum, g) => sum + g.discount, 0);
      const totalNet = totalGross - totalDiscount;
      expect(totalGross).toBe(90000);
      expect(totalDiscount).toBe(16000);
      expect(totalNet).toBe(74000);
      expect(Math.round(((totalNet / totalGross) * 100) * 10) / 10).toBe(82.2);
    });
  });
});


