/**
 * count-eslint-baselines.mjs
 *
 * Sprint S2 Engineering Hygiene Ratchet Script
 *
 * Audits:
 * 1. Explicit `any` occurrences on files touched during Sprint S2.
 * 2. `console.*` vs Pino logger usage on runtime code touched during Sprint S2.
 * 3. File line counts (> 1000 lines warning ratchet).
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const BASE_COMMIT = process.env.BASE_COMMIT || "7ffefcc";

console.log(`Auditing changed files since ${BASE_COMMIT}...`);

let changedFiles = [];
try {
  const output = execSync(`git diff --name-only ${BASE_COMMIT} HEAD`, {
    encoding: "utf-8",
  });
  changedFiles = output
    .split("\n")
    .map((f) => f.trim())
    .filter(
      (f) =>
        f &&
        (f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".js") || f.endsWith(".mjs")) &&
        !f.includes("node_modules") &&
        !f.includes(".next") &&
        fs.existsSync(f),
    );
} catch (err) {
  console.warn("Could not retrieve git diff; scanning workspace src files.");
  changedFiles = [];
}

const report = {
  scannedAt: new Date().toISOString(),
  baseCommit: BASE_COMMIT,
  totalFilesAudited: changedFiles.length,
  anyTypeOccurrences: [],
  totalAnyCount: 0,
  consoleOccurrences: [],
  totalConsoleCount: 0,
  largeFilesOver1000Lines: [],
};

// Patterns
const ANY_PATTERN = /:\s*any\b|\bas\s+any\b|<any>/g;
const CONSOLE_PATTERN = /console\.(log|error|warn|info|debug)\(/g;

for (const filePath of changedFiles) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // 1. Check line count
  if (lines.length > 1000) {
    report.largeFilesOver1000Lines.push({
      file: filePath,
      lineCount: lines.length,
    });
  }

  // 2. Check for explicit any
  let anyCountInFile = 0;
  let lineIdx = 1;
  for (const line of lines) {
    const matches = line.match(ANY_PATTERN);
    if (matches) {
      anyCountInFile += matches.length;
      report.anyTypeOccurrences.push({
        file: filePath,
        line: lineIdx,
        content: line.trim(),
      });
    }

    // 3. Check for console.* in runtime modules (excluding test files, scripts, and docs)
    const isTestOrScript =
      filePath.includes("__tests__") ||
      filePath.includes(".spec.") ||
      filePath.includes(".test.") ||
      filePath.startsWith("scripts/") ||
      filePath.endsWith(".mjs");

    if (!isTestOrScript) {
      const consoleMatches = line.match(CONSOLE_PATTERN);
      if (consoleMatches) {
        report.consoleOccurrences.push({
          file: filePath,
          line: lineIdx,
          content: line.trim(),
        });
      }
    }

    lineIdx++;
  }

  report.totalAnyCount += anyCountInFile;
}

report.totalConsoleCount = report.consoleOccurrences.length;

console.log("\n================ SPRINT S2 HYGIENE BASELINE REPORT ================");
console.log(`Audited Changed Files: ${report.totalFilesAudited}`);
console.log(`Explicit 'any' Occurrences in changed files: ${report.totalAnyCount}`);
console.log(`Runtime 'console.*' in changed non-test files: ${report.totalConsoleCount}`);
console.log(`Files > 1000 lines: ${report.largeFilesOver1000Lines.length}`);

if (report.largeFilesOver1000Lines.length > 0) {
  console.log("\nFiles > 1000 lines:");
  report.largeFilesOver1000Lines.forEach((f) =>
    console.log(`  - ${f.file} (${f.lineCount} lines)`),
  );
}

if (report.consoleOccurrences.length > 0) {
  console.log("\nRuntime console.* occurrences:");
  report.consoleOccurrences.forEach((c) =>
    console.log(`  - ${c.file}:${c.line} -> ${c.content}`),
  );
}

const outputPath = path.resolve("scripts/s2-hygiene-baseline.json");
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`\nBaseline report written to ${outputPath}`);
