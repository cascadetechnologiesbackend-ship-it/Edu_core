// ─── DPDP Schema ─────────────────────────────────────────────────────────────
// Tables: consent_purposes, consent_records, consent_versions,
//         rights_requests, dpdp_grievances, data_breach_log,
//         vendor_register, privacy_notices, data_retention_policies
// ALL tables critical for DPDP Act 2023 compliance

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
  unique,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, users } from "./core";


// ─── Enums ────────────────────────────────────────────────────────────────────

export const consentMethodEnum = pgEnum("consent_method", [
  "web_form",
  "app",
  "physical_scan",
  "admin_attestation",
]);

export const rightsRequestTypeEnum = pgEnum("rights_request_type", [
  "ACCESS",
  "CORRECTION",
  "ERASURE",
  "GRIEVANCE",
  "NOMINATION",
]);

export const rightsRequestStatusEnum = pgEnum("rights_request_status", [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "ESCALATED_TO_DPO",
]);

export const breachSeverityEnum = pgEnum("breach_severity", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export const breachStatusEnum = pgEnum("breach_status", [
  "DETECTED",
  "CONTAINED",
  "ASSESSED",
  "BOARD_NOTIFIED",
  "PARENTS_NOTIFIED",
  "CLOSED",
]);

// ─── privacy_notices ──────────────────────────────────────────────────────────
// IMMUTABLE once published — append new versions only

export const privacyNotices = pgTable(
  "privacy_notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    version: text("version").notNull(), // e.g. "1.0", "1.1"
    titleEn: text("title_en").notNull(),
    titleHi: text("title_hi").notNull(),
    contentEn: text("content_en").notNull(), // Plain English, Flesch >60
    contentHi: text("content_hi").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(false),
    // What changed from previous version (for selective re-consent)
    changedPurposeIds: jsonb("changed_purpose_ids").default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // NO updatedAt, NO deletedAt — immutable once published
  },
  (t) => ({
    schoolVersionUnique: unique("privacy_notices_school_version_unique").on(
      t.schoolId,
      t.version,
    ),
    schoolIdx: index("privacy_notices_school_idx").on(t.schoolId),
  }),
);

// ─── consent_purposes ─────────────────────────────────────────────────────────
// Seeded from packages/dpdp/src/consent-purposes.ts

export const consentPurposes = pgTable(
  "consent_purposes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purposeId: text("purpose_id").notNull(), // matches ConsentPurposeId
    schoolId: uuid("school_id").references(() => schools.id, {
      onDelete: "restrict",
    }), // null = global
    labelEn: text("label_en").notNull(),
    labelHi: text("label_hi").notNull(),
    descriptionEn: text("description_en").notNull(),
    descriptionHi: text("description_hi").notNull(),
    mandatory: boolean("mandatory").notNull().default(false),
    legalBasis: text("legal_basis").notNull(),
    retentionDays: integer("retention_days").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    purposeIdIdx: index("consent_purposes_purpose_id_idx").on(t.purposeId),
    schoolPurposeUnique: unique("consent_purposes_school_purpose_unique").on(
      t.schoolId,
      t.purposeId,
    ),
  }),
);

// ─── consent_records ──────────────────────────────────────────────────────────
// One record per (student, purpose, grant/withdraw event)

export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(), // FK to students (defined in students schema)
    parentUserId: uuid("parent_user_id").notNull(), // FK to users
    purposeId: text("purpose_id").notNull(), // matches ConsentPurposeId
    privacyNoticeVersion: text("privacy_notice_version").notNull(),
    granted: boolean("granted").notNull(),
    method: consentMethodEnum("method").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    otpVerified: boolean("otp_verified").notNull().default(false),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    withdrawalReason: text("withdrawal_reason"),
    // Processing halt confirmation
    processingHaltedAt: timestamp("processing_halted_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // NO updatedAt — each consent event creates a new record
  },
  (t) => ({
    studentPurposeIdx: index("consent_records_student_purpose_idx").on(
      t.studentId,
      t.purposeId,
    ),
    schoolIdx: index("consent_records_school_idx").on(t.schoolId),
    parentIdx: index("consent_records_parent_idx").on(t.parentUserId),
  }),
);

// ─── rights_requests ─────────────────────────────────────────────────────────
// DPDP Act Sections 11–14: Access, Correction, Erasure, Grievance, Nomination

