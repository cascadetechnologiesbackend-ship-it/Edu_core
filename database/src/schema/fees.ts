// ─── Fees Schema ─────────────────────────────────────────────────────────────
// Tables: fee_structures, fee_heads, fee_concessions, fee_invoices,
//         fee_payments, fee_refunds, payment_gateway_logs

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
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { schools, academicYears, users } from "./core";
import { students } from "./students";
import { classes } from "./academics";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const feeTermEnum = pgEnum("fee_term", [
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
  "ONE_TIME",
]);

export const feeHeadTypeEnum = pgEnum("fee_head_type", [
  "TUITION",
  "TRANSPORT",
  "LIBRARY",
  "LAB",
  "SPORTS",
  "HOSTEL",
  "ACTIVITY",
  "ADMISSION",
  "EXAM",
  "MISCELLANEOUS",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "CHEQUE",
  "ONLINE",
  "DD",
  "NEFT",
  "RTGS",
  "UPI",
]);

export const feeInvoiceStatusEnum = pgEnum("fee_invoice_status", [
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "WAIVED",
  "CANCELLED",
]);

export const concessionTypeEnum = pgEnum("concession_type", [
  "STAFF_WARD",
  "SIBLING",
  "RTE_FREE",
  "MERIT_SCHOLARSHIP",
  "CUSTOM",
  "MANAGEMENT_QUOTA",
]);

export const lateFeeTypeEnum = pgEnum("late_fee_type", [
  "FLAT",
  "PERCENTAGE",
  "PER_DAY",
]);

// ─── fee_heads ────────────────────────────────────────────────────────────────

export const feeHeads = pgTable(
  "fee_heads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: varchar("code", { length: 10 }),
    priority: integer("priority").notNull().default(99),
    description: text("description"),
    category: varchar("category", { length: 30 }).notNull().default("RECURRING"),
    headType: feeHeadTypeEnum("head_type").notNull(),
    discountEligible: boolean("discount_eligible").notNull().default(true),
    lateFineEligible: boolean("late_fine_eligible").notNull().default(false),
    isRefundable: boolean("is_refundable").notNull().default(false),
    isTaxable: boolean("is_taxable").notNull().default(false),
    gstPercentage: numeric("gst_percentage", {
      precision: 5,
      scale: 2,
    }).default("0"),
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
    schoolIdx: index("fee_heads_school_idx").on(t.schoolId),
    schoolNameUnique: unique("fee_heads_school_name_unique").on(
      t.schoolId,
      t.name,
    ),
  }),
);

// ─── fee_structures ───────────────────────────────────────────────────────────

export const feeStructures = pgTable(
  "fee_structures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    feeHeadId: uuid("fee_head_id")
      .notNull()
      .references(() => feeHeads.id, { onDelete: "restrict" }),
    term: feeTermEnum("term").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    lateFeeType: lateFeeTypeEnum("late_fee_type"),
    lateFeeAmount: numeric("late_fee_amount", { precision: 10, scale: 2 }),
    dailyLateFeeAmount: numeric("daily_late_fee_amount", { precision: 10, scale: 2 }),
    lateFeeCap: numeric("late_fee_cap", { precision: 10, scale: 2 }),
    lateFeeStartAfterDays: integer("late_fee_start_after_days"),
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
    schoolYearClassIdx: index("fee_structures_school_year_class_idx").on(
      t.schoolId,
      t.academicYearId,
      t.classId,
    ),
    uniqueSlotIdx: uniqueIndex("fee_structures_unique_slot_idx")
      .on(
        t.schoolId,
        t.academicYearId,
        t.classId,
        t.feeHeadId,
        t.term,
      )
      .where(sql`"deleted_at" IS NULL`),
  }),
);

// ─── fee_concessions ─────────────────────────────────────────────────────────

