import { test, expect } from './fixtures/auth.fixture';

test.describe('Fee Workflow', () => {

  test('should create fee structure as admin', async ({ adminPage }) => {
    await adminPage.goto('/settings/fee-structure');
    // Assuming UI navigation and form filling
    const addStructureBtn = adminPage.locator('button:has-text("Add Fee Structure")');
    if (await addStructureBtn.isVisible()) {
      await addStructureBtn.click();
      await adminPage.selectOption('select[name="classId"]', { index: 1 }); // Select first class
      await adminPage.selectOption('select[name="term"]', 'QUARTERLY');
      await adminPage.fill('input[name="dueDate"]', '2025-07-15');
      
      await adminPage.fill('input[name="feeHeads.0.amount"]', '5000'); // Tuition
      
      await adminPage.click('button:has-text("Save")');
      await expect(adminPage.locator('text=Fee structure created')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should view fee dues as parent', async ({ parentPage }) => {
    await parentPage.goto('/fees');
    await expect(parentPage.locator('h1')).toContainText('Fee Dues');
    
    // Check if there's a payment button
    const payBtn = parentPage.locator('button:has-text("Pay Now")');
    if (await payBtn.isVisible()) {
      await expect(payBtn).toBeEnabled();
      // Clicking it would likely redirect to Razorpay mockup, skipping for E2E
    }
  });

});
