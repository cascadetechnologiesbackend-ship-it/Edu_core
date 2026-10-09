import fs from "fs";
import path from "path";
import zlib from "zlib";

/**
 * Normative JS Bundle Budgets (from Spec 6.0.0 & SCHOOL-ERP-PERFORMANCE-SPEC.md 1.2):
 * - js_app_shell: <= 100KB compressed (login + shell)
 * - js_normal_route: <= 170KB compressed
 * - charts_reports_js: <= 250KB compressed (deferred)
 * - regression_threshold: +5% max regression against baseline
 */
const BUDGETS = {
  APP_SHELL_MAX_BYTES: 100 * 1024,      // 100 KB
  NORMAL_ROUTE_MAX_BYTES: 170 * 1024,   // 170 KB
  REPORTS_ROUTE_MAX_BYTES: 250 * 1024,  // 250 KB
  REGRESSION_THRESHOLD_PCT: 5.0,        // 5%
};

const HEAVY_REPORT_PATTERNS = [
  "/school/accounting/reports",
  "/analytics",
  "/reports",
];

const IS_IN_FRONTEND = fs.existsSync(path.join(process.cwd(), ".next")) || path.basename(process.cwd()) === "frontend";
const FRONTEND_DIR = IS_IN_FRONTEND ? process.cwd() : path.join(process.cwd(), "frontend");
const REPO_ROOT = IS_IN_FRONTEND ? path.resolve(process.cwd(), "..") : process.cwd();
const NEXT_DIR = path.join(FRONTEND_DIR, ".next");
const BASELINE_PATH = path.join(REPO_ROOT, "docs/architecture/bundle-baseline.json");

if (!fs.existsSync(NEXT_DIR)) {
  console.error(`[BUDGET CHECK ERROR] .next directory not found at ${NEXT_DIR}. Please run 'next build' first.`);
  process.exit(1);
}

const buildManifestPath = path.join(NEXT_DIR, "build-manifest.json");
const appManifestPath = path.join(NEXT_DIR, "app-build-manifest.json");

if (!fs.existsSync(buildManifestPath)) {
  console.error(`[BUDGET CHECK ERROR] build-manifest.json not found at ${buildManifestPath}`);
  process.exit(1);
}

const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, "utf-8"));
const appManifest = fs.existsSync(appManifestPath)
  ? JSON.parse(fs.readFileSync(appManifestPath, "utf-8"))
  : { pages: {} };

// Cache for compressed file sizes
const fileSizeCache = new Map();

function getCompressedSize(relativePath) {
  if (fileSizeCache.has(relativePath)) {
    return fileSizeCache.get(relativePath);
  }
  const filePath = path.join(NEXT_DIR, relativePath);
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  const content = fs.readFileSync(filePath);
  const gzipSize = zlib.gzipSync(content).length;
  fileSizeCache.set(relativePath, { raw: content.length, gzip: gzipSize });
  return fileSizeCache.get(relativePath);
}

// 1. Calculate App Shell Size
const appShellFiles = new Set();
// Chunks shared across pages
if (buildManifest.pages && buildManifest.pages["/_app"]) {
  buildManifest.pages["/_app"].forEach((f) => appShellFiles.add(f));
}
// Core App Router chunks (main-app, webpack, framework)
if (appManifest.pages) {
  for (const chunks of Object.values(appManifest.pages)) {
    for (const c of chunks) {
      if (c.includes("main-app") || c.includes("framework") || c.includes("webpack")) {
        appShellFiles.add(c);
      }
    }
  }
}

let appShellRawBytes = 0;
let appShellGzipBytes = 0;
for (const file of appShellFiles) {
  const s = getCompressedSize(file);
  if (s) {
    appShellRawBytes += s.raw;
    appShellGzipBytes += s.gzip;
  }
}

// 2. Calculate Per-Route Bundle Sizes
const routeSizes = {};
const allRoutes = { ...buildManifest.pages, ...appManifest.pages };

for (const [route, chunks] of Object.entries(allRoutes)) {
  if (route.startsWith("/_")) continue; // internal pages

  let routeRaw = 0;
  let routeGzip = 0;
  const uniqueChunks = new Set(chunks);

  for (const chunk of uniqueChunks) {
    const s = getCompressedSize(chunk);
    if (s) {
      routeRaw += s.raw;
      routeGzip += s.gzip;
    }
  }

  const isReport = HEAVY_REPORT_PATTERNS.some((p) => route.includes(p));
  const budgetBytes = isReport
    ? BUDGETS.REPORTS_ROUTE_MAX_BYTES
    : BUDGETS.NORMAL_ROUTE_MAX_BYTES;

  routeSizes[route] = {
    rawBytes: routeRaw,
    gzipBytes: routeGzip,
    budgetBytes,
    isReport,
  };
}

