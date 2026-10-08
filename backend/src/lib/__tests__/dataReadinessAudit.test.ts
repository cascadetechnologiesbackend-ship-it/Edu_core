import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  auditMigrations,
  auditSchoolChartOfAccounts,
  auditOpeningBalanceEquity,
  postBankAccountOpeningBalance,
  runGoLiveDataReadinessAudit,
  EXPECTED_MIGRATIONS,
} from "../dataReadinessAudit";
import { SYSTEM_ACCOUNT_CODES } from "../chartOfAccountsEngine";

vi.mock("../chartOfAccountsEngine", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getBankAccountChartAccountId: vi.fn().mockResolvedValue("coa-1010-bank"),
    getOpeningBalanceEquityChartAccountId: vi.fn().mockResolvedValue("coa-3000-equity"),
  };
});

describe("Phase B1 AZ-06: Go-Live Data Readiness & Migration Audit (0014-0021)", () => {
  const schoolId = "school-audit-uuid-001";
  const bankAccountId = "bank-audit-uuid-001";

  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      execute: vi.fn(),
      transaction: vi.fn(async (cb: any) => cb(mockClient)),
      insert: vi.fn(() => ({
        values: vi.fn((vals: any) => ({
          returning: vi.fn().mockResolvedValue([{ id: "tx-ob-1", ...vals }]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
      query: {
        schools: {
          findMany: vi.fn().mockResolvedValue([{ id: schoolId }]),
        },
        chartOfAccounts: {
          findMany: vi.fn(),
        },
        accountLedgerTransactions: {
          findMany: vi.fn(),
        },
        bankAccounts: {
          findFirst: vi.fn().mockResolvedValue({ id: bankAccountId, currentBalance: "0.00" }),
        },
      },
    };
  });

  describe("1. Migration Coverage (0014 - 0021)", () => {
    it("verifies the 8 expected migrations list includes 0014 through 0021 per AM-01", () => {
      expect(EXPECTED_MIGRATIONS).toContain("0014_add_upi_payment_method");
      expect(EXPECTED_MIGRATIONS).toContain("0015_concession_approval_and_receipt_group");
      expect(EXPECTED_MIGRATIONS).toContain("0016_accounting_expansion_part_c");
      expect(EXPECTED_MIGRATIONS).toContain("0017_idempotency_partial_unique_idx");
      expect(EXPECTED_MIGRATIONS).toContain("0018_fee_structures_daily_late_fine_backfill");
      expect(EXPECTED_MIGRATIONS).toContain("0019_designations_mapped_role");
      expect(EXPECTED_MIGRATIONS).toContain("0020_student_fee_advances");
      expect(EXPECTED_MIGRATIONS).toContain("0021_worker_heartbeats");
      expect(EXPECTED_MIGRATIONS.length).toBe(8);
    });

    it("auditMigrations returns isComplete: true when all physical schema artifacts exist", async () => {
      mockClient.execute.mockResolvedValue({
        rows: [{ exists: true }],
      });

      const res = await auditMigrations(mockClient);
      expect(res.expected.length).toBe(8);
      expect(res.applied.length).toBe(8);
      expect(res.missing.length).toBe(0);
      expect(res.isComplete).toBe(true);
    });

    it("auditMigrations flags missing migrations when schema checks return empty", async () => {
      // First check (drizzle table) succeeds, but artifact checks return empty rows
      mockClient.execute
        .mockResolvedValueOnce({ rows: [{ exists: false }] })
        .mockResolvedValue({ rows: [] });

      const res = await auditMigrations(mockClient);
      expect(res.isComplete).toBe(false);
      expect(res.missing.length).toBe(8);
    });
  });

  describe("2. Chart of Accounts System Accounts & Ledger Health", () => {
    it("passes audit when all system codes (1000, 1200, 2100, 2110, 3000, 4000, 5200) are present with 0 null-account transactions", async () => {
      const mockAccounts = Object.values(SYSTEM_ACCOUNT_CODES).map((code) => ({
        id: `acc-${code}`,
        code,
        name: `Account ${code}`,
      }));

      mockClient.query.chartOfAccounts.findMany.mockResolvedValue(mockAccounts);
      mockClient.query.accountLedgerTransactions.findMany.mockResolvedValue([
        {
          id: "tx-1",
          debitAccountId: "acc-1000",
          creditAccountId: "acc-1200",
          amount: "5000.00",
        },
      ]);

      const res = await auditSchoolChartOfAccounts(schoolId, mockClient);
      expect(res.hasAllSystemAccounts).toBe(true);
      expect(res.missingSystemCodes.length).toBe(0);
      expect(res.nullAccountTransactions).toBe(0);
      expect(res.isCoaHealthy).toBe(true);
    });

    it("flags unhealthy when 2110 (Student Fee Advances) is missing or transactions have null accounts", async () => {
      const partialAccounts = [
        { code: "1000" },
        { code: "1200" },
        // Missing 2110, 2100, 3000, 4000, 5200
      ];

      mockClient.query.chartOfAccounts.findMany.mockResolvedValue(partialAccounts);
      mockClient.query.accountLedgerTransactions.findMany.mockResolvedValue([
        {
          id: "tx-corrupt",
          debitAccountId: null, // Corrupt null debit!
          creditAccountId: "acc-1200",
          amount: "1000.00",
        },
      ]);

      const res = await auditSchoolChartOfAccounts(schoolId, mockClient);
      expect(res.hasAllSystemAccounts).toBe(false);
      expect(res.missingSystemCodes).toContain("2110");
      expect(res.nullAccountTransactions).toBe(1);
      expect(res.isCoaHealthy).toBe(false);
    });
  });

  describe("3. Opening Balance Equity & Master Audit", () => {
    it("posts bank opening balance Dr Bank 1010, Cr Opening Balance Equity 3000", async () => {
      const glTx = await postBankAccountOpeningBalance(
        schoolId,
        bankAccountId,
        250000.0,
        mockClient
      );

      expect(glTx).toBeDefined();
      expect(glTx.sourceType).toBe("OPENING_BALANCE");
      expect(glTx.debitAccountId).toBe("coa-1010-bank");
      expect(glTx.creditAccountId).toBe("coa-3000-equity");
      expect(glTx.amount).toBe("250000.00");
    });

    it("auditOpeningBalanceEquity confirms equilibrium when debits equal credits", async () => {
      mockClient.query.accountLedgerTransactions.findMany.mockResolvedValue([
        { id: "tx-ob-1", amount: "100000.00" },
        { id: "tx-ob-2", amount: "50000.00" },
      ]);

      const res = await auditOpeningBalanceEquity(schoolId, mockClient);
      expect(res.isBalanced).toBe(true);
      expect(res.unbalancedDifference).toBe(0);
    });

    it("runGoLiveDataReadinessAudit aggregates full report with recommendations", async () => {
      mockClient.execute.mockResolvedValue({ rows: [{ exists: true }] });

      const allAccounts = Object.values(SYSTEM_ACCOUNT_CODES).map((code) => ({
        id: `acc-${code}`,
        code,
      }));
      mockClient.query.chartOfAccounts.findMany.mockResolvedValue(allAccounts);
      mockClient.query.accountLedgerTransactions.findMany.mockResolvedValue([]);

      const report = await runGoLiveDataReadinessAudit(schoolId, mockClient);
      expect(report.isReadyForGoLive).toBe(true);
      expect(report.recommendations.length).toBe(0);
      expect(report.migrations.isComplete).toBe(true);
    });
  });
});
