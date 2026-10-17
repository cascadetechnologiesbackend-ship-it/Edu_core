import { describe, it, expect } from "vitest";
import {
  isInsideQuietHours,
  getNextQuietHoursEnd,
  generateDedupeKey,
  evaluateNotificationEligibility,
  NotificationDecisionInput,
} from "../notificationMatrix";

describe("Phase P7: Notification Matrix & Limiter (AC-P4)", () => {
  const studentId = "student-101";
  const parentUserId = "parent-usr-501";
  const normalDaytime = new Date("2026-10-15T10:30:00Z");

  describe("Deduplication Key", () => {
    it("generates deterministic key formatted as (studentId:eventKind:calendarDay)", () => {
      const date = new Date("2026-10-15T14:22:00Z");
      const key = generateDedupeKey(studentId, "ATTENDANCE_ABSENT", date);
      expect(key).toBe("student-101:ATTENDANCE_ABSENT:2026-10-15");
    });
  });

  describe("Quiet Hours Evaluation (21:30 - 07:00 local)", () => {
    it("detects quiet hours at 22:00 (late night)", () => {
      const lateNight = new Date("2026-10-15T22:00:00");
      expect(isInsideQuietHours(lateNight)).toBe(true);
    });

    it("detects quiet hours at 05:45 (early morning before 07:00)", () => {
      const earlyMorning = new Date("2026-10-15T05:45:00");
      expect(isInsideQuietHours(earlyMorning)).toBe(true);
    });

    it("detects daytime is NOT inside quiet hours (11:00 AM)", () => {
      const daytime = new Date("2026-10-15T11:00:00");
      expect(isInsideQuietHours(daytime)).toBe(false);
    });

    it("detects 21:20 is NOT inside quiet hours (10 minutes before 21:30)", () => {
      const eveningBeforeQuiet = new Date("2026-10-15T21:20:00");
      expect(isInsideQuietHours(eveningBeforeQuiet)).toBe(false);
    });

    it("detects 21:35 is inside quiet hours", () => {
      const eveningInQuiet = new Date("2026-10-15T21:35:00");
      expect(isInsideQuietHours(eveningInQuiet)).toBe(true);
    });

    it("computes next morning 07:00 AM target date when queued during quiet hours", () => {
      const lateNight = new Date("2026-10-15T23:15:00");
      const queuedTarget = getNextQuietHoursEnd(lateNight, "07:00");
      expect(queuedTarget.getHours()).toBe(7);
      expect(queuedTarget.getMinutes()).toBe(0);
      expect(queuedTarget.getDate()).toBe(16); // Next morning!
    });
  });

  describe("AC-P4 Limiter Invariants", () => {
    it("approves T1 push during normal daytime hours when within cap", () => {
      const input: NotificationDecisionInput = {
        studentId,
        parentUserId,
        tier: "T1_action_required",
        eventKind: "ATTENDANCE_ABSENT",
        now: new Date("2026-10-15T09:15:00"),
        todayPushCountForParent: 0,
        previouslyDispatchedDedupeKeys: new Set(),
      };

      const decision = evaluateNotificationEligibility(input);
      expect(decision.outcome).toBe("DISPATCH_NOW");
      expect(decision.shouldPushNow).toBe(true);
      expect(decision.isQueuedForMorning).toBe(false);
    });

    it("enforces max 3 pushes per day per parent (AC-P4 Daily Cap)", () => {
      const baseInput: NotificationDecisionInput = {
        studentId,
        parentUserId,
        tier: "T1_action_required",
        eventKind: "BUS_APPROACHING",
        now: new Date("2026-10-15T15:30:00"),
        todayPushCountForParent: 2, // 2 pushes already sent
        previouslyDispatchedDedupeKeys: new Set(),
      };

      // 3rd push is still permitted
      const decision3 = evaluateNotificationEligibility(baseInput);
      expect(decision3.outcome).toBe("DISPATCH_NOW");
      expect(decision3.shouldPushNow).toBe(true);

      // 4th push is blocked by the 3/day cap!
      const overCapInput: NotificationDecisionInput = {
        ...baseInput,
        todayPushCountForParent: 3,
      };
      const decisionOver = evaluateNotificationEligibility(overCapInput);
      expect(decisionOver.outcome).toBe("SKIP_DAILY_CAP");
      expect(decisionOver.shouldPushNow).toBe(false);
      expect(decisionOver.reason).toContain("Daily cap");
    });

    it("suppresses duplicate pushes using (studentId, eventKind, calendarDay)", () => {
      const now = new Date("2026-10-15T09:30:00");
      const dedupeKey = generateDedupeKey(studentId, "ATTENDANCE_ABSENT", now);
      const dispatchedKeys = new Set<string>([dedupeKey]);

      const duplicateInput: NotificationDecisionInput = {
        studentId,
        parentUserId,
        tier: "T1_action_required",
        eventKind: "ATTENDANCE_ABSENT",
        now,
        todayPushCountForParent: 1,
        previouslyDispatchedDedupeKeys: dispatchedKeys,
      };

      const decision = evaluateNotificationEligibility(duplicateInput);
      expect(decision.outcome).toBe("SKIP_DEDUPE_LIMIT");
      expect(decision.shouldPushNow).toBe(false);
      expect(decision.reason).toContain("Duplicate push suppressed");
    });

    it("queues push for 07:00 morning delivery during quiet hours (21:30-07:00)", () => {
      const nightTime = new Date("2026-10-15T22:45:00"); // 10:45 PM
      const input: NotificationDecisionInput = {
        studentId,
        parentUserId,
        tier: "T1_action_required",
        eventKind: "FEE_OVERDUE",
        now: nightTime,
        todayPushCountForParent: 0,
        previouslyDispatchedDedupeKeys: new Set(),
      };

      const decision = evaluateNotificationEligibility(input);
      expect(decision.outcome).toBe("QUEUE_QUIET_HOURS");
      expect(decision.shouldPushNow).toBe(false);
      expect(decision.isQueuedForMorning).toBe(true);
      expect(decision.queuedForDate).toBeDefined();
      expect(decision.queuedForDate?.getHours()).toBe(7);
      expect(decision.reason).toContain("Quiet hours active");
    });

    it("suppresses pushes for Tier 3 system state events (toasts only)", () => {
      const input: NotificationDecisionInput = {
        studentId,
        parentUserId,
        tier: "T3_system_state",
        eventKind: "PAYMENT_SUCCESS",
        now: new Date("2026-10-15T14:00:00"),
        todayPushCountForParent: 0,
        previouslyDispatchedDedupeKeys: new Set(),
      };

      const decision = evaluateNotificationEligibility(input);
      expect(decision.outcome).toBe("SKIP_TIER_SYSTEM_STATE");
      expect(decision.shouldPushNow).toBe(false);
    });

    it("allows push for REPORT_CARD_PUBLISHED in Tier 2, but blocks general T2 notices", () => {
      const reportCardInput: NotificationDecisionInput = {
        studentId,
        parentUserId,
        tier: "T2_informational",
        eventKind: "REPORT_CARD_PUBLISHED",
        now: new Date("2026-10-15T11:00:00"),
        todayPushCountForParent: 0,
        previouslyDispatchedDedupeKeys: new Set(),
      };

      const reportDecision = evaluateNotificationEligibility(reportCardInput);
      expect(reportDecision.outcome).toBe("DISPATCH_NOW");
      expect(reportDecision.shouldPushNow).toBe(true);

      const noticeInput: NotificationDecisionInput = {
        ...reportCardInput,
        eventKind: "NOTICE_PUBLISHED",
      };
      const noticeDecision = evaluateNotificationEligibility(noticeInput);
      expect(noticeDecision.outcome).toBe("SKIP_TIER_FEED_ONLY");
      expect(noticeDecision.shouldPushNow).toBe(false);
    });
  });
});
