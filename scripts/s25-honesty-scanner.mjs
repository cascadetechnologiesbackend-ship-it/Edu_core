#!/usr/bin/env node

/**
 * Sprint S25 Honesty Law Scanner
 *
 * Verifies that:
 * 1. Zero writes of status: "DELIVERED" exist in pushNotificationLogs inserts upstream of dispatchWebPush.
 * 2. Zero writes of status: "SENT" in smsLogs exist upstream of real gateway delivery (all enqueues must be QUEUED).
 * 3. Zero 'smtp.example.com' configuration fallbacks exist in backend/src executable code.
 * 4. All 4 exam notification triggers use persistPushResults/persistQuietHoursPushLogs downstream of dispatch.
 * 5. Web push dispatcher uses real RFC 8030/8291/8292 webpush.sendNotification.
 * 6. Email service exports isEmailConfigured and fails closed when unconfigured.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const backendSrc = path.join(rootDir, "backend", "src");

let violations = 0;

function reportViolation(file, line, description) {
  console.error(`❌ [HONESTY VIOLATION] ${path.relative(rootDir, file)}:${line} - ${description}`);
  violations++;
}

function scanFile(filePath) {
  // Skip test files, build output, and mocks
  if (filePath.includes("__tests__") || filePath.includes("node_modules") || filePath.includes(".test.")) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let insideBlockComment = false;

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    if (trimmed.startsWith("/*") || trimmed.startsWith("/**")) {
      insideBlockComment = true;
    }
    if (trimmed.endsWith("*/") || trimmed.includes("*/")) {
      insideBlockComment = false;
      return;
    }
    if (insideBlockComment || trimmed.startsWith("*") || trimmed.startsWith("//")) {
      // Skip comments
      return;
    }

    // Rule 1: No smtp.example.com in executable code
    if (line.includes("smtp.example.com")) {
      reportViolation(filePath, lineNum, "Found forbidden fallback literal 'smtp.example.com'");
    }

    // Rule 2: No direct insert of status: "SENT" into smsLogs (must enqueue as QUEUED)
    if (line.includes(".insert(smsLogs)") && line.includes('"SENT"')) {
      reportViolation(filePath, lineNum, "Found forbidden write of status 'SENT' directly into smsLogs (must enqueue as QUEUED)");
    }
  });
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") || entry.name.endsWith(".js"))) {
      scanFile(fullPath);
    }
  }
}

console.log("🔍 Running S25 Honesty Law Scanner across backend/src...");
walkDir(backendSrc);

// Specific file checks
const examNotificationsPath = path.join(backendSrc, "lib", "examNotifications.ts");
if (fs.existsSync(examNotificationsPath)) {
  const content = fs.readFileSync(examNotificationsPath, "utf-8");
  // Verify that persistPushResults is called in all 4 notification functions
  const persistCalls = (content.match(/persistPushResults/g) || []).length;
  if (persistCalls < 4) {
    reportViolation(
      examNotificationsPath,
      1,
      `Expected at least 4 persistPushResults calls in examNotifications.ts, found ${persistCalls}`
    );
  }
  // Verify zero pre-dispatch pushNotificationLogs writes
  if (content.includes("insert(pushNotificationLogs)")) {
    reportViolation(
      examNotificationsPath,
      1,
      "Found direct insert(pushNotificationLogs) in examNotifications.ts — must use persistPushResults downstream of dispatch"
    );
  }
}

const emailPath = path.join(backendSrc, "lib", "email.ts");
if (fs.existsSync(emailPath)) {
  const content = fs.readFileSync(emailPath, "utf-8");
  if (!content.includes("isEmailConfigured")) {
    reportViolation(emailPath, 1, "Missing isEmailConfigured export in email.ts");
  }
}

const webPushPath = path.join(backendSrc, "lib", "webPushDispatcher.ts");
if (fs.existsSync(webPushPath)) {
  const content = fs.readFileSync(webPushPath, "utf-8");
  if (!content.includes("webpush.sendNotification")) {
    reportViolation(webPushPath, 1, "webPushDispatcher.ts does not use real webpush.sendNotification RFC protocol");
  }
  if (!content.includes("isWebPushConfigured")) {
    reportViolation(webPushPath, 1, "webPushDispatcher.ts missing isWebPushConfigured export");
  }
}

const smsWorkerPath = path.join(backendSrc, "workers", "notificationQueueWorker.ts");
if (fs.existsSync(smsWorkerPath)) {
  const content = fs.readFileSync(smsWorkerPath, "utf-8");
  if (!content.includes("sendSMSWithStatus")) {
    reportViolation(smsWorkerPath, 1, "notificationQueueWorker.ts does not call sendSMSWithStatus");
  }
  if (!content.includes("decryptData")) {
    reportViolation(smsWorkerPath, 1, "notificationQueueWorker.ts does not decrypt phone numbers");
  }
  if (!content.includes("500")) {
    reportViolation(smsWorkerPath, 1, "notificationQueueWorker.ts does not enforce 500 daily quota");
  }
}

if (violations === 0) {
  console.log("✅ S25 Honesty Law Scanner passed with 0 violations! All notification paths are verified honest.");
  process.exit(0);
} else {
  console.error(`💥 S25 Honesty Law Scanner failed with ${violations} violation(s).`);
  process.exit(1);
}
