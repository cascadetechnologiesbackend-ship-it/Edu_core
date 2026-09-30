// ─── Academics Schema ─────────────────────────────────────────────────────────
// Tables: classes, sections, subjects, class_subjects, timetable_periods,
//         lesson_plans, assignments, assignment_submissions,
//         academic_terms, academic_calendar_events, bell_schedule,
//         timetable_substitutions, section_subject_teachers,
//         syllabus_units, syllabus_chapters, syllabus_topics, assessments

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
  uniqueIndex,
  time,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { schools, academicYears, users } from "./core";
import { gradeLevelEnum, students } from "./students";

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

// NEW: Academic calendar event types (AMS-only, Rule #1)
export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "HOLIDAY",
  "EVENT",
  "EXAM",
  "PTM",
  "SPORTS",
  "CULTURAL",
  "WORKING_SATURDAY",
  "VACATION",
]);

// NEW: Substitution status (Rule #3)
export const substitutionStatusEnum = pgEnum("substitution_status", [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
]);

// NEW: Assessment types — minimal foundation only, not full exam module (Rule #5)
export const assessmentTypeEnum = pgEnum("assessment_type", [
  "UNIT_TEST",
  "MIDTERM",
  "FINAL",
  "QUIZ",
  "PRACTICAL",
  "PROJECT",
  "FA",
  "SA",
]);

// NEW: Assessment lifecycle status (Rule #5)
export const assessmentStatusEnum = pgEnum("assessment_status", [
  "DRAFT",
  "SCHEDULED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
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
// assignedTeacherId = class-level default teacher.
// Section-specific overrides live in section_subject_teachers (Rule #10).

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

// ─── academic_terms ───────────────────────────────────────────────────────────
// Term 1, Term 2, Quarter 1, etc. Scoped to academic year.

export const academicTerms = pgTable(
  "academic_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    name: text("name").notNull(), // "Term 1", "Quarter 2", "Half-Yearly"
    startDate: text("start_date").notNull(), // "YYYY-MM-DD"
    endDate: text("end_date").notNull(),
    sortOrder: integer("sort_order").notNull().default(1),
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
    schoolYearIdx: index("academic_terms_school_year_idx").on(
      t.schoolId,
      t.academicYearId,
    ),
    termNameUnique: unique("academic_terms_name_unique").on(
      t.schoolId,
      t.academicYearId,
      t.name,
    ),
  }),
);

// ─── academic_calendar_events ─────────────────────────────────────────────────
// AMS-only calendar. No global calendar architecture. (Rule #1)

export const academicCalendarEvents = pgTable(
  "academic_calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    termId: uuid("term_id").references(() => academicTerms.id, {
      onDelete: "restrict",
    }), // nullable — event may span terms
    title: text("title").notNull(),
    eventType: calendarEventTypeEnum("event_type").notNull(),
    startDate: text("start_date").notNull(), // "YYYY-MM-DD"
    endDate: text("end_date").notNull(),
    description: text("description"),
    isWorkingDay: boolean("is_working_day").notNull().default(false),
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
    schoolYearIdx: index("calendar_events_school_year_idx").on(
      t.schoolId,
      t.academicYearId,
    ),
    startDateIdx: index("calendar_events_start_date_idx").on(t.startDate),
  }),
);

// ─── bell_schedule ────────────────────────────────────────────────────────────
// Configurable school bell periods. Replaces hardcoded 8-period / fixed-time
// assumption in TimetableTab.tsx. (Rule #2)

