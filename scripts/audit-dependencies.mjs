#!/usr/bin/env node
/**
 * SchoolMitra Dependency Security Audit Gate
 * Enforces fail-closed validation on high/critical advisories against .audit-exceptions.json
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const EXCEPTIONS_FILE = path.join(ROOT_DIR, ".audit-exceptions.json");

console.log("🛡️  SchoolMitra Dependency Security Audit Gate (REL-AUDIT-007)...");

if (!fs.existsSync(EXCEPTIONS_FILE)) {
  console.error("❌ Error: Missing .audit-exceptions.json registry!");
  process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(EXCEPTIONS_FILE, "utf8"));
const exceptions = registry.exceptions || [];
const now = new Date();

// Check for expired exceptions in the registry itself
const expiredExceptions = exceptions.filter(
  (e) => e.expiresAt && new Date(e.expiresAt) <= now,
);
if (expiredExceptions.length > 0) {
  console.error(
    `❌ Error: Found ${expiredExceptions.length} expired security exception(s) in .audit-exceptions.json:`,
  );
  for (const exp of expiredExceptions) {
    console.error(
      `   - [EXPIRED ${exp.expiresAt}] ${exp.package} (${exp.advisoryId}): ${exp.reason} [Ticket: ${exp.ticket}]`,
    );
  }
  process.exit(1);
}

// Execute pnpm audit --json
let auditJson = null;
try {
  const output = execSync("pnpm audit --json", {
    cwd: ROOT_DIR,
    maxBuffer: 50 * 1024 * 1024,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  auditJson = JSON.parse(output);
} catch (err) {
  if (err.stdout) {
    try {
      auditJson = JSON.parse(err.stdout.toString("utf8"));
    } catch (parseErr) {
      console.error("❌ Error: Failed to parse pnpm audit JSON output:", parseErr.message);
      process.exit(1);
    }
  } else {
    console.error("❌ Error: pnpm audit failed to execute:", err.message);
    process.exit(1);
  }
}

if (!auditJson || !auditJson.advisories) {
  console.log("✅ Zero advisories reported by package manager.");
  process.exit(0);
}

const advisories = Object.values(auditJson.advisories);
const highOrCritical = advisories.filter(
  (a) => a.severity === "high" || a.severity === "critical",
);

console.log(
  `📋 Total advisories: ${advisories.length} | High/Critical: ${highOrCritical.length}`,
);

const violations = [];
const approved = [];

for (const adv of highOrCritical) {
  const advId = adv.github_advisory_id || String(adv.id);
  const pkgName = adv.module_name;
  const severity = adv.severity;

  // Match against exceptions registry
  const match = exceptions.find((e) => {
    if (e.advisoryId && e.advisoryId === advId) return true;
    if (e.package === pkgName && (!e.advisoryId || e.advisoryId === advId || e.advisoryId === "*")) return true;
    return false;
  });

  if (!match) {
    violations.push({
      package: pkgName,
      advisoryId: advId,
      severity,
      title: adv.title,
      recommendation: adv.recommendation,
      url: adv.url,
    });
  } else {
    approved.push({
      package: pkgName,
      advisoryId: advId,
      severity,
      ticket: match.ticket,
      reason: match.reason,
    });
  }
}

if (violations.length > 0) {
  console.error(
    `\n❌ SECURITY AUDIT FAILED: ${violations.length} unapproved high/critical vulnerability/vulnerabilities detected!\n`,
  );
  console.table(violations);
  console.error(
    "\nAction required: Remediate dependencies or review and register exceptions in .audit-exceptions.json with tracking ticket & expiration date.\n",
  );
  process.exit(1);
}

console.log(
  `✅ All ${highOrCritical.length} high/critical vulnerabilities match valid, unexpired exceptions in .audit-exceptions.json.`,
);
console.log(`🛡️  Dependency security audit gate: PASSED.`);
process.exit(0);
