import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Admission Workflow", () => {
  test("should complete the 6-step admission wizard with DPDP consent", async ({
    page,
  }) => {
    await page.goto("/admissions/apply");

    // Step 1: DPDP Notice Review
    await expect(page.locator("h2, h3, div")).toContainText(/DPDP|Privacy/i);
    await page.click('button:has-text("Continue")');

    // Step 2: Basic Info
    await expect(page.locator("h2")).toContainText("Basic Information");
    await page.fill('input[name="applicantName"]', "Test Student");
    await page.fill('input[name="dateOfBirth"]', "2015-05-10");
    await page.selectOption('select[name="gender"]', "MALE");
    await page.selectOption('select[name="category"]', "GENERAL");
    await page.selectOption('select[name="gradeAppliedFor"]', "CLASS_5");
    await page.click('button:has-text("Continue"), button:has-text("Next")');

    // Step 3: Family Details
    await expect(page.locator("h2")).toContainText("Family Details");
    await page.fill('input[name="fatherName"]', "Test Father");
    await page.fill('input[name="motherName"]', "Test Mother");
    await page.fill('input[name="primaryContactMobile"]', "9876543210");
    await page.fill(
      'input[name="primaryContactEmail"]',
      "testfamily@saraswati.edu",
    );
    await page.fill('input[name="address"]', "123 Test Street, New Delhi");
    await page.fill('input[name="pincode"]', "110001");
    await page.click('button:has-text("Continue"), button:has-text("Next")');

    // Step 4: Documents Upload
    await expect(page.locator("h2")).toContainText("Documents");
    // We could skip or mock file uploads in E2E if they depend on S3.
    // For now, assume it's optional or we just proceed
    await page.click('button:has-text("Continue"), button:has-text("Next")');

    // Step 5: Review
    await expect(page.locator("h2")).toContainText("Review Application");
    await expect(page.locator("text=Test Student")).toBeVisible();
    await page.click('button:has-text("Submit Application")');

    // Step 6: Confirmation
    await expect(
      page
        .locator("h1, h2, h3")
        .filter({ hasText: /Success|Application Submitted/i }),
    ).toBeVisible({ timeout: 10000 });
  });
});
