import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { isNotNull } from "drizzle-orm";
import { schools, academicYears, users } from "./core";
import { sections } from "./academics";
import { examSchedules } from "./examinations";
import { students } from "./students";

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "LEAVE",
  "HOLIDAY",
]);

export const studentLeaveTypeEnum = pgEnum("student_leave_type", [
  "CASUAL",
  "SICK",
  "EMERGENCY",
  "OTHER",
]);

export const leaveRequestStatusEnum = pgEnum("student_leave_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED_BY_PARENT",
]);

export const studentAttendance = pgTable(
  "student_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    attendanceDate: timestamp("attendance_date", {
      withTimezone: true,
    }).notNull(),
    periodId: uuid("period_id"), // null = day-wise; set = period-wise
    status: attendanceStatusEnum("status").notNull(),
    source: text("source").notNull().default("ROUTINE"), // "ROUTINE", "EXAM"
    examScheduleId: uuid("exam_schedule_id").references(() => examSchedules.id, {
      onDelete: "set null",
    }),
    markedById: uuid("marked_by_id").notNull(),
    remarks: text("remarks"),
    smsNotificationSent: boolean("sms_notification_sent")
      .notNull()
      .default(false),
    smsNotificationSentAt: timestamp("sms_notification_sent_at", {
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
    studentDatePeriodUnique: unique("student_attendance_unique").on(
      t.studentId,
      t.attendanceDate,
      t.periodId,
    ),
    schoolDateIdx: index("student_attendance_school_date_idx").on(
      t.schoolId,
      t.attendanceDate,
    ),
    studentIdx: index("student_attendance_student_idx").on(t.studentId),
    examScheduleUniqueIdx: uniqueIndex(
      "student_attendance_exam_schedule_unique",
    )
      .on(t.studentId, t.examScheduleId)
      .where(isNotNull(t.examScheduleId)),
    examScheduleIdx: index("student_attendance_exam_schedule_idx").on(
      t.schoolId,
      t.examScheduleId,
    ),
  }),
);

export const staffAttendance = pgTable(
  "staff_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    staffId: uuid("staff_id").notNull(),
    attendanceDate: timestamp("attendance_date", {
      withTimezone: true,
    }).notNull(),
    clockIn: timestamp("clock_in", { withTimezone: true }),
    clockOut: timestamp("clock_out", { withTimezone: true }),
    status: attendanceStatusEnum("status").notNull(),
    biometricVerified: boolean("biometric_verified").notNull().default(false),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    staffDateUnique: unique("staff_attendance_unique").on(
      t.staffId,
      t.attendanceDate,
    ),
    schoolDateIdx: index("staff_attendance_school_date_idx").on(
      t.schoolId,
      t.attendanceDate,
    ),
  }),
);

export const attendanceNotifications = pgTable("attendance_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "restrict" }),
  studentAttendanceId: uuid("student_attendance_id")
    .notNull()
    .references(() => studentAttendance.id, { onDelete: "restrict" }),
  parentUserId: uuid("parent_user_id").notNull(),
  channel: text("channel").notNull(), // "SMS", "PUSH", "EMAIL"
  sentAt: timestamp("sent_at", { withTimezone: true }),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Student Leave Requests (Workflow OP3 per Parent PWA Spec v1.2)
export const studentLeaveRequests = pgTable(
  "student_leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    requestedByParentUserId: uuid("requested_by_parent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    leaveType: studentLeaveTypeEnum("leave_type").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    attachmentS3Key: text("attachment_s3_key"),
    status: leaveRequestStatusEnum("status").notNull().default("PENDING"),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decisionNote: text("decision_note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    studentStatusIdx: index("student_leave_requests_student_status_idx").on(
      t.studentId,
      t.status
    ),
    schoolStatusCreatedIdx: index(
      "student_leave_requests_school_status_created_idx"
    ).on(t.schoolId, t.status, t.createdAt),
  })
);

