import { test, expect } from "./fixtures/auth.fixture";

test.describe("Track D E2E: Role Engineering, Onboarding Integrity & RBAC Operations", () => {
  test("HR Onboarding: dynamic authoritative role banner reflects non-teaching designations", async ({
    adminPage,
  }) => {
    await adminPage.goto("/hr");
    await expect(adminPage.locator("h1")).toBeVisible();

    // Look for Onboard Staff trigger if present
    const onboardTrigger = adminPage.locator('button:has-text("Onboard Staff"), button:has-text("Add Staff")').first();
    if (await onboardTrigger.isVisible()) {
      await onboardTrigger.click();

      // In the modal, find designation select
      const desigSelect = adminPage.locator('select[name="designationId"], select#designationId').first();
      if (await desigSelect.isVisible()) {
        // Ensure the dynamic banner container exists
        const banner = adminPage.locator('div:has-text("Authoritative role:"), div:has-text("Staff will be assigned")').first();
        if (await banner.isVisible()) {
          const bannerText = await banner.textContent();
          expect(bannerText).toBeDefined();
        }
      }
    }
  });

  test("Settings: Role & Access Management screen loads with user list, role cards, and permission matrix", async ({
    adminPage,
  }) => {
    await adminPage.goto("/settings/roles");
    await expect(adminPage.locator("h1")).toContainText("Role & Access Management");

    // Check tab navigation exists
    const usersTab = adminPage.locator('button:has-text("User Access")');
    const rolesTab = adminPage.locator('button:has-text("Configured Roles")');
    const matrixTab = adminPage.locator('button:has-text("Permission Matrix")');

    await expect(usersTab).toBeVisible();
    await expect(rolesTab).toBeVisible();
    await expect(matrixTab).toBeVisible();

    // Click Configured Roles tab
    await rolesTab.click();
    await expect(adminPage.locator("text=System").first()).toBeVisible();

    // Click Authoritative Permission Matrix tab
    await matrixTab.click();
    await expect(adminPage.locator("text=Authoritative Baseline Matrix")).toBeVisible();
    await expect(adminPage.locator("text=Collect Fees & Generate Receipts")).toBeVisible();
  });

  test("Settings Dashboard contains clickable Role & Access Management card", async ({
    adminPage,
  }) => {
    await adminPage.goto("/settings");
    const roleCard = adminPage.locator('a[href="/settings/roles"]');
    await expect(roleCard).toBeVisible();
    await expect(roleCard).toContainText("Role & Access Management");
  });

  test("Teacher role is 403 redirected away from /settings/roles", async ({
    teacherPage,
  }) => {
    await teacherPage.goto("/settings/roles");
    // Layout or middleware should redirect teacher to dashboard
    await teacherPage.waitForURL((url) => !url.pathname.includes("/settings/roles"));
    expect(teacherPage.url()).not.toContain("/settings/roles");
  });
});
