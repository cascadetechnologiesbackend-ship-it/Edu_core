export type DatabaseDomain =
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
  | "SUPERADMIN_OPS";

export type RelationType =
  | "ONE_TO_ONE"
  | "ONE_TO_MANY"
  | "MANY_TO_ONE"
  | "MANY_TO_MANY";

export type OnDeletePolicy =
  | "CASCADE"
  | "RESTRICT"
  | "SET_NULL"
  | "NO_ACTION";

export interface EntityRelationship {
  sourceTable: string;
  targetTable: string;
  relationType: RelationType;
  sourceColumn: string;
  targetColumn: string;
  onDelete: OnDeletePolicy;
  description: string;
}

export interface CatalogEntity {
  tableName: string;
  drizzleExport: string;
  domain: DatabaseDomain;
  displayName: string;
  description: string;
  primaryKey: string[];
  tenantKey?: string;
  isTenantScoped: boolean;
  piiColumns: string[];
  searchableFields: string[];
  relationships: EntityRelationship[];
  tags: string[];
}

export interface DomainMetadata {
  domain: DatabaseDomain;
  displayName: string;
  description: string;
  tableCount: number;
  tables: string[];
}
