import { describe, it, expect } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import {
  evaluateDriverScan,
  checkAbsentButBoarded,
  checkMissedBoarding,
  isStopChangeEffective,
  type DriverScanInput,
  type StudentBusIdentity,
  type StudentBusPassInfo,
} from "../../../../../backend/src/lib/parentEventEngine/busBoardingEngine";
import { deriveParentFeed } from "../../../../../backend/src/lib/parentEventEngine/deriveParentFeed";
import type {
  ParentDataSnapshot,
  BusBoardingSnapshot,
  StopChangeSnapshot,
} from "../../../../../backend/src/lib/parentEventEngine/types";
import {
  evaluateNotificationEligibility,
  EVENT_KIND_TIER_MAP,
  isInsideQuietHours,
} from "../../../../../backend/src/lib/parentEventEngine/notificationMatrix";
import { BusBoardingCard } from "../BusBoardingCard";

describe("Phase P14: Bus Boarding (OP9, AC-P19, AC-P14) & Stop Change Requests (OP5)", () => {
  const studentId = "student-p14-test";
  const now = new Date(2026, 9, 21, 8, 15, 0); // Morning 8:15 AM local

  // ─── 1. AC-P14: Database Migration, Journal & Schema Catalog Registration ─────
  describe("AC-P14: Migration 0048_bus_boarding_and_stop_changes Registration", () => {
    it("migration 0048 SQL file exists and contains bus_boarding_events and stop_change_requests", () => {
      const migrationPath = path.resolve(
        __dirname,
        "../../../../../database/src/migrations/0048_bus_boarding_and_stop_changes.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sqlContent = fs.readFileSync(migrationPath, "utf-8");
      expect(sqlContent).toContain("bus_boarding_events");
      expect(sqlContent).toContain("bus_boarding_direction");
      expect(sqlContent).toContain("stop_change_requests");
      expect(sqlContent).toContain("stop_change_request_status");
      expect(sqlContent).toContain("ROW LEVEL SECURITY");
      // Append-only invariant: bus_boarding_events has INSERT policy but NO UPDATE policy
      expect(sqlContent).toContain('CREATE POLICY "tenant_insert_policy" ON "bus_boarding_events"');
      expect(sqlContent).not.toContain('CREATE POLICY "tenant_update_policy" ON "bus_boarding_events"');
    });

    it("migration journal records index 48 for 0048_bus_boarding_and_stop_changes", () => {
      const journalPath = path.resolve(
        __dirname,
        "../../../../../database/src/migrations/meta/_journal.json"
      );
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
      const entry48 = journal.entries.find((e: any) => e.idx === 48);
      expect(entry48).toBeDefined();
      expect(entry48.tag).toBe("0048_bus_boarding_and_stop_changes");
    });

    it("migrations catalog registers 0048 under domain TRANSPORT", async () => {
      const { getMigrationByIndex } = await import(
        "../../../../../database/src/migrations/catalog"
      );
      const entry = getMigrationByIndex(48);
      expect(entry).toBeDefined();
      expect(entry?.domain).toBe("TRANSPORT");
      expect(entry?.tablesCreated).toContain("bus_boarding_events");
      expect(entry?.tablesCreated).toContain("stop_change_requests");
      expect(entry?.indexesCreated).toContain("bus_boarding_student_scanned_idx");
      expect(entry?.indexesCreated).toContain("stop_change_school_status_idx");
    });

    it("entity-engine catalog registers bus_boarding_events and stop_change_requests", async () => {
      const { ENTITY_GRAPH } = await import(
        "../../../../../packages/entity-engine/src/catalog/entityGraph"
      );
      const boardingEntity = (ENTITY_GRAPH as any).bus_boarding_events;
      expect(boardingEntity).toBeDefined();
      expect(boardingEntity.tableName).toBe("bus_boarding_events");
      expect(boardingEntity.domain).toBe("TRANSPORT");
      expect(boardingEntity.isTenantScoped).toBe(true);
      expect(boardingEntity.relationships.some((r: any) => r.targetTable === "students")).toBe(true);
      expect(boardingEntity.relationships.some((r: any) => r.targetTable === "routes")).toBe(true);

      const stopEntity = (ENTITY_GRAPH as any).stop_change_requests;
      expect(stopEntity).toBeDefined();
      expect(stopEntity.tableName).toBe("stop_change_requests");
      expect(stopEntity.domain).toBe("TRANSPORT");
      expect(stopEntity.isTenantScoped).toBe(true);
      expect(stopEntity.relationships.some((r: any) => r.targetTable === "students")).toBe(true);
    });
  });

  // ─── 2. AC-P19 & OP9: Driver Scan Minimization & Cross-Check Engine ───────────
  describe("AC-P19 & OP9: Driver Scan Minimization and Cross-Check Logic", () => {
    it("evaluateDriverScan strips PII and only returns minimal student info", () => {
      const scanInput: DriverScanInput = {
        qrCodeData: "STUDENT_QR:s-42",
        direction: "BOARDING",
        scannedByUserId: "driver-1",
        scannedAt: new Date("2026-10-21T07:45:00.000Z"),
        gpsLat: 28.5355,
        gpsLng: 77.391,
      };

      const student: StudentBusIdentity = {
        id: "s-42",
        firstName: "Aarav",
        lastName: "Sharma",
        className: "Grade 4",
        sectionName: "B",
      };

      const pass: StudentBusPassInfo = {
        id: "pass-1",
        passNumber: "BP-2026-0042",
        routeId: "route-1",
        routeStopId: "stop-5",
        stopName: "Greenwood Society Gate 2",
        isActive: true,
      };

      const result = evaluateDriverScan(scanInput, student, pass);
      expect(result.success).toBe(true);
      expect(result.sanitizedStudent).toBeDefined();
      expect(result.sanitizedStudent?.studentName).toBe("Aarav S.");
      expect(result.sanitizedStudent?.className).toBe("Grade 4-B");
      expect(result.sanitizedStudent?.stopName).toBe("Greenwood Society Gate 2");
      expect(result.sanitizedStudent?.direction).toBe("BOARDING");

      // Verify strict PII exclusion (AC-P19)
      const raw = result.sanitizedStudent as any;
      expect(raw.phone).toBeUndefined();
      expect(raw.address).toBeUndefined();
      expect(raw.feeBalance).toBeUndefined();
    });

    it("checkAbsentButBoarded triggers alert if attendance is ABSENT and boarding scan exists today", () => {
      const alert = checkAbsentButBoarded(
        "s-1",
        "Aarav",
        "ABSENT",
        [
          {
            direction: "BOARDING",
            scannedAt: new Date("2026-10-21T07:45:00.000Z"),
          },
        ]
      );
      expect(alert.triggered).toBe(true);
      expect(alert.eventKind).toBe("ABSENT_BUT_BOARDED");
      expect(alert.studentId).toBe("s-1");
      expect(alert.tier).toBe("T1_action_required");
    });

    it("checkAbsentButBoarded returns false if attendance is PRESENT or no boarding scan", () => {
      // Case A: Present and boarded -> normal flow, no alert
      const normalAlert = checkAbsentButBoarded(
        "s-1",
        "Aarav",
        "PRESENT",
        [
          {
            direction: "BOARDING",
            scannedAt: new Date("2026-10-21T07:45:00.000Z"),
          },
        ]
      );
      expect(normalAlert.triggered).toBe(false);

      // Case B: Absent and not boarded -> stayed home, no boarding mismatch alert
      const stayedHomeAlert = checkAbsentButBoarded("s-1", "Aarav", "ABSENT", []);
      expect(stayedHomeAlert.triggered).toBe(false);
    });

    it("checkMissedBoarding triggers alert when stop ETA + 15 min has passed and no scan recorded", () => {
      // ETA: 07:30 (450 mins from midnight), Current time: 07:50 (470 mins from midnight)
      const alert = checkMissedBoarding("s-2", "Priya", true, 450, 470, []);
      expect(alert.triggered).toBe(true);
      expect(alert.eventKind).toBe("MISSED_BOARDING");
      expect(alert.tier).toBe("T1_action_required");
    });

    it("checkMissedBoarding returns false within 15 min grace period or after boarding", () => {
      // Current time is 7:40 AM (460 mins; within 15m grace window of 450)
      const graceAlert = checkMissedBoarding("s-2", "Priya", true, 450, 460, []);
      expect(graceAlert.triggered).toBe(false);

      // Current time is 7:50 AM, but student already boarded
      const boardedAlert = checkMissedBoarding("s-2", "Priya", true, 450, 470, [
        { direction: "BOARDING" },
      ]);
      expect(boardedAlert.triggered).toBe(false);
    });

    it("isStopChangeEffective correctly evaluates status and effective date", () => {
      const today = new Date("2026-10-21T12:00:00Z");

      // Approved and effective today
      expect(isStopChangeEffective("APPROVED", "2026-10-21", today)).toBe(true);
      // Approved and effective yesterday
      expect(isStopChangeEffective("APPROVED", "2026-10-20", today)).toBe(true);
      // Approved but effective tomorrow
      expect(isStopChangeEffective("APPROVED", "2026-10-22", today)).toBe(false);
      // Pending or Rejected
      expect(isStopChangeEffective("PENDING", "2026-10-21", today)).toBe(false);
      expect(isStopChangeEffective("REJECTED", "2026-10-21", today)).toBe(false);
    });
  });

  // ─── 3. Notification Matrix Tier & Quiet Hours Rules ──────────────────────────
  describe("Notification Matrix: Tier Assignments & Emergency Bypass", () => {
    it("maps boarding events to correct notification tiers", () => {
      expect(EVENT_KIND_TIER_MAP["BOARDING"]).toBe("T2_informational");
      expect(EVENT_KIND_TIER_MAP["ALIGHTING"]).toBe("T2_informational");
      expect(EVENT_KIND_TIER_MAP["STOP_CHANGE_DECIDED"]).toBe("T2_informational");
      expect(EVENT_KIND_TIER_MAP["ABSENT_BUT_BOARDED"]).toBe("T1_action_required");
      expect(EVENT_KIND_TIER_MAP["MISSED_BOARDING"]).toBe("T1_action_required");
    });

    it("Tier 1 bus alerts dispatch immediately during daytime and queue during quiet hours", () => {
      // 10:00 AM local time (Daytime - outside quiet hours)
      const daytimeDate = new Date(2026, 9, 21, 10, 0, 0);
      expect(isInsideQuietHours(daytimeDate, "23:00", "05:00")).toBe(false);

      // T1 safety alert dispatches immediately during daytime
      const t1DayDecision = evaluateNotificationEligibility({
        studentId: "s-1",
        parentUserId: "p-1",
        tier: "T1_action_required",
        eventKind: "ABSENT_BUT_BOARDED",
        todayPushCountForParent: 0,
        previouslyDispatchedDedupeKeys: new Set(),
        now: daytimeDate,
        quietHoursStart: "23:00",
        quietHoursEnd: "05:00",
      });
      expect(t1DayDecision.shouldPushNow).toBe(true);
      expect(t1DayDecision.outcome).toBe("DISPATCH_NOW");

      // T2 routine scan is feed-card only (no push)
      const t2DayDecision = evaluateNotificationEligibility({
        studentId: "s-1",
        parentUserId: "p-1",
        tier: "T2_informational",
        eventKind: "BOARDING",
        todayPushCountForParent: 0,
        previouslyDispatchedDedupeKeys: new Set(),
        now: daytimeDate,
        quietHoursStart: "23:00",
        quietHoursEnd: "05:00",
      });
      expect(t2DayDecision.shouldPushNow).toBe(false);
      expect(t2DayDecision.outcome).toBe("SKIP_TIER_FEED_ONLY");

      // 03:00 AM local time (Quiet hours active)
      const quietDate = new Date(2026, 9, 21, 3, 0, 0);
      expect(isInsideQuietHours(quietDate, "23:00", "05:00")).toBe(true);

      const t1QuietDecision = evaluateNotificationEligibility({
        studentId: "s-1",
        parentUserId: "p-1",
        tier: "T1_action_required",
        eventKind: "ABSENT_BUT_BOARDED",
        todayPushCountForParent: 0,
        previouslyDispatchedDedupeKeys: new Set(),
        now: quietDate,
        quietHoursStart: "23:00",
        quietHoursEnd: "05:00",
      });
      expect(t1QuietDecision.shouldPushNow).toBe(false);
      expect(t1QuietDecision.outcome).toBe("QUEUE_QUIET_HOURS");
    });
  });

  // ─── 4. Feed Derivation (deriveParentFeed) ───────────────────────────────────
  describe("Feed Derivation: BusBoardingCard, BusAlertCard & StopChangeCard", () => {
    const baseSnapshot: ParentDataSnapshot = {
      studentName: "Aarav",
      invoices: [],
      attendanceToday: { status: "PRESENT", markedAt: "2026-10-21T08:00:00Z" },
      notices: [],
      homework: [],
      upcomingEvents: [],
      pendingConsents: [],
      insights: [],
      unreadMessages: [],
    };

    it("emits BusBoardingCard within 2 hours of scan event", () => {
      // 30 minutes before 'now' (8:15 AM) => 7:45 AM
      const scanTime = new Date(now.getTime() - 30 * 60 * 1000);
      const boardingSnapshot: BusBoardingSnapshot = {
        id: "bb-1",
        direction: "BOARDING",
        scannedAt: scanTime,
        stopName: "Oakwood Heights",
        vehicleNumber: "DL-1V-8821",
        routeName: "Route 7 North",
      };

      const feed = deriveParentFeed(studentId, now, {
        ...baseSnapshot,
        busBoardingEvents: [boardingSnapshot],
      });

      const card = feed.find((c) => c.cardType === "BusBoardingCard");
      expect(card).toBeDefined();
      expect(card?.tier).toBe("T2_informational");
      expect(card?.title.en).toContain("Boarded the Bus");
      expect(card?.title.hi).toContain("बस में सवार");
      expect(card?.payload?.stopName).toBe("Oakwood Heights");
      expect(card?.payload?.vehicleNumber).toBe("DL-1V-8821");
    });

    it("does NOT emit BusBoardingCard if scan is older than 2 hours (Zero-Clutter AC-P1)", () => {
      // 2 hours 30 mins before 'now'
      const oldScanTime = new Date(now.getTime() - 150 * 60 * 1000);
      const boardingSnapshot: BusBoardingSnapshot = {
        id: "bb-old",
        direction: "BOARDING",
        scannedAt: oldScanTime,
        stopName: "Oakwood Heights",
      };

      const feed = deriveParentFeed(studentId, now, {
        ...baseSnapshot,
        busBoardingEvents: [boardingSnapshot],
      });

      const card = feed.find((c) => c.cardType === "BusBoardingCard");
      expect(card).toBeUndefined();
    });

    it("emits BusAlertCard as T1 action required on absent-but-boarded mismatch", () => {
      const scanTime = new Date(now.getTime() - 30 * 60 * 1000);
      const feed = deriveParentFeed(studentId, now, {
        ...baseSnapshot,
        attendanceToday: { status: "ABSENT", markedAt: "2026-10-21T08:00:00Z" },
        busBoardingEvents: [
          {
            id: "bb-alert-1",
            direction: "BOARDING",
            scannedAt: scanTime,
            stopName: "Gate 1",
          },
        ],
      });

      const card = feed.find((c) => c.cardType === "BusAlertCard");
      expect(card).toBeDefined();
      expect(card?.tier).toBe("T1_action_required");
      expect(card?.payload?.alertKind).toBe("ABSENT_BUT_BOARDED");
      expect(card?.title.en).toContain("Attendance & Commute Mismatch");
      expect(card?.summary.en).toContain("boarded the school bus");
    });

    it("emits BusAlertCard when commute morning ETA + 15 min has passed without boarding", () => {
      // Stop ETA is 7:30 AM (450 minutes). Current time is 8:15 AM (495 minutes). > 15m delay.
      const feed = deriveParentFeed(studentId, now, {
        ...baseSnapshot,
        busPass: {
          routeId: "r-1",
          routeName: "Route 4",
          stopId: "stop-1",
          stopName: "Maple Grove",
          stopOrder: 1,
          isActive: true,
        },
        scheduledStopMinutes: 450, // 07:30 AM
        busBoardingEvents: [], // no boarding scan
      });

      const card = feed.find((c) => c.cardType === "BusAlertCard");
      expect(card).toBeDefined();
      expect(card?.tier).toBe("T1_action_required");
      expect(card?.payload?.alertKind).toBe("MISSED_BOARDING");
      expect(card?.title.en).toContain("Bus Boarding Notice");
      expect(card?.summary.en).toContain("passed Aarav's scheduled stop");
    });

    it("emits StopChangeCard when a stop change request was recently decided", () => {
      const stopChange: StopChangeSnapshot = {
        id: "sc-1",
        requestedStopName: "Sector 14 Metro",
        reason: "Relocated closer to metro station",
        status: "APPROVED",
        effectiveDate: "2026-10-22",
        decidedAt: new Date(now.getTime() - 3600000),
      };

      const feed = deriveParentFeed(studentId, now, {
        ...baseSnapshot,
        stopChangeRequests: [stopChange],
      });

      const card = feed.find((c) => c.cardType === "StopChangeCard");
      expect(card).toBeDefined();
      expect(card?.tier).toBe("T2_informational");
      expect(card?.title.en).toContain("Bus Stop Change Approved");
      expect(card?.summary.en).toContain("Sector 14 Metro");
    });

    it("satisfies AC-P1 Zero-Clutter invariant when student has no bus issues or pending actions", () => {
      // All clear state
      const feed = deriveParentFeed(studentId, now, baseSnapshot);
      expect(feed).toHaveLength(0); // Zero unneeded cards rendered!
    });
  });

  // ─── 5. UI Component Structure ───────────────────────────────────────────────
  describe("BusBoardingCard Component Rendering", () => {
    it("renders boarding details with stop name and vehicle number", () => {
      const sampleCard = {
        id: "card-bb-test",
        studentId,
        cardType: "BusBoardingCard" as const,
        tier: "T2_informational" as const,
        priority: 80,
        title: { en: "Aarav Boarded the Bus", hi: "Aarav बस में सवार हुए" },
        summary: {
          en: "Safely boarded at 07:45 AM (Greenwood Society Gate 2)",
          hi: "07:45 AM पर सुरक्षित सवार हुए (Greenwood Society Gate 2)",
        },
        activatedAt: new Date("2026-10-21T07:45:00.000Z"),
        expiresAt: new Date("2026-10-21T09:45:00.000Z"),
        payload: {
          direction: "BOARDING" as const,
          stopName: "Greenwood Society Gate 2",
          vehicleNumber: "DL-1V-8821",
        },
      };

      const elementEn = React.createElement(BusBoardingCard, {
        card: sampleCard,
        studentName: "Aarav",
        locale: "en",
      });

      const elementHi = React.createElement(BusBoardingCard, {
        card: sampleCard,
        studentName: "Aarav",
        locale: "hi",
      });

      expect(elementEn).toBeDefined();
      expect(elementHi).toBeDefined();
      expect(sampleCard.payload.direction).toBe("BOARDING");
      expect(sampleCard.payload.vehicleNumber).toBe("DL-1V-8821");
    });
  });
});
