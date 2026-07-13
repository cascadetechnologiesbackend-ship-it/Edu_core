// ─── HR & Payroll Schema ──────────────────────────────────────────────────────
import {
  pgTable, uuid, text, boolean, timestamp, numeric, integer, pgEnum, index, unique, jsonb,
} from "drizzle-orm/pg-core";
import { schools, users } from "./core";

export const contractTypeEnum = pgEnum("contract_type", [
  "PERMANENT", "PROBATION", "CONTRACTUAL", "PART_TIME", "GUEST_FACULTY",
]);

export const leaveTypeEnum = pgEnum("leave_type_hr", [
  "CL", "EL", "ML", "SL", "LWP", "MATERNITY", "PATERNITY",
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "PENDING", "HOD_APPROVED", "HR_APPROVED", "REJECTED", "CANCELLED",
]);

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  hodUserId: uuid("hod_user_id").references(() => users.id, { onDelete: "restrict" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  schoolNameUnique: unique("departments_school_name_unique").on(t.schoolId, t.name),
}));

export const designations = pgTable("designations", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  departmentId: uuid("department_id").notNull().references(() => departments.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  isTeaching: boolean("is_teaching").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "restrict" }),
  employeeCode: text("employee_code").notNull(),
  departmentId: uuid("department_id").notNull().references(() => departments.id, { onDelete: "restrict" }),
  designationId: uuid("designation_id").notNull().references(() => designations.id, { onDelete: "restrict" }),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => ({
  schoolCodeUnique: unique("staff_school_code_unique").on(t.schoolId, t.employeeCode),
  schoolIdx: index("staff_school_idx").on(t.schoolId),
}));

export const leaveTypes = pgTable("leave_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  code: leaveTypeEnum("code").notNull(),
  name: text("name").notNull(),
  maxDaysPerYear: integer("max_days_per_year").notNull(),
  isPaid: boolean("is_paid").notNull().default(true),
  isCarryForward: boolean("is_carry_forward").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "restrict" }),
  leaveTypeId: uuid("leave_type_id").notNull().references(() => leaveTypes.id, { onDelete: "restrict" }),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  totalDays: numeric("total_days", { precision: 5, scale: 1 }).notNull(),
  reason: text("reason").notNull(),
  attachmentS3Key: text("attachment_s3_key"),
  status: leaveStatusEnum("status").notNull().default("PENDING"),
  hodApprovedById: uuid("hod_approved_by_id").references(() => users.id, { onDelete: "restrict" }),
  hodApprovedAt: timestamp("hod_approved_at", { withTimezone: true }),
  hrApprovedById: uuid("hr_approved_by_id").references(() => users.id, { onDelete: "restrict" }),
  hrApprovedAt: timestamp("hr_approved_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  staffIdx: index("leave_requests_staff_idx").on(t.staffId),
  schoolIdx: index("leave_requests_school_idx").on(t.schoolId),
  statusIdx: index("leave_requests_status_idx").on(t.status),
}));

export const salaryComponents = pgTable("salary_components", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "restrict" }),
  basicSalary: numeric("basic_salary", { precision: 12, scale: 2 }).notNull(),
  daPercent: numeric("da_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  hraPercent: numeric("hra_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  otherAllowances: jsonb("other_allowances").default([]).notNull(),
  pfEmployeePercent: numeric("pf_employee_percent", { precision: 5, scale: 2 }).notNull().default("12"),
  pfEmployerPercent: numeric("pf_employer_percent", { precision: 5, scale: 2 }).notNull().default("12"),
  esiApplicable: boolean("esi_applicable").notNull().default(false),
  professionalTaxState: text("professional_tax_state").default("DL"),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payrollRuns = pgTable("payroll_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  month: text("month").notNull(), // "2025-06"
  status: text("status").notNull().default("DRAFT"), // DRAFT, PROCESSED, APPROVED, PAID
  processedById: uuid("processed_by_id").references(() => users.id, { onDelete: "restrict" }),
  approvedById: uuid("approved_by_id").references(() => users.id, { onDelete: "restrict" }),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  totalGross: numeric("total_gross", { precision: 14, scale: 2 }),
  totalNetPay: numeric("total_net_pay", { precision: 14, scale: 2 }),
  totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  schoolMonthUnique: unique("payroll_runs_school_month_unique").on(t.schoolId, t.month),
}));

export const payslips = pgTable("payslips", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => schools.id, { onDelete: "restrict" }),
  payrollRunId: uuid("payroll_run_id").notNull().references(() => payrollRuns.id, { onDelete: "restrict" }),
  staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "restrict" }),
  month: text("month").notNull(),
  workingDays: integer("working_days").notNull(),
  presentDays: integer("present_days").notNull(),
  basicSalary: numeric("basic_salary", { precision: 12, scale: 2 }).notNull(),
  da: numeric("da", { precision: 12, scale: 2 }).notNull().default("0"),
  hra: numeric("hra", { precision: 12, scale: 2 }).notNull().default("0"),
  otherAllowances: numeric("other_allowances", { precision: 12, scale: 2 }).notNull().default("0"),
  grossSalary: numeric("gross_salary", { precision: 12, scale: 2 }).notNull(),
  pfEmployee: numeric("pf_employee", { precision: 10, scale: 2 }).notNull().default("0"),
  pfEmployer: numeric("pf_employer", { precision: 10, scale: 2 }).notNull().default("0"),
  esi: numeric("esi", { precision: 10, scale: 2 }).notNull().default("0"),
  professionalTax: numeric("professional_tax", { precision: 10, scale: 2 }).notNull().default("0"),
  tds: numeric("tds", { precision: 10, scale: 2 }).notNull().default("0"),
  loanDeduction: numeric("loan_deduction", { precision: 10, scale: 2 }).notNull().default("0"),
  totalDeductions: numeric("total_deductions", { precision: 12, scale: 2 }).notNull(),
  netPay: numeric("net_pay", { precision: 12, scale: 2 }).notNull(),
  pdfS3Key: text("pdf_s3_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  runStaffUnique: unique("payslips_run_staff_unique").on(t.payrollRunId, t.staffId),
  staffIdx: index("payslips_staff_idx").on(t.staffId),
}));
