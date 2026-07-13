// ─── Core Schema ──────────────────────────────────────────────────────────────
// Tables: schools, academic_years, roles, permissions, role_permissions,
//         users, user_roles, sessions, audit_logs
// DPDP: audit_logs is append-only (enforced via trigger in migration)

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
  unique,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const boardEnum = pgEnum("board", [
  "CBSE",
  "ICSE",
  "STATE_BOARD",
  "IGCSE",
  "IB",
]);

export const roleNameEnum = pgEnum("role_name", [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
  "TEACHER",
  "ACCOUNTANT",
  "LIBRARIAN",
  "TRANSPORT_MANAGER",
  "PARENT",
  "STUDENT",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "READ",
  "WRITE",
  "DELETE",
  "EXPORT",
  "CONSENT_GRANT",
  "CONSENT_WITHDRAW",
  "LOGIN",
  "LOGOUT",
  "FAILED_LOGIN",
]);

// ─── schools ─────────────────────────────────────────────────────────────────

export const schools = pgTable(
  "schools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    board: boardEnum("board").notNull(),
    udiseCode: text("udise_code").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    principalName: text("principal_name").notNull(),
    logoS3Key: text("logo_s3_key"),
    establishedYear: integer("established_year").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    featureFlags: jsonb("feature_flags").default({}).notNull(),
    // Subscription
    subscriptionTier: text("subscription_tier").default("STANDARD").notNull(),
    subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    udiseIdx: unique("schools_udise_unique").on(t.udiseCode),
    emailIdx: index("schools_email_idx").on(t.email),
  })
);

// ─── academic_years ───────────────────────────────────────────────────────────

export const academicYears = pgTable(
  "academic_years",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    label: text("label").notNull(), // "2025-26"
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolYearIdx: index("academic_years_school_idx").on(t.schoolId),
    uniqueLabel: unique("academic_years_school_label_unique").on(t.schoolId, t.label),
  })
);

// ─── roles ────────────────────────────────────────────────────────────────────

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "restrict" }),
    name: roleNameEnum("name").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description"),
    isSystemRole: boolean("is_system_role").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolRoleIdx: index("roles_school_idx").on(t.schoolId),
  })
);

// ─── permissions ──────────────────────────────────────────────────────────────

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  resource: text("resource").notNull(), // e.g. "students", "fees"
  action: text("action").notNull(), // e.g. "read", "write", "delete"
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── role_permissions ─────────────────────────────────────────────────────────

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    unique: unique("role_permissions_unique").on(t.roleId, t.permissionId),
    roleIdx: index("role_permissions_role_idx").on(t.roleId),
  })
);

// ─── users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "restrict" }),
    email: text("email").notNull(),
    // PII encrypted at application layer (AES-256)
    mobileEncrypted: text("mobile_encrypted"),
    passwordHash: text("password_hash"),
    // 2FA
    totpSecret: text("totp_secret"), // encrypted
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    // Status
    isActive: boolean("is_active").notNull().default(true),
    isEmailVerified: boolean("is_email_verified").notNull().default(false),
    isMobileVerified: boolean("is_mobile_verified").notNull().default(false),
    // Password policy
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    // Preferences
    prefersDarkMode: boolean("prefers_dark_mode").notNull().default(false),
    languagePreference: text("language_preference").notNull().default("en"),
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    emailUnique: unique("users_email_unique").on(t.email),
    schoolIdx: index("users_school_idx").on(t.schoolId),
    emailIdx: index("users_email_idx").on(t.email),
  })
);

// ─── user_roles ───────────────────────────────────────────────────────────────

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedById: uuid("assigned_by_id").references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    unique: unique("user_roles_unique").on(t.userId, t.roleId, t.schoolId),
    userIdx: index("user_roles_user_idx").on(t.userId),
    schoolIdx: index("user_roles_school_idx").on(t.schoolId),
  })
);

// ─── sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sessionToken: text("session_token").notNull(),
    refreshToken: text("refresh_token"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    tokenIdx: unique("sessions_token_unique").on(t.sessionToken),
    userIdx: index("sessions_user_idx").on(t.userId),
    expiryIdx: index("sessions_expiry_idx").on(t.expiresAt),
  })
);

// ─── audit_logs ───────────────────────────────────────────────────────────────
// APPEND-ONLY. No UPDATE or DELETE permitted.
// PostgreSQL trigger enforces this (see migration 0001).
// DPDP Act 2023 Section 8(5) — mandatory audit trail

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(), // NOT a FK — user may be deleted but log must persist
    userEmail: text("user_email").notNull(), // denormalised for audit readability
    userRole: text("user_role").notNull(),
    schoolId: uuid("school_id").notNull(),
    action: auditActionEnum("action").notNull(),
    tableName: text("table_name").notNull(),
    recordId: text("record_id"),
    purposeId: text("purpose_id"), // consent purpose if applicable
    ipAddress: text("ip_address").notNull(),
    userAgent: text("user_agent").notNull(),
    // NOTE: metadata must NEVER contain PII field values — only record IDs and non-PII context
    metadata: jsonb("metadata"),
    legalHold: boolean("legal_hold").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // NO updatedAt, NO deletedAt — audit logs are immutable
  },
  (t) => ({
    schoolIdx: index("audit_logs_school_idx").on(t.schoolId),
    userIdx: index("audit_logs_user_idx").on(t.userId),
    tableIdx: index("audit_logs_table_idx").on(t.tableName),
    dateIdx: index("audit_logs_date_idx").on(t.createdAt),
  })
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const schoolsRelations = relations(schools, ({ many }) => ({
  academicYears: many(academicYears),
  users: many(users),
  roles: many(roles),
  userRoles: many(userRoles),
}));

export const academicYearsRelations = relations(academicYears, ({ one }) => ({
  school: one(schools, { fields: [academicYears.schoolId], references: [schools.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  school: one(schools, { fields: [users.schoolId], references: [schools.id] }),
  userRoles: many(userRoles),
  sessions: many(sessions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
  school: one(schools, { fields: [userRoles.schoolId], references: [schools.id] }),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  school: one(schools, { fields: [roles.schoolId], references: [schools.id] }),
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));
