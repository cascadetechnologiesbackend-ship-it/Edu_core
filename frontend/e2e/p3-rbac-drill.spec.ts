import { test, expect } from "@playwright/test";

const PASSWORD = "schoolmitra_dev";

async function loginAs(page: any, email: string) {
  await page.goto("/login");
  await page.fill('input[id="login-email"]', email);
  await page.fill('input[id="login-password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("domcontentloaded");
}

test.describe("P3-T1: RBAC Direct-URL Denial Drill (All Roles Matrix)", () => {
  // 1. ACCOUNTANT
  test("ACCOUNTANT forbidden routes redirect to /school/fees-dashboard", async ({ page }) => {
    await loginAs(page, "accountant1@school.edu.in");
    await page.waitForURL(/\/school\/fees-dashboard|\/dashboard/);

    // Positive control
    await page.goto("/school/fees-dashboard");
    await expect(page).toHaveURL(/\/school\/fees-dashboard/);

    const forbidden = ["/students", "/exams", "/hr", "/settings/roles", "/dpdp"];
    for (const route of forbidden) {
      await page.goto(route);
      await page.waitForURL(/\/school\/fees-dashboard/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/school\/fees-dashboard/);
    }
  });

  // 2. TEACHER
  test("TEACHER forbidden routes redirect to /teacher/dashboard", async ({ page }) => {
    await loginAs(page, "teacher1@school.edu.in");
    await page.waitForURL(/\/teacher\/dashboard|\/teacher|\/dashboard/);

    // Positive control
    await page.goto("/teacher/dashboard");
    await expect(page).toHaveURL(/\/teacher\/dashboard/);

    const forbidden = ["/hr", "/settings/roles", "/school/collect-fees", "/super-admin/dashboard"];
    for (const route of forbidden) {
      await page.goto(route);
      await page.waitForURL(/\/teacher\/dashboard/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/teacher\/dashboard/);
    }
  });

  // 3. LIBRARIAN
  test("LIBRARIAN forbidden routes redirect to /librarian/dashboard", async ({ page }) => {
    await loginAs(page, "librarian1@school.edu.in");
    await page.waitForURL(/\/librarian\/dashboard|\/library|\/dashboard/);

    // Positive control
    await page.goto("/library");
    await expect(page).toHaveURL(/\/library/);

    const forbidden = ["/students", "/exams", "/school/fees-dashboard"];
    for (const route of forbidden) {
      await page.goto(route);
      await page.waitForURL(/\/librarian\/dashboard/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/librarian\/dashboard/);
    }
  });

  // 4. TRANSPORT_MANAGER
  test("TRANSPORT_MANAGER forbidden routes redirect to /transport/dashboard", async ({ page }) => {
    await loginAs(page, "transport1@school.edu.in");
    await page.waitForURL(/\/transport\/dashboard|\/transport|\/dashboard/);

    // Positive control
    await page.goto("/transport");
    await expect(page).toHaveURL(/\/transport/);

    const forbidden = ["/students", "/hr", "/library"];
    for (const route of forbidden) {
      await page.goto(route);
      await page.waitForURL(/\/transport\/dashboard/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/transport\/dashboard/);
    }
  });

  // 5. PARENT
  test("PARENT forbidden routes redirect to /parent/dashboard", async ({ page }) => {
    await loginAs(page, "parent1@school.edu.in");
    await page.waitForURL(/\/parent\/dashboard|\/portal|\/dashboard/);

    // Positive control
    await page.goto("/parent/dashboard");
    await expect(page).toHaveURL(/\/parent\/dashboard/);

    const forbidden = ["/students", "/admissions", "/settings"];
    for (const route of forbidden) {
      await page.goto(route);
      await page.waitForURL(/\/parent\/dashboard|\/portal/, { timeout: 10000 });
      expect(page.url()).toMatch(/\/parent\/dashboard|\/portal/);
    }
  });

  // 6. STUDENT
  test("STUDENT forbidden routes redirect to /student/dashboard", async ({ page }) => {
    await loginAs(page, "student1@school.edu.in");
    await page.waitForURL(/\/student\/dashboard|\/dashboard/);

    // Positive control
    await page.goto("/student/dashboard");
    await expect(page).toHaveURL(/\/student\/dashboard/);

    const forbidden = ["/teacher", "/school/collect-fees"];
    for (const route of forbidden) {
      await page.goto(route);
      await page.waitForURL(/\/student\/dashboard|\/portal/, { timeout: 10000 });
      expect(page.url()).toMatch(/\/student\/dashboard|\/portal/);
    }
  });

  // 7. DRIVER
  test("DRIVER forbidden routes redirect to /driver/dashboard", async ({ page }) => {
    await loginAs(page, "driver1@school.edu.in");
    await page.waitForURL(/\/driver\/dashboard|\/dashboard/);

    // Positive control
    await page.goto("/driver/dashboard");
    await expect(page).toHaveURL(/\/driver\/dashboard/);

    const forbidden = ["/students", "/transport"];
    for (const route of forbidden) {
      await page.goto(route);
      await page.waitForURL(/\/driver\/dashboard/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/driver\/dashboard/);
    }
  });

  // 8. SCHOOL_ADMIN
  test("SCHOOL_ADMIN forbidden routes redirect to /dashboard", async ({ page }) => {
    await loginAs(page, "school_admin1@school.edu.in");
    await page.waitForURL(/\/dashboard|\/school/);

    // Positive control
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);

    const forbidden = ["/super-admin/schools", "/super-admin/audit"];
    for (const route of forbidden) {
      await page.goto(route);
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  // 9. Unauthenticated session check
  test("Unauthenticated access to guarded routes redirects to /login", async ({ page }) => {
    const guarded = ["/dashboard", "/students", "/school/fees-dashboard", "/hr", "/super-admin/dashboard"];
    for (const route of guarded) {
      await page.goto(route);
      await page.waitForURL(/\/login/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
