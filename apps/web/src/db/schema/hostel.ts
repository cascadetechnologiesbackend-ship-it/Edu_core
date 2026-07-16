// ─── Hostel Schema (Feature-Flagged) ──────────────────────────────────────────
// Enabled via NEXT_PUBLIC_FEATURE_HOSTEL=true
// Visitor log includes DPDP audit trail for visitor PII

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
import { schools, users } from "./core";

export const roomTypeEnum = pgEnum("room_type", [
  "AC_SINGLE",
  "AC_DOUBLE",
  "AC_DORMITORY",
  "NON_AC_SINGLE",
  "NON_AC_DOUBLE",
  "NON_AC_DORMITORY",
]);

export const hostelRooms = pgTable(
  "hostel_rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    block: text("block").notNull(),
    floor: integer("floor").notNull(),
    roomNumber: text("room_number").notNull(),
    roomType: roomTypeEnum("room_type").notNull(),
    capacity: integer("capacity").notNull(),
    currentOccupancy: integer("current_occupancy").notNull().default(0),
    monthlyFee: text("monthly_fee"),
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
    schoolRoomUnique: unique("hostel_rooms_unique").on(
      t.schoolId,
      t.block,
      t.roomNumber,
    ),
    schoolIdx: index("hostel_rooms_school_idx").on(t.schoolId),
  }),
);

export const hostelAllocations = pgTable(
  "hostel_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => hostelRooms.id, { onDelete: "restrict" }),
    bedNumber: integer("bed_number").notNull(),
    checkInDate: timestamp("check_in_date", { withTimezone: true }).notNull(),
    checkOutDate: timestamp("check_out_date", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    roomBedUnique: unique("hostel_allocations_room_bed_unique").on(
      t.roomId,
      t.bedNumber,
    ),
    studentIdx: index("hostel_allocations_student_idx").on(t.studentId),
  }),
);

// Visitor log — DPDP audit trail required for visitor PII
export const visitorLogs = pgTable(
  "visitor_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    // Visitor PII — AES-256 encrypted, DPDP audit trail written on every read
    visitorNameEncrypted: text("visitor_name_encrypted").notNull(),
    visitorMobileEncrypted: text("visitor_mobile_encrypted"),
    visitorIdType: text("visitor_id_type"), // AADHAAR_LAST4, PAN, DRIVING_LICENSE
    visitorIdLast4: text("visitor_id_last4"), // Last 4 digits only
    purpose: text("purpose").notNull(),
    studentId: uuid("student_id"), // Who they are visiting
    staffId: uuid("staff_id"),
    checkInTime: timestamp("check_in_time", { withTimezone: true }).notNull(),
    checkOutTime: timestamp("check_out_time", { withTimezone: true }),
    photoS3Key: text("photo_s3_key"),
    loggedByUserId: uuid("logged_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Retention: visitor logs are purged after 90 days (short retention for non-students)
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolDateIdx: index("visitor_logs_school_date_idx").on(
      t.schoolId,
      t.checkInTime,
    ),
    studentIdx: index("visitor_logs_student_idx").on(t.studentId),
  }),
);
