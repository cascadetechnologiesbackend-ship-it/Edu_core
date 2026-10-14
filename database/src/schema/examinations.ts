// ─── Examinations Schema ──────────────────────────────────────────────────────
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  pgEnum,
  index,
  unique,
  uniqueIndex,
  jsonb,
  time,
  date,
  bigint,
} from "drizzle-orm/pg-core";
import { relations, sql, isNull, isNotNull } from "drizzle-orm";
import { schools, academicYears, users } from "./core";
import { classes, subjects } from "./academics";
import { students } from "./students";

export const examTypeEnum = pgEnum("exam_type_enum", [
  "UNIT_TEST",
  "HALF_YEARLY",
  "ANNUAL",
  "PRACTICAL",
  "INTERNAL_ASSESSMENT",
  "PRE_BOARD",
  "ACTIVITY",
]);

export const markEntryStatusEnum = pgEnum("mark_entry_status", [
  "DRAFT",
  "SUBMITTED",
  "LOCKED",
]);

export const classGroupEnum = pgEnum("class_group", [
  "NURSERY_UKG",
  "CLASS_1_5",
  "CLASS_6_8",
  "CLASS_9_10",
  "CLASS_11_12",
]);

export const reportCardJobStatusEnum = pgEnum("report_card_job_status", [
  "QUEUED",
  "PROCESSING",
  "DONE",
  "FAILED",
]);

export const feeLockModeEnum = pgEnum("fee_lock_mode", [
  "OFF",
  "SOFT",
  "HARD",
]);

export const marksLockStatusEnum = pgEnum("marks_lock_status", [
  "SUBMITTED",
  "LOCKED",
]);

export const examTypes = pgTable("exam_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  examType: examTypeEnum("exam_type").notNull(),
  weightagePercent: numeric("weightage_percent", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const exams = pgTable(
  "exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    examTypeId: uuid("exam_type_id")
      .notNull()
      .references(() => examTypes.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    isLocked: boolean("is_locked").notNull().default(false), // Principal/Admin lock
    lockedById: uuid("locked_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolYearIdx: index("exams_school_year_idx").on(
      t.schoolId,
      t.academicYearId,
    ),
  }),
);

// ─── exam_components ──────────────────────────────────────────────────────────
export const examComponents = pgTable(
  "exam_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    examTypeId: uuid("exam_type_id")
      .notNull()
      .references(() => examTypes.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    weightPercent: numeric("weight_percent", { precision: 5, scale: 2 }),
    showOnReportCard: boolean("show_on_report_card").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    examTypeUnique: unique("exam_components_exam_type_unique").on(
      t.examId,
      t.examTypeId,
    ),
    examIdx: index("exam_components_exam_idx").on(t.examId),
    schoolIdx: index("exam_components_school_idx").on(t.schoolId),
  }),
);

// ─── exam_class_scopes ────────────────────────────────────────────────────────
export const examClassScopes = pgTable(
  "exam_class_scopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    examClassUnique: unique("exam_class_scopes_unique").on(t.examId, t.classId),
    examIdx: index("exam_class_scopes_exam_idx").on(t.examId),
    schoolIdx: index("exam_class_scopes_school_idx").on(t.schoolId),
  }),
);

// ─── exam_mark_distributions ──────────────────────────────────────────────────
export const examMarkDistributions = pgTable(
  "exam_mark_distributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    componentId: uuid("component_id").references(() => examComponents.id, {
      onDelete: "restrict",
    }),
    maxMarks: numeric("max_marks", { precision: 7, scale: 2 }).notNull(),
    passingMarks: numeric("passing_marks", {
      precision: 7,
      scale: 2,
    }).notNull(),
    displayMaxMarks: numeric("display_max_marks", { precision: 7, scale: 2 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    distLegacyUniqueIdx: uniqueIndex("exam_mark_dist_legacy_unique_idx")
      .on(t.examId, t.classId, t.subjectId)
      .where(isNull(t.componentId)),
    distCompUniqueIdx: uniqueIndex("exam_mark_dist_comp_unique_idx")
      .on(t.examId, t.classId, t.subjectId, t.componentId)
      .where(isNotNull(t.componentId)),
    examClassIdx: index("exam_mark_dist_exam_class_idx").on(t.examId, t.classId),
    schoolIdx: index("exam_mark_dist_school_idx").on(t.schoolId),
  }),
);

