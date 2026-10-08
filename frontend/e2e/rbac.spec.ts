import { test, expect } from "./fixtures/auth.fixture";

test.describe("Role-Based Access Control (RBAC) & Redirection Workflows", () => {
  test("admin role redirects to /dashboard and sees admin dashboard with full menus", async ({
    adminPage,
  }) => {
    await adminPage.goto("/dashboard");
    await expect(adminPage.locator("h1")).toContainText(
      "Good morning, Admin 👋",
    );

    // Sidebar should contain admin links
    await expect(
      adminPage.locator('nav a:has-text("HR & Payroll")'),
    ).toBeVisible();
    await expect(adminPage.locator('nav a:has-text("Fees")')).toBeVisible();
    await expect(adminPage.locator('nav a:has-text("Settings")')).toBeVisible();
  });

  test("teacher role redirects to /dashboard and sees teacher dashboard, hiding admin-only menus", async ({
    teacherPage,
  }) => {
    await teacherPage.goto("/dashboard");
    await expect(teacherPage.locator("h1")).toContainText(
      "Welcome back, Teacher 👋",
    );

    // Mapped class cards
    await expect(teacherPage.locator("text=Assigned Classrooms")).toBeVisible();
    await expect(teacherPage.locator("text=Active Tasks")).toBeVisible();

    // Administrative sidebar links should be hidden
    await expect(
      teacherPage.locator('nav a:has-text("HR & Payroll")'),
    ).toBeHidden();
    await expect(teacherPage.locator('nav a:has-text("Fees")')).toBeHidden();
    await expect(
      teacherPage.locator('nav a:has-text("Settings")'),
    ).toBeHidden();
  });

  test("parent role redirects to /portal and is blocked from admin pages", async ({
    parentPage,
  }) => {
    // 1. Visit parent portal directly
    await parentPage.goto("/portal");
    await expect(parentPage.locator("h1")).toContainText("Fee Management");

    // 2. Try to directly navigate to admin dashboard - should trigger layout redirect to /portal
    await parentPage.goto("/dashboard");
    await parentPage.waitForURL("**/portal");
    await expect(parentPage.locator("h1")).toContainText("Fee Management");
  });

  test("accountant role lands on /school/fees-dashboard and direct-navigation redirects server-side (AM-04)", async ({
    accountantPage,
  }) => {
    // 1. Visit default landing
    await accountantPage.goto("/school/fees-dashboard");
    await expect(accountantPage).toHaveURL(/\/school\/fees-dashboard/);

    // Assert only finance navigation is visible, non-finance modules are absent
    await expect(accountantPage.locator('nav a:has-text("Admissions")')).toBeHidden();
    await expect(accountantPage.locator('nav a:has-text("Students")')).toBeHidden();
    await expect(accountantPage.locator('nav a:has-text("HR & Payroll")')).toBeHidden();
    await expect(accountantPage.locator('nav a:has-text("Settings")')).toBeHidden();

    // 2. Direct-navigate to unauthorized routes: /students, /exams, /hr, /settings/roles
    const unauthorizedRoutes = ["/students", "/exams", "/hr", "/settings/roles"];
    for (const route of unauthorizedRoutes) {
      await accountantPage.goto(route);
      // Server guard redirects to defaultDashboard
      await accountantPage.waitForURL(/\/school\/fees-dashboard/, { timeout: 10000 });
      await expect(accountantPage).toHaveURL(/\/school\/fees-dashboard/);
    }
  });
});
