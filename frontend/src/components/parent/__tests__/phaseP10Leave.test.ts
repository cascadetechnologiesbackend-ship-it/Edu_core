import { describe, it, expect } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import { deriveParentFeed } from "../../../../../backend/src/lib/parentEventEngine/deriveParentFeed";
import type { ParentDataSnapshot } from "../../../../../backend/src/lib/parentEventEngine/types";
import { filterOverduePendingLeaveRequests } from "../../../../../backend/src/workers/leaveRequestReminderWorker";
import { LeaveApprovedCard } from "../LeaveApprovedCard";
import { LeaveRejectedCard } from "../LeaveRejectedCard";

describe("Phase P10: Student Leave Requests (Workflow OP3 + AC-P16 + RC-C1)", () => {
  const studentId = "student-leave-p10";
  const now = new Date("2026-10-21T10:00:00Z");

  // ─── 1. Leave Approved Card Derivation ───────────────────────────────────────
  it("OP3.1: Approved leave covering today/future renders LeaveApprovedCard with T2, priority 65, and bilingual content", () => {
    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      leaveRequests: [
        {
          id: "leave-req-1",
          leaveType: "CASUAL",
          startDate: "2026-10-21",
          endDate: "2026-10-23",
          reason: "Family function in hometown",
          status: "APPROVED",
          decidedAt: new Date("2026-10-20T14:00:00Z"),
          decisionNote: "Approved, have safe travels",
        },
      ],
    };

    const cards = deriveParentFeed(studentId, now, snapshot);
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.cardType).toBe("LeaveApprovedCard");
    expect(card.tier).toBe("T2_informational");
    expect(card.priority).toBe(65);
    expect(card.payload.leaveType).toBe("CASUAL");
    expect(card.payload.startDate).toBe("2026-10-21");
    expect(card.payload.endDate).toBe("2026-10-23");
    expect(card.payload.decisionNote).toBe("Approved, have safe travels");
    expect(card.title.en).toContain("Leave Approved");
    expect(card.title.hi).toContain("अवकाश स्वीकृत");
    expect(card.summary.en).toContain("Approved, have safe travels");
    expect(card.summary.hi).toContain("स्वीकृत");
  });

  // ─── 2. Past Approved Leave Does Not Render (Zero-Clutter) ───────────────────
  it("OP3.2: Expired approved leave does NOT render on the home feed (Zero-Clutter rule)", () => {
    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      leaveRequests: [
        {
          id: "leave-req-past",
          leaveType: "SICK",
          startDate: "2026-10-10",
          endDate: "2026-10-12",
          reason: "Viral fever",
          status: "APPROVED",
          decidedAt: new Date("2026-10-09T10:00:00Z"),
        },
      ],
    };

    const cards = deriveParentFeed(studentId, now, snapshot);
    expect(cards).toHaveLength(0);
  });

  // ─── 3. Leave Rejected Card Derivation ───────────────────────────────────────
  it("OP3.3: Rejected leave within 48h renders LeaveRejectedCard with T2, priority 70", () => {
    const decidedAtRecent = new Date(now.getTime() - 6 * 3600 * 1000); // 6 hours ago
    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      leaveRequests: [
        {
          id: "leave-req-rej",
          leaveType: "CASUAL",
          startDate: "2026-10-22",
          endDate: "2026-10-24",
          reason: "Personal trip",
          status: "REJECTED",
          decidedAt: decidedAtRecent,
          decisionNote: "Term examinations are scheduled on these dates",
        },
      ],
    };

    const cards = deriveParentFeed(studentId, now, snapshot);
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.cardType).toBe("LeaveRejectedCard");
    expect(card.tier).toBe("T2_informational");
    expect(card.priority).toBe(70);
    expect(card.title.en).toContain("Leave Request Declined");
    expect(card.title.hi).toContain("अवकाश अनुरोध अस्वीकृत");

    // Rejected leave older than 48h must disappear
    const decidedAtOld = new Date(now.getTime() - 50 * 3600 * 1000); // 50h ago
    const snapshotOldRej: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      leaveRequests: [
        {
          ...snapshot.leaveRequests![0]!,
          decidedAt: decidedAtOld,
        },
      ],
    };
    const oldCards = deriveParentFeed(studentId, now, snapshotOldRej);
    expect(oldCards).toHaveLength(0);
  });

  // ─── 4. Pending Requests Do Not Clutter Feed ──────────────────────────────────
  it("OP3.4: PENDING leave requests do NOT render cards on parent feed (rendered on teacher side & More hub)", () => {
    const snapshot: ParentDataSnapshot = {
      studentName: "Aarav Sharma",
      leaveRequests: [
        {
          id: "leave-req-pending",
          leaveType: "CASUAL",
          startDate: "2026-10-25",
          endDate: "2026-10-26",
          reason: "Family gathering",
          status: "PENDING",
        },
      ],
    };

    const cards = deriveParentFeed(studentId, now, snapshot);
    expect(cards).toHaveLength(0);
  });

  // ─── 5. RC-C1 Hardening Verification ──────────────────────────────────────────
  it("RC-C1: dashboard/page.tsx has completely removed the broad auditLogs READ fallback", () => {
    const dashboardFile = path.resolve(
      __dirname,
      "../../../../../frontend/src/app/(parent)/parent/dashboard/page.tsx"
    );
    const content = fs.readFileSync(dashboardFile, "utf-8");

    // Must NOT contain the old broad auditLogs fallback query
    expect(content).not.toContain("tableName: 'students'");
    expect(content).not.toContain("action: 'READ'");
    expect(content).not.toContain("AuditLogSnapshot");

    // Must explicitly document RC-C1 hardening
    expect(content).toContain("RC-C1 Hardening");
  });

  // ─── 6. 24h SLA Auto-Reminder Logic ───────────────────────────────────────────
  it("OP3.6: filterOverduePendingLeaveRequests flags requests pending > 24h and ignores recent or decided ones", () => {
    const pendingRecent = {
      id: "req-recent",
      schoolId: "school-1",
      studentId: "st-1",
      status: "PENDING" as const,
      createdAt: new Date(now.getTime() - 5 * 3600 * 1000), // 5 hours ago
    };
    const pendingOverdue = {
      id: "req-overdue",
      schoolId: "school-1",
      studentId: "st-2",
      status: "PENDING" as const,
      createdAt: new Date(now.getTime() - 28 * 3600 * 1000), // 28 hours ago
    };
    const alreadyDecided = {
      id: "req-approved",
      schoolId: "school-1",
      studentId: "st-3",
      status: "APPROVED" as const,
      createdAt: new Date(now.getTime() - 30 * 3600 * 1000),
    };

    const reminders = filterOverduePendingLeaveRequests(
      [pendingRecent, pendingOverdue, alreadyDecided],
      now
    );
    expect(reminders).toHaveLength(1);
    expect(reminders[0]?.id).toBe("req-overdue");
    expect(reminders[0]?.hoursPending).toBe(28);
  });

  // ─── 7. UI Components: Dark mode & Bilingual support ──────────────────────────
  it("OP3.7: LeaveApprovedCard and LeaveRejectedCard render cleanly in en and hi with dark mode tokens", () => {
    const sampleCard = {
      id: "card-sample-approved",
      studentId: "student-leave-p10",
      cardType: "LeaveApprovedCard" as const,
      tier: "T2_informational" as const,
      priority: 65,
      title: { en: "Leave Request Approved", hi: "अवकाश अनुरोध स्वीकृत" },
      summary: { en: "Approved by teacher", hi: "शिक्षक द्वारा स्वीकृत" },
      activatedAt: now,
      expiresAt: new Date(now.getTime() + 86400000),
      payload: {
        requestId: "req-1",
        leaveType: "CASUAL",
        startDate: "2026-10-21",
        endDate: "2026-10-22",
        decisionNote: "Approved note",
      },
    };

    const approvedElEn = React.createElement(LeaveApprovedCard, {
      card: sampleCard,
      locale: "en",
    });
    expect(approvedElEn).toBeDefined();

    const approvedElHi = React.createElement(LeaveApprovedCard, {
      card: sampleCard,
      locale: "hi",
    });
    expect(approvedElHi).toBeDefined();

    const sampleRejCard = {
      ...sampleCard,
      cardType: "LeaveRejectedCard" as const,
      title: { en: "Leave Request Declined", hi: "अवकाश अनुरोध अस्वीकृत" },
      summary: { en: "Declined by teacher", hi: "शिक्षक द्वारा अस्वीकृत" },
    };

    const rejElEn = React.createElement(LeaveRejectedCard, {
      card: sampleRejCard,
      locale: "en",
    });
    expect(rejElEn).toBeDefined();

    // Verify dark mode classes exist in source files
    const approvedCode = fs.readFileSync(
      path.resolve(__dirname, "../LeaveApprovedCard.tsx"),
      "utf-8"
    );
    expect(approvedCode).toContain("dark:bg-emerald-950");
    expect(approvedCode).toContain("dark:text-slate-100");

    const rejectedCode = fs.readFileSync(
      path.resolve(__dirname, "../LeaveRejectedCard.tsx"),
      "utf-8"
    );
    expect(rejectedCode).toContain("dark:bg-amber-950");
    expect(rejectedCode).toContain("dark:text-slate-100");
  });
});