export const markEntries = pgTable(
  "mark_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    componentId: uuid("component_id").references(() => examComponents.id, {
      onDelete: "restrict",
    }),
    marksObtained: numeric("marks_obtained", { precision: 7, scale: 2 }),
    maxMarks: numeric("max_marks", { precision: 7, scale: 2 }).notNull(),
    isAbsent: boolean("is_absent").notNull().default(false),
    isMedicalExempt: boolean("is_medical_exempt").notNull().default(false),
    practicalMarks: numeric("practical_marks", { precision: 7, scale: 2 }),
    practicalMaxMarks: numeric("practical_max_marks", {
      precision: 7,
      scale: 2,
    }),
    isPracticalAbsent: boolean("is_practical_absent").notNull().default(false),
    grade: text("grade"), // Computed: A1, B2, etc.
    gradePoint: numeric("grade_point", { precision: 4, scale: 2 }),
    remarks: text("remarks"),
    status: markEntryStatusEnum("status").notNull().default("DRAFT"),
    enteredById: uuid("entered_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    enteredAt: timestamp("entered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Amendment 1: Close NULL component_id uniqueness hole with two partial unique indexes
    legacyUniqueIdx: uniqueIndex("mark_entries_legacy_unique_idx")
      .on(t.examId, t.studentId, t.subjectId)
      .where(isNull(t.componentId)),
    componentUniqueIdx: uniqueIndex("mark_entries_component_unique_idx")
      .on(t.examId, t.studentId, t.subjectId, t.componentId)
      .where(isNotNull(t.componentId)),
    examIdx: index("mark_entries_exam_idx").on(t.examId),
    studentIdx: index("mark_entries_student_idx").on(t.studentId),
  }),
);

// ─── exam_marks_locks (2-step workflow state) ─────────────────────────────────
export const examMarksLocks = pgTable(
  "exam_marks_locks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    status: marksLockStatusEnum("status").notNull(),
    submittedById: uuid("submitted_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    lockedById: uuid("locked_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    unlockReason: text("unlock_reason"),
    unlockedById: uuid("unlocked_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    examClassSubjectUnique: unique("exam_marks_locks_unique").on(
      t.examId,
      t.classId,
      t.subjectId,
    ),
    examIdx: index("exam_marks_locks_exam_idx").on(t.examId),
    schoolIdx: index("exam_marks_locks_school_idx").on(t.schoolId),
  }),
);

// ─── exam_admit_card_settings ─────────────────────────────────────────────────
export const examAdmitCardSettings = pgTable(
  "exam_admit_card_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    isReleased: boolean("is_released").notNull().default(false),
    availableFrom: timestamp("available_from", { withTimezone: true }),
    availableUntil: timestamp("available_until", { withTimezone: true }),
    instructions: text("instructions"),
    examCentre: text("exam_centre"),
    reportingTime: text("reporting_time"),
    showPhoto: boolean("show_photo").notNull().default(true),
    showSignature: boolean("show_signature").notNull().default(true),
    signatories: jsonb("signatories").notNull().default([]),
    feeLockMode: feeLockModeEnum("fee_lock_mode").notNull().default("OFF"),
    feeLockThresholdAmount: numeric("fee_lock_threshold_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    examUnique: unique("exam_admit_card_settings_exam_unique").on(t.examId),
    schoolIdx: index("exam_admit_card_settings_school_idx").on(t.schoolId),
  }),
);

// ─── admit_card_templates ─────────────────────────────────────────────────────
export const admitCardTemplates = pgTable(
  "admit_card_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    layout: jsonb("layout").notNull().default({}),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolIdx: index("admit_card_templates_school_idx").on(t.schoolId),
  }),
);

