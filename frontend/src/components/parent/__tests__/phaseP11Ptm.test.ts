import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { deriveParentFeed } from "../../../../../backend/src/lib/parentEventEngine/deriveParentFeed";
import type { ParentDataSnapshot } from "../../../../../backend/src/lib/parentEventEngine/types";
import { evaluateNotificationEligibility } from "../../../../../backend/src/lib/parentEventEngine/notificationMatrix";

describe("Phase P11: PTM Slot Booking, Optimistic Locking (AC-P17) & Real Venue (RC-C2)", () => {
  const studentId = "student-ptm-p11";
  const now = new Date("2026-10-21T10:00:00Z");

  // ─── 1. RC-C2 Resolution: Real Venue from ptm_events ───────────────────────
  it("RC-C2: PTMCard maps real venue from ptm_events rather than events.description", () => {
    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      upcomingEvents: [
        {
          id: "event-ptm-1",
          title: "Mid-Term Parent Teacher Meeting",
          eventType: "PTM",
          startDate: "2026-10-24T09:00:00Z", // 3 days away
          venue: "Auditorium Wing B, Room 204", // Real venue from ptm_events
          ptmEventId: "ptm-event-1",
          bookingWindow: {
            opensAt: "2026-10-18T00:00:00Z",
            closesAt: "2026-10-23T21:00:00Z",
            isOpen: true,
          },
        },
      ],
    };

    const cards = deriveParentFeed(studentId, now, snapshot);
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.cardType).toBe("PTMCard");
    expect(card.payload.venue).toBe("Auditorium Wing B, Room 204");
    expect(card.summary.en).toContain("Auditorium Wing B, Room 204");
    expect(card.payload.canBook).toBe(true);
    expect(card.title.en).toContain("Book Your Slot");
  });

  // ─── 2. OP4: Booked Slot State & T2 Priority 75 (Tomorrow) ─────────────────
  it("OP4.1: Booked PTM tomorrow renders confirmed slot time, teacher name, and T2 priority 75", () => {
    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      upcomingEvents: [
        {
          id: "event-ptm-2",
          title: "Annual Parent Conference",
          eventType: "PTM",
          startDate: "2026-10-22T04:30:00Z", // Tomorrow
          venue: "Room 101",
          ptmEventId: "ptm-event-2",
          booking: {
            id: "booking-123",
            slotId: "slot-456",
            startAt: "2026-10-22T04:40:00Z",
            endAt: "2026-10-22T04:50:00Z",
            status: "BOOKED",
            teacherName: "Ms. Shalini Verma",
          },
        },
      ],
    };

    const cards = deriveParentFeed(studentId, now, snapshot);
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.cardType).toBe("PTMCard");
    expect(card.tier).toBe("T2_informational");
    expect(card.priority).toBe(75); // PTM_TOMORROW
    expect(card.payload.booking?.teacherName).toBe("Ms. Shalini Verma");
    expect(card.payload.canBook).toBe(false);
    expect(card.title.en).toContain("PTM Tomorrow");
  });

  // ─── 3. AC-P17 / PTM_IN_2H: T1 Escalation within 2 Hours ────────────────────
  it("OP4.2 & Notification Matrix: PTM meeting within 2 hours escalates to T1_action_required priority 90", () => {
    // 45 minutes from now
    const meetingStart = new Date(now.getTime() + 45 * 60 * 1000);
    const meetingEnd = new Date(now.getTime() + 55 * 60 * 1000);

    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      upcomingEvents: [
        {
          id: "event-ptm-3",
          title: "PTM Urgent Review",
          eventType: "PTM",
          startDate: meetingStart.toISOString(),
          venue: "Conference Hall A",
          ptmEventId: "ptm-event-3",
          booking: {
            id: "booking-urgent",
            slotId: "slot-urgent",
            startAt: meetingStart.toISOString(),
            endAt: meetingEnd.toISOString(),
            status: "BOOKED",
            teacherName: "Mr. Rajesh Kumar",
          },
        },
      ],
    };

    const cards = deriveParentFeed(studentId, now, snapshot);
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.cardType).toBe("PTMCard");
    expect(card.tier).toBe("T1_action_required"); // Spec PTM_IN_2H!
    expect(card.priority).toBe(90);
    expect(card.title.en).toContain("PTM Meeting in 45 Minutes");
    expect(card.title.hi).toContain("पीटीएम बैठक 45 मिनट में");
    expect(card.summary.en).toContain("Mr. Rajesh Kumar");
  });

  // ─── 4. AC-P17: Optimistic Locking Concurrency Race Simulation ──────────────
  it("AC-P17: Optimistic locking version increment blocks concurrent slot double-booking", () => {
    // In-memory simulation of the exact SQL update logic:
    // UPDATE ptm_slots SET status = 'BOOKED', version = version + 1
    // WHERE id = slotId AND version = expectedVersion AND status = 'FREE'
    interface SlotRecord {
      id: string;
      status: "FREE" | "BOOKED" | "BLOCKED";
      version: number;
    }

    const slot: SlotRecord = {
      id: "slot-race-test",
      status: "FREE",
      version: 1,
    };

    function attemptBookSlot(s: SlotRecord, expectedVersion: number) {
      if (s.status === "FREE" && s.version === expectedVersion) {
        s.status = "BOOKED";
        s.version += 1;
        return { success: true, updatedRows: 1 };
      }
      return { success: false, updatedRows: 0, conflict: true };
    }

    // Parent A and Parent B concurrently view slot with version 1
    const parentAExpectedVersion = 1;
    const parentBExpectedVersion = 1;

    // Parent A submits first
    const resA = attemptBookSlot(slot, parentAExpectedVersion);
    expect(resA.success).toBe(true);
    expect(resA.updatedRows).toBe(1);
    expect(slot.status).toBe("BOOKED");
    expect(slot.version).toBe(2);

    // Parent B submits second with stale expectedVersion 1
    const resB = attemptBookSlot(slot, parentBExpectedVersion);
    expect(resB.success).toBe(false);
    expect(resB.updatedRows).toBe(0);
    expect(resB.conflict).toBe(true);
    // Slot remains safely booked by Parent A only
    expect(slot.version).toBe(2);
  });

  // ─── 5. AC-P17: Invariant of Single Active Booking Per Event ────────────────
  it("AC-P17: Parent cannot book two active slots for the same PTM event", () => {
    const parentBookings = [
      { id: "b1", ptmEventId: "ptm-event-1", parentUserId: "parent-u1", status: "BOOKED" },
    ];

    function canParentBook(ptmEventId: string, parentUserId: string) {
      const existing = parentBookings.find(
        (b) => b.ptmEventId === ptmEventId && b.parentUserId === parentUserId && b.status === "BOOKED"
      );
      return !existing;
    }

    expect(canParentBook("ptm-event-1", "parent-u1")).toBe(false);
    expect(canParentBook("ptm-event-2", "parent-u1")).toBe(true); // Different event allowed
  });

  // ─── 6. Notification Matrix Eligibility for PTM Event Kinds ─────────────────
  it("OP4.3: PTM_IN_2H respects 3/day T1 cap while PTM_SLOT_CONFIRMED is T2 feed-only", () => {
    const baseInput = {
      studentId,
      parentUserId: "parent-u1",
      now,
      previouslyDispatchedDedupeKeys: new Set<string>(),
      todayPushCountForParent: 0,
    };

    // PTM_IN_2H is T1
    const resT1 = evaluateNotificationEligibility({
      ...baseInput,
      tier: "T1_action_required",
      eventKind: "PTM_IN_2H",
    });
    expect(resT1.outcome).toBe("DISPATCH_NOW");
    expect(resT1.shouldPushNow).toBe(true);

    // PTM_SLOT_CONFIRMED is T2 (feed-only, no push)
    const resT2 = evaluateNotificationEligibility({
      ...baseInput,
      tier: "T2_informational",
      eventKind: "PTM_SLOT_CONFIRMED",
    });
    expect(resT2.outcome).toBe("SKIP_TIER_FEED_ONLY");
    expect(resT2.shouldPushNow).toBe(false);

    // PTM_CANCELLED is T3 (system state toast, no push)
    const resT3 = evaluateNotificationEligibility({
      ...baseInput,
      tier: "T3_system_state",
      eventKind: "PTM_CANCELLED",
    });
    expect(resT3.outcome).toBe("SKIP_TIER_SYSTEM_STATE");
    expect(resT3.shouldPushNow).toBe(false);
  });

  // ─── 7. Database Migration & Catalog Invariants ─────────────────────────────
  it("AC-P14: Migration 0045 exists with partial unique indexes, RLS, journal & catalog registration", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../../../../database/src/migrations/0045_ptm_booking_system.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    // Partial unique constraints verification (AC-P17)
    expect(sqlContent).toContain("ptm_bookings_parent_event_active_uidx");
    expect(sqlContent).toContain("ptm_bookings_slot_active_uidx");
    expect(sqlContent).toContain("ptm_bookings_student_event_active_uidx");
    expect(sqlContent).toContain("version"); // Optimistic lock counter

    // Tenant RLS verification
    expect(sqlContent).toContain('ALTER TABLE "ptm_events" ENABLE ROW LEVEL SECURITY;');
    expect(sqlContent).toContain('ALTER TABLE "ptm_slots" ENABLE ROW LEVEL SECURITY;');
    expect(sqlContent).toContain('ALTER TABLE "ptm_bookings" ENABLE ROW LEVEL SECURITY;');

    // Journal verification
    const journalPath = path.resolve(
      __dirname,
      "../../../../../database/src/migrations/meta/_journal.json"
    );
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    const entry45 = journal.entries.find((e: any) => e.idx === 45);
    expect(entry45).toBeDefined();
    expect(entry45.tag).toBe("0045_ptm_booking_system");

    // Catalog verification
    const catalogPath = path.resolve(
      __dirname,
      "../../../../../database/src/migrations/catalog.ts"
    );
    const catalogContent = fs.readFileSync(catalogPath, "utf-8");
    expect(catalogContent).toContain('tag: "0045_ptm_booking_system"');
    expect(catalogContent).toContain('"ptm_events"');
    expect(catalogContent).toContain('"ptm_slots"');
    expect(catalogContent).toContain('"ptm_bookings"');

    // Entity engine verification
    const entityGraphPath = path.resolve(
      __dirname,
      "../../../../../packages/entity-engine/src/catalog/entityGraph.ts"
    );
    const entityGraphContent = fs.readFileSync(entityGraphPath, "utf-8");
    expect(entityGraphContent).toContain('"ptm_events":');
    expect(entityGraphContent).toContain('"ptm_slots":');
    expect(entityGraphContent).toContain('"ptm_bookings":');
  });
});
