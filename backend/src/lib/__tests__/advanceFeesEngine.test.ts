import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordAdvancePayment,
  allocateAdvanceToInvoices,
  refundAdvancePayment,
  getStudentAdvanceBalance,
} from "../advanceFeesEngine";

vi.mock("../chartOfAccountsEngine", () => ({
  assertAcademicYearNotLocked: vi.fn().mockResolvedValue(undefined),
  getStudentFeeAdvancesChartAccountId: vi.fn().mockResolvedValue("coa-2110-advances"),
  getStudentReceivableChartAccountId: vi.fn().mockResolvedValue("coa-1200-receivable"),
  getBankAccountChartAccountId: vi.fn().mockResolvedValue("coa-1010-bank"),
  getCashMainChartAccountId: vi.fn().mockResolvedValue("coa-1000-cash"),
}));

vi.mock("../auditLogger", () => ({
  logFeeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("Phase B1 AZ-05: Student Fee Advances Engine & Double-Entry Invariants", () => {
  const schoolId = "school-test-uuid";
  const studentId = "student-test-uuid";
  const bankAccountId = "bank-test-uuid";

  let insertedLedgerTx: any[] = [];
  let insertedAdvances: any[] = [];
  let insertedAllocations: any[] = [];
  let updatedInvoices: any[] = [];
  let updatedAdvances: any[] = [];

  let mockClient: any;

  beforeEach(() => {
    insertedLedgerTx = [];
    insertedAdvances = [];
    insertedAllocations = [];
    updatedInvoices = [];
    updatedAdvances = [];

    mockClient = {
      transaction: vi.fn(async (cb: any) => cb(mockClient)),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: vals.id || "gen-uuid-1",
              ...vals,
            },
          ]),
        })),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((setVals: any) => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ ...setVals }]),
          })),
        })),
      })),
      query: {
        studentFeeAdvances: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        feeInvoices: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
        bankAccounts: {
          findFirst: vi.fn().mockResolvedValue({ id: bankAccountId, currentBalance: "50000.00" }),
        },
      },
    };
  });

  describe("1. recordAdvancePayment (Advance Receipt)", () => {
    it("posts advance receipt crediting Student Fee Advances (2110) liability and debiting bank", async () => {
      mockClient.insert = vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          if (vals.advanceNumber) {
            insertedAdvances.push(vals);
          } else if (vals.transactionNumber) {
            insertedLedgerTx.push(vals);
          }
          return {
            returning: vi.fn().mockResolvedValue([{ id: "adv-uuid-01", ...vals }]),
          };
        }),
      }));

      const advance = await recordAdvancePayment(
        {
          schoolId,
          studentId,
          amount: 15000.0,
          paymentMethod: "ONLINE",
          bankAccountId,
          remarks: "Advance for upcoming terms",
        },
        mockClient
      );

      expect(advance).toBeDefined();
      expect(insertedAdvances.length).toBe(1);
      expect(insertedAdvances[0].amount).toBe("15000.00");
      expect(insertedAdvances[0].balanceAmount).toBe("15000.00");
      expect(insertedAdvances[0].allocatedAmount).toBe("0.00");
      expect(insertedAdvances[0].status).toBe("UNALLOCATED");

      // Verify double-entry GL ledger transaction
      expect(insertedLedgerTx.length).toBe(1);
      const glTx = insertedLedgerTx[0];
      expect(glTx.debitAccountId).toBe("coa-1010-bank");
      expect(glTx.creditAccountId).toBe("coa-2110-advances");
      expect(glTx.amount).toBe("15000.00");
      expect(glTx.description).toContain("Advance Fee Collection");
    });

    it("rejects non-positive advance amount", async () => {
      await expect(
        recordAdvancePayment(
          {
            schoolId,
            studentId,
            amount: 0,
          },
          mockClient
        )
      ).rejects.toThrow("Advance payment amount must be greater than zero.");
    });
  });

  describe("2. allocateAdvanceToInvoices & AM-02 Mathematical Invariant", () => {
    it("auto-allocates advance to oldest unpaid invoices and posts Dr Advances (2110) Cr Receivable (1200)", async () => {
      const mockAdvance = {
        id: "adv-uuid-10",
        schoolId,
        studentId,
        advanceNumber: "ADV-2026-0001",
        amount: "10000.00",
        allocatedAmount: "0.00",
        balanceAmount: "10000.00",
        status: "UNALLOCATED",
      };

      const mockInvoices = [
        {
          id: "inv-oldest",
          schoolId,
          studentId,
          invoiceNumber: "INV-001",
          dueDate: new Date("2026-04-10"),
          paidAmount: "0.00",
          balanceAmount: "6000.00",
          status: "PENDING",
        },
        {
          id: "inv-next",
          schoolId,
          studentId,
          invoiceNumber: "INV-002",
          dueDate: new Date("2026-05-10"),
          paidAmount: "0.00",
          balanceAmount: "8000.00",
          status: "PENDING",
        },
      ];

      mockClient.query.studentFeeAdvances.findMany.mockResolvedValue([mockAdvance]);
      mockClient.query.feeInvoices.findMany.mockResolvedValue(mockInvoices);

      mockClient.insert = vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          if (vals.advanceId && vals.feeInvoiceId) {
            insertedAllocations.push(vals);
          } else if (vals.transactionNumber) {
            insertedLedgerTx.push(vals);
          }
          return {
            returning: vi.fn().mockResolvedValue([{ id: "alc-uuid", ...vals }]),
          };
        }),
      }));

      mockClient.update = vi.fn((table: any) => ({
        set: vi.fn((setVals: any) => {
          if (setVals.paidAmount !== undefined) {
            updatedInvoices.push(setVals);
          } else if (setVals.allocatedAmount !== undefined) {
            updatedAdvances.push(setVals);
          }
          return {
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{ ...setVals }]),
            })),
          };
        }),
      }));

      const result = await allocateAdvanceToInvoices(
        { schoolId, studentId, advanceId: mockAdvance.id },
        mockClient
      );

      expect(result.success).toBe(true);
      expect(result.allocatedCount).toBe(2);
      expect(result.totalAllocated).toBe(10000.0);

      // Invoice 1 (6,000) was fully paid
      expect(updatedInvoices[0].paidAmount).toBe("6000.00");
      expect(updatedInvoices[0].balanceAmount).toBe("0.00");
      expect(updatedInvoices[0].status).toBe("PAID");

      // Invoice 2 (8,000) was partially paid with remaining 4,000
      expect(updatedInvoices[1].paidAmount).toBe("4000.00");
      expect(updatedInvoices[1].balanceAmount).toBe("4000.00");
      expect(updatedInvoices[1].status).toBe("PARTIAL");

      // Double-entry entries: Dr Student Fee Advances (2110), Cr Student Receivable (1200)
      expect(insertedLedgerTx.length).toBe(2);
      expect(insertedLedgerTx[0].debitAccountId).toBe("coa-2110-advances");
      expect(insertedLedgerTx[0].creditAccountId).toBe("coa-1200-receivable");
      expect(insertedLedgerTx[0].amount).toBe("6000.00");

      expect(insertedLedgerTx[1].debitAccountId).toBe("coa-2110-advances");
      expect(insertedLedgerTx[1].creditAccountId).toBe("coa-1200-receivable");
      expect(insertedLedgerTx[1].amount).toBe("4000.00");

      // Advance updated to FULLY_ALLOCATED
      expect(updatedAdvances[0].allocatedAmount).toBe("10000.00");
      expect(updatedAdvances[0].balanceAmount).toBe("0.00");
      expect(updatedAdvances[0].status).toBe("FULLY_ALLOCATED");
    });

    it("AM-02 Invariant: throws immediately if sum(allocations) exceeds advance amount", async () => {
      // Corrupted state where balance claims 15,000 available on a 10,000 advance
      const corruptedAdvance = {
        id: "adv-corrupt",
        schoolId,
        studentId,
        advanceNumber: "ADV-ERR-001",
        amount: "10000.00",
        allocatedAmount: "6000.00",
        balanceAmount: "8000.00", // sum would be 14000 > 10000!
        status: "PARTIALLY_ALLOCATED",
      };

      const mockInvoices = [
        {
          id: "inv-1",
          schoolId,
          studentId,
          invoiceNumber: "INV-100",
          dueDate: new Date(),
          paidAmount: "0.00",
          balanceAmount: "5000.00",
          status: "PENDING",
        },
      ];

      mockClient.query.studentFeeAdvances.findMany.mockResolvedValue([corruptedAdvance]);
      mockClient.query.feeInvoices.findMany.mockResolvedValue(mockInvoices);

      await expect(
        allocateAdvanceToInvoices(
          { schoolId, studentId, advanceId: corruptedAdvance.id },
          mockClient
        )
      ).rejects.toThrow(/Mathematical Invariant Violation: sum\(allocations\)/);
    });
  });

  describe("3. refundAdvancePayment", () => {
    it("refunds unallocated advance posting Dr Advances (2110) Cr Bank/Cash", async () => {
      const mockAdvance = {
        id: "adv-refund-01",
        schoolId,
        studentId,
        advanceNumber: "ADV-2026-9999",
        amount: "10000.00",
        allocatedAmount: "4000.00",
        balanceAmount: "6000.00",
        status: "PARTIALLY_ALLOCATED",
      };

      mockClient.query.studentFeeAdvances.findFirst.mockResolvedValue(mockAdvance);

      mockClient.insert = vi.fn(() => ({
        values: vi.fn((vals: any) => {
          insertedLedgerTx.push(vals);
          return Promise.resolve();
        }),
      }));

      mockClient.update = vi.fn(() => ({
        set: vi.fn((setVals: any) => {
          updatedAdvances.push(setVals);
          return {
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{ ...mockAdvance, ...setVals }]),
            })),
          };
        }),
      }));

      const res = await refundAdvancePayment(
        {
          schoolId,
          advanceId: mockAdvance.id,
          refundAmount: 6000.0,
          reason: "Student transferred to another school",
          bankAccountId,
        },
        mockClient
      );

      expect(res).toBeDefined();
      expect(insertedLedgerTx.length).toBe(1);
      const glTx = insertedLedgerTx[0];
      expect(glTx.debitAccountId).toBe("coa-2110-advances");
      expect(glTx.creditAccountId).toBe("coa-1010-bank");
      expect(glTx.amount).toBe("6000.00");

      expect(res.balanceAmount).toBe("0.00");
      expect(res.status).toBe("REFUNDED");
    });

    it("rejects refund amount exceeding remaining unallocated advance balance", async () => {
      const mockAdvance = {
        id: "adv-refund-02",
        schoolId,
        studentId,
        advanceNumber: "ADV-2026-8888",
        amount: "5000.00",
        allocatedAmount: "3000.00",
        balanceAmount: "2000.00",
        status: "PARTIALLY_ALLOCATED",
      };

      mockClient.query.studentFeeAdvances.findFirst.mockResolvedValue(mockAdvance);

      await expect(
        refundAdvancePayment(
          {
            schoolId,
            advanceId: mockAdvance.id,
            refundAmount: 3000.0, // exceeds 2000.00!
            reason: "Excess refund test",
          },
          mockClient
        )
      ).rejects.toThrow(/exceeds available unallocated advance balance/);
    });
  });

  describe("4. getStudentAdvanceBalance", () => {
    it("aggregates active unallocated advance balances accurately", async () => {
      mockClient.query.studentFeeAdvances.findMany.mockResolvedValue([
        { id: "a1", balanceAmount: "4500.50" },
        { id: "a2", balanceAmount: "1250.25" },
      ]);

      const balance = await getStudentAdvanceBalance(schoolId, studentId, mockClient);
      expect(balance.creditBalance).toBe(5750.75);
      expect(balance.count).toBe(2);
    });
  });
});