// 3. Load baseline for regression comparison
let baseline = null;
if (fs.existsSync(BASELINE_PATH)) {
  try {
    baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8"));
  } catch {}
}

const updateBaseline = process.argv.includes("--update-baseline") || !baseline;

console.log("\n================================================================================");
console.log("  SCHOOLMITRA ERP — NEXT.JS BUNDLE SIZE & BUDGET ENFORCEMENT (PF-R02)");
console.log("================================================================================\n");

let hasViolations = false;
const violationsList = [];

// Check App Shell
const appShellKb = (appShellGzipBytes / 1024).toFixed(1);
const appShellBudgetKb = (BUDGETS.APP_SHELL_MAX_BYTES / 1024).toFixed(0);
const appShellPass = appShellGzipBytes <= BUDGETS.APP_SHELL_MAX_BYTES;

console.log(`App Shell (Shared Chunks): ${appShellKb} KB gzip / Budget: ${appShellBudgetKb} KB [${appShellPass ? "PASS" : "FAIL"}]`);
if (!appShellPass) {
  hasViolations = true;
  violationsList.push(`App Shell (${appShellKb} KB) exceeded budget (${appShellBudgetKb} KB)`);
}

console.log("\n--------------------------------------------------------------------------------");
console.log(
  `| ${"Route".padEnd(42)} | ${"Gzip (KB)".padEnd(10)} | ${"Budget".padEnd(8)} | ${"Baseline".padEnd(10)} | ${"Diff".padEnd(8)} | ${"Status".padEnd(6)} |`
);
console.log("--------------------------------------------------------------------------------");

const outputBaselineData = {
  appShellGzipBytes,
  routes: {},
};

for (const [route, data] of Object.entries(routeSizes)) {
  const gzipKb = (data.gzipBytes / 1024).toFixed(1);
  const budgetKb = (data.budgetBytes / 1024).toFixed(0);
  const baselineGzip = baseline?.routes?.[route]?.gzipBytes;
  
  outputBaselineData.routes[route] = {
    gzipBytes: data.gzipBytes,
    rawBytes: data.rawBytes,
  };

  let diffText = "NEW";
  let regressed = false;

  if (baselineGzip) {
    const diffPct = ((data.gzipBytes - baselineGzip) / baselineGzip) * 100;
    diffText = `${diffPct > 0 ? "+" : ""}${diffPct.toFixed(1)}%`;
    if (diffPct > BUDGETS.REGRESSION_THRESHOLD_PCT) {
      regressed = true;
    }
  }

  const budgetExceeded = data.gzipBytes > data.budgetBytes;
  const isPreExistingDebt = baselineGzip && baselineGzip > data.budgetBytes;

  let status = "PASS";
  if (regressed) {
    status = "FAIL";
    hasViolations = true;
    violationsList.push(`Route ${route} regressed by ${diffText} vs baseline (max allowed: +${BUDGETS.REGRESSION_THRESHOLD_PCT}%)`);
  } else if (budgetExceeded) {
    if (isPreExistingDebt) {
      status = "DEBT";
    } else {
      status = "FAIL";
      hasViolations = true;
      violationsList.push(`Route ${route} (${gzipKb} KB) exceeded budget (${budgetKb} KB)`);
    }
  }

  console.log(
    `| ${route.padEnd(42)} | ${gzipKb.padStart(10)} | ${budgetKb.padStart(8)} | ${(baselineGzip ? (baselineGzip / 1024).toFixed(1) : "-").padStart(10)} | ${diffText.padStart(8)} | ${status.padStart(6)} |`
  );
}

console.log("--------------------------------------------------------------------------------\n");

if (updateBaseline) {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(outputBaselineData, null, 2), "utf-8");
  console.log(`[BASELINE SAVED] Updated bundle baseline at ${BASELINE_PATH}\n`);
  console.log("================================================================================");
  console.log("  ✅ BASELINE ESTABLISHED SUCCESSFULLY (PF-R00 / PF-R02)");
  console.log("================================================================================\n");
  process.exit(0);
}

if (hasViolations) {
  console.error("================================================================================");
  console.error("  ❌ BUNDLE BUDGET ENFORCEMENT FAILED (PF-R02)");
  console.error("================================================================================");
  violationsList.forEach((v) => console.error(`  - ${v}`));
  console.error("\nBuild failed due to bundle budget violations. Optimize imports before landing.\n");
  process.exit(1);
} else {
  console.log("================================================================================");
  console.log("  ✅ ALL BUNDLE BUDGETS PASSED (PF-R02)");
  console.log("================================================================================\n");
}