export const feeConcessions = pgTable(
  "fee_concessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id")
      .references(() => students.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .references(() => academicYears.id, { onDelete: "restrict" }),
    concessionType: concessionTypeEnum("concession_type").notNull(),
    concessionName: text("concession_name").notNull(),
    appliesTo: text("applies_to").notNull().default("ALL"), // "ALL" or fee_head_id
    discountPercentage: numeric("discount_percentage", {
      precision: 5,
      scale: 2,
    }),
    discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }),
    approvedById: uuid("approved_by_id")
      .references(() => users.id, { onDelete: "restrict" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
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
    studentIdx: index("fee_concessions_student_idx").on(t.studentId),
    schoolYearIdx: index("fee_concessions_school_year_idx").on(
      t.schoolId,
      t.academicYearId,
    ),
  }),
);

// ─── fee_invoices ─────────────────────────────────────────────────────────────

export const feeInvoices = pgTable(
  "fee_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: text("invoice_number").notNull(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    feeStructureId: uuid("fee_structure_id").references(
      () => feeStructures.id,
      { onDelete: "restrict" },
    ),
    grossAmount: numeric("gross_amount", { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    lateFeeAmount: numeric("late_fee_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    taxAmount: numeric("tax_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    balanceAmount: numeric("balance_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    status: feeInvoiceStatusEnum("status").notNull().default("PENDING"),
    term: feeTermEnum("term").notNull(),
    // SMS reminder tracking
    reminderSentD7: boolean("reminder_sent_d7").notNull().default(false),
    reminderSentD15: boolean("reminder_sent_d15").notNull().default(false),
    reminderSentD30: boolean("reminder_sent_d30").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    invoiceNumberUnique: unique("fee_invoices_number_unique").on(
      t.schoolId,
      t.invoiceNumber,
    ),
    studentIdx: index("fee_invoices_student_idx").on(t.studentId),
    schoolYearIdx: index("fee_invoices_school_year_idx").on(
      t.schoolId,
      t.academicYearId,
    ),
    statusIdx: index("fee_invoices_status_idx").on(t.status),
    dueDateIdx: index("fee_invoices_due_date_idx").on(t.dueDate),
  }),
);

// ─── fee_payments ─────────────────────────────────────────────────────────────

export const feePayments = pgTable(
  "fee_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    receiptNumber: text("receipt_number").notNull(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    feeInvoiceId: uuid("fee_invoice_id")
      .notNull()
      .references(() => feeInvoices.id, { onDelete: "restrict" }),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    transactionReference: text("transaction_reference"),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),
    collectedById: uuid("collected_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    remarks: text("remarks"),
    receiptS3Key: text("receipt_s3_key"),
    receiptGroupId: text("receipt_group_id"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    receiptUnique: unique("fee_payments_receipt_unique").on(
      t.schoolId,
      t.receiptNumber,
    ),
    invoiceIdx: index("fee_payments_invoice_idx").on(t.feeInvoiceId),
    studentIdx: index("fee_payments_student_idx").on(t.studentId),
    dateIdx: index("fee_payments_date_idx").on(t.paymentDate),
    receiptGroupIdx: index("fee_payments_receipt_group_idx").on(
      t.schoolId,
      t.receiptGroupId,
    ),
    idempotencyIdx: index("fee_payments_idempotency_idx").on(
      t.schoolId,
      t.idempotencyKey,
    ),
  }),
);

// ─── fee_refunds ──────────────────────────────────────────────────────────────

export const feeRefunds = pgTable(
  "fee_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    feePaymentId: uuid("fee_payment_id")
      .notNull()
      .references(() => feePayments.id, { onDelete: "restrict" }),
    refundAmount: numeric("refund_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("PENDING"), // PENDING, APPROVED, PROCESSED, REJECTED
    approvedById: uuid("approved_by_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    paymentIdx: index("fee_refunds_payment_idx").on(t.feePaymentId),
    schoolIdx: index("fee_refunds_school_idx").on(t.schoolId),
  }),
);

