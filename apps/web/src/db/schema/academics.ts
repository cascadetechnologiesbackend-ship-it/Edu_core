// ─── Academics Schema ─────────────────────────────────────────────────────────
// Tables: classes, sections, subjects, class_subjects, timetable_periods,
//         lesson_plans, assignments, assignment_submissions

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
  time,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, academicYears, users } from "./core";
import { gradeLevelEnum } from "./students";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const subjectTypeEnum = pgEnum("subject_type", [
  "THEORY",
  "PRACTICAL",
  "CO_SCHOLASTIC",
  "LANGUAGE",
  "ACTIVITY",
]);

export const periodTypeEnum = pgEnum("period_type", [
  "REGULAR",
  "ASSEMBLY",
  "BREAK",
  "LUNCH",
  "LAB",
  "PT",
  "LIBRARY",
  "FREE",
]);

export const dayOfWeekEnum = pgEnum("day_of_week", [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
]);

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "DRAFT",
  "PUBLISHED",
  "CLOSED",
  "GRADED",
]);

// ─── classes ──────────────────────────────────────────────────────────────────

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    gradeLevel: gradeLevelEnum("grade_level").notNull(),
    displayName: text("display_name").notNull(), // "Class 6", "Nursery"
    sortOrder: integer("sort_order").notNull(),
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
    schoolYearGradeUnique: unique("classes_school_year_grade_unique").on(
      t.schoolId,
      t.academicYearId,
      t.gradeLevel,
    ),
    schoolYearIdx: index("classes_school_year_idx").on(
      t.schoolId,
      t.academicYearId,
    ),
  }),
);

// ─── sections ─────────────────────────────────────────────────────────────────

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: text("name").notNull(), // "A", "B", "C"
    capacity: integer("capacity").notNull().default(40),
    classTeacherId: uuid("class_teacher_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    roomNumber: text("room_number"),
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
    classSectionUnique: unique("sections_class_section_unique").on(
      t.classId,
      t.name,
    ),
    classIdx: index("sections_class_idx").on(t.classId),
    schoolIdx: index("sections_school_idx").on(t.schoolId),
  }),
);

// ─── subjects ─────────────────────────────────────────────────────────────────

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    code: text("code").notNull(), // "ENG", "MATH", "SCI"
    name: text("name").notNull(),
    nameHindi: text("name_hindi"),
    subjectType: subjectTypeEnum("subject_type").notNull(),
    maxMarks: integer("max_marks").notNull().default(100),
    passingMarks: integer("passing_marks").notNull().default(33),
    boardMapping: text("board_mapping"), // NCERT chapter reference
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
    codeUnique: unique("subjects_school_code_unique").on(t.schoolId, t.code),
    schoolIdx: index("subjects_school_idx").on(t.schoolId),
  }),
);

// ─── class_subjects ───────────────────────────────────────────────────────────

export const classSubjects = pgTable(
  "class_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    assignedTeacherId: uuid("assigned_teacher_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    periodsPerWeek: integer("periods_per_week").notNull().default(5),
    isElective: boolean("is_elective").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    classSubjectUnique: unique("class_subjects_unique").on(
      t.classId,
      t.subjectId,
    ),
    classIdx: index("class_subjects_class_idx").on(t.classId),
  }),
);

// ─── timetable_periods ────────────────────────────────────────────────────────

export const timetablePeriods = pgTable(
  "timetable_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
    periodNumber: integer("period_number").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    periodType: periodTypeEnum("period_type").notNull().default("REGULAR"),
    subjectId: uuid("subject_id").references(() => subjects.id, {
      onDelete: "restrict",
    }),
    teacherId: uuid("teacher_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    roomNumber: text("room_number"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    sectionDayPeriodUnique: unique("timetable_periods_unique").on(
      t.sectionId,
      t.dayOfWeek,
      t.periodNumber,
    ),
    teacherDayIdx: index("timetable_periods_teacher_day_idx").on(
      t.teacherId,
      t.dayOfWeek,
    ),
    schoolYearIdx: index("timetable_periods_school_year_idx").on(
      t.schoolId,
      t.academicYearId,
    ),
  }),
);

// ─── lesson_plans ─────────────────────────────────────────────────────────────

