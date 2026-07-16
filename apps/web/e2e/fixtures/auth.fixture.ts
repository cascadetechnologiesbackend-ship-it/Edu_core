import { test as base, type Page } from '@playwright/test';

type AuthFixtures = {
  adminPage: Page;
  parentPage: Page;
  teacherPage: Page;
};

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Login as Admin
    await page.goto('/login');
    await page.fill('input[id="login-email"]', 'school_admin1@school.edu.in');
    await page.fill('input[id="login-password"]', 'schoolmitra_dev');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    await use(page);
    await context.close();
  },
  
  parentPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Login as Parent
    await page.goto('/login');
    await page.fill('input[id="login-email"]', 'parent_1001@school.edu.in');
    await page.fill('input[id="login-password"]', 'schoolmitra_dev');
    await page.click('button[type="submit"]');
    await page.waitForURL('/portal');
    
    await use(page);
    await context.close();
  },

  teacherPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Login as Teacher
    await page.goto('/login');
    await page.fill('input[id="login-email"]', 'teacher1@school.edu.in');
    await page.fill('input[id="login-password"]', 'schoolmitra_dev');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