// ─── exam_admit_card_holds ────────────────────────────────────────────────────
export const examAdmitCardHolds = pgTable(
  "exam_admit_card_holds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    placedById: uuid("placed_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    releasedById: uuid("released_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    examStudentUnique: unique("exam_admit_card_holds_unique").on(
      t.examId,
      t.studentId,
    ),
    schoolIdx: index("exam_admit_card_holds_school_idx").on(t.schoolId),
  }),
);

// ─── cocurricular_areas ───────────────────────────────────────────────────────
export const cocurricularAreas = pgTable(
  "cocurricular_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolNameUnique: unique("cocurricular_areas_school_name_unique").on(
      t.schoolId,
      t.name,
    ),
    schoolIdx: index("cocurricular_areas_school_idx").on(t.schoolId),
  }),
);

// ─── cocurricular_grades ──────────────────────────────────────────────────────
export const cocurricularGrades = pgTable(
  "cocurricular_grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    areaId: uuid("area_id")
      .notNull()
      .references(() => cocurricularAreas.id, { onDelete: "restrict" }),
    grade: text("grade").notNull(),
    remark: text("remark"),
    gradedById: uuid("graded_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    examStudentAreaUnique: unique("cocurricular_grades_unique").on(
      t.examId,
      t.studentId,
      t.areaId,
    ),
    examStudentIdx: index("cocurricular_grades_exam_student_idx").on(
      t.examId,
      t.studentId,
    ),
  }),
);

// ─── report_card_setups ───────────────────────────────────────────────────────
export const reportCardSetups = pgTable(
  "report_card_setups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    examWeightages: jsonb("exam_weightages").notNull().default([]), // Array<{ examId: string, weightPercent: number }>
    layout: jsonb("layout").notNull().default({}),
    isActive: boolean("is_active").notNull().default(true),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolYearIdx: index("report_card_setups_school_year_idx").on(
      t.schoolId,
      t.academicYearId,
    ),
  }),
);

// ─── result_settings ──────────────────────────────────────────────────────────
export const resultSettings = pgTable(
  "result_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    setupId: uuid("setup_id")
      .notNull()
      .references(() => reportCardSetups.id, { onDelete: "cascade" }),
    withholdAll: boolean("withhold_all").notNull().default(false),
    releaseAt: timestamp("release_at", { withTimezone: true }),
    feeLockMode: feeLockModeEnum("fee_lock_mode").notNull().default("OFF"),
    feeLockThresholdAmount: numeric("fee_lock_threshold_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    publicLookupEnabled: boolean("public_lookup_enabled")
      .notNull()
      .default(false),
    publicToppersEnabled: boolean("public_toppers_enabled")
      .notNull()
      .default(false),
    lastRecomputedAt: timestamp("last_recomputed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    setupUnique: unique("result_settings_setup_unique").on(t.setupId),
    schoolIdx: index("result_settings_school_idx").on(t.schoolId),
  }),
);

// ─── result_snapshots ─────────────────────────────────────────────────────────
export const resultSnapshots = pgTable(
  "result_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    setupId: uuid("setup_id")
      .notNull()
      .references(() => reportCardSetups.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    version: integer("version").notNull().default(1),
    payload: jsonb("payload").notNull(), // Full frozen snapshot payload
    frozenAt: timestamp("frozen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    frozenById: uuid("frozen_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    isCurrent: boolean("is_current").notNull().default(true),
    supersededById: uuid("superseded_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    setupStudentVersionUnique: unique("result_snapshots_unique").on(
      t.setupId,
      t.studentId,
      t.version,
    ),
    lookupIdx: index("result_snapshots_lookup_idx").on(
      t.setupId,
      t.studentId,
      t.isCurrent,
    ),
    schoolIdx: index("result_snapshots_school_idx").on(t.schoolId),
  }),
);

