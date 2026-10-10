import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../subscribe/route";
import { NextRequest } from "next/server";

// Mock dependencies
const mockGetCachedSession = vi.fn();
vi.mock("@/lib/serverAuth", () => ({
  getCachedSession: () => mockGetCachedSession(),
}));

const mockInsertValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: (...args: any[]) => {
        mockInsertValues(...args);
        return {
          onConflictDoUpdate: mockOnConflictDoUpdate,
        };
      },
    })),
  },
}));

describe("POST /api/push/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnConflictDoUpdate.mockResolvedValue({});
  });

  const validPayload = {
    endpoint: "https://fcm.googleapis.com/fcm/send/sample-token-123",
    keys: {
      p256dh: "BM1234567890abcdefghijklmnopqrstuvwxyz",
      auth: "auth1234567890",
    },
  };

  it("returns 401 Unauthorized when session is missing", async () => {
    mockGetCachedSession.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3002/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 Bad Request when payload is malformed", async () => {
    mockGetCachedSession.mockResolvedValue({
      user: { id: "usr-123", role: "TEACHER", schoolId: "sch-456" },
    });

    const req = new NextRequest("http://localhost:3002/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "not-a-valid-url" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid subscription payload");
  });

  it("successfully persists subscription for regular tenant user (with schoolId)", async () => {
    mockGetCachedSession.mockResolvedValue({
      user: { id: "usr-teacher-1", role: "TEACHER", schoolId: "sch-abc-123" },
    });

    const req = new NextRequest("http://localhost:3002/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "user-agent": "Mozilla/5.0 TestBrowser",
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "usr-teacher-1",
        schoolId: "sch-abc-123",
        endpoint: validPayload.endpoint,
        p256dh: validPayload.keys.p256dh,
        auth: validPayload.keys.auth,
        userAgent: "Mozilla/5.0 TestBrowser",
      })
    );
  });

  it("successfully persists subscription for SUPER_ADMIN (with schoolId: null)", async () => {
    // SUPER_ADMIN has no tenant schoolId
    mockGetCachedSession.mockResolvedValue({
      user: { id: "usr-superadmin-0", role: "SUPER_ADMIN", schoolId: null },
    });

    const req = new NextRequest("http://localhost:3002/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "user-agent": "Mozilla/5.0 AdminDevice",
      },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "usr-superadmin-0",
        schoolId: null,
        endpoint: validPayload.endpoint,
        p256dh: validPayload.keys.p256dh,
        auth: validPayload.keys.auth,
        userAgent: "Mozilla/5.0 AdminDevice",
      })
    );
  });
});
