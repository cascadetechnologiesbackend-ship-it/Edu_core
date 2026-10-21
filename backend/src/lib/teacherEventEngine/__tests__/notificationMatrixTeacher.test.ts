import { describe, it, expect } from "vitest";
import {
  evaluateTeacherNotificationEligibility,
  isInsideTeacherQuietHours,
  getNextTeacherQuietHoursEnd,
  generateTeacherDedupeKey,
  TeacherNotificationDecisionInput,
} from "../notificationMatrixTeacher";
import {
  isCutoffReminderEligible,
  isMarksWindowReminderEligible,
} from "../../../workers/teacherNotificationWorker";

describe("Teacher Notification Matrix & Policy Engine (AC-T10)", () => {
  const teacherId = "teacher-uuid-101";

  describe("Tier 1 Action Required Policy & Limits", () => {
    it("approves T1 push during normal working hours when cap and dedupe are clean", () => {
      const workingHourDate = new Date("2026-10-21T10:30:00");
      const input: TeacherNotificationDecisionInput = {
        teacherUserId: teacherId,
        tier: "T1_action_required",
        eventKind: "ATTENDANCE_CUTOFF_APPROACHING",
        now: workingHourDate,
        todayPushCountForTeacher: 0,
        previouslyDispatchedDedupeKeys: new Set(),
      };

      const decision = evaluateTeacherNotificationEligibility(input);
      expect(decision.outcome).toBe("DISPATCH_NOW");
      expect(decision.shouldPushNow).toBe(true);
      expect(decision.isQueuedForMorning).toBe(false);
      expect(decision.dedupeKey).toBe(`${teacherId}:ATTENDANCE_CUTOFF_APPROACHING:2026-10-21`);
    });

    it("enforces max 3 T1 pushes per day limit (AC-T10)", () => {
      const workingHourDate = new Date("2026-10-21T11:00:00");
      const input: TeacherNotificationDecisionInput = {
        teacherUserId: teacherId,
        tier: "T1_action_required",
        eventKind: "SUBSTITUTION_REQUEST_PENDING",
        now: workingHourDate,
        todayPushCountForTeacher: 3, // Already reached 3 today
        previouslyDispatchedDedupeKeys: new Set(),
      };

      const decision = evaluateTeacherNotificationEligibility(input);
      expect(decision.outcome).toBe("SKIP_DAILY_CAP");
      expect(decision.shouldPushNow).toBe(false);
      expect(decision.isQueuedForMorning).toBe(false);
      expect(decision.reason).toContain("Daily cap of 3");
    });

    it("enforces deduplication by (teacherUserId, eventKind, calendarDay) (AC-T10)", () => {
      const workingHourDate = new Date("2026-10-21T11:00:00");
      const key = generateTeacherDedupeKey(teacherId, "ATTENDANCE_CUTOFF_APPROACHING", workingHourDate);

      const input: TeacherNotificationDecisionInput = {
        teacherUserId: teacherId,
        tier: "T1_action_required",
        eventKind: "ATTENDANCE_CUTOFF_APPROACHING",
        now: workingHourDate,
        todayPushCountForTeacher: 1,
        previouslyDispatchedDedupeKeys: new Set([key]),
      };

      const decision = evaluateTeacherNotificationEligibility(input);
      expect(decision.outcome).toBe("SKIP_DEDUPE_LIMIT");
      expect(decision.shouldPushNow).toBe(false);
      expect(decision.isQueuedForMorning).toBe(false);
      expect(decision.reason).toContain("Duplicate push suppressed");
    });

    it("queues push notifications for 07:00 AM when inside quiet hours (21:30 - 07:00) (AC-T10)", () => {
      const nightDate = new Date("2026-10-21T22:45:00");
      const input: TeacherNotificationDecisionInput = {
        teacherUserId: teacherId,
        tier: "T1_action_required",
        eventKind: "MARKS_ENTRY_WINDOW_CLOSING",
        now: nightDate,
        todayPushCountForTeacher: 1,
        previouslyDispatchedDedupeKeys: new Set(),
      };

      const decision = evaluateTeacherNotificationEligibility(input);
      expect(decision.outcome).toBe("QUEUE_QUIET_HOURS");
      expect(decision.shouldPushNow).toBe(false);
      expect(decision.isQueuedForMorning).toBe(true);
      expect(decision.queuedForDate).toBeDefined();
      expect(decision.queuedForDate?.getHours()).toBe(7);
      expect(decision.queuedForDate?.getMinutes()).toBe(0);
    });
  });

  describe("Tier 2 and Tier 3 Suppression Rules (AC-T10)", () => {
    it("suppresses Tier 2 informational updates to feed card only (no push sounds/alerts)", () => {
      const workingHourDate = new Date("2026-10-21T12:00:00");
      const input: TeacherNotificationDecisionInput = {
        teacherUserId: teacherId,
        tier: "T2_informational",
        eventKind: "STUDENT_LEAVE_PENDING",
        now: workingHourDate,
        todayPushCountForTeacher: 0,
        previouslyDispatchedDedupeKeys: new Set(),
      };

      const decision = evaluateTeacherNotificationEligibility(input);
      expect(decision.outcome).toBe("SKIP_TIER_FEED_ONLY");
      expect(decision.shouldPushNow).toBe(false);
      expect(decision.isQueuedForMorning).toBe(false);
    });

    it("suppresses Tier 3 system state updates to toast only (no push)", () => {
      const workingHourDate = new Date("2026-10-21T12:00:00");
      const input: TeacherNotificationDecisionInput = {
        teacherUserId: teacherId,
        tier: "T3_system_state",
        eventKind: "ATTENDANCE_SAVED",
        now: workingHourDate,
        todayPushCountForTeacher: 0,
        previouslyDispatchedDedupeKeys: new Set(),
      };

      const decision = evaluateTeacherNotificationEligibility(input);
      expect(decision.outcome).toBe("SKIP_TIER_SYSTEM_STATE");
      expect(decision.shouldPushNow).toBe(false);
      expect(decision.isQueuedForMorning).toBe(false);
    });

    it("respects teacher opt-out of notification tiers", () => {
      const workingHourDate = new Date("2026-10-21T12:00:00");
      const input: TeacherNotificationDecisionInput = {
        teacherUserId: teacherId,
        tier: "T1_action_required",
        eventKind: "SUBSTITUTION_REQUEST_PENDING",
        now: workingHourDate,
        todayPushCountForTeacher: 0,
        previouslyDispatchedDedupeKeys: new Set(),
        tierOptOuts: ["T1_action_required"],
      };

      const decision = evaluateTeacherNotificationEligibility(input);
      expect(decision.outcome).toBe("SKIP_USER_OPTOUT");
      expect(decision.shouldPushNow).toBe(false);
    });
  });

  describe("Quiet Hours Time Utilities", () => {
    it("correctly identifies times within and outside quiet hours (21:30 - 07:00)", () => {
      const lateNight = new Date("2026-10-21T23:15:00");
      const earlyMorning = new Date("2026-10-22T05:30:00");
      const exactlyStart = new Date("2026-10-21T21:30:00");
      const justBeforeStart = new Date("2026-10-21T21:29:00");
      const midday = new Date("2026-10-21T13:00:00");
      const morningEnd = new Date("2026-10-22T07:00:00");

      expect(isInsideTeacherQuietHours(lateNight)).toBe(true);
      expect(isInsideTeacherQuietHours(earlyMorning)).toBe(true);
      expect(isInsideTeacherQuietHours(exactlyStart)).toBe(true);
      expect(isInsideTeacherQuietHours(justBeforeStart)).toBe(false);
      expect(isInsideTeacherQuietHours(midday)).toBe(false);
      expect(isInsideTeacherQuietHours(morningEnd)).toBe(false);
    });

    it("computes next 07:00 AM target date correctly", () => {
      const lateNight = new Date("2026-10-21T22:00:00");
      const nextEnd = getNextTeacherQuietHoursEnd(lateNight);
      expect(nextEnd.getHours()).toBe(7);
      expect(nextEnd.getMinutes()).toBe(0);
      expect(nextEnd.getDate()).toBe(22);

      const earlyMorning = new Date("2026-10-22T04:30:00");
      const sameDayEnd = getNextTeacherQuietHoursEnd(earlyMorning);
      expect(sameDayEnd.getHours()).toBe(7);
      expect(sameDayEnd.getMinutes()).toBe(0);
      expect(sameDayEnd.getDate()).toBe(22);
    });
  });

  describe("Worker Evaluation Helpers", () => {
    it("isCutoffReminderEligible returns true only when approaching cutoff and unmarked", () => {
      const time9_15 = new Date("2026-10-21T09:15:00"); // too early
      const time9_35 = new Date("2026-10-21T09:35:00"); // in window (09:30-10:00)
      const time10_05 = new Date("2026-10-21T10:05:00"); // past cutoff

      expect(isCutoffReminderEligible(false, time9_15, "10:00")).toBe(false);
      expect(isCutoffReminderEligible(false, time9_35, "10:00")).toBe(true);
      expect(isCutoffReminderEligible(true, time9_35, "10:00")).toBe(false); // already marked
      expect(isCutoffReminderEligible(false, time10_05, "10:00")).toBe(false);
    });

    it("isMarksWindowReminderEligible returns true only when closing in <= 24 hours and incomplete", () => {
      const now = new Date("2026-10-21T10:00:00");
      const closesIn10h = new Date(now.getTime() + 10 * 3600000);
      const closesIn30h = new Date(now.getTime() + 30 * 3600000);

      // Incomplete entries with 10h remaining
      const check1 = isMarksWindowReminderEligible(closesIn10h, 15, 40, now);
      expect(check1.eligible).toBe(true);
      expect(check1.hoursRemaining).toBe(10);

      // Incomplete entries with 30h remaining (too early)
      const check2 = isMarksWindowReminderEligible(closesIn30h, 15, 40, now);
      expect(check2.eligible).toBe(false);

      // Complete entries (40 of 40 entered)
      const check3 = isMarksWindowReminderEligible(closesIn10h, 40, 40, now);
      expect(check3.eligible).toBe(false);
    });
  });
});
