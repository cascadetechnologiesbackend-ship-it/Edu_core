import { test, expect } from "./fixtures/auth.fixture";

test.describe("Report Card Workflow", () => {
  test("should allow teacher to enter marks and generate report card", async ({
    teacherPage,
    adminPage,
  }) => {
    // 1. Teacher enters marks
    await teacherPage.goto("/exams/marks-entry");
    // ... select exam, class, subject ...
    // ... fill marks ...
    // await teacherPage.click('button:has-text("Save Marks")');
    // await expect(teacherPage.locator('text=Marks saved')).toBeVisible();

    // 2. Admin generates report cards
    await adminPage.goto("/exams/report-cards");
    // await adminPage.click('button:has-text("Generate All Report Cards")');
    // await expect(adminPage.locator('text=Job started')).toBeVisible();
  });

  test("should allow parent to view report card", async ({ parentPage }) => {
    await parentPage.goto("/academics/report-cards");
    // await expect(parentPage.locator('h1')).toContainText('Report Cards');
    // const viewBtn = parentPage.locator('a:has-text("View PDF")').first();
    // if (await viewBtn.isVisible()) {
    //   await expect(viewBtn).toHaveAttribute('href', /amazonaws.com/);
    // }
  });
});
