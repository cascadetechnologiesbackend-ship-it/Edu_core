import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dispatchWebPush, isWebPushConfigured } from "../webPushDispatcher";
import webpush from "web-push";

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}));

describe("S25 Layer L1: Web Push Protocol Truth & Honest Dispatcher", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isWebPushConfigured", () => {
    it("returns false when VAPID keys are missing", () => {
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      expect(isWebPushConfigured()).toBe(false);
    });

    it("returns false when only public key is present", () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "dummy-pub-key";
      delete process.env.VAPID_PRIVATE_KEY;
      expect(isWebPushConfigured()).toBe(false);
    });

    it("returns true when both public and private keys are present", () => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-pub-key";
      process.env.VAPID_PRIVATE_KEY = "test-priv-key";
      expect(isWebPushConfigured()).toBe(true);
    });
  });

  describe("Unconfigured & Mock Behavior (Zero Simulated Fake-Success)", () => {
    it("returns SKIPPED_UNCONFIGURED with success: false when unconfigured and mock disabled", async () => {
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      delete process.env.ALLOW_MOCK_PUSH;

      const mockDb = {
        query: {
          userPushSubscriptions: {
            findMany: vi.fn().mockResolvedValue([
              {
                userId: "user-1",
                endpoint: "https://push.example.com/sub/1",
                p256dh: "key-p256dh",
                auth: "key-auth",
              },
            ]),
          },
        },
      };

      const results = await dispatchWebPush(
        "school-1",
        ["user-1", "user-2"],
        { title: "Test", body: "Hello" },
        mockDb as any
      );

      expect(results).toHaveLength(2);
      // user-1 has subscription but unconfigured -> SKIPPED_UNCONFIGURED
      const r1 = results.find((r) => r.userId === "user-1")!;
      expect(r1.subscriptionFound).toBe(true);
      expect(r1.success).toBe(false);
      expect(r1.status).toBe("SKIPPED_UNCONFIGURED");
      expect(r1.error).toContain("VAPID credentials not configured");

      // user-2 has no subscription -> SKIPPED_NO_SUBSCRIPTION
      const r2 = results.find((r) => r.userId === "user-2")!;
      expect(r2.subscriptionFound).toBe(false);
      expect(r2.success).toBe(true);
      expect(r2.status).toBe("SKIPPED_NO_SUBSCRIPTION");
    });

    it("allows simulated DELIVERED only when ALLOW_MOCK_PUSH=true in non-production", async () => {
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      (process.env as any).NODE_ENV = "test";
      process.env.ALLOW_MOCK_PUSH = "true";

      const mockDb = {
        query: {
          userPushSubscriptions: {
            findMany: vi.fn().mockResolvedValue([
              {
                userId: "user-1",
                endpoint: "https://push.example.com/sub/1",
                p256dh: "key-p256dh",
                auth: "key-auth",
              },
            ]),
          },
        },
      };

      const results = await dispatchWebPush(
        "school-1",
        ["user-1"],
        { title: "Test", body: "Hello" },
        mockDb as any
      );

      expect(results[0]!.status).toBe("DELIVERED");
      expect(results[0]!.success).toBe(true);
    });

    it("throws in production when mock push is attempted without ALLOW_MOCK_PUSH_IN_PROD=true", async () => {
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
      (process.env as any).NODE_ENV = "production";
      process.env.ALLOW_MOCK_PUSH = "true";
      delete process.env.ALLOW_MOCK_PUSH_IN_PROD;

      const mockDb = {
        query: {
          userPushSubscriptions: {
            findMany: vi.fn().mockResolvedValue([
              {
                userId: "user-1",
                endpoint: "https://push.example.com/sub/1",
                p256dh: "key-p256dh",
                auth: "key-auth",
              },
            ]),
          },
        },
      };

      await expect(
        dispatchWebPush(
          "school-1",
          ["user-1"],
          { title: "Test", body: "Hello" },
          mockDb as any
        )
      ).rejects.toThrow("FATAL: ALLOW_MOCK_PUSH is enabled in production");
    });
  });

  describe("Live Protocol Dispatch via web-push", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
      process.env.VAPID_PRIVATE_KEY = "test-private-key";
      process.env.VAPID_SUBJECT = "mailto:admin@schoolmitra.test";
      delete process.env.ALLOW_MOCK_PUSH;
    });

    it("dispatches using webpush.sendNotification and returns DELIVERED on success", async () => {
      const mockSend = vi.mocked(webpush.sendNotification).mockResolvedValue({
        statusCode: 201,
        body: "",
        headers: {},
      } as any);

      const mockDb = {
        query: {
          userPushSubscriptions: {
            findMany: vi.fn().mockResolvedValue([
              {
                userId: "user-1",
                endpoint: "https://fcm.googleapis.com/fcm/send/token123",
                p256dh: "p256dh-data",
                auth: "auth-data",
              },
            ]),
          },
        },
      };

      const results = await dispatchWebPush(
        "school-1",
        ["user-1"],
        { title: "Exam Published", body: "Check report card" },
        mockDb as any
      );

      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        "mailto:admin@schoolmitra.test",
        "test-public-key",
        "test-private-key"
      );

      expect(mockSend).toHaveBeenCalledWith(
        {
          endpoint: "https://fcm.googleapis.com/fcm/send/token123",
          keys: {
            p256dh: "p256dh-data",
            auth: "auth-data",
          },
        },
        JSON.stringify({
          title: "Exam Published",
          body: "Check report card",
          icon: "/icons/icon-192x192.png",
          tag: "schoolmitra-notification",
          data: {},
        }),
        {
          TTL: 86400,
          urgency: "normal",
        }
      );

      expect(results[0]!.status).toBe("DELIVERED");
      expect(results[0]!.success).toBe(true);
    });

    it("prunes subscription on HTTP 410 or 404 (Gone / Expired)", async () => {
      const error410: any = new Error("Subscription expired");
      error410.statusCode = 410;
      vi.mocked(webpush.sendNotification).mockRejectedValue(error410);

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      });

      const mockDb = {
        query: {
          userPushSubscriptions: {
            findMany: vi.fn().mockResolvedValue([
              {
                userId: "user-dead",
                endpoint: "https://updates.push.services.mozilla.com/wpush/v2/dead-endpoint",
                p256dh: "p256dh-dead",
                auth: "auth-dead",
              },
            ]),
          },
        },
        delete: mockDelete,
      };

      const results = await dispatchWebPush(
        "school-1",
        ["user-dead"],
        { title: "Notice", body: "Hello" },
        mockDb as any
      );

      expect(mockDelete).toHaveBeenCalled();
      expect(results[0]!.status).toBe("FAILED");
      expect(results[0]!.success).toBe(false);
      expect(results[0]!.error).toContain("410");
      expect(results[0]!.error).toContain("pruned");
    });

    it("records FAILED without pruning on transient HTTP 500 error", async () => {
      const error500: any = new Error("Push server internal error");
      error500.statusCode = 500;
      vi.mocked(webpush.sendNotification).mockRejectedValue(error500);

      const mockDelete = vi.fn();
      const mockDb = {
        query: {
          userPushSubscriptions: {
            findMany: vi.fn().mockResolvedValue([
              {
                userId: "user-server-error",
                endpoint: "https://fcm.googleapis.com/fcm/send/retry",
                p256dh: "p256dh",
                auth: "auth",
              },
            ]),
          },
        },
        delete: mockDelete,
      };

      const results = await dispatchWebPush(
        "school-1",
        ["user-server-error"],
        { title: "Notice", body: "Hello" },
        mockDb as any
      );

      expect(mockDelete).not.toHaveBeenCalled();
      expect(results[0]!.status).toBe("FAILED");
      expect(results[0]!.success).toBe(false);
      expect(results[0]!.error).toContain("500");
    });
  });
});