export const bellSchedule = pgTable(
  "bell_schedule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    periodNumber: integer("period_number").notNull(), // 1, 2, 3…
    name: text("name").notNull(), // "Period 1", "Lunch Break", "Assembly"
    startTime: time("start_time").notNull(), // "08:00"
    endTime: time("end_time").notNull(), // "08:45"
    periodType: periodTypeEnum("period_type").notNull().default("REGULAR"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => ({
    schoolPeriodUnique: unique("bell_schedule_school_period_unique").on(
      t.schoolId,
      t.periodNumber,
    ),
    schoolIdx: index("bell_schedule_school_idx").on(t.schoolId),
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

// ─── timetable_substitutions ─────────────────────────────────────────────────
// Daily proxy/substitute teacher assignments. (Rule #3)

export const timetableSubstitutions = pgTable(
  "timetable_substitutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    date: text("date").notNull(), // "YYYY-MM-DD" — specific day
    timetablePeriodId: uuid("timetable_period_id")
      .notNull()
      .references(() => timetablePeriods.id, { onDelete: "restrict" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "restrict" }),
    originalTeacherId: uuid("original_teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    substituteTeacherId: uuid("substitute_teacher_id").references(
      () => users.id,
      { onDelete: "restrict" },
    ), // nullable until assigned
    subjectId: uuid("subject_id").references(() => subjects.id, {
      onDelete: "restrict",
    }),
    reason: text("reason"),
    status: substitutionStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    dateSectionPeriodUnique: unique(
      "substitutions_date_section_period_unique",
    ).on(t.date, t.sectionId, t.timetablePeriodId),
    schoolDateIdx: index("substitutions_school_date_idx").on(
      t.schoolId,
      t.date,
    ),
    originalTeacherIdx: index("substitutions_original_teacher_idx").on(
      t.originalTeacherId,
    ),
  }),
);

// ─── section_subject_teachers ─────────────────────────────────────────────────
// Section-level teacher allocation with effective date history. (Rules #10, #14)
// class_subjects.assignedTeacherId = class-wide default (fallback).
// This table overrides per section and preserves history via effectiveFrom/effectiveTo.

export const sectionSubjectTeachers = pgTable(
  "section_subject_teachers",
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
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    effectiveFrom: text("effective_from").notNull(), // "YYYY-MM-DD"
    effectiveTo: text("effective_to"), // null = currently active
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    activeSectionSubjectTeacherUnique: uniqueIndex("sst_active_unique_idx")
      .on(t.classSubjectId, t.sectionId)
      .where(sql`"effective_to" IS NULL`),
    classSubjectIdx: index("sst_class_subject_idx").on(t.classSubjectId),
    sectionIdx: index("sst_section_idx").on(t.sectionId),
    teacherIdx: index("sst_teacher_idx").on(t.teacherId),
    schoolIdx: index("sst_school_idx").on(t.schoolId),
  }),
);

// ─── syllabus_units ───────────────────────────────────────────────────────────
// Top level of curriculum: Unit 1, Unit 2. (Rule #8)
// academicTermId nullable — supports Term 1 → Units, Term 2 → Units without
// duplicating syllabus architecture.

export const syllabusUnits = pgTable(
  "syllabus_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    classSubjectId: uuid("class_subject_id")
      .notNull()
      .references(() => classSubjects.id, { onDelete: "restrict" }),
    academicTermId: uuid("academic_term_id").references(
      () => academicTerms.id,
      { onDelete: "restrict" },
    ), // nullable
    name: text("name").notNull(), // "Unit 1: Number System"
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(1),
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
    classSubjectIdx: index("syllabus_units_class_subject_idx").on(
      t.classSubjectId,
    ),
    schoolIdx: index("syllabus_units_school_idx").on(t.schoolId),
  }),
);

// ─── syllabus_chapters ────────────────────────────────────────────────────────
// Second level: Chapter 1, Chapter 2 inside a unit. (Rule #8)

export const syllabusChapters = pgTable(
  "syllabus_chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => syllabusUnits.id, { onDelete: "restrict" }),
    name: text("name").notNull(), // "Chapter 1: Rational Numbers"
    ncertReference: text("ncert_reference"),
    sortOrder: integer("sort_order").notNull().default(1), // Rule #8
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
    unitIdx: index("syllabus_chapters_unit_idx").on(t.unitId),
    schoolIdx: index("syllabus_chapters_school_idx").on(t.schoolId),
  }),
);

// ─── syllabus_topics ──────────────────────────────────────────────────────────
// Leaf level: 1.1, 1.2 topics inside a chapter. (Rule #8)

