// ─── HR & Payroll Schema ──────────────────────────────────────────────────────
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  pgEnum,
  index,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { schools, users, academicYears } from "./core";

export const contractTypeEnum = pgEnum("contract_type", [
  "PERMANENT",
  "PROBATION",
  "CONTRACTUAL",
  "PART_TIME",
  "GUEST_FACULTY",
]);

export const leaveTypeEnum = pgEnum("leave_type_hr", [
  "CL",
  "EL",
  "ML",
  "SL",
  "LWP",
  "MATERNITY",
  "PATERNITY",
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "PENDING",
  "HOD_APPROVED",
  "HR_APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    hodUserId: uuid("hod_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolNameUnique: unique("departments_school_name_unique").on(
      t.schoolId,
      t.name,
    ),
  }),
);

export const designations = pgTable("designations", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "restrict" }),
  departmentId: uuid("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  isTeaching: boolean("is_teaching").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    employeeCode: text("employee_code").notNull(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    designationId: uuid("designation_id")
      .notNull()
      .references(() => designations.id, { onDelete: "restrict" }),
    contractType: contractTypeEnum("contract_type").notNull(),
    joiningDate: timestamp("joining_date", { withTimezone: true }).notNull(),
    confirmationDate: timestamp("confirmation_date", { withTimezone: true }),
    // PII — AES-256 encrypted
    firstNameEncrypted: text("first_name_encrypted").notNull(),
    lastNameEncrypted: text("last_name_encrypted").notNull(),
    dateOfBirthEncrypted: text("date_of_birth_encrypted").notNull(),
    genderEncrypted: text("gender_encrypted").notNull(),
    mobileEncrypted: text("mobile_encrypted").notNull(),
    emailEncrypted: text("email_encrypted").notNull(),
    addressEncrypted: text("address_encrypted"),
    // Aadhaar — last 4 only
    aadhaarLast4: text("aadhaar_last4"),
    // PAN — AES-256 encrypted (HR Manager only)
    panEncrypted: text("pan_encrypted"),
    // Bank account — AES-256 encrypted
    bankAccountEncrypted: text("bank_account_encrypted"),
    bankIfscEncrypted: text("bank_ifsc_encrypted"),
    bankNameEncrypted: text("bank_name_encrypted"),
    qualification: text("qualification"),
    experience: text("experience"),
    photoS3Key: text("photo_s3_key"),
    isActive: boolean("is_active").notNull().default(true),
    legalHold: boolean("legal_hold").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    schoolCodeUnique: unique("staff_school_code_unique").on(
      t.schoolId,
      t.employeeCode,
    ),
    schoolIdx: index("staff_school_idx").on(t.schoolId),
  }),
);

