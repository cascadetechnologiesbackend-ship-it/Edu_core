// ─── Superadmin (Platform Operator) Schema ────────────────────────────────────
// Tables: global_template_profiles, global_template_academic_years,
//         global_template_classes, global_template_subjects,
//         global_template_timetable, global_template_fee_heads,
//         global_template_salary_grades, global_template_holidays,
//         global_template_roles,
//         platform_announcements, platform_announcement_reads,
//         impersonation_sessions
//
// Architecture: Copy-on-provision — templates are deep-cloned into school records
// at onboarding. Template changes never auto-propagate to existing schools.
// Each cloned record carries a sourceTemplateId FK for traceability (R-18).

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  index,
  unique,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, users, superAdminUsers } from "./core";
import { boardEnum } from "./core";
import { gradeLevelEnum } from "./students";
import { subjectTypeEnum, dayOfWeekEnum, periodTypeEnum } from "./academics";
import { roleNameEnum } from "./core";
import { feeHeadTypeEnum, feeTermEnum } from "./fees";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const schoolTypeEnum = pgEnum("school_type", [
  "PRIMARY",          // e.g., Nursery – Class 5
  "SECONDARY",        // e.g., Class 6 – Class 10
  "SENIOR_SECONDARY", // e.g., Class 11 – Class 12
  "INTEGRATED",       // e.g., Nursery – Class 12
]);

export const holidayTypeEnum = pgEnum("holiday_type_template", [
  "NATIONAL",
  "REGIONAL",
  "FESTIVAL",
]);

// ─── global_template_profiles ─────────────────────────────────────────────────
// Root container: Board × School-Type matrix entry.
// NOT itself a provisioned entity — it is the key used to look up the 8 entity bundles.

export const globalTemplateProfiles = pgTable(
  "global_template_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    board: boardEnum("board").notNull(),
    schoolType: schoolTypeEnum("school_type").notNull(),
    displayName: text("display_name").notNull(),   // "CBSE Secondary (Grades 6-10)"
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => superAdminUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft-delete (R-08)
  },
  (t) => ({
    boardTypeUnique: unique("gtp_board_type_unique").on(t.board, t.schoolType),
    boardIdx: index("gtp_board_idx").on(t.board),
  }),
);

// ─── global_template_academic_years ──────────────────────────────────────────
// Entity 1 of 8.
// Uses start_month / end_month (not absolute dates) to prevent yearly date drift.
// provisionFromTemplate() resolves these relative to the school's onboarding year.

export const globalTemplateAcademicYears = pgTable(
  "global_template_academic_years",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => globalTemplateProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "Standard Academic Cycle (April - March)"
    startMonth: integer("start_month").notNull(), // 1–12, e.g., 4 = April
    endMonth: integer("end_month").notNull(),     // 1–12, e.g., 3 = March
    // terms: [{name: "Term 1", start_month: 4, end_month: 9}, ...]
    terms: jsonb("terms").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("gtay_profile_idx").on(t.profileId),
  }),
);

// ─── global_template_classes ──────────────────────────────────────────────────
// Entity 2 of 8.
// MUST be cloned before subjects — subjects carry a FK to class IDs.
// provisionFromTemplate() builds classIdMap: templateClassId → newSchoolClassId

export const globalTemplateClasses = pgTable(
  "global_template_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => globalTemplateProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),                     // "Class 1", "LKG"
    numericLevel: integer("numeric_level").notNull(),  // canonical sort position
    gradeLevel: gradeLevelEnum("grade_level").notNull(),
    streams: text("streams").array().notNull().default([]),         // ["SCIENCE","COMMERCE","ARTS"] or []
    defaultSections: text("default_sections").array().notNull().default(["A"]), // ["A","B"]
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("gtc_profile_idx").on(t.profileId),
    sortIdx: index("gtc_sort_idx").on(t.profileId, t.sortOrder),
  }),
);

// ─── global_template_subjects ─────────────────────────────────────────────────
// Entity 3 of 8.
// classTemplateId FK must be translated via classIdMap during provisioning —
// the new school's class IDs differ from the template class IDs.

