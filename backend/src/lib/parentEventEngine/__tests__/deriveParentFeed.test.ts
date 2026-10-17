import { describe, it, expect } from "vitest";
import { deriveParentFeed, isInsideCommuteWindow } from "../deriveParentFeed";
import { ParentDataSnapshot } from "../types";

describe("Parent Event Engine (deriveParentFeed)", () => {
  const studentId = "student-123";
  const now = new Date("2026-10-19T10:00:00.000Z"); // Monday 10:00 AM UTC

  describe("AC-P1: Zero-Clutter Invariant", () => {
    it("returns an empty array when child is in good standing and nothing requires attention", () => {
      const snapshot: ParentDataSnapshot = {
        studentName: "Aarav Sharma",
        invoices: [
          {
            id: "inv-1",
            termName: "Term 1",
            status: "PAID",
            dueDate: new Date("2026-09-01"),
            balanceAmount: 0,
            lateFeeAmount: 0,
          },
        ],
        attendanceToday: {
          status: "PRESENT",
          markedAt: new Date("2026-10-19T08:45:00.000Z"),
        },
        busPass: {
          isActive: false,
          routeId: "route-1",
          stopId: "stop-1",
          stopOrder: 3,
        },
        homework: [],
        reportCards: [],
        upcomingEvents: [],
        notices: [],
        pendingConsents: [],
        unreadMessages: [],
        insights: [],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      expect(feed).toHaveLength(0);
    });
  });

  describe("AC-P2: PaymentCard Triggers & Expiry", () => {
    it("renders PaymentCard for PENDING invoice inside 7 days of dueDate", () => {
      const dueDate = new Date("2026-10-23T00:00:00.000Z"); // 4 days away
      const snapshot: ParentDataSnapshot = {
        invoices: [
          {
            id: "inv-due-soon",
            termName: "Term 2 Tuition",
            status: "PENDING",
            dueDate,
            balanceAmount: 15000,
            lateFeeAmount: 0,
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      expect(feed).toHaveLength(1);
      expect(feed[0]?.cardType).toBe("PaymentCard");
      expect(feed[0]?.tier).toBe("T2_informational");
      expect(feed[0]?.payload.totalPayable).toBe(15000);
      expect(feed[0]?.payload.chip.en).toBe("Due in 4 days");
    });

    it("renders PaymentCard as T1_action_required when invoice is OVERDUE", () => {
      const pastDueDate = new Date("2026-10-10T00:00:00.000Z"); // 9 days overdue
      const snapshot: ParentDataSnapshot = {
        invoices: [
          {
            id: "inv-overdue",
            termName: "Term 1 Tuition",
            status: "OVERDUE",
            dueDate: pastDueDate,
            balanceAmount: 12000,
            lateFeeAmount: 500,
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      expect(feed).toHaveLength(1);
      const card = feed[0]!;
      expect(card.cardType).toBe("PaymentCard");
      expect(card.tier).toBe("T1_action_required");
      expect(card.payload.totalPayable).toBe(12500);
      expect(card.payload.chip.en).toBe("Overdue - late fee added");
      expect(card.title.en).toContain("Overdue Fee");
    });

    it("does NOT render PaymentCard for PENDING invoice more than 7 days away", () => {
      const farDueDate = new Date("2026-11-15T00:00:00.000Z"); // ~27 days away
      const snapshot: ParentDataSnapshot = {
        invoices: [
          {
            id: "inv-far",
            termName: "Term 3 Tuition",
            status: "PENDING",
            dueDate: farDueDate,
            balanceAmount: 15000,
            lateFeeAmount: 0,
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      expect(feed).toHaveLength(0);
    });

    it("renders PaymentSuccessCard for 2 hours after payment, then expires", () => {
      const paidAt = new Date(now.getTime() - 30 * 60000); // 30 minutes ago
      const snapshot: ParentDataSnapshot = {
        invoices: [
          {
            id: "inv-paid-recently",
            termName: "Term 2 Fee",
            status: "PAID",
            dueDate: new Date("2026-10-25"),
            balanceAmount: 0,
            lateFeeAmount: 0,
            lastPayment: {
              status: "PAID",
              paidAt,
              amount: 15000,
              receiptNumber: "RCP-2026-001",
            },
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      expect(feed).toHaveLength(1);
      const card = feed[0]!;
      expect(card.cardType).toBe("PaymentCard");
      expect(card.tier).toBe("T3_system_state");
      expect(card.payload.isSuccess).toBe(true);
      expect(card.expiresAt.getTime()).toBe(paidAt.getTime() + 2 * 3600000);

      // Verify that after 2 hours from paidAt, it is no longer rendered
      const laterNow = new Date(paidAt.getTime() + 2.5 * 3600000); // 2.5 hours later
      const laterFeed = deriveParentFeed(studentId, laterNow, snapshot);
      expect(laterFeed).toHaveLength(0);
    });
  });

  describe("AttendanceCard Triggers", () => {
    it("renders AttendanceCard when student is ABSENT, with expiry at 20:00 same day", () => {
      const markedAt = new Date("2026-10-19T09:15:00.000Z");
      const snapshot: ParentDataSnapshot = {
        studentName: "Aarav",
        attendanceToday: {
          status: "ABSENT",
          markedAt,
          remarks: "Unwell as per call",
        },
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      expect(feed).toHaveLength(1);
      const card = feed[0]!;
      expect(card.cardType).toBe("AttendanceCard");
      expect(card.tier).toBe("T1_action_required");
      expect(card.payload.status).toBe("ABSENT");
      expect(card.title.en).toBe("Aarav marked Absent");
      expect(card.expiresAt.getHours()).toBe(20);
    });

    it("does NOT render AttendanceCard when student is PRESENT or HOLIDAY", () => {
      const snapshot: ParentDataSnapshot = {
        attendanceToday: {
          status: "PRESENT",
          markedAt: new Date("2026-10-19T08:30:00.000Z"),
        },
      };

      expect(deriveParentFeed(studentId, now, snapshot)).toHaveLength(0);

      const holidaySnapshot: ParentDataSnapshot = {
        attendanceToday: {
          status: "HOLIDAY",
          markedAt: new Date("2026-10-19T08:00:00.000Z"),
        },
      };

      expect(deriveParentFeed(studentId, now, holidaySnapshot)).toHaveLength(0);
    });
  });

  describe("AC-P3: BusLiveCard Commute Windows", () => {
    it("renders BusLiveCard during morning commute window on a weekday", () => {
      const morningTime = new Date("2026-10-19T07:15:00"); // Monday 7:15 AM local
      expect(isInsideCommuteWindow(morningTime)).toBe(true);

      const snapshot: ParentDataSnapshot = {
        busPass: {
          isActive: true,
          routeId: "rt-10",
          routeName: "Route 10 North",
          stopId: "st-5",
          stopName: "Green Park Main Gate",
          stopOrder: 5,
        },
        routeStops: [
          { id: "st-1", stopOrder: 1, lat: 12.9, lng: 77.5, name: "Depot" },
          { id: "st-3", stopOrder: 3, lat: 12.92, lng: 77.52, name: "Crossroads" },
          { id: "st-5", stopOrder: 5, lat: 12.95, lng: 77.55, name: "Green Park Main Gate" },
        ],
        isCommuteWindowOverride: true,
      };

      const feed = deriveParentFeed(studentId, morningTime, snapshot);
      expect(feed).toHaveLength(1);
      const card = feed[0]!;
      expect(card.cardType).toBe("BusLiveCard");
      expect(card.priority).toBe(100); // Pinned to the top!
    });

    it("hides BusLiveCard outside commute window", () => {
      const middayTime = new Date("2026-10-19T12:00:00"); // 12:00 PM local
      expect(isInsideCommuteWindow(middayTime)).toBe(false);

      const snapshot: ParentDataSnapshot = {
        busPass: {
          isActive: true,
          routeId: "rt-10",
          stopId: "st-5",
          stopOrder: 5,
        },
        isCommuteWindowOverride: false,
      };

      const feed = deriveParentFeed(studentId, middayTime, snapshot);
      expect(feed).toHaveLength(0);
    });

    it("hides BusLiveCard on weekends even at commute hours", () => {
      const sundayCommute = new Date("2026-10-18T07:15:00"); // Sunday
      expect(isInsideCommuteWindow(sundayCommute)).toBe(false);
    });
  });

  describe("Homework, Reports, Events, and Notices", () => {
    it("renders HomeworkCard for homework due within 48h", () => {
      const snapshot: ParentDataSnapshot = {
        homework: [
          {
            id: "hw-1",
            title: "Trigonometry Exercise 3.2",
            subjectName: "Mathematics",
            dueDate: new Date(now.getTime() + 20 * 3600000), // Due in 20 hours
            isSubmitted: false,
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      expect(feed).toHaveLength(1);
      expect(feed[0]?.cardType).toBe("HomeworkCard");
      expect(feed[0]?.title.en).toBe("Mathematics due tomorrow");
    });

    it("renders ReportCardCard when published and unviewed", () => {
      const snapshot: ParentDataSnapshot = {
        reportCards: [
          {
            id: "rc-term-1",
            termName: "Term 1",
            publishedAt: new Date(now.getTime() - 24 * 3600000),
            viewedAt: null,
            averageScore: 84.5,
            previousAverageScore: 78.0,
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      expect(feed).toHaveLength(1);
      expect(feed[0]?.cardType).toBe("ReportCardCard");
      expect(feed[0]?.payload.scoreDelta).toBe(7);
    });

    it("renders PTMCard within 7 days", () => {
      const snapshot: ParentDataSnapshot = {
        upcomingEvents: [
          {
            id: "ev-ptm",
            title: "Annual Parent-Teacher Conference",
            eventType: "PTM",
            startDate: new Date(now.getTime() + 3 * 86400000), // 3 days away
            venue: "Auditorium",
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      expect(feed).toHaveLength(1);
      expect(feed[0]?.cardType).toBe("PTMCard");
      expect(feed[0]?.title.en).toBe("PTM in 3 Days");
    });
  });

  describe("Time-of-Day Choreography & Sorting", () => {
    it("pins BusLiveCard and AttendanceCard to the top in the morning (07:30)", () => {
      const morningNow = new Date("2026-10-19T07:30:00");
      const snapshot: ParentDataSnapshot = {
        invoices: [
          {
            id: "inv-1",
            termName: "Term 1",
            status: "OVERDUE",
            dueDate: new Date("2026-10-01"),
            balanceAmount: 10000,
            lateFeeAmount: 500,
          },
        ],
        attendanceToday: {
          status: "LATE",
          markedAt: new Date("2026-10-19T07:25:00"),
        },
        busPass: {
          isActive: true,
          routeId: "rt-1",
          stopId: "st-1",
          stopOrder: 1,
        },
        isCommuteWindowOverride: true,
      };

      const feed = deriveParentFeed(studentId, morningNow, snapshot);
      expect(feed.length).toBeGreaterThanOrEqual(3);
      expect(feed[0]?.cardType).toBe("BusLiveCard");
      expect(feed[1]?.cardType).toBe("AttendanceCard");
    });
  });
});
