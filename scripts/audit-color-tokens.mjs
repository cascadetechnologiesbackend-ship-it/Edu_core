#!/usr/bin/env node
/**
 * scripts/audit-color-tokens.mjs
 * 
 * Mechanical color audit scanner for SchoolMitra frontend/src.
 * Scans for banned Tailwind palettes, hardcoded colors, status color collisions,
 * and multi-filled button action rows under Apple HIG Design System v2 (Phase AD-L0).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..").replace(/\\/g, "/");

const FRONTEND_SRC = path.join(ROOT_DIR, "frontend/src").replace(/\\/g, "/");
const GLOBALS_CSS = path.join(FRONTEND_SRC, "app/globals.css").replace(/\\/g, "/");
const TAILWIND_CONFIG = path.join(ROOT_DIR, "frontend/tailwind.config.ts").replace(/\\/g, "/");

// Banned token patterns across frontend/src
const PATTERNS = {
  slate: /\bslate-\d+\b/g,
  zinc: /\bzinc-\d+\b/g,
  blue_dark: /\bblue-(?:800|900|950)\b/g,
  blue_other: /\bblue-(?:50|100|200|300|400|500|600|700)\b/g,
  emerald: /\bemerald-\d+\b/g,
  rose: /\brose-\d+\b/g,
  amber: /\bamber-\d+\b/g,
  tailwind_green: /\bgreen-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g,
  tailwind_red: /\bred-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g,
  tailwind_orange: /\borange-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g,
  tailwind_yellow: /\byellow-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g,
  hex: /#[0-9a-fA-F]{3,8}\b/g,
  rgb_hsl: /(?:rgb|hsl)a?\([^)]+\)/g,
};

function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file).replace(/\\/g, "/");
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (/\.(tsx?|jsx?|css)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

export function runColorAudit(options = {}) {
  const allFiles = walkDir(FRONTEND_SRC);
  const startTime = Date.now();

  const report = {
    meta: {
      generatedAt: new Date().toISOString(),
      executionTimeMs: 0,
      totalFilesScanned: allFiles.length,
      filesWithViolations: 0,
      totalViolations: 0,
    },
    categoryTotals: {},
    moduleTotals: {},
    fileViolations: {},
    hardcodedHex: [],
    rgbHslInstances: [],
    navyResidue: {
      globalsCss: [],
      tailwindConfig: []
    },
    statusCollisions: {
      greenInteractive: [],
      blueNonInteractive: [],
      statusBadgeConsumers: []
    },
    actionRowsMultiFilled: []
  };

  for (const k of Object.keys(PATTERNS)) {
    report.categoryTotals[k] = 0;
  }

  // 1. Audit Navy residue in globals.css
  if (fs.existsSync(GLOBALS_CSS)) {
    const globalsLines = fs.readFileSync(GLOBALS_CSS, "utf-8").split("\n");
    globalsLines.forEach((l, idx) => {
      if (/222\s+47%|223\s+47%|216\s+34%|214\s+32%|215\s+16%|211\s+100%|213\s+31%|#0f172a|#1e40af|#1e293b|#cbd5e1/.test(l)) {
        report.navyResidue.globalsCss.push({ line: idx + 1, text: l.trim() });
      }
    });
  }

  // 2. Audit Navy residue in tailwind.config.ts
  if (fs.existsSync(TAILWIND_CONFIG)) {
    const tailwindLines = fs.readFileSync(TAILWIND_CONFIG, "utf-8").split("\n");
    tailwindLines.forEach((l, idx) => {
      if (/#0f172a|#1e40af|#1e293b|#cbd5e1|#1e3a8a|#172554|card-hover|gradient-primary|sidebar-item/.test(l)) {
        report.navyResidue.tailwindConfig.push({ line: idx + 1, text: l.trim() });
      }
    });
  }

  // 3. Scan all frontend/src files
  for (const filePath of allFiles) {
    const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    let fileHasViolation = false;
    const fileCounts = {};

    for (const [key, regex] of Object.entries(PATTERNS)) {
      const matches = content.match(regex);
      if (matches && matches.length > 0) {
        // Refine hex to exclude false positives (URL fragments, anchor tags, passwords)
        let count = matches.length;
        if (key === "hex") {
          const filtered = [];
          for (const m of matches) {
            const contextLine = lines.find(l => l.includes(m)) || "";
            if (/href=["']#|id=["']#|["'][A-Za-z0-9_]*#[A-Za-z0-9_]*["']/.test(contextLine) && !/(?:color|background|theme|border|fill|stroke|#[0-9a-fA-F]{3,8})/i.test(contextLine)) {
              continue;
            }
            filtered.push(m);
            report.hardcodedHex.push({ file: relPath, hex: m, snippet: contextLine.trim() });
          }
          count = filtered.length;
        } else if (key === "rgb_hsl") {
          matches.forEach(m => {
            const contextLine = lines.find(l => l.includes(m)) || "";
            report.rgbHslInstances.push({ file: relPath, val: m, snippet: contextLine.trim() });
          });
        }

        if (count > 0) {
          fileCounts[key] = count;
          report.categoryTotals[key] += count;
          report.meta.totalViolations += count;
          fileHasViolation = true;
        }
      }
    }

    // Module categorization
    let mod = "other";
    if (relPath.startsWith("frontend/src/app/(admin)")) mod = "admin";
    else if (relPath.startsWith("frontend/src/app/(teacher)")) mod = "teacher";
    else if (relPath.startsWith("frontend/src/app/(parent)")) mod = "parent";
    else if (relPath.startsWith("frontend/src/app/(student)")) mod = "student";
    else if (relPath.startsWith("frontend/src/app/(super-admin)")) mod = "super-admin";
    else if (relPath.startsWith("frontend/src/app/(auth)")) mod = "auth";
    else if (relPath.startsWith("frontend/src/app/(onboarding)")) mod = "onboarding";
    else if (relPath.startsWith("frontend/src/app/(driver)") || relPath.startsWith("frontend/src/app/(transport)")) mod = "transport";
    else if (relPath.startsWith("frontend/src/app/api")) mod = "api";
    else if (relPath.startsWith("frontend/src/components/ui")) mod = "components_ui";
    else if (relPath.startsWith("frontend/src/components")) mod = "components_other";
    else if (relPath.startsWith("frontend/src/app")) mod = "app_root";

    if (!report.moduleTotals[mod]) {
      report.moduleTotals[mod] = { fileCount: 0, violationCount: 0, categories: {} };
    }
    report.moduleTotals[mod].fileCount++;

    if (fileHasViolation) {
      report.meta.filesWithViolations++;
      report.fileViolations[relPath] = fileCounts;
      const fileTotal = Object.values(fileCounts).reduce((a, b) => a + b, 0);
      report.moduleTotals[mod].violationCount += fileTotal;
      for (const [k, v] of Object.entries(fileCounts)) {
        report.moduleTotals[mod].categories[k] = (report.moduleTotals[mod].categories[k] || 0) + v;
      }
    }

    // StatusBadge consumer catalog
    if (content.includes("StatusBadge")) {
      lines.forEach((line, idx) => {
        if (line.includes("<StatusBadge") || (line.includes("StatusBadge") && line.includes("status="))) {
          const statusMatch = line.match(/status=["']?([^"'\s>}]+)["']?/);
          const labelMatch = line.match(/label=["']?([^"'>}]+)["']?/);
          report.statusCollisions.statusBadgeConsumers.push({
            file: relPath,
            line: idx + 1,
            status: statusMatch ? statusMatch[1] : "unknown",
            label: labelMatch ? labelMatch[1] : "",
            snippet: line.trim()
          });
        }
      });
    }

    // Status collisions: Green on interactive controls
    lines.forEach((line, idx) => {
      if (/<(?:button|a|Button|QuickAction)\b/.test(line) || (/className=.*bg-(?:emerald|green)-[56]00/.test(line) && /<(?:button|a|Button|QuickAction)/.test(lines.slice(Math.max(0, idx - 3), idx + 3).join(" ")))) {
        if (/bg-(?:emerald|green)-[56]00/.test(line) || /bg-(?:emerald|green)-[56]00/.test(lines.slice(Math.max(0, idx - 2), idx + 2).join(" "))) {
          report.statusCollisions.greenInteractive.push({ file: relPath, line: idx + 1, snippet: line.trim() });
        }
      }
      if ((/bg-blue-[1-5]00\/[12]0|bg-blue-100\b|bg-blue-50\b/.test(line)) && (/badge|status|pill|tag|rounded-full/i.test(line) || /span\b/.test(line)) && !/<(?:button|a|Button)/.test(line)) {
        report.statusCollisions.blueNonInteractive.push({ file: relPath, line: idx + 1, snippet: line.trim() });
      }
    });

    // Multi-filled action rows
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/className=.*(?:flex|inline-flex).*(?:gap-|space-x-)/.test(line)) {
        const windowEnd = Math.min(lines.length, i + 25);
        const windowLines = lines.slice(i, windowEnd);
        const windowStr = windowLines.join("\n");
        const buttons = windowStr.match(/<(?:Button|button|QuickAction)\b/g);
        if (buttons && buttons.length >= 2) {
          const filled = windowStr.match(/bg-(?:primary(?![/])|blue-[56]00|emerald-[56]00|green-[56]00|red-[56]00|rose-[56]00|amber-[56]00|orange-[56]00|indigo-[56]00|violet-[56]00)/g);
          if (filled && filled.length >= 2) {
            const already = report.actionRowsMultiFilled.some(r => r.file === relPath && Math.abs(r.line - (i + 1)) < 15);
            if (!already) {
              report.actionRowsMultiFilled.push({
                file: relPath,
                line: i + 1,
                buttonCount: buttons.length,
                filledClasses: filled,
                snippet: windowLines.slice(0, 8).map(l => l.trim()).join(" ")
              });
              i += 12;
            }
          }
        }
      }
    }
  }

  report.meta.executionTimeMs = Date.now() - startTime;
  return report;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = runColorAudit();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Audited ${report.meta.totalFilesScanned} files in ${report.meta.executionTimeMs}ms.`);
    console.log(`Violations detected in ${report.meta.filesWithViolations} files.`);
    console.log(`Total escape count: ${report.meta.totalViolations}`);
    console.table(report.categoryTotals);
  }
}
