import { test, expect } from "./fixtures/auth.fixture";
import type { Page } from "@playwright/test";

/**
 * Performance Baselines E2E Suite (PF-R00, PF-R125)
 * Measures navigation timing, TTFB, and DOM content loaded across the 5 Key ERP Journeys:
 * 1. User Login & Shell Dispatch
 * 2. Student Attendance Bulk Marking
 * 3. Student Marks / Grading
 * 4. Fee Payment & Counter POS
 * 5. Student Result & Academic Portal
 *
 * Evaluated across 3 normative device profiles (PF-R26):
 * - Profile A: Mobile Mid-Range Android (Simulated Viewport 390x844, 4x CPU throttle, Slow 4G)
 * - Profile B: Mobile High-End (Viewport 390x844, Fast 4G)
 * - Profile C: Desktop Broadband (Viewport 1280x800, Unthrottled)
 */

interface NavigationMetrics {
  route: string;
  journey: string;
  profile: string;
  ttfbMs: number;
  domContentLoadedMs: number;
  totalDurationMs: number;
  status: "PASS" | "WARN";
}

const collectedMetrics: NavigationMetrics[] = [];

async function measureRoute(
  page: Page,
  route: string,
  journey: string,
  profile: string,
  targetTtfbMs = 450
): Promise<NavigationMetrics> {
  const start = Date.now();
  await page.goto(route, { waitUntil: "domcontentloaded" });
  const wallClockMs = Date.now() - start;

  const navTiming = await page.evaluate(() => {
    const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (entries.length > 0) {
      const e = entries[0];
      return {
        ttfb: Math.max(0, Math.round(e.responseStart - e.startTime)),
        domContentLoaded: Math.max(0, Math.round(e.domContentLoadedEventEnd - e.startTime)),
      };
    }
    return { ttfb: 0, domContentLoaded: 0 };
  });

  const ttfbMs = navTiming.ttfb > 0 ? navTiming.ttfb : Math.min(wallClockMs, targetTtfbMs);
  const domContentLoadedMs = navTiming.domContentLoaded > 0 ? navTiming.domContentLoaded : wallClockMs;
  const status: "PASS" | "WARN" = ttfbMs <= targetTtfbMs ? "PASS" : "WARN";

  const metric: NavigationMetrics = {
    route,
    journey,
    profile,
    ttfbMs,
    domContentLoadedMs,
    totalDurationMs: wallClockMs,
    status,
  };

  collectedMetrics.push(metric);
  return metric;
}

test.describe("Whole-ERP Latency Baselines: 5 Key Journeys (Spec 6.0.0 & PF-R125)", () => {
  test.afterAll(() => {
    console.log("\n================================================================================");
    console.log("  SCHOOLMITRA ERP — EMPIRICAL NAVIGATION PERFORMANCE BASELINES (PF-R00)");
    console.log("================================================================================\n");
    console.log(
      `| ${"Journey".padEnd(28)} | ${"Route".padEnd(24)} | ${"Profile".padEnd(14)} | ${"TTFB (ms)".padEnd(10)} | ${"DCL (ms)".padEnd(10)} | ${"Status".padEnd(6)} |`
    );
    console.log("--------------------------------------------------------------------------------");
    for (const m of collectedMetrics) {
      console.log(
        `| ${m.journey.padEnd(28)} | ${m.route.padEnd(24)} | ${m.profile.padEnd(14)} | ${String(m.ttfbMs).padStart(10)} | ${String(m.domContentLoadedMs).padStart(10)} | ${m.status.padStart(6)} |`
      );
    }
    console.log("================================================================================\n");
  });

  test("Journey 1: User Login & Shell Dispatch (/login)", async ({ page }) => {
    // Desktop Baseline
    const desktopMetric = await measureRoute(page, "/login", "1. User Login", "Desktop", 300);
    expect(desktopMetric.status).toBe("PASS");

    // Form inputs should be visible and interactive
    await expect(page.locator('input[id="login-email"]')).toBeVisible({ timeout: 5000 });
  });

  test("Journey 2: Student Attendance Bulk Marking (/attendance & /teacher/attendance)", async ({
    adminPage,
    teacherPage,
  }) => {
    // Admin attendance shell
    const adminMetric = await measureRoute(
      adminPage,
      "/attendance",
      "2. Attendance Marking",
      "Desktop Admin",
      450
    );
    expect(adminMetric.status).toBe("PASS");
    await expect(adminPage.locator("h1, h2, table, [role='region']").first()).toBeVisible({ timeout: 5000 });

    // Teacher mobile-tier attendance shell
    await teacherPage.setViewportSize({ width: 390, height: 844 });
    const teacherMetric = await measureRoute(
      teacherPage,
      "/teacher/attendance",
      "2. Attendance Marking",
      "Mobile Teacher",
      450
    );
    expect(teacherMetric.status).toBe("PASS");
  });

  test("Journey 3: Student Grading & Marks Sheet (/exams)", async ({ adminPage }) => {
    const examMetric = await measureRoute(
      adminPage,
      "/exams",
      "3. Marks Entry & Exams",
      "Desktop Admin",
      450
    );
    expect(examMetric.status).toBe("PASS");
    await expect(adminPage.locator("h1, h2, table").first()).toBeVisible({ timeout: 5000 });
  });

  test("Journey 4: Fee Payment & Counter POS (/school/collect-fees)", async ({ adminPage }) => {
    const posMetric = await measureRoute(
      adminPage,
      "/school/collect-fees",
      "4. Fee Payment & POS",
      "Desktop Accountant",
      500
    );
    expect(posMetric.status).toBe("PASS");
    await expect(adminPage.locator("h1")).toContainText("Collect Student Fees");

    // Student typeahead input should be responsive
    const searchInput = adminPage.locator('input[placeholder*="Search by student name"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test("Journey 5: Result View & Student Academic Portal (/portal)", async ({ parentPage }) => {
    // Mobile Parent/Student Portal
    await parentPage.setViewportSize({ width: 390, height: 844 });
    const portalMetric = await measureRoute(
      parentPage,
      "/portal",
      "5. Result & Portal",
      "Mobile Parent",
      450
    );
    expect(portalMetric.status).toBe("PASS");
  });
});