// ─── payment_gateway_logs ─────────────────────────────────────────────────────

export const paymentGatewayLogs = pgTable(
  "payment_gateway_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    feeInvoiceId: uuid("fee_invoice_id").references(() => feeInvoices.id, {
      onDelete: "restrict",
    }),
    gateway: text("gateway").notNull().default("RAZORPAY"),
    gatewayOrderId: text("gateway_order_id"),
    gatewayPaymentId: text("gateway_payment_id"),
    gatewaySignature: text("gateway_signature"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    feeAmount: numeric("fee_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull(), // CREATED, ATTEMPTED, PAID, FAILED, REFUNDED
    webhookPayload: text("webhook_payload"), // Sanitised — no card data
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolIdx: index("payment_gateway_logs_school_idx").on(t.schoolId),
    orderIdx: index("payment_gateway_logs_order_idx").on(t.gatewayOrderId),
  }),
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const feeInvoicesRelations = relations(feeInvoices, ({ one, many }) => ({
  school: one(schools, {
    fields: [feeInvoices.schoolId],
    references: [schools.id],
  }),
  student: one(students, {
    fields: [feeInvoices.studentId],
    references: [students.id],
  }),
  academicYear: one(academicYears, {
    fields: [feeInvoices.academicYearId],
    references: [academicYears.id],
  }),
  feeStructure: one(feeStructures, {
    fields: [feeInvoices.feeStructureId],
    references: [feeStructures.id],
  }),
  payments: many(feePayments),
}));

export const feeStructuresRelations = relations(
  feeStructures,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [feeStructures.schoolId],
      references: [schools.id],
    }),
    academicYear: one(academicYears, {
      fields: [feeStructures.academicYearId],
      references: [academicYears.id],
    }),
    class: one(classes, {
      fields: [feeStructures.classId],
      references: [classes.id],
    }),
    feeHead: one(feeHeads, {
      fields: [feeStructures.feeHeadId],
      references: [feeHeads.id],
    }),
    invoices: many(feeInvoices),
  }),
);

export const feeHeadsRelations = relations(feeHeads, ({ one, many }) => ({
  school: one(schools, {
    fields: [feeHeads.schoolId],
    references: [schools.id],
  }),
  structures: many(feeStructures),
}));

export const feePaymentsRelations = relations(feePayments, ({ one, many }) => ({
  school: one(schools, {
    fields: [feePayments.schoolId],
    references: [schools.id],
  }),
  student: one(students, {
    fields: [feePayments.studentId],
    references: [students.id],
  }),
  invoice: one(feeInvoices, {
    fields: [feePayments.feeInvoiceId],
    references: [feeInvoices.id],
  }),
  collectedBy: one(users, {
    fields: [feePayments.collectedById],
    references: [users.id],
  }),
  refunds: many(feeRefunds),
}));

export const feeRefundsRelations = relations(feeRefunds, ({ one }) => ({
  school: one(schools, {
    fields: [feeRefunds.schoolId],
    references: [schools.id],
  }),
  payment: one(feePayments, {
    fields: [feeRefunds.feePaymentId],
    references: [feePayments.id],
  }),
}));

export const paymentGatewayLogsRelations = relations(
  paymentGatewayLogs,
  ({ one }) => ({
    school: one(schools, {
      fields: [paymentGatewayLogs.schoolId],
      references: [schools.id],
    }),
    invoice: one(feeInvoices, {
      fields: [paymentGatewayLogs.feeInvoiceId],
      references: [feeInvoices.id],
    }),
  }),
);

export const feeConcessionsRelations = relations(feeConcessions, ({ one }) => ({
  school: one(schools, {
    fields: [feeConcessions.schoolId],
    references: [schools.id],
  }),
  student: one(students, {
    fields: [feeConcessions.studentId],
    references: [students.id],
  }),
  academicYear: one(academicYears, {
    fields: [feeConcessions.academicYearId],
    references: [academicYears.id],
  }),
}));

