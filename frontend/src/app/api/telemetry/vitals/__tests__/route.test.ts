import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "../route";
import { containsProhibitedPii, getFieldMetricStats, resetFieldMetrics } from "@/lib/webVitals";
import { NextRequest } from "next/server";

describe("Web Vitals Ingest API (/api/telemetry/vitals)", () => {
  beforeEach(() => {
    resetFieldMetrics();
  });

  const validBatch = {
    appVersion: "6.0.0",
    deviceTier: "mid" as const,
    connectionType: "4g",
    role: "TEACHER",
    schoolId: "018f2b74-1234-7000-8000-000000000001",
    metrics: [
      {
        id: "v1-100",
        name: "LCP" as const,
        value: 1420.5,
        route: "/teacher/attendance",
        timestamp: Date.now(),
      },
      {
        id: "v1-101",
        name: "TTFB" as const,
        value: 280.2,
        route: "/teacher/attendance",
        timestamp: Date.now(),
      },
      {
        id: "v1-102",
        name: "CLS" as const,
        value: 0.015,
        route: "/teacher/attendance",
        timestamp: Date.now(),
      },
    ],
  };

  it("successfully ingests valid Web Vitals batch payload", async () => {
    const req = new NextRequest("http://localhost:3002/api/telemetry/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBatch),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.count).toBe(3);

    // Verify stats were updated
    const lcpStats = getFieldMetricStats("/teacher/attendance", "LCP");
    expect(lcpStats).not.toBeNull();
    expect(lcpStats?.count).toBe(1);
    expect(lcpStats?.p75).toBe(1420.5);
  });

  it("returns 400 Bad Request when payload fails schema validation", async () => {
    const invalidPayload = {
      appVersion: "6.0.0",
      deviceTier: "invalid_tier", // not in enum
      metrics: [],
    };

    const req = new NextRequest("http://localhost:3002/api/telemetry/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Invalid web vitals payload");
  });

  it("enforces PF-R111: returns 422 when student identifiers are detected", async () => {
    const leakingPayload = {
      ...validBatch,
      metrics: [
        {
          id: "v1-bad",
          name: "LCP" as const,
          value: 1200,
          route: "/student",
          timestamp: Date.now(),
          attribution: { studentId: "std_leaked_id_12345" }, // PF-R111 VIOLATION
        },
      ],
    };

    const req = new NextRequest("http://localhost:3002/api/telemetry/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leakingPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const json = await res.json();
    expect(json.error).toContain("PF-R111");
  });

  it("containsProhibitedPii identifies various student PII keys", () => {
    expect(containsProhibitedPii({ studentId: "abc" })).toBe(true);
    expect(containsProhibitedPii({ student_id: "abc" })).toBe(true);
    expect(containsProhibitedPii({ aadhaar: "1234" })).toBe(true);
    expect(containsProhibitedPii({ studentName: "Rahul" })).toBe(true);
    expect(containsProhibitedPii({ schoolId: "sch_01", role: "ADMIN", route: "/dashboard" })).toBe(false);
  });

  it("accepts INP metric with interaction attribution (PF-R26)", async () => {
    const inpBatch = {
      ...validBatch,
      metrics: [
        {
          id: "v1-inp-1",
          name: "INP" as const,
          value: 78.5,
          route: "/dashboard",
          timestamp: Date.now(),
          attribution: {
            interactionTarget: "button#save-attendance",
            interactionType: "pointerdown",
          },
        },
      ],
    };

    const req = new NextRequest("http://localhost:3002/api/telemetry/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inpBatch),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const inpStats = getFieldMetricStats("/dashboard", "INP");
    expect(inpStats).not.toBeNull();
    expect(inpStats?.p75).toBe(78.5);
  });

  it("rejects legacy FID metric per performance rulebook (INP, never FID)", async () => {
    const fidBatch = {
      ...validBatch,
      metrics: [
        {
          id: "v1-fid-1",
          name: "FID", // Dropped from enum
          value: 12.0,
          route: "/dashboard",
          timestamp: Date.now(),
        },
      ],
    };

    const req = new NextRequest("http://localhost:3002/api/telemetry/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fidBatch),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid web vitals payload");
  });
});
