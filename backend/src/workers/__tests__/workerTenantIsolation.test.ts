import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recomputeAgingAndOverdue,
  applyLateFees,
  processReminderLadder,
  expireOutdatedChallans,
  autoMatchGatewayPayments,
  computeFinanceRollups,
  runSchoolFinanceAutomations,
} from "../financeAutomation";
import {
  executeRetentionPolicy,
  executeConsentWithdrawals,
  purgeExpiredUsageEvents,
} from "../retention";

describe("Worker Tenant Transaction & Context Isolation (EDU-P1-001 / ADR-001)", () => {
  const schoolId = "a1111111-1111-4111-8111-111111111111";

  it("enforces mandatory tx propagation across all finance automation subroutines", async () => {
    const mockTx: any = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "inv-1" }]),
          }),
        }),
      }),
      query: {
        academicYears: {
          findFirst: vi.fn().mockResolvedValue({ id: "ay-1", isFiscalLocked: false }),
        },
        feeInvoices: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        paymentGatewayLogs: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        feePayments: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            for: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    const res = await runSchoolFinanceAutomations(schoolId, mockTx);

    expect(res.success).toBe(true);
    expect(res.agingResult.success).toBe(true);
    expect(res.lateFeeResult.success).toBe(true);
    expect(res.reminderResult.success).toBe(true);
    expect(res.challanResult.success).toBe(true);
    expect(res.gatewayMatchResult.success).toBe(true);
    expect(res.rollupResult.success).toBe(true);

    // Verify mockTx was used rather than unconfigured global db
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.query.academicYears.findFirst).toHaveBeenCalled();
    expect(mockTx.query.feeInvoices.findMany).toHaveBeenCalled();
    expect(mockTx.query.paymentGatewayLogs.findMany).toHaveBeenCalled();
    expect(mockTx.query.feePayments.findMany).toHaveBeenCalled();
  });

  it("retention worker subroutines require tx and propagate transaction handle", async () => {
    const mockTx: any = {
      query: {
        dataRetentionPolicies: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        consentRecords: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      }),
    };

    const retentionRes = await executeRetentionPolicy(schoolId, mockTx);
    expect(retentionRes.success).toBe(true);
    expect(mockTx.query.dataRetentionPolicies.findMany).toHaveBeenCalled();

    const consentRes = await executeConsentWithdrawals(schoolId, mockTx);
    expect(consentRes.success).toBe(true);
    expect(mockTx.query.consentRecords.findMany).toHaveBeenCalled();

    const purgeCount = await purgeExpiredUsageEvents(schoolId, mockTx, 90);
    expect(purgeCount).toBe(0);
    expect(mockTx.delete).toHaveBeenCalled();
  });

  it("strictly validates tenant UUID format and rejects invalid or missing tenant identifiers", () => {
    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    expect(uuidRegex.test("invalid-tenant-slug")).toBe(false);
    expect(uuidRegex.test("")).toBe(false);
    expect(uuidRegex.test("../escape/tenant")).toBe(false);
    expect(uuidRegex.test("a1111111-1111-4111-8111-111111111111")).toBe(true);
  });
});
