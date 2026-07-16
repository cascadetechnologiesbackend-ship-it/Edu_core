// ─── Students Schema ─────────────────────────────────────────────────────────
// Tables: students, student_family_members, student_medical_records,
//         student_class_history, student_documents, alumni

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, academicYears } from "./core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const genderEnum = pgEnum("gender", ["MALE", "FEMALE", "OTHER"]);

export const categoryEnum = pgEnum("category", [
  "GENERAL",
  "SC",
  "ST",
  "OBC",
  "EWS",
]);

export const bloodGroupEnum = pgEnum("blood_group", [
  "A_POSITIVE",
  "A_NEGATIVE",
  "B_POSITIVE",
  "B_NEGATIVE",
  "AB_POSITIVE",
  "AB_NEGATIVE",
  "O_POSITIVE",
  "O_NEGATIVE",
]);

export const gradeLevelEnum = pgEnum("grade_level", [
  "NURSERY",
  "LKG",
  "UKG",
  "CLASS_1",
  "CLASS_2",
  "CLASS_3",
  "CLASS_4",
  "CLASS_5",
  "CLASS_6",
  "CLASS_7",
  "CLASS_8",
  "CLASS_9",
  "CLASS_10",
]);

export const familyRelationEnum = pgEnum("family_relation", [
  "FATHER",
  "MOTHER",
  "GUARDIAN",
  "SIBLING",
  "GRANDPARENT",
]);

// ─── students ─────────────────────────────────────────────────────────────────

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    admissionNumber: text("admission_number").notNull(),
    // Personal — PII encrypted at application layer
    firstNameEncrypted: text("first_name_encrypted").notNull(),
    middleNameEncrypted: text("middle_name_encrypted"),
    lastNameEncrypted: text("last_name_encrypted").notNull(),
    // Non-PII searchable fields (hashed for lookup)
    firstNameSearchHash: text("first_name_search_hash"), // HMAC for search
    lastNameSearchHash: text("last_name_search_hash"),
    dateOfBirth: timestamp("date_of_birth", { withTimezone: true }).notNull(),
    gender: genderEnum("gender").notNull(),
    bloodGroup: bloodGroupEnum("blood_group"),
    category: categoryEnum("category").notNull(),
    motherTongue: text("mother_tongue"),
    religion: text("religion"),
    nationality: text("nationality").notNull().default("Indian"),
    // Aadhaar — last 4 digits ONLY (DPDP mandatory)
    aadhaarLast4: text("aadhaar_last4"), // "1234" only — NEVER full number
    apaarId: text("apaar_id"), // Academic Bank of Credits ID
    // Photo (S3 signed URL — not stored directly)
    photoS3Key: text("photo_s3_key"),
    // Class assignment (denormalised for performance — canonical in student_class_history)
    currentClassId: uuid("current_class_id"),
    currentSectionId: uuid("current_section_id"),
    rollNumber: text("roll_number"),
    // Admission
    admissionDate: timestamp("admission_date", { withTimezone: true }).notNull(),
    admissionApplicationId: uuid("admission_application_id"),
    previousSchool: text("previous_school"),
    rteApplicant: boolean("rte_applicant").notNull().default(false),
    // Linked user account (for student login)
    userId: uuid("user_id"),
    // Primary parent/guardian user
    primaryParentUserId: uuid("primary_parent_user_id"),
    // Status
    isActive: boolean("is_active").notNull().default(true),
    legalHold: boolean("legal_hold").notNull().default(false),
    leavingDate: timestamp("leaving_date", { withTimezone: true }),
    leavingReason: text("leaving_reason"),
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    admissionNumberUnique: unique("students_admission_number_unique").on(
      t.schoolId,
      t.admissionNumber
    ),
    schoolYearIdx: index("students_school_year_idx").on(t.schoolId, t.academicYearId),
    schoolIdx: index("students_school_idx").on(t.schoolId),
    classIdx: index("students_class_idx").on(t.currentClassId, t.currentSectionId),
    searchIdx: index("students_search_idx").on(t.firstNameSearchHash, t.lastNameSearchHash),
  })
);

// ─── student_family_members ───────────────────────────────────────────────────

export const studentFamilyMembers = pgTable(
  "student_family_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    relation: familyRelationEnum("relation").notNull(),
    // PII — AES-256 encrypted
    nameEncrypted: text("name_encrypted").notNull(),
    mobileEncrypted: text("mobile_encrypted"),
    emailEncrypted: text("email_encrypted"),
    occupationEncrypted: text("occupation_encrypted"),
    aadhaarLast4: text("aadhaar_last4"), // last 4 only — NEVER full
    // Linked user account
    userId: uuid("user_id"),
    // Emergency contact
    isEmergencyContact: boolean("is_emergency_contact").notNull().default(false),
    isPrimaryContact: boolean("is_primary_contact").notNull().default(false),
    // Consent authority
    hasConsentAuthority: boolean("has_consent_authority").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    studentIdx: index("student_family_members_student_idx").on(t.studentId),
    schoolIdx: index("student_family_members_school_idx").on(t.schoolId),
  })
);

