import * as fs from "fs";
import * as path from "path";
import * as schema from "../database/src/schema/index";
import { isTable } from "drizzle-orm";
import { ENTITY_GRAPH } from "../packages/entity-engine/src/catalog/entityGraph";
import type { CatalogEntity, DatabaseDomain } from "../packages/entity-engine/src/catalog/types";

// Determine domain by schema file
function inferDomain(tableName: string, exportName: string): DatabaseDomain {
  if (
    [
      "schools", "users", "roles", "user_roles", "academic_years",
      "school_counters", "audit_logs", "permissions", "role_permissions",
      "sessions", "password_reset_tokens", "email_verification_tokens",
      "domain_events", "persons"
    ].includes(tableName)
  ) {
    return "CORE_IDENTITY";
  }

  if (
    tableName.startsWith("global_template_") ||
    [
      "super_admin_users", "platform_audit_logs", "platform_announcements",
      "platform_announcement_reads", "usage_events", "impersonation_sessions",
      "worker_heartbeats"
    ].includes(tableName)
  ) {
    return "SUPERADMIN_OPS";
  }

  if (
    [
      "privacy_notices", "consent_purposes", "consent_records",
      "rights_requests", "dpdp_grievances", "data_breach_log",
      "vendor_register", "data_retention_policies", "pii_audit_trails"
    ].includes(tableName)
  ) {
    return "DPDP_PRIVACY";
  }

  if (
    tableName.startsWith("admission_") ||
    ["waitlist"].includes(tableName)
  ) {
    return "ADMISSIONS";
  }

  if (
    tableName.startsWith("student_") &&
    [
      "student_family_members", "student_medical_records", "student_documents",
      "student_class_history", "student_subject_enrollments", "student_document_requests"
    ].includes(tableName) ||
    ["students", "alumni", "profile_change_requests"].includes(tableName)
  ) {
    return "STUDENTS_LIFECYCLE";
  }

  if (
    [
      "classes", "sections", "subjects", "class_subjects", "section_subject_teachers",
      "timetable_periods", "timetable_substitutions", "bell_schedule", "academic_terms",
      "academic_calendar_events", "lesson_plans", "syllabus_units", "syllabus_chapters",
      "syllabus_topics", "assignments", "assignment_submissions", "assessments"
    ].includes(tableName)
  ) {
    return "ACADEMICS";
  }

  if (
    [
      "student_attendance", "staff_attendance", "student_leave_requests",
      "attendance_notifications"
    ].includes(tableName)
  ) {
    return "ATTENDANCE";
  }

  if (
    tableName.startsWith("exam") ||
    tableName.startsWith("cocurricular_") ||
    tableName.startsWith("report_card") ||
    tableName.startsWith("result_") ||
    [
      "exams", "mark_entries", "public_result_lookups", "admit_card_templates",
      "grade_rules", "medical_exemptions", "certificates", "uploaded_marksheets"
    ].includes(tableName)
  ) {
    return "EXAMINATIONS";
  }

  if (
    tableName.startsWith("fee_") ||
    tableName.startsWith("student_fee_") ||
    [
      "chart_of_accounts", "account_ledger_transactions", "income_heads",
      "income_vouchers", "expense_heads", "expense_vouchers", "bank_accounts",
      "payment_gateway_logs"
    ].includes(tableName)
  ) {
    return "FEES_FINANCE";
  }

  if (
    [
      "departments", "designations", "staff", "staff_documents", "staff_loans",
      "leave_types", "leave_balances", "leave_requests", "salary_components",
      "salary_templates", "payroll_runs", "payslips"
    ].includes(tableName)
  ) {
    return "HR_STAFF";
  }

  if (
    tableName.startsWith("book_") ||
    [
      "books", "library_members", "inventory_items", "stock_movements",
      "purchase_orders", "assets", "asset_assignments", "visitor_logs",
      "hostel_rooms", "hostel_allocations"
    ].includes(tableName)
  ) {
    return "INVENTORY_FACILITIES";
  }

  if (
    [
      "routes", "route_stops", "vehicles", "gps_pings", "student_bus_passes",
      "bus_boarding_events", "stop_change_requests", "drivers"
    ].includes(tableName)
  ) {
    return "TRANSPORT";
  }

  if (
    tableName.startsWith("ptm_") ||
    [
      "notices", "notice_acknowledgments", "parent_teacher_messages",
      "parent_notification_preferences", "events", "email_logs", "sms_logs",
      "push_notification_logs", "user_push_subscriptions", "teacher_feed_cards",
      "parent_feed_cards"
    ].includes(tableName)
  ) {
    return "COMMUNICATION";
  }

  return "CORE_IDENTITY";
}