// ─── result_holds ─────────────────────────────────────────────────────────────
export const resultHolds = pgTable(
  "result_holds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    setupId: uuid("setup_id")
      .notNull()
      .references(() => reportCardSetups.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    placedById: uuid("placed_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    setupStudentUnique: unique("result_holds_unique").on(
      t.setupId,
      t.studentId,
    ),
    schoolIdx: index("result_holds_school_idx").on(t.schoolId),
  }),
);

// ─── uploaded_marksheets ──────────────────────────────────────────────────────
export const uploadedMarksheets = pgTable(
  "uploaded_marksheets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    setupId: uuid("setup_id")
      .notNull()
      .references(() => reportCardSetups.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    s3Key: text("s3_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    uploadedById: uuid("uploaded_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    setupStudentUnique: unique("uploaded_marksheets_unique").on(
      t.setupId,
      t.studentId,
    ),
    schoolIdx: index("uploaded_marksheets_school_idx").on(t.schoolId),
  }),
);

// ─── public_result_lookups ────────────────────────────────────────────────────
export const publicResultLookups = pgTable(
  "public_result_lookups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    setupId: uuid("setup_id").references(() => reportCardSetups.id, {
      onDelete: "set null",
    }),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address").notNull(),
    success: boolean("success").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolAttemptIdx: index("public_result_lookups_school_idx").on(
      t.schoolId,
      t.attemptedAt,
    ),
    ipAttemptIdx: index("public_result_lookups_ip_idx").on(
      t.ipAddress,
      t.attemptedAt,
    ),
  }),
);

export const reportCards = pgTable(
  "report_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "restrict" }),
    gradeData: jsonb("grade_data").notNull(), // Computed results
    overallGrade: text("overall_grade"),
    rank: integer("rank"),
    attendancePercent: numeric("attendance_percent", {
      precision: 5,
      scale: 2,
    }),
    teacherRemarks: text("teacher_remarks"),
    principalRemarks: text("principal_remarks"),
    pdfS3Key: text("pdf_s3_key"), // Generated PDF
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    generatedById: uuid("generated_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    studentExamUnique: unique("report_cards_student_exam_unique").on(
      t.studentId,
      t.examId,
    ),
    schoolYearIdx: index("report_cards_school_year_idx").on(
      t.schoolId,
      t.academicYearId,
    ),
  }),
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    certificateType: text("certificate_type").notNull(), // "TC", "CHARACTER", "MIGRATION", "TOPPER"
    certificateNumber: text("certificate_number").notNull(),
    issuedDate: timestamp("issued_date", { withTimezone: true }).notNull(),
    issuedById: uuid("issued_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    pdfS3Key: text("pdf_s3_key"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    certNumberUnique: unique("certificates_number_unique").on(
      t.schoolId,
      t.certificateNumber,
    ),
    studentIdx: index("certificates_student_idx").on(t.studentId),
  }),
);

// ─── exam_schedules ───────────────────────────────────────────────────────────
export const examSchedules = pgTable(
  "exam_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    examDate: date("exam_date").notNull(),
    startTime: time("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(180),
    roomNumber: text("room_number"),
    invigilatorId: uuid("invigilator_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    maxMarks: numeric("max_marks", { precision: 7, scale: 2 }).notNull(),
    passingMarks: numeric("passing_marks", {
      precision: 7,
      scale: 2,
    }).notNull(),
    datesheetPublishedAt: timestamp("datesheet_published_at", {
      withTimezone: true,
    }),
    datesheetPublishedById: uuid("datesheet_published_by_id").references(
      () => users.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    examSubjectClassUnique: unique("exam_schedules_unique").on(
      t.examId,
      t.subjectId,
      t.classId,
    ),
    examIdx: index("exam_schedules_exam_idx").on(t.examId),
    classIdx: index("exam_schedules_class_idx").on(t.classId),
    datesheetPubIdx: index("exam_schedules_datesheet_pub_idx").on(
      t.schoolId,
      t.datesheetPublishedAt,
    ),
  }),
);

// ─── grade_rules ──────────────────────────────────────────────────────────────
export const gradeRules = pgTable(
  "grade_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    classGroup: classGroupEnum("class_group").notNull(),
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    minPercent: numeric("min_percent", { precision: 5, scale: 2 }).notNull(),
    maxPercent: numeric("max_percent", { precision: 5, scale: 2 }).notNull(),
    grade: text("grade").notNull(),
    gradePoint: numeric("grade_point", { precision: 4, scale: 2 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolGroupIdx: index("grade_rules_school_group_idx").on(
      t.schoolId,
      t.classGroup,
    ),
    schoolClassIdx: index("grade_rules_school_class_idx").on(
      t.schoolId,
      t.classId,
    ),
  }),
);

// ─── report_card_jobs ─────────────────────────────────────────────────────────
export const reportCardJobs = pgTable(
  "report_card_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    setupId: uuid("setup_id"),
    jobType: text("job_type").notNull().default("REPORT_CARD"),
    totalStudents: integer("total_students").notNull().default(0),
    processedCount: integer("processed_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    status: reportCardJobStatusEnum("status").notNull().default("QUEUED"),
    triggeredById: uuid("triggered_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    errorLog: jsonb("error_log"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    examClassIdx: index("report_card_jobs_exam_class_idx").on(
      t.examId,
      t.classId,
    ),
    setupIdx: index("report_card_jobs_setup_idx").on(t.setupId),
  }),
);

