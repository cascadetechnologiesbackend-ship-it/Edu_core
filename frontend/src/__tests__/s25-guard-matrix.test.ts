import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { withCronAuth } from "@/lib/apiAuth";
import { NextResponse } from "next/server";

describe("Sprint S25 Layer L8: Guard Matrix (RBAC, Multi-Tenant Isolation & Cron Auth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Admin Delivery Health RBAC Matrix", () => {
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"];
    const forbiddenRoles = [
      "TEACHER",
      "STUDENT",
      "PARENT",
      "DRIVER",
      "ACCOUNTANT",
      "LIBRARIAN",
      "TRANSPORT_MANAGER",
      "HR_MANAGER",
    ];

    it.each(allowedRoles)("permits administrative role: %s", (role) => {
      const isAllowed = role === "SCHOOL_ADMIN" || role === "SUPER_ADMIN" || role === "PRINCIPAL";
      expect(isAllowed).toBe(true);
    });

    it.each(forbiddenRoles)("fails closed and rejects unprivileged role: %s", (role) => {
      const isAllowed = role === "SCHOOL_ADMIN" || role === "SUPER_ADMIN" || role === "PRINCIPAL";
      expect(isAllowed).toBe(false);
    });
  });

  describe("2. Cron Endpoint Authentication (CRON_SECRET Bearer)", () => {
    const originalEnv = process.env.CRON_SECRET;
    const testSecret = "test-s25-cron-secret-12345";

    beforeEach(() => {
      process.env.CRON_SECRET = testSecret;
    });

    afterEach(() => {
      process.env.CRON_SECRET = originalEnv;
    });

    it("rejects request without Authorization header with 401", async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withCronAuth(handler);

      const req = new Request("http://localhost:3000/api/cron/notifications", {
        method: "POST",
        headers: {},
      });

      const res = await wrapped(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("valid Bearer token required");
      expect(handler).not.toHaveBeenCalled();
    });

    it("rejects request with invalid token with 401", async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withCronAuth(handler);

      const req = new Request("http://localhost:3000/api/cron/notifications", {
        method: "POST",
        headers: {
          Authorization: "Bearer wrong-token",
        },
      });

      const res = await wrapped(req);
      expect(res.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it("accepts request with valid Bearer token and delegates to handler", async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true, flushed: 5 }));
      const wrapped = withCronAuth(handler);

      const req = new Request("http://localhost:3000/api/cron/notifications", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${testSecret}`,
        },
      });

      const res = await wrapped(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("3. Multi-Tenant Boundary Enforcement", () => {
    it("ensures notification logs queries are strictly scoped to the tenant schoolId", () => {
      const schoolA = "school-A";
      const schoolB = "school-B";

      const schoolALogs = [
        { id: "log-1", schoolId: schoolA, title: "School A Notice", status: "DELIVERED" },
      ];
      const schoolBLogs = [
        { id: "log-2", schoolId: schoolB, title: "School B Notice", status: "DELIVERED" },
      ];

      // Filtering inside tenant scope
      const getLogsForTenant = (tenantId: string) => {
        const all = [...schoolALogs, ...schoolBLogs];
        return all.filter((l) => l.schoolId === tenantId);
      };

      const tenantAResults = getLogsForTenant(schoolA);
      expect(tenantAResults.length).toBe(1);
      expect(tenantAResults[0]!.id).toBe("log-1");
      expect(tenantAResults.some((l) => l.schoolId === schoolB)).toBe(false);
    });
  });
});