export const lessonPlans = pgTable(
  "lesson_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    classSubjectId: uuid("class_subject_id")
      .notNull()
      .references(() => classSubjects.id, { onDelete: "restrict" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    chapterName: text("chapter_name").notNull(),
    ncertReference: text("ncert_reference"),
    objectives: text("objectives"),
    plannedDate: timestamp("planned_date", { withTimezone: true }),
    completedDate: timestamp("completed_date", { withTimezone: true }),
    status: text("status").notNull().default("PLANNED"), // PLANNED, IN_PROGRESS, COMPLETED
    teachingMethods: text("teaching_methods"),
    resources: text("resources"),
    homework: text("homework"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    classSubjectIdx: index("lesson_plans_class_subject_idx").on(
      t.classSubjectId,
    ),
    schoolIdx: index("lesson_plans_school_idx").on(t.schoolId),
  }),
);

// ─── assignments ──────────────────────────────────────────────────────────────

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    classSubjectId: uuid("class_subject_id")
      .notNull()
      .references(() => classSubjects.id, { onDelete: "restrict" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "restrict" }),
    createdByTeacherId: uuid("created_by_teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    maxMarks: integer("max_marks"),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    attachmentS3Key: text("attachment_s3_key"),
    status: assignmentStatusEnum("status").notNull().default("DRAFT"),
    plagiarismCheckEnabled: boolean("plagiarism_check_enabled")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    sectionIdx: index("assignments_section_idx").on(t.sectionId),
    schoolIdx: index("assignments_school_idx").on(t.schoolId),
    dueDateIdx: index("assignments_due_date_idx").on(t.dueDate),
  }),
);

// ─── assignment_submissions ───────────────────────────────────────────────────

export const assignmentSubmissions = pgTable(
  "assignment_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isLate: boolean("is_late").notNull().default(false),
    attachmentS3Key: text("attachment_s3_key"),
    remarks: text("remarks"),
    marksAwarded: integer("marks_awarded"),
    gradedByTeacherId: uuid("graded_by_teacher_id"),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    plagiarismFlagged: boolean("plagiarism_flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    assignmentStudentUnique: unique("assignment_submissions_unique").on(
      t.assignmentId,
      t.studentId,
    ),
    assignmentIdx: index("assignment_submissions_assignment_idx").on(
      t.assignmentId,
    ),
    schoolIdx: index("assignment_submissions_school_idx").on(t.schoolId),
  }),
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const classesRelations = relations(classes, ({ one, many }) => ({
  school: one(schools, {
    fields: [classes.schoolId],
    references: [schools.id],
  }),
  academicYear: one(academicYears, {
    fields: [classes.academicYearId],
    references: [academicYears.id],
  }),
  sections: many(sections),
  classSubjects: many(classSubjects),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  class: one(classes, { fields: [sections.classId], references: [classes.id] }),
  school: one(schools, {
    fields: [sections.schoolId],
    references: [schools.id],
  }),
  timetablePeriods: many(timetablePeriods),
  assignments: many(assignments),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  school: one(schools, {
    fields: [subjects.schoolId],
    references: [schools.id],
  }),
  classSubjects: many(classSubjects),
}));

export const classSubjectsRelations = relations(classSubjects, ({ one }) => ({
  class: one(classes, {
    fields: [classSubjects.classId],
    references: [classes.id],
  }),
  subject: one(subjects, {
    fields: [classSubjects.subjectId],
    references: [subjects.id],
  }),
  teacher: one(users, {
    fields: [classSubjects.assignedTeacherId],
    references: [users.id],
  }),
}));

export const timetablePeriodsRelations = relations(
  timetablePeriods,
  ({ one }) => ({
    section: one(sections, {
      fields: [timetablePeriods.sectionId],
      references: [sections.id],
    }),
    subject: one(subjects, {
      fields: [timetablePeriods.subjectId],
      references: [subjects.id],
    }),
    teacher: one(users, {
      fields: [timetablePeriods.teacherId],
      references: [users.id],
    }),
  }),
);

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  classSubject: one(classSubjects, {
    fields: [assignments.classSubjectId],
    references: [classSubjects.id],
  }),
  section: one(sections, {
    fields: [assignments.sectionId],
    references: [sections.id],
  }),
  teacher: one(users, {
    fields: [assignments.createdByTeacherId],
    references: [users.id],
  }),
  submissions: many(assignmentSubmissions),
}));

export const assignmentSubmissionsRelations = relations(
  assignmentSubmissions,
  ({ one }) => ({
    assignment: one(assignments, {
      fields: [assignmentSubmissions.assignmentId],
      references: [assignments.id],
    }),
  }),
);

export const lessonPlansRelations = relations(lessonPlans, ({ one }) => ({
  classSubject: one(classSubjects, {
    fields: [lessonPlans.classSubjectId],
    references: [classSubjects.id],
  }),
  teacher: one(users, {
    fields: [lessonPlans.teacherId],
    references: [users.id],
  }),
}));