// ─── medical_exemptions ───────────────────────────────────────────────────────
export const medicalExemptions = pgTable(
  "medical_exemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id").notNull(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "restrict" }),
    subjectId: uuid("subject_id").references(() => subjects.id, {
      onDelete: "restrict",
    }), // null = all subjects
    reason: text("reason").notNull(),
    approvedById: uuid("approved_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    documentS3Key: text("document_s3_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    studentExamIdx: index("medical_exemptions_student_exam_idx").on(
      t.studentId,
      t.examId,
    ),
  }),
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const examTypesRelations = relations(examTypes, ({ one, many }) => ({
  school: one(schools, {
    fields: [examTypes.schoolId],
    references: [schools.id],
  }),
  exams: many(exams),
  components: many(examComponents),
}));

export const examsRelations = relations(exams, ({ one, many }) => ({
  school: one(schools, { fields: [exams.schoolId], references: [schools.id] }),
  academicYear: one(academicYears, {
    fields: [exams.academicYearId],
    references: [academicYears.id],
  }),
  examType: one(examTypes, {
    fields: [exams.examTypeId],
    references: [examTypes.id],
  }),
  lockedBy: one(users, { fields: [exams.lockedById], references: [users.id] }),
  markEntries: many(markEntries),
  examSchedules: many(examSchedules),
  reportCards: many(reportCards),
  reportCardJobs: many(reportCardJobs),
  medicalExemptions: many(medicalExemptions),
  components: many(examComponents),
  classScopes: many(examClassScopes),
  markDistributions: many(examMarkDistributions),
  marksLocks: many(examMarksLocks),
  admitCardSettings: one(examAdmitCardSettings),
  admitCardHolds: many(examAdmitCardHolds),
  cocurricularGrades: many(cocurricularGrades),
}));

export const examComponentsRelations = relations(
  examComponents,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [examComponents.schoolId],
      references: [schools.id],
    }),
    exam: one(exams, {
      fields: [examComponents.examId],
      references: [exams.id],
    }),
    examType: one(examTypes, {
      fields: [examComponents.examTypeId],
      references: [examTypes.id],
    }),
    markEntries: many(markEntries),
    markDistributions: many(examMarkDistributions),
  }),
);

export const examClassScopesRelations = relations(
  examClassScopes,
  ({ one }) => ({
    school: one(schools, {
      fields: [examClassScopes.schoolId],
      references: [schools.id],
    }),
    exam: one(exams, {
      fields: [examClassScopes.examId],
      references: [exams.id],
    }),
    class: one(classes, {
      fields: [examClassScopes.classId],
      references: [classes.id],
    }),
  }),
);