export const leaveTypes = pgTable("leave_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "restrict" }),
  code: leaveTypeEnum("code").notNull(),
  name: text("name").notNull(),
  maxDaysPerYear: integer("max_days_per_year").notNull(),
  isPaid: boolean("is_paid").notNull().default(true),
  isCarryForward: boolean("is_carry_forward").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    leaveTypeId: uuid("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "restrict" }),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    totalDays: numeric("total_days", { precision: 5, scale: 1 }).notNull(),
    reason: text("reason").notNull(),
    attachmentS3Key: text("attachment_s3_key"),
    status: leaveStatusEnum("status").notNull().default("PENDING"),
    hodApprovedById: uuid("hod_approved_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    hodApprovedAt: timestamp("hod_approved_at", { withTimezone: true }),
    hrApprovedById: uuid("hr_approved_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    hrApprovedAt: timestamp("hr_approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    staffIdx: index("leave_requests_staff_idx").on(t.staffId),
    schoolIdx: index("leave_requests_school_idx").on(t.schoolId),
    statusIdx: index("leave_requests_status_idx").on(t.status),
  }),
);

export const salaryComponents = pgTable("salary_components", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "restrict" }),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "restrict" }),
  basicSalary: numeric("basic_salary", { precision: 12, scale: 2 }).notNull(),
  daPercent: numeric("da_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  hraPercent: numeric("hra_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  otherAllowances: jsonb("other_allowances").default([]).notNull(),
  pfEmployeePercent: numeric("pf_employee_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("12"),
  pfEmployerPercent: numeric("pf_employer_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("12"),
  esiApplicable: boolean("esi_applicable").notNull().default(false),
  professionalTaxState: text("professional_tax_state").default("DL"),
  monthlyTdsAmount: numeric("monthly_tds_amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0.00"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    month: text("month").notNull(), // "2025-06"
    status: text("status").notNull().default("DRAFT"), // DRAFT, PROCESSED, APPROVED, PAID
    processedById: uuid("processed_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    approvedById: uuid("approved_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    totalGross: numeric("total_gross", { precision: 14, scale: 2 }),
    totalNetPay: numeric("total_net_pay", { precision: 14, scale: 2 }),
    totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolMonthUnique: unique("payroll_runs_school_month_unique").on(
      t.schoolId,
      t.month,
    ),
  }),
);

export const payslips = pgTable(
  "payslips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => payrollRuns.id, { onDelete: "restrict" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    month: text("month").notNull(),
    workingDays: integer("working_days").notNull(),
    presentDays: integer("present_days").notNull(),
    basicSalary: numeric("basic_salary", { precision: 12, scale: 2 }).notNull(),
    da: numeric("da", { precision: 12, scale: 2 }).notNull().default("0"),
    hra: numeric("hra", { precision: 12, scale: 2 }).notNull().default("0"),
    otherAllowances: numeric("other_allowances", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    grossSalary: numeric("gross_salary", { precision: 12, scale: 2 }).notNull(),
    pfEmployee: numeric("pf_employee", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    pfEmployer: numeric("pf_employer", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    esi: numeric("esi", { precision: 10, scale: 2 }).notNull().default("0"),
    professionalTax: numeric("professional_tax", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    tds: numeric("tds", { precision: 10, scale: 2 }).notNull().default("0"),
    loanDeduction: numeric("loan_deduction", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    totalDeductions: numeric("total_deductions", {
      precision: 12,
      scale: 2,
    }).notNull(),
    netPay: numeric("net_pay", { precision: 12, scale: 2 }).notNull(),
    pdfS3Key: text("pdf_s3_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    runStaffUnique: unique("payslips_run_staff_unique").on(
      t.payrollRunId,
      t.staffId,
    ),
    staffIdx: index("payslips_staff_idx").on(t.staffId),
  }),
);

export const salaryTemplates = pgTable(
  "salary_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    basicPercent: numeric("basic_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("50.00"),
    daPercent: numeric("da_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("0.00"),
    hraPercent: numeric("hra_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("0.00"),
    pfEmployeePercent: numeric("pf_employee_percent", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("12.00"),
    pfEmployerPercent: numeric("pf_employer_percent", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("12.00"),
    esiApplicable: boolean("esi_applicable").notNull().default(false),
    professionalTaxState: text("professional_tax_state")
      .default("DL")
      .notNull(),
    otherAllowances: jsonb("other_allowances").default([]).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolNameUnique: unique("salary_templates_school_name_unique").on(
      t.schoolId,
      t.name,
    ),
  }),
);

export const staffDocuments = pgTable(
  "staff_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    documentType: text("document_type").notNull(), // APPOINTMENT_LETTER, INCREMENT_LETTER, CERTIFICATE, OTHER
    fileName: text("file_name").notNull(),
    fileS3Key: text("file_s3_key").notNull(),
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
    staffIdx: index("staff_documents_staff_idx").on(t.staffId),
  }),
);

export const staffLoans = pgTable(
  "staff_loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    principalAmount: numeric("principal_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    emiAmount: numeric("emi_amount", { precision: 10, scale: 2 }).notNull(),
    remainingAmount: numeric("remaining_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    status: text("status").notNull().default("ACTIVE"), // ACTIVE, PAID_OFF
    approvedById: uuid("approved_by_id").references(() => users.id, {
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
    staffIdx: index("staff_loans_staff_idx").on(t.staffId),
  }),
);

export const leaveBalances = pgTable(
  "leave_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    leaveType: leaveTypeEnum("leave_type").notNull(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    allocatedDays: numeric("allocated_days", {
      precision: 5,
      scale: 1,
    }).notNull(),
    usedDays: numeric("used_days", { precision: 5, scale: 1 })
      .notNull()
      .default("0"),
    carriedForwardDays: numeric("carried_forward_days", {
      precision: 5,
      scale: 1,
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
    staffYearTypeUnique: unique("leave_balances_unique").on(
      t.staffId,
      t.academicYearId,
      t.leaveType,
    ),
    staffIdx: index("leave_balances_staff_idx").on(t.staffId),
  }),
);

// Drizzle Relations
export const staffRelations = relations(staff, ({ one, many }) => ({
  school: one(schools, { fields: [staff.schoolId], references: [schools.id] }),
  user: one(users, { fields: [staff.userId], references: [users.id] }),
  department: one(departments, {
    fields: [staff.departmentId],
    references: [departments.id],
  }),
  designation: one(designations, {
    fields: [staff.designationId],
    references: [designations.id],
  }),
  leaveRequests: many(leaveRequests),
  payslips: many(payslips),
  documents: many(staffDocuments),
  loans: many(staffLoans),
  leaveBalances: many(leaveBalances),
  salaryComponents: many(salaryComponents),
}));

export const departmentRelations = relations(departments, ({ one, many }) => ({
  school: one(schools, {
    fields: [departments.schoolId],
    references: [schools.id],
  }),
  hod: one(users, { fields: [departments.hodUserId], references: [users.id] }),
  staff: many(staff),
  designations: many(designations),
}));

export const designationRelations = relations(
  designations,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [designations.schoolId],
      references: [schools.id],
    }),
    department: one(departments, {
      fields: [designations.departmentId],
      references: [departments.id],
    }),
    staff: many(staff),
  }),
);

