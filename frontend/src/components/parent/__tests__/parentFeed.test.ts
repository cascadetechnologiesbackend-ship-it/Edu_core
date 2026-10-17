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
});
