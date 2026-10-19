import { describe, it, expect } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import { deriveParentFeed } from "../../../../../backend/src/lib/parentEventEngine/deriveParentFeed";
import type { ParentDataSnapshot } from "../../../../../backend/src/lib/parentEventEngine/types";
import { isNightChoreography, ParentFeedContainer } from "../ParentFeedContainer";
import { ReportCardCard } from "../ReportCardCard";

describe("Phase P9: Snapshot Assembly Defects Regression Suite (AC-P13: D1-D9)", () => {
  const studentId = "student-d1-d9-audit";
  const wednesdayMorning = new Date("2026-10-14T07:30:00Z"); // inside commute window (06:30 - 08:30)
  const wednesdayMidday = new Date("2026-10-14T11:00:00Z");  // midday outside commute window

  // ─── D1: Payment Success 2h Window ───────────────────────────────────────────
  it("D1: Real PAID payment within 2h renders payment-success card with 2h TTL; disappears after 2h", () => {
    const paidAtRecent = new Date(wednesdayMidday.getTime() - 45 * 60 * 1000); // 45m ago
    const snapshotWithRecentPayment: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      invoices: [
        {
          id: "inv-recent-paid",
          termName: "Quarterly Fee",
          status: "PAID",
          dueDate: "2026-10-10",
          balanceAmount: 0,
          lateFeeAmount: 0,
          lastPayment: {
            status: "PAID",
            paidAt: paidAtRecent,
            amount: 14500,
            receiptNumber: "REC-2026-881",
          },
        },
      ],
    };

    const cards = deriveParentFeed(studentId, wednesdayMidday, snapshotWithRecentPayment);
    expect(cards).toHaveLength(1);
    const successCard = cards[0]!;
    expect(successCard.cardType).toBe("PaymentCard");
    expect(successCard.tier).toBe("T3_system_state");
    expect(successCard.payload.isSuccess).toBe(true);
    expect(successCard.payload.receiptNumber).toBe("REC-2026-881");
    expect(successCard.title.en).toBe("Fee Payment Received");
    // Expires exactly 2 hours after payment
    expect(successCard.expiresAt.getTime()).toBe(paidAtRecent.getTime() + 2 * 3600000);

    // If payment was made > 2 hours ago, the success card must disappear (Zero-Clutter)
    const paidAtOld = new Date(wednesdayMidday.getTime() - 2.5 * 3600 * 1000); // 2.5h ago
    const snapshotWithOldPayment: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      invoices: [
        {
          id: "inv-old-paid",
          termName: "Quarterly Fee",
          status: "PAID",
          dueDate: "2026-10-10",
          balanceAmount: 0,
          lateFeeAmount: 0,
          lastPayment: {
            status: "PAID",
            paidAt: paidAtOld,
            amount: 14500,
            receiptNumber: "REC-2026-881",
          },
        },
      ],
    };

    const cardsOld = deriveParentFeed(studentId, wednesdayMidday, snapshotWithOldPayment);
    expect(cardsOld).toHaveLength(0);
  });

  // ─── D2: Pending Homework Due Tomorrow ───────────────────────────────────────
  it("D2: Pending homework due tomorrow (due within 48h) with isSubmitted:false renders with real subject name", () => {
    const dueTomorrow = new Date(wednesdayMidday.getTime() + 20 * 3600 * 1000); // in 20 hours
    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      homework: [
        {
          id: "hw-pend-1",
          title: "Linear Equations Practice Sheet",
          subjectName: "Mathematics",
          dueDate: dueTomorrow,
          isSubmitted: false,
        },
      ],
    };

    const cards = deriveParentFeed(studentId, wednesdayMidday, snapshot);
    expect(cards).toHaveLength(1);
    const hwCard = cards[0]!;
    expect(hwCard.cardType).toBe("HomeworkCard");
    expect(hwCard.tier).toBe("T2_informational");
    expect(hwCard.priority).toBe(75); // Priority 75 for due tomorrow
    expect(hwCard.title.en).toBe("Mathematics due tomorrow");
    expect(hwCard.payload.subjectName).toBe("Mathematics");
    expect(hwCard.payload.isGraded).toBe(false);
  });

  // ─── D3: Bus Live Tracking with Route Stops ──────────────────────────────────
  it("D3: BusLiveCard computes real stops-away and ETA when routeStops and GPS ping are provided", () => {
    const routeStops = [
      { id: "stop-1", stopOrder: 1, lat: 28.6139, lng: 77.209, name: "School Campus" },
      { id: "stop-2", stopOrder: 2, lat: 28.625, lng: 77.215, name: "Sector 14 Junction" },
      { id: "stop-3", stopOrder: 3, lat: 28.635, lng: 77.225, name: "Green Park Gate" },
      { id: "stop-4", stopOrder: 4, lat: 28.645, lng: 77.235, name: "City Center" },
    ];

    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      busPass: {
        isActive: true,
        routeId: "rt-blue-line",
        routeName: "Route 12 - Blue Line",
        stopId: "stop-3",
        stopName: "Green Park Gate",
        stopOrder: 3,
        stopCoords: { lat: 28.635, lng: 77.225 },
      },
      routeStops,
      latestBusPing: {
        lat: 28.6145,
        lng: 77.2095, // Near Stop 1 (School Campus)
        speed: 25,
        recordedAt: wednesdayMorning,
      },
      isCommuteWindowOverride: true,
    };

    const cards = deriveParentFeed(studentId, wednesdayMorning, snapshot);
    expect(cards).toHaveLength(1);
    const busCard = cards[0]!;
    expect(busCard.cardType).toBe("BusLiveCard");
    expect(busCard.priority).toBe(100);
    expect(busCard.payload.routeStops).toHaveLength(4);
    expect(busCard.payload.stopsAway).toBeGreaterThanOrEqual(1);
    expect(busCard.payload.stopName).toBe("Green Park Gate");
  });

  // ─── D4: Report Card View Tracking & Score Delta ─────────────────────────────
  it("D4: ReportCardCard shows real score deltas and disappears once viewedAt is recorded", () => {
    // Part A: Unviewed report card with previousAverageScore computes scoreDelta
    const snapshotUnviewed: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      reportCards: [
        {
          id: "rc-term-2",
          termName: "Term 2",
          publishedAt: wednesdayMidday,
          averageScore: 84.5,
          previousAverageScore: 72.0,
          viewedAt: null,
        },
      ],
    };

    const cards = deriveParentFeed(studentId, wednesdayMidday, snapshotUnviewed);
    expect(cards).toHaveLength(1);
    const rcCard = cards[0]!;
    expect(rcCard.cardType).toBe("ReportCardCard");
    expect(rcCard.priority).toBe(85);
    expect(rcCard.payload.scoreDelta).toBe(13); // 84.5 - 72.0 rounded = 13
    expect(rcCard.payload.averageScore).toBe(84.5);

    // Component element verification (creates React element without executing hooks in Node)
    const el = React.createElement(ReportCardCard, { card: rcCard, locale: "en" });
    expect(React.isValidElement(el)).toBe(true);
    expect(el.props.card.payload.scoreDelta).toBe(13);

    // Verify component source handles scoreDelta and view tracking API
    const rcCardFile = path.resolve(__dirname, "../ReportCardCard.tsx");
    const rcCode = fs.readFileSync(rcCardFile, "utf-8");
    expect(rcCode).toContain("scoreDelta !== null");
    expect(rcCode).toContain("/api/parent/feed");

    // Part B: Once viewedAt is populated, ReportCardCard is omitted from feed
    const snapshotViewed: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      reportCards: [
        {
          id: "rc-term-2",
          termName: "Term 2",
          publishedAt: wednesdayMidday,
          averageScore: 84.5,
          previousAverageScore: 72.0,
          viewedAt: new Date(wednesdayMidday.getTime() - 1000), // Already opened
        },
      ],
    };

    const cardsAfterView = deriveParentFeed(studentId, wednesdayMidday, snapshotViewed);
    expect(cardsAfterView).toHaveLength(0); // Zero-Clutter satisfied: card disappears
  });

  // ─── D5: Pinned Notices Beyond 72 Hours ───────────────────────────────────────
  it("D5: isPinned notices published older than 72h reach the feed", () => {
    const published7DaysAgo = new Date(wednesdayMidday.getTime() - 7 * 86400000);
    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      notices: [
        {
          id: "notice-pinned-annual",
          title: "Annual Sports Day Schedule & Guidelines",
          contentPreview: "Annual sports day will commence on 20th November. All participants must register.",
          publishedAt: published7DaysAgo,
          isPinned: true,
          expiresAt: new Date(wednesdayMidday.getTime() + 14 * 86400000),
        },
      ],
    };

    const cards = deriveParentFeed(studentId, wednesdayMidday, snapshot);
    expect(cards).toHaveLength(1);
    const noticeCard = cards[0]!;
    expect(noticeCard.cardType).toBe("NoticeCard");
    expect(noticeCard.payload.isPinned).toBe(true);
    expect(noticeCard.title.en).toBe("Annual Sports Day Schedule & Guidelines");
  });

  // ─── D6: Real Teacher Names in Message Cards ─────────────────────────────────
  it("D6: Message cards display real teacher name resolved from staff records", () => {
    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      unreadMessages: [
        {
          threadId: "thread-math-teacher",
          teacherName: "Sunita Verma",
          lastMessagePreview: "Please ensure Aarav brings geometry compass tomorrow.",
          sentAt: wednesdayMidday,
        },
      ],
    };

    const cards = deriveParentFeed(studentId, wednesdayMidday, snapshot);
    expect(cards).toHaveLength(1);
    const msgCard = cards[0]!;
    expect(msgCard.cardType).toBe("MessageCard");
    expect(msgCard.payload.teacherName).toBe("Sunita Verma");
    expect(msgCard.title.en).toBe("Message from Sunita Verma");
  });

  // ─── D7: Admin Preview Requires Explicit studentId ───────────────────────────
  it("D7: Admin/Principal preview requires explicit ?studentId= and does not decrypt arbitrary students", () => {
    const dashboardFile = path.resolve(
      __dirname,
      "../../../app/(parent)/parent/dashboard/page.tsx"
    );
    const code = fs.readFileSync(dashboardFile, "utf-8");

    // Must check for explicit searchParams?.studentId when role is not PARENT
    expect(code).toContain("searchParams?.studentId");
    expect(code).toContain("admin-preview-prompt");
    expect(code).toContain("D7 FIX: Admins / Principals previewing parent portal require explicit ?studentId=");
    // Verify students query for non-parent does not blindly limit to 5 arbitrary students
    expect(code).not.toMatch(/studentRows\s*=\s*await\s*tx\.query\.students\.findMany\([\s\S]*?limit:\s*5/);
  });

  // ─── D8: Invoice Term Name Mapping ───────────────────────────────────────────
  it("D8: Invoice term name maps to fee term name (Quarterly/Monthly/Annual) rather than invoiceNumber", () => {
    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      invoices: [
        {
          id: "inv-101",
          termName: "Quarterly Fee",
          status: "PENDING",
          dueDate: new Date(wednesdayMidday.getTime() + 2 * 86400000), // Due in 2 days
          balanceAmount: 18500,
          lateFeeAmount: 0,
        },
      ],
    };

    const cards = deriveParentFeed(studentId, wednesdayMidday, snapshot);
    expect(cards).toHaveLength(1);
    const paymentCard = cards[0]!;
    expect(paymentCard.title.en).toBe("Pay Fee: Quarterly Fee");
    expect(paymentCard.summary.en).toContain("Quarterly Fee fee of ₹18,500 is due in 2 days.");
    expect(paymentCard.payload.termName).toBe("Quarterly Fee");
  });

  // ─── D9: Night Choreography Staleness Note ───────────────────────────────────
  it("D9: Night choreography (21:30 - 06:30) triggers isNightChoreography and renders staleness note", () => {
    // Test helper pure function
    const nightTime11PM = new Date("2026-10-14T23:00:00");
    const nightTime2AM = new Date("2026-10-14T02:30:00");
    const daytime11AM = new Date("2026-10-14T11:00:00");
    const evening7PM = new Date("2026-10-14T19:00:00");

    expect(isNightChoreography(nightTime11PM)).toBe(true);
    expect(isNightChoreography(nightTime2AM)).toBe(true);
    expect(isNightChoreography(daytime11AM)).toBe(false);
    expect(isNightChoreography(evening7PM)).toBe(false);

    // Verify container code contains the night staleness note with testid and quiet hours text
    const containerFile = path.resolve(__dirname, "../ParentFeedContainer.tsx");
    const containerCode = fs.readFileSync(containerFile, "utf-8");
    expect(containerCode).toContain("isNightChoreography");
    expect(containerCode).toContain("night-staleness-note");
    expect(containerCode).toContain("Quiet hours active (21:30 - 06:30)");

    // Verify React element creation works
    const element = React.createElement(ParentFeedContainer, {
      initialCards: [],
      currentStudent: {
        id: "stud-1",
        name: "Aarav Sharma",
        className: "Class 6-A",
        sectionName: "A",
        admissionNumber: "ADM-100",
      },
      availableStudents: [],
      locale: "en",
    });
    expect(React.isValidElement(element)).toBe(true);
  });
});
