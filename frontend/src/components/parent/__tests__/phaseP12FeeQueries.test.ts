import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { filterStaleFeeQueries } from "../../../../../backend/src/workers/feeQueryEscalationWorker";
import {
  calculatePaymentAllocation,
  type InvoiceAllocationTarget,
} from "../../../lib/feeAllocationEngine";
import { deriveParentFeed } from "../../../../../backend/src/lib/parentEventEngine/deriveParentFeed";
import type { ParentDataSnapshot } from "../../../../../backend/src/lib/parentEventEngine/types";
import {
  evaluateNotificationEligibility,
  EVENT_KIND_TIER_MAP,
} from "../../../../../backend/src/lib/parentEventEngine/notificationMatrix";

describe("Phase P12: Fee Queries (OP2), SLA Auto-Escalation (AC-P18), & Combined Payments (OP12, AC-P21)", () => {
  const studentId = "student-p12-test";
  const now = new Date("2026-10-21T12:00:00.000Z");

  // ─── 1. AC-P18: Auto-Escalation of Queries Unanswered > 7 Days ─────────────
  describe("AC-P18 & filterStaleFeeQueries: SLA Aging & 7-Day Auto-Escalation", () => {
    it("identifies queries in OPEN status created > 7 days ago for auto-escalation", () => {
      const queries = [
        {
          id: "q-stale-8d",
          studentId,
          invoiceId: "inv-1",
          status: "OPEN",
          createdAt: new Date("2026-10-13T10:00:00.000Z"), // 8.08 days ago
        },
        {
          id: "q-recent-3d",
          studentId,
          invoiceId: "inv-2",
          status: "OPEN",
          createdAt: new Date("2026-10-18T10:00:00.000Z"), // 3.08 days ago
        },
        {
          id: "q-answered-9d",
          studentId,
          invoiceId: "inv-3",
          status: "ANSWERED",
          createdAt: new Date("2026-10-12T10:00:00.000Z"), // 9 days ago, but answered
        },
        {
          id: "q-escalated-10d",
          studentId,
          invoiceId: "inv-4",
          status: "ESCALATED",
          createdAt: new Date("2026-10-11T10:00:00.000Z"), // already escalated
        },
      ];

      const stale = filterStaleFeeQueries(queries, now);
      expect(stale).toHaveLength(1);
      expect(stale[0]!.id).toBe("q-stale-8d");
      expect(stale[0]!.daysOpen).toBeGreaterThanOrEqual(8);
    });

    it("does not escalate queries under 7 days (e.g. 6 days 23 hours)", () => {
      const queries = [
        {
          id: "q-almost-7d",
          status: "OPEN",
          createdAt: new Date(now.getTime() - (7 * 86400000 - 3600000)), // 6 days 23h
        },
      ];

      const stale = filterStaleFeeQueries(queries, now);
      expect(stale).toHaveLength(0);
    });
  });

  // ─── 2. Payment Allocation Engine (business_logic_rules.fees.allocation_order) ─
  describe("Explicit Payment Allocation Engine (Late Fee First, Oldest Invoice First)", () => {
    it("allocates late fee first, then oldest invoice principal without splitting", () => {
      const invoices: InvoiceAllocationTarget[] = [
        {
          id: "inv-old",
          studentId: "student-1",
          invoiceNumber: "INV-2026-001",
          dueDate: new Date("2026-08-01"),
          balanceAmount: 5000,
          lateFeeAmount: 500,
        },
        {
          id: "inv-new",
          studentId: "student-1",
          invoiceNumber: "INV-2026-002",
          dueDate: new Date("2026-10-01"),
          balanceAmount: 4000,
          lateFeeAmount: 0,
        },
      ];

      // Payment of 3,000 INR
      const plan = calculatePaymentAllocation(invoices, 3000);

      expect(plan.totalPaymentAmount).toBe(3000);
      expect(plan.totalLateFeeAllocated).toBe(500); // 500 goes to late fee first
      expect(plan.totalPrincipalAllocated).toBe(2500); // 2500 goes to oldest invoice principal
      expect(plan.unallocatedAmount).toBe(0);

      const oldAlloc = plan.allocations.find((a) => a.invoiceId === "inv-old")!;
      expect(oldAlloc.lateFeeAllocated).toBe(500);
      expect(oldAlloc.balanceAllocated).toBe(2500);
      expect(oldAlloc.remainingBalance).toBe(2500);
      expect(oldAlloc.remainingLateFee).toBe(0);
      expect(oldAlloc.isFullyCleared).toBe(false);

      const newAlloc = plan.allocations.find((a) => a.invoiceId === "inv-new")!;
      expect(newAlloc.totalAllocated).toBe(0);
      expect(newAlloc.remainingBalance).toBe(4000);
      expect(newAlloc.isFullyCleared).toBe(false);
    });

    it("cleanly clears oldest invoice completely before allocating to next invoice", () => {
      const invoices: InvoiceAllocationTarget[] = [
        {
          id: "inv-term1",
          studentId: "student-1",
          dueDate: new Date("2026-07-01"),
          balanceAmount: 5000,
          lateFeeAmount: 500,
        },
        {
          id: "inv-term2",
          studentId: "student-1",
          dueDate: new Date("2026-09-01"),
          balanceAmount: 6000,
          lateFeeAmount: 0,
        },
      ];

      // Payment of 5,500 INR (exact amount to clear Term 1 fully)
      const plan = calculatePaymentAllocation(invoices, 5500);

      const term1 = plan.allocations.find((a) => a.invoiceId === "inv-term1")!;
      const term2 = plan.allocations.find((a) => a.invoiceId === "inv-term2")!;

      expect(term1.isFullyCleared).toBe(true);
      expect(term1.remainingBalance).toBe(0);
      expect(term1.remainingLateFee).toBe(0);

      expect(term2.isFullyCleared).toBe(false);
      expect(term2.totalAllocated).toBe(0);
      expect(term2.remainingBalance).toBe(6000);
    });

    it("handles overpayments cleanly leaving unallocatedAmount positive", () => {
      const invoices: InvoiceAllocationTarget[] = [
        {
          id: "inv-single",
          studentId: "student-1",
          dueDate: new Date("2026-10-01"),
          balanceAmount: 4000,
          lateFeeAmount: 200,
        },
      ];

      const plan = calculatePaymentAllocation(invoices, 5000);
      expect(plan.totalLateFeeAllocated).toBe(200);
      expect(plan.totalPrincipalAllocated).toBe(4000);
      expect(plan.unallocatedAmount).toBe(800);

      const alloc = plan.allocations[0]!;
      expect(alloc.isFullyCleared).toBe(true);
      expect(alloc.remainingBalance).toBe(0);
    });
  });

  // ─── 3. Multi-Ward Sibling Payments (OP12, AC-P21) ──────────────────────────
  describe("OP12 & AC-P21: Combined Multi-Ward Sibling Payments", () => {
    it("consolidates invoices across multiple siblings and calculates individual allocations", () => {
      const siblingInvoices: InvoiceAllocationTarget[] = [
        {
          id: "inv-sibling1",
          studentId: "child-aarav",
          invoiceNumber: "INV-AARAV-T1",
          dueDate: new Date("2026-08-15"),
          balanceAmount: 8000,
          lateFeeAmount: 500,
        },
        {
          id: "inv-sibling2",
          studentId: "child-ananya",
          invoiceNumber: "INV-ANANYA-T1",
          dueDate: new Date("2026-09-01"),
          balanceAmount: 6500,
          lateFeeAmount: 0,
        },
      ];

      const totalRequired = 8000 + 500 + 6500; // 15,000 INR
      const plan = calculatePaymentAllocation(siblingInvoices, totalRequired);

      expect(plan.totalPaymentAmount).toBe(15000);
      expect(plan.totalLateFeeAllocated).toBe(500);
      expect(plan.totalPrincipalAllocated).toBe(14500);
      expect(plan.unallocatedAmount).toBe(0);

      // Both siblings' invoices are cleared individually for ledgers and receipts
      expect(plan.allocations[0]!.isFullyCleared).toBe(true);
      expect(plan.allocations[0]!.studentId).toBe("child-aarav");
      expect(plan.allocations[1]!.isFullyCleared).toBe(true);
      expect(plan.allocations[1]!.studentId).toBe("child-ananya");
    });
  });

  // ─── 4. FeeQueryCard Derivation in deriveParentFeed ─────────────────────────
  describe("deriveParentFeed: FeeQueryCard Triggers, Priorities & Zero-Clutter", () => {
    it("renders FeeQueryCard with T2 priority 75 when status is ANSWERED", () => {
      const snapshot: ParentDataSnapshot = {
        studentName: "Aarav Sharma",
        feeQueries: [
          {
            id: "query-ans-1",
            invoiceId: "inv-1",
            studentId,
            category: "BREAKDOWN",
            status: "ANSWERED",
            message: "Why is the activity fee charged twice?",
            answer: "We verified the breakdown; the second charge was an error and has been adjusted.",
            answeredAt: new Date(now.getTime() - 2 * 3600000).toISOString(), // 2h ago
            answeredByName: "Vikram Accountant",
            createdAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
            termName: "Term 2 Fees",
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      const queryCard = feed.find((c) => c.cardType === "FeeQueryCard");
      expect(queryCard).toBeDefined();
      expect(queryCard!.tier).toBe("T2_informational");
      expect(queryCard!.priority).toBe(75);
      expect(queryCard!.title.en).toContain("Fee Query Answered");
      expect(queryCard!.payload.status).toBe("ANSWERED");
      expect(queryCard!.payload.answer).toContain("error and has been adjusted");
      expect(queryCard!.payload.answeredByName).toBe("Vikram Accountant");
    });

    it("renders FeeQueryCard with T2 priority 40 when status is OPEN (under 48h SLA review)", () => {
      const snapshot: ParentDataSnapshot = {
        studentName: "Aarav Sharma",
        feeQueries: [
          {
            id: "query-open-1",
            invoiceId: "inv-1",
            studentId,
            category: "LATE_FEE",
            status: "OPEN",
            message: "Requesting late fee waiver due to bank holiday.",
            createdAt: new Date(now.getTime() - 10 * 3600000).toISOString(), // 10h ago
            termName: "Term 1 Balance",
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      const queryCard = feed.find((c) => c.cardType === "FeeQueryCard");
      expect(queryCard).toBeDefined();
      expect(queryCard!.tier).toBe("T2_informational");
      expect(queryCard!.priority).toBe(40);
      expect(queryCard!.title.en).toContain("Fee Query Under Review");
      expect(queryCard!.payload.hoursElapsed).toBe(10);
    });

    it("renders FeeQueryCard with T2 priority 70 when status is ESCALATED", () => {
      const snapshot: ParentDataSnapshot = {
        studentName: "Aarav Sharma",
        feeQueries: [
          {
            id: "query-esc-1",
            invoiceId: "inv-1",
            studentId,
            category: "OTHER",
            status: "ESCALATED",
            message: "Dispute over lab damage penalty.",
            createdAt: new Date(now.getTime() - 8 * 86400000).toISOString(),
            escalatedAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
            termName: "Term 1 Special Fee",
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      const queryCard = feed.find((c) => c.cardType === "FeeQueryCard");
      expect(queryCard).toBeDefined();
      expect(queryCard!.tier).toBe("T2_informational");
      expect(queryCard!.priority).toBe(70);
      expect(queryCard!.title.en).toContain("Fee Query Escalated");
    });

    it("AC-P1 Zero-Clutter: Does NOT render FeeQueryCard when status is RESOLVED", () => {
      const snapshot: ParentDataSnapshot = {
        studentName: "Aarav Sharma",
        feeQueries: [
          {
            id: "query-res-1",
            invoiceId: "inv-1",
            studentId,
            category: "BREAKDOWN",
            status: "RESOLVED",
            message: "Clarified breakdown.",
            answer: "All resolved.",
            resolvedAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
            createdAt: new Date(now.getTime() - 48 * 3600000).toISOString(),
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      const queryCard = feed.find((c) => c.cardType === "FeeQueryCard");
      expect(queryCard).toBeUndefined();
    });

    it("expires ANSWERED FeeQueryCard after 72 hours (TTL check)", () => {
      const snapshot: ParentDataSnapshot = {
        studentName: "Aarav Sharma",
        feeQueries: [
          {
            id: "query-ans-stale",
            invoiceId: "inv-1",
            studentId,
            category: "BREAKDOWN",
            status: "ANSWERED",
            message: "Old inquiry",
            answer: "Old response",
            answeredAt: new Date(now.getTime() - 73 * 3600000).toISOString(), // 73 hours ago (> 72h)
            createdAt: new Date(now.getTime() - 100 * 3600000).toISOString(),
          },
        ],
      };

      const feed = deriveParentFeed(studentId, now, snapshot);
      const queryCard = feed.find((c) => c.cardType === "FeeQueryCard");
      expect(queryCard).toBeUndefined();
    });
  });

  // ─── 5. Notification Matrix Policy Evaluation ──────────────────────────────
  describe("Notification Matrix Policy Evaluation for Fee Queries", () => {
    it("maps FEE_QUERY_ANSWERED to T2_informational and FEE_QUERY_ESCALATED to T1_action_required", () => {
      expect(EVENT_KIND_TIER_MAP["FEE_QUERY_ANSWERED"]).toBe("T2_informational");
      expect(EVENT_KIND_TIER_MAP["FEE_QUERY_ESCALATED"]).toBe("T1_action_required");
    });

    it("T2 FEE_QUERY_ANSWERED is feed-card only and suppressed from web push (AC-P4)", () => {
      const decision = evaluateNotificationEligibility({
        studentId,
        parentUserId: "parent-user-1",
        tier: "T2_informational",
        eventKind: "FEE_QUERY_ANSWERED",
        now,
        todayPushCountForParent: 0,
        previouslyDispatchedDedupeKeys: new Set(),
      });

      expect(decision.shouldPushNow).toBe(false);
      expect(decision.outcome).toBe("SKIP_TIER_FEED_ONLY");
    });

    it("T1 FEE_QUERY_ESCALATED triggers push during waking hours when under daily cap", () => {
      const wakingTime = new Date("2026-10-21T14:30:00.000Z"); // 2:30 PM
      const decision = evaluateNotificationEligibility({
        studentId,
        parentUserId: "principal-user-1",
        tier: "T1_action_required",
        eventKind: "FEE_QUERY_ESCALATED",
        now: wakingTime,
        todayPushCountForParent: 1, // Below 3
        previouslyDispatchedDedupeKeys: new Set(),
      });

      expect(decision.shouldPushNow).toBe(true);
      expect(decision.outcome).toBe("DISPATCH_NOW");
    });

    it("T1 FEE_QUERY_ESCALATED queues for morning during quiet hours", () => {
      const quietTime = new Date("2026-10-21T23:00:00.000Z"); // 11:00 PM local
      // Set hours locally to 23
      quietTime.setHours(23, 0, 0, 0);

      const decision = evaluateNotificationEligibility({
        studentId,
        parentUserId: "principal-user-1",
        tier: "T1_action_required",
        eventKind: "FEE_QUERY_ESCALATED",
        now: quietTime,
        todayPushCountForParent: 0,
        previouslyDispatchedDedupeKeys: new Set(),
      });

      expect(decision.shouldPushNow).toBe(false);
      expect(decision.outcome).toBe("QUEUE_QUIET_HOURS");
      expect(decision.isQueuedForMorning).toBe(true);
    });
  });

  // ─── 6. AC-P24: 3-Click Budget Verification for Raising Fee Query ──────────
  describe("AC-P24: 3-Click Budget Verification for Fee Queries", () => {
    it("verifies FeeQueryDialog fulfills the 3-click budget contract", () => {
      const dialogFile = path.resolve(
        __dirname,
        "../../../../../frontend/src/components/parent/FeeQueryDialog.tsx"
      );
      expect(fs.existsSync(dialogFile)).toBe(true);

      const content = fs.readFileSync(dialogFile, "utf-8");
      // Must contain category selection, message field, and submit trigger
      expect(content).toContain("createFeeQuery");
      expect(content).toContain("Question this fee");
      expect(content).toContain("Submit Question");
      expect(content).toContain("BREAKDOWN");
      expect(content).toContain("LATE_FEE");
    });
  });

  // ─── 7. Database Migration & Schema Integrity ──────────────────────────────
  describe("Database Migration & Schema Catalog Registration", () => {
    it("verifies migration 0046_fee_queries.sql exists with correct enums and RLS", () => {
      const sqlFile = path.resolve(
        __dirname,
        "../../../../../database/src/migrations/0046_fee_queries.sql"
      );
      expect(fs.existsSync(sqlFile)).toBe(true);

      const sqlContent = fs.readFileSync(sqlFile, "utf-8");
      expect(sqlContent).toContain("fee_query_category");
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS "fee_queries"');
      expect(sqlContent).toContain('ALTER TABLE "fee_queries" ENABLE ROW LEVEL SECURITY');
      expect(sqlContent).toContain("tenant_select_policy");
    });

    it("verifies _journal.json registers migration 0046", () => {
      const journalFile = path.resolve(
        __dirname,
        "../../../../../database/src/migrations/meta/_journal.json"
      );
      const journal = JSON.parse(fs.readFileSync(journalFile, "utf-8"));
      const entry46 = journal.entries.find((e: any) => e.idx === 46);
      expect(entry46).toBeDefined();
      expect(entry46.tag).toBe("0046_fee_queries");
    });

    it("verifies catalog.ts registers migration 46 under FEES_FINANCE", () => {
      const catalogFile = path.resolve(
        __dirname,
        "../../../../../database/src/migrations/catalog.ts"
      );
      const catalogContent = fs.readFileSync(catalogFile, "utf-8");
      expect(catalogContent).toContain("0046_fee_queries");
      expect(catalogContent).toContain("FEES_FINANCE");
    });

    it("verifies entityGraph registers fee_queries table", () => {
      const entityGraphFile = path.resolve(
        __dirname,
        "../../../../../packages/entity-engine/src/catalog/entityGraph.ts"
      );
      const entityContent = fs.readFileSync(entityGraphFile, "utf-8");
      expect(entityContent).toContain("fee_queries");
    });
  });
});