// Convert table name to friendly display name
function toDisplayName(tableName: string): string {
  return tableName
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function generateAllEntities(): Record<string, CatalogEntity> {
  const result: Record<string, CatalogEntity> = {};

  // Existing graph entities (rename 4 mismatched tables to canonical drizzle names)
  for (const [k, v] of Object.entries(ENTITY_GRAPH)) {
    let canonicalName = k;
    if (k === "class_subject_teachers") canonicalName = "section_subject_teachers";
    if (k === "admit_card_settings") canonicalName = "exam_admit_card_settings";
    if (k === "transport_routes") canonicalName = "routes";
    if (k === "library_books") canonicalName = "books";

    result[canonicalName] = {
      ...v,
      tableName: canonicalName,
      drizzleExport: v.drizzleExport || canonicalName,
    };
  }

  // Iterate all drizzle tables
  for (const [exportName, tableObj] of Object.entries(schema)) {
    if (!isTable(tableObj)) continue;

    const tableName =
      (tableObj as any)[Symbol.for("drizzle:Name")] ||
      (tableObj as any)._?.name ||
      exportName;

    if (result[tableName]) {
      result[tableName].drizzleExport = exportName;
      continue;
    }

    const cols = Object.keys((tableObj as any)._?.columns || {});
    const isTenant = cols.includes("schoolId") || cols.includes("school_id");
    const domain = inferDomain(tableName, exportName);

    const piiCols = cols.filter((c) =>
      /(encrypted|email|mobile|phone|pan|aadhaar|name|address|dob|birth|photo|emergency|bank|ifsc|salary|account)/i.test(
        c
      )
    );

    const searchableFields = cols.filter((c) =>
      ["name", "code", "title", "subject", "status", "type", "description"].includes(c)
    );

    result[tableName] = {
      tableName,
      drizzleExport: exportName,
      domain,
      displayName: toDisplayName(tableName),
      description: `Data entity representing ${toDisplayName(tableName).toLowerCase()} in the ${domain} domain.`,
      primaryKey: cols.includes("id") ? ["id"] : [cols[0] || "id"],
      ...(isTenant ? { tenantKey: "schoolId", isTenantScoped: true } : { isTenantScoped: false }),
      piiColumns: piiCols,
      searchableFields: searchableFields.length > 0 ? searchableFields : [cols[0] || "id"],
      tags: [domain.toLowerCase(), ...tableName.split("_")],
      relationships: isTenant
        ? [
            {
              sourceTable: tableName,
              targetTable: "schools",
              relationType: "MANY_TO_ONE",
              sourceColumn: "school_id",
              targetColumn: "id",
              onDelete: "RESTRICT",
              description: `${toDisplayName(tableName)} belongs to school tenant.`,
            },
          ]
        : [],
    };
  }

  return result;
}

// Write the output file
const all = generateAllEntities();
console.log(`Total generated catalog entities: ${Object.keys(all).length}`);

const outPath = path.resolve(__dirname, "../packages/entity-engine/src/catalog/entityGraph.ts");
const code = `import { CatalogEntity } from "./types";

export const ENTITY_GRAPH: Record<string, CatalogEntity> = ${JSON.stringify(all, null, 2)};
`;

fs.writeFileSync(outPath, code, "utf-8");
console.log(`Successfully written complete ENTITY_GRAPH to ${outPath}`);
