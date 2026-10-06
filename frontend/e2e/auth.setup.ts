import { test as setup } from "@playwright/test";
import fs from "fs";
import path from "path";

const AUTH_DIR = path.resolve(__dirname, "../../playwright/.auth");

setup("authenticate users and save storageState", async ({ browser }) => {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // 1. Setup Admin storageState
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/login");
  await adminPage.fill('input[id="login-email"]', "school_admin1@school.edu.in");
  await adminPage.fill('input[id="login-password"]', "schoolmitra_dev");
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL(/\/dashboard|\/login/);
  await adminContext.storageState({ path: path.join(AUTH_DIR, "admin.json") });
  await adminContext.close();

  // 2. Setup Parent storageState
  const parentContext = await browser.newContext();
  const parentPage = await parentContext.newPage();
  await parentPage.goto("/login");
  await parentPage.fill('input[id="login-email"]', "parent_1001@school.edu.in");
  await parentPage.fill('input[id="login-password"]', "schoolmitra_dev");
  await parentPage.click('button[type="submit"]');
  await parentPage.waitForURL(/\/portal|\/login/);
  await parentContext.storageState({ path: path.join(AUTH_DIR, "parent.json") });
  await parentContext.close();

  // 3. Setup Teacher storageState
  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await teacherPage.goto("/login");
  await teacherPage.fill('input[id="login-email"]', "teacher1@school.edu.in");
  await teacherPage.fill('input[id="login-password"]', "schoolmitra_dev");
  await teacherPage.click('button[type="submit"]');
  await teacherPage.waitForURL(/\/dashboard|\/login/);
  await teacherContext.storageState({ path: path.join(AUTH_DIR, "teacher.json") });
  await teacherContext.close();
});
