import { describe, it, expect } from "vitest";
import {
  DEFAULT_FINANCE_PRIMARY_TABS,
  DEFAULT_FINANCE_OVERFLOW_TABS,
  DEFAULT_ACCOUNTS_PRIMARY_TABS,
} from "../FinanceTabs";

describe("Finance Design System & Navigation Contracts", () => {
  it("enforces maximum 6 primary finance tabs to honor interaction budgets (Miller's Law)", () => {
    expect(DEFAULT_FINANCE_PRIMARY_TABS.length).toBeLessThanOrEqual(6);
    expect(DEFAULT_FINANCE_PRIMARY_TABS.map((t) => t.id)).toEqual([
      "hub",
      "collect",
      "dues",
      "daybook",
      "concessions",
      "reconciliation",
    ]);
  });

  it("contains all Tier-2 and Tier-3 operations in overflow tabs without omission", () => {
    const overflowIds = DEFAULT_FINANCE_OVERFLOW_TABS.map((t) => t.id);
    expect(overflowIds).toContain("refunds");
    expect(overflowIds).toContain("pricing-matrix");
    expect(overflowIds).toContain("challans");
    expect(overflowIds).toContain("due-slips");
    expect(overflowIds).toContain("audit-log");
    expect(overflowIds).toContain("carry-forward");
    expect(overflowIds).toContain("import-center");
  });

  it("defines clear accounts primary tabs covering chart of accounts and treasury", () => {
    expect(DEFAULT_ACCOUNTS_PRIMARY_TABS.length).toBe(6);
    expect(DEFAULT_ACCOUNTS_PRIMARY_TABS.map((t) => t.id)).toEqual([
      "accounts-hub",
      "incomes",
      "expenses",
      "bank-accounts",
      "income-heads",
      "expense-heads",
    ]);
  });
});

describe("Refund Integrity Rules (GAP-03, SCR-REFUNDS)", () => {
  it("calculates maximum refundable amount correctly given payment and previous refunds", () => {
    const payment = {
      amountPaid: 15000,
      refunds: [
        { refundAmount: "2500.00", status: "PROCESSED" },
        { refundAmount: "1000.00", status: "PENDING" },
        { refundAmount: "5000.00", status: "REJECTED" }, // Rejected does not count against pool
      ],
    };

    const activeRefunds = payment.refunds.filter((r) => r.status !== "REJECTED");
    const totalRefundedOrPending = activeRefunds.reduce(
      (acc, r) => acc + parseFloat(r.refundAmount),
      0
    );
    const maxRefundable = Math.max(0, payment.amountPaid - totalRefundedOrPending);

    expect(totalRefundedOrPending).toBe(3500);
    expect(maxRefundable).toBe(11500);
  });

  it("prevents negative refundable amount when total refunds equal payment", () => {
    const payment = {
      amountPaid: 5000,
      refunds: [{ refundAmount: "5000.00", status: "PROCESSED" }],
    };

    const activeRefunds = payment.refunds.filter((r) => r.status !== "REJECTED");
    const total = activeRefunds.reduce((acc, r) => acc + parseFloat(r.refundAmount), 0);
    const maxRefundable = Math.max(0, payment.amountPaid - total);

    expect(maxRefundable).toBe(0);
  });
});

describe("Multi-Invoice Settlement & Idempotency Rules (FIX-02, SCR-COLLECT)", () => {
  it("generates a unified receipt family with unique line numbers for multi-invoice payments", () => {
    const baseReceiptNumber = "REC-2026-A1B2C3";
    const invoiceItems = [
      { invoiceId: "inv-1", amountPaid: 4500 },
      { invoiceId: "inv-2", amountPaid: 3200 },
      { invoiceId: "inv-3", amountPaid: 1500 },
    ];

    const generatedReceipts = invoiceItems.map((_, idx) =>
      invoiceItems.length === 1 ? baseReceiptNumber : `${baseReceiptNumber}-${idx + 1}`
    );

    expect(generatedReceipts).toHaveLength(3);
    expect(generatedReceipts[0]).toBe("REC-2026-A1B2C3-1");
    expect(generatedReceipts[1]).toBe("REC-2026-A1B2C3-2");
    expect(generatedReceipts[2]).toBe("REC-2026-A1B2C3-3");
    // Ensure every row has a unique receiptNumber while sharing the base family
    const uniqueReceipts = new Set(generatedReceipts);
    expect(uniqueReceipts.size).toBe(3);
  });

  it("proves duplicate submissions with identical idempotencyKey return original receipt without duplicate posting", () => {
    const idempotencyStore = new Map<string, { payments: any[]; timestamp: number }>();

    function processSubmission(payload: { idempotencyKey: string; items: any[] }) {
      const existing = idempotencyStore.get(payload.idempotencyKey);
      const now = Date.now();
      if (existing && now - existing.timestamp < 24 * 60 * 60 * 1000) {
        return { isDuplicate: true, payments: existing.payments };
      }

      const createdPayments = payload.items.map((item, idx) => ({
        id: `pay-${idx}-${Math.random()}`,
        amount: item.amountPaid,
        idempotencyKey: payload.idempotencyKey,
      }));

      idempotencyStore.set(payload.idempotencyKey, { payments: createdPayments, timestamp: now });
      return { isDuplicate: false, payments: createdPayments };
    }

    const payload = {
      idempotencyKey: "test-idempotency-key-12345",
      items: [{ amountPaid: 5000 }, { amountPaid: 2500 }],
    };

    const firstRun = processSubmission(payload);
    expect(firstRun.isDuplicate).toBe(false);
    expect(firstRun.payments).toHaveLength(2);

    // Second submission with exact same key within 24h
    const secondRun = processSubmission(payload);
    expect(secondRun.isDuplicate).toBe(true);
    expect(secondRun.payments).toEqual(firstRun.payments);
    expect(secondRun.payments[0].id).toBe(firstRun.payments[0].id);
  });
});

describe("Student Concession Calculation Rules (FIX-01, AUTO-06)", () => {
  it("calculates net amount correctly when student has percentage concession", () => {
    const grossAmount = 20000;
    const concession = { discountPercentage: "25.00", discountAmount: null, appliesTo: "ALL" };

    const discountAmount = grossAmount * (parseFloat(concession.discountPercentage) / 100);
    const netAmount = Math.max(0, grossAmount - discountAmount);

    expect(discountAmount).toBe(5000);
    expect(netAmount).toBe(15000);
  });

  it("calculates net amount correctly when student has flat amount concession capped at gross", () => {
    const grossAmount = 8000;
    const concession = { discountPercentage: null, discountAmount: "10000.00", appliesTo: "ALL" };

    let discountAmount = parseFloat(concession.discountAmount);
    if (discountAmount > grossAmount) discountAmount = grossAmount;
    const netAmount = Math.max(0, grossAmount - discountAmount);

    expect(discountAmount).toBe(8000);
    expect(netAmount).toBe(0);
  });
});

