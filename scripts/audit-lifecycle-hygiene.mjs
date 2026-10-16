/**
 * S13 CI Static Hygiene Guard: Student Lifecycle Convergence
 *
 * Enforces two critical architectural invariants:
 * 1. Single Authoritative Lifecycle Engine: No direct .insert(students) is permitted
 *    anywhere in production backend or frontend application code outside of
 *    backend/src/lib/studentLifecycleEngine.ts.
 * 2. Ghost Service Elimination: Zero references to AdmissionsDomainService may exist.
 */

import fs from "fs";
import path from "path";

const projectRoot = path.resolve(".");
const searchDirs = [
  path.join(projectRoot, "backend", "src"),
  path.join(projectRoot, "frontend", "src"),
  path.join(projectRoot, "packages"),
];

const ALLOWED_STUDENT_INSERT_FILES = new Set([
  path.normalize(path.join(projectRoot, "backend", "src", "lib", "studentLifecycleEngine.ts")),
]);

const violations = [];

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip test directories, node_modules, and dist
      if (
        entry.name === "__tests__" ||
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === "dist"
      ) {
        continue;
      }
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      // Skip test files
      if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx") || entry.name.endsWith(".spec.ts")) {
        continue;
      }

      const content = fs.readFileSync(fullPath, "utf8");
      const normalizedPath = path.normalize(fullPath);

      // Check 1: Direct student insertion
      if (content.includes(".insert(students)") || content.includes("insert(students)")) {
        if (!ALLOWED_STUDENT_INSERT_FILES.has(normalizedPath)) {
          violations.push({
            file: path.relative(projectRoot, fullPath),
            type: "UNAUTHORIZED_STUDENT_INSERTION",
            message: "Direct .insert(students) found outside studentLifecycleEngine.ts",
          });
        }
      }

      // Check 2: AdmissionsDomainService reference
      if (content.includes("AdmissionsDomainService")) {
        violations.push({
          file: path.relative(projectRoot, fullPath),
          type: "RESURRECTED_GHOST_SERVICE",
          message: "Reference to deleted ghost service AdmissionsDomainService found",
        });
      }

      // Check 3: Dead in-memory event publisher elimination (Layer 6)
      if (
        content.includes("DomainEventPublisher.publish") ||
        content.includes("DomainEventPublisher.subscribe") ||
        content.includes("class DomainEventPublisher")
      ) {
        violations.push({
          file: path.relative(projectRoot, fullPath),
          type: "DEAD_IN_MEMORY_EVENT_PUBLISHER",
          message: "Reference to dead in-memory DomainEventPublisher found. Use durable domainEvents outbox table (Migration 0042) and domainEventWorker.",
        });
      }
    }
  }
}

console.log("Running S13 Lifecycle Hygiene Static Analysis...");
for (const dir of searchDirs) {
  scanDirectory(dir);
}

if (violations.length > 0) {
  console.error(`❌ S13 Lifecycle Hygiene Guard FAILED with ${violations.length} violations:`);
  for (const v of violations) {
    console.error(`  - [${v.type}] ${v.file}: ${v.message}`);
  }
  process.exit(1);
} else {
  console.log("✅ S13 Lifecycle Hygiene Guard PASSED: student creation is strictly engine-scoped, zero ghost references, zero dead in-memory event publisher references.");
  process.exit(0);
}