export const rightsRequests = pgTable(
  "rights_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketNumber: text("ticket_number").notNull(), // Auto-generated: RR-2025-001234
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    requestedByUserId: uuid("requested_by_user_id").notNull(),
    requestType: rightsRequestTypeEnum("request_type").notNull(),
    description: text("description").notNull(),
    status: rightsRequestStatusEnum("status").notNull().default("SUBMITTED"),
    // For NOMINATION type
    nomineeDetailsEncrypted: text("nominee_details_encrypted"),
    // Response
    responseDetails: text("response_details"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    respondedByUserId: uuid("responded_by_user_id"),
    // SLA tracking (30-day resolution)
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(), // submittedAt + 30 days
    escalatedToDpoAt: timestamp("escalated_to_dpo_at", { withTimezone: true }),
    // Data export (for ACCESS requests)
    dataExportS3Key: text("data_export_s3_key"),
    dataExportReadyAt: timestamp("data_export_ready_at", {
      withTimezone: true,
    }),
    dataExportExpiresAt: timestamp("data_export_expires_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ticketUnique: unique("rights_requests_ticket_unique").on(t.ticketNumber),
    schoolIdx: index("rights_requests_school_idx").on(t.schoolId),
    studentIdx: index("rights_requests_student_idx").on(t.studentId),
    statusIdx: index("rights_requests_status_idx").on(t.status),
    dueIdx: index("rights_requests_due_idx").on(t.dueAt),
  }),
);

// ─── dpdp_grievances ──────────────────────────────────────────────────────────

export const dpdpGrievances = pgTable(
  "dpdp_grievances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketNumber: text("ticket_number").notNull(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    submittedByUserId: uuid("submitted_by_user_id").notNull(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    status: rightsRequestStatusEnum("status").notNull().default("SUBMITTED"),
    resolutionDetails: text("resolution_details"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(), // + 30 days
    escalatedToDpoAt: timestamp("escalated_to_dpo_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ticketUnique: unique("dpdp_grievances_ticket_unique").on(t.ticketNumber),
    schoolIdx: index("dpdp_grievances_school_idx").on(t.schoolId),
    dueIdx: index("dpdp_grievances_due_idx").on(t.dueAt),
  }),
);

// ─── data_breach_log ─────────────────────────────────────────────────────────
// DPDP Rules 2025 Rule 7 — Breach notification within 72 hours

export const dataBreachLog = pgTable(
  "data_breach_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    incidentReference: text("incident_reference").notNull(), // BR-2025-001
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    reportedByUserId: uuid("reported_by_user_id").notNull(),
    severity: breachSeverityEnum("severity").notNull(),
    status: breachStatusEnum("status").notNull().default("DETECTED"),
    description: text("description").notNull(),
    affectedRecordsCount: integer("affected_records_count")
      .notNull()
      .default(0),
    affectedDataCategories: jsonb("affected_data_categories")
      .notNull()
      .default([]),
    containmentActions: text("containment_actions"),
    // 72-hour notification deadlines
    boardNotificationDeadline: timestamp("board_notification_deadline", {
      withTimezone: true,
    }).notNull(),
    boardNotifiedAt: timestamp("board_notified_at", { withTimezone: true }),
    parentsNotifiedAt: timestamp("parents_notified_at", { withTimezone: true }),
    affectedParentUserIds: jsonb("affected_parent_user_ids")
      .default([])
      .notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    refUnique: unique("data_breach_log_ref_unique").on(t.incidentReference),
    schoolIdx: index("data_breach_log_school_idx").on(t.schoolId),
    detectedIdx: index("data_breach_log_detected_idx").on(t.detectedAt),
  }),
);

// ─── vendor_register ─────────────────────────────────────────────────────────
// Third-party data processors — DPDP Act Section 8(7)

export const vendorRegister = pgTable(
  "vendor_register",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    vendorName: text("vendor_name").notNull(),
    vendorType: text("vendor_type").notNull(), // "PAYMENT_GATEWAY", "SMS_PROVIDER", etc.
    dataShared: jsonb("data_shared").notNull().default([]),
    purposeOfSharing: text("purpose_of_sharing").notNull(),
    dpaStatus: text("dpa_status").notNull().default("PENDING"), // "SIGNED", "PENDING", "EXPIRED"
    dpaSignedAt: timestamp("dpa_signed_at", { withTimezone: true }),
    dpaExpiresAt: timestamp("dpa_expires_at", { withTimezone: true }),
    dataRetentionByVendor: text("data_retention_by_vendor"),
    subProcessors: jsonb("sub_processors").default([]).notNull(),
    contactEmail: text("contact_email"),
    privacyPolicyUrl: text("privacy_policy_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolIdx: index("vendor_register_school_idx").on(t.schoolId),
  }),
);