export const leaveRequestRelations = relations(leaveRequests, ({ one }) => ({
  school: one(schools, {
    fields: [leaveRequests.schoolId],
    references: [schools.id],
  }),
  staff: one(staff, {
    fields: [leaveRequests.staffId],
    references: [staff.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveRequests.leaveTypeId],
    references: [leaveTypes.id],
  }),
}));

export const leaveTypeRelations = relations(leaveTypes, ({ one }) => ({
  school: one(schools, {
    fields: [leaveTypes.schoolId],
    references: [schools.id],
  }),
}));

export const leaveBalanceRelations = relations(leaveBalances, ({ one }) => ({
  school: one(schools, {
    fields: [leaveBalances.schoolId],
    references: [schools.id],
  }),
  staff: one(staff, {
    fields: [leaveBalances.staffId],
    references: [staff.id],
  }),
  academicYear: one(academicYears, {
    fields: [leaveBalances.academicYearId],
    references: [academicYears.id],
  }),
}));

export const salaryComponentRelations = relations(
  salaryComponents,
  ({ one }) => ({
    school: one(schools, {
      fields: [salaryComponents.schoolId],
      references: [schools.id],
    }),
    staff: one(staff, {
      fields: [salaryComponents.staffId],
      references: [staff.id],
    }),
  }),
);

export const payrollRunRelations = relations(payrollRuns, ({ one, many }) => ({
  school: one(schools, {
    fields: [payrollRuns.schoolId],
    references: [schools.id],
  }),
  payslips: many(payslips),
}));

export const payslipRelations = relations(payslips, ({ one }) => ({
  school: one(schools, {
    fields: [payslips.schoolId],
    references: [schools.id],
  }),
  payrollRun: one(payrollRuns, {
    fields: [payslips.payrollRunId],
    references: [payrollRuns.id],
  }),
  staff: one(staff, { fields: [payslips.staffId], references: [staff.id] }),
}));

export const staffDocumentRelations = relations(staffDocuments, ({ one }) => ({
  school: one(schools, {
    fields: [staffDocuments.schoolId],
    references: [schools.id],
  }),
  staff: one(staff, {
    fields: [staffDocuments.staffId],
    references: [staff.id],
  }),
}));

export const staffLoanRelations = relations(staffLoans, ({ one }) => ({
  school: one(schools, {
    fields: [staffLoans.schoolId],
    references: [schools.id],
  }),
  staff: one(staff, { fields: [staffLoans.staffId], references: [staff.id] }),
}));

export const salaryTemplateRelations = relations(
  salaryTemplates,
  ({ one }) => ({
    school: one(schools, {
      fields: [salaryTemplates.schoolId],
      references: [schools.id],
    }),
  }),
);
