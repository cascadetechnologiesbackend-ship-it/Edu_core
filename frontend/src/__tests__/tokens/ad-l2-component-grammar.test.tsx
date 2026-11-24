// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, getButtonClasses } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  InsetGroupedListSection,
  InsetGroupedListItem,
} from "@/components/ui/InsetGroupedList";
import { MetricCard } from "@/components/ui/MetricCard";

describe("Phase AD-L2: Component Grammar", () => {
  describe("Button Component Tiers", () => {
    it("renders filled button with interactive tint and 44pt touch target", () => {
      render(<Button tier="filled">Primary CTA</Button>);
      const btn = screen.getByRole("button", { name: "Primary CTA" });
      expect(btn.className).toContain("bg-semantic-interactive");
      expect(btn.className).toContain("text-white");
      expect(btn.className).toContain("h-11");
    });

    it("renders tinted button for secondary action in an action row", () => {
      render(<Button tier="tinted">Secondary Action</Button>);
      const btn = screen.getByRole("button", { name: "Secondary Action" });
      expect(btn.className).toContain("bg-semantic-interactive/12");
      expect(btn.className).toContain("text-semantic-interactive");
    });

    it("renders plain button with tinted text", () => {
      render(<Button tier="plain">Plain Action</Button>);
      const btn = screen.getByRole("button", { name: "Plain Action" });
      expect(btn.className).toContain("text-semantic-interactive");
      expect(btn.className).toContain("bg-transparent");
    });

    it("renders gray button for cancel/negative-space", () => {
      render(<Button tier="gray">Cancel</Button>);
      const btn = screen.getByRole("button", { name: "Cancel" });
      expect(btn.className).toContain("bg-muted");
    });

    it("renders destructive button in plain or tinted red", () => {
      render(<Button tier="destructive">Delete Item</Button>);
      const btn = screen.getByRole("button", { name: "Delete Item" });
      expect(btn.className).toContain("text-semantic-money-owed");
    });

    it("renders compact size for data table density", () => {
      render(
        <Button tier="tinted" size="sm">
          Compact
        </Button>
      );
      const btn = screen.getByRole("button", { name: "Compact" });
      expect(btn.className).toContain("h-9");
      expect(btn.className).toContain("text-xs");
    });
  });

  describe("StatusBadge Semantic Intention", () => {
    it("renders money_in semantics for active and completed statuses", () => {
      const { container } = render(<StatusBadge status="active" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-semantic-money-in");
      expect(badge?.className).toContain("bg-semantic-money-in/12");
    });

    it("renders attention semantics for pending and warning statuses", () => {
      const { container } = render(<StatusBadge status="pending" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-semantic-attention");
      expect(badge?.className).toContain("bg-semantic-attention/12");
    });

    it("renders money_owed semantics for error and overdue statuses", () => {
      const { container } = render(<StatusBadge status="overdue" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-semantic-money-owed");
      expect(badge?.className).toContain("bg-semantic-money-owed/12");
    });

    it("renders provisional semantics for draft status", () => {
      const { container } = render(<StatusBadge status="draft" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("bg-semantic-provisional/15");
    });

    it("renders neutral semantics for neutral status", () => {
      const { container } = render(<StatusBadge status="neutral" />);
      const badge = container.querySelector("span");
      expect(badge?.className).toContain("text-muted-foreground");
      expect(badge?.className).toContain("bg-semantic-neutral/15");
    });
  });

  describe("SegmentedControl Component", () => {
    it("renders options with accessible tablist semantics and allows selection", () => {
      const handleChange = vi.fn();
      render(
        <SegmentedControl
          value="overview"
          onChange={handleChange}
          options={[
            { value: "overview", label: "Overview" },
            { value: "analytics", label: "Analytics" },
            { value: "reports", label: "Reports" },
          ]}
        />
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeTruthy();

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(3);
      expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
      expect(tabs[1]?.getAttribute("aria-selected")).toBe("false");

      if (tabs[1]) {
        fireEvent.click(tabs[1]);
      }
      expect(handleChange).toHaveBeenCalledWith("analytics");
    });
  });

  describe("InsetGroupedList Component", () => {
    it("renders grouped card with uppercase header and chevron affordances", () => {
      const handleClick = vi.fn();
      render(
        <InsetGroupedListSection title="Account Settings">
          <InsetGroupedListItem
            title="Profile"
            subtitle="Manage your personal details"
            onClick={handleClick}
          />
          <InsetGroupedListItem
            title="Billing"
            subtitle="View invoices and statements"
            href="/billing"
          />
        </InsetGroupedListSection>
      );

      const header = screen.getByText("Account Settings");
      expect(header.className).toContain("uppercase");
      expect(screen.getByText("Profile")).toBeTruthy();
      expect(screen.getByText("Manage your personal details")).toBeTruthy();

      fireEvent.click(screen.getByText("Profile"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("MetricCard Component", () => {
    it("renders value in tabular numerals with semantic trend coloring", () => {
      render(
        <MetricCard
          title="Monthly Fee Collection"
          value="₹12,45,000"
          trend={{ value: "+8.4%", direction: "up", label: "vs last month" }}
        />
      );

      const val = screen.getByText("₹12,45,000");
      expect(val.className).toContain("tabular-nums");
      expect(val.className).toContain("font-mono");

      const trendVal = screen.getByText("+8.4%");
      const trendBadge = trendVal.parentElement;
      expect(trendBadge?.className).toContain("text-semantic-money-in");
    });
  });
});