export const globalTemplateSubjects = pgTable(
  "global_template_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => globalTemplateProfiles.id, { onDelete: "cascade" }),
    // FK to template class — SET NULL on delete so subject stays if class template removed
    classTemplateId: uuid("class_template_id").references(
      () => globalTemplateClasses.id,
      { onDelete: "set null" },
    ),
    name: text("name").notNull(),
    code: text("code").notNull(),
    subjectType: subjectTypeEnum("subject_type").notNull(),
    isOptional: boolean("is_optional").notNull().default(false),
    weeklyPeriods: integer("weekly_periods").notNull().default(5),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("gts_profile_idx").on(t.profileId),
    classTemplateIdx: index("gts_class_template_idx").on(t.classTemplateId),
  }),
);

// ─── global_template_timetable ────────────────────────────────────────────────
// Entity 4 of 8.
// Period scaffold — school admin customises after provisioning.

export const globalTemplateTimetable = pgTable(
  "global_template_timetable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => globalTemplateProfiles.id, { onDelete: "cascade" }),
    dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
    periodNumber: integer("period_number").notNull(),
    periodType: periodTypeEnum("period_type").notNull(),
    startTime: text("start_time").notNull(), // stored as "HH:MM" text — avoids time-zone issues
    endTime: text("end_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileDayIdx: index("gtt_profile_day_idx").on(t.profileId, t.dayOfWeek),
  }),
);

// ─── global_template_fee_heads ────────────────────────────────────────────────
// Entity 5 of 8.

export const globalTemplateFeeHeads = pgTable(
  "global_template_fee_heads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => globalTemplateProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),        // "Tuition Fee", "Exam Fee"
    headType: feeHeadTypeEnum("head_type").notNull(),
    isMandatory: boolean("is_mandatory").notNull().default(true),
    frequency: feeTermEnum("frequency").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("gtfh_profile_idx").on(t.profileId),
  }),
);

// ─── global_template_salary_grades ────────────────────────────────────────────
// Entity 6 of 8.
// Salary values stored as integer paise/cents for decimal precision.

export const globalTemplateSalaryGrades = pgTable(
  "global_template_salary_grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => globalTemplateProfiles.id, { onDelete: "cascade" }),
    gradeName: text("grade_name").notNull(), // "PGT", "TGT", "PRT", "ADMIN"
    basicSalary: integer("basic_salary").notNull(), // in paise (rupees × 100)
    hraPercent: integer("hra_percent").notNull().default(10),  // stored as integer %
    daPercent: integer("da_percent").notNull().default(0),
    pfPercent: integer("pf_percent").notNull().default(12),
    // {medical: 100000, conveyance: 80000} — values in paise
    otherAllowances: jsonb("other_allowances").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("gtsg_profile_idx").on(t.profileId),
  }),
);

// ─── global_template_holidays ─────────────────────────────────────────────────
// Entity 7 of 8.
// NO `date` column — month+day integers prevent yearly drift.
// provisionFromTemplate() combines month+day with onboarding year to get real date.
// Non-fixed festivals (Eid, Diwali) must be added manually by school admin post-provision.

export const globalTemplateHolidays = pgTable(
  "global_template_holidays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => globalTemplateProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isFixedAnnual: boolean("is_fixed_annual").notNull().default(true), // true for Aug 15, Jan 26, Oct 2
    month: integer("month").notNull(), // 1–12
    day: integer("day").notNull(),     // 1–31
    holidayType: holidayTypeEnum("holiday_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("gth_profile_idx").on(t.profileId),
  }),
);

// ─── global_template_roles ────────────────────────────────────────────────────
// Entity 8 of 8.
// defaultPermissions: [{resource: "students", actions: ["read","write"]}, ...]

export const globalTemplateRoles = pgTable(
  "global_template_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => globalTemplateProfiles.id, { onDelete: "cascade" }),
    roleName: roleNameEnum("role_name").notNull(),
    displayName: text("display_name").notNull(),
    defaultPermissions: jsonb("default_permissions").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("gtr_profile_idx").on(t.profileId),
    profileRoleUnique: unique("gtr_profile_role_unique").on(t.profileId, t.roleName),
  }),
);

// ─── platform_announcements ───────────────────────────────────────────────────
// Platform-level broadcast/targeted messages from Superadmin to school admins.
// Read tracking via junction table (platform_announcement_reads) — NOT jsonb column
// to avoid row-lock hot-spots when multiple admins mark read concurrently.

