export type MigrationDomain =
  | "CORE_IDENTITY"
  | "ACADEMICS"
  | "STUDENTS_LIFECYCLE"
  | "ADMISSIONS"
  | "ATTENDANCE"
  | "EXAMINATIONS"
  | "FEES_FINANCE"
  | "HR_STAFF"
  | "TRANSPORT"
  | "COMMUNICATION"
  | "DPDP_PRIVACY"
  | "INVENTORY_FACILITIES"
  | "SECURITY_RLS"
  | "SYSTEM_TELEMETRY";

export interface MigrationForeignKey {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  onDelete?: "CASCADE" | "RESTRICT" | "SET NULL" | "NO ACTION";
}

export interface MigrationMetadata {
  index: number;
  tag: string;
  filename: string;
  domain: MigrationDomain;
  title: string;
  description: string;
  tablesCreated: string[];
  tablesAltered: string[];
  foreignKeysAdded: MigrationForeignKey[];
  indexesCreated: string[];
  rlsPoliciesAdded: string[];
  breakingChange: boolean;
}

export interface TableForeignKey {
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  onDelete?: string;
  relationType: "MANY_TO_ONE" | "ONE_TO_ONE";
}

export interface TableReferencedBy {
  sourceTable: string;
  sourceColumn: string;
  targetColumn: string;
  relationType: "ONE_TO_MANY" | "ONE_TO_ONE";
}

export interface TableSchemaMeta {
  tableName: string;
  schemaFile: string;
  domain: MigrationDomain;
  displayName: string;
  description: string;
  primaryKey: string[];
  tenantKey?: string;
  isTenantScoped: boolean;
  createdInMigration: string;
  alteredInMigrations: string[];
  foreignKeys: TableForeignKey[];
  referencedBy: TableReferencedBy[];
  piiColumns: string[];
}

export type MigrationNERIntent =
  | "INSPECT_TABLE"
  | "INSPECT_MIGRATION"
  | "TRACE_RELATIONS"
  | "TOPOLOGICAL_SORT"
  | "LIST_DOMAIN_TABLES"
  | "LIST_DOMAIN_MIGRATIONS"
  | "AUDIT_PII"
  | "UNKNOWN";

export type MigrationEntityType =
  | "TABLE"
  | "MIGRATION"
  | "DOMAIN"
  | "COLUMN"
  | "ACTION";

export interface RecognizedMigrationEntity {
  type: MigrationEntityType;
  raw: string;
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

export interface MigrationNERResult {
  rawQuery: string;
  intent: MigrationNERIntent;
  matchedEntities: RecognizedMigrationEntity[];
  targetTable?: TableSchemaMeta | undefined;
  targetMigration?: MigrationMetadata | undefined;
  targetDomain?: MigrationDomain | undefined;
  summary: string;
  data?: any | undefined;
  executionTimeMs: number;
}