export const examMarkDistributionsRelations = relations(
  examMarkDistributions,
  ({ one }) => ({
    school: one(schools, {
      fields: [examMarkDistributions.schoolId],
      references: [schools.id],
    }),
    exam: one(exams, {
      fields: [examMarkDistributions.examId],
      references: [exams.id],
    }),
    class: one(classes, {
      fields: [examMarkDistributions.classId],
      references: [classes.id],
    }),
    subject: one(subjects, {
      fields: [examMarkDistributions.subjectId],
      references: [subjects.id],
    }),
    component: one(examComponents, {
      fields: [examMarkDistributions.componentId],
      references: [examComponents.id],
    }),
  }),
);

export const markEntriesRelations = relations(markEntries, ({ one }) => ({
  school: one(schools, {
    fields: [markEntries.schoolId],
    references: [schools.id],
  }),
  exam: one(exams, { fields: [markEntries.examId], references: [exams.id] }),
  subject: one(subjects, {
    fields: [markEntries.subjectId],
    references: [subjects.id],
  }),
  component: one(examComponents, {
    fields: [markEntries.componentId],
    references: [examComponents.id],
  }),
  enteredBy: one(users, {
    fields: [markEntries.enteredById],
    references: [users.id],
  }),
}));

export const examMarksLocksRelations = relations(examMarksLocks, ({ one }) => ({
  school: one(schools, {
    fields: [examMarksLocks.schoolId],
    references: [schools.id],
  }),
  exam: one(exams, {
    fields: [examMarksLocks.examId],
    references: [exams.id],
  }),
  class: one(classes, {
    fields: [examMarksLocks.classId],
    references: [classes.id],
  }),
  subject: one(subjects, {
    fields: [examMarksLocks.subjectId],
    references: [subjects.id],
  }),
  submittedBy: one(users, {
    fields: [examMarksLocks.submittedById],
    references: [users.id],
  }),
  lockedBy: one(users, {
    fields: [examMarksLocks.lockedById],
    references: [users.id],
  }),
  unlockedBy: one(users, {
    fields: [examMarksLocks.unlockedById],
    references: [users.id],
  }),
}));

export const examAdmitCardSettingsRelations = relations(
  examAdmitCardSettings,
  ({ one }) => ({
    school: one(schools, {
      fields: [examAdmitCardSettings.schoolId],
      references: [schools.id],
    }),
    exam: one(exams, {
      fields: [examAdmitCardSettings.examId],
      references: [exams.id],
    }),
  }),
);

export const examAdmitCardHoldsRelations = relations(
  examAdmitCardHolds,
  ({ one }) => ({
    school: one(schools, {
      fields: [examAdmitCardHolds.schoolId],
      references: [schools.id],
    }),
    exam: one(exams, {
      fields: [examAdmitCardHolds.examId],
      references: [exams.id],
    }),
    student: one(students, {
      fields: [examAdmitCardHolds.studentId],
      references: [students.id],
    }),
    placedBy: one(users, {
      fields: [examAdmitCardHolds.placedById],
      references: [users.id],
    }),
    releasedBy: one(users, {
      fields: [examAdmitCardHolds.releasedById],
      references: [users.id],
    }),
  }),
);

export const cocurricularGradesRelations = relations(
  cocurricularGrades,
  ({ one }) => ({
    school: one(schools, {
      fields: [cocurricularGrades.schoolId],
      references: [schools.id],
    }),
    exam: one(exams, {
      fields: [cocurricularGrades.examId],
      references: [exams.id],
    }),
    student: one(students, {
      fields: [cocurricularGrades.studentId],
      references: [students.id],
    }),
    area: one(cocurricularAreas, {
      fields: [cocurricularGrades.areaId],
      references: [cocurricularAreas.id],
    }),
    gradedBy: one(users, {
      fields: [cocurricularGrades.gradedById],
      references: [users.id],
    }),
  }),
);

export const reportCardSetupsRelations = relations(
  reportCardSetups,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [reportCardSetups.schoolId],
      references: [schools.id],
    }),
    academicYear: one(academicYears, {
      fields: [reportCardSetups.academicYearId],
      references: [academicYears.id],
    }),
    createdBy: one(users, {
      fields: [reportCardSetups.createdById],
      references: [users.id],
    }),
    resultSettings: one(resultSettings),
    snapshots: many(resultSnapshots),
    holds: many(resultHolds),
    uploadedMarksheets: many(uploadedMarksheets),
  }),
);

