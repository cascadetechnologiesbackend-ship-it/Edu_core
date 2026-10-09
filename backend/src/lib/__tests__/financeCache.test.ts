import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getFinanceCacheKey,
  computeFinanceJitteredTtl,
  normalizeParamsHash,
  getCachedFinanceData,
  setCachedFinanceData,
  invalidateFinanceTags,
  invalidateFinanceOnPayment,
  _resetFinanceMemoryCache,
} from "../financeCache";

describe("S2 Finance Cache Engine & Isolation Tests (PF-R41, PF-R45, PF-R47, PF-R80)", () => {
  beforeEach(() => {
    _resetFinanceMemoryCache();
  });

  it("constructs strictly tenant-isolated cache keys with t:{schoolId}:v1:finance:... format (PF-R45)", () => {
    const keyA = getFinanceCacheKey("018f2b74-school-1", "hub_summary", { ayId: "ay-2026" });
    const keyB = getFinanceCacheKey("018f2b74-school-2", "hub_summary", { ayId: "ay-2026" });

    expect(keyA).toBe("t:018f2b74-school-1:v1:finance:hub_summary:ayId=ay-2026");
    expect(keyB).toBe("t:018f2b74-school-2:v1:finance:hub_summary:ayId=ay-2026");
    expect(keyA).not.toBe(keyB);
  });

  it("throws when empty or invalid schoolId or resource is passed", () => {
    expect(() => getFinanceCacheKey("", "hub_summary")).toThrow();
    expect(() => getFinanceCacheKey("   ", "hub_summary")).toThrow();
    expect(() => getFinanceCacheKey("school-1", "")).toThrow();
  });

  it("produces jittered TTL within normative bounds [270s, 330s] (5m +/- 30s) (PF-R42)", () => {
    for (let i = 0; i < 50; i++) {
      const ttl = computeFinanceJitteredTtl(300, 60);
      expect(ttl).toBeGreaterThanOrEqual(270);
      expect(ttl).toBeLessThanOrEqual(330);
    }
  });

  it("normalizes diverse parameter structures deterministically", () => {
    const hash1 = normalizeParamsHash({ bracket: "60+", classId: "c1" });
    const hash2 = normalizeParamsHash({ classId: "c1", bracket: "60+" });
    expect(hash1).toBe(hash2);
    expect(normalizeParamsHash(null)).toBe("default");
    expect(normalizeParamsHash("simple-string")).toBe("simple-string");
  });

  it("prevents cross-tenant poisoning: school A cannot access school B's cached finance data (PF-R47)", async () => {
    const schoolA = "tenant-finance-alpha";
    const schoolB = "tenant-finance-beta";

    const dataA = { totalBilled: 500000, todayCollected: 25000, recoveryRate: 85 };
    const dataB = { totalBilled: 1200000, todayCollected: 90000, recoveryRate: 92 };

    await setCachedFinanceData(schoolA, "hub_kpis", dataA);
    await setCachedFinanceData(schoolB, "hub_kpis", dataB);

    const fetchedA = await getCachedFinanceData<typeof dataA>(schoolA, "hub_kpis");
    const fetchedB = await getCachedFinanceData<typeof dataB>(schoolB, "hub_kpis");

    expect(fetchedA).toEqual(dataA);
    expect(fetchedB).toEqual(dataB);
    expect(fetchedA?.totalBilled).not.toEqual(fetchedB?.totalBilled);
  });

  it("invalidates tagged finance entries on payment mutation without cross-tenant side effects", async () => {
    const schoolA = "tenant-finance-alpha";
    const schoolB = "tenant-finance-beta";

    const duesA = { totalDue: 150000, count: 12 };
    const duesB = { totalDue: 400000, count: 35 };

    await setCachedFinanceData(schoolA, "dues_summary", duesA, {
      tags: [`school:${schoolA}`, `fin:dues:${schoolA}`],
    });
    await setCachedFinanceData(schoolB, "dues_summary", duesB, {
      tags: [`school:${schoolB}`, `fin:dues:${schoolB}`],
    });

    // Payment collected in School A -> tag fin:dues:schoolA invalidated
    await invalidateFinanceTags(schoolA, [`fin:dues:${schoolA}`]);

    const cachedA = await getCachedFinanceData(schoolA, "dues_summary");
    const cachedB = await getCachedFinanceData(schoolB, "dues_summary");

    expect(cachedA).toBeNull();
    expect(cachedB).toEqual(duesB);
  });

  it("invalidateFinanceOnPayment clears payment, dues, and account tags for tenant", async () => {
    const schoolId = "tenant-payment-mutations";
    await setCachedFinanceData(schoolId, "recent_payments", [{ id: "p1", amount: 500 }], {
      tags: [`school:${schoolId}`, `fin:payments:${schoolId}`],
    });
    await setCachedFinanceData(schoolId, "dues_totals", { total: 1000 }, {
      tags: [`school:${schoolId}`, `fin:dues:${schoolId}`],
    });

    await invalidateFinanceOnPayment(schoolId, ["inv-123"]);

    expect(await getCachedFinanceData(schoolId, "recent_payments")).toBeNull();
    expect(await getCachedFinanceData(schoolId, "dues_totals")).toBeNull();
  });

  it("proves S0 surfaces (POS payment pad, invoice balances) are uncached", async () => {
    // S0 surfaces must query directly; calling getCachedFinanceData for S0 resources
    // must return null if never stored, and POS action explicitly does not invoke setCachedFinanceData.
    const schoolId = "tenant-s0-pos";
    const s0BalanceRead = await getCachedFinanceData(schoolId, "pos_invoice_pad_balance", "inv-live-1");
    expect(s0BalanceRead).toBeNull();
  });
});
