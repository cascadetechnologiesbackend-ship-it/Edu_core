import { describe, it, expect, beforeEach } from "vitest";
import {
  recordRouteTiming,
  startRouteTimer,
  measureDataPhase,
  getRouteTimingPercentiles,
  getRouteTimingReport,
  resetRouteTimings,
  formatServerTimingHeader,
  TARGET_DATA_PHASE_P95_MS,
} from "../serverTiming";

describe("Route-Level Server Timing (Spec 5.0.0 / 6.0.0 & PF-R00)", () => {
  beforeEach(() => {
    resetRouteTimings();
  });

  it("records timing metrics with correct PASS status when under 500ms target", () => {
    const record = recordRouteTiming("/dashboard", "data_phase", 145.2);
    expect(record.route).toBe("/dashboard");
    expect(record.operation).toBe("data_phase");
    expect(record.durationMs).toBe(145.2);
    expect(record.status).toBe("PASS");
  });

  it("flags WARN status when timing exceeds 500ms target SLA", () => {
    const record = recordRouteTiming("/school/accounting/reports", "ledger_rollup", 720.5);
    expect(record.status).toBe("WARN");
  });

  it("measures async data phase accurately using measureDataPhase", async () => {
    const result = await measureDataPhase(
      "/school/collect-fees",
      "student_lookup",
      async () => {
        return { studentId: "s-101", balance: 5000 };
      },
      { schoolId: "sch_01" }
    );

    expect(result.studentId).toBe("s-101");
    const stats = getRouteTimingPercentiles("/school/collect-fees");
    expect(stats).not.toBeNull();
    expect(stats?.count).toBe(1);
    expect(stats?.status).toBe("PASS");
  });

  it("computes accurate p50, p75, p95, p99 percentiles across multiple requests", () => {
    const sampleLatencies = [50, 80, 100, 120, 150, 180, 200, 250, 300, 480];
    sampleLatencies.forEach((lat) => {
      recordRouteTiming("/attendance", "batch_roster", lat);
    });

    const stats = getRouteTimingPercentiles("/attendance");
    expect(stats).not.toBeNull();
    expect(stats?.count).toBe(10);
    expect(stats?.min).toBe(50);
    expect(stats?.max).toBe(480);
    expect(stats?.p50).toBe(150);
    expect(stats?.p95).toBe(480);
    expect(stats?.status).toBe("PASS");
  });

  it("getRouteTimingReport aggregates all monitored routes", () => {
    recordRouteTiming("/dashboard", "ssr_load", 110);
    recordRouteTiming("/students", "grid_search", 190);
    recordRouteTiming("/exams", "marks_entry", 220);

    const report = getRouteTimingReport();
    expect(Object.keys(report)).toContain("/dashboard");
    expect(Object.keys(report)).toContain("/students");
    expect(Object.keys(report)).toContain("/exams");
    expect(report["/dashboard"]?.count).toBe(1);
  });

  it("formats W3C Server-Timing headers correctly", () => {
    const header = formatServerTimingHeader({
      auth: 12.4,
      db: { dur: 45.8, desc: "Database Query" },
    });

    expect(header).toContain("auth;dur=12.4");
    expect(header).toContain('db;dur=45.8;desc="Database Query"');
  });
});
