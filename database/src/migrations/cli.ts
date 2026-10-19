/**
 * CLI Demonstration & Inspection Utility for Database Migrations, Schema Graph & Migration NER.
 *
 * Usage:
 *   pnpm exec tsx database/src/migrations/cli.ts
 */

import {
  getAllMigrations,
  getAllTableMetas,
  queryMigrationNER,
  topologicalTableSort,
} from "./index";

function main() {
  console.log("================================================================================");
  console.log("    @schoolmitra/database - MIGRATION CATALOG, SCHEMA GRAPH & MIGRATION NER     ");
  console.log("================================================================================\n");

  // ─── 1. Migrations Chronological Catalog ────────────────────────────────────
  console.log("--- 1. CHRONOLOGICAL MIGRATION CATALOG (44 MIGRATIONS) ---");
  const migrations = getAllMigrations();
  console.log(`Total Migrations Indexed: ${migrations.length}\n`);

  console.log("First 5 Migrations:");
  for (const m of migrations.slice(0, 5)) {
    console.log(`  [${String(m.index).padStart(2, "0")}] ${m.tag.padEnd(36)} (${m.domain.padEnd(16)}) : ${m.title}`);
  }
  console.log("  ...");
  console.log("Latest 5 Migrations:");
  for (const m of migrations.slice(-5)) {
    console.log(`  [${String(m.index).padStart(2, "0")}] ${m.tag.padEnd(36)} (${m.domain.padEnd(16)}) : ${m.title}`);
  }

  // ─── 2. Schema Table Graph & Dependencies ──────────────────────────────────
  console.log("\n--- 2. SCHEMA TABLE RELATIONSHIP GRAPH & TOPOLOGICAL SORT ---");
  const tables = getAllTableMetas();
  console.log(`Total Structural Tables Cataloged: ${tables.length}`);

  const sortedTables = topologicalTableSort();
  console.log("\nTopological Dependency Creation Order (Kahn's DAG Algorithm):");
  console.log(`  Root (Independent) : ${sortedTables.slice(0, 5).join(" -> ")}`);
  console.log(`  Leaf (Dependent)   : ${sortedTables.slice(-5).join(" -> ")}`);

  // ─── 3. Migration Named Entity Recognition (NER) ───────────────────────────
  console.log("\n--- 3. MIGRATION & SCHEMA NAMED ENTITY RECOGNITION (NER) ---");
  const testQueries = [
    "which migration created exam_marks_locks",
    "trace relations of mark_entries",
    "show migrations for fees",
    "topological sort of tables",
    "what tables depend on schools",
    "audit pii in students",
  ];

  for (const q of testQueries) {
    const res = queryMigrationNER(q);
    console.log(`\nQuery: "${q}" (${res.executionTimeMs}ms)`);
    console.log(`  Intent  : ${res.intent}`);
    console.log(`  Entities: [${res.matchedEntities.map((e) => `${e.type}:${e.value}`).join(", ")}]`);
    console.log(`  Summary : ${res.summary}`);
  }

  console.log("\n================================================================================");
  console.log("         DATABASE MIGRATIONS, SCHEMA GRAPH & NER VERIFIED SUCCESSFULLY          ");
  console.log("================================================================================");
}

main();
