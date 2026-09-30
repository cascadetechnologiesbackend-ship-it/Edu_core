import { test, expect } from "./fixtures/auth.fixture";

test.describe("Academics Module E2E Flow", () => {
  test("should allow admin to manage subjects, mapping, and timetables", async ({
    adminPage,
  }) => {
    // 1. Open Academics Page
    await adminPage.goto("/academics");
    await expect(adminPage.locator("h1")).toContainText("Academic Management");

    // 2. Add Subject
    await adminPage.click('button:has-text("Subject Master")');
    await expect(adminPage.locator("h2")).toContainText(
      "Subject Master Directory",
    );

    const addSubjectBtn = adminPage.locator('button:has-text("Add Subject")');
    await expect(addSubjectBtn).toBeVisible();
    await addSubjectBtn.click();

    // Fill subject form
    await adminPage.fill("input[required]", "SCI201"); // Code
    await adminPage.locator("input[required]").nth(1).fill("Science Practical"); // Name
    await adminPage.selectOption("select", "PRACTICAL"); // Type
    await adminPage.click('button[type="submit"]');
    await expect(
      adminPage.locator('h3:has-text("Add Subject Master Entry")'),
    ).toBeHidden();

    // Verify subject is in table
    await expect(adminPage.locator("tbody")).toContainText("SCI201");
    await expect(adminPage.locator("tbody")).toContainText("Science Practical");

    // 3. Map Subject
    await adminPage.click('button:has-text("Subject Mapping")');
    await expect(adminPage.locator("h2")).toContainText(
      "Subject-Teacher Mapping",
    );

    const mapBtn = adminPage.locator('button:has-text("Map Subject")');
    await expect(mapBtn).toBeVisible();
    await mapBtn.click();

    // Select the newly created subject
    await adminPage
      .locator("select")
      .nth(1)
      .selectOption({ label: "SCI201 - Science Practical" });

    // Submit mapped classroom and subject
    await adminPage.click('button[type="submit"]');
    await expect(
      adminPage.locator('h3:has-text("Map Subject to Class")'),
    ).toBeHidden();

    // 4. Manage Timetable Grid
    await adminPage.click('button:has-text("Timetable Grid")');
    await expect(adminPage.locator("h2")).toContainText(
      "Weekly Timetable Grid",
    );

    // Locate Monday Period 1 cell
    const mondayP1Cell = adminPage
      .locator("tbody tr")
      .first()
      .locator("td")
      .nth(1);
    await expect(mondayP1Cell).toBeVisible();
    await mondayP1Cell.click();

    // Fill timetable period modal
    const savePeriodBtn = adminPage.locator('button:has-text("Save Period")');
    await expect(savePeriodBtn).toBeVisible();
    await savePeriodBtn.click();
    await expect(
      adminPage.locator('h3:has-text("Schedule Period")'),
    ).toBeHidden();

    // Grid cell should no longer be "+ Add" (empty placeholder)
    await expect(mondayP1Cell).not.toContainText("+ Add");
  });

  test("should allow teacher to publish assignments", async ({
    teacherPage,
  }) => {
    await teacherPage.goto("/academics");
    await expect(teacherPage.locator("h1")).toContainText(
      "Academic Management",
    );

    await teacherPage.click('button:has-text("Assignments & Grading")');
    await expect(teacherPage.locator("h2")).toContainText(
      "Assignments & Home Work",
    );

    const newAssignBtn = teacherPage.locator(
      'button:has-text("New Assignment")',
    );
    await expect(newAssignBtn).toBeVisible();
    await newAssignBtn.click();

    // Fill Assignment Form
    await teacherPage.fill("input[required]", "Math Chapter 3 Homework");
    await teacherPage
      .locator("textarea[required]")
      .fill("Solve all exercises in chapter 3.");
    await teacherPage.click('button[type="submit"]');
    await expect(
      teacherPage.locator('h3:has-text("Create Assignment")'),
    ).toBeHidden();

    // Verify it is created in the sidebar list
    await expect(
      teacherPage.locator('h3:has-text("Assignments") + div'),
    ).toContainText("Math Chapter 3 Homework");
  });
});
