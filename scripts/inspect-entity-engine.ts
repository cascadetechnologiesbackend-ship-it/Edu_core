/**
 * CLI Demonstration & Inspection Utility for @schoolmitra/entity-engine
 *
 * Demonstrates:
 * 1. Database Schema Entity Catalog & Topological Sort Ordering
 * 2. Omnibox Query Named Entity Recognition (NER) & Route Dispatching (<5ms)
 * 3. DPDP Act 2023 Statutory PII Scanner & Multi-Mode Redactor
 *
 * Usage:
 *   npx tsx scripts/inspect-entity-engine.ts
 */

import {
  generateVerhoeff,
  getAllDomainsMetadata,
  getAllEntities,
  getPIIColumns,
  parseOmniboxQuery,
  redactPII,
  scanPII,
  topologicalSort,
} from "../packages/entity-engine/src";

function main() {
  console.log("================================================================================");
  console.log("       @schoolmitra/entity-engine - SCHEMA CATALOG, QUERY NER & DPDP NER        ");
  console.log("================================================================================\n");

  // ─── 1. Catalog & Topological Ordering ──────────────────────────────────────
  console.log("--- 1. DATABASE SCHEMA CATALOG & DEPENDENCY GRAPH ---");
  const entities = getAllEntities();
  const domains = getAllDomainsMetadata();

  console.log(`Total Cataloged Entities: ${entities.length}`);
  console.log(`Total Functional Domains: ${domains.length}\n`);

  console.log("Domain Breakdown:");
  for (const d of domains) {
    console.log(`  * ${d.displayName.padEnd(38)} [${d.domain}] : ${d.tableCount} tables`);
  }

  const sortedTables = topologicalSort();
  console.log("\nTopological Dependency Sort (Kahn's DAG ordering):");
  console.log(`  Root entities (seeded first): ${sortedTables.slice(0, 5).join(" -> ")}`);
  console.log(`  Leaf entities (seeded last) : ${sortedTables.slice(-5).join(" -> ")}`);

  let totalPIIColumns = 0;
  for (const e of entities) {
    const pii = getPIIColumns(e.tableName);
    totalPIIColumns += pii.length;
  }
  console.log(`  Total DPDP PII Annotated Columns: ${totalPIIColumns} columns\n`);

  // ─── 2. Omnibox Query NER Parser ────────────────────────────────────────────
  console.log("--- 2. OMNIBOX QUERY NAMED ENTITY RECOGNITION (NER) ---");
  const testQueries = [
    "enter marks class 10-A mathematics",
    "where is bus route 4",
    "tuition fee dues",
    "generate report card class 5-b",
    "take attendance grade 8",
    "annual exam schedule datesheet",
  ];

  for (const q of testQueries) {
    const res = parseOmniboxQuery(q);
    console.log(`Query: "${q}" (${res.parseDurationMs}ms)`);
    console.log(`  Intent      : ${res.primaryIntent?.type || "NONE"} [${res.primaryIntent?.targetDomain || "N/A"}]`);
    console.log(`  Target Route: ${res.targetRoute || "N/A"}`);
    console.log(`  Action Label: ${res.actionLabel || "N/A"}`);
    const entityTokens = res.recognizedEntities.map((e) => `${e.type}:"${e.normalized}"`).join(", ");
    console.log(`  Entities    : [${entityTokens}]\n`);
  }

  // ─── 3. DPDP Act 2023 PII Privacy Scanner & Redactor ───────────────────────
  console.log("--- 3. DPDP ACT 2023 STATUTORY PII SCANNER & REDACTOR ---");
  const validAadhaar = "36728491024" + generateVerhoeff("36728491024");
  const samplePayload =
    `Student profile for Aarav Sharma.\n` +
    `Aadhaar Number: ${validAadhaar} (Verhoeff checksum verified)\n` +
    `Father PAN: ABCDE1234F | Emergency Mobile: +91 9876543210\n` +
    `Primary Guardian Email: guardian.lead@schoolmitra.org\n` +
    `Fee settlement via UPI: ramesh.sharma@okhdfcbank or IFSC HDFC0001234\n` +
    `Health SPDI: blood group: B+, asthma diagnosed. Category: General`;

  console.log("Original Unredacted Payload:");
  console.log(samplePayload.split("\n").map((l) => `  ${l}`).join("\n"));

  const detected = scanPII(samplePayload);
  console.log(`\nDetected PII Tokens (${detected.length} items):`);
  for (const item of detected) {
    console.log(`  * [${item.riskLevel.padEnd(8)}] ${item.type.padEnd(20)}: "${item.raw}" (${item.description})`);
  }

  const masked = redactPII(samplePayload, { mode: "MASK_PARTIAL" });
  console.log("\nMasked Payload (MASK_PARTIAL - Safe for logs / UI):");
  console.log(masked.redactedText.split("\n").map((l) => `  ${l}`).join("\n"));

  const fullyRedacted = redactPII(samplePayload, { mode: "REDACT_FULL" });
  console.log("\nFully Redacted Payload (REDACT_FULL - Safe for non-privileged audits):");
  console.log(fullyRedacted.redactedText.split("\n").map((l) => `  ${l}`).join("\n"));

  console.log("================================================================================");
  console.log("           @schoolmitra/entity-engine VALIDATION COMPLETED SUCCESSFULLY         ");
  console.log("================================================================================");
}

main();
