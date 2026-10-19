import {
  getAllMigrations,
  getMigrationByIndex,
  getMigrationByTag,
  getMigrationsByDomain,
  getMigrationsForTable,
  MIGRATIONS_CATALOG,
} from "./catalog";
import {
  getAllTableMetas,
  getTableDependencies,
  getTableDependents,
  getTableMeta,
  getTablesByDomain,
  TABLE_SCHEMA_GRAPH,
  topologicalTableSort,
} from "./schemaGraph";
import {
  MigrationDomain,
  MigrationNERIntent,
  MigrationNERResult,
  RecognizedMigrationEntity,
} from "./types";

const DOMAIN_ALIASES: Record<string, MigrationDomain> = {
  core: "CORE_IDENTITY",
  identity: "CORE_IDENTITY",
  users: "CORE_IDENTITY",
  schools: "CORE_IDENTITY",
  academic: "ACADEMICS",
  academics: "ACADEMICS",
  timetable: "ACADEMICS",
  student: "STUDENTS_LIFECYCLE",
  students: "STUDENTS_LIFECYCLE",
  lifecycle: "STUDENTS_LIFECYCLE",
  admission: "ADMISSIONS",
  admissions: "ADMISSIONS",
  attendance: "ATTENDANCE",
  exam: "EXAMINATIONS",
  exams: "EXAMINATIONS",
  examinations: "EXAMINATIONS",
  marks: "EXAMINATIONS",
  grading: "EXAMINATIONS",
  fee: "FEES_FINANCE",
  fees: "FEES_FINANCE",
  finance: "FEES_FINANCE",
  accounting: "FEES_FINANCE",
  hr: "HR_STAFF",
  staff: "HR_STAFF",
  payroll: "HR_STAFF",
  transport: "TRANSPORT",
  bus: "TRANSPORT",
  fleet: "TRANSPORT",
  communication: "COMMUNICATION",
  notices: "COMMUNICATION",
  dpdp: "DPDP_PRIVACY",
  privacy: "DPDP_PRIVACY",
  library: "INVENTORY_FACILITIES",
  hostel: "INVENTORY_FACILITIES",
  rls: "SECURITY_RLS",
  security: "SECURITY_RLS",
  telemetry: "SYSTEM_TELEMETRY",
};

/**
 * Named Entity Recognition (NER) Parser for Database Migrations, Schemas, and Relationships.
 * Runs in <5ms.
 */