export const platformAnnouncements = pgTable(
  "platform_announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    sentBy: uuid("sent_by")
      .notNull()
      .references(() => superAdminUsers.id, { onDelete: "restrict" }),
    // NULL = broadcast to all schools; non-null = targeted
    targetSchoolIds: uuid("target_school_ids").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft-delete
  },
  (t) => ({
    createdAtIdx: index("pa_created_at_idx").on(t.createdAt),
  }),
);

// ─── platform_announcement_reads ─────────────────────────────────────────────
// Read-receipt junction table. Composite PK eliminates duplicate reads.
// INSERT-only (no UPDATE) — eliminates row-lock contention vs jsonb column approach.

export const platformAnnouncementReads = pgTable(
  "platform_announcement_reads",
  {
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => platformAnnouncements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: unique("par_pk").on(t.announcementId, t.userId),
    userIdx: index("par_user_idx").on(t.userId),
  }),
);

// ─── impersonation_sessions ───────────────────────────────────────────────────
// Tracks every Superadmin impersonation session.
// expires_at: hard TTL (e.g., 60 minutes) — prevents dangling JWT tokens.
// ended_at: NULL means session still active; set by endImpersonation() mutation.

export const impersonationSessions = pgTable(
  "impersonation_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    superAdminId: uuid("super_admin_id")
      .notNull()
      .references(() => superAdminUsers.id, { onDelete: "restrict" }),
    targetSchoolId: uuid("target_school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    scopedTokenHash: text("scoped_token_hash").notNull().unique(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // hard TTL
    endedAt: timestamp("ended_at", { withTimezone: true }), // NULL = still active
    ipAddress: text("ip_address"),
  },
  (t) => ({
    superAdminIdx: index("is_super_admin_idx").on(t.superAdminId),
    targetSchoolIdx: index("is_target_school_idx").on(t.targetSchoolId),
    activeIdx: index("is_active_idx").on(t.superAdminId, t.endedAt),
    tokenIdx: index("is_token_idx").on(t.scopedTokenHash),
  }),
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const globalTemplateProfilesRelations = relations(
  globalTemplateProfiles,
  ({ many }) => ({
    academicYears: many(globalTemplateAcademicYears),
    classes: many(globalTemplateClasses),
    subjects: many(globalTemplateSubjects),
    timetable: many(globalTemplateTimetable),
    feeHeads: many(globalTemplateFeeHeads),
    salaryGrades: many(globalTemplateSalaryGrades),
    holidays: many(globalTemplateHolidays),
    roles: many(globalTemplateRoles),
  }),
);

export const globalTemplateClassesRelations = relations(
  globalTemplateClasses,
  ({ one, many }) => ({
    profile: one(globalTemplateProfiles, {
      fields: [globalTemplateClasses.profileId],
      references: [globalTemplateProfiles.id],
    }),
    subjects: many(globalTemplateSubjects),
  }),
);

export const globalTemplateSubjectsRelations = relations(
  globalTemplateSubjects,
  ({ one }) => ({
    profile: one(globalTemplateProfiles, {
      fields: [globalTemplateSubjects.profileId],
      references: [globalTemplateProfiles.id],
    }),
    classTemplate: one(globalTemplateClasses, {
      fields: [globalTemplateSubjects.classTemplateId],
      references: [globalTemplateClasses.id],
    }),
  }),
);

export const platformAnnouncementsRelations = relations(
  platformAnnouncements,
  ({ many }) => ({
    reads: many(platformAnnouncementReads),
  }),
);

export const platformAnnouncementReadsRelations = relations(
  platformAnnouncementReads,
  ({ one }) => ({
    announcement: one(platformAnnouncements, {
      fields: [platformAnnouncementReads.announcementId],
      references: [platformAnnouncements.id],
    }),
    user: one(users, {
      fields: [platformAnnouncementReads.userId],
      references: [users.id],
    }),
  }),
);

export const impersonationSessionsRelations = relations(
  impersonationSessions,
  ({ one }) => ({
    superAdmin: one(superAdminUsers, {
      fields: [impersonationSessions.superAdminId],
      references: [superAdminUsers.id],
    }),
    targetSchool: one(schools, {
      fields: [impersonationSessions.targetSchoolId],
      references: [schools.id],
    }),
    targetUser: one(users, {
      fields: [impersonationSessions.targetUserId],
      references: [users.id],
    }),
  }),
);