export const resultSettingsRelations = relations(resultSettings, ({ one }) => ({
  school: one(schools, {
    fields: [resultSettings.schoolId],
    references: [schools.id],
  }),
  setup: one(reportCardSetups, {
    fields: [resultSettings.setupId],
    references: [reportCardSetups.id],
  }),
}));

export const resultSnapshotsRelations = relations(
  resultSnapshots,
  ({ one }) => ({
    school: one(schools, {
      fields: [resultSnapshots.schoolId],
      references: [schools.id],
    }),
    setup: one(reportCardSetups, {
      fields: [resultSnapshots.setupId],
      references: [reportCardSetups.id],
    }),
    student: one(students, {
      fields: [resultSnapshots.studentId],
      references: [students.id],
    }),
    frozenBy: one(users, {
      fields: [resultSnapshots.frozenById],
      references: [users.id],
    }),
  }),
);

export const resultHoldsRelations = relations(resultHolds, ({ one }) => ({
  school: one(schools, {
    fields: [resultHolds.schoolId],
    references: [schools.id],
  }),
  setup: one(reportCardSetups, {
    fields: [resultHolds.setupId],
    references: [reportCardSetups.id],
  }),
  student: one(students, {
    fields: [resultHolds.studentId],
    references: [students.id],
  }),
  placedBy: one(users, {
    fields: [resultHolds.placedById],
    references: [users.id],
  }),
}));

export const uploadedMarksheetsRelations = relations(
  uploadedMarksheets,
  ({ one }) => ({
    school: one(schools, {
      fields: [uploadedMarksheets.schoolId],
      references: [schools.id],
    }),
    setup: one(reportCardSetups, {
      fields: [uploadedMarksheets.setupId],
      references: [reportCardSetups.id],
    }),
    student: one(students, {
      fields: [uploadedMarksheets.studentId],
      references: [students.id],
    }),
    uploadedBy: one(users, {
      fields: [uploadedMarksheets.uploadedById],
      references: [users.id],
    }),
  }),
);

export const reportCardsRelations = relations(reportCards, ({ one }) => ({
  school: one(schools, {
    fields: [reportCards.schoolId],
    references: [schools.id],
  }),
  academicYear: one(academicYears, {
    fields: [reportCards.academicYearId],
    references: [academicYears.id],
  }),
  exam: one(exams, { fields: [reportCards.examId], references: [exams.id] }),
  generatedBy: one(users, {
    fields: [reportCards.generatedById],
    references: [users.id],
  }),
}));

export const examSchedulesRelations = relations(examSchedules, ({ one }) => ({
  school: one(schools, {
    fields: [examSchedules.schoolId],
    references: [schools.id],
  }),
  exam: one(exams, { fields: [examSchedules.examId], references: [exams.id] }),
  subject: one(subjects, {
    fields: [examSchedules.subjectId],
    references: [subjects.id],
  }),
  class: one(classes, {
    fields: [examSchedules.classId],
    references: [classes.id],
  }),
  invigilator: one(users, {
    fields: [examSchedules.invigilatorId],
    references: [users.id],
  }),
  datesheetPublishedBy: one(users, {
    fields: [examSchedules.datesheetPublishedById],
    references: [users.id],
  }),
}));

export const gradeRulesRelations = relations(gradeRules, ({ one }) => ({
  school: one(schools, {
    fields: [gradeRules.schoolId],
    references: [schools.id],
  }),
  class: one(classes, {
    fields: [gradeRules.classId],
    references: [classes.id],
  }),
}));

