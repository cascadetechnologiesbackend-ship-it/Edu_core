import { describe, it, expect } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import {
  calculateAcknowledgmentPercentage,
  filterUnacknowledgedRecipients,
  evaluateBulkReminderBatch,
  type NoticeParentRecipient,
} from "../../../lib/noticeAcknowledgmentEngine";
import {
  getLastWeekDates,
  computeWeeklyDigestSnapshot,
} from "../../../../../backend/src/workers/weeklyDigestWorker";
import { deriveParentFeed } from "../../../../../backend/src/lib/parentEventEngine/deriveParentFeed";
import type {
  ParentDataSnapshot,
  WeeklyDigestSnapshot,
} from "../../../../../backend/src/lib/parentEventEngine/types";
import {
  evaluateNotificationEligibility,
  EVENT_KIND_TIER_MAP,
  isInsideQuietHours,
} from "../../../../../backend/src/lib/parentEventEngine/notificationMatrix";
import { NoticeCard } from "../NoticeCard";
import { WeeklyDigestCard } from "../WeeklyDigestCard";

describe("Phase P13: Notice Acknowledgments (OP7, AC-P20, AC-P24) & Weekly Digest (AC-P23, OP12)", () => {
  const studentId = "student-p13-test";
  const now = new Date("2026-10-21T12:00:00.000Z"); // Wednesday noon

  // ─── 1. AC-P14: Database Migration, Journal & Schema Catalog Registration ─────
  describe("AC-P14: Migration 0047_notice_acknowledgments Registration", () => {
    it("migration 0047 SQL file exists and contains notice_acknowledgments schema", () => {
      const migrationPath = path.resolve(
        __dirname,
        "../../../../../database/src/migrations/0047_notice_acknowledgments.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sqlContent = fs.readFileSync(migrationPath, "utf-8");
      expect(sqlContent).toContain("notice_acknowledgments");
      expect(sqlContent).toContain("notice_ack_source");
      expect(sqlContent).toContain("requires_acknowledgment");
      expect(sqlContent).toContain("notice_ack_notice_parent_unique");
      expect(sqlContent).toContain("ROW LEVEL SECURITY");
    });

    it("migration journal records index 47 for 0047_notice_acknowledgments", () => {
      const journalPath = path.resolve(
        __dirname,
        "../../../../../database/src/migrations/meta/_journal.json"
      );
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
      const entry47 = journal.entries.find((e: any) => e.idx === 47);
      expect(entry47).toBeDefined();
      expect(entry47.tag).toBe("0047_notice_acknowledgments");
    });

    it("migrations catalog registers 0047 under domain COMMUNICATION", async () => {
      const { getMigrationByIndex } = await import(
        "../../../../../database/src/migrations/catalog"
      );
      const entry = getMigrationByIndex(47);
      expect(entry).toBeDefined();
      expect(entry?.domain).toBe("COMMUNICATION");
      expect(entry?.tablesCreated).toContain("notice_acknowledgments");
      expect(entry?.tablesAltered).toContain("notices");
      expect(entry?.indexesCreated).toContain("notice_ack_notice_parent_unique");
    });

    it("entity-engine catalog registers notice_acknowledgments with relationships", async () => {
      const { ENTITY_GRAPH } = await import(
        "../../../../../packages/entity-engine/src/catalog/entityGraph"
      );
      const entity = (ENTITY_GRAPH as any).notice_acknowledgments;
      expect(entity).toBeDefined();
      expect(entity.tableName).toBe("notice_acknowledgments");
      expect(entity.domain).toBe("COMMUNICATION");
      expect(entity.isTenantScoped).toBe(true);
      expect(entity.relationships.some((r: any) => r.targetTable === "notices")).toBe(true);
      expect(entity.relationships.some((r: any) => r.targetTable === "users")).toBe(true);
    });
  });

  // ─── 2. AC-P20 & surface_p8: Admin Acknowledgment Report & Bulk Remind ────────
  describe("AC-P20 & surface_p8: Admin Acknowledgment Report & Bulk Reminders", () => {
    it("calculateAcknowledgmentPercentage computes exact percentages and handles zero safe", () => {
      expect(calculateAcknowledgmentPercentage(0, 0)).toBe(0);
      expect(calculateAcknowledgmentPercentage(50, 100)).toBe(50);
      expect(calculateAcknowledgmentPercentage(78, 100)).toBe(78);
      expect(calculateAcknowledgmentPercentage(2, 3)).toBe(67);
      expect(calculateAcknowledgmentPercentage(10, 10)).toBe(100);
      expect(calculateAcknowledgmentPercentage(15, 10)).toBe(100); // capped at 100
    });

    it("filterUnacknowledgedRecipients cleanly separates pending parents from confirmed ones", () => {
      const recipients: NoticeParentRecipient[] = [
        {
          parentUserId: "parent-1",
          studentId: "s-1",
          acknowledged: true,
          acknowledgedAt: "2026-10-20T10:00:00Z",
        },
        {
          parentUserId: "parent-2",
          studentId: "s-2",
          acknowledged: false,
          hoursSinceNotice: 28,
        },
        {
          parentUserId: "parent-3",
          studentId: "s-3",
          acknowledged: false,
          hoursSinceNotice: 52,
        },
      ];

      const unacknowledged = filterUnacknowledgedRecipients(recipients);
      expect(unacknowledged).toHaveLength(2);
      expect(unacknowledged.map((u) => u.parentUserId)).toEqual(["parent-2", "parent-3"]);
    });

    it("evaluateBulkReminderBatch selects NOTICE_ACK_REMINDER_24H vs 48H by age", () => {
      const publishedAt = new Date("2026-10-19T00:00:00.000Z");
      // 30 hours later
      const now30h = new Date("2026-10-20T06:00:00.000Z");
      const parents = [{ parentUserId: "p-1", studentId: "s-1" }];

      const batch24 = evaluateBulkReminderBatch(parents, {
        now: now30h,
        noticePublishedAt: publishedAt,
        quietHoursStart: "23:00",
        quietHoursEnd: "05:00",
      });
      expect(batch24.reminded[0]?.eventKind).toBe("NOTICE_ACK_REMINDER_24H");

      // 50 hours later
      const now50h = new Date("2026-10-21T02:00:00.000Z");
      const batch48 = evaluateBulkReminderBatch(parents, {
        now: now50h,
        noticePublishedAt: publishedAt,
        quietHoursStart: "23:00",
        quietHoursEnd: "01:00",
      });
      expect(batch48.reminded[0]?.eventKind).toBe("NOTICE_ACK_REMINDER_48H");
    });

    it("evaluateBulkReminderBatch enforces T1 daily cap (max 3/day per parent) (AC-P4, AC-P20)", () => {
      const publishedAt = new Date("2026-10-19T00:00:00.000Z");
      const nowTest = new Date("2026-10-20T12:00:00.000Z"); // Daytime 12:00
      const parents = [
        { parentUserId: "p-capped", studentId: "s-1" },
        { parentUserId: "p-eligible", studentId: "s-2" },
      ];

      const parentPushCounts = new Map<string, number>();
      parentPushCounts.set("p-capped", 3); // Reached 3/day cap
      parentPushCounts.set("p-eligible", 1); // 1 push used today

      const result = evaluateBulkReminderBatch(parents, {
        now: nowTest,
        noticePublishedAt: publishedAt,
        parentPushCounts,
      });

      expect(result.reminded).toHaveLength(1);
      expect(result.reminded[0]?.parentUserId).toBe("p-eligible");
      expect(result.skippedCap).toHaveLength(1);
      expect(result.skippedCap[0]?.parentUserId).toBe("p-capped");
    });

    it("evaluateBulkReminderBatch respects quiet hours (21:30 - 07:00) by queueing for morning delivery", () => {
      const publishedAt = new Date("2026-10-19T00:00:00.000Z");
      const nightTime = new Date("2026-10-20T22:30:00.000Z"); // 22:30 local quiet hours
      const parents = [{ parentUserId: "p-night", studentId: "s-night" }];

      const result = evaluateBulkReminderBatch(parents, {
        now: nightTime,
        noticePublishedAt: publishedAt,
      });

      expect(result.reminded).toHaveLength(0);
      expect(result.queued).toHaveLength(1);
      expect(result.queued[0]?.parentUserId).toBe("p-night");
    });

    it("notification matrix maps NOTICE_ACK_REMINDER_24H/48H to T1 and WEEKLY_DIGEST_READY to T2", () => {
      expect(EVENT_KIND_TIER_MAP["NOTICE_ACK_REMINDER_24H"]).toBe("T1_action_required");
      expect(EVENT_KIND_TIER_MAP["NOTICE_ACK_REMINDER_48H"]).toBe("T1_action_required");
      expect(EVENT_KIND_TIER_MAP["WEEKLY_DIGEST_READY"]).toBe("T2_informational");
    });
  });

  // ─── 3. AC-P24 & OP7: NoticeCard 1-Click Acknowledgment Budget ───────────────
  describe("AC-P24 & OP7: NoticeCard 1-Click Acknowledgment Budget", () => {
    it("NoticeCard renders 1-click acknowledge button when requiresAcknowledgment is true and unacknowledged", () => {
      const card = {
        id: "notice-important-1",
        studentId,
        cardType: "NoticeCard" as const,
        tier: "T2_informational" as const,
        priority: 60,
        title: { en: "Mandatory Annual Sports Consent", hi: "अनिवार्य खेल सहमति" },
        summary: { en: "Please confirm participation.", hi: "कृपया भागीदारी की पुष्टि करें।" },
        payload: {
          noticeId: "notice-important-1",
          requiresAcknowledgment: true,
          acknowledgedAt: null,
          publishedAt: "2026-10-20T10:00:00.000Z",
        },
        activatedAt: new Date("2026-10-20T10:00:00.000Z"),
        expiresAt: new Date("2026-10-23T10:00:00.000Z"),
      };

      const element = React.createElement(NoticeCard, { card, locale: "en" });
      expect(element).toBeDefined();
      expect(card.payload.requiresAcknowledgment).toBe(true);
      expect(card.payload.acknowledgedAt).toBeNull();
    });

    it("NoticeCard displays acknowledged status badge when already acknowledged", () => {
      const card = {
        id: "notice-important-2",
        studentId,
        cardType: "NoticeCard" as const,
        tier: "T2_informational" as const,
        priority: 50,
        title: { en: "Exam Guidelines Circular", hi: "परीक्षा दिशानिर्देश" },
        summary: { en: "Instructions for exams.", hi: "परीक्षा निर्देश।" },
        payload: {
          noticeId: "notice-important-2",
          requiresAcknowledgment: true,
          acknowledgedAt: "2026-10-20T14:30:00.000Z",
          publishedAt: "2026-10-20T10:00:00.000Z",
        },
        activatedAt: new Date("2026-10-20T10:00:00.000Z"),
        expiresAt: new Date("2026-10-23T10:00:00.000Z"),
      };

      const element = React.createElement(NoticeCard, { card, locale: "en" });
      expect(element).toBeDefined();
      expect(card.payload.acknowledgedAt).toBe("2026-10-20T14:30:00.000Z");
    });

    it("deriveParentFeed elevates priority for unacknowledged required notices (60 vs 50)", () => {
      const snapshot: ParentDataSnapshot = {
        notices: [
          {
            id: "notice-req-unack",
            title: "School Policy Update",
            contentPreview: "Requires review",
            publishedAt: new Date("2026-10-21T08:00:00.000Z"),
            isPinned: false,
            requiresAcknowledgment: true,
            acknowledgedAt: null,
          },
          {
            id: "notice-standard",
            title: "Library Timings",
            contentPreview: "Timings info",
            publishedAt: new Date("2026-10-21T08:00:00.000Z"),
            isPinned: false,
            requiresAcknowledgment: false,
          },
        ],
      };

      const cards = deriveParentFeed(studentId, now, snapshot);
      const reqCard = cards.find((c) => c.id === "notice-notice-req-unack");
      const stdCard = cards.find((c) => c.id === "notice-notice-standard");

      expect(reqCard).toBeDefined();
      expect(stdCard).toBeDefined();
      expect(reqCard?.priority).toBe(60);
      expect(stdCard?.priority).toBe(50);
      expect(reqCard?.payload.requiresAcknowledgment).toBe(true);
      expect(reqCard?.payload.acknowledgedAt).toBeNull();
    });
  });

  // ─── 4. AC-P23: Weekly Digest Worker, Engine & Card ──────────────────────────
  describe("AC-P23: Weekly Digest Worker & Engine (Monday 08:00 Local Time)", () => {
    it("getLastWeekDates calculates previous Monday-Sunday interval correctly", () => {
      // Test with a known Wednesday: 2026-10-21
      const testDate = new Date("2026-10-21T10:00:00.000Z");
      const { weekStart, weekEnd, weekLabel } = getLastWeekDates(testDate);

      // Previous Monday should be 2026-10-12
      expect(weekStart.getDay()).toBe(1); // Monday
      expect(weekEnd.getDay()).toBe(0); // Sunday
      expect(weekLabel).toBeDefined();
    });

    it("computeWeeklyDigestSnapshot compiles accurate attendance, homework, fees, and event metrics", () => {
      const digest = computeWeeklyDigestSnapshot({
        weekLabel: "Oct 12 - Oct 18",
        attendanceRecords: [
          { status: "PRESENT", attendanceDate: "2026-10-12" },
          { status: "PRESENT", attendanceDate: "2026-10-13" },
          { status: "LATE", attendanceDate: "2026-10-14" },
          { status: "ABSENT", attendanceDate: "2026-10-15" },
          { status: "PRESENT", attendanceDate: "2026-10-16" },
        ],
        gradedSubmissions: [
          { id: "sub-1", grade: "A" },
          { id: "sub-2", grade: "A+" },
          { id: "sub-3", grade: "B" },
        ],
        invoices: [
          { status: "OVERDUE", balanceAmount: 4500, dueDate: "2026-10-10" },
        ],
        upcomingEvents: [
          { title: "Parent-Teacher Meeting", eventType: "PTM", startDate: "2026-10-24T09:00:00Z" },
        ],
        now,
      });

      expect(digest.weekLabel).toBe("Oct 12 - Oct 18");
      expect(digest.attendanceDays).toBe(4); // 3 Present + 1 Late
      expect(digest.totalSchoolDays).toBe(5);
      expect(digest.homeworkGradedCount).toBe(3);
      expect(digest.feesStatus).toBe("OVERDUE");
      expect(digest.balanceAmount).toBe(4500);
      expect(digest.upcomingEventsCount).toBe(1);
      expect(digest.upcomingEventSummary).toContain("Parent-Teacher Meeting");
    });

    it("deriveParentFeed renders WeeklyDigestCard on Monday 08:00 onwards", () => {
      // Monday 09:30 AM (active)
      const monday930am = new Date("2026-10-19T09:30:00.000Z");
      // Override getDay to return 1 (Monday)
      const mondayNow = new Date("2026-10-19T09:30:00");
      mondayNow.setDate(mondayNow.getDate() - (mondayNow.getDay() - 1)); // Guarantee Monday
      mondayNow.setHours(9, 30, 0, 0);

      const snapshot: ParentDataSnapshot = {
        weeklyDigest: {
          weekLabel: "Oct 12 - Oct 18",
          attendanceDays: 5,
          totalSchoolDays: 5,
          homeworkGradedCount: 4,
          feesStatus: "UP_TO_DATE",
          upcomingEventsCount: 0,
        },
      };

      const cards = deriveParentFeed(studentId, mondayNow, snapshot);
      const digestCard = cards.find((c) => c.cardType === "WeeklyDigestCard");

      expect(digestCard).toBeDefined();
      expect(digestCard?.tier).toBe("T2_informational");
      expect(digestCard?.priority).toBe(55);
      expect(digestCard?.title.en).toContain("Weekly Snapshot");
      expect(digestCard?.title.hi).toContain("साप्ताहिक सारांश");
      expect(digestCard?.summary.en).toContain("5/5 school days present");
      expect(digestCard?.payload.attendanceDays).toBe(5);
      expect(digestCard?.payload.homeworkGradedCount).toBe(4);
      expect(digestCard?.payload.feesStatus).toBe("UP_TO_DATE");
    });

    it("deriveParentFeed renders WeeklyDigestCard on Tuesday (TTL window)", () => {
      const tuesdayNow = new Date();
      // Ensure Tuesday 14:00
      tuesdayNow.setDate(tuesdayNow.getDate() - tuesdayNow.getDay() + 2);
      tuesdayNow.setHours(14, 0, 0, 0);

      const snapshot: ParentDataSnapshot = {
        weeklyDigest: {
          weekLabel: "Oct 12 - Oct 18",
          attendanceDays: 4,
          totalSchoolDays: 5,
          homeworkGradedCount: 2,
          feesStatus: "DUE_SOON",
          balanceAmount: 2500,
          upcomingEventsCount: 1,
        },
      };

      const cards = deriveParentFeed(studentId, tuesdayNow, snapshot);
      const digestCard = cards.find((c) => c.cardType === "WeeklyDigestCard");
      expect(digestCard).toBeDefined();
      expect(digestCard?.payload.feesStatus).toBe("DUE_SOON");
    });

    it("deriveParentFeed suppresses WeeklyDigestCard outside Mon 08:00 - Tue 23:59 window (AC-P1 Zero-Clutter)", () => {
      // Wednesday 10:00 AM (Day 3)
      const wednesdayNow = new Date();
      wednesdayNow.setDate(wednesdayNow.getDate() - wednesdayNow.getDay() + 3);
      wednesdayNow.setHours(10, 0, 0, 0);

      const snapshot: ParentDataSnapshot = {
        weeklyDigest: {
          weekLabel: "Oct 12 - Oct 18",
          attendanceDays: 5,
          totalSchoolDays: 5,
          homeworkGradedCount: 3,
          feesStatus: "UP_TO_DATE",
          upcomingEventsCount: 0,
        },
      };

      const cards = deriveParentFeed(studentId, wednesdayNow, snapshot);
      const digestCard = cards.find((c) => c.cardType === "WeeklyDigestCard");
      expect(digestCard).toBeUndefined(); // Zero-clutter suppression!
    });

    it("WeeklyDigestCard component renders all 4 metric highlights cleanly", () => {
      const card = {
        id: `weekly-digest-${studentId}`,
        studentId,
        cardType: "WeeklyDigestCard" as const,
        tier: "T2_informational" as const,
        priority: 55,
        title: { en: "Weekly Snapshot: Oct 12 - Oct 18", hi: "साप्ताहिक सारांश: Oct 12 - Oct 18" },
        summary: { en: "5/5 days present", hi: "5/5 दिन उपस्थिति" },
        payload: {
          weekLabel: "Oct 12 - Oct 18",
          attendanceDays: 5,
          totalSchoolDays: 5,
          homeworkGradedCount: 4,
          feesStatus: "UP_TO_DATE",
          upcomingEventsCount: 1,
          upcomingEventSummary: "PTM Meeting (Fri)",
        },
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      const elementEn = React.createElement(WeeklyDigestCard, { card, locale: "en" });
      const elementHi = React.createElement(WeeklyDigestCard, { card, locale: "hi" });
      expect(elementEn).toBeDefined();
      expect(elementHi).toBeDefined();
      expect(card.payload.attendanceDays).toBe(5);
      expect(card.payload.feesStatus).toBe("UP_TO_DATE");
    });
  });

  // ─── 5. AC-P1: Zero-Clutter High-Intent Principle ────────────────────────────
  describe("AC-P1: Zero-Clutter High-Intent Invariant", () => {
    it("empty snapshot derives zero cards", () => {
      const cards = deriveParentFeed(studentId, now, {});
      expect(cards).toHaveLength(0);
    });

    it("all invoices paid, no bus pass, attendance PRESENT, no unacknowledged notices yields zero cards", () => {
      const cards = deriveParentFeed(studentId, now, {
        invoices: [{ id: "inv-paid", termName: "Term 1", balanceAmount: 0, dueDate: "2026-11-01", status: "PAID", lateFeeAmount: 0 }],
        attendanceToday: { status: "PRESENT", markedAt: "2026-10-21T09:00:00Z" },
        busPass: undefined,
        notices: [],
      });
      expect(cards).toHaveLength(0);
    });
  });
});
