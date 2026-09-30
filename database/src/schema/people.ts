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
import { schools } from "./core";

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
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
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
    searchHashIdx: index("persons_search_hash_idx").on(
      t.firstNameSearchHash,
      t.lastNameSearchHash,
    ),
    typeIdx: index("persons_type_idx").on(t.schoolId, t.primaryType),
  }),
);