export const syllabusTopics = pgTable(
  "syllabus_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => syllabusChapters.id, { onDelete: "restrict" }),
    name: text("name").notNull(), // "1.1 Properties of Rational Numbers"
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(1), // Rule #8
    estimatedPeriods: integer("estimated_periods").default(1),
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
    chapterIdx: index("syllabus_topics_chapter_idx").on(t.chapterId),
    schoolIdx: index("syllabus_topics_school_idx").on(t.schoolId),
  }),
);

// ─── lesson_plans ─────────────────────────────────────────────────────────────
// Scoped to: Academic Year + classSubjectId + Teacher. (Rule #6)
// syllabusTopicId links to curriculum tracker.
// sectionId is NOT added — lesson plans are class+subject scoped, not section-specific.

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
    // Curriculum linkage (Rule #6 fix)
    syllabusTopicId: uuid("syllabus_topic_id").references(
      () => syllabusTopics.id,
      { onDelete: "restrict" },
    ), // nullable — plan may be created before syllabus is set up
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
    topicIdx: index("lesson_plans_topic_idx").on(t.syllabusTopicId),
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

// ─── assessments ──────────────────────────────────────────────────────────────
// Minimal reusable foundation: Class → Subject → Exam/Assessment. (Rule #5)
// Do NOT build full examination logic here. The later exam module will extend this.

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    classSubjectId: uuid("class_subject_id")
      .notNull()
      .references(() => classSubjects.id, { onDelete: "restrict" }),
    sectionId: uuid("section_id").references(() => sections.id, {
      onDelete: "restrict",
    }), // nullable = class-wide exam
    termId: uuid("term_id").references(() => academicTerms.id, {
      onDelete: "restrict",
    }), // nullable
    title: text("title").notNull(), // "Unit Test 2 — Fractions"
    assessmentType: assessmentTypeEnum("assessment_type").notNull(),
    date: text("date"), // "YYYY-MM-DD"
    maxMarks: integer("max_marks").notNull().default(100),
    syllabusCoverage: text("syllabus_coverage"), // free-text note on topics covered
    status: assessmentStatusEnum("status").notNull().default("DRAFT"),
    createdByTeacherId: uuid("created_by_teacher_id")
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
    classSubjectIdx: index("assessments_class_subject_idx").on(
      t.classSubjectId,
    ),
    schoolIdx: index("assessments_school_idx").on(t.schoolId),
    dateIdx: index("assessments_date_idx").on(t.date),
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
  classTeacher: one(users, {
    fields: [sections.classTeacherId],
    references: [users.id],
  }),
  timetablePeriods: many(timetablePeriods),
  assignments: many(assignments),
  sectionSubjectTeachers: many(sectionSubjectTeachers),
  timetableSubstitutions: many(timetableSubstitutions),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  school: one(schools, {
    fields: [subjects.schoolId],
    references: [schools.id],
  }),
  classSubjects: many(classSubjects),
}));

export const classSubjectsRelations = relations(
  classSubjects,
  ({ one, many }) => ({
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
    syllabusUnits: many(syllabusUnits),
    lessonPlans: many(lessonPlans),
    assignments: many(assignments),
    assessments: many(assessments),
    sectionSubjectTeachers: many(sectionSubjectTeachers),
  }),
);

export const academicTermsRelations = relations(
  academicTerms,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [academicTerms.schoolId],
      references: [schools.id],
    }),
    academicYear: one(academicYears, {
      fields: [academicTerms.academicYearId],
      references: [academicYears.id],
    }),
    calendarEvents: many(academicCalendarEvents),
    syllabusUnits: many(syllabusUnits),
    assessments: many(assessments),
  }),
);

export const academicCalendarEventsRelations = relations(
  academicCalendarEvents,
  ({ one }) => ({
    school: one(schools, {
      fields: [academicCalendarEvents.schoolId],
      references: [schools.id],
    }),
    academicYear: one(academicYears, {
      fields: [academicCalendarEvents.academicYearId],
      references: [academicYears.id],
    }),
    term: one(academicTerms, {
      fields: [academicCalendarEvents.termId],
      references: [academicTerms.id],
    }),
  }),
);

