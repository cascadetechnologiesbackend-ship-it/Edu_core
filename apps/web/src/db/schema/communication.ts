// ─── Communication Schema ─────────────────────────────────────────────────────
import {
  pgTable, uuid, text, boolean, timestamp, pgEnum, index, jsonb,
} from "drizzle-orm/pg-core";
import { schools, users } from "./core";

export const noticeAudienceEnum = pgEnum("notice_audience_type", [
  "ALL", "PARENTS", "TEACHERS", "STUDENTS", "STAFF", "CLASS", "SECTION",
]);

export const notices = pgTable("notices", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  content: text("content").notNull(), // DOMPurify sanitised
  audienceType: noticeAudienceEnum("audience_type").notNull(),
  audienceFilter: jsonb("audience_filter"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isPublished: boolean("is_published").notNull().default(false),
  isPinned: boolean("is_pinned").notNull().default(false),
  attachmentS3Key: text("attachment_s3_key"),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  schoolIdx: index("notices_school_idx").on(t.schoolId),
  publishedIdx: index("notices_published_idx").on(t.publishedAt),
}));

export const smsLogs = pgTable("sms_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  // Mobile is NOT stored — only a redacted reference
  recipientUserId: uuid("recipient_user_id"),
  templateId: text("template_id"),
  messageType: text("message_type").notNull(), // ATTENDANCE, FEE_REMINDER, NOTICE, OTP
  status: text("status").notNull().default("QUEUED"),
  gatewayMessageId: text("gateway_message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  schoolIdx: index("sms_logs_school_idx").on(t.schoolId),
}));

export const emailLogs = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  recipientUserId: uuid("recipient_user_id"),
  subject: text("subject").notNull(),
  templateName: text("template_name"),
  status: text("status").notNull().default("QUEUED"),
  messageId: text("message_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushNotificationLogs = pgTable("push_notification_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  recipientUserId: uuid("recipient_user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  fcmMessageId: text("fcm_message_id"),
  status: text("status").notNull().default("QUEUED"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  eventType: text("event_type").notNull(), // HOLIDAY, EXAM, PTM, SPORTS, CULTURAL
  isPublic: boolean("is_public").notNull().default(true),
  createdById: uuid("created_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  schoolDateIdx: index("events_school_date_idx").on(t.schoolId, t.startDate),
}));

// Parent-Teacher messages — moderated, DPDP audit trail required
export const parentTeacherMessages = pgTable("parent_teacher_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  senderUserId: uuid("sender_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  recipientUserId: uuid("recipient_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  studentId: uuid("student_id").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(), // DOMPurify sanitised
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  isModerated: boolean("is_moderated").notNull().default(false),
  moderatedById: uuid("moderated_by_id").references(() => users.id, { onDelete: "restrict" }),
  parentMessageId: uuid("parent_message_id"), // Thread reply
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  senderIdx: index("parent_teacher_messages_sender_idx").on(t.senderUserId),
  recipientIdx: index("parent_teacher_messages_recipient_idx").on(t.recipientUserId),
  schoolIdx: index("parent_teacher_messages_school_idx").on(t.schoolId),
}));
