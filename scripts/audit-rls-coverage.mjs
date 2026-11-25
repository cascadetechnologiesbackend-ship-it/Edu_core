import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCHEMA_DIR = path.join(ROOT, "database", "src", "schema");
const MIGRATIONS_DIR = path.join(ROOT, "database", "src", "migrations");

// 1. Scan all schema files
const schemaFiles = fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts");
const tableDefinitions = [];

for (const file of schemaFiles) {
  const content = fs.readFileSync(path.join(SCHEMA_DIR, file), "utf8");
  // Match pgTable calls
  const tableRegex = /export const (\w+) = pgTable\(\s*["']([^"']+)["']/g;
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const exportName = match[1];
    const tableName = match[2];
    
    // Find the table body to check columns
    const startIdx = match.index;
    const bodyStart = content.indexOf("{", startIdx);
    // Find matching brace or end of pgTable
    let depth = 0;
    let bodyEnd = -1;
    for (let i = bodyStart; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") {
        depth--;
        if (depth === 0) {
          bodyEnd = i;
          break;
        }
      }
    }
    const tableBody = bodyEnd !== -1 ? content.slice(bodyStart, bodyEnd) : "";
    const hasSchoolId = /schoolId|school_id/.test(tableBody);
    
    tableDefinitions.push({
      file,
      exportName,
      tableName,
      hasSchoolId,
    });
  }
}

// 2. Scan all migration SQL files for RLS status
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
const rlsAppliedTables = new Set();
const forceRlsTables = new Set();
const failClosedPolicyTables = new Set();

for (const file of migrationFiles) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
  
  // Check static ALTER TABLE "tbl" ENABLE ROW LEVEL SECURITY
  const enableRegex = /ALTER TABLE\s+["']?(\w+)["']?\s+ENABLE ROW LEVEL SECURITY/gi;
  let m;
  while ((m = enableRegex.exec(sql)) !== null) {
    rlsAppliedTables.add(m[1].toLowerCase());
  }

  const forceRegex = /ALTER TABLE\s+["']?(\w+)["']?\s+FORCE ROW LEVEL SECURITY/gi;
  while ((m = forceRegex.exec(sql)) !== null) {
    forceRlsTables.add(m[1].toLowerCase());
  }

  // Check dynamic DO blocks like in 0041, 0042, and 0059
  if (file.includes("0041_fail_closed_rls") || file.includes("0042_s13_lifecycle") || file.includes("0059_complete_fail_closed_rls")) {
    const arrayMatch = sql.match(/tables\s+TEXT\[\]\s*:=\s*ARRAY\[([\s\S]*?)\];/);
    if (arrayMatch) {
      const items = arrayMatch[1]
        .split(",")
        .map((s) => s.replace(/['"\s]/g, "").toLowerCase())
        .filter(Boolean);
      for (const item of items) {
        rlsAppliedTables.add(item);
        forceRlsTables.add(item);
        failClosedPolicyTables.add(item);
      }
    }
  }
}

// 3. Compare tables
const inventory = tableDefinitions.map((t) => {
  const lowerName = t.tableName.toLowerCase();
  const rlsEnabled = rlsAppliedTables.has(lowerName);
  const forceRlsEnabled = forceRlsTables.has(lowerName);

  let category = "PLATFORM_GLOBAL";
  if (t.hasSchoolId) {
    category = "TENANT_OWNED";
  } else if (lowerName === "schools" || lowerName === "super_admins" || lowerName === "worker_heartbeats") {
    category = "PLATFORM_SYSTEM";
  }

  return {
    tableName: t.tableName,
    exportName: t.exportName,
    file: t.file,
    category,
    hasSchoolId: t.hasSchoolId,
    rlsEnabled,
    forceRlsEnabled,
    needsRemediation: t.hasSchoolId && (!rlsEnabled || !forceRlsEnabled),
  };
});

const gaps = inventory.filter((i) => i.needsRemediation);

console.log("==================================================================");
console.log(`📊 Total Discovered Tables: ${inventory.length}`);
console.log(`🏫 Tenant-Owned Tables (have school_id): ${inventory.filter((i) => i.hasSchoolId).length}`);
console.log(`🛡️  Tenant Tables with RLS & FORCE RLS: ${inventory.filter((i) => i.hasSchoolId && i.rlsEnabled && i.forceRlsEnabled).length}`);
console.log(`⚠️  Tenant Tables MISSING RLS / FORCE RLS (Gap Analysis): ${gaps.length}`);
console.log("==================================================================");

if (gaps.length > 0) {
  console.log("\nTables Requiring RLS Remediation:");
  console.table(gaps.map((g) => ({
    table: g.tableName,
    file: g.file,
    rlsEnabled: g.rlsEnabled,
    forceRls: g.forceRlsEnabled,
  })));
}

fs.writeFileSync(
  path.join(ROOT, "docs", "engineering", "RLS_TENANT_TABLE_INVENTORY.json"),
  JSON.stringify(inventory, null, 2),
);
console.log("\n✅ Detailed inventory exported to docs/engineering/RLS_TENANT_TABLE_INVENTORY.json");
