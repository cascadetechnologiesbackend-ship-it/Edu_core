// ─── Unified Person Core Schema ───────────────────────────────────────────────
// Core Tables: persons, person_identities, person_relations
// Serves as the central identity entity for Students, Staff, Parents, Drivers, Vendors, Alumni.

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, users } from "./core";

export const personTypeEnum = pgEnum("person_type", [
  "STUDENT",
  "STAFF",
  "PARENT",
  "DRIVER",
  "VENDOR",
  "ALUMNI",
  "VISITOR",
]);

// ─── persons ──────────────────────────────────────────────────────────────────

export const persons = pgTable(
  "persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable to support platform superadmins who have no specific schoolId
    schoolId: uuid("school_id")
      .references(() => schools.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "set null" }),
    primaryType: personTypeEnum("primary_type").notNull(),

    // Personal — PII encrypted at application layer (AES-256-CBC)
    firstNameEncrypted: text("first_name_encrypted").notNull(),
    middleNameEncrypted: text("middle_name_encrypted"),
    lastNameEncrypted: text("last_name_encrypted").notNull(),

    // Non-PII HMAC search hashes for fast lookup
    firstNameSearchHash: text("first_name_search_hash"),
    lastNameSearchHash: text("last_name_search_hash"),

    gender: text("gender").notNull(),
    dateOfBirth: timestamp("date_of_birth", { withTimezone: true }),

    // Contact Information (Encrypted)
    primaryEmailEncrypted: text("primary_email_encrypted"),
    primaryMobileEncrypted: text("primary_mobile_encrypted"),

    // DPDP Mandated Masked Identity (Last 4 Digits Only)
    aadhaarLast4: text("aadhaar_last4"),

    // S3 Object Storage Key for Profile Photo
    photoS3Key: text("photo_s3_key"),

    // Metadata
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolIdx: index("persons_school_idx").on(t.schoolId),
    userIdIdx: index("persons_user_idx").on(t.userId),
    schoolUserIdx: index("persons_school_user_idx").on(t.schoolId, t.userId),
    searchHashIdx: index("persons_search_hash_idx").on(
      t.firstNameSearchHash,
      t.lastNameSearchHash,
    ),
    typeIdx: index("persons_type_idx").on(t.schoolId, t.primaryType),
  }),
);

export const personsRelations = relations(persons, ({ one }) => ({
  school: one(schools, {
    fields: [persons.schoolId],
    references: [schools.id],
  }),
  user: one(users, {
    fields: [persons.userId],
    references: [users.id],
  }),
}));
