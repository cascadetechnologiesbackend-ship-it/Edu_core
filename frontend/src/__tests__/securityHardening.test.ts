import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { GET as healthGet } from "@/app/api/health/route";
import { POST as uploadPost } from "@/app/api/upload/route";
import { db } from "@/db";
import { redis } from "@/lib/rateLimiter";

vi.mock("@/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

const { mockPing } = vi.hoisted(() => ({
  mockPing: vi.fn(),
}));

vi.mock("@/lib/rateLimiter", () => ({
  valkey: { ping: mockPing },
  redis: { ping: mockPing },
  checkRateLimit: vi.fn().mockResolvedValue(true),
  RATE_LIMITS: { LOGIN: { max: 10, windowMs: 60000 } },
}));

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    userId: "u-1",
    schoolId: "s-1",
    role: "SCHOOL_ADMIN",
  }),
}));

vi.mock("@/lib/storage", () => ({
  getPresignedUploadUrl: vi.fn().mockResolvedValue("https://s3.example/presigned"),
}));

describe("Security Hardening Regression Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("Stored XSS Sanitization (sanitizeHtml)", () => {
    it("strips script tags, event handlers, and javascript: URIs", () => {
      const payload =
        '<p>Holiday Notice</p><script>alert(1)</script><img src=x onerror="fetch(\'https://evil\')"><a href="javascript:alert(2)">Click</a><a href="https://school.edu">Safe</a>';
      const cleaned = sanitizeHtml(payload);

      expect(cleaned).not.toContain("<script");
      expect(cleaned).not.toContain("onerror");
      expect(cleaned).not.toContain("javascript:");
      expect(cleaned).toContain("Holiday Notice");
      expect(cleaned).toContain("https://school.edu");
    });

    it("strips dangerous svg/iframe payloads", () => {
      const payload = '<svg onload="alert(1)"><iframe src="https://evil.com"></iframe>Hello';
      const cleaned = sanitizeHtml(payload);

      expect(cleaned).not.toContain("<svg");
      expect(cleaned).not.toContain("<iframe");
      expect(cleaned).toContain("Hello");
    });
  });

  describe("/api/health Production Redaction (OWASP A05)", () => {
    it("redacts dbRole, commit, and raw DB errors in production for unauthenticated callers", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CRON_SECRET", "super-secret-cron-token");
      vi.mocked(db.execute).mockRejectedValueOnce(
        new Error("password authentication failed for postgresql://user:topsecret@neon.tech/db"),
      );
      vi.mocked(redis.ping).mockResolvedValueOnce("PONG" as any);

      const req = new Request("http://localhost:3000/api/health");
      const res = await healthGet(req);
      expect(res.status).toBe(503);

      const data = await res.json();
      expect(data.dbRole).toBeUndefined();
      expect(data.activeRole).toBeUndefined();
      expect(data.commit).toBeUndefined();
      expect(data.error).toBe("Database connectivity check failed");
      expect(JSON.stringify(data)).not.toContain("topsecret");
    });

    it("reveals diagnostics in production only when valid x-health-token is provided", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("CRON_SECRET", "super-secret-cron-token");
      vi.mocked(db.execute).mockResolvedValueOnce([{ db_user: "app_user", active_role: "schoolmitra_app" }] as any);
      vi.mocked(redis.ping).mockResolvedValueOnce("PONG" as any);

      const req = new Request("http://localhost:3000/api/health", {
        headers: { "x-health-token": "super-secret-cron-token" },
      });
      const res = await healthGet(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.dbRole).toBe("app_user");
      expect(data.activeRole).toBe("schoolmitra_app");
    });
  });

  describe("POST /api/upload Extension Allowlist", () => {
    it("rejects executable or HTML uploads before issuing presigned URLs", async () => {
      for (const badFile of ["evil.html", "xss.svg", "payload.js", "malware.exe"]) {
        const req = new Request("http://localhost:3000/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: badFile, contentType: "text/html" }),
        });
        const res = await uploadPost(req);
        expect(res.status).toBe(400);
      }
    });

    it("permits valid school document extensions", async () => {
      const req = new Request("http://localhost:3000/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "marksheet.pdf", contentType: "application/pdf" }),
      });
      const res = await uploadPost(req);
      expect(res.status).toBe(200);
    });
  });
});

