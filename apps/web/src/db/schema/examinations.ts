// ─── Examinations Schema ──────────────────────────────────────────────────────
import {
  pgTable, uuid, text, boolean, timestamp, integer, numeric, pgEnum, index, unique, jsonb, time, date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, academicYears, users } from "./core";
import { classes, subjects } from "./academics";

export const examTypeEnum = pgEnum("exam_type_enum", [
  "UNIT_TEST", "HALF_YEARLY", "ANNUAL", "PRACTICAL",
  "INTERNAL_ASSESSMENT", "PRE_BOARD", "ACTIVITY",
]);

export const markEntryStatusEnum = pgEnum("mark_entry_status", [
  "DRAFT", "SUBMITTED", "LOCKED",
]);

export const classGroupEnum = pgEnum("class_group", [
  "NURSERY_UKG", "CLASS_1_5", "CLASS_6_8", "CLASS_9_10",
]);

export const reportCardJobStatusEnum = pgEnum("report_card_job_status", [
  "QUEUED", "PROCESSING", "DONE", "FAILED",
]);

export const examTypes = pgTable("exam_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  examType: examTypeEnum("exam_type").notNull(),
  weightagePercent: numeric("weightage_percent", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const exams = pgTable("exams", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  examTypeId: uuid("exam_type_id").notNull().references(() => examTypes.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  isLocked: boolean("is_locked").notNull().default(false), // Principal lock
  lockedById: uuid("locked_by_id").references(() => users.id, { onDelete: "restrict" }),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  schoolYearIdx: index("exams_school_year_idx").on(t.schoolId, t.academicYearId),
}));

export const markEntries = pgTable("mark_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  examId: uuid("exam_id").notNull().references(() => exams.id, { onDelete: "restrict" }),
  studentId: uuid("student_id").notNull(),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "restrict" }),
  marksObtained: numeric("marks_obtained", { precision: 7, scale: 2 }),
  maxMarks: numeric("max_marks", { precision: 7, scale: 2 }).notNull(),
  isAbsent: boolean("is_absent").notNull().default(false),
  isMedicalExempt: boolean("is_medical_exempt").notNull().default(false),
  practicalMarks: numeric("practical_marks", { precision: 7, scale: 2 }),
  practicalMaxMarks: numeric("practical_max_marks", { precision: 7, scale: 2 }),
  isPracticalAbsent: boolean("is_practical_absent").notNull().default(false),
  grade: text("grade"), // Computed: A1, B2, etc.
  gradePoint: numeric("grade_point", { precision: 4, scale: 2 }),
  remarks: text("remarks"),
  status: markEntryStatusEnum("status").notNull().default("DRAFT"),
  enteredById: uuid("entered_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  examStudentSubjectUnique: unique("mark_entries_unique").on(t.examId, t.studentId, t.subjectId),
  examIdx: index("mark_entries_exam_idx").on(t.examId),
  studentIdx: index("mark_entries_student_idx").on(t.studentId),
}));

export const reportCards = pgTable("report_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  studentId: uuid("student_id").notNull(),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  examId: uuid("exam_id").notNull().references(() => exams.id, { onDelete: "restrict" }),
  gradeData: jsonb("grade_data").notNull(), // Computed results
  overallGrade: text("overall_grade"),
  rank: integer("rank"),
  attendancePercent: numeric("attendance_percent", { precision: 5, scale: 2 }),
  teacherRemarks: text("teacher_remarks"),
  principalRemarks: text("principal_remarks"),
  pdfS3Key: text("pdf_s3_key"), // Generated PDF
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  generatedById: uuid("generated_by_id").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  studentExamUnique: unique("report_cards_student_exam_unique").on(t.studentId, t.examId),
  schoolYearIdx: index("report_cards_school_year_idx").on(t.schoolId, t.academicYearId),
}));

export const certificates = pgTable("certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  studentId: uuid("student_id").notNull(),
  certificateType: text("certificate_type").notNull(), // "TC", "CHARACTER", "MIGRATION", "TOPPER"
  certificateNumber: text("certificate_number").notNull(),
  issuedDate: timestamp("issued_date", { withTimezone: true }).notNull(),
  issuedById: uuid("issued_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  pdfS3Key: text("pdf_s3_key"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  certNumberUnique: unique("certificates_number_unique").on(t.schoolId, t.certificateNumber),
  studentIdx: index("certificates_student_idx").on(t.studentId),
}));

// ─── exam_schedules ───────────────────────────────────────────────────────────

export const examSchedules = pgTable("exam_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  examId: uuid("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "restrict" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "restrict" }),
  examDate: date("exam_date").notNull(),
  startTime: time("start_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(180),
  roomNumber: text("room_number"),
  invigilatorId: uuid("invigilator_id").references(() => users.id, { onDelete: "restrict" }),
  maxMarks: numeric("max_marks", { precision: 7, scale: 2 }).notNull(),
  passingMarks: numeric("passing_marks", { precision: 7, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  examSubjectClassUnique: unique("exam_schedules_unique").on(t.examId, t.subjectId, t.classId),
  examIdx: index("exam_schedules_exam_idx").on(t.examId),
  classIdx: index("exam_schedules_class_idx").on(t.classId),
}));

// ─── grade_rules ──────────────────────────────────────────────────────────────
// Configurable grading rules per school per class group

