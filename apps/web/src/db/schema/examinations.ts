// ─── Examinations Schema ──────────────────────────────────────────────────────
import {
  pgTable, uuid, text, boolean, timestamp, integer, numeric, pgEnum, index, unique, jsonb,
} from "drizzle-orm/pg-core";
import { schools, academicYears, users } from "./core";

export const examTypeEnum = pgEnum("exam_type_enum", [
  "UNIT_TEST", "HALF_YEARLY", "ANNUAL", "PRACTICAL",
  "INTERNAL_ASSESSMENT", "PRE_BOARD", "ACTIVITY",
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
  subjectId: uuid("subject_id").notNull(),
  marksObtained: numeric("marks_obtained", { precision: 7, scale: 2 }),
  maxMarks: numeric("max_marks", { precision: 7, scale: 2 }).notNull(),
  isAbsent: boolean("is_absent").notNull().default(false),
  grade: text("grade"), // Computed: A1, B2, etc.
  remarks: text("remarks"),
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
