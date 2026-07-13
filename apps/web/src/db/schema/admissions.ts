// ─── Admissions Schema ────────────────────────────────────────────────────────
// Tables: admission_applications, admission_documents, admission_workflow_steps, waitlist

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, academicYears } from "./core";
import { gradeLevelEnum, genderEnum, categoryEnum } from "./students";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const admissionStatusEnum = pgEnum("admission_status", [
  "APPLIED",
  "SCREENING",
  "ENTRANCE_TEST",
  "INTERVIEW",
  "OFFER_LETTER",
  "ENROLLED",
  "REJECTED",
  "WAITLISTED",
  "WITHDRAWN",
]);

export const admissionDocTypeEnum = pgEnum("admission_doc_type", [
  "BIRTH_CERTIFICATE",
  "AADHAAR_PHOTO_MASKED",
  "PREVIOUS_TC",
  "VACCINATION_RECORD",
  "PASSPORT_PHOTO",
  "CASTE_CERTIFICATE",
  "INCOME_CERTIFICATE",
  "DISABILITY_CERTIFICATE",
  "OTHER",
]);

// ─── admission_applications ───────────────────────────────────────────────────

export const admissionApplications = pgTable(
  "admission_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationNumber: text("application_number").notNull(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    // Applicant details — PII encrypted
    applicantNameEncrypted: text("applicant_name_encrypted").notNull(),
    dateOfBirth: timestamp("date_of_birth", { withTimezone: true }).notNull(),
    gender: genderEnum("gender").notNull(),
    category: categoryEnum("category").notNull(),
    gradeAppliedFor: gradeLevelEnum("grade_applied_for").notNull(),
    previousSchool: text("previous_school"),
    // Parent / Guardian details — PII encrypted
    fatherNameEncrypted: text("father_name_encrypted").notNull(),
    motherNameEncrypted: text("mother_name_encrypted").notNull(),
    guardianNameEncrypted: text("guardian_name_encrypted"),
    primaryContactMobileEncrypted: text("primary_contact_mobile_encrypted").notNull(),
    primaryContactEmailEncrypted: text("primary_contact_email_encrypted").notNull(),
    addressEncrypted: text("address_encrypted").notNull(),
    pincode: text("pincode").notNull(),
    // Workflow
    status: admissionStatusEnum("status").notNull().default("APPLIED"),
    currentWorkflowStep: integer("current_workflow_step").notNull().default(1),
    assignedToUserId: uuid("assigned_to_user_id"),
    // Priorities
    isRteApplicant: boolean("is_rte_applicant").notNull().default(false),
    hasSiblingInSchool: boolean("has_sibling_in_school").notNull().default(false),
    siblingStudentId: uuid("sibling_student_id"),
    isStaffWard: boolean("is_staff_ward").notNull().default(false),
    // Outcome
    rejectionReason: text("rejection_reason"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    enrolledStudentId: uuid("enrolled_student_id"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }),
    // DPDP: Consent given at step 1 (before any data entry)
    consentRecordedAt: timestamp("consent_recorded_at", { withTimezone: true }),
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    appNumberUnique: unique("admission_applications_number_unique").on(
      t.schoolId,
      t.applicationNumber
    ),
    schoolYearIdx: index("admission_applications_school_year_idx").on(
      t.schoolId,
      t.academicYearId
    ),
    statusIdx: index("admission_applications_status_idx").on(t.status),
    gradeIdx: index("admission_applications_grade_idx").on(t.gradeAppliedFor),
  })
);

// ─── admission_documents ─────────────────────────────────────────────────────

export const admissionDocuments = pgTable(
  "admission_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => admissionApplications.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    documentType: admissionDocTypeEnum("document_type").notNull(),
    s3Key: text("s3_key").notNull(),
    originalFileName: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    isVerified: boolean("is_verified").notNull().default(false),
    verifiedById: uuid("verified_by_id"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    applicationIdx: index("admission_documents_application_idx").on(t.applicationId),
    schoolIdx: index("admission_documents_school_idx").on(t.schoolId),
  })
);

// ─── admission_workflow_steps ─────────────────────────────────────────────────

export const admissionWorkflowSteps = pgTable(
  "admission_workflow_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => admissionApplications.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    stepNumber: integer("step_number").notNull(),
    stepName: text("step_name").notNull(),
    status: text("status").notNull().default("PENDING"), // PENDING, COMPLETED, SKIPPED
    completedById: uuid("completed_by_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    applicationStepUnique: unique("admission_workflow_unique").on(
      t.applicationId,
      t.stepNumber
    ),
    applicationIdx: index("admission_workflow_steps_application_idx").on(t.applicationId),
  })
);

// ─── waitlist ─────────────────────────────────────────────────────────────────

export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => admissionApplications.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    gradeAppliedFor: gradeLevelEnum("grade_applied_for").notNull(),
    rank: integer("rank").notNull(),
    category: categoryEnum("category").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    offeredAt: timestamp("offered_at", { withTimezone: true }),
    offerExpiresAt: timestamp("offer_expires_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    gradeRankIdx: index("waitlist_grade_rank_idx").on(
      t.schoolId,
      t.academicYearId,
      t.gradeAppliedFor,
      t.rank
    ),
  })
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const admissionApplicationsRelations = relations(
  admissionApplications,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [admissionApplications.schoolId],
      references: [schools.id],
    }),
    academicYear: one(academicYears, {
      fields: [admissionApplications.academicYearId],
      references: [academicYears.id],
    }),
    documents: many(admissionDocuments),
    workflowSteps: many(admissionWorkflowSteps),
  })
);
