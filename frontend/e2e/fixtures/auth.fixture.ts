import { test as base, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

type AuthFixtures = {
  adminPage: Page;
  parentPage: Page;
  teacherPage: Page;
};

const AUTH_DIR = path.resolve(__dirname, "../../../playwright/.auth");

export const test = base.extend<AuthFixtures>({
  adminPage: async ({ browser }, use) => {
    const storageStatePath = path.join(AUTH_DIR, "admin.json");
    const context = fs.existsSync(storageStatePath)
      ? await browser.newContext({ storageState: storageStatePath })
      : await browser.newContext();

    const page = await context.newPage();

    if (!fs.existsSync(storageStatePath)) {
      // Direct login fallback if storageState not present
      await page.goto("/login");
      await page.fill('input[id="login-email"]', "school_admin1@school.edu.in");
      await page.fill('input[id="login-password"]', "schoolmitra_dev");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");
    }

    await use(page);
    await context.close();
  },

  parentPage: async ({ browser }, use) => {
    const storageStatePath = path.join(AUTH_DIR, "parent.json");
    const context = fs.existsSync(storageStatePath)
      ? await browser.newContext({ storageState: storageStatePath })
      : await browser.newContext();

    const page = await context.newPage();

    if (!fs.existsSync(storageStatePath)) {
      await page.goto("/login");
      await page.fill('input[id="login-email"]', "parent_1001@school.edu.in");
      await page.fill('input[id="login-password"]', "schoolmitra_dev");
      await page.click('button[type="submit"]');
      await page.waitForURL("/portal");
    }

    await use(page);
    await context.close();
  },

  teacherPage: async ({ browser }, use) => {
    const storageStatePath = path.join(AUTH_DIR, "teacher.json");
    const context = fs.existsSync(storageStatePath)
      ? await browser.newContext({ storageState: storageStatePath })
      : await browser.newContext();

    const page = await context.newPage();

    if (!fs.existsSync(storageStatePath)) {
      await page.goto("/login");
      await page.fill('input[id="login-email"]', "teacher1@school.edu.in");
      await page.fill('input[id="login-password"]', "schoolmitra_dev");
      await page.click('button[type="submit"]');
      await page.waitForURL("/dashboard");
    }

    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";