// ─── fee_groups ───────────────────────────────────────────────────────────────

export const feeGroups = pgTable(
  "fee_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
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
    schoolIdx: index("fee_groups_school_idx").on(t.schoolId),
    yearIdx: index("fee_groups_year_idx").on(t.academicYearId),
  }),
);

// ─── fee_group_heads ──────────────────────────────────────────────────────────

export const feeGroupHeads = pgTable(
  "fee_group_heads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feeGroupId: uuid("fee_group_id")
      .notNull()
      .references(() => feeGroups.id, { onDelete: "cascade" }),
    feeHeadId: uuid("fee_head_id")
      .notNull()
      .references(() => feeHeads.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    groupIdx: index("fee_group_heads_group_idx").on(t.feeGroupId),
    headIdx: index("fee_group_heads_head_idx").on(t.feeHeadId),
  }),
);

// ─── fee_discounts ────────────────────────────────────────────────────────────

export const feeDiscounts = pgTable(
  "fee_discounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: varchar("code", { length: 20 }),
    discountType: text("discount_type").notNull().default("PERCENTAGE"), // FIXED or PERCENTAGE
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
    appliesToFeeHeadId: uuid("applies_to_fee_head_id").references(
      () => feeHeads.id,
      { onDelete: "set null" },
    ),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    description: text("description"),
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
    schoolIdx: index("fee_discounts_school_idx").on(t.schoolId),
    schoolCodeUnique: unique("fee_discounts_code_unique").on(
      t.schoolId,
      t.code,
    ),
  }),
);

// ─── fee_challans ─────────────────────────────────────────────────────────────

export const feeChallans = pgTable(
  "fee_challans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    challanNumber: text("challan_number").notNull(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    feeInvoiceId: uuid("fee_invoice_id")
      .notNull()
      .references(() => feeInvoices.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("GENERATED"), // GENERATED, SUBMITTED, CLEARED, EXPIRED
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    referenceNumber: text("reference_number"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolIdx: index("fee_challans_school_idx").on(t.schoolId),
    challanUnique: unique("fee_challans_number_unique").on(
      t.schoolId,
      t.challanNumber,
    ),
    studentIdx: index("fee_challans_student_idx").on(t.studentId),
  }),
);

// ─── fee_due_slips ────────────────────────────────────────────────────────────

export const feeDueSlips = pgTable(
  "fee_due_slips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    batchNumber: text("batch_number").notNull(),
    classId: uuid("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    slipCount: integer("slip_count").notNull().default(0),
    status: text("status").notNull().default("GENERATED"), // GENERATED, PRINTED, SENT_SMS
    generatedById: uuid("generated_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolIdx: index("fee_due_slips_school_idx").on(t.schoolId),
    batchUnique: unique("fee_due_slips_batch_unique").on(
      t.schoolId,
      t.batchNumber,
    ),
  }),
);

// ─── fee_carry_forwards ───────────────────────────────────────────────────────

export const feeCarryForwards = pgTable(
  "fee_carry_forwards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    fromAcademicYearId: uuid("from_academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    toAcademicYearId: uuid("to_academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    previousDueAmount: numeric("previous_due_amount", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    carriedAmount: numeric("carried_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    status: text("status").notNull().default("APPLIED"), // DRAFT, APPLIED, REVERSED
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    appliedById: uuid("applied_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolIdx: index("fee_carry_forwards_school_idx").on(t.schoolId),
    studentIdx: index("fee_carry_forwards_student_idx").on(t.studentId),
  }),
);

// ─── fee_audit_logs ───────────────────────────────────────────────────────────