// ─── student_medical_records ──────────────────────────────────────────────────
// ACCESS RESTRICTED: School Admin + Medical Staff only
// Requires consent purpose: "health_records"

export const studentMedicalRecords = pgTable(
  "student_medical_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    // All fields AES-256 encrypted — health data is sensitive PII
    allergiesEncrypted: text("allergies_encrypted"),
    disabilitiesEncrypted: text("disabilities_encrypted"),
    currentMedicationsEncrypted: text("current_medications_encrypted"),
    medicalConditionsEncrypted: text("medical_conditions_encrypted"),
    doctorNameEncrypted: text("doctor_name_encrypted"),
    doctorContactEncrypted: text("doctor_contact_encrypted"),
    emergencyNotes: text("emergency_notes_encrypted"),
    lastUpdatedById: uuid("last_updated_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    studentUnique: unique("student_medical_records_student_unique").on(t.studentId),
    schoolIdx: index("student_medical_records_school_idx").on(t.schoolId),
  })
);

// ─── student_class_history ────────────────────────────────────────────────────

export const studentClassHistory = pgTable(
  "student_class_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    classId: uuid("class_id").notNull(),
    sectionId: uuid("section_id").notNull(),
    rollNumber: text("roll_number"),
    promotionStatus: text("promotion_status"), // "PROMOTED", "DETAINED", "TRANSFERRED"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    studentYearUnique: unique("student_class_history_unique").on(
      t.studentId,
      t.academicYearId
    ),
    studentIdx: index("student_class_history_student_idx").on(t.studentId),
    schoolYearIdx: index("student_class_history_school_year_idx").on(
      t.schoolId,
      t.academicYearId
    ),
  })
);

// ─── student_documents ────────────────────────────────────────────────────────

export const studentDocuments = pgTable(
  "student_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    documentType: text("document_type").notNull(), // "BIRTH_CERTIFICATE", "TC", "AADHAAR_PHOTO", "VACCINATION"
    s3Key: text("s3_key").notNull(), // Private S3 key — never public URL
    originalFileName: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSizeBytes: text("file_size_bytes").notNull(),
    uploadedById: uuid("uploaded_by_id").notNull(),
    isVerified: boolean("is_verified").notNull().default(false),
    verifiedById: uuid("verified_by_id"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    studentIdx: index("student_documents_student_idx").on(t.studentId),
    schoolIdx: index("student_documents_school_idx").on(t.schoolId),
  })
);

// ─── alumni ───────────────────────────────────────────────────────────────────

export const alumni = pgTable(
  "alumni",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    graduationYear: text("graduation_year").notNull(),
    // Contact for alumni tracking — consent required ("alumni_data" purpose)
    contactEmailEncrypted: text("contact_email_encrypted"),
    contactMobileEncrypted: text("contact_mobile_encrypted"),
    currentInstitution: text("current_institution"),
    notes: text("notes"),
    consentGiven: boolean("consent_given").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    studentUnique: unique("alumni_student_unique").on(t.studentId),
    schoolIdx: index("alumni_school_idx").on(t.schoolId),
  })
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, { fields: [students.schoolId], references: [schools.id] }),
  academicYear: one(academicYears, {
    fields: [students.academicYearId],
    references: [academicYears.id],
  }),
  familyMembers: many(studentFamilyMembers),
  medicalRecord: one(studentMedicalRecords),
  classHistory: many(studentClassHistory),
  documents: many(studentDocuments),
  alumni: one(alumni),
}));

export const studentFamilyMembersRelations = relations(
  studentFamilyMembers,
  ({ one }) => ({
    student: one(students, {
      fields: [studentFamilyMembers.studentId],
      references: [students.id],
    }),
    school: one(schools, {
      fields: [studentFamilyMembers.schoolId],
      references: [schools.id],
    }),
  })
);

export const studentMedicalRecordsRelations = relations(studentMedicalRecords, ({ one }) => ({
  student: one(students, { fields: [studentMedicalRecords.studentId], references: [students.id] }),
  school: one(schools, { fields: [studentMedicalRecords.schoolId], references: [schools.id] }),
}));

export const studentClassHistoryRelations = relations(studentClassHistory, ({ one }) => ({
  student: one(students, { fields: [studentClassHistory.studentId], references: [students.id] }),
  school: one(schools, { fields: [studentClassHistory.schoolId], references: [schools.id] }),
  academicYear: one(academicYears, { fields: [studentClassHistory.academicYearId], references: [academicYears.id] }),
}));

export const studentDocumentsRelations = relations(studentDocuments, ({ one }) => ({
  student: one(students, { fields: [studentDocuments.studentId], references: [students.id] }),
  school: one(schools, { fields: [studentDocuments.schoolId], references: [schools.id] }),
}));

export const alumniRelations = relations(alumni, ({ one }) => ({
  student: one(students, { fields: [alumni.studentId], references: [students.id] }),
  school: one(schools, { fields: [alumni.schoolId], references: [schools.id] }),
}));
