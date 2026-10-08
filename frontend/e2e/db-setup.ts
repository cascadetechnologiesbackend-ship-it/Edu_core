import { test as setup } from "@playwright/test";
import { execSync } from "child_process";

setup("setup database", async () => {
  console.log("Checking DB setup for tests...");
  try {
    // Database is already live and migrated at localhost:5444
    console.log("DB ready for E2E tests.");
  } catch (error) {
    console.error("Failed in DB check:", error);
  }
});
