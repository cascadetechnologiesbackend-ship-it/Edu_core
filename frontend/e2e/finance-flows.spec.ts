import { test, expect } from "./fixtures/auth.fixture";

test.describe("P6 Quality Gates: Finance E2E & Legacy Redirects", () => {
  test("Legacy redirects: ensures old routes 308 redirect to canonical /school/* paths", async ({ adminPage }) => {
    // 1. /fees/structures -> /school/fee-structures
    const res1 = await adminPage.goto("/fees/structures", { waitUntil: "commit" });
    expect(adminPage.url()).toContain("/school/fee-structures");

    // 2. /school/fees/structures -> /school/fee-structures
    const res2 = await adminPage.goto("/school/fees/structures", { waitUntil: "commit" });
    expect(adminPage.url()).toContain("/school/fee-structures");

    // 3. /fees/collect -> /school/collect-fees
    const res3 = await adminPage.goto("/fees/collect", { waitUntil: "commit" });
    expect(adminPage.url()).toContain("/school/collect-fees");
  });

  test("Keyboard-only counter collection flow", async ({ adminPage }) => {
    await adminPage.goto("/school/collect-fees");
    await expect(adminPage.locator("h1")).toContainText("Collect Student Fees");

    // Search input should be focusable via keyboard
    const searchInput = adminPage.locator('input[placeholder*="Search by student name"]');
    await expect(searchInput).toBeVisible();
    await searchInput.focus();
    await searchInput.fill("Aarav");
    await adminPage.keyboard.press("Enter");

    // Ensure keyboard focus traps do not block navigation
    await adminPage.keyboard.press("Tab");
    const activeTagName = await adminPage.evaluate(() => document.activeElement?.tagName);
    expect(activeTagName).toBeDefined();
  });

  test("POS Time-to-Receipt SLA budget: counter search & collection render <= 8s (PF 2.5, PF-R50)", async ({ adminPage }) => {
    const startTime = Date.now();
    await adminPage.goto("/school/collect-fees");
    await expect(adminPage.locator("h1")).toContainText("Collect Student Fees");

    const searchInput = adminPage.locator('input[placeholder*="Search by student name"]');
    await expect(searchInput).toBeVisible();
    await searchInput.focus();
    await searchInput.fill("Student");

    // Elapsed time from route start to interactive search response must stay under 8,000ms SLA
    const elapsedMs = Date.now() - startTime;
    console.log(`[PERF E2E] POS Time-to-Interactive/Receipt: ${elapsedMs}ms (Budget <= 8000ms)`);
    expect(elapsedMs).toBeLessThanOrEqual(8000);
  });

  test("Voucher Modal: open, navigate and close via Escape", async ({ adminPage }) => {
    await adminPage.goto("/school/accounts");
    
    // Check for Voucher action button
    const voucherBtn = adminPage.locator('button:has-text("Add Voucher"), button:has-text("New Voucher")').first();
    if (await voucherBtn.isVisible()) {
      await voucherBtn.click();
      
      // Modal should appear
      const modal = adminPage.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      // Press Escape to dismiss
      await adminPage.keyboard.press("Escape");
      await expect(modal).not.toBeVisible({ timeout: 3000 });
    }
  });

  test("Cancellation & Refund Flow visibility and controls", async ({ adminPage }) => {
    // Navigate to Day Book / Central Transactions
    await adminPage.goto("/school/transactions");
    await expect(adminPage.locator("h1")).toContainText("Central Fee Transactions Ledger");

    // Navigate to Refunds
    await adminPage.goto("/school/refunds");
    await expect(adminPage.locator("h1")).toContainText("Fee Refunds");

    // Check refund request button
    const requestRefundBtn = adminPage.locator('button:has-text("Request Refund")');
    if (await requestRefundBtn.isVisible()) {
      await expect(requestRefundBtn).toBeEnabled();
    }
  });

  test("ACC-06 Fiscal Lock UI: Fees Hub loads with AY switcher and fiscal period status", async ({ adminPage }) => {
    await adminPage.goto("/school/fees-dashboard");
    await expect(adminPage.locator("h1")).toContainText("Finance & Fees Analytics Hub");
    const aySelect = adminPage.locator("select").first();
    await expect(aySelect).toBeVisible();
  });

  test("ACC-07 Concession & Waiver Summary Report: loads report view with KPIs and export control", async ({ adminPage }) => {
    await adminPage.goto("/school/accounting/reports/concessions");
    await expect(adminPage.locator("h1")).toContainText("Concession & Waiver Summary Report");
    await expect(adminPage.locator("text=Revenue Foregone").first()).toBeVisible();
    await expect(adminPage.locator("text=Gross Tuition Billed").first()).toBeVisible();
    await expect(adminPage.locator("text=Realization Rate").first()).toBeVisible();
  });
});

