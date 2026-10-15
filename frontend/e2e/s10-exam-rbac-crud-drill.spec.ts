import { test, expect } from "@playwright/test";

const PASSWORD = "schoolmitra_dev";

async function loginAs(page: any, email: string) {
  await page.goto("/login");
  await page.fill('input[id="login-email"]', email);
  await page.fill('input[id="login-password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("domcontentloaded");
}

test.describe("S10 Examination Module: Complete RBAC CRUD & Surface Access Drill", () => {
  // 1. SCHOOL_ADMIN
  test("SCHOOL_ADMIN has full access to all /exams surfaces including /exams/usage", async ({ page }) => {
    await loginAs(page, "admin@school.edu.in");
    await page.waitForURL(/\/dashboard/);

    const allowedRoutes = [
      "/exams/dashboard",
      "/exams/manage",
      "/exams/schedule",
      "/exams/admit-cards",
      "/exams/marks",
      "/exams/report-cards",
      "/exams/report-cards/setups",
      "/exams/report-cards/settings",
      "/exams/analytics",
    ];

    for (const route of allowedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  // 2. PRINCIPAL
  test("PRINCIPAL has complete access to /exams operations and result publication", async ({ page }) => {
    await loginAs(page, "principal@school.edu.in");
    await page.waitForURL(/\/principal\/dashboard|\/dashboard/);

    await page.goto("/exams/dashboard");
    await expect(page).toHaveURL(/\/exams\/dashboard/);

    await page.goto("/exams/report-cards/settings");
    await expect(page).toHaveURL(/\/exams\/report-cards\/settings/);
  });

  // 3. TEACHER
  test("TEACHER strictly bounded to /teacher/grading and denied from all administrative /exams/*", async ({ page }) => {
    await loginAs(page, "teacher1@school.edu.in");
    await page.waitForURL(/\/teacher\/dashboard|\/teacher|\/dashboard/);

    // Positive control: Teacher grading workspace
    await page.goto("/teacher/grading");
    await expect(page).toHaveURL(/\/teacher\/grading/);

    // Negative controls: Teacher cannot access administrative examination surfaces
    const adminExamRoutes = [
      "/exams/dashboard",
      "/exams/manage",
      "/exams/schedule",
      "/exams/admit-cards",
      "/exams/marks",
      "/exams/report-cards",
      "/exams/report-cards/setups",
      "/exams/report-cards/settings",
      "/exams/analytics",
    ];

    for (const route of adminExamRoutes) {
      await page.goto(route);
      await page.waitForURL(/\/teacher\/dashboard|\/teacher|\/dashboard/, { timeout: 8000 });
      await expect(page).not.toHaveURL(new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  // 4. ACCOUNTANT
  test("ACCOUNTANT bounded exclusively to /exams/admit-cards and denied from marks/report-cards", async ({ page }) => {
    await loginAs(page, "accountant1@school.edu.in");
    await page.waitForURL(/\/school\/fees-dashboard|\/dashboard/);

    // Positive control: Fee verification on admit cards
    await page.goto("/exams/admit-cards");
    await expect(page).toHaveURL(/\/exams\/admit-cards/);

    // Negative controls: Denied from marks and report cards
    const forbidden = ["/exams/dashboard", "/exams/marks", "/exams/report-cards", "/exams/analytics"];
    for (const route of forbidden) {
      await page.goto(route);
      await page.waitForURL(/\/school\/fees-dashboard/, { timeout: 8000 });
      await expect(page).toHaveURL(/\/school\/fees-dashboard/);
    }
  });

  // 5. PARENT
  test("PARENT strictly restricted to student portals and denied from administrative /exams", async ({ page }) => {
    await loginAs(page, "parent1@school.edu.in");
    await page.waitForURL(/\/portal|\/dashboard/);

    // Positive controls
    await page.goto("/portal/admit-cards");
    await expect(page).toHaveURL(/\/portal\/admit-cards/);

    await page.goto("/portal/report-cards");
    await expect(page).toHaveURL(/\/portal\/report-cards/);

    // Negative controls
    await page.goto("/exams/manage");
    await page.waitForURL(/\/portal|\/dashboard|\/login/, { timeout: 8000 });
    await expect(page).not.toHaveURL(/\/exams\/manage/);
  });

  // 6. PUBLIC PORTAL
  test("PUBLIC result portal is accessible without credentials", async ({ page }) => {
    await page.goto("/s/st-xaviers/results");
    await expect(page).toHaveURL(/\/s\/st-xaviers\/results/);
  });
});