export const gradeRules = pgTable("grade_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  classGroup: classGroupEnum("class_group").notNull(),
  minPercent: numeric("min_percent", { precision: 5, scale: 2 }).notNull(),
  maxPercent: numeric("max_percent", { precision: 5, scale: 2 }).notNull(),
  grade: text("grade").notNull(),           // "A1", "A2", "B1", "B2", "C", "D", "E"
  gradePoint: numeric("grade_point", { precision: 4, scale: 2 }).notNull(), // 10.0, 9.0 ...
  description: text("description"),          // "Outstanding", "Excellent", etc.
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  schoolGroupIdx: index("grade_rules_school_group_idx").on(t.schoolId, t.classGroup),
}));

// ─── report_card_jobs ─────────────────────────────────────────────────────────
// Tracks BullMQ bulk PDF generation jobs

export const reportCardJobs = pgTable("report_card_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  examId: uuid("exam_id").notNull().references(() => exams.id, { onDelete: "restrict" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "restrict" }),
  totalStudents: integer("total_students").notNull().default(0),
  processedCount: integer("processed_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  status: reportCardJobStatusEnum("status").notNull().default("QUEUED"),
  triggeredById: uuid("triggered_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  errorLog: jsonb("error_log"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  examClassIdx: index("report_card_jobs_exam_class_idx").on(t.examId, t.classId),
}));

// ─── medical_exemptions ───────────────────────────────────────────────────────

export const medicalExemptions = pgTable("medical_exemptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  studentId: uuid("student_id").notNull(),
  examId: uuid("exam_id").notNull().references(() => exams.id, { onDelete: "restrict" }),
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "restrict" }), // null = all subjects
  reason: text("reason").notNull(),
  approvedById: uuid("approved_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
  documentS3Key: text("document_s3_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  studentExamIdx: index("medical_exemptions_student_exam_idx").on(t.studentId, t.examId),
}));

// ─── Relations ────────────────────────────────────────────────────────────────

export const examTypesRelations = relations(examTypes, ({ one, many }) => ({
  school: one(schools, { fields: [examTypes.schoolId], references: [schools.id] }),
  exams: many(exams),
}));

export const examsRelations = relations(exams, ({ one, many }) => ({
  school: one(schools, { fields: [exams.schoolId], references: [schools.id] }),
  academicYear: one(academicYears, { fields: [exams.academicYearId], references: [academicYears.id] }),
  examType: one(examTypes, { fields: [exams.examTypeId], references: [examTypes.id] }),
  lockedBy: one(users, { fields: [exams.lockedById], references: [users.id] }),
  markEntries: many(markEntries),
  examSchedules: many(examSchedules),
  reportCards: many(reportCards),
  reportCardJobs: many(reportCardJobs),
  medicalExemptions: many(medicalExemptions),
}));

export const markEntriesRelations = relations(markEntries, ({ one }) => ({
  school: one(schools, { fields: [markEntries.schoolId], references: [schools.id] }),
  exam: one(exams, { fields: [markEntries.examId], references: [exams.id] }),
  subject: one(subjects, { fields: [markEntries.subjectId], references: [subjects.id] }),
  enteredBy: one(users, { fields: [markEntries.enteredById], references: [users.id] }),
}));

export const reportCardsRelations = relations(reportCards, ({ one }) => ({
  school: one(schools, { fields: [reportCards.schoolId], references: [schools.id] }),
  academicYear: one(academicYears, { fields: [reportCards.academicYearId], references: [academicYears.id] }),
  exam: one(exams, { fields: [reportCards.examId], references: [exams.id] }),
  generatedBy: one(users, { fields: [reportCards.generatedById], references: [users.id] }),
}));

export const examSchedulesRelations = relations(examSchedules, ({ one }) => ({
  school: one(schools, { fields: [examSchedules.schoolId], references: [schools.id] }),
  exam: one(exams, { fields: [examSchedules.examId], references: [exams.id] }),
  subject: one(subjects, { fields: [examSchedules.subjectId], references: [subjects.id] }),
  class: one(classes, { fields: [examSchedules.classId], references: [classes.id] }),
  invigilator: one(users, { fields: [examSchedules.invigilatorId], references: [users.id] }),
}));

export const gradeRulesRelations = relations(gradeRules, ({ one }) => ({
  school: one(schools, { fields: [gradeRules.schoolId], references: [schools.id] }),
}));

export const reportCardJobsRelations = relations(reportCardJobs, ({ one }) => ({
  school: one(schools, { fields: [reportCardJobs.schoolId], references: [schools.id] }),
  exam: one(exams, { fields: [reportCardJobs.examId], references: [exams.id] }),
  class: one(classes, { fields: [reportCardJobs.classId], references: [classes.id] }),
  triggeredBy: one(users, { fields: [reportCardJobs.triggeredById], references: [users.id] }),
}));

export const medicalExemptionsRelations = relations(medicalExemptions, ({ one }) => ({
  school: one(schools, { fields: [medicalExemptions.schoolId], references: [schools.id] }),
  exam: one(exams, { fields: [medicalExemptions.examId], references: [exams.id] }),
  subject: one(subjects, { fields: [medicalExemptions.subjectId], references: [subjects.id] }),
  approvedBy: one(users, { fields: [medicalExemptions.approvedById], references: [users.id] }),
}));