export const feeAuditLogs = pgTable(
  "fee_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "restrict" }),
    action: text("action").notNull(), // RECEIPT_CANCELLED, MANUAL_ADJUSTMENT, DISCOUNT_OVERRIDE, FEE_WAIVED
    entityType: text("entity_type").notNull(), // FEE_INVOICE, FEE_PAYMENT, FEE_DISCOUNT, LEDGER_ENTRY
    entityId: uuid("entity_id").notNull(),
    previousData: text("previous_data"),
    newData: text("new_data"),
    reason: text("reason").notNull(),
    performedById: uuid("performed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    schoolIdx: index("fee_audit_logs_school_idx").on(t.schoolId),
    entityIdx: index("fee_audit_logs_entity_idx").on(t.entityId),
    dateIdx: index("fee_audit_logs_date_idx").on(t.createdAt),
  }),
);

// ─── Extended Relations ───────────────────────────────────────────────────────

export const feeGroupsRelations = relations(feeGroups, ({ one, many }) => ({
  school: one(schools, {
    fields: [feeGroups.schoolId],
    references: [schools.id],
  }),
  academicYear: one(academicYears, {
    fields: [feeGroups.academicYearId],
    references: [academicYears.id],
  }),
  groupHeads: many(feeGroupHeads),
}));

export const feeGroupHeadsRelations = relations(feeGroupHeads, ({ one }) => ({
  feeGroup: one(feeGroups, {
    fields: [feeGroupHeads.feeGroupId],
    references: [feeGroups.id],
  }),
  feeHead: one(feeHeads, {
    fields: [feeGroupHeads.feeHeadId],
    references: [feeHeads.id],
  }),
}));

export const feeDiscountsRelations = relations(feeDiscounts, ({ one }) => ({
  school: one(schools, {
    fields: [feeDiscounts.schoolId],
    references: [schools.id],
  }),
  feeHead: one(feeHeads, {
    fields: [feeDiscounts.appliesToFeeHeadId],
    references: [feeHeads.id],
  }),
}));

export const feeChallansRelations = relations(feeChallans, ({ one }) => ({
  school: one(schools, {
    fields: [feeChallans.schoolId],
    references: [schools.id],
  }),
  student: one(students, {
    fields: [feeChallans.studentId],
    references: [students.id],
  }),
  invoice: one(feeInvoices, {
    fields: [feeChallans.feeInvoiceId],
    references: [feeInvoices.id],
  }),
}));

export const feeCarryForwardsRelations = relations(feeCarryForwards, ({ one }) => ({
  school: one(schools, {
    fields: [feeCarryForwards.schoolId],
    references: [schools.id],
  }),
  student: one(students, {
    fields: [feeCarryForwards.studentId],
    references: [students.id],
  }),
  fromAcademicYear: one(academicYears, {
    fields: [feeCarryForwards.fromAcademicYearId],
    references: [academicYears.id],
  }),
  toAcademicYear: one(academicYears, {
    fields: [feeCarryForwards.toAcademicYearId],
    references: [academicYears.id],
  }),
  appliedBy: one(users, {
    fields: [feeCarryForwards.appliedById],
    references: [users.id],
  }),
}));

export const feeAuditLogsRelations = relations(feeAuditLogs, ({ one }) => ({
  school: one(schools, {
    fields: [feeAuditLogs.schoolId],
    references: [schools.id],
  }),
  performedBy: one(users, {
    fields: [feeAuditLogs.performedById],
    references: [users.id],
  }),
}));

export const feeDueSlipsRelations = relations(feeDueSlips, ({ one }) => ({
  school: one(schools, {
    fields: [feeDueSlips.schoolId],
    references: [schools.id],
  }),
  class: one(classes, {
    fields: [feeDueSlips.classId],
    references: [classes.id],
  }),
  academicYear: one(academicYears, {
    fields: [feeDueSlips.academicYearId],
    references: [academicYears.id],
  }),
  generatedBy: one(users, {
    fields: [feeDueSlips.generatedById],
    references: [users.id],
  }),
}));

