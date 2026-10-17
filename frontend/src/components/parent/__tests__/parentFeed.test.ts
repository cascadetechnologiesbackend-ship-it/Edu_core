import { describe, it, expect } from "vitest";
import React from "react";
import { TodayStrip } from "../TodayStrip";
import { FeedCard } from "../FeedCard";
import fs from "fs";
import path from "path";

describe("Parent Feed Primitives & Zero-Clutter Invariant (Phase P3 / AC-P1)", () => {
  it("TodayStrip: returns peaceful element when activeCardsCount is 0", () => {
    const el = TodayStrip({ activeCardsCount: 0, locale: "en" });
    expect(React.isValidElement(el)).toBe(true);
    expect(el.props.className).toContain("bg-emerald-950/20");
  });

  it("TodayStrip: returns attention count styling when activeCardsCount > 0", () => {
    const el = TodayStrip({ activeCardsCount: 3, locale: "en" });
    expect(React.isValidElement(el)).toBe(true);
    expect(el.props.className).toContain("bg-slate-900/60");
  });

  it("FeedCard: constructs card element with proper data attributes and actions", () => {
    const el = FeedCard({
      id: "card-1",
      cardType: "PaymentCard",
      tier: "T1_action_required",
      title: "Term 2 Fee Due",
      summary: "Term 2 fee of ₹12,500 is due in 3 days",
      countdownChip: { text: "Due in 3 days", variant: "amber" },
      primaryAction: { label: "Pay Now", href: "/parent/fees" },
    });

    expect(React.isValidElement(el)).toBe(true);
    expect(el.props["data-card-id"]).toBe("card-1");
    expect(el.props["data-card-type"]).toBe("PaymentCard");
    expect(el.props["data-card-tier"]).toBe("T1_action_required");
    expect(el.props.className).toContain("border-l-rose-500");
  });

  it("AC-P1 Code Invariant: Grep parent dashboard page - no feed card is rendered unconditionally", () => {
    const dashboardFile = path.resolve(
      __dirname,
      "../../../app/(parent)/parent/dashboard/page.tsx"
    );
    const code = fs.readFileSync(dashboardFile, "utf-8");

    // Must use ParentFeedContainer with derived cards
    expect(code).toContain("deriveParentFeed");
    expect(code).toContain("<ParentFeedContainer");

    // In ParentFeedContainer, card rendering is strictly conditional: cards.length > 0
    const containerFile = path.resolve(__dirname, "../ParentFeedContainer.tsx");
    const containerCode = fs.readFileSync(containerFile, "utf-8");
    expect(containerCode).toContain("cards.length > 0 &&");
    expect(containerCode).toContain("cards.map");
  });

  describe("PaymentCard & AC-P2 Invariants", () => {
    it("PaymentCard: renders due invoice with amber countdown chip and CheckoutButton", async () => {
      const { PaymentCard } = await import("../PaymentCard");
      const card = {
        id: "feed-pay-1",
        studentId: "std-1",
        cardType: "PaymentCard" as const,
        tier: "T1_action_required" as const,
        priority: 95,
        title: { en: "Pay Term 2 Fee", hi: "सत्र 2 शुल्क का भुगतान करें" },
        summary: { en: "Balance of ₹12,500 due in 3 days", hi: "₹12,500 का शुल्क 3 दिनों में देय है" },
        payload: {
          invoiceId: "inv-001",
          balanceAmount: 12500,
          termName: "Term 2",
          status: "PENDING",
          daysUntilDue: 3,
        },
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      const el = React.createElement(PaymentCard, { card, studentName: "Aarav" });
      expect(React.isValidElement(el)).toBe(true);
      expect(el.props.card.id).toBe("feed-pay-1");
      expect(el.props.studentName).toBe("Aarav");
    });

    it("PaymentCard: renders OVERDUE invoice correctly", async () => {
      const { PaymentCard } = await import("../PaymentCard");
      const card = {
        id: "feed-pay-2",
        studentId: "std-1",
        cardType: "PaymentCard" as const,
        tier: "T1_action_required" as const,
        priority: 95,
        title: { en: "Overdue Fee Payment", hi: "विलंबित शुल्क भुगतान" },
        summary: { en: "Balance of ₹12,500 is overdue", hi: "₹12,500 का शुल्क देय तिथि पार कर चुका है" },
        payload: {
          invoiceId: "inv-002",
          balanceAmount: 12500,
          lateFeeAmount: 500,
          termName: "Term 2",
          status: "OVERDUE",
        },
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      const el = React.createElement(PaymentCard, { card, studentName: "Aarav" });
      expect(React.isValidElement(el)).toBe(true);
      expect(el.props.card.payload.status).toBe("OVERDUE");
      expect(el.props.card.payload.lateFeeAmount).toBe(500);
    });

    it("PaymentCard: renders PaymentSuccessCard view when paid", async () => {
      const { PaymentCard } = await import("../PaymentCard");
      const card = {
        id: "feed-pay-3",
        studentId: "std-1",
        cardType: "PaymentCard" as const,
        tier: "T3_system_state" as const,
        priority: 95,
        title: { en: "Fee Paid", hi: "शुल्क का भुगतान हो गया" },
        summary: { en: "Payment confirmed", hi: "भुगतान की पुष्टि हो गई" },
        payload: {
          invoiceId: "inv-003",
          balanceAmount: 12500,
          termName: "Term 2",
          lastPaymentStatus: "PAID",
          receiptNumber: "REC-2026-99",
        },
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7200000),
      };

      const el = React.createElement(PaymentCard, { card, studentName: "Aarav" });
      expect(React.isValidElement(el)).toBe(true);
      expect(el.props.card.payload.lastPaymentStatus).toBe("PAID");
    });
  });
});
