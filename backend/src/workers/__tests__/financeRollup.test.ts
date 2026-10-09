import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeFinanceRollups } from "../financeAutomation";
import { getCachedFinanceData, _resetFinanceMemoryCache } from "@/lib/financeCache";
import { db } from "@/db";

describe("Finance Automation Rollup Worker (PF-R91)", () => {
  const schoolId = "test-school-rollups-123";

  beforeEach(() => {
    _resetFinanceMemoryCache();
    vi.restoreAllMocks();
  });

  it("pre-aggregates mode breakdown and today collections into S2 cache", async () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);

    const mockPayments = [
      {
        id: "p1",
        amountPaid: "1000.00",
        paymentMethod: "UPI",
        paymentDate: today,
      },
      {
        id: "p2",
        amountPaid: "2500.00",
        paymentMethod: "CASH",
        paymentDate: today,
      },
      {
        id: "p3",
        amountPaid: "5000.00",
        paymentMethod: "ONLINE",
        paymentDate: yesterday,
      },
    ];

    vi.spyOn(db.query.feePayments, "findMany").mockResolvedValue(mockPayments as any);

    const result = await computeFinanceRollups(schoolId);

    expect(result.success).toBe(true);
    expect(result.rollups.todayCollected).toBe(3500); // 1000 + 2500
    expect(result.rollups.todayPaymentsCount).toBe(2);
    expect(result.rollups.totalPaymentsAllTime).toBe(8500);

    // Verify mode breakdown
    expect(result.rollups.modeBreakdown).toEqual([
      { mode: "ONLINE", amount: 5000, percentage: 59 },
      { mode: "CASH", amount: 2500, percentage: 29 },
      { mode: "UPI", amount: 1000, percentage: 12 },
    ]);

    // Verify S2 cached value can be retrieved by Hub reads
    const cached = await getCachedFinanceData<typeof result.rollups>(schoolId, "rollups_daily");
    expect(cached).not.toBeNull();
    expect(cached?.todayCollected).toBe(3500);
    expect(cached?.modeBreakdown).toHaveLength(3);
  });
});
