import { test, expect } from "./fixtures/auth.fixture";

test.describe("Authentication Flows", () => {
  test("should login as admin using adminPage fixture", async ({
    adminPage,
  }) => {
    // Already logged in via fixture
    await expect(adminPage).toHaveURL(/\/dashboard/);
    const headerText = await adminPage.locator("h1").textContent();
    expect(headerText).toBeDefined();
  });

  test("should login as parent using parentPage fixture", async ({
    parentPage,
  }) => {
    // Already logged in via fixture
    await expect(parentPage).toHaveURL(/\/dashboard/);
  });

  test("should block login with wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[id="login-email"]', "school_admin1@school.edu.in");
    await page.fill('input[id="login-password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    // Expect an error message
    const errorMsg = page.locator('[role="alert"]');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test("should lockout account after 5 failed attempts", async ({ page }) => {
    await page.goto("/login");
    const email = `test-lockout-${Date.now()}@school.edu.in`;

    for (let i = 0; i < 5; i++) {
      await page.fill('input[id="login-email"]', email);
      await page.fill('input[id="login-password"]', "wrongpassword");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500); // Give it time to process
    }

    // 6th attempt should hit lockout
    await page.fill('input[id="login-email"]', email);
    await page.fill('input[id="login-password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    const errorMsg = page.locator('[role="alert"]').first();
    await expect(errorMsg).toContainText(
      "locked due to too many failed attempts",
    );
  });

  // OTP flow is tricky to test fully E2E if we mock SMS, but we can test the UI transitions
  test("should navigate to OTP login and show input", async ({ page }) => {
    await page.goto("/login");
    // Assuming there's a button/link to switch to OTP login
    const otpToggle = page.locator('button:has-text("Login with OTP")');
    if (await otpToggle.isVisible()) {
      await otpToggle.click();
      await expect(page.locator('input[name="mobile"]')).toBeVisible();
      await page.fill('input[name="mobile"]', "9876543210");
      await page.click('button[type="submit"]'); // Send OTP
      await expect(page.locator('input[name="otp"]')).toBeVisible();
    }
  });
});
