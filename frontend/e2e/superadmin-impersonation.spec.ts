import { test, expect } from "@playwright/test";

const SUPER_ADMIN_EMAIL = "cascadetechnologiessolutions@gmail.com";
const SUPER_ADMIN_PASSWORD = "P4jkbnixj4@";

test.describe("S6: Super Admin Platform Dashboard & Tenant Impersonation E2E", () => {
  test("super admin logs into platform dashboard, inspects schools, and impersonates school tenant", async ({
    page,
  }) => {
    // 1. Login as SUPER_ADMIN
    await page.goto("/login");
    await page.fill('input[id="login-email"]', SUPER_ADMIN_EMAIL);
    await page.fill('input[id="login-password"]', SUPER_ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // 2. Super admin is routed to super-admin platform dashboard or platform redirect
    await page.waitForURL(/\/super-admin\/dashboard|\/dashboard|\/super-admin/, {
      timeout: 15000,
      waitUntil: "domcontentloaded",
    });

    // 3. Navigate to Super Admin Schools Directory
    await page.goto("/super-admin/schools");
    await expect(page).toHaveURL(/\/super-admin\/schools/);

    // 4. Verify schools table renders school rows
    const schoolRows = page.locator("table tbody tr, [data-testid='school-row']");
    await expect(schoolRows.first()).toBeVisible({ timeout: 10000 });
    const count = await schoolRows.count();
    expect(count).toBeGreaterThan(0);

    // 5. Trigger impersonation for the first available school
    const impersonateBtn = page.locator('button:has-text("Impersonate")').first();
    await expect(impersonateBtn).toBeVisible();
    await impersonateBtn.click();

    // 6. Impersonation sets sm_impersonation cookie and routes to tenant dashboard
    await page.waitForURL((url) => url.pathname === "/dashboard", {
      timeout: 15000,
      waitUntil: "domcontentloaded",
    });

    // Verify impersonation cookie is present in browser context
    const cookies = await page.context().cookies();
    const impCookie = cookies.find((c) => c.name === "sm_impersonation");
    expect(impCookie).toBeDefined();

    // 7. Complete an attendance action under impersonation
    await page.goto("/attendance");
    await page.waitForURL(/\/attendance/, { timeout: 10000 });
    await expect(page.locator("h1, h2, main").first()).toBeVisible({ timeout: 10000 });
  });
});
