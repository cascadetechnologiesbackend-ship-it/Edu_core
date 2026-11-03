import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  flushQuietHoursNotifications,
  registerNotificationSchedulers,
  notificationQueue,
} from "../notificationQueueWorker";
import * as webPushDispatcher from "../../lib/webPushDispatcher";

vi.mock("../../lib/webPushDispatcher", () => ({
  dispatchWebPush: vi.fn(),
  isWebPushConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("../../lib/tenant", () => ({
  withTenant: vi.fn(async (_schoolId: string, fn: any) => fn()),
}));

describe("S25 Layer L4: Quiet-Hours Flush Truth & Payload Integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defers flush during quiet hours without dispatching or updating logs", async () => {
    const mockDb = {
      query: {
        pushNotificationLogs: {
          findMany: vi.fn(),
        },
      },
    };

    const res = await flushQuietHoursNotifications("school-1", mockDb as any, () => true);

    expect(res.flushedCount).toBe(0);
    expect(res.skippedQuietCount).toBe(1);
    expect(webPushDispatcher.dispatchWebPush).not.toHaveBeenCalled();
    expect(mockDb.query.pushNotificationLogs.findMany).not.toHaveBeenCalled();
  });

  it("groups by payload and dispatches distinct payloads to respective recipients (zero cross-recipient corruption)", async () => {
    // Two parents with different titles/bodies
    const deferredLogs = [
      {
        id: "log-alice",
        schoolId: "school-1",
        recipientUserId: "parent-alice",
        title: "Alice Update",
        body: "Alice report card available",
        status: "DEFERRED_QUIET_HOURS",
      },
      {
        id: "log-bob",
        schoolId: "school-1",
        recipientUserId: "parent-bob",
        title: "Bob Update",
        body: "Bob report card available",
        status: "DEFERRED_QUIET_HOURS",
      },
    ];

    // Mock dispatchWebPush: Alice delivered, Bob failed
    vi.mocked(webPushDispatcher.dispatchWebPush).mockImplementation(
      async (_schoolId: string, userIds: string[], payload: any) => {
        if (userIds.includes("parent-alice")) {
          return [{ userId: "parent-alice", subscriptionFound: true, success: true, status: "DELIVERED" }];
        }
        if (userIds.includes("parent-bob")) {
          return [{ userId: "parent-bob", subscriptionFound: true, success: false, status: "FAILED", error: "Endpoint 500" }];
        }
        return [];
      }
    );

    const updatedRows = new Map<string, any>();
    const mockUpdate = vi.fn().mockImplementation(() => ({
      set: vi.fn((vals: any) => ({
        where: vi.fn((cond: any) => {
          // Track update
          updatedRows.set(JSON.stringify(vals), cond);
          return Promise.resolve({ rowCount: 1 });
        }),
      })),
    }));

    const mockDb = {
      query: {
        pushNotificationLogs: {
          findMany: vi.fn().mockResolvedValue(deferredLogs),
        },
      },
      update: mockUpdate,
    };

    const res = await flushQuietHoursNotifications("school-1", mockDb as any, () => false);

    // Verify 2 separate dispatches were made with correct respective payloads
    expect(webPushDispatcher.dispatchWebPush).toHaveBeenCalledTimes(2);

    expect(webPushDispatcher.dispatchWebPush).toHaveBeenCalledWith(
      "school-1",
      ["parent-alice"],
      expect.objectContaining({ title: "Alice Update", body: "Alice report card available" }),
      expect.anything()
    );

    expect(webPushDispatcher.dispatchWebPush).toHaveBeenCalledWith(
      "school-1",
      ["parent-bob"],
      expect.objectContaining({ title: "Bob Update", body: "Bob report card available" }),
      expect.anything()
    );

    // Only 1 was successfully delivered
    expect(res.flushedCount).toBe(1);
    expect(res.skippedQuietCount).toBe(0);
  });

  it("registerNotificationSchedulers registers BullMQ repeatable jobs for flush and drain", async () => {
    const queueSpy = vi.spyOn(notificationQueue, "add").mockResolvedValue({} as any);

    await registerNotificationSchedulers();

    expect(queueSpy).toHaveBeenCalledTimes(2);

    // 1. Quiet hours flush scheduler
    expect(queueSpy).toHaveBeenCalledWith(
      "scheduled-quiet-hours-flush",
      { type: "FLUSH_QUIET_HOURS" },
      expect.objectContaining({
        repeat: expect.objectContaining({
          pattern: expect.stringContaining("7"),
        }),
      })
    );

    // 2. SMS drain scheduler
    expect(queueSpy).toHaveBeenCalledWith(
      "scheduled-sms-drain",
      { type: "DRAIN_SMS" },
      expect.objectContaining({
        repeat: expect.objectContaining({
          every: 15 * 60 * 1000,
        }),
      })
    );
  });
});
