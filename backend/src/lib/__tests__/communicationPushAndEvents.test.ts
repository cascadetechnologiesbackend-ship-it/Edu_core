import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isMessageQuietHours,
  dispatchMessagePushNotification,
} from "../communicationLoop";
import { deriveTeacherFeed } from "../teacherEventEngine/deriveTeacherFeed";
import { deriveParentFeed } from "../parentEventEngine/deriveParentFeed";
import type { TeacherDataSnapshot } from "../teacherEventEngine/types";
import type { ParentDataSnapshot } from "../parentEventEngine/types";

describe("Sprint S22 Layer 4: Communication Push, Quiet Hours, and Home Feed Integration", () => {
  describe("1. Quiet Hours Evaluation (21:30 - 07:00 IST)", () => {
    it("identifies 22:00 as quiet hours", () => {
      // 22:00 IST
      const date = new Date("2026-10-30T16:30:00Z"); // 16:30 UTC = 22:00 IST (+5:30)
      expect(isMessageQuietHours(date)).toBe(true);
    });

    it("identifies 21:35 as quiet hours", () => {
      const date = new Date("2026-10-30T16:05:00Z"); // 16:05 UTC = 21:35 IST
      expect(isMessageQuietHours(date)).toBe(true);
    });

    it("identifies 21:15 as daytime (before quiet hours start)", () => {
      const date = new Date("2026-10-30T15:45:00Z"); // 15:45 UTC = 21:15 IST
      expect(isMessageQuietHours(date)).toBe(false);
    });

    it("identifies 14:00 (2 PM) as daytime", () => {
      const date = new Date("2026-10-30T08:30:00Z"); // 08:30 UTC = 14:00 IST
      expect(isMessageQuietHours(date)).toBe(false);
    });

    it("identifies 06:45 AM as quiet hours", () => {
      const date = new Date("2026-10-30T01:15:00Z"); // 01:15 UTC = 06:45 IST
      expect(isMessageQuietHours(date)).toBe(true);
    });

    it("identifies 07:15 AM as daytime (after quiet hours end)", () => {
      const date = new Date("2026-10-30T01:45:00Z"); // 01:45 UTC = 07:15 IST
      expect(isMessageQuietHours(date)).toBe(false);
    });
  });

  describe("2. dispatchMessagePushNotification Policy Enforcement", () => {
    it("suppresses push during quiet hours and records SKIPPED_QUIET_HOURS log", async () => {
      const insertedRows: any[] = [];
      const mockTxDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((val) => {
            insertedRows.push(val);
            return Promise.resolve();
          }),
        }),
        query: {
          pushNotificationLogs: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      };

      const quietTime = new Date("2026-10-30T17:00:00Z"); // 22:30 IST
      const res = await dispatchMessagePushNotification(
        "school-1",
        "sender-1",
        "recipient-1",
        "Test Subject",
        "Test snippet content",
        { now: quietTime, txDb: mockTxDb }
      );

      expect(res.dispatched).toBe(false);
      expect(res.status).toBe("SKIPPED_QUIET_HOURS");
      expect(insertedRows.length).toBe(1);
      expect(insertedRows[0].status).toBe("SKIPPED_QUIET_HOURS");
      expect(insertedRows[0].schoolId).toBe("school-1");
    });

    it("suppresses push when recipient has reached daily cap of 5 pushes", async () => {
      const insertedRows: any[] = [];
      const mockTxDb = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((val) => {
            insertedRows.push(val);
            return Promise.resolve();
          }),
        }),
        query: {
          pushNotificationLogs: {
            // Already 5 delivered notifications today
            findMany: vi.fn().mockResolvedValue([
              { id: "1" },
              { id: "2" },
              { id: "3" },
              { id: "4" },
              { id: "5" },
            ]),
          },
        },
      };

      const dayTime = new Date("2026-10-30T08:30:00Z"); // 14:00 IST (Daytime)
      const res = await dispatchMessagePushNotification(
        "school-1",
        "sender-1",
        "recipient-1",
        "Test Subject",
        "Test snippet content",
        { now: dayTime, txDb: mockTxDb }
      );

      expect(res.dispatched).toBe(false);
      expect(res.status).toBe("SKIPPED_DAILY_CAP");
      expect(insertedRows.length).toBe(1);
      expect(insertedRows[0].status).toBe("SKIPPED_DAILY_CAP");
    });
  });

  describe("3. Teacher Home Feed Integration (MessagesCard)", () => {
    it("derives MessagesCard when snapshot contains unread messages", () => {
      const now = new Date("2026-10-30T10:00:00Z");
      const snapshot: TeacherDataSnapshot = {
        teacherUserId: "teacher-1",
        isWorkingDay: true,
        attendanceSections: [],
        timetableToday: [],
        gradingAssignments: [],
        marksEntryWindows: [],
        pendingLeaveRequests: [],
        substitutions: [],
        ptmBookingsToday: [],
        unreadMessages: [
          {
            threadId: "thread-1",
            parentName: "Rajesh Sharma",
            studentName: "Aarav Sharma",
            sectionName: "Class 10 A",
            lastMessagePreview: "Regarding math exam syllabus",
            sentAt: now,
            unreadCount: 2,
          },
        ],
      };

      const cards = deriveTeacherFeed("teacher-1", now, snapshot);
      const messagesCard = cards.find((c) => c.cardType === "MessagesCard");

      expect(messagesCard).toBeDefined();
      expect(messagesCard?.tier).toBe("T2_informational");
      expect(messagesCard?.payload.unreadCount).toBe(2);
      expect(messagesCard?.title.en).toBe("Unread Parent Messages");
    });

    it("does not derive MessagesCard when unreadMessages is empty", () => {
      const now = new Date("2026-10-30T10:00:00Z");
      const snapshot: TeacherDataSnapshot = {
        teacherUserId: "teacher-1",
        isWorkingDay: true,
        attendanceSections: [],
        timetableToday: [],
        gradingAssignments: [],
        marksEntryWindows: [],
        pendingLeaveRequests: [],
        substitutions: [],
        ptmBookingsToday: [],
        unreadMessages: [],
      };

      const cards = deriveTeacherFeed("teacher-1", now, snapshot);
      const messagesCard = cards.find((c) => c.cardType === "MessagesCard");
      expect(messagesCard).toBeUndefined();
    });
  });

  describe("4. Parent Home Feed Integration (MessageCard)", () => {
    it("derives MessageCard when snapshot contains unread messages", () => {
      const now = new Date("2026-10-30T10:00:00Z");
      const snapshot: ParentDataSnapshot = {
        studentName: "Aarav Sharma",
        invoices: [],
        homework: [],
        reportCards: [],
        notices: [],
        upcomingEvents: [],
        unreadMessages: [
          {
            threadId: "thread-101",
            teacherName: "Sunita Verma",
            lastMessagePreview: "Please verify chapter 4 practice problems.",
            sentAt: now,
          },
        ],
        leaveRequests: [],
        feeQueries: [],
      };

      const cards = deriveParentFeed("student-1", now, snapshot);
      const messageCard = cards.find((c) => c.cardType === "MessageCard");

      expect(messageCard).toBeDefined();
      expect(messageCard?.tier).toBe("T2_informational");
      expect(messageCard?.title.en).toBe("Message from Sunita Verma");
      expect(messageCard?.payload.threadId).toBe("thread-101");
    });
  });
});
