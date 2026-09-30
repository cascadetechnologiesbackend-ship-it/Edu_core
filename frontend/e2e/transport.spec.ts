import { test, expect } from "./fixtures/auth.fixture";

test.describe("Transport Module Flow", () => {
  test("admin can view vehicles tab and see seeded vehicle", async ({
    adminPage,
  }) => {
    // 1. Navigate to transport
    await adminPage.goto("/transport");

    // 2. Assert page header
    await expect(adminPage.locator("h1")).toContainText("Transport Management");

    // 3. Vehicles tab should be active by default
    await expect(
      adminPage.locator("text=Vehicles & Drivers Directory"),
    ).toBeVisible({ timeout: 10000 });

    // 4. Seeded vehicle BUS-01 should appear in table
    await expect(adminPage.locator("text=BUS-01")).toBeVisible();
    await expect(adminPage.locator("text=MH-12-QQ-1234")).toBeVisible();

    // 5. Verify PII decryption works — driver name should be visible
    await expect(adminPage.locator("text=Rajesh Kumar")).toBeVisible();
  });

  test("admin can view routes tab and see seeded route with stops", async ({
    adminPage,
  }) => {
    await adminPage.goto("/transport");

    // Switch to Routes & Stops tab
    await adminPage.click('button:has-text("Routes & Stops")');

    // Verify seeded route
    await expect(adminPage.locator("text=Route A - Hinjewadi")).toBeVisible({
      timeout: 10000,
    });
    await expect(adminPage.locator("text=R-A")).toBeVisible();

    // Verify seeded stops rendered in timeline
    await expect(adminPage.locator("text=Wakad Chowk")).toBeVisible();
    await expect(adminPage.locator("text=Dange Chowk")).toBeVisible();
  });

  test("admin can add a new vehicle with encrypted driver PII", async ({
    adminPage,
  }) => {
    await adminPage.goto("/transport");

    // Click "Add Vehicle" button
    const addBtn = adminPage.locator('button:has-text("Add Vehicle")');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Fill the modal form
    const modal = adminPage.locator(
      'form:has(h3:has-text("Register New Vehicle"))',
    );
    await expect(modal).toBeVisible();

    await modal.locator('input[placeholder*="BUS-03"]').fill("BUS-03");
    await modal
      .locator('input[placeholder*="MH-12-AB-1234"]')
      .fill("MH-14-CD-5678");
    await modal.locator('input[type="number"]').first().fill("50");

    // Fill driver PII fields
    await modal.locator("input").nth(5).fill("Suresh Yadav");
    await modal.locator("input").nth(6).fill("DL-9920250012345");
    await modal.locator("input").nth(7).fill("9988776655");

    // Submit
    await modal.locator('button:has-text("Save Vehicle")').click();

    // Wait for modal to close and page to refresh
    await expect(modal).toBeHidden({ timeout: 10000 });

    // Verify new vehicle appears
    await expect(adminPage.locator("text=BUS-03")).toBeVisible({
      timeout: 10000,
    });
  });

  test("bus pass tab shows DPDP consent indicator for students", async ({
    adminPage,
  }) => {
    await adminPage.goto("/transport");

    // Switch to Bus Passes tab
    await adminPage.click('button:has-text("Bus Passes")');

    await expect(
      adminPage.locator("text=Student Bus Passes Directory"),
    ).toBeVisible({ timeout: 10000 });

    // Click "Map Student / Issue Pass"
    const mapBtn = adminPage.locator(
      'button:has-text("Map Student / Issue Pass")',
    );
    await expect(mapBtn).toBeVisible();
    await mapBtn.click();

    // Modal should open
    const modal = adminPage.locator(
      'form:has(h3:has-text("Map Student & Issue Pass"))',
    );
    await expect(modal).toBeVisible();

    // The first student should have transport consent (we seed it in seed.ts)
    // Verify consent indicator is present
    const consentIndicator = modal.locator("text=Verifiable Consent");
    await expect(consentIndicator.first()).toBeVisible();

    // Close the form
    await modal.locator('button:has-text("Cancel")').click();
    await expect(modal).toBeHidden();
  });

  test("GPS tracking tab renders map simulation panel", async ({
    adminPage,
  }) => {
    await adminPage.goto("/transport");

    // Switch to Live GPS Tracking tab
    await adminPage.click('button:has-text("Live GPS Tracking")');

    // Verify simulation panel renders
    await expect(
      adminPage.locator("text=Live GPS Tracker & Simulator"),
    ).toBeVisible({ timeout: 10000 });
    await expect(adminPage.locator("text=Simulation Details")).toBeVisible();

    // Verify the "Simulate live trip" button exists
    const simBtn = adminPage.locator('button:has-text("Simulate live trip")');
    await expect(simBtn).toBeVisible();

    // Verify route progress shows seeded stops (use specific locator to avoid SVG map duplicates)
    await expect(adminPage.getByText("1. Wakad Chowk")).toBeVisible();
    await expect(adminPage.getByText("2. Dange Chowk")).toBeVisible();

    // Verify map legend is present
    await expect(
      adminPage.locator("text=Red Dot = School Campus"),
    ).toBeVisible();
  });
});
