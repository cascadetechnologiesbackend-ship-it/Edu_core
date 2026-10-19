import { ENTITY_GRAPH } from "./entityGraph";
import {
  CatalogEntity,
  DatabaseDomain,
  DomainMetadata,
  EntityRelationship,
} from "./types";

export * from "./types";
export { ENTITY_GRAPH } from "./entityGraph";

/**
 * Retrieve entity definition by table name.
 */
export function getEntity(tableName: string): CatalogEntity | undefined {
  return ENTITY_GRAPH[tableName];
}

/**
 * Return all cataloged entities.
 */
export function getAllEntities(): CatalogEntity[] {
  return Object.values(ENTITY_GRAPH);
}

/**
 * Return all entities belonging to a specific domain.
 */
export function getEntitiesByDomain(domain: DatabaseDomain): CatalogEntity[] {
  return Object.values(ENTITY_GRAPH).filter((e) => e.domain === domain);
}

/**
 * Returns outgoing foreign keys / dependencies for a table.
 * (i.e. relations where sourceTable is this table and targetTable != sourceTable)
 */
export function getForeignKeys(tableName: string): EntityRelationship[] {
  const entity = getEntity(tableName);
  if (!entity) return [];
  return entity.relationships.filter(
    (rel) => rel.sourceTable === tableName && rel.targetTable !== tableName
  );
}

/**
 * Returns incoming relationships / tables that reference this table.
 */
export function getReferencingTables(tableName: string): EntityRelationship[] {
  const results: EntityRelationship[] = [];
  for (const entity of Object.values(ENTITY_GRAPH)) {
    for (const rel of entity.relationships) {
      if (rel.targetTable === tableName && rel.sourceTable !== tableName) {
        results.push(rel);
      }
    }
  }
  return results;
}

/**
 * Returns list of PII columns registered for a table.
 */
export function getPIIColumns(tableName: string): string[] {
  const entity = getEntity(tableName);
  return entity ? entity.piiColumns : [];
}

/**
 * Metadata and description for domain.
 */
const DOMAIN_DESCRIPTIONS: Record<DatabaseDomain, { displayName: string; description: string }> = {
  CORE_IDENTITY: {
    displayName: "Core Identity & Tenant System",
    description: "Multi-tenant root organization, authentication, authorization roles, and audit trail.",
  },
  ACADEMICS: {
    displayName: "Academics & Timetable",
    description: "Academic sessions, classes, sections, subjects, teacher allocations, and scheduling.",
  },
  STUDENTS_LIFECYCLE: {
    displayName: "Students & Enrolment",
    description: "Student profiles, guardians, enrollment history, and identification numbers.",
  },
  ADMISSIONS: {
    displayName: "Admissions & Inquiries",
    description: "Online application intake, candidate documents, and screening workflow.",
  },
  ATTENDANCE: {
    displayName: "Attendance Management",
    description: "Daily and period-level biometric or manual attendance tracking for students and staff.",
  },
  EXAMINATIONS: {
    displayName: "Examinations & Grading",
    description: "Exams, schedules, mark entry, lock status, co-curricular assessments, and report cards.",
  },
  FEES_FINANCE: {
    displayName: "Fees & Financial Accounts",
    description: "Fee structures, student invoices, online payment settlements, waivers, and ledgers.",
  },
  HR_STAFF: {
    displayName: "Human Resources & Payroll",
    description: "Teacher and non-teaching staff records, salaries, leave requests, and payroll cycles.",
  },
  TRANSPORT: {
    displayName: "Transport & Fleet Fleet Tracking",
    description: "Vehicles, bus routes, pick-up stops, live GPS tracking, and student bus passes.",
  },
  COMMUNICATION: {
    displayName: "Noticeboard & Communication",
    description: "Broadcast circulars, event calendar, parent-teacher chat, push notifications, and SMS logs.",
  },
  DPDP_PRIVACY: {
    displayName: "DPDP 2023 Privacy & Compliance",
    description: "Statutory consent logs, right-to-erase DSR requests, and PII audit access ledger.",
  },
  INVENTORY_FACILITIES: {
    displayName: "Library & Facilities",
    description: "Library book cataloging, circulation loans, hostel room assignments, and asset inventories.",
  },
  SUPERADMIN_OPS: {
    displayName: "Platform SuperAdmin Operations",
    description: "Cross-school management, licensing, server metrics, and tenant provisioning.",
  },
};

/**
 * Get aggregated metadata for a domain.
 */
export function getDomainMetadata(domain: DatabaseDomain): DomainMetadata {
  const meta = DOMAIN_DESCRIPTIONS[domain] || {
    displayName: domain,
    description: "Domain entities",
  };
  const entities = getEntitiesByDomain(domain);
  return {
    domain,
    displayName: meta.displayName,
    description: meta.description,
    tableCount: entities.length,
    tables: entities.map((e) => e.tableName),
  };
}

/**
 * Aggregated metadata for all registered domains.
 */
export function getAllDomainsMetadata(): DomainMetadata[] {
  const domains: DatabaseDomain[] = [
    "CORE_IDENTITY",
    "ACADEMICS",
    "STUDENTS_LIFECYCLE",
    "ADMISSIONS",
    "ATTENDANCE",
    "EXAMINATIONS",
    "FEES_FINANCE",
    "HR_STAFF",
    "TRANSPORT",
    "COMMUNICATION",
    "DPDP_PRIVACY",
    "INVENTORY_FACILITIES",
    "SUPERADMIN_OPS",
  ];
  return domains.map(getDomainMetadata);
}

/**
 * Topological sort of all entities based on foreign key dependencies.
 *
 * If Table A has a foreign key to Table B, Table B must be seeded/created BEFORE Table A.
 * Therefore, dependency edge is: B -> A.
 *
 * In the event of cyclical relations (e.g. mutual FKs or circular domain ties),
 * Kahn's algorithm resolves as many nodes as possible, and remaining cyclical nodes
 * are appended stably by domain order.
 */
export function topologicalSort(): string[] {
  const allTables = Object.keys(ENTITY_GRAPH);
  const inDegree: Record<string, number> = {};
  const adjacency: Record<string, Set<string>> = {};

  for (const table of allTables) {
    inDegree[table] = 0;
    adjacency[table] = new Set();
  }

  // Build dependency graph
  for (const entity of Object.values(ENTITY_GRAPH)) {
    const dependentTable = entity.tableName; // Has foreign key

    for (const rel of entity.relationships) {
      const referencedTable = rel.targetTable; // Must exist first

      // Only count dependencies between cataloged tables, ignoring self-references
      if (
        referencedTable !== dependentTable &&
        ENTITY_GRAPH[referencedTable] &&
        rel.relationType === "MANY_TO_ONE"
      ) {
        const adj = adjacency[referencedTable];
        if (adj && !adj.has(dependentTable)) {
          adj.add(dependentTable);
          inDegree[dependentTable] = (inDegree[dependentTable] ?? 0) + 1;
        }
      }
    }
  }

  // Kahn's algorithm with a priority queue / queue
  const queue: string[] = allTables.filter((t) => inDegree[t] === 0);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    const neighbors = adjacency[node];
    if (neighbors) {
      for (const neighbor of neighbors) {
        const remaining = (inDegree[neighbor] ?? 1) - 1;
        inDegree[neighbor] = remaining;
        if (remaining === 0) {
          queue.push(neighbor);
        }
      }
    }
  }

  // If there are cycle nodes remaining, append them stably to guarantee full coverage
  if (sorted.length < allTables.length) {
    const remaining = allTables.filter((t) => !sorted.includes(t));
    sorted.push(...remaining);
  }

  return sorted;
}
