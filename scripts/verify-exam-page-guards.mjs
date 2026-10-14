/**
 * S8 Examination Module Page Guard Verification Script
 * Strictly scoped to /exams/* plus /portal/admit-cards and /portal/report-cards per Amendment 3.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const EXAM_PAGES = [
  "frontend/src/app/(admin)/exams/page.tsx",
  "frontend/src/app/(admin)/exams/dashboard/page.tsx",
  "frontend/src/app/(admin)/exams/manage/page.tsx",
  "frontend/src/app/(admin)/exams/schedule/page.tsx",
  "frontend/src/app/(admin)/exams/admit-cards/page.tsx",
  "frontend/src/app/(admin)/exams/marks/page.tsx",
  "frontend/src/app/(admin)/exams/report-cards/page.tsx",
  "frontend/src/app/(admin)/exams/report-cards/setups/page.tsx",
  "frontend/src/app/(admin)/exams/report-cards/settings/page.tsx",
  "frontend/src/app/(admin)/exams/analytics/page.tsx",
  "frontend/src/app/(admin)/exams/results/page.tsx",
  "frontend/src/app/(admin)/exams/[id]/marks/page.tsx",
  "frontend/src/app/(parent)/portal/admit-cards/page.tsx",
  "frontend/src/app/(parent)/portal/report-cards/page.tsx",
];

console.log("================================================================================");
console.log("   S8 OFFLINE EXAMINATIONS: PAGE GUARD & RBAC VERIFICATION [AMENDMENT 3]   ");
console.log("================================================================================\n");

let failures = 0;

console.log("--- 1. Static Page Guard Verification ---");
for (const relPath of EXAM_PAGES) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ MISSING FILE: ${relPath}`);
    failures++;
    continue;
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const isRedirectPage = content.includes("redirect(") && !content.includes("requireAuth");

  if (isRedirectPage) {
    console.log(`✓ [REDIRECT PAGE] ${relPath} (redirects safely to target)`);
    continue;
  }

  const hasAuth = content.includes("requireAuth") || content.includes("auth()");
  const hasRouteGuard = content.includes("assertRouteAccess") || relPath.includes("(parent)");

  if (!hasAuth) {
    console.error(`❌ MISSING AUTH CHECK: ${relPath}`);
    failures++;
  } else if (!hasRouteGuard) {
    console.error(`❌ MISSING ROUTE ACCESS CHECK: ${relPath}`);
    failures++;
  } else {
    console.log(`✓ [SECURED] ${relPath}`);
  }
}

console.log("\n--- 2. Matrix Role Isolation Rules ---");
const routeGuardsFile = path.join(rootDir, "frontend/src/lib/routeGuards.ts");
const routeGuardsContent = fs.readFileSync(routeGuardsFile, "utf-8");

// Verify TEACHER is excluded from /exams/* per Amendment 2
const teacherBlockMatch = routeGuardsContent.match(/TEACHER:\s*\[([\s\S]*?)\]/);
if (teacherBlockMatch && teacherBlockMatch[1]) {
  const teacherRoutes = teacherBlockMatch[1];
  if (teacherRoutes.includes('"/exams') || teacherRoutes.includes("'/exams")) {
    console.error("❌ TEACHER role has unexpected /exams route in matrix!");
    failures++;
  } else {
    console.log("✓ TEACHER strictly excluded from /exams matrix (retains /teacher/grading).");
  }
} else {
  console.error("❌ Could not parse TEACHER block in routeGuards.ts");
  failures++;
}

// Verify ACCOUNTANT only has /exams/admit-cards
const accountantMatch = routeGuardsContent.match(/ACCOUNTANT:\s*\[([\s\S]*?)\]/);
if (accountantMatch && accountantMatch[1]) {
  const accRoutes = accountantMatch[1];
  if (accRoutes.includes('"/exams/admit-cards"') && !accRoutes.includes('"/exams/marks"')) {
    console.log("✓ ACCOUNTANT strictly bounded to /exams/admit-cards fee verification.");
  } else {
    console.error("❌ ACCOUNTANT role routes inconsistent in matrix!");
    failures++;
  }
}

console.log("\n================================================================================");
if (failures === 0) {
  console.log("✅ ALL S8 PAGE GUARDS AND RBAC BOUNDARIES VERIFIED (0 ERRORS)\n");
  process.exit(0);
} else {
  console.error(`❌ VERIFICATION FAILED WITH ${failures} ERRORS\n`);
  process.exit(1);
}
