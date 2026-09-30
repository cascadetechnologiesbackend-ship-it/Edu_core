import { test, expect } from "./fixtures/auth.fixture";

test.describe("Library Management Module Flow", () => {
  test("admin can view library catalog, members, and transactions", async ({
    adminPage,
  }) => {
    // 1. Navigate to library
    await adminPage.goto("/library");

    // 2. Assert page header
    await expect(adminPage.locator("h1")).toContainText("Library Management");

    // 3. Overview tab stats should be visible
    await expect(adminPage.locator("text=Total Catalog Copies")).toBeVisible({
      timeout: 10000,
    });
    await expect(adminPage.locator("text=Active Checked Out")).toBeVisible();

    // 4. Switch to Books tab and verify seeded books
    await adminPage.click('button:has-text("Books")');
    await expect(
      adminPage.locator("text=Introduction to Algorithms"),
    ).toBeVisible();
    await expect(adminPage.locator("text=BC-INT-01")).toBeVisible();

    // 5. Switch to Members tab and verify seeded member card
    await adminPage.click('button:has-text("Members")');
    await expect(adminPage.locator("text=LIB-ST-1001")).toBeVisible();
  });

  test("admin can add a new book to the catalog", async ({ adminPage }) => {
    await adminPage.goto("/library");
    await adminPage.click('button:has-text("Books")');

    // Click Add Book
    const addBtn = adminPage.locator('button:has-text("Add Book")');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Fill form
    const modal = adminPage.locator(
      'form:has(h3:has-text("Register New Book Volume"))',
    );
    await expect(modal).toBeVisible();

    await modal
      .locator('input[placeholder*="Intro to Algorithms"]')
      .fill("Clean Code");
    await modal
      .locator('input[placeholder*="Thomas H. Cormen"]')
      .fill("Robert C. Martin");
    await modal.locator('input[placeholder*="Reference"]').fill("Technical");
    await modal.locator('input[placeholder*="Rack A-3"]').fill("Rack B-1");

    // Submit
    await modal.locator('button:has-text("Catalog Book")').click();
    await expect(modal).toBeHidden({ timeout: 10000 });

    // Verify new book appears in lists
    await expect(adminPage.locator("text=Clean Code")).toBeVisible();
  });

  test("admin can issue and return book copies", async ({ adminPage }) => {
    await adminPage.goto("/library");

    // Issue book
    const checkoutForm = adminPage
      .locator('h3:has-text("Book Checkout")')
      .locator("..");
    await expect(checkoutForm).toBeVisible();

    // Fill checkout form (issue Bjarne Stroustrup's C++ book copy BC-THE-01 to LIB-ST-1001)
    await checkoutForm.locator("input").first().fill("BC-THE-01");
    await checkoutForm.locator("input").nth(1).fill("LIB-ST-1001");

    await checkoutForm.locator('button:has-text("Confirm Book Issue")').click();

    // Switch to Transactions tab to verify active issue log
    await adminPage.click('button:has-text("Transactions")');
    await expect(adminPage.locator("text=BC-THE-01").first()).toBeVisible({
      timeout: 10000,
    });

    // Return book
    await adminPage.click('button:has-text("Overview")');
    const returnForm = adminPage
      .locator('h3:has-text("Book Return")')
      .locator("..");
    await expect(returnForm).toBeVisible();

    // Select return option (matches BC-THE-01)
    await returnForm.locator("select").first().selectOption({ index: 1 });
    await returnForm.locator('button:has-text("Confirm Book Return")').click();

    // Verify returns transaction updates status
    await adminPage.click('button:has-text("Transactions")');
    const statusLabel = adminPage
      .locator('tr:has-text("BC-THE-01")')
      .locator("text=RETURNED");
    await expect(statusLabel.first()).toBeVisible({ timeout: 10000 });
  });
});
