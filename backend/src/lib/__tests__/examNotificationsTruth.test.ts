import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  notifyResultReleased,
  notifyAdmitCardsReleased,
  notifyDatesheetPublished,
  notifyBulkJobCompleted,
  isQuietHours,
} from "../examNotifications";
import * as webPushDispatcher from "../webPushDispatcher";
import * as pushPersistence from "../pushPersistence";

vi.mock("../webPushDispatcher", () => ({
  dispatchWebPush: vi.fn(),
  isWebPushConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("../tenant", () => ({
  withTenant: vi.fn(async (_schoolId: string, fn: any) => fn()),
}));

describe("S25 Layer L3: Exam Notification Write-Path Truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("notifyResultReleased", () => {
    it("dispatches first, persists actual mixed outcomes, and reports pushSentCount matching DELIVERED only", async () => {
      // Mock dispatchWebPush returning 3 mixed outcomes: 1 delivered, 1 skipped, 1 failed
      vi.mocked(webPushDispatcher.dispatchWebPush).mockResolvedValue([
        { userId: "parent-1", subscriptionFound: true, success: true, status: "DELIVERED" },
        { userId: "parent-2", subscriptionFound: false, success: true, status: "SKIPPED_NO_SUBSCRIPTION" },
        { userId: "parent-3", subscriptionFound: true, success: false, status: "FAILED", error: "Network error" },
      ]);

      const insertedLogs: any[] = [];
      const mockInsert = vi.fn().mockImplementation((table: any) => ({
        values: vi.fn().mockImplementation((rows: any) => {
          insertedLogs.push(...(Array.isArray(rows) ? rows : [rows]));
          return {
            returning: vi.fn().mockResolvedValue([{ id: "notice-id" }]),
          };
        }),
      }));

      // Set up mock DB with reportCardSetups, students, and family
      const mockDb: any = {
        query: {
          reportCardSetups: {
            findFirst: vi.fn().mockResolvedValue({ id: "setup-1", name: "Term 1 Final" }),
          },
          resultSettings: {
            findFirst: vi.fn().mockResolvedValue({ smsNotificationsEnabled: false }),
          },
          examClassScopes: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          students: {
            findMany: vi.fn().mockResolvedValue([
              { id: "student-1", primaryParentUserId: "parent-1" },
              { id: "student-2", primaryParentUserId: "parent-2" },
              { id: "student-3", primaryParentUserId: "parent-3" },
            ]),
          },
          studentFamilyMembers: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          userPushSubscriptions: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
        insert: mockInsert,
      };

      // Mock isQuietHours returning false (daytime)
      const res = await notifyResultReleased(
        {
          schoolId: "school-1",
          setupId: "setup-1",
          triggeredById: "admin-1",
        },
        mockDb,
        () => false // daytime override
      );

      // Verify dispatchWebPush was called with all 3 parents
      expect(webPushDispatcher.dispatchWebPush).toHaveBeenCalledWith(
        "school-1",
        expect.arrayContaining(["parent-1", "parent-2", "parent-3"]),
        expect.objectContaining({ title: expect.any(String), body: expect.any(String) }),
        expect.anything()
      );

      // Verify pushSentCount equals ONLY the DELIVERED count (1), NOT 3
      expect(res.pushSentCount).toBe(1);

      // Verify inserted push logs reflect exact individual statuses
      const pushLogs = insertedLogs.filter((l) => l.recipientUserId && l.title);
      expect(pushLogs).toHaveLength(3);
      expect(pushLogs.find((l) => l.recipientUserId === "parent-1")?.status).toBe("DELIVERED");
      expect(pushLogs.find((l) => l.recipientUserId === "parent-2")?.status).toBe("SKIPPED_NO_SUBSCRIPTION");
      expect(pushLogs.find((l) => l.recipientUserId === "parent-3")?.status).toBe("FAILED");
    });

    it("writes DEFERRED_QUIET_HOURS and reports pushSentCount: 0 during quiet hours", async () => {
      const insertedLogs: any[] = [];
      const mockInsert = vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((rows: any) => {
          insertedLogs.push(...(Array.isArray(rows) ? rows : [rows]));
          return {
            returning: vi.fn().mockResolvedValue([{ id: "notice-id" }]),
          };
        }),
      }));

      const mockDb: any = {
        query: {
          reportCardSetups: {
            findFirst: vi.fn().mockResolvedValue({ id: "setup-1", name: "Term 1 Final" }),
          },
          resultSettings: {
            findFirst: vi.fn().mockResolvedValue({ smsNotificationsEnabled: false }),
          },
          examClassScopes: { findMany: vi.fn().mockResolvedValue([]) },
          students: {
            findMany: vi.fn().mockResolvedValue([
              { id: "student-1", primaryParentUserId: "parent-1" },
            ]),
          },
          studentFamilyMembers: { findMany: vi.fn().mockResolvedValue([]) },
        },
        insert: mockInsert,
      };

      const res = await notifyResultReleased(
        {
          schoolId: "school-1",
          setupId: "setup-1",
          triggeredById: "admin-1",
        },
        mockDb,
        () => true // quiet hours override
      );

      // In quiet hours, web push is deferred: NO live dispatch
      expect(webPushDispatcher.dispatchWebPush).not.toHaveBeenCalled();
      expect(res.pushSentCount).toBe(0);

      // Push logs written as DEFERRED_QUIET_HOURS with sentAt: null
      const deferredLog = insertedLogs.find((l) => l.recipientUserId === "parent-1");
      expect(deferredLog?.status).toBe("DEFERRED_QUIET_HOURS");
      expect(deferredLog?.sentAt).toBeNull();
    });
  });

  describe("notifyAdmitCardsReleased", () => {
    it("dispatches first and reports pushSentCount matching actual delivered count", async () => {
      vi.mocked(webPushDispatcher.dispatchWebPush).mockResolvedValue([
        { userId: "parent-1", subscriptionFound: true, success: true, status: "DELIVERED" },
        { userId: "parent-2", subscriptionFound: true, success: false, status: "FAILED", error: "401" },
      ]);

      const insertedLogs: any[] = [];
      const mockInsert = vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((rows: any) => {
          insertedLogs.push(...(Array.isArray(rows) ? rows : [rows]));
          return {
            returning: vi.fn().mockResolvedValue([{ id: "notice-id" }]),
          };
        }),
      }));

      const mockDb: any = {
        query: {
          exams: { findFirst: vi.fn().mockResolvedValue({ id: "exam-1", name: "Finals 2026" }) },
          examClassScopes: { findMany: vi.fn().mockResolvedValue([]) },
          students: {
            findMany: vi.fn().mockResolvedValue([
              { id: "student-1", primaryParentUserId: "parent-1" },
              { id: "student-2", primaryParentUserId: "parent-2" },
            ]),
          },
          studentFamilyMembers: { findMany: vi.fn().mockResolvedValue([]) },
        },
        insert: mockInsert,
      };

      const res = await notifyAdmitCardsReleased(
        {
          schoolId: "school-1",
          examId: "exam-1",
          triggeredById: "admin-1",
        },
        mockDb,
        () => false
      );

      expect(webPushDispatcher.dispatchWebPush).toHaveBeenCalled();
      expect(res.pushSentCount).toBe(1); // 1 delivered out of 2

      const logs = insertedLogs.filter((l) => l.recipientUserId && l.title);
      expect(logs.find((l) => l.recipientUserId === "parent-1")?.status).toBe("DELIVERED");
      expect(logs.find((l) => l.recipientUserId === "parent-2")?.status).toBe("FAILED");
    });
  });

  describe("notifyDatesheetPublished", () => {
    it("dispatches first and reports pushSentCount matching actual delivered count", async () => {
      vi.mocked(webPushDispatcher.dispatchWebPush).mockResolvedValue([
        { userId: "parent-1", subscriptionFound: true, success: true, status: "DELIVERED" },
      ]);

      const insertedLogs: any[] = [];
      const mockInsert = vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((rows: any) => {
          insertedLogs.push(...(Array.isArray(rows) ? rows : [rows]));
          return {
            returning: vi.fn().mockResolvedValue([{ id: "notice-id" }]),
          };
        }),
      }));

      const mockDb: any = {
        query: {
          examSchedules: {
            findFirst: vi.fn().mockResolvedValue({
              id: "sched-1",
              exam: { id: "exam-1", name: "Board Exam" },
            }),
          },
          examClassScopes: { findMany: vi.fn().mockResolvedValue([]) },
          students: {
            findMany: vi.fn().mockResolvedValue([
              { id: "student-1", primaryParentUserId: "parent-1" },
            ]),
          },
          studentFamilyMembers: { findMany: vi.fn().mockResolvedValue([]) },
        },
        insert: mockInsert,
      };

      const res = await notifyDatesheetPublished(
        {
          schoolId: "school-1",
          scheduleIds: ["sched-1"],
          triggeredById: "admin-1",
        },
        mockDb,
        () => false
      );

      expect(webPushDispatcher.dispatchWebPush).toHaveBeenCalled();
      expect(res.pushSentCount).toBe(1);
    });
  });

  describe("notifyBulkJobCompleted", () => {
    it("dispatches first and records actual result for the triggering admin", async () => {
      vi.mocked(webPushDispatcher.dispatchWebPush).mockResolvedValue([
        { userId: "admin-1", subscriptionFound: false, success: true, status: "SKIPPED_NO_SUBSCRIPTION" },
      ]);

      const insertedLogs: any[] = [];
      const mockInsert = vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((rows: any) => {
          insertedLogs.push(...(Array.isArray(rows) ? rows : [rows]));
          return {
            returning: vi.fn().mockResolvedValue([{ id: "notice-id" }]),
          };
        }),
      }));

      const mockDb: any = {
        insert: mockInsert,
      };

      const res = await notifyBulkJobCompleted(
        {
          schoolId: "school-1",
          jobId: "job-1",
          examId: "exam-1",
          triggeredById: "admin-1",
          processedCount: 10,
          failedCount: 0,
        },
        mockDb
      );

      expect(webPushDispatcher.dispatchWebPush).toHaveBeenCalledWith(
        "school-1",
        ["admin-1"],
        expect.anything(),
        expect.anything()
      );

      // Since admin had no subscription, delivered count is 0
      expect(res.pushSentCount).toBe(0);

      const adminLog = insertedLogs.find((l) => l.recipientUserId === "admin-1");
      expect(adminLog?.status).toBe("SKIPPED_NO_SUBSCRIPTION");
    });
  });
});