export const reportCardJobsRelations = relations(reportCardJobs, ({ one }) => ({
  school: one(schools, {
    fields: [reportCardJobs.schoolId],
    references: [schools.id],
  }),
  exam: one(exams, { fields: [reportCardJobs.examId], references: [exams.id] }),
  class: one(classes, {
    fields: [reportCardJobs.classId],
    references: [classes.id],
  }),
  setup: one(reportCardSetups, {
    fields: [reportCardJobs.setupId],
    references: [reportCardSetups.id],
  }),
  triggeredBy: one(users, {
    fields: [reportCardJobs.triggeredById],
    references: [users.id],
  }),
}));

export const medicalExemptionsRelations = relations(
  medicalExemptions,
  ({ one }) => ({
    school: one(schools, {
      fields: [medicalExemptions.schoolId],
      references: [schools.id],
    }),
    exam: one(exams, {
      fields: [medicalExemptions.examId],
      references: [exams.id],
    }),
    subject: one(subjects, {
      fields: [medicalExemptions.subjectId],
      references: [subjects.id],
    }),
    approvedBy: one(users, {
      fields: [medicalExemptions.approvedById],
      references: [users.id],
    }),
  }),
);

// ─── Export Inferred Types ────────────────────────────────────────────────────
export type Exam = typeof exams.$inferSelect;
export type NewExam = typeof exams.$inferInsert;
export type ExamType = typeof examTypes.$inferSelect;
export type NewExamType = typeof examTypes.$inferInsert;
export type ExamComponent = typeof examComponents.$inferSelect;
export type NewExamComponent = typeof examComponents.$inferInsert;
export type ExamClassScope = typeof examClassScopes.$inferSelect;
export type NewExamClassScope = typeof examClassScopes.$inferInsert;
export type ExamMarkDistribution = typeof examMarkDistributions.$inferSelect;
export type NewExamMarkDistribution = typeof examMarkDistributions.$inferInsert;
export type MarkEntry = typeof markEntries.$inferSelect;
export type NewMarkEntry = typeof markEntries.$inferInsert;
export type ExamMarksLock = typeof examMarksLocks.$inferSelect;
export type NewExamMarksLock = typeof examMarksLocks.$inferInsert;
export type ExamAdmitCardSettings = typeof examAdmitCardSettings.$inferSelect;
export type NewExamAdmitCardSettings = typeof examAdmitCardSettings.$inferInsert;
export type AdmitCardTemplate = typeof admitCardTemplates.$inferSelect;
export type NewAdmitCardTemplate = typeof admitCardTemplates.$inferInsert;
export type ExamAdmitCardHold = typeof examAdmitCardHolds.$inferSelect;
export type NewExamAdmitCardHold = typeof examAdmitCardHolds.$inferInsert;
export type CocurricularArea = typeof cocurricularAreas.$inferSelect;
export type NewCocurricularArea = typeof cocurricularAreas.$inferInsert;
export type CocurricularGrade = typeof cocurricularGrades.$inferSelect;
export type NewCocurricularGrade = typeof cocurricularGrades.$inferInsert;
export type ReportCardSetup = typeof reportCardSetups.$inferSelect;
export type NewReportCardSetup = typeof reportCardSetups.$inferInsert;
export type ResultSetting = typeof resultSettings.$inferSelect;
export type NewResultSetting = typeof resultSettings.$inferInsert;
export type ResultSnapshot = typeof resultSnapshots.$inferSelect;
export type NewResultSnapshot = typeof resultSnapshots.$inferInsert;
export type ResultHold = typeof resultHolds.$inferSelect;
export type NewResultHold = typeof resultHolds.$inferInsert;
export type UploadedMarksheet = typeof uploadedMarksheets.$inferSelect;
export type NewUploadedMarksheet = typeof uploadedMarksheets.$inferInsert;
export type PublicResultLookup = typeof publicResultLookups.$inferSelect;
export type NewPublicResultLookup = typeof publicResultLookups.$inferInsert;
export type ExamSchedule = typeof examSchedules.$inferSelect;
export type NewExamSchedule = typeof examSchedules.$inferInsert;
export type GradeRuleRecord = typeof gradeRules.$inferSelect;
export type NewGradeRuleRecord = typeof gradeRules.$inferInsert;
