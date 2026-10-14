import { test, expect } from "@playwright/test";

const PASSWORD = "schoolmitra_dev";

async function loginAs(page: any, email: string) {
  await page.goto("/login");
  await page.fill('input[id="login-email"]', email);
  await page.fill('input[id="login-password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState("domcontentloaded");
}

test.describe("S8 Offline Examinations: RBAC Route & Surface Drill", () => {
  test("TEACHER strictly forbidden from /exams admin subtree and guided to /teacher/grading", async ({ page }) => {
    await loginAs(page, "teacher1@school.edu.in");
    await page.waitForURL(/\/teacher\/dashboard|\/teacher|\/dashboard/);

    // Positive control: Teacher can access teacher grading
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
      // Fail-closed redirect to teacher grading or teacher dashboard
      await page.waitForURL(/\/teacher\/grading|\/teacher\/dashboard|\/dashboard/, { timeout: 10000 });
      await expect(page).not.toHaveURL(new RegExp(route));
    }
  });

  test("PARENT can access admit cards and report cards portals", async ({ page }) => {
    await loginAs(page, "parent1@school.edu.in");
    await page.waitForURL(/\/portal|\/dashboard/);

    await page.goto("/portal/admit-cards");
    await expect(page).toHaveURL(/\/portal\/admit-cards/);

    await page.goto("/portal/report-cards");
    await expect(page).toHaveURL(/\/portal\/report-cards/);

    // Parent forbidden from admin exams
    await page.goto("/exams/manage");
    await page.waitForURL(/\/portal|\/dashboard|\/login/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/\/exams\/manage/);
  });

  test("Public result portal is accessible without authentication", async ({ page }) => {
    // Navigate directly without logging in
    await page.goto("/s/st-xaviers/results");
    // Should render public verification portal or uniform school page, never redirect to /login
    await expect(page).toHaveURL(/\/s\/st-xaviers\/results/);
  });
});