// ─── data_retention_policies ─────────────────────────────────────────────────

export const dataRetentionPolicies = pgTable(
  "data_retention_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    tableName: text("table_name").notNull(),
    purposeId: text("purpose_id").notNull(),
    retentionDays: integer("retention_days").notNull(),
    description: text("description").notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    recordsDeletedLastRun: integer("records_deleted_last_run").default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolIdx: index("data_retention_policies_school_idx").on(t.schoolId),
    tableIdx: index("data_retention_policies_table_idx").on(t.tableName),
  }),
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const privacyNoticesRelations = relations(privacyNotices, ({ one }) => ({
  school: one(schools, {
    fields: [privacyNotices.schoolId],
    references: [schools.id],
  }),
}));

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  school: one(schools, {
    fields: [consentRecords.schoolId],
    references: [schools.id],
  }),
}));

export const rightsRequestsRelations = relations(rightsRequests, ({ one }) => ({
  school: one(schools, {
    fields: [rightsRequests.schoolId],
    references: [schools.id],
  }),
}));

export const vendorRegisterRelations = relations(vendorRegister, ({ one }) => ({
  school: one(schools, {
    fields: [vendorRegister.schoolId],
    references: [schools.id],
  }),
}));

// ─── pii_audit_trails ────────────────────────────────────────────────────────
// DPDP Act 2023 content-scanning enforcement audit sink.
// Append-only: no updatedAt, no deleted_at, no UPDATE/DELETE policies.
// Stores sha-256 hashes of scanned content — NEVER raw or masked PII text.

export const piiAuditTrails = pgTable(
  "pii_audit_trails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    /** Which table triggered the scan (e.g. 'notices', 'parent_teacher_messages') */
    sourceTable: text("source_table").notNull(),
    /** UUID of the record being scanned (nullable: event may precede INSERT) */
    sourceId: uuid("source_id"),
    /** Human-readable surface (e.g. 'admin.notice.compose', 'teacher.message.send') */
    surface: text("surface").notNull(),
    /** JSON array of detected PII type strings e.g. ["AADHAAR","MOBILE"] */
    detectedTypes: jsonb("detected_types").notNull().default([]),
    /** CRITICAL | HIGH | MEDIUM | LOW */
    riskLevel: text("risk_level").notNull(),
    matchCount: integer("match_count").notNull(),
    /** BLOCKED | MASKED | CONFIRMED_SEND | LOGGED_ONLY */
    decision: text("decision").notNull(),
    /** MASK_PARTIAL | REDACT_FULL — only set when decision = MASKED */
    redactionMode: text("redaction_mode"),
    /** Actor who authored the content; sourced from server session, never client input */
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /**
     * SHA-256 hex digest of the original raw input for incident forensics.
     * NEVER store raw text, masked text, or any PII-containing value here.
     */
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // NO updatedAt — append-only (BR7)
    // NO deletedAt — rows must never be purged (DPDP forensic audit requirement)
  },
  (t) => ({
    schoolIdx: index("pii_audit_trails_school_idx").on(t.schoolId),
    actorIdx: index("pii_audit_trails_actor_idx").on(t.actorUserId),
    surfaceIdx: index("pii_audit_trails_surface_idx").on(t.surface),
    riskIdx: index("pii_audit_trails_risk_idx").on(t.riskLevel),
    decisionIdx: index("pii_audit_trails_decision_idx").on(t.decision),
    createdIdx: index("pii_audit_trails_created_idx").on(t.createdAt),
    schoolCreatedIdx: index("pii_audit_trails_school_created_idx").on(
      t.schoolId,
      t.createdAt,
    ),
  }),
);

export const piiAuditTrailsRelations = relations(piiAuditTrails, ({ one }) => ({
  school: one(schools, {
    fields: [piiAuditTrails.schoolId],
    references: [schools.id],
  }),
}));

