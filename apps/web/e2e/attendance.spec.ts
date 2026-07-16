import { test, expect } from './fixtures/auth.fixture';

test.describe('Student Attendance Flow', () => {

  test('should load attendance page and mark student attendance', async ({ teacherPage }) => {
    // 1. Navigate to the attendance page
    await teacherPage.goto('/attendance');
    
    // 2. Assert page headers
    await expect(teacherPage.locator('h1')).toContainText('Student Attendance');
    
    // 3. Verify classroom dropdown loads
    const sectionSelect = teacherPage.locator('select');
    await expect(sectionSelect).toBeVisible();
    
    // 4. Wait for the student grid list to load
    const studentRows = teacherPage.locator('tbody tr');
    await expect(studentRows.first()).toBeVisible({ timeout: 10000 });
    
    const count = await studentRows.count();
    expect(count).toBeGreaterThan(0);
    
    // 5. Select all students as present
    const markAllPresentBtn = teacherPage.locator('button:has-text("Mark All Present")');
    await expect(markAllPresentBtn).toBeVisible();
    await markAllPresentBtn.click();
    
    // 6. Enter a remark for the first student
    const firstRemarkInput = teacherPage.locator('tbody tr').first().locator('input[placeholder="Optional remarks"]');
    await firstRemarkInput.fill('Regular student');
    
    // 7. Click save attendance
    const saveBtn = teacherPage.locator('button:has-text("Save Attendance")');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    
    // 8. Assert success banner appears
    const successBanner = teacherPage.getByText("Attendance marked successfully!", { exact: false });
    await expect(successBanner).toBeVisible({ timeout: 10000 });
  });

  test('should display all sections for admin and only assigned sections for teacher', async ({ adminPage, teacherPage }) => {
    // Admin checks
    await adminPage.goto('/attendance');
    const adminSelect = adminPage.locator('select');
    await expect(adminSelect).toBeVisible();
    const adminOptionsCount = await adminSelect.locator('option').count();
    expect(adminOptionsCount).toBeGreaterThan(1); // Seeds multiple classes/sections
    
    // Teacher checks
    await teacherPage.goto('/attendance');
    const teacherSelect = teacherPage.locator('select');
    await expect(teacherSelect).toBeVisible();
    const teacherOptionsCount = await teacherSelect.locator('option').count();
    // In our seed data, teacher1 might not be assigned as class teacher to any section or just one.
    // Let's verify that the dropdown works and is constrained
    expect(teacherOptionsCount).toBeLessThan(adminOptionsCount);
  });

});
