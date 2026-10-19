import { MigrationDomain, TableSchemaMeta } from "./types";

/**
 * Structural Index and Relationship Graph of all Database Tables in @schoolmitra/database.
 */
export const TABLE_SCHEMA_GRAPH: Record<string, TableSchemaMeta> = {
  // ─── CORE_IDENTITY ──────────────────────────────────────────────────────────
  schools: {
    tableName: "schools",
    schemaFile: "core.ts",
    domain: "CORE_IDENTITY",
    displayName: "School Tenant Organization",
    description: "Root multi-tenant organization entity with board affiliation, UDISE code, and campus details.",
    primaryKey: ["id"],
    isTenantScoped: false,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: ["0022_school_profile_fields", "0043_address_demographics_and_tax_state_normalization"],
    foreignKeys: [],
    referencedBy: [
      { sourceTable: "users", sourceColumn: "school_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "academic_years", sourceColumn: "school_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "roles", sourceColumn: "school_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "students", sourceColumn: "school_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "classes", sourceColumn: "school_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: ["phone", "email", "principalName"],
  },

  users: {
    tableName: "users",
    schemaFile: "core.ts",
    domain: "CORE_IDENTITY",
    displayName: "User Account & Identity",
    description: "System authentication identities for staff, parents, students, and administrators.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: ["0006_huge_ultimates", "0028_enable_rls_tenant_isolation"],
    foreignKeys: [
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "user_roles", sourceColumn: "user_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "sessions", sourceColumn: "user_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "audit_logs", sourceColumn: "user_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "user_push_subscriptions", sourceColumn: "user_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: ["email", "mobileEncrypted", "nameEncrypted"],
  },

  roles: {
    tableName: "roles",
    schemaFile: "core.ts",
    domain: "CORE_IDENTITY",
    displayName: "Security Role",
    description: "RBAC security roles determining system and route access permissions.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: [],
    foreignKeys: [
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "user_roles", sourceColumn: "role_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "staff_designations", sourceColumn: "role_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  user_roles: {
    tableName: "user_roles",
    schemaFile: "core.ts",
    domain: "CORE_IDENTITY",
    displayName: "User Role Mapping",
    description: "Association mapping users to security roles.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: ["0002_cuddly_colossus"],
    foreignKeys: [
      { sourceColumn: "user_id", targetTable: "users", targetColumn: "id", onDelete: "CASCADE", relationType: "MANY_TO_ONE" },
      { sourceColumn: "role_id", targetTable: "roles", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [],
    piiColumns: [],
  },

  academic_years: {
    tableName: "academic_years",
    schemaFile: "core.ts",
    domain: "CORE_IDENTITY",
    displayName: "Academic Calendar Year",
    description: "Academic calendar session with start and end dates.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: [],
    foreignKeys: [
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "classes", sourceColumn: "academic_year_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "exams", sourceColumn: "academic_year_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "fee_structures", sourceColumn: "academic_year_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  // ─── ACADEMICS ──────────────────────────────────────────────────────────────
  classes: {
    tableName: "classes",
    schemaFile: "academics.ts",
    domain: "ACADEMICS",
    displayName: "Class / Grade Level",
    description: "Standard or grade level (e.g. Class 10, Grade 5) within an academic year.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: ["0009_core_module_hardening", "0028_enable_rls_tenant_isolation"],
    foreignKeys: [
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
      { sourceColumn: "academic_year_id", targetTable: "academic_years", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "sections", sourceColumn: "class_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "exam_schedules", sourceColumn: "class_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "fee_structures", sourceColumn: "class_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  sections: {
    tableName: "sections",
    schemaFile: "academics.ts",
    domain: "ACADEMICS",
    displayName: "Class Section Division",
    description: "Class subdivision (e.g. Section A, Section B) with room and class teacher assignments.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: ["0009_core_module_hardening", "0028_enable_rls_tenant_isolation"],
    foreignKeys: [
      { sourceColumn: "class_id", targetTable: "classes", targetColumn: "id", onDelete: "CASCADE", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "students", sourceColumn: "section_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  subjects: {
    tableName: "subjects",
    schemaFile: "academics.ts",
    domain: "ACADEMICS",
    displayName: "Academic Subject",
    description: "Curriculum discipline (e.g. Mathematics, Science, English) with subject code.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: ["0004_handy_major_mapleleaf", "0028_enable_rls_tenant_isolation"],
    foreignKeys: [
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "exam_schedules", sourceColumn: "subject_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "mark_entries", sourceColumn: "subject_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "student_subject_enrollments", sourceColumn: "subject_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  timetable_periods: {
    tableName: "timetable_periods",
    schemaFile: "academics.ts",
    domain: "ACADEMICS",
    displayName: "Timetable Period",
    description: "Daily bell schedule timing slots.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0001_lame_shooting_star",
    alteredInMigrations: ["0003_watery_vapor"],
    foreignKeys: [
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "timetable_slots", sourceColumn: "period_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  // ─── STUDENTS_LIFECYCLE ────────────────────────────────────────────────────
  students: {
    tableName: "students",
    schemaFile: "students.ts",
    domain: "STUDENTS_LIFECYCLE",
    displayName: "Student Scholar Record",
    description: "Primary student profile containing admission number, demographic details, and encrypted identifiers.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: [
      "0012_admission_blood_group", "0023_profile_completion", "0026_students_search_indexes",
      "0028_enable_rls_tenant_isolation", "0042_s13_lifecycle_backbone", "0043_address_demographics_and_tax_state_normalization"
    ],
    foreignKeys: [
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
      { sourceColumn: "class_id", targetTable: "classes", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
      { sourceColumn: "section_id", targetTable: "sections", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "mark_entries", sourceColumn: "student_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "student_attendance", sourceColumn: "student_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "fee_invoices", sourceColumn: "student_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "student_guardians", sourceColumn: "student_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "student_subject_enrollments", sourceColumn: "student_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [
      "firstNameEncrypted", "lastNameEncrypted", "aadhaarEncrypted",
      "apaarIdEncrypted", "dobEncrypted", "bloodGroup", "medicalConditionsEncrypted"
    ],
  },

  student_guardians: {
    tableName: "student_guardians",
    schemaFile: "students.ts",
    domain: "STUDENTS_LIFECYCLE",
    displayName: "Student Guardian / Parent",
    description: "Parents, primary guardians, and emergency contacts linked to students.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: ["0028_enable_rls_tenant_isolation"],
    foreignKeys: [
      { sourceColumn: "student_id", targetTable: "students", targetColumn: "id", onDelete: "CASCADE", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [],
    piiColumns: ["nameEncrypted", "phoneEncrypted", "emailEncrypted", "panEncrypted"],
  },

  // ─── ATTENDANCE ────────────────────────────────────────────────────────────
  student_attendance: {
    tableName: "student_attendance",
    schemaFile: "attendance.ts",
    domain: "ATTENDANCE",
    displayName: "Student Daily Attendance",
    description: "Daily or session-based attendance statuses (PRESENT, ABSENT, LATE, HALF_DAY, LEAVE).",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: ["0010_perf_indexes", "0028_enable_rls_tenant_isolation"],
    foreignKeys: [
      { sourceColumn: "student_id", targetTable: "students", targetColumn: "id", onDelete: "CASCADE", relationType: "MANY_TO_ONE" },
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [],
    piiColumns: [],
  },

  // ─── EXAMINATIONS ──────────────────────────────────────────────────────────
  exam_types: {
    tableName: "exam_types",
    schemaFile: "examinations.ts",
    domain: "EXAMINATIONS",
    displayName: "Examination Type Master",
    description: "Assessment blueprints (UNIT_TEST, HALF_YEARLY, ANNUAL, PRACTICAL).",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0036_examinations_new_tables",
    alteredInMigrations: [],
    foreignKeys: [
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "exams", sourceColumn: "exam_type_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "exam_components", sourceColumn: "exam_type_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  exams: {
    tableName: "exams",
    schemaFile: "examinations.ts",
    domain: "EXAMINATIONS",
    displayName: "Examination Assessment Term",
    description: "Concrete assessment instance in an academic year with lock states and schedules.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0036_examinations_new_tables",
    alteredInMigrations: ["0037_board_exam_blueprint", "0040_exam_integrity_closure"],
    foreignKeys: [
      { sourceColumn: "academic_year_id", targetTable: "academic_years", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
      { sourceColumn: "exam_type_id", targetTable: "exam_types", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "exam_schedules", sourceColumn: "exam_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "mark_entries", sourceColumn: "exam_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "exam_marks_locks", sourceColumn: "exam_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "cocurricular_grades", sourceColumn: "exam_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  exam_schedules: {
    tableName: "exam_schedules",
    schemaFile: "examinations.ts",
    domain: "EXAMINATIONS",
    displayName: "Exam Schedule Paper",
    description: "Scheduled subject exam paper with date, time, room number, and invigilator.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0036_examinations_new_tables",
    alteredInMigrations: [],
    foreignKeys: [
      { sourceColumn: "exam_id", targetTable: "exams", targetColumn: "id", onDelete: "CASCADE", relationType: "MANY_TO_ONE" },
      { sourceColumn: "subject_id", targetTable: "subjects", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
      { sourceColumn: "class_id", targetTable: "classes", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [],
    piiColumns: [],
  },

  mark_entries: {
    tableName: "mark_entries",
    schemaFile: "examinations.ts",
    domain: "EXAMINATIONS",
    displayName: "Student Mark Entry",
    description: "Candidate scores across theory, practical, grades, and attendance states.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0036_examinations_new_tables",
    alteredInMigrations: ["0040_exam_integrity_closure"],
    foreignKeys: [
      { sourceColumn: "exam_id", targetTable: "exams", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
      { sourceColumn: "student_id", targetTable: "students", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
      { sourceColumn: "subject_id", targetTable: "subjects", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [],
    piiColumns: [],
  },

  exam_marks_locks: {
    tableName: "exam_marks_locks",
    schemaFile: "examinations.ts",
    domain: "EXAMINATIONS",
    displayName: "Marks Entry Publication Lock",
    description: "Immutable publication lock preventing edits once mark sheets are locked.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0040_exam_integrity_closure",
    alteredInMigrations: ["0041_fail_closed_rls"],
    foreignKeys: [
      { sourceColumn: "exam_id", targetTable: "exams", targetColumn: "id", onDelete: "CASCADE", relationType: "MANY_TO_ONE" },
      { sourceColumn: "class_id", targetTable: "classes", targetColumn: "id", onDelete: "CASCADE", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [],
    piiColumns: [],
  },

  // ─── FEES_FINANCE ──────────────────────────────────────────────────────────
  fee_heads: {
    tableName: "fee_heads",
    schemaFile: "fees.ts",
    domain: "FEES_FINANCE",
    displayName: "Fee Head Category",
    description: "Accounting revenue category for fees (Tuition Fee, Transport Fee, Admission Fee).",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: ["0007_fee_heads_priority_and_matrix"],
    foreignKeys: [
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "fee_structures", sourceColumn: "fee_head_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  fee_structures: {
    tableName: "fee_structures",
    schemaFile: "fees.ts",
    domain: "FEES_FINANCE",
    displayName: "Fee Structure Tariff",
    description: "Grade-specific fee schedule with installment due dates and late fine rules.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: ["0007_fee_heads_priority_and_matrix", "0018_fee_structures_daily_late_fine_backfill"],
    foreignKeys: [
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
      { sourceColumn: "class_id", targetTable: "classes", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
      { sourceColumn: "fee_head_id", targetTable: "fee_heads", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "fee_invoices", sourceColumn: "fee_structure_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  fee_invoices: {
    tableName: "fee_invoices",
    schemaFile: "fees.ts",
    domain: "FEES_FINANCE",
    displayName: "Student Fee Invoice",
    description: "Term invoice raised against a student with amount due and payment status.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: ["0010_perf_indexes", "0024_finance_perf_indexes", "0028_enable_rls_tenant_isolation"],
    foreignKeys: [
      { sourceColumn: "student_id", targetTable: "students", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
      { sourceColumn: "fee_structure_id", targetTable: "fee_structures", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "fee_payments", sourceColumn: "invoice_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  fee_payments: {
    tableName: "fee_payments",
    schemaFile: "fees.ts",
    domain: "FEES_FINANCE",
    displayName: "Fee Payment Settlement",
    description: "Recorded online or offline fee payment receipt.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: [
      "0013_finance_and_accounts", "0014_add_upi_payment_method", "0017_idempotency_partial_unique_idx",
      "0024_finance_perf_indexes", "0027_fee_payments_txn_ref_unique_idx", "0028_enable_rls_tenant_isolation"
    ],
    foreignKeys: [
      { sourceColumn: "invoice_id", targetTable: "fee_invoices", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [],
    piiColumns: ["payerPhoneEncrypted", "payerEmailEncrypted", "receiptNumber"],
  },

  // ─── TRANSPORT ─────────────────────────────────────────────────────────────
  transport_routes: {
    tableName: "transport_routes",
    schemaFile: "transport.ts",
    domain: "TRANSPORT",
    displayName: "Transport Bus Route",
    description: "Designated bus route with start point, end destination, and schedule.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: [],
    foreignKeys: [
      { sourceColumn: "school_id", targetTable: "schools", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [
      { sourceTable: "route_stops", sourceColumn: "route_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
      { sourceTable: "student_bus_passes", sourceColumn: "route_id", targetColumn: "id", relationType: "ONE_TO_MANY" },
    ],
    piiColumns: [],
  },

  student_bus_passes: {
    tableName: "student_bus_passes",
    schemaFile: "transport.ts",
    domain: "TRANSPORT",
    displayName: "Student Transport Bus Pass",
    description: "Active transport authorization linking a student to a route and stop.",
    primaryKey: ["id"],
    tenantKey: "schoolId",
    isTenantScoped: true,
    createdInMigration: "0000_dark_garia",
    alteredInMigrations: [],
    foreignKeys: [
      { sourceColumn: "student_id", targetTable: "students", targetColumn: "id", onDelete: "CASCADE", relationType: "MANY_TO_ONE" },
      { sourceColumn: "route_id", targetTable: "transport_routes", targetColumn: "id", onDelete: "RESTRICT", relationType: "MANY_TO_ONE" },
    ],
    referencedBy: [],
    piiColumns: [],
  },
};

export function getTableMeta(tableName: string): TableSchemaMeta | undefined {
  return TABLE_SCHEMA_GRAPH[tableName.toLowerCase()];
}

export function getAllTableMetas(): TableSchemaMeta[] {
  return Object.values(TABLE_SCHEMA_GRAPH);
}

export function getTablesByDomain(domain: MigrationDomain): TableSchemaMeta[] {
  return Object.values(TABLE_SCHEMA_GRAPH).filter((t) => t.domain === domain);
}

export function getTableDependencies(tableName: string): string[] {
  const table = getTableMeta(tableName);
  if (!table) return [];
  return table.foreignKeys.map((fk) => fk.targetTable);
}

export function getTableDependents(tableName: string): string[] {
  const table = getTableMeta(tableName);
  if (!table) return [];
  return table.referencedBy.map((ref) => ref.sourceTable);
}

/**
 * Computes topological DAG sort of tables based on foreign key dependencies.
 */
export function topologicalTableSort(): string[] {
  const allTables = Object.keys(TABLE_SCHEMA_GRAPH);
  const inDegree: Record<string, number> = {};
  const adjacency: Record<string, Set<string>> = {};

  for (const table of allTables) {
    inDegree[table] = 0;
    adjacency[table] = new Set();
  }

  for (const table of Object.values(TABLE_SCHEMA_GRAPH)) {
    const dependentTable = table.tableName;
    for (const fk of table.foreignKeys) {
      const referencedTable = fk.targetTable;
      if (
        referencedTable !== dependentTable &&
        TABLE_SCHEMA_GRAPH[referencedTable]
      ) {
        const adj = adjacency[referencedTable];
        if (adj && !adj.has(dependentTable)) {
          adj.add(dependentTable);
          inDegree[dependentTable] = (inDegree[dependentTable] ?? 0) + 1;
        }
      }
    }
  }

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

  if (sorted.length < allTables.length) {
    const remaining = allTables.filter((t) => !sorted.includes(t));
    sorted.push(...remaining);
  }

  return sorted;
}
