import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
  index,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { schools, users } from "./core";
import { students } from "./students";
import { classes } from "./academics";

export const noticeAudienceEnum = pgEnum("notice_audience_type", [
  "ALL",
  "PARENTS",
  "TEACHERS",
  "STUDENTS",
  "STAFF",
  "CLASS",
  "SECTION",
]);

export const notices = pgTable(
  "notices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    content: text("content").notNull(), // DOMPurify sanitised
    audienceType: noticeAudienceEnum("audience_type").notNull(),
    audienceFilter: jsonb("audience_filter"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isPublished: boolean("is_published").notNull().default(false),
    isPinned: boolean("is_pinned").notNull().default(false),
    attachmentS3Key: text("attachment_s3_key"),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolIdx: index("notices_school_idx").on(t.schoolId),
    publishedIdx: index("notices_published_idx").on(t.publishedAt),
  }),
);

export const smsLogs = pgTable(
  "sms_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    // Mobile is NOT stored — only a redacted reference
    recipientUserId: uuid("recipient_user_id"),
    templateId: text("template_id"),
    messageType: text("message_type").notNull(), // ATTENDANCE, FEE_REMINDER, NOTICE, OTP
    status: text("status").notNull().default("QUEUED"),
    gatewayMessageId: text("gateway_message_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolIdx: index("sms_logs_school_idx").on(t.schoolId),
  }),
);

export const emailLogs = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "restrict" }),
  recipientUserId: uuid("recipient_user_id"),
  subject: text("subject").notNull(),
  templateName: text("template_name"),
  status: text("status").notNull().default("QUEUED"),
  messageId: text("message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const pushNotificationLogs = pgTable("push_notification_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "restrict" }),
  recipientUserId: uuid("recipient_user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  fcmMessageId: text("fcm_message_id"),
  status: text("status").notNull().default("QUEUED"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    eventType: text("event_type").notNull(), // HOLIDAY, EXAM, PTM, SPORTS, CULTURAL
    isPublic: boolean("is_public").notNull().default(true),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolDateIdx: index("events_school_date_idx").on(t.schoolId, t.startDate),
  }),
);

// Parent-Teacher messages — moderated, DPDP audit trail required
export const parentTeacherMessages = pgTable(
  "parent_teacher_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    subject: text("subject").notNull(),
    content: text("content").notNull(), // DOMPurify sanitised
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    isModerated: boolean("is_moderated").notNull().default(false),
    moderatedById: uuid("moderated_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    parentMessageId: uuid("parent_message_id"), // Thread reply
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    senderIdx: index("parent_teacher_messages_sender_idx").on(t.senderUserId),
    recipientIdx: index("parent_teacher_messages_recipient_idx").on(
      t.recipientUserId,
    ),
    schoolIdx: index("parent_teacher_messages_school_idx").on(t.schoolId),
  }),
);

// User Web Push Subscriptions (PWA Push Notifications - Spec 3.2 & OPEN-9)
// Note: schoolId is nullable so SUPER_ADMIN subscriptions (who have no schoolId) are supported
export const userPushSubscriptions = pgTable(
  "user_push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: uuid("school_id")
      .references(() => schools.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("user_push_subscriptions_user_idx").on(t.userId),
    schoolIdx: index("user_push_subscriptions_school_idx").on(t.schoolId),
  }),
);

// Parent Feed Cards (Active UI events cache per Spec v1.0)
export const parentFeedCards = pgTable(
  "parent_feed_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    cardType: text("card_type").notNull(),
    tier: text("tier").notNull(),
    priority: integer("priority").notNull().default(0),
    title: jsonb("title").notNull(),
    summary: jsonb("summary").notNull(),
    payload: jsonb("payload").notNull().default({}),
    activatedAt: timestamp("activated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    studentIdx: index("parent_feed_cards_student_idx").on(t.studentId),
    schoolIdx: index("parent_feed_cards_school_idx").on(t.schoolId),
    studentTypeIdx: index("parent_feed_cards_student_type_idx").on(
      t.studentId,
      t.cardType
    ),
    expiresIdx: index("parent_feed_cards_expires_idx").on(t.expiresAt),
  })
);

// Parent Notification Preferences (Tier opt-outs & quiet hours override)
export const parentNotificationPreferences = pgTable(
  "parent_notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    parentUserId: uuid("parent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tierOptOuts: jsonb("tier_opt_outs").notNull().default([]),
    quietHoursStart: text("quiet_hours_start").notNull().default("21:30"),
    quietHoursEnd: text("quiet_hours_end").notNull().default("07:00"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    parentUserIdx: index("parent_notif_prefs_user_idx").on(t.parentUserId),
    schoolIdx: index("parent_notif_prefs_school_idx").on(t.schoolId),
  })
);

// ─── PTM Workflow Tables (Workflow OP4 & AC-P17) ──────────────────────────────
export const ptmSlotStatusEnum = pgEnum("ptm_slot_status", [
  "FREE",
  "BOOKED",
  "BLOCKED",
]);

export const ptmBookingStatusEnum = pgEnum("ptm_booking_status", [
  "BOOKED",
  "HELD",
  "CANCELLED",
]);

export const ptmEvents = pgTable(
  "ptm_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    venue: text("venue"), // Real venue field resolving RC-C2
    bookingOpensAt: timestamp("booking_opens_at", { withTimezone: true }).notNull(),
    bookingClosesAt: timestamp("booking_closes_at", { withTimezone: true }).notNull(),
    slotMinutes: integer("slot_minutes").notNull().default(10),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    eventTeacherIdx: index("ptm_events_event_teacher_idx").on(
      t.eventId,
      t.teacherUserId
    ),
    schoolOpensIdx: index("ptm_events_school_opens_idx").on(
      t.schoolId,
      t.bookingOpensAt
    ),
  })
);

export const ptmSlots = pgTable(
  "ptm_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    ptmEventId: uuid("ptm_event_id")
      .notNull()
      .references(() => ptmEvents.id, { onDelete: "cascade" }),
    teacherUserId: uuid("teacher_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    status: ptmSlotStatusEnum("status").notNull().default("FREE"),
    version: integer("version").notNull().default(1), // Optimistic lock counter (AC-P17)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    eventStartIdx: index("ptm_slots_event_start_idx").on(
      t.ptmEventId,
      t.startAt
    ),
    teacherStartIdx: index("ptm_slots_teacher_start_idx").on(
      t.teacherUserId,
      t.startAt
    ),
  })
);

export const ptmBookings = pgTable(
  "ptm_bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    ptmEventId: uuid("ptm_event_id")
      .notNull()
      .references(() => ptmEvents.id, { onDelete: "cascade" }),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => ptmSlots.id, { onDelete: "cascade" }),
    parentUserId: uuid("parent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    status: ptmBookingStatusEnum("status").notNull().default("BOOKED"),
    bookedAt: timestamp("booked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    teacherNote: text("teacher_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    parentEventIdx: index("ptm_bookings_parent_event_idx").on(
      t.parentUserId,
      t.ptmEventId
    ),
    slotIdx: index("ptm_bookings_slot_idx").on(t.slotId),
    studentEventIdx: index("ptm_bookings_student_event_idx").on(
      t.studentId,
      t.ptmEventId
    ),
  })
);