export const bellScheduleRelations = relations(bellSchedule, ({ one }) => ({
  school: one(schools, {
    fields: [bellSchedule.schoolId],
    references: [schools.id],
  }),
}));

export const timetablePeriodsRelations = relations(
  timetablePeriods,
  ({ one, many }) => ({
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
    substitutions: many(timetableSubstitutions),
  }),
);

export const timetableSubstitutionsRelations = relations(
  timetableSubstitutions,
  ({ one }) => ({
    school: one(schools, {
      fields: [timetableSubstitutions.schoolId],
      references: [schools.id],
    }),
    timetablePeriod: one(timetablePeriods, {
      fields: [timetableSubstitutions.timetablePeriodId],
      references: [timetablePeriods.id],
    }),
    section: one(sections, {
      fields: [timetableSubstitutions.sectionId],
      references: [sections.id],
    }),
    originalTeacher: one(users, {
      fields: [timetableSubstitutions.originalTeacherId],
      references: [users.id],
    }),
    substituteTeacher: one(users, {
      fields: [timetableSubstitutions.substituteTeacherId],
      references: [users.id],
    }),
    subject: one(subjects, {
      fields: [timetableSubstitutions.subjectId],
      references: [subjects.id],
    }),
  }),
);

export const sectionSubjectTeachersRelations = relations(
  sectionSubjectTeachers,
  ({ one }) => ({
    school: one(schools, {
      fields: [sectionSubjectTeachers.schoolId],
      references: [schools.id],
    }),
    classSubject: one(classSubjects, {
      fields: [sectionSubjectTeachers.classSubjectId],
      references: [classSubjects.id],
    }),
    section: one(sections, {
      fields: [sectionSubjectTeachers.sectionId],
      references: [sections.id],
    }),
    teacher: one(users, {
      fields: [sectionSubjectTeachers.teacherId],
      references: [users.id],
    }),
  }),
);

export const syllabusUnitsRelations = relations(
  syllabusUnits,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [syllabusUnits.schoolId],
      references: [schools.id],
    }),
    classSubject: one(classSubjects, {
      fields: [syllabusUnits.classSubjectId],
      references: [classSubjects.id],
    }),
    term: one(academicTerms, {
      fields: [syllabusUnits.academicTermId],
      references: [academicTerms.id],
    }),
    academicTerm: one(academicTerms, {
      fields: [syllabusUnits.academicTermId],
      references: [academicTerms.id],
    }),
    chapters: many(syllabusChapters),
  }),
);

export const syllabusChaptersRelations = relations(
  syllabusChapters,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [syllabusChapters.schoolId],
      references: [schools.id],
    }),
    unit: one(syllabusUnits, {
      fields: [syllabusChapters.unitId],
      references: [syllabusUnits.id],
    }),
    topics: many(syllabusTopics),
  }),
);

export const syllabusTopicsRelations = relations(
  syllabusTopics,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [syllabusTopics.schoolId],
      references: [schools.id],
    }),
    chapter: one(syllabusChapters, {
      fields: [syllabusTopics.chapterId],
      references: [syllabusChapters.id],
    }),
    lessonPlans: many(lessonPlans),
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
    student: one(students, {
      fields: [assignmentSubmissions.studentId],
      references: [students.id],
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
  syllabusTopic: one(syllabusTopics, {
    fields: [lessonPlans.syllabusTopicId],
    references: [syllabusTopics.id],
  }),
}));

export const assessmentsRelations = relations(assessments, ({ one }) => ({
  school: one(schools, {
    fields: [assessments.schoolId],
    references: [schools.id],
  }),
  classSubject: one(classSubjects, {
    fields: [assessments.classSubjectId],
    references: [classSubjects.id],
  }),
  section: one(sections, {
    fields: [assessments.sectionId],
    references: [sections.id],
  }),
  term: one(academicTerms, {
    fields: [assessments.termId],
    references: [academicTerms.id],
  }),
  createdByTeacher: one(users, {
    fields: [assessments.createdByTeacherId],
    references: [users.id],
  }),
}));