export function queryMigrationNER(query: string): MigrationNERResult {
  const startTime = typeof globalThis !== "undefined" && globalThis.performance
    ? globalThis.performance.now()
    : Date.now();

  const trimmed = (query || "").trim();
  const lower = trimmed.toLowerCase();

  const matchedEntities: RecognizedMigrationEntity[] = [];

  // 1. Detect Migration References (e.g. "migration 36", "0036", "0036_examinations_new_tables")
  const migRegex = /\b(?:migration\s*#?|mig\s*#?|m)?(00\d{2}[a-zA-Z0-9_]*|\d{1,4})\b/gi;
  let migMatch: RegExpExecArray | null;
  while ((migMatch = migRegex.exec(trimmed)) !== null) {
    const rawVal = migMatch[1];
    if (rawVal) {
      const idx = parseInt(rawVal, 10);
      let found = getMigrationByTag(rawVal);
      if (!found && !isNaN(idx)) {
        found = getMigrationByIndex(idx);
      }
      if (found) {
        matchedEntities.push({
          type: "MIGRATION",
          raw: migMatch[0],
          value: found.tag,
          confidence: 0.95,
          startIndex: migMatch.index,
          endIndex: migMatch.index + migMatch[0].length,
        });
        break;
      }
    }
  }

  // 2. Detect Table Name
  const knownTables = Object.keys(TABLE_SCHEMA_GRAPH);
  for (const tbl of knownTables) {
    const regex = new RegExp(`\\b${escapeRegExp(tbl)}\\b`, "i");
    const match = regex.exec(trimmed);
    if (match) {
      matchedEntities.push({
        type: "TABLE",
        raw: match[0],
        value: tbl,
        confidence: 0.98,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
      break;
    }
  }

  // 3. Detect Domain
  for (const [alias, domain] of Object.entries(DOMAIN_ALIASES)) {
    const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
    const match = regex.exec(trimmed);
    if (match) {
      // Avoid matching if already covered by table or migration
      const overlaps = matchedEntities.some(
        (e) => Math.max(match.index, e.startIndex) < Math.min(match.index + match[0].length, e.endIndex)
      );
      if (!overlaps) {
        matchedEntities.push({
          type: "DOMAIN",
          raw: match[0],
          value: domain,
          confidence: 0.90,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
        break;
      }
    }
  }

  // 4. Resolve Intent
  let intent: MigrationNERIntent = "UNKNOWN";

  if (/\b(topological|dependency order|dag sort|creation order|seed order)\b/i.test(lower)) {
    intent = "TOPOLOGICAL_SORT";
  } else if (/\b(relations?|dependencies|foreign keys?|referenced by|depends on|references?)\b/i.test(lower)) {
    intent = "TRACE_RELATIONS";
  } else if (/\b(pii|privacy|encrypted|spdi|masking)\b/i.test(lower)) {
    intent = "AUDIT_PII";
  } else if (matchedEntities.some((e) => e.type === "MIGRATION")) {
    intent = "INSPECT_MIGRATION";
  } else if (matchedEntities.some((e) => e.type === "TABLE") && /\b(migration|when was|created in|altered in)\b/i.test(lower)) {
    intent = "INSPECT_MIGRATION";
  } else if (matchedEntities.some((e) => e.type === "TABLE")) {
    intent = "INSPECT_TABLE";
  } else if (matchedEntities.some((e) => e.type === "DOMAIN") && /\b(migrations?)\b/i.test(lower)) {
    intent = "LIST_DOMAIN_MIGRATIONS";
  } else if (matchedEntities.some((e) => e.type === "DOMAIN")) {
    intent = "LIST_DOMAIN_TABLES";
  }

  // 5. Build Result & Data Payload
  const tableEntity = matchedEntities.find((e) => e.type === "TABLE");
  const migEntity = matchedEntities.find((e) => e.type === "MIGRATION");
  const domainEntity = matchedEntities.find((e) => e.type === "DOMAIN");

  const targetTable = tableEntity ? getTableMeta(tableEntity.value) : undefined;
  const targetMigration = migEntity ? getMigrationByTag(migEntity.value) : undefined;
  const targetDomain = domainEntity ? (domainEntity.value as MigrationDomain) : undefined;

  let summary = "";
  let data: any = undefined;

  switch (intent) {
    case "TOPOLOGICAL_SORT": {
      const order = topologicalTableSort();
      summary = `Computed topological DAG dependency creation order across ${order.length} tables. Seed root tables first.`;
      data = { topologicalOrder: order };
      break;
    }

    case "TRACE_RELATIONS": {
      if (targetTable) {
        const dependencies = getTableDependencies(targetTable.tableName);
        const dependents = getTableDependents(targetTable.tableName);
        summary = `Table "${targetTable.tableName}" depends on [${dependencies.join(", ") || "none"}] and is referenced by [${dependents.join(", ") || "none"}].`;
        data = {
          tableName: targetTable.tableName,
          foreignKeys: targetTable.foreignKeys,
          referencedBy: targetTable.referencedBy,
          dependencies,
          dependents,
        };
      } else {
        summary = "Please specify a valid table name to trace its foreign key relationships.";
      }
      break;
    }

    case "INSPECT_MIGRATION": {
      if (targetMigration) {
        summary = `Migration [${targetMigration.tag}] (${targetMigration.domain}): "${targetMigration.title}" - ${targetMigration.description}`;
        data = targetMigration;
      } else if (targetTable) {
        const tableMigrations = getMigrationsForTable(targetTable.tableName);
        summary = `Table "${targetTable.tableName}" was created in migration [${targetTable.createdInMigration}] and altered in ${tableMigrations.length - 1} subsequent migrations.`;
        data = {
          createdIn: targetTable.createdInMigration,
          alteredIn: targetTable.alteredInMigrations,
          allMigrations: tableMigrations.map((m) => m.tag),
        };
      } else {
        summary = "No specific migration found for query.";
      }
      break;
    }

    case "INSPECT_TABLE": {
      if (targetTable) {
        summary = `Table "${targetTable.tableName}" (${targetTable.domain}): ${targetTable.description} [Schema: ${targetTable.schemaFile}]`;
        data = targetTable;
      } else {
        summary = "Table not found in schema graph.";
      }
      break;
    }

    case "LIST_DOMAIN_TABLES": {
      if (targetDomain) {
        const tables = getTablesByDomain(targetDomain);
        summary = `Domain [${targetDomain}] contains ${tables.length} cataloged tables: ${tables.map((t) => t.tableName).join(", ")}`;
        data = tables;
      }
      break;
    }

    case "LIST_DOMAIN_MIGRATIONS": {
      if (targetDomain) {
        const migs = getMigrationsByDomain(targetDomain);
        summary = `Domain [${targetDomain}] is impacted by ${migs.length} migrations: ${migs.map((m) => m.tag).join(", ")}`;
        data = migs;
      }
      break;
    }

    case "AUDIT_PII": {
      if (targetTable) {
        summary = `Table "${targetTable.tableName}" contains ${targetTable.piiColumns.length} statutory PII columns: [${targetTable.piiColumns.join(", ") || "none"}].`;
        data = { tableName: targetTable.tableName, piiColumns: targetTable.piiColumns };
      } else {
        const allWithPII = getAllTableMetas().filter((t) => t.piiColumns.length > 0);
        summary = `Identified ${allWithPII.length} tables with registered statutory PII columns for DPDP governance.`;
        data = allWithPII.map((t) => ({ table: t.tableName, piiColumns: t.piiColumns }));
      }
      break;
    }

    default: {
      summary = `Query "${query}" parsed. Specify a table, migration number, or domain to inspect details.`;
      break;
    }
  }

  const endTime = typeof globalThis !== "undefined" && globalThis.performance
    ? globalThis.performance.now()
    : Date.now();

  const executionTimeMs = Math.round((endTime - startTime) * 100) / 100;

  return {
    rawQuery: trimmed,
    intent,
    matchedEntities,
    targetTable,
    targetMigration,
    targetDomain,
    summary,
    data,
    executionTimeMs,
  };
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
