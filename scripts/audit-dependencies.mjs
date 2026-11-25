#!/usr/bin/env node
/**
 * SchoolMitra Dependency Security Audit Gate
 * Enforces fail-closed validation on high/critical advisories against .audit-exceptions.json
 * 
 * Strict Enforcement Rules:
 * 1. ZERO wildcard '*' permitted anywhere in registry (advisoryId or package).
 * 2. Mandatory 90-day maximum expiry window from today.
 * 3. Exact advisoryId and package matching only (no loose fallbacks).
 * 4. Fail closed on missing, invalid, or malformed audit output.
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
  console.error("❌ Fatal Error: Missing .audit-exceptions.json registry!");
  process.exit(1);
}

let registry;
try {
  registry = JSON.parse(fs.readFileSync(EXCEPTIONS_FILE, "utf8"));
} catch (parseErr) {
  console.error("❌ Fatal Error: Malformed JSON in .audit-exceptions.json:", parseErr.message);
  process.exit(1);
}

const exceptions = registry.exceptions;
if (!Array.isArray(exceptions)) {
  console.error("❌ Fatal Error: .audit-exceptions.json 'exceptions' property must be an array.");
  process.exit(1);
}

const now = new Date();
const MAX_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000 + (24 * 60 * 60 * 1000); // 90 days + 1 day grace for timezone diffs

// Enforce strict validity on the exceptions registry itself
const registryErrors = [];
for (let i = 0; i < exceptions.length; i++) {
  const e = exceptions[i];
  const ref = `[index ${i}: ${e.package || 'unknown'} / ${e.advisoryId || 'unknown'}]`;

  if (!e.package || typeof e.package !== "string" || e.package.trim() === "") {
    registryErrors.push(`${ref} Missing or invalid 'package' field.`);
  } else if (e.package.includes("*")) {
    registryErrors.push(`${ref} Wildcard '*' is strictly prohibited in package names.`);
  }

  if (!e.advisoryId || typeof e.advisoryId !== "string" || e.advisoryId.trim() === "") {
    registryErrors.push(`${ref} Missing or invalid 'advisoryId' field.`);
  } else if (e.advisoryId.includes("*")) {
    registryErrors.push(`${ref} Wildcard '*' is strictly prohibited in advisoryId.`);
  }

  if (!e.ticket || typeof e.ticket !== "string" || e.ticket.trim() === "") {
    registryErrors.push(`${ref} Missing tracking 'ticket' field.`);
  }

  if (!e.reason || typeof e.reason !== "string" || e.reason.trim() === "") {
    registryErrors.push(`${ref} Missing audit 'reason' rationale.`);
  }

  if (!e.expiresAt || isNaN(Date.parse(e.expiresAt))) {
    registryErrors.push(`${ref} Missing or invalid ISO date in 'expiresAt'.`);
  } else {
    const expDate = new Date(e.expiresAt);
    if (expDate <= now) {
      registryErrors.push(`${ref} Exception has EXPIRED on ${e.expiresAt}. Must be remediated or renewed with verified security review.`);
    } else if (expDate.getTime() - now.getTime() > MAX_EXPIRY_MS) {
      registryErrors.push(`${ref} Exception expiry ${e.expiresAt} exceeds maximum permitted 90-day window.`);
    }
  }
}

if (registryErrors.length > 0) {
  console.error(`❌ Security Policy Violation: ${registryErrors.length} defect(s) found in .audit-exceptions.json:`);
  for (const err of registryErrors) {
    console.error(`   - ${err}`);
  }
  process.exit(1);
}

// Execute pnpm audit --json or read cached audit if provided via AUDIT_FILE env
let auditJson = null;
const auditFile = process.env.AUDIT_FILE;

if (auditFile && fs.existsSync(auditFile)) {
  console.log(`📄 Reading audit data from cached file: ${auditFile}`);
  try {
    auditJson = JSON.parse(fs.readFileSync(auditFile, "utf8"));
  } catch (err) {
    console.error("❌ Fatal Error: Failed to parse cached audit JSON:", err.message);
    process.exit(1);
  }
} else {
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
        console.error("❌ Fatal Error: Failed to parse pnpm audit JSON output:", parseErr.message);
        process.exit(1);
      }
    } else {
      console.error("❌ Fatal Error: pnpm audit failed to execute:", err.message);
      process.exit(1);
    }
  }
}

// Fail closed: auditJson must contain valid audit structure
if (!auditJson || typeof auditJson !== "object") {
  console.error("❌ Fatal Error: pnpm audit produced empty or non-object output.");
  process.exit(1);
}

// If advisories is not present, check metadata to determine if 0 vulnerabilities exist
if (!auditJson.advisories || typeof auditJson.advisories !== "object") {
  if (
    auditJson.metadata &&
    auditJson.metadata.vulnerabilities &&
    (auditJson.metadata.vulnerabilities.high || 0) + (auditJson.metadata.vulnerabilities.critical || 0) === 0
  ) {
    console.log("✅ Zero high/critical advisories reported by package manager.");
    process.exit(0);
  }
  console.error("❌ Fatal Error: Malformed audit report: missing 'advisories' map and non-zero metadata count.");
  process.exit(1);
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

  // Strict match: exact advisoryId AND exact package name
  const match = exceptions.find(
    (e) => e.package === pkgName && e.advisoryId === advId,
  );

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
    "\nAction required: Remediate dependencies or review and register exceptions in .audit-exceptions.json with tracking ticket & expiration date (max 90 days).\n",
  );
  process.exit(1);
}

console.log(
  `✅ All ${highOrCritical.length} high/critical vulnerabilities match valid, unexpired, non-wildcard exceptions in .audit-exceptions.json.`,
);
console.log(`🛡️  Dependency security audit gate: PASSED.`);
process.exit(0);
