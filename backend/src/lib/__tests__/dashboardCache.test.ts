import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getDashboardCacheKey,
  computeJitteredTtlSeconds,
  getCachedDashboardSummary,
  setCachedDashboardSummary,
  invalidateDashboardCache,
  _resetMemoryCache,
} from "../dashboardCache";

describe("S2 Dashboard Cache Engine (PF-R80 & Cross-Tenant Isolation)", () => {
  beforeEach(() => {
    _resetMemoryCache();
  });

  it("constructs strictly tenant-isolated cache keys with t:{schoolId}:v1:... format", () => {
    const keyA = getDashboardCacheKey("018f2b74-school-1");
    const keyB = getDashboardCacheKey("018f2b74-school-2");

    expect(keyA).toBe("t:018f2b74-school-1:v1:dashboard_summary");
    expect(keyB).toBe("t:018f2b74-school-2:v1:dashboard_summary");
    expect(keyA).not.toBe(keyB);
  });

  it("throws when empty or invalid schoolId is passed", () => {
    expect(() => getDashboardCacheKey("")).toThrow();
    expect(() => getDashboardCacheKey("   ")).toThrow();
  });

  it("produces jittered TTL within the 270s - 330s range (5m +/- 30s)", () => {
    for (let i = 0; i < 50; i++) {
      const ttl = computeJitteredTtlSeconds(300, 60);
      expect(ttl).toBeGreaterThanOrEqual(270);
      expect(ttl).toBeLessThanOrEqual(330);
    }
  });

  it("prevents cross-tenant poisoning: school A cannot access school B's cached summary", async () => {
    const schoolA = "tenant-alpha";
    const schoolB = "tenant-beta";

    const dataA = { totalEnrolment: 450, todayAttendance: "94%" };
    const dataB = { totalEnrolment: 820, todayAttendance: "88%" };

    await setCachedDashboardSummary(schoolA, dataA);
    await setCachedDashboardSummary(schoolB, dataB);

    const fetchedA = await getCachedDashboardSummary<typeof dataA>(schoolA);
    const fetchedB = await getCachedDashboardSummary<typeof dataB>(schoolB);

    expect(fetchedA).toEqual(dataA);
    expect(fetchedB).toEqual(dataB);
    expect(fetchedA?.totalEnrolment).not.toEqual(fetchedB?.totalEnrolment);
  });

  it("invalidates only target tenant cache on write without cross-tenant side effects", async () => {
    const schoolA = "tenant-alpha";
    const schoolB = "tenant-beta";

    await setCachedDashboardSummary(schoolA, { count: 10 });
    await setCachedDashboardSummary(schoolB, { count: 20 });

    // Mutate and invalidate School A
    await invalidateDashboardCache(schoolA);

    const cachedA = await getCachedDashboardSummary(schoolA);
    const cachedB = await getCachedDashboardSummary(schoolB);

    expect(cachedA).toBeNull();
    expect(cachedB).toEqual({ count: 20 });
  });

  it("handles cache expiration cleanly in memory", async () => {
    const schoolId = "tenant-expiring";
    await setCachedDashboardSummary(schoolId, { val: "temporary" });

    // Fast-forward time
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 120_000); // +2 minutes

    const cached = await getCachedDashboardSummary(schoolId);
    expect(cached).toBeNull();

    vi.restoreAllMocks();
  });
});
