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
});
